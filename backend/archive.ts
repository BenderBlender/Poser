import fs from 'node:fs';
import path from 'node:path';
import { zipSync } from 'fflate';

// Explicit publishable-file allowlist: credentials and private working images stay local.
export function collectSourceFiles(root: string): Record<string, Uint8Array> {
  const result: Record<string, Uint8Array> = {};
  const files = ['App.tsx','index.tsx','index.html','index.css','types.ts','server.ts','package.json','package-lock.json',
    'tsconfig.json','vite.config.ts','tailwind.config.cjs','postcss.config.cjs','README.md','.env.example','.gitignore','start.ps1',
    'Start-Pose-Studio.bat','Stop-Pose-Studio.bat','manage-app.ps1'];
  const directories = ['components','services','shared','backend','utils','tests','vendor'];
  const add = (relative: string) => {
    const full = path.join(root, relative);
    if (!fs.existsSync(full) || fs.lstatSync(full).isSymbolicLink()) return;
    if (fs.statSync(full).isFile()) result[relative.replaceAll('\\','/')] = fs.readFileSync(full);
  };
  for (const file of files) add(file);
  const walk = (relative: string, extensions = /\.(tsx?|js|css|json|md)$/) => {
    const dir = path.join(root, relative);
    if (!fs.existsSync(dir) || fs.lstatSync(dir).isSymbolicLink()) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const child = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(child, extensions);
      else if (extensions.test(entry.name)) add(child);
    }
  };
  directories.forEach(directory => walk(directory));
  // Published documentation is separate from private working images in output/.
  walk('docs', /\.(md|html|txt|png|jpe?g|webp)$/i);
  return result;
}
export function sourceZip(root: string): Uint8Array { return zipSync(collectSourceFiles(root), { level: 6 }); }
