/**
 * Tests for query engine functions
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "../src/db/schema";
import { createSnapshot } from "../src/db/snapshots";
import {
  insertDocument,
  insertSymbol,
  insertOccurrence,
  insertRelationship,
  insertDocumentation,
} from "../src/db/writer";
import {
  registerRegexpFunction,
  findSymbolsByPattern,
  getSymbolOccurrences,
  getSymbolRelationships,
  getSymbolDocumentation,
  getSymbolSource,
} from "../src/db/queries";
import type { QuerySymbol, OccurrenceInfo, RelatedSymbol, DocumentationInfo, SourceInfo } from "../src/db/queries";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("Query Engine", () => {
  let db: Database;
  let snapshotId: number;

  beforeEach(() => {
    db = initializeDatabase(":memory:");
    registerRegexpFunction(db);
    const snapshot = createSnapshot(db, "test-snapshot");
    snapshotId = snapshot.id;
  });

  afterEach(() => {
    db.close();
  });

  describe("registerRegexpFunction", () => {
    it("is a no-op for Bun SQLite (regex done in JS)", () => {
      // registerRegexpFunction is called in beforeEach but does nothing
      // This test verifies it doesn't throw errors
      expect(() => registerRegexpFunction(db)).not.toThrow();
    });

    it("regex matching works via JavaScript filtering", () => {
      // Insert test data
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      // Regex matching happens in findSymbolsByPattern via JavaScript
      const results = findSymbolsByPattern(db, ".*Calculator.*");
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(s => s.id === symbolId)).toBe(true);
    });

    it("handles invalid regex patterns gracefully", () => {
      insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Test",
        symbol_name: "Test",
        kind: "class",
        signature: "class Test",
      });

      // Invalid regex should return empty array (not crash)
      const results = findSymbolsByPattern(db, "[invalid(regex");
      expect(results).toHaveLength(0);
    });
  });

  describe("findSymbolsByPattern", () => {
    beforeEach(() => {
      // Create test symbols
      const docId = insertDocument(db, snapshotId, {
        path: "src/Calculator.java",
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      const calcId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: calcId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 0,
        end_line: 5,
        end_col: 14,
      });

      const addId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.add",
        symbol_name: "add",
        kind: "method",
        signature: "int add(int, int)",
        parent_symbol_id: calcId,
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: addId,
        document_id: docId,
        role: "definition",
        start_line: 10,
        start_col: 4,
        end_line: 10,
        end_col: 7,
      });

      const multiplyId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.multiply",
        symbol_name: "multiply",
        kind: "method",
        signature: "int multiply(int, int)",
        parent_symbol_id: calcId,
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: multiplyId,
        document_id: docId,
        role: "definition",
        start_line: 15,
        start_col: 4,
        end_line: 15,
        end_col: 12,
      });

      const valueId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.value",
        symbol_name: "value",
        kind: "field",
        signature: "int value",
        parent_symbol_id: calcId,
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: valueId,
        document_id: docId,
        role: "definition",
        start_line: 7,
        start_col: 4,
        end_line: 7,
        end_col: 9,
      });
    });

    it("finds symbols by qualified name pattern", () => {
      const results = findSymbolsByPattern(db, ".*Calculator.*");
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(s => s.qualifiedName === "com.example.Calculator")).toBe(true);
    });

    it("finds symbols by simple name pattern", () => {
      const results = findSymbolsByPattern(db, "^add$");
      
      expect(results).toHaveLength(1);
      expect(results[0].symbolName).toBe("add");
      expect(results[0].kind).toBe("method");
    });

    it("filters by symbol type", () => {
      const results = findSymbolsByPattern(db, ".*", { type: "method" });
      
      expect(results.every(s => s.kind === "method")).toBe(true);
      expect(results.length).toBe(2); // add and multiply
    });

    it("includes definition location", () => {
      const results = findSymbolsByPattern(db, "^Calculator$");
      
      expect(results).toHaveLength(1);
      expect(results[0].definitionLine).toBe(5);
      expect(results[0].definitionFile).toBe("src/Calculator.java");
    });

    it("returns empty array for no matches", () => {
      const results = findSymbolsByPattern(db, "NonExistentClass");
      
      expect(results).toHaveLength(0);
    });

    it("handles case-insensitive matching", () => {
      const results = findSymbolsByPattern(db, "calculator");
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(s => s.symbolName === "Calculator")).toBe(true);
    });

    it("works with wildcard patterns", () => {
      const results = findSymbolsByPattern(db, ".*mult.*");
      
      expect(results).toHaveLength(1);
      expect(results[0].symbolName).toBe("multiply");
    });
  });

  describe("getSymbolOccurrences", () => {
    let calcId: number;
    let docId: number;

    beforeEach(() => {
      docId = insertDocument(db, snapshotId, {
        path: "src/Calculator.java",
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      calcId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      // Definition
      insertOccurrence(db, snapshotId, {
        symbol_id: calcId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 0,
        end_line: 5,
        end_col: 14,
      });

      // References
      insertOccurrence(db, snapshotId, {
        symbol_id: calcId,
        document_id: docId,
        role: "reference",
        start_line: 20,
        start_col: 8,
        end_line: 20,
        end_col: 22,
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: calcId,
        document_id: docId,
        role: "reference",
        start_line: 25,
        start_col: 12,
        end_line: 25,
        end_col: 26,
      });
    });

    it("returns all occurrences for a symbol", () => {
      const occurrences = getSymbolOccurrences(db, calcId, snapshotId);
      
      expect(occurrences).toHaveLength(3);
    });

    it("includes definition occurrence", () => {
      const occurrences = getSymbolOccurrences(db, calcId, snapshotId);
      
      const definition = occurrences.find(o => o.role === "definition");
      expect(definition).toBeDefined();
      expect(definition?.startLine).toBe(5);
      expect(definition?.filePath).toBe("src/Calculator.java");
    });

    it("includes reference occurrences", () => {
      const occurrences = getSymbolOccurrences(db, calcId, snapshotId);
      
      const references = occurrences.filter(o => o.role === "reference");
      expect(references).toHaveLength(2);
      expect(references[0].startLine).toBe(20);
      expect(references[1].startLine).toBe(25);
    });

    it("returns empty array for non-existent symbol", () => {
      const occurrences = getSymbolOccurrences(db, 99999, snapshotId);
      
      expect(occurrences).toHaveLength(0);
    });

    it("orders occurrences by file path and line number", () => {
      const occurrences = getSymbolOccurrences(db, calcId, snapshotId);
      
      // Should be sorted by line number
      expect(occurrences[0].startLine).toBeLessThan(occurrences[1].startLine);
      expect(occurrences[1].startLine).toBeLessThan(occurrences[2].startLine);
    });
  });

  describe("getSymbolRelationships", () => {
    let parentId: number;
    let childId: number;
    let grandchildId: number;
    let referenceId: number;

    beforeEach(() => {
      // Create a relationship hierarchy
      parentId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Parent",
        symbol_name: "Parent",
        kind: "class",
        signature: "class Parent",
      });

      childId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Child",
        symbol_name: "Child",
        kind: "class",
        signature: "class Child extends Parent",
      });

      grandchildId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.GrandChild",
        symbol_name: "GrandChild",
        kind: "class",
        signature: "class GrandChild extends Child",
      });

      referenceId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Parent.doSomething",
        symbol_name: "doSomething",
        kind: "method",
        signature: "void doSomething()",
      });

      // Create relationships
      insertRelationship(db, snapshotId, {
        from_symbol_id: childId,
        to_symbol_id: parentId,
        kind: "extends",
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: grandchildId,
        to_symbol_id: childId,
        kind: "extends",
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: referenceId,
        to_symbol_id: parentId,
        kind: "references",
      });
    });

    it("finds direct relationships with radius 1", () => {
      const related = getSymbolRelationships(db, parentId, snapshotId, 1);
      
      expect(related.length).toBeGreaterThan(0);
      // Should find Child (extends Parent) and doSomething (references Parent)
      expect(related.some(r => r.symbolName === "Child")).toBe(true);
      expect(related.some(r => r.symbolName === "doSomething")).toBe(true);
    });

    it("finds transitive relationships with radius 2", () => {
      const related = getSymbolRelationships(db, parentId, snapshotId, 2);
      
      // Should find Child at distance 1 and GrandChild at distance 2
      expect(related.some(r => r.symbolName === "Child" && r.distance === 1)).toBe(true);
      expect(related.some(r => r.symbolName === "GrandChild" && r.distance === 2)).toBe(true);
    });

    it("respects maximum radius", () => {
      const related = getSymbolRelationships(db, parentId, snapshotId, 1);
      
      // GrandChild is at distance 2, should not be included with radius 1
      expect(related.some(r => r.symbolName === "GrandChild")).toBe(false);
    });

    it("includes relationship kind", () => {
      const related = getSymbolRelationships(db, parentId, snapshotId, 2);
      
      const child = related.find(r => r.symbolName === "Child");
      expect(child?.relationshipKind).toBe("extends");
      
      const method = related.find(r => r.symbolName === "doSomething");
      expect(method?.relationshipKind).toBe("references");
    });

    it("returns empty array for symbol with no relationships", () => {
      const isolatedId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Isolated",
        symbol_name: "Isolated",
        kind: "class",
        signature: "class Isolated",
      });

      const related = getSymbolRelationships(db, isolatedId, snapshotId, 5);
      
      expect(related).toHaveLength(0);
    });

    it("follows relationships in both directions", () => {
      // From Child, should find Parent (Child extends Parent)
      const relatedFromChild = getSymbolRelationships(db, childId, snapshotId, 1);
      
      expect(relatedFromChild.some(r => r.symbolName === "Parent")).toBe(true);
    });

    it("assigns correct distance values", () => {
      const related = getSymbolRelationships(db, parentId, snapshotId, 2);
      
      related.forEach(symbol => {
        expect(symbol.distance).toBeGreaterThan(0);
        expect(symbol.distance).toBeLessThanOrEqual(2);
      });
    });
  });

  describe("getSymbolDocumentation", () => {
    let symbolId: number;

    beforeEach(() => {
      symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });
    });

    it("returns documentation entries", () => {
      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "A calculator class",
        start_line: 3,
      });

      const docs = getSymbolDocumentation(db, symbolId);
      
      expect(docs).toHaveLength(1);
      expect(docs[0].docType).toBe("javadoc");
      expect(docs[0].content).toBe("A calculator class");
      expect(docs[0].startLine).toBe(3);
    });

    it("returns multiple documentation entries", () => {
      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "Class documentation",
        start_line: 3,
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "inline",
        content: "Inline comment",
        start_line: 10,
      });

      const docs = getSymbolDocumentation(db, symbolId);
      
      expect(docs).toHaveLength(2);
    });

    it("orders documentation by start line", () => {
      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "inline",
        content: "Second comment",
        start_line: 20,
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "First comment",
        start_line: 5,
      });

      const docs = getSymbolDocumentation(db, symbolId);
      
      expect(docs[0].startLine).toBe(5);
      expect(docs[1].startLine).toBe(20);
    });

    it("returns empty array for symbol with no documentation", () => {
      const docs = getSymbolDocumentation(db, symbolId);
      
      expect(docs).toHaveLength(0);
    });
  });

  describe("getSymbolSource", () => {
    let tempDir: string;
    let testFile: string;
    let symbolId: number;
    let docId: number;

    beforeEach(async () => {
      // Create temporary test file
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bender-test-"));
      testFile = path.join(tempDir, "Test.java");
      
      const content = `package com.example;

/**
 * Test class
 */
