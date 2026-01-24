/**
 * Tests for output formatter and enrichment functions
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
import type { QuerySymbol } from "../src/db/queries";
import {
  formatOutput,
  enrichWithOccurrences,
  enrichWithRelationships,
  enrichWithDocumentation,
  enrichWithSource,
  buildQueryOutput,
} from "../src/output/formatter";
import type { OutputSymbol, OutputOptions } from "../src/output/types";
import yaml from "js-yaml";
import fs from "node:fs/promises";
import path from "node:path";

describe("Output Formatter", () => {
  let db: Database;
  let snapshotId: number;
  let tempDir: string;
  let testFilePath: string;

  beforeEach(async () => {
    db = initializeDatabase(":memory:");
    const snapshot = createSnapshot(db, "test-snapshot");
    snapshotId = snapshot.id;

    // Create a temporary directory in test/tmp with test source file
    tempDir = path.join(__dirname, "tmp", `formatter-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    testFilePath = path.join(tempDir, "Calculator.java");
    await fs.writeFile(
      testFilePath,
      `package com.example;

/**
 * A simple calculator class
 */
public class Calculator {
  private int value;

  public int add(int a, int b) {
    return a + b;
  }
}
`
    );
  });

  afterEach(async () => {
    db.close();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("formatOutput", () => {
    it("formats output as YAML", () => {
      const symbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          line: 5,
          file: "src/Calculator.java",
        },
      ];

      const output = formatOutput(symbols, "yaml");
      
      // Verify it's valid YAML
      const parsed = yaml.load(output) as any;
      expect(parsed).toHaveProperty("symbols");
      expect(parsed).toHaveProperty("totalMatches");
      expect(parsed.totalMatches).toBe(1);
      expect(parsed.symbols).toHaveLength(1);
      expect(parsed.symbols[0].qualifiedName).toBe("com.example.Calculator");
    });

    it("formats output as JSON", () => {
      const symbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          line: 5,
          file: "src/Calculator.java",
        },
      ];

      const output = formatOutput(symbols, "json");
      
      // Verify it's valid JSON
      const parsed = JSON.parse(output);
      expect(parsed).toHaveProperty("symbols");
      expect(parsed).toHaveProperty("totalMatches");
      expect(parsed.totalMatches).toBe(1);
      expect(parsed.symbols).toHaveLength(1);
      expect(parsed.symbols[0].qualifiedName).toBe("com.example.Calculator");
    });

    it("formats empty results", () => {
      const symbols: OutputSymbol[] = [];

      const yamlOutput = formatOutput(symbols, "yaml");
      const yamlParsed = yaml.load(yamlOutput) as any;
      expect(yamlParsed.totalMatches).toBe(0);
      expect(yamlParsed.symbols).toHaveLength(0);

      const jsonOutput = formatOutput(symbols, "json");
      const jsonParsed = JSON.parse(jsonOutput);
      expect(jsonParsed.totalMatches).toBe(0);
      expect(jsonParsed.symbols).toHaveLength(0);
    });

    it("JSON output is pretty printed", () => {
      const symbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
        },
      ];

      const output = formatOutput(symbols, "json");
      
      // Check for indentation (pretty printed)
      expect(output).toContain("\n  ");
      expect(output).toMatch(/\{\s+"/);
    });

    it("YAML output is properly formatted", () => {
      const symbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
        },
      ];

      const output = formatOutput(symbols, "yaml");
      
      // Check YAML structure
      expect(output).toContain("symbols:");
      expect(output).toContain("totalMatches:");
      expect(output).toContain("qualifiedName:");
      expect(output).toContain("symbolName:");
    });
  });

  describe("enrichWithOccurrences", () => {
    it("enriches symbols with occurrences", () => {
      const docId = insertDocument(db, snapshotId, {
        path: testFilePath,
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 14,
        end_line: 5,
        end_col: 24,
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "reference",
        start_line: 10,
        start_col: 5,
        end_line: 10,
        end_col: 15,
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const enriched = enrichWithOccurrences(db, tempDir, querySymbols, snapshotId);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].occurrences).toBeDefined();
      expect(enriched[0].occurrences).toHaveLength(2);
      
      const defOcc = enriched[0].occurrences!.find(o => o.role === "definition");
      expect(defOcc).toBeDefined();
      expect(defOcc!.line).toBe(5);
      expect(defOcc!.column).toBe(14);
      expect(defOcc!.file).toBe(testFilePath);

      const refOcc = enriched[0].occurrences!.find(o => o.role === "reference");
      expect(refOcc).toBeDefined();
      expect(refOcc!.line).toBe(10);
      expect(refOcc!.column).toBe(5);
    });

    it("handles symbols with no occurrences", () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: null,
          definitionFile: null,
        },
      ];

      const enriched = enrichWithOccurrences(db, tempDir, querySymbols, snapshotId);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].occurrences).toBeDefined();
      expect(enriched[0].occurrences).toHaveLength(0);
    });
  });

  describe("enrichWithRelationships", () => {
    it("enriches symbols with relationships", () => {
      const symbolId1 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      const symbolId2 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.add",
        symbol_name: "add",
        kind: "method",
        signature: "int add(int, int)",
        parent_symbol_id: symbolId1,
      });

      const symbolId3 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.subtract",
        symbol_name: "subtract",
        kind: "method",
        signature: "int subtract(int, int)",
        parent_symbol_id: symbolId1,
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: symbolId1,
        to_symbol_id: symbolId2,
        kind: "contains",
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: symbolId1,
        to_symbol_id: symbolId3,
        kind: "contains",
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
        },
      ];

      const enriched = enrichWithRelationships(db, outputSymbols, 2, snapshotId);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].relationships).toBeDefined();
      expect(enriched[0].relationships!.length).toBeGreaterThan(0);
      
      const containsRels = enriched[0].relationships!.filter(r => r.kind === "contains");
      expect(containsRels.length).toBeGreaterThan(0);
      expect(containsRels.some(r => r.symbol === "com.example.Calculator.add")).toBe(true);
    });

    it("handles symbols with no relationships", () => {
      insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Isolated",
        symbol_name: "Isolated",
        kind: "class",
        signature: "class Isolated",
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Isolated",
          symbolName: "Isolated",
          kind: "class",
        },
      ];

      const enriched = enrichWithRelationships(db, outputSymbols, 2, snapshotId);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].relationships).toBeDefined();
      expect(enriched[0].relationships).toHaveLength(0);
    });

    it("respects radius parameter", () => {
      const symbolId1 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.A",
        symbol_name: "A",
        kind: "class",
        signature: "class A",
      });

      const symbolId2 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.B",
        symbol_name: "B",
        kind: "class",
        signature: "class B",
      });

      const symbolId3 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.C",
        symbol_name: "C",
        kind: "class",
        signature: "class C",
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: symbolId1,
        to_symbol_id: symbolId2,
        kind: "calls",
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: symbolId2,
        to_symbol_id: symbolId3,
        kind: "calls",
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.A",
          symbolName: "A",
          kind: "class",
        },
      ];

      // Radius 1 should find B
      const enriched1 = enrichWithRelationships(db, outputSymbols, 1, snapshotId);
      expect(enriched1[0].relationships).toBeDefined();
      const rels1 = enriched1[0].relationships!;
      expect(rels1.some(r => r.symbol === "com.example.B")).toBe(true);

      // Radius 2 should find both B and C
      const enriched2 = enrichWithRelationships(db, outputSymbols, 2, snapshotId);
      expect(enriched2[0].relationships).toBeDefined();
      const rels2 = enriched2[0].relationships!;
      expect(rels2.some(r => r.symbol === "com.example.B")).toBe(true);
      expect(rels2.some(r => r.symbol === "com.example.C")).toBe(true);
    });
  });

  describe("enrichWithDocumentation", () => {
    it("enriches symbols with documentation", () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "A simple calculator class",
        start_line: 3,
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "inline",
        content: "Main calculator implementation",
        start_line: 5,
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
        },
      ];

      const enriched = enrichWithDocumentation(db, outputSymbols);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].documentation).toBeDefined();
      expect(enriched[0].documentation).toHaveLength(2);
      
      const javadoc = enriched[0].documentation!.find(d => d.type === "javadoc");
      expect(javadoc).toBeDefined();
      expect(javadoc!.content).toBe("A simple calculator class");

      const inline = enriched[0].documentation!.find(d => d.type === "inline");
      expect(inline).toBeDefined();
      expect(inline!.content).toBe("Main calculator implementation");
    });

    it("handles symbols with no documentation", () => {
      insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
        },
      ];

      const enriched = enrichWithDocumentation(db, outputSymbols);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].documentation).toBeUndefined();
    });
  });

  describe("enrichWithSource", () => {
    it("enriches symbols with source code", async () => {
      const docId = insertDocument(db, snapshotId, {
        path: testFilePath,
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 14,
        end_line: 11,
        end_col: 1,
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
        },
      ];

      const enriched = await enrichWithSource(db, tempDir, outputSymbols, snapshotId, 2);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].source).toBeDefined();
      expect(enriched[0].source!.file).toBe(testFilePath);
      expect(enriched[0].source!.code).toBeDefined();
      expect(enriched[0].source!.code.length).toBeGreaterThan(0);
      // Should include context lines
      expect(enriched[0].source!.code).toContain("public class Calculator");
    });

    it("handles symbols with no source location", async () => {
      insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Missing",
        symbol_name: "Missing",
        kind: "class",
        signature: "class Missing",
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Missing",
          symbolName: "Missing",
          kind: "class",
        },
      ];

      const enriched = await enrichWithSource(db, tempDir, outputSymbols, snapshotId, 3);

      expect(enriched).toHaveLength(1);
      expect(enriched[0].source).toBeUndefined();
    });

    it("respects contextLines parameter", async () => {
      const docId = insertDocument(db, snapshotId, {
        path: testFilePath,
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.add",
        symbol_name: "add",
        kind: "method",
        signature: "int add(int, int)",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 8,
        start_col: 14,
        end_line: 10,
        end_col: 3,
      });

      const outputSymbols: OutputSymbol[] = [
        {
          qualifiedName: "com.example.Calculator.add",
          symbolName: "add",
          kind: "method",
        },
      ];

      // With 1 context line
      const enriched1 = await enrichWithSource(db, tempDir, outputSymbols, snapshotId, 1);
      expect(enriched1[0].source).toBeDefined();
      const lines1 = enriched1[0].source!.code.split("\n").length;

      // With 3 context lines
      const enriched3 = await enrichWithSource(db, tempDir, outputSymbols, snapshotId, 3);
      expect(enriched3[0].source).toBeDefined();
      const lines3 = enriched3[0].source!.code.split("\n").length;

      // More context lines should result in more lines of code
      expect(lines3).toBeGreaterThan(lines1);
    });
  });

  describe("buildQueryOutput", () => {
    it("builds output with no enrichments", async () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const output = await buildQueryOutput(db, tempDir, querySymbols, {});

      expect(output.totalMatches).toBe(1);
      expect(output.symbols).toHaveLength(1);
      expect(output.symbols[0].qualifiedName).toBe("com.example.Calculator");
      expect(output.symbols[0].occurrences).toBeUndefined();
      expect(output.symbols[0].relationships).toBeUndefined();
      expect(output.symbols[0].documentation).toBeUndefined();
      expect(output.symbols[0].source).toBeUndefined();
    });

    it("builds output with all enrichments", async () => {
      const docId = insertDocument(db, snapshotId, {
        path: testFilePath,
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 14,
        end_line: 11,
        end_col: 1,
      });

      const methodId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator.add",
        symbol_name: "add",
        kind: "method",
        signature: "int add(int, int)",
        parent_symbol_id: symbolId,
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: symbolId,
        to_symbol_id: methodId,
        kind: "contains",
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "A simple calculator class",
        start_line: 3,
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const options: OutputOptions = {
        includeOccurrences: true,
        includeRelationships: true,
        radius: 2,
        includeDocumentation: true,
        includeSources: true,
        contextLines: 3,
      };

      const output = await buildQueryOutput(db, tempDir, querySymbols, options);

      expect(output.totalMatches).toBe(1);
      expect(output.symbols).toHaveLength(1);
      
      const symbol = output.symbols[0];
      expect(symbol.occurrences).toBeDefined();
      expect(symbol.occurrences!.length).toBeGreaterThan(0);
      expect(symbol.relationships).toBeDefined();
      expect(symbol.relationships!.length).toBeGreaterThan(0);
      expect(symbol.documentation).toBeDefined();
      expect(symbol.documentation!.length).toBeGreaterThan(0);
      expect(symbol.source).toBeDefined();
      expect(symbol.source!.code).toBeDefined();
    });

    it("builds output with selective enrichments", async () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "A simple calculator class",
        start_line: 3,
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const options: OutputOptions = {
        includeDocumentation: true,
        // No occurrences, relationships, or source
      };

      const output = await buildQueryOutput(db, tempDir, querySymbols, options);

      expect(output.symbols[0].documentation).toBeDefined();
      expect(output.symbols[0].occurrences).toBeUndefined();
      expect(output.symbols[0].relationships).toBeUndefined();
      expect(output.symbols[0].source).toBeUndefined();
    });

    it("handles empty query results", async () => {
      const querySymbols: QuerySymbol[] = [];
      const output = await buildQueryOutput(db, tempDir, querySymbols, {});

      expect(output.totalMatches).toBe(0);
      expect(output.symbols).toHaveLength(0);
    });

    it("uses default contextLines when not specified", async () => {
      const docId = insertDocument(db, snapshotId, {
        path: testFilePath,
        language: "java",
        content_hash: "hash1",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 14,
        end_line: 11,
        end_col: 1,
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const output = await buildQueryOutput(db, tempDir, querySymbols, {
        includeSources: true,
        // contextLines not specified, should default to 3
      });

      expect(output.symbols[0].source).toBeDefined();
      expect(output.symbols[0].source!.code).toBeDefined();
    });
  });

  describe("Integration Tests", () => {
    it("formats enriched output as YAML", async () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "A simple calculator class",
        start_line: 3,
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const output = await buildQueryOutput(db, tempDir, querySymbols, {
        includeDocumentation: true,
      });

      const formatted = formatOutput(output.symbols, "yaml");
      const parsed = yaml.load(formatted) as any;

      expect(parsed.symbols).toHaveLength(1);
      expect(parsed.symbols[0].documentation).toBeDefined();
      expect(parsed.symbols[0].documentation[0].type).toBe("javadoc");
    });

    it("formats enriched output as JSON", async () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Calculator",
        symbol_name: "Calculator",
        kind: "class",
        signature: "class Calculator",
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "A simple calculator class",
        start_line: 3,
      });

      const querySymbols: QuerySymbol[] = [
        {
          id: symbolId,
          qualifiedName: "com.example.Calculator",
          symbolName: "Calculator",
          kind: "class",
          signature: "class Calculator",
          definitionLine: 5,
          definitionFile: testFilePath,
        },
      ];

      const output = await buildQueryOutput(db, tempDir, querySymbols, {
        includeDocumentation: true,
      });

      const formatted = formatOutput(output.symbols, "json");
      const parsed = JSON.parse(formatted);

      expect(parsed.symbols).toHaveLength(1);
      expect(parsed.symbols[0].documentation).toBeDefined();
      expect(parsed.symbols[0].documentation[0].type).toBe("javadoc");
    });
  });
});
