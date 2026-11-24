import { writeFileSync } from "node:fs";

import { assetsPath, generateWidgetAssets } from "./widget-assets.mjs";

const source = await generateWidgetAssets();
writeFileSync(assetsPath, source);
process.stdout.write(`Widget assets written (${source.length} bytes).\n`);
