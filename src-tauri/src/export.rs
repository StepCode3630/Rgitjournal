use gitjournal_core::project::Result;
use printpdf::*;
use serde_json::Value;
use std::collections::{HashMap, HashSet};

struct Fonts {
    fonts: Vec<(ParsedFont, FontId)>,
    indices: HashMap<char, usize>,
}
impl Fonts {
    fn load(doc: &mut PdfDocument, text: &str) -> Result<Self> {
        let primary = ParsedFont::from_bytes(
            include_bytes!("../fonts/NotoSans-Regular.ttf"),
            0,
            &mut Vec::new(),
        )
        .ok_or("Police PDF invalide")?;
        let id = doc.add_font(&primary);
        let mut fonts = Self {
            fonts: vec![(primary, id)],
            indices: HashMap::new(),
        };
        let mut missing: HashSet<char> = text
            .chars()
            .filter(|c| !c.is_control() && fonts.fonts[0].0.lookup_glyph_index(*c as u32).is_none())
            .collect();
        if !missing.is_empty() {
            let mut db = fontdb::Database::new();
            db.load_system_fonts();
            for face in db.faces() {
                let covers = db
                    .with_face_data(face.id, |bytes, index| {
                        ttf_parser::Face::parse(bytes, index)
                            .ok()
                            .is_some_and(|f| missing.iter().any(|c| f.glyph_index(*c).is_some()))
                    })
                    .unwrap_or(false);
                if !covers {
                    continue;
                }
                if let Some(Some(font)) = db.with_face_data(face.id, |bytes, index| {
                    ParsedFont::from_bytes(bytes, index as usize, &mut Vec::new())
                }) {
                    let covered: Vec<_> = missing
                        .iter()
                        .copied()
                        .filter(|c| font.lookup_glyph_index(*c as u32).is_some())
                        .collect();
                    if covered.is_empty() {
                        continue;
                    }
                    let idx = fonts.fonts.len();
                    let id = doc.add_font(&font);
                    fonts.fonts.push((font, id));
                    for c in covered {
                        fonts.indices.insert(c, idx);
                        missing.remove(&c);
                    }
                    if missing.is_empty() {
                        break;
                    }
                }
            }
        }
        if !missing.is_empty() {
            return Err("Une police nécessaire au texte du PDF est absente. Installez une police couvrant ces caractères, ou utilisez Imprimer pour le rendu système.".into());
        }
        Ok(fonts)
    }
    fn index(&self, c: char) -> usize {
        self.indices.get(&c).copied().unwrap_or(0)
    }
    fn width(&self, c: char, size: f32) -> f32 {
        let f = &self.fonts[self.index(c)].0;
        f.lookup_glyph_index(c as u32).map_or(0., |g| {
            f.get_horizontal_advance(g) as f32 / f.font_metrics.units_per_em as f32 * size
        })
    }
    fn draw(&self, ops: &mut Vec<Op>, text: &str, x: f32, y: f32, size: f32) {
        let mut x = x;
        let mut run = String::new();
        let mut current = 0;
        let flush = |run: &mut String, current: usize, x: &mut f32, ops: &mut Vec<Op>| {
            if run.is_empty() {
                return;
            }
            let id = self.fonts[current].1.clone();
            ops.extend([
                Op::StartTextSection,
                Op::SetTextCursor {
                    pos: Point {
                        x: Pt(*x),
                        y: Pt(y),
                    },
                },
                Op::SetFontSize {
                    size: Pt(size),
                    font: id.clone(),
                },
                Op::WriteText {
                    items: vec![TextItem::Text(run.clone())],
                    font: id,
                },
                Op::EndTextSection,
            ]);
            *x += run.chars().map(|c| self.width(c, size)).sum::<f32>();
            run.clear();
        };
        for c in text.chars().filter(|c| !c.is_control()) {
            let idx = self.index(c);
            if idx != current {
                flush(&mut run, current, &mut x, ops);
                current = idx;
            }
            run.push(c);
        }
        flush(&mut run, current, &mut x, ops);
    }
    fn wrap(&self, text: &str, max: f32, size: f32) -> Vec<String> {
        let mut lines = Vec::new();
        for raw in text.split('\n') {
            let mut line = String::new();
            let mut width = 0.;
            for c in raw.chars().filter(|c| !c.is_control()) {
                let w = self.width(c, size);
                if width + w > max && !line.is_empty() {
                    lines.push(std::mem::take(&mut line));
                    width = 0.;
                }
                line.push(c);
                width += w;
            }
            lines.push(line);
        }
        lines
    }
}

