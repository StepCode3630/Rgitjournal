import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
const require = createRequire(import.meta.url);
const targets = { linux: "deb,rpm", darwin: "app,dmg", win32: "nsis,msi" };
if (process.argv[2] && process.argv[2] !== process.platform) {
  throw new Error(
    `Cette commande doit être exécutée sur ${process.argv[2]}. La compilation croisée du bureau n’est pas configurée.`,
  );
}
if (!targets[process.platform])
  throw new Error("Plateforme de bureau non prise en charge");
// Execute the JS CLI with Node, avoiding Windows .cmd/shell quoting differences.
const cli = require.resolve("@tauri-apps/cli/tauri.js");
const result = spawnSync(
  process.execPath,
  [cli, "build", "--bundles", targets[process.platform]],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
