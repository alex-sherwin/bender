/**
 * Tests for database writer functions
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "../src/db/schema";
import { createSnapshot } from "../src/db/snapshots";
import {
  insertDocument,
  insertDocuments,
  insertSymbol,
  insertSymbols,
  insertOccurrence,
  insertOccurrences,
  insertRelationship,
  insertRelationships,
  insertDocumentation,
  insertDocumentations,
} from "../src/db/writer";
import type { DocumentRow, SymbolRow, OccurrenceRow, RelationshipRow, DocumentationRow } from "../src/db/types";

describe("Database Writer", () => {
  let db: Database;
  let snapshotId: number;

  beforeEach(() => {
    db = initializeDatabase(":memory:");
    const snapshot = createSnapshot(db, "test-snapshot");
    snapshotId = snapshot.id;
  });

  afterEach(() => {
    db.close();
  });

  describe("insertDocument", () => {
    it("inserts a document and returns id", () => {
      const docId = insertDocument(db, snapshotId, {
        path: "src/Main.java",
        language: "java",
        content_hash: "abc123",
        indexed_at: new Date().toISOString(),
      });

      expect(docId).toBeGreaterThan(0);

      const doc = db.prepare("SELECT * FROM documents WHERE id = ?").get(docId) as DocumentRow;
      expect(doc.path).toBe("src/Main.java");
      expect(doc.language).toBe("java");
      expect(doc.content_hash).toBe("abc123");
    });
  });

  describe("insertDocuments", () => {
    it("inserts multiple documents in transaction", () => {
      const docs = [
        { path: "src/A.java", language: "java", content_hash: "hash1", indexed_at: new Date().toISOString() },
        { path: "src/B.java", language: "java", content_hash: "hash2", indexed_at: new Date().toISOString() },
        { path: "src/C.java", language: "java", content_hash: "hash3", indexed_at: new Date().toISOString() },
      ];

      const ids = insertDocuments(db, snapshotId, docs);

      expect(ids).toHaveLength(3);
      expect(ids.every(id => id > 0)).toBe(true);

      const count = db.prepare("SELECT COUNT(*) as count FROM documents").get() as { count: number };
      expect(count.count).toBe(3);
    });
  });

  describe("insertSymbol", () => {
    it("inserts a symbol without parent", () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main",
        symbol_name: "Main",
        kind: "class",
        signature: "class Main",
      });

      expect(symbolId).toBeGreaterThan(0);

      const symbol = db.prepare("SELECT * FROM symbols WHERE id = ?").get(symbolId) as SymbolRow;
      expect(symbol.qualified_name).toBe("com.example.Main");
      expect(symbol.symbol_name).toBe("Main");
      expect(symbol.kind).toBe("class");
      expect(symbol.parent_symbol_id ?? undefined).toBeUndefined();
    });

    it("inserts a symbol with parent", () => {
      const parentId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main",
        symbol_name: "Main",
        kind: "class",
        signature: "class Main",
      });

      const childId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main.doSomething",
        symbol_name: "doSomething",
        kind: "method",
        signature: "void doSomething()",
        parent_symbol_id: parentId,
      });

      const child = db.prepare("SELECT * FROM symbols WHERE id = ?").get(childId) as SymbolRow;
      expect(child.parent_symbol_id).toBe(parentId);
    });
  });

  describe("insertSymbols", () => {
    it("inserts multiple symbols in transaction", () => {
      const symbols = [
        { qualified_name: "com.example.A", symbol_name: "A", kind: "class" as const, signature: "class A" },
        { qualified_name: "com.example.B", symbol_name: "B", kind: "class" as const, signature: "class B" },
        { qualified_name: "com.example.C", symbol_name: "C", kind: "class" as const, signature: "class C" },
      ];

      const ids = insertSymbols(db, snapshotId, symbols);

      expect(ids).toHaveLength(3);
      expect(ids.every(id => id > 0)).toBe(true);

      const count = db.prepare("SELECT COUNT(*) as count FROM symbols").get() as { count: number };
      expect(count.count).toBe(3);
    });
  });

  describe("insertOccurrence", () => {
    it("inserts an occurrence", () => {
      const docId = insertDocument(db, snapshotId, {
        path: "src/Main.java",
        language: "java",
        content_hash: "hash",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main",
        symbol_name: "Main",
        kind: "class",
        signature: "class Main",
      });

      insertOccurrence(db, snapshotId, {
        symbol_id: symbolId,
        document_id: docId,
        role: "definition",
        start_line: 5,
        start_col: 0,
        end_line: 5,
        end_col: 10,
      });

      const occurrences = db.prepare("SELECT * FROM occurrences").all() as OccurrenceRow[];
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0].symbol_id).toBe(symbolId);
      expect(occurrences[0].document_id).toBe(docId);
      expect(occurrences[0].role).toBe("definition");
      expect(occurrences[0].start_line).toBe(5);
    });
  });

  describe("insertOccurrences", () => {
    it("inserts multiple occurrences in transaction", () => {
      const docId = insertDocument(db, snapshotId, {
        path: "src/Main.java",
        language: "java",
        content_hash: "hash",
        indexed_at: new Date().toISOString(),
      });

      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main",
        symbol_name: "Main",
        kind: "class",
        signature: "class Main",
      });

      const occurrences = [
        { symbol_id: symbolId, document_id: docId, role: "definition" as const, start_line: 1, start_col: 0, end_line: 1, end_col: 10 },
        { symbol_id: symbolId, document_id: docId, role: "reference" as const, start_line: 5, start_col: 0, end_line: 5, end_col: 10 },
        { symbol_id: symbolId, document_id: docId, role: "reference" as const, start_line: 8, start_col: 0, end_line: 8, end_col: 10 },
      ];

      insertOccurrences(db, snapshotId, occurrences);

      const count = db.prepare("SELECT COUNT(*) as count FROM occurrences").get() as { count: number };
      expect(count.count).toBe(3);
    });
  });

  describe("insertRelationship", () => {
    it("inserts a relationship between symbols", () => {
      const symbol1 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Child",
        symbol_name: "Child",
        kind: "class",
        signature: "class Child",
      });

      const symbol2 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Parent",
        symbol_name: "Parent",
        kind: "class",
        signature: "class Parent",
      });

      insertRelationship(db, snapshotId, {
        from_symbol_id: symbol1,
        to_symbol_id: symbol2,
        kind: "extends",
      });

      const relationships = db.prepare("SELECT * FROM relationships").all() as RelationshipRow[];
      expect(relationships).toHaveLength(1);
      expect(relationships[0].from_symbol_id).toBe(symbol1);
      expect(relationships[0].to_symbol_id).toBe(symbol2);
      expect(relationships[0].kind).toBe("extends");
    });
  });

  describe("insertRelationships", () => {
    it("inserts multiple relationships in transaction", () => {
      const class1 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.A",
        symbol_name: "A",
        kind: "class",
        signature: "class A",
      });

      const class2 = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.B",
        symbol_name: "B",
        kind: "class",
        signature: "class B",
      });

      const method = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.A.method",
        symbol_name: "method",
        kind: "method",
        signature: "void method()",
      });

      const relationships = [
        { from_symbol_id: class1, to_symbol_id: class2, kind: "extends" as const },
        { from_symbol_id: method, to_symbol_id: class2, kind: "references" as const },
      ];

      insertRelationships(db, snapshotId, relationships);

      const count = db.prepare("SELECT COUNT(*) as count FROM relationships").get() as { count: number };
      expect(count.count).toBe(2);
    });
  });

  describe("insertDocumentation", () => {
    it("inserts documentation for a symbol", () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main",
        symbol_name: "Main",
        kind: "class",
        signature: "class Main",
      });

      insertDocumentation(db, {
        symbol_id: symbolId,
        doc_type: "javadoc",
        content: "Main class documentation",
        start_line: 3,
      });

      const docs = db.prepare("SELECT * FROM documentation").all() as DocumentationRow[];
      expect(docs).toHaveLength(1);
      expect(docs[0].symbol_id).toBe(symbolId);
      expect(docs[0].doc_type).toBe("javadoc");
      expect(docs[0].content).toBe("Main class documentation");
      expect(docs[0].start_line).toBe(3);
    });
  });

  describe("insertDocumentations", () => {
    it("inserts multiple documentation entries in transaction", () => {
      const symbolId = insertSymbol(db, snapshotId, {
        qualified_name: "com.example.Main",
        symbol_name: "Main",
        kind: "class",
        signature: "class Main",
      });

      const docs = [
        { symbol_id: symbolId, doc_type: "javadoc" as const, content: "Class doc", start_line: 1 },
        { symbol_id: symbolId, doc_type: "inline" as const, content: "Method doc", start_line: 5 },
      ];

      insertDocumentations(db, docs);

      const count = db.prepare("SELECT COUNT(*) as count FROM documentation").get() as { count: number };
      expect(count.count).toBe(2);
    });
  });

  describe("transactions and rollback", () => {
    it("rolls back on error within transaction", () => {
      const docsBefore = db.prepare("SELECT COUNT(*) as count FROM documents").get() as { count: number };
      expect(docsBefore.count).toBe(0);

      try {
        const tx = db.transaction(() => {
          insertDocument(db, snapshotId, {
            path: "src/A.java",
            language: "java",
            content_hash: "hash1",
            indexed_at: new Date().toISOString(),
          });

          // This should fail due to duplicate path
          insertDocument(db, snapshotId, {
            path: "src/A.java",
            language: "java",
            content_hash: "hash2",
            indexed_at: new Date().toISOString(),
          });
        });

        tx();
      } catch (error) {
        // Expected to throw
      }

      // Verify no documents were inserted due to rollback
      const docsAfter = db.prepare("SELECT COUNT(*) as count FROM documents").get() as { count: number };
      expect(docsAfter.count).toBe(0);
    });
  });
});
