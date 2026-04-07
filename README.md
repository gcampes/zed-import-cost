# Import Cost for Zed

Display the bundle size of imported packages inline in the editor.

![Import Cost](https://citw.dev/_next/image?url=%2Fposts%2Fimport-cost%2F1quov3TFpgG2ur7myCLGtsA.gif&w=1080&q=75)

Inspired by [wix/import-cost](https://github.com/wix/import-cost) for VS Code.

## Features

- Shows minified + gzipped bundle size next to each import statement
- Supports ES6 `import` and CommonJS `require()`
- Uses [esbuild](https://esbuild.github.io/) for fast bundling
- Skips type-only imports, relative imports, and Node.js builtins
- Results are cached for performance

## Setup

After installing the extension, you need to **enable inlay hints** in your Zed settings. Open your settings (`Cmd+,` on macOS) and add:

```json
{
  "inlay_hints": {
    "enabled": true,
    "show_other_hints": true
  }
}
```

That's it. Open any `.js`, `.ts`, `.jsx`, or `.tsx` file with third-party imports and you should see bundle sizes appear inline.

## How it works

The extension runs a lightweight LSP server that:

1. Parses import statements using the TypeScript compiler API
2. Bundles each import with esbuild (minified, tree-shaken)
3. Returns the size as LSP inlay hints, which Zed renders inline

The LSP server resolves packages from the project's `node_modules`, so you need to have your dependencies installed (`npm install` / `yarn` / `pnpm install`).

## License

MIT
