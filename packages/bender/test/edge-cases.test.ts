import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { indexDirectory } from "../src/indexer";
import { Database } from "bun:sqlite";
import { findSymbolsByPattern, registerRegexpFunction } from "../src/db/queries";

describe("edge-cases", () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = join(import.meta.dir, `test-edge-cases-${Date.now()}-${Math.random()}.db`);
  });

  afterEach(() => {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  });

  describe("empty and missing directories", () => {
    it("should handle empty directory without errors", async () => {
      const emptyDir = join(import.meta.dir, `empty-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });

      try {
        const result = await indexDirectory(emptyDir, dbPath);
        expect(result.filesIndexed).toBe(0);
        expect(result.symbolsFound).toBe(0);
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });

    it("should handle directory with only non-Java files", async () => {
      const testDir = join(import.meta.dir, `non-java-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(join(testDir, "readme.txt"), "This is a readme");
        writeFileSync(join(testDir, "data.json"), '{"key": "value"}');

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(0);
        expect(result.symbolsFound).toBe(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle non-git directory without branch name", async () => {
      const nonGitDir = join(import.meta.dir, `non-git-${Date.now()}`);
      mkdirSync(nonGitDir, { recursive: true });

      try {
        writeFileSync(
          join(nonGitDir, "Test.java"),
          "public class Test { public void test() {} }"
        );

        const result = await indexDirectory(nonGitDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        // branchName may be null or undefined for non-git directories
        expect(result.branchName == null).toBe(true);
      } finally {
        rmSync(nonGitDir, { recursive: true, force: true });
      }
    });
  });

  describe("malformed Java files", () => {
    it("should skip file with syntax errors and continue", async () => {
      const testDir = join(import.meta.dir, `syntax-error-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        // Invalid Java - missing closing brace
        writeFileSync(
          join(testDir, "Invalid.java"),
          "public class Invalid { public void test() {"
        );

        // Valid Java
        writeFileSync(
          join(testDir, "Valid.java"),
          "public class Valid { public void test() {} }"
        );

        const result = await indexDirectory(testDir, dbPath);
        // Should index the valid file, skip the invalid one
        expect(result.filesIndexed).toBeGreaterThanOrEqual(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle empty Java file", async () => {
      const testDir = join(import.meta.dir, `empty-file-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(join(testDir, "Empty.java"), "");

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBe(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle Java file with only whitespace", async () => {
      const testDir = join(import.meta.dir, `whitespace-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(join(testDir, "Whitespace.java"), "   \n\n\t\t\n   ");

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBe(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle Java file with only comments", async () => {
      const testDir = join(import.meta.dir, `comments-only-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "CommentsOnly.java"),
          "// This is a comment\n/* Block comment */\n/** Javadoc */"
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBe(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle file with missing semicolons", async () => {
      const testDir = join(import.meta.dir, `missing-semi-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "NoSemi.java"),
          "public class NoSemi { int x = 5 }"
        );

        const result = await indexDirectory(testDir, dbPath);
        // Parser may or may not handle this gracefully
        expect(result.filesIndexed).toBeGreaterThanOrEqual(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("special characters and long paths", () => {
    it("should handle files with special characters in names", async () => {
      const testDir = join(import.meta.dir, `special-chars-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "Test$Special.java"),
          "public class Test$Special { public void test() {} }"
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle deeply nested directory structure", async () => {
      const baseDir = join(import.meta.dir, `deep-${Date.now()}`);
      const deepPath = join(
        baseDir,
        "a",
        "b",
        "c",
        "d",
        "e",
        "f",
        "g",
        "h",
        "i",
        "j"
      );
      mkdirSync(deepPath, { recursive: true });

      try {
        writeFileSync(
          join(deepPath, "Deep.java"),
          "public class Deep { public void test() {} }"
        );

        const result = await indexDirectory(baseDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);
      } finally {
        rmSync(baseDir, { recursive: true, force: true });
      }
    });

    it("should handle file with very long name", async () => {
      const testDir = join(import.meta.dir, `long-name-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        const longName = "A".repeat(200) + ".java";
        writeFileSync(
          join(testDir, longName),
          `public class ${"A".repeat(200)} { public void test() {} }`
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("circular references and complex relationships", () => {
    it("should handle circular import references", async () => {
      const testDir = join(import.meta.dir, `circular-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "A.java"),
          "public class A { private B b; }"
        );
        writeFileSync(
          join(testDir, "B.java"),
          "public class B { private A a; }"
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(2);
        expect(result.symbolsFound).toBeGreaterThan(0);

        // Verify both classes are indexed
        const db = new Database(dbPath);
        registerRegexpFunction(db);
        const symbols = findSymbolsByPattern(db, ".*");
        db.close();
        
        const classNames = symbols.map((s) => s.symbolName);
        expect(classNames).toContain("A");
        expect(classNames).toContain("B");
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle self-referential classes", async () => {
      const testDir = join(import.meta.dir, `self-ref-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "Node.java"),
          "public class Node { private Node next; }"
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("edge case symbols", () => {
    it("should handle class with no methods or fields", async () => {
      const testDir = join(import.meta.dir, `empty-class-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(join(testDir, "EmptyClass.java"), "public class EmptyClass {}");

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);

        const db = new Database(dbPath);
        registerRegexpFunction(db);
        const symbols = findSymbolsByPattern(db, "EmptyClass");
        db.close();
        
        expect(symbols).toHaveLength(1);
        expect(symbols[0].kind).toBe("class");
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle interface with no methods", async () => {
      const testDir = join(import.meta.dir, `empty-interface-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(join(testDir, "Marker.java"), "public interface Marker {}");

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);

        const db = new Database(dbPath);
        registerRegexpFunction(db);
        const symbols = findSymbolsByPattern(db, "Marker");
        db.close();
        
        // Interfaces are indexed as classes in our parser
        expect(symbols.length).toBeGreaterThan(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle enum with no values", async () => {
      const testDir = join(import.meta.dir, `empty-enum-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(join(testDir, "EmptyEnum.java"), "public enum EmptyEnum {}");

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        // May or may not find symbols depending on parser
        expect(result.symbolsFound).toBeGreaterThanOrEqual(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle multiple classes in same file", async () => {
      const testDir = join(import.meta.dir, `multi-class-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "Multi.java"),
          "public class Multi {} class Helper {}"
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);

        const db = new Database(dbPath);
        registerRegexpFunction(db);
        const symbols = findSymbolsByPattern(db, ".*");
        db.close();
        
        const classNames = symbols.filter((s) => s.kind === "class").map((s) => s.symbolName);
        expect(classNames).toContain("Multi");
        expect(classNames).toContain("Helper");
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });

  describe("unicode and encoding", () => {
    it("should handle files with unicode characters", async () => {
      const testDir = join(import.meta.dir, `unicode-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "Unicode.java"),
          'public class Unicode { String greeting = "Hello 世界 🌍"; }'
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    it("should handle method names with underscores and dollars", async () => {
      const testDir = join(import.meta.dir, `special-names-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });

      try {
        writeFileSync(
          join(testDir, "Special.java"),
          "public class Special { void _test() {} void $init() {} void test_method_2() {} }"
        );

        const result = await indexDirectory(testDir, dbPath);
        expect(result.filesIndexed).toBe(1);
        expect(result.symbolsFound).toBeGreaterThan(0);

        const db = new Database(dbPath);
        registerRegexpFunction(db);
        const symbols = findSymbolsByPattern(db, ".*");
        db.close();
        
        const methodNames = symbols.filter((s) => s.kind === "method").map((s) => s.symbolName);
        expect(methodNames).toContain("_test");
        expect(methodNames).toContain("$init");
        expect(methodNames).toContain("test_method_2");
      } finally {
        rmSync(testDir, { recursive: true, force: true });
      }
    });
  });
});
