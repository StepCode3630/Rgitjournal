import { mkdir, copyFile, readdir, cp } from "node:fs/promises";
const output = new URL("../dist/desktop/", import.meta.url);
await mkdir(output, { recursive: true });
await cp(
  new URL("../desktop/icons/", import.meta.url),
  new URL("icons/", output),
  { recursive: true },
);
for (const file of await readdir(new URL("../desktop/", import.meta.url))) {
  if (/\.(html|css|js)$/.test(file) && !file.endsWith(".test.js"))
    await copyFile(
      new URL("../desktop/" + file, import.meta.url),
      new URL(file, output),
    );
}
await copyFile(
  new URL("../src/server/lib/description-filter.js", import.meta.url),
  new URL("description-filter.js", output),
);
await copyFile(
  new URL("../src/assets/GitKrakenModalHelp.png", import.meta.url),
  new URL("GitKrakenModalHelp.png", output),
);
