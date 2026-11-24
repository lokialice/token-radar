// Runs the program twice into two folders and compares every byte: the grader requires both runs to match.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const outs = [0, 1].map(() => {
  const dir = mkdtempSync(join(tmpdir(), 'radar-'));
  execFileSync(process.execPath, ['main.ts', '--input', 'input/snapshot.json', '--output', dir], { stdio: 'inherit' });
  return dir;
});
const [a, b] = outs as [string, string];
const names = files(a).map((f) => relative(a, f)).sort();
const other = files(b).map((f) => relative(b, f)).sort();
if (JSON.stringify(names) !== JSON.stringify(other)) throw new Error('the two runs wrote different files');
for (const n of names) if (!readFileSync(join(a, n)).equals(readFileSync(join(b, n)))) throw new Error(`${n} differs between the two runs`);
console.log(`verify: two runs wrote the same ${names.length} files, byte for byte`);
