import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  InlayHint,
  InlayHintParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { parseImports, ParsedImport } from "./parser";
import { calculateImportSize, formatImportSize, formatBytes, ImportSize } from "./calculator";
import { SizeCache } from "./cache";
import { fileURLToPath, URL } from "node:url";
import { dirname } from "node:path";

// Create LSP connection and document manager
const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);
const cache = new SizeCache();

// Track in-flight calculations to avoid duplicate work
const pendingCalculations = new Map<string, Promise<ImportSize>>();

connection.onInitialize((_params: InitializeParams): InitializeResult => {
  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      inlayHintProvider: {
        resolveProvider: false,
      },
    },
  };
});

connection.languages.inlayHint.on(async (params: InlayHintParams): Promise<InlayHint[]> => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return [];

  const text = doc.getText();
  const resolveDir = getResolveDir(params.textDocument.uri);
  if (!resolveDir) return [];

  const imports = parseImports(text, doc.uri);

  // Filter to imports within the requested range
  const rangeStart = params.range.start.line;
  const rangeEnd = params.range.end.line;
  const visibleImports = imports.filter(
    (imp) => imp.line >= rangeStart && imp.line <= rangeEnd,
  );

  // Calculate sizes concurrently with deduplication
  const hints = await Promise.all(
    visibleImports.map((imp) => calculateAndCreateHint(imp, resolveDir)),
  );

  return hints.filter((h): h is InlayHint => h !== null);
});

async function calculateAndCreateHint(
  imp: ParsedImport,
  resolveDir: string,
): Promise<InlayHint | null> {
  const cacheKey = SizeCache.makeKey(imp.moduleSpecifier, imp.importType, imp.specifiers);

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return createHint(imp, cached);
  }

  // Check if there's already a pending calculation for this key
  const pendingKey = `${cacheKey}::${resolveDir}`;
  let pending = pendingCalculations.get(pendingKey);
  if (!pending) {
    pending = calculateImportSize(imp, resolveDir)
      .then((size) => {
        cache.set(cacheKey, size);
        return size;
      })
      .catch((_err) => {
        // Silently skip packages that can't be bundled
        return null as unknown as ImportSize;
      })
      .finally(() => {
        pendingCalculations.delete(pendingKey);
      });
    pendingCalculations.set(pendingKey, pending);
  }

  const size = await pending;
  if (!size || (size.rawBytes === 0 && size.gzipBytes === 0)) return null;

  return createHint(imp, size);
}

function createHint(imp: ParsedImport, size: ImportSize): InlayHint {
  return {
    position: { line: imp.line, character: imp.endCharacter },
    label: formatImportSize(size),
    paddingLeft: true,
    tooltip: [
      `Bundle size for '${imp.moduleSpecifier}'`,
      `Minified: ${formatBytes(size.rawBytes)}`,
      `Gzipped: ${formatBytes(size.gzipBytes)}`,
    ].join("\n"),
  };
}

function getResolveDir(uri: string): string | null {
  try {
    const filePath = fileURLToPath(uri);
    return dirname(filePath);
  } catch {
    return null;
  }
}

// Invalidate cache when documents change
documents.onDidChangeContent((_change) => {
  // We don't clear the full cache — sizes for packages don't change
  // unless node_modules changes, which is rare.
  // The cache TTL handles staleness.
});

documents.listen(connection);
connection.listen();
