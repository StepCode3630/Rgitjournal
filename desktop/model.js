export function columnValue(entry, column) {
  let value = String(entry[column.source] ?? '');
  if (column.regex) {
    const match = value.match(new RegExp(column.regex, column.flags ?? 's'));
    value = match?.[column.group ?? 0] ?? '';
  }
  return value;
}
export function formatCell(entry, column) {
  const value = columnValue(entry, column);
  if (column.format === 'date') return new Date(value).toLocaleString('fr-CH', { year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit' });
  if (column.format === 'duration') return `${Math.floor(Number(value || 0)/60)}h ${Number(value || 0)%60}m`;
  return value;
}
export function groupEntries(entries) {
  const groups = new Map();
  for (const e of [...entries].sort((a,b)=>new Date(a.date)-new Date(b.date))) {
    const key = new Date(e.date).toISOString().slice(0,10);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(e);
  }
  return [...groups].map(([day,entries])=>({day,entries,minutes:entries.reduce((n,e)=>n+Number(e.duration || 0),0)}));
}
export function csv(headers, rows) {
  const escape = value => /[",\r\n]/.test(String(value ?? '')) ? `"${String(value).replaceAll('"','""')}"` : String(value ?? '');
  return '\uFEFF' + [headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n');
}
export function exportTable(entries, columns) {
  return { headers:columns.map(c=>c.label),rows:groupEntries(entries).flatMap(g=>g.entries.map(e=>columns.map(c=>formatCell(e,c)))) };
}
