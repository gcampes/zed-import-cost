import ts from "typescript";

export interface ParsedImport {
  moduleSpecifier: string;
  importType: "named" | "default" | "namespace" | "sideEffect";
  specifiers: string[];
  line: number;
  endCharacter: number;
}

/**
 * Parse import statements from a TypeScript/JavaScript source file.
 * Skips type-only imports and relative imports.
 */
export function parseImports(sourceCode: string, fileName = "file.tsx"): ParsedImport[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceCode,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const imports: ParsedImport[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // Handle: import ... from '...'
    if (ts.isImportDeclaration(node)) {
      const parsed = parseImportDeclaration(node, sourceFile);
      if (parsed) imports.push(...parsed);
      return;
    }

    // Handle: const x = require('...')
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const parsed = parseRequireDeclaration(decl, sourceFile);
        if (parsed) imports.push(parsed);
      }
    }
  });

  return imports;
}

function parseImportDeclaration(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
): ParsedImport[] | null {
  // Skip type-only imports: `import type { ... } from '...'`
  if (node.importClause?.isTypeOnly) return null;

  const moduleSpecifier = (node.moduleSpecifier as ts.StringLiteral).text;

  // Skip relative imports and node builtins
  if (shouldSkipModule(moduleSpecifier)) return null;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
  const baseInfo = { moduleSpecifier, line, endCharacter: character };
  const results: ParsedImport[] = [];

  const clause = node.importClause;
  if (!clause) {
    // Side-effect import: `import 'module'`
    results.push({ ...baseInfo, importType: "sideEffect", specifiers: [] });
    return results;
  }

  // Default import: `import foo from 'module'`
  if (clause.name) {
    results.push({
      ...baseInfo,
      importType: "default",
      specifiers: [clause.name.text],
    });
  }

  const bindings = clause.namedBindings;
  if (bindings) {
    if (ts.isNamespaceImport(bindings)) {
      // Namespace: `import * as foo from 'module'`
      results.push({
        ...baseInfo,
        importType: "namespace",
        specifiers: [bindings.name.text],
      });
    } else if (ts.isNamedImports(bindings)) {
      // Named: `import { a, b } from 'module'`
      const specifiers = bindings.elements
        .filter((el) => !el.isTypeOnly)
        .map((el) => (el.propertyName || el.name).text);

      if (specifiers.length > 0) {
        results.push({ ...baseInfo, importType: "named", specifiers });
      }
    }
  }

  return results.length > 0 ? results : null;
}

function parseRequireDeclaration(
  decl: ts.VariableDeclaration,
  sourceFile: ts.SourceFile,
): ParsedImport | null {
  if (!decl.initializer || !ts.isCallExpression(decl.initializer)) return null;

  const call = decl.initializer;
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "require") return null;
  if (call.arguments.length !== 1 || !ts.isStringLiteral(call.arguments[0])) return null;

  const moduleSpecifier = (call.arguments[0] as ts.StringLiteral).text;
  if (shouldSkipModule(moduleSpecifier)) return null;

  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    decl.parent.getEnd(),
  );

  // Determine import type from the binding pattern
  if (ts.isObjectBindingPattern(decl.name)) {
    const specifiers = decl.name.elements.map((el) => {
      const name = el.propertyName || el.name;
      return ts.isIdentifier(name) ? name.text : "";
    }).filter(Boolean);

    return {
      moduleSpecifier,
      importType: "named",
      specifiers,
      line,
      endCharacter: character,
    };
  }

  return {
    moduleSpecifier,
    importType: "default",
    specifiers: [ts.isIdentifier(decl.name) ? decl.name.text : "default"],
    line,
    endCharacter: character,
  };
}

const NODE_BUILTINS = new Set([
  "assert", "buffer", "child_process", "cluster", "console", "constants",
  "crypto", "dgram", "dns", "domain", "events", "fs", "http", "https",
  "module", "net", "os", "path", "perf_hooks", "process", "punycode",
  "querystring", "readline", "repl", "stream", "string_decoder", "sys",
  "timers", "tls", "tty", "url", "util", "v8", "vm", "worker_threads", "zlib",
]);

function shouldSkipModule(moduleSpecifier: string): boolean {
  // Skip relative imports
  if (moduleSpecifier.startsWith(".")) return true;
  // Skip node: protocol
  if (moduleSpecifier.startsWith("node:")) return true;
  // Skip node builtins
  if (NODE_BUILTINS.has(moduleSpecifier)) return true;
  return false;
}
