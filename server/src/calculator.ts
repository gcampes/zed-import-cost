import * as esbuild from "esbuild";
import { gzipSync } from "node:zlib";
import type { ParsedImport } from "./parser";

export interface ImportSize {
  moduleSpecifier: string;
  rawBytes: number;
  gzipBytes: number;
}

/**
 * Calculate the bundle size of an import using esbuild.
 * Uses stdin API — no temp files needed.
 */
export async function calculateImportSize(
  imp: ParsedImport,
  resolveDir: string,
): Promise<ImportSize> {
  const entryCode = buildEntryContent(imp);

  const result = await esbuild.build({
    stdin: {
      contents: entryCode,
      resolveDir,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    minify: true,
    platform: "node",
    treeShaking: true,
    metafile: true,
    logLevel: "silent",
  });

  const output = result.outputFiles[0];
  if (!output) {
    return { moduleSpecifier: imp.moduleSpecifier, rawBytes: 0, gzipBytes: 0 };
  }

  const rawBytes = output.contents.byteLength;
  const gzipBytes = gzipSync(output.contents).byteLength;

  return { moduleSpecifier: imp.moduleSpecifier, rawBytes, gzipBytes };
}

/**
 * Build the entry code for esbuild.
 * Must re-export (not just import) so tree-shaking doesn't eliminate everything.
 */
function buildEntryContent(imp: ParsedImport): string {
  const mod = imp.moduleSpecifier;

  switch (imp.importType) {
    case "named":
      return `export { ${imp.specifiers.join(", ")} } from '${mod}';`;
    case "default":
      return `export { default } from '${mod}';`;
    case "namespace":
      return `import * as ns from '${mod}'; export default ns;`;
    case "sideEffect":
      return `import '${mod}';`;
  }
}

/**
 * Format bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format an ImportSize into the display label.
 */
export function formatImportSize(size: ImportSize): string {
  return `${formatBytes(size.rawBytes)} (gzip: ${formatBytes(size.gzipBytes)})`;
}
