# import-cost-server

LSP server that powers the [Import Cost](https://github.com/gcampes/zed-import-cost) extension for Zed.

Displays inline bundle sizes for JavaScript and TypeScript imports using LSP inlay hints.

## How it works

1. Parses import statements (`import` and `require()`) using the TypeScript compiler API
2. Bundles each import with [esbuild](https://esbuild.github.io/) (minified, tree-shaken)
3. Measures raw and gzipped output size
4. Returns sizes as `textDocument/inlayHint` LSP responses

Skips type-only imports, relative imports, and Node.js builtins. Results are cached with a 5-minute TTL.

## Usage

This package is installed and launched automatically by the [Import Cost Zed extension](https://github.com/gcampes/zed-import-cost). You don't need to install it manually.

The server resolves packages from the project's `node_modules`, so your project dependencies need to be installed (`npm install` / `yarn` / `pnpm install`).

## License

MIT
