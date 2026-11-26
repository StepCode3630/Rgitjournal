import { copyFile, mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const release = path.join(root, "src-tauri", "target", "release");
const output = path.join(release, "bundle", "portable");
const { productName, version } = JSON.parse(
  await readFile(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const name = `${productName}_${version}`;
const platform = `${process.platform}-${process.arch}`;
const suffix = {
  "win32-x64": "windows-x64-portable.exe",
  "linux-x64": "linux-x64-portable.tar.gz",
  "darwin-arm64": "macos-arm64-portable.zip",
}[platform];
if (!suffix) throw new Error(`Format portable non configuré pour ${platform}`);

await mkdir(output, { recursive: true });
const destination = path.join(output, `${name}_${suffix}`);
if (process.platform === "win32") {
  await copyFile(path.join(release, "gitjournal-desktop.exe"), destination);
} else if (process.platform === "linux") {
  execFileSync(
    "tar",
    [
      "-czf",
      destination,
      "-C",
      release,
      "gitjournal-desktop",
      "-C",
      root,
      "LICENSE",
      "-C",
      path.join(root, "src-tauri", "fonts"),
      "OFL.txt",
    ],
    { stdio: "inherit" },
  );
} else {
  const app = path.join(release, "bundle", "macos", `${productName}.app`);
  execFileSync(
    "ditto",
    ["-c", "-k", "--sequesterRsrc", "--keepParent", app, destination],
    { stdio: "inherit" },
  );
}
console.log(destination);