public class Test {
    private int value;
    
    public Test() {
        this.value = 0;
    }
    
    public int getValue() {
        return value;
    }
}`;
      
      await fs.writeFile(testFile, content, "utf-8");

      docId = insertDocument(db, snapshotId, {
        path: testFile,
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Test",
        symbol_name: "Test",
        kind: "class",
        signature: "class Test",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 6,
        start_col: 0,
        end_line: 6,
        end_col: 11,
      });
    });

    afterEach(async () => {
      // Clean up temp files
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it("returns source code with context", async () => {
      const source = await getSymbolSource(db, symbolId, snapshotId, 2);
      
      expect(source).not.toBeNull();
      expect(source?.filePath).toBe(testFile);
      expect(source?.sourceCode).toContain("public class Test");
    });

    it("includes context lines before definition", async () => {
      const source = await getSymbolSource(db, symbolId, snapshotId, 3);
      
      expect(source).not.toBeNull();
      expect(source?.sourceCode).toContain("Test class");
      expect(source?.sourceCode).toContain("/**");
    });

    it("includes context lines after definition", async () => {
      const source = await getSymbolSource(db, symbolId, snapshotId, 3);
      
      expect(source).not.toBeNull();
      expect(source?.sourceCode).toContain("private int value");
    });

    it("respects file boundaries for context", async () => {
      // Symbol at the very top of file
      const methodId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Test.getValue",
        symbol_name: "getValue",
        kind: "method",
        signature: "int getValue()",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: methodId,
        document_id: docId,
        role: "definition",
        start_line: 1,
        start_col: 0,
        end_line: 1,
        end_col: 7,
      });

      const source = await getSymbolSource(db, methodId, snapshotId, 10);
      
      expect(source).not.toBeNull();
      expect(source?.startLine).toBe(1); // Can't go before line 1
    });

    it("returns null for non-existent symbol", async () => {
      const source = await getSymbolSource(db, 99999, snapshotId, 3);
      
      expect(source).toBeNull();
    });

    it("returns null for non-existent file", async () => {
      const fakeDocId = insertDocument(db, snapshotId, {
        path: "/non/existent/file.java",
        language: "java",
        content_hash: "hash",
        indexed_at: new Date().toISOString(),
      });

      const fakeSymbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.fake.Fake",
        symbol_name: "Fake",
        kind: "class",
        signature: "class Fake",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: fakeSymbolId,
        document_id: fakeDocId,
        role: "definition",
        start_line: 1,
        start_col: 0,
        end_line: 1,
        end_col: 4,
      });

      const source = await getSymbolSource(db, fakeSymbolId, snapshotId, 3);
      
      expect(source).toBeNull();
    });

    it("handles different context line counts", async () => {
      const source0 = await getSymbolSource(db, symbolId, snapshotId, 0);
      const source5 = await getSymbolSource(db, symbolId, snapshotId, 5);
      
      expect(source0).not.toBeNull();
      expect(source5).not.toBeNull();
      expect(source5!.sourceCode.length).toBeGreaterThan(source0!.sourceCode.length);
    });
  });

  describe("snapshot handling", () => {
    it("uses latest snapshot when not specified", () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Test",
        symbol_name: "Test",
        kind: "class",
        signature: "class Test",
      });

      const results = findSymbolsByPattern(db, "Test");
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(symbolId);
    });

    it("can query specific snapshot", () => {
      // Create first snapshot symbols
      const symbol1 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.OldClass",
        symbol_name: "OldClass",
        kind: "class",
        signature: "class OldClass",
      });

      // Create new snapshot
      const snapshot2 = createSnapshot(db, "snapshot-2");
      const symbol2 = insertSymbol(db, snapshot2.id, {
        qualified_name: "com.example.NewClass",
        symbol_name: "NewClass",
        kind: "class",
        signature: "class NewClass",
      });

      // Query first snapshot
      const results1 = findSymbolsByPattern(db, ".*Class", { snapshotId });
      expect(results1).toHaveLength(1);
      expect(results1[0].symbolName).toBe("OldClass");

      // Query second snapshot
      const results2 = findSymbolsByPattern(db, ".*Class", { snapshotId: snapshot2.id });
      expect(results2).toHaveLength(1);
      expect(results2[0].symbolName).toBe("NewClass");
    });
  });
});
