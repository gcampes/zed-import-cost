import { describe, it, expect } from "vitest";
import { parseImports } from "../parser";

describe("parseImports", () => {
  describe("ES6 imports", () => {
    it("parses named imports", () => {
      const result = parseImports(`import { debounce, throttle } from 'lodash';`);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "lodash",
        importType: "named",
        specifiers: ["debounce", "throttle"],
      });
    });

    it("parses default imports", () => {
      const result = parseImports(`import React from 'react';`);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "react",
        importType: "default",
        specifiers: ["React"],
      });
    });

    it("parses namespace imports", () => {
      const result = parseImports(`import * as lodash from 'lodash';`);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "lodash",
        importType: "namespace",
        specifiers: ["lodash"],
      });
    });

    it("parses side-effect imports", () => {
      const result = parseImports(`import 'normalize.css';`);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "normalize.css",
        importType: "sideEffect",
        specifiers: [],
      });
    });

    it("parses mixed default + named imports", () => {
      const result = parseImports(`import React, { useState, useEffect } from 'react';`);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "react",
        importType: "default",
        specifiers: ["React"],
      });
      expect(result[1]).toMatchObject({
        moduleSpecifier: "react",
        importType: "named",
        specifiers: ["useState", "useEffect"],
      });
    });

    it("handles aliased named imports", () => {
      const result = parseImports(`import { useState as state } from 'react';`);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "react",
        importType: "named",
        specifiers: ["useState"],
      });
    });

    it("parses multiple import statements", () => {
      const code = [
        `import React from 'react';`,
        `import { render } from 'react-dom';`,
        `import axios from 'axios';`,
      ].join("\n");
      const result = parseImports(code);
      expect(result).toHaveLength(3);
      expect(result.map((r) => r.moduleSpecifier)).toEqual([
        "react",
        "react-dom",
        "axios",
      ]);
    });
  });

  describe("require() calls", () => {
    it("parses default require", () => {
      const result = parseImports(`const lodash = require('lodash');`);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "lodash",
        importType: "default",
        specifiers: ["lodash"],
      });
    });

    it("parses destructured require", () => {
      const result = parseImports(
        `const { debounce, throttle } = require('lodash');`,
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        moduleSpecifier: "lodash",
        importType: "named",
        specifiers: ["debounce", "throttle"],
      });
    });
  });

  describe("skipping", () => {
    it("skips type-only imports", () => {
      const result = parseImports(`import type { Foo } from 'bar';`);
      expect(result).toHaveLength(0);
    });

    it("skips inline type specifiers", () => {
      const result = parseImports(
        `import { type Foo, useState } from 'react';`,
      );
      expect(result).toHaveLength(1);
      expect(result[0].specifiers).toEqual(["useState"]);
    });

    it("skips import with only type specifiers", () => {
      const result = parseImports(`import { type Foo, type Bar } from 'baz';`);
      expect(result).toHaveLength(0);
    });

    it("skips relative imports", () => {
      const result = parseImports(`import { foo } from './utils';`);
      expect(result).toHaveLength(0);
    });

    it("skips parent relative imports", () => {
      const result = parseImports(`import { foo } from '../utils';`);
      expect(result).toHaveLength(0);
    });

    it("skips node: protocol imports", () => {
      const result = parseImports(`import { readFile } from 'node:fs';`);
      expect(result).toHaveLength(0);
    });

    it("skips node builtin imports", () => {
      const builtins = ["fs", "path", "os", "crypto", "http", "stream"];
      for (const mod of builtins) {
        const result = parseImports(`import ${mod} from '${mod}';`);
        expect(result).toHaveLength(0);
      }
    });

    it("skips relative require()", () => {
      const result = parseImports(`const foo = require('./foo');`);
      expect(result).toHaveLength(0);
    });
  });

  describe("line positions", () => {
    it("reports correct line numbers (0-indexed)", () => {
      const code = [
        `import React from 'react';`,
        `import axios from 'axios';`,
        ``,
        `import lodash from 'lodash';`,
      ].join("\n");
      const result = parseImports(code);
      expect(result.map((r) => r.line)).toEqual([0, 1, 3]);
    });
  });
});
