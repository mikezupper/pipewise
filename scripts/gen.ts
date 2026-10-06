// Regenerates every derived file: the folder index.ts barrels in src/, the
// API catalog in docs/generated/, and the function count in README.md.
// Run: pnpm gen
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_FOLDERS,
  publicExports,
  renderCatalog,
  renderIndex,
  ROOT,
  SRC,
} from "../tests/structure/catalog.ts";

for (const folder of PUBLIC_FOLDERS) {
  writeFileSync(join(SRC, folder, "index.ts"), renderIndex(folder));
}
writeFileSync(join(ROOT, "docs/generated/operators.md"), renderCatalog());
const readme = join(ROOT, "README.md");
const count = publicExports().filter((e) => e.isFunction).length;
writeFileSync(
  readme,
  readFileSync(readme, "utf8").replace(/\d+ functions in all/, `${String(count)} functions in all`),
);
console.log(
  `regenerated src/*/index.ts, docs/generated/operators.md, README count (${String(count)})`,
);
