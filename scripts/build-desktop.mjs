import { mkdir, copyFile, readdir } from 'node:fs/promises';
const output = new URL('../dist/desktop/',import.meta.url);
await mkdir(output,{recursive:true});
for (const file of await readdir(new URL('../desktop/',import.meta.url))) {
  if (/\.(html|css|js)$/.test(file) && !file.endsWith('.test.js')) await copyFile(new URL('../desktop/'+file,import.meta.url),new URL(file,output));
}
await copyFile(new URL('../src/server/lib/description-filter.js',import.meta.url),new URL('description-filter.js',output));
