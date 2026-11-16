import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const cli = require.resolve("@tauri-apps/cli/tauri.js");
const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "src-tauri/icons/RGitJIcon.svg");
const output = path.join(root, "src-tauri/icons");
const temporary = await mkdtemp(path.join(tmpdir(), "gitjournal-icons-"));
const sizes = [32, 48, 128, 256, 512];
function generate(directory, args = []) {
  const result = spawnSync(
    process.execPath,
    [cli, "icon", source, "--fit", "contain", "--output", directory, ...args],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error("Échec de la génération des icônes Tauri");
}
try {
  generate(
    path.join(temporary, "png"),
    sizes.flatMap((size) => ["--png", String(size)]),
  );
  generate(path.join(temporary, "platforms"));
  for (const size of sizes) {
    const filename = `${size}x${size}.png`;
    await copyFile(
      path.join(temporary, "png", filename),
      path.join(output, filename),
    );
  }
  await copyFile(
    path.join(temporary, "platforms/icon.icns"),
    path.join(output, "RGitJIcon.icns"),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
