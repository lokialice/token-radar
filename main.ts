// Token radar for make.fun's token-radar-01 (Node 22, standard library only).
//
// Reads the sealed snapshot (/input/snapshot.json, or --input), runs the engine in dashboard/model.js (the same
// file the page runs in the browser) and writes /output: board.json, data.js, dashboard/, screenshots/ and, last,
// dossier.json. Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input input/snapshot.json
// The work is in lib/build.ts, which the tests call directly.
import { fileURLToPath } from 'node:url';
import { build, resolveOptions } from './lib/build.ts';

const result = await build(resolveOptions(process.argv, process.env, fileURLToPath(new URL('.', import.meta.url))));
(result.code === 0 ? process.stdout : process.stderr).write(`${result.message}\n`);
process.exit(result.code);