/// PDF indépendant d'un navigateur ou processus Node, A4 paysage, avec
/// répétition des en-têtes et pagination même pour une cellule très longue.
pub fn pdf(title: &str, table: &Value) -> Result<Vec<u8>> {
    let headers: Vec<String> = table["headers"]
        .as_array()
        .ok_or("En-têtes manquants")?
        .iter()
        .map(|v| v.as_str().unwrap_or("").to_owned())
        .collect();
    if headers.is_empty() {
        return Err("Nombre de colonnes invalide".into());
    }
    let rows: Vec<Vec<String>> = table["rows"]
        .as_array()
        .ok_or("Lignes manquantes")?
        .iter()
        .map(|r| {
            r.as_array()
                .map(|cells| {
                    cells
                        .iter()
                        .map(|v| v.as_str().unwrap_or("").to_owned())
                        .collect()
                })
                .ok_or_else(|| "Ligne invalide".to_owned())
        })
        .collect::<Result<_>>()?;
    let mut doc = PdfDocument::new(title);
    let text = std::iter::once(title.to_owned())
        .chain(headers.clone())
        .chain(rows.iter().flatten().cloned())
        .collect::<Vec<_>>()
        .join("\n");
    let fonts = Fonts::load(&mut doc, &text)?;
    let width = 785. / headers.len() as f32;
    let mut pages = Vec::new();
    let mut ops = Vec::new();
    let title_lines = fonts.wrap(title, 785., 13.);
    let title_height = title_lines.len() as f32 * 16.;
    if title_height > 200. {
        return Err("Titre trop long pour l’en-tête PDF".into());
    }
    let header_top = 568. - title_height - 4.;
    let mut y = header_top;
    let heading = |ops: &mut Vec<Op>| {
        for (i, line) in title_lines.iter().enumerate() {
            fonts.draw(ops, line, 28., 568. - i as f32 * 16., 13.);
        }
        for (i, h) in headers.iter().enumerate() {
            for (j, line) in fonts.wrap(h, width - 8., 8.).iter().enumerate() {
                fonts.draw(
                    ops,
                    line,
                    28. + i as f32 * width,
                    header_top - j as f32 * 10.,
                    8.,
                );
            }
        }
    };
    heading(&mut ops);
    let header_height = headers
        .iter()
        .map(|h| fonts.wrap(h, width - 8., 8.).len())
        .max()
        .unwrap_or(1) as f32
        * 10.;
    y -= header_height + 12.;
    for (row_index, row) in rows.into_iter().enumerate() {
        let spanning = row.len() == 1;
        let cells: Vec<_> = row
            .iter()
            .map(|s| fonts.wrap(s, if spanning { 777. } else { width - 8. }, 8.))
            .collect();
        let height = cells.iter().map(Vec::len).max().unwrap_or(1);
        for line in 0..height {
            if y < 35. {
                pages.push(PdfPage::new(Mm(297.), Mm(210.), std::mem::take(&mut ops)));
                heading(&mut ops);
                y = header_top - header_height - 12.;
            }
            for (i, cell) in cells.iter().enumerate() {
                if let Some(s) = cell.get(line) {
                    fonts.draw(&mut ops, s, 28. + i as f32 * width, y, 8.);
                    if let Some(url) = table["links"][row_index][i]
                        .as_str()
                        .and_then(|s| tauri::Url::parse(s).ok())
                        .filter(|u| ["http", "https"].contains(&u.scheme()))
                    {
                        ops.push(Op::LinkAnnotation {
                            link: LinkAnnotation::new(
                                Rect {
                                    x: Pt(28. + i as f32 * width),
                                    y: Pt(y - 2.),
                                    width: Pt(width - 8.),
                                    height: Pt(11.),
                                },
                                Actions::uri(url.to_string()),
                                Some(BorderArray::Solid([0., 0., 0.])),
                                None,
                                None,
                            ),
                        });
                    }
                }
            }
            y -= 11.;
        }
        y -= 7.;
    }
    pages.push(PdfPage::new(Mm(297.), Mm(210.), ops));
    Ok(doc
        .with_pages(pages)
        .save(&PdfSaveOptions::default(), &mut Vec::new()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pdf_is_paginated_and_preserves_accented_text() {
        let table = serde_json::json!({"headers":["Date","Tâche","Description"],"rows":(0..150).map(|i|vec!["13.11.2026".to_owned(),format!("Tâche numéro {i} — éàü"),"Description\nSuite".to_owned()]).collect::<Vec<_>>()});
        let bytes = pdf("Journal vérifié", &table).unwrap();
        assert!(bytes.starts_with(b"%PDF-"));
        let doc = PdfDocument::parse(&bytes, &PdfParseOptions::default(), &mut Vec::new()).unwrap();
        assert!(doc.pages.len() > 1);
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("journal.pdf");
        std::fs::write(&path, bytes).unwrap();
        // Request UTF-8 explicitly: the host's pdftotext build/configuration may
        // otherwise emit a Windows code page instead of UTF-8.
        if let Ok(out) = std::process::Command::new("pdftotext")
            .args(["-enc", "UTF-8"])
            .arg(&path)
            .arg("-")
            .output()
        {
            assert!(
                out.status.success(),
                "pdftotext failed: {}",
                String::from_utf8_lossy(&out.stderr)
            );
            let text =
                String::from_utf8(out.stdout).expect("pdftotext -enc UTF-8 must emit valid UTF-8");
            assert!(text.contains("Tâche numéro 149"));
            assert!(text.contains("éàü"));
        }
    }
}
