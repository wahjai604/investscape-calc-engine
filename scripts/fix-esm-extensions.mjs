// Node's native ESM resolver requires explicit file extensions on relative
// imports/exports. tsconfig.esm.json uses moduleResolution "bundler" (needed
// because src/ imports are extensionless), which lets tsc compile but emits
// dist/esm/*.js with those same extensionless relative specifiers — invalid
// for `node dist/esm/index.js` or any consumer importing this package as ESM.
// This walks the emitted output and appends ".js" (or "/index.js" for
// directory imports) to every relative specifier.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";

const DIST_ESM = join(import.meta.dirname, "..", "dist", "esm");

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (entry.name.endsWith(".js")) files.push(full);
  }
  return files;
}

function exists(path) {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function resolveSpecifier(fileDir, specifier) {
  if (!specifier.startsWith(".")) return specifier;
  if (specifier.endsWith(".js")) return specifier;

  const asFile = join(fileDir, `${specifier}.js`);
  if (exists(asFile)) return `${specifier}.js`;

  const asIndex = join(fileDir, specifier, "index.js");
  if (exists(asIndex)) return `${specifier}/index.js`;

  return specifier;
}

const specifierPattern = /((?:from|import)\s+["'])(\.[^"']+)(["'])/g;

for (const file of walk(DIST_ESM)) {
  const source = readFileSync(file, "utf8");
  const fixed = source.replace(specifierPattern, (match, prefix, specifier, suffix) => {
    return `${prefix}${resolveSpecifier(dirname(file), specifier)}${suffix}`;
  });
  if (fixed !== source) writeFileSync(file, fixed);
}
