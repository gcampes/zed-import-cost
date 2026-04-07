import { describe, it, expect } from "vitest";
import { calculateImportSize, formatBytes, formatImportSize } from "../calculator";
import type { ParsedImport } from "../parser";
import { resolve } from "node:path";

// resolveDir points to server/ where node_modules lives
const resolveDir = resolve(__dirname, "../..");

function makeImport(overrides: Partial<ParsedImport> & { moduleSpecifier: string }): ParsedImport {
  return {
    importType: "named",
    specifiers: [],
    line: 0,
    endCharacter: 0,
    ...overrides,
  };
}

describe("calculateImportSize", () => {
  it("calculates size for a named import", async () => {
    const imp = makeImport({
      moduleSpecifier: "esbuild",
      importType: "named",
      specifiers: ["build"],
    });
    const result = await calculateImportSize(imp, resolveDir);

    expect(result.moduleSpecifier).toBe("esbuild");
    expect(result.rawBytes).toBeGreaterThan(0);
    expect(result.gzipBytes).toBeGreaterThan(0);
    expect(result.gzipBytes).toBeLessThan(result.rawBytes);
  });

  it("calculates size for a default import", async () => {
    const imp = makeImport({
      moduleSpecifier: "esbuild",
      importType: "default",
    });
    const result = await calculateImportSize(imp, resolveDir);

    expect(result.rawBytes).toBeGreaterThan(0);
  });

  it("calculates size for a namespace import", async () => {
    const imp = makeImport({
      moduleSpecifier: "esbuild",
      importType: "namespace",
      specifiers: ["esbuild"],
    });
    const result = await calculateImportSize(imp, resolveDir);

    expect(result.rawBytes).toBeGreaterThan(0);
  });

  it("throws for a non-existent package", async () => {
    const imp = makeImport({
      moduleSpecifier: "this-package-does-not-exist-xyz-12345",
      importType: "default",
    });

    await expect(calculateImportSize(imp, resolveDir)).rejects.toThrow();
  });

  it("gzip size is smaller than raw size", async () => {
    const imp = makeImport({
      moduleSpecifier: "typescript",
      importType: "default",
    });
    const result = await calculateImportSize(imp, resolveDir);

    expect(result.gzipBytes).toBeLessThan(result.rawBytes);
    // typescript is large, raw should be > 1MB
    expect(result.rawBytes).toBeGreaterThan(1_000_000);
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0B");
    expect(formatBytes(500)).toBe("500B");
    expect(formatBytes(1023)).toBe("1023B");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(1024)).toBe("1.0kB");
    expect(formatBytes(1536)).toBe("1.5kB");
    expect(formatBytes(10240)).toBe("10.0kB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(1048576)).toBe("1.0MB");
    expect(formatBytes(5242880)).toBe("5.0MB");
  });
});

describe("formatImportSize", () => {
  it("formats a size result", () => {
    const size = { moduleSpecifier: "test", rawBytes: 12600, gzipBytes: 4200 };
    expect(formatImportSize(size)).toBe("12.3kB (gzip: 4.1kB)");
  });

  it("formats small packages", () => {
    const size = { moduleSpecifier: "test", rawBytes: 500, gzipBytes: 200 };
    expect(formatImportSize(size)).toBe("500B (gzip: 200B)");
  });
});
