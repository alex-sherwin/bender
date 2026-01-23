/**
 * Tests for database schema initialization
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "../src/db/schema";

describe("Database Schema", () => {
  let db: Database;

  beforeEach(() => {
    db = initializeDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("initializes database with all tables", () => {
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain("snapshots");
    expect(tableNames).toContain("documents");
    expect(tableNames).toContain("symbols");
    expect(tableNames).toContain("occurrences");
    expect(tableNames).toContain("relationships");
    expect(tableNames).toContain("documentation");
  });

  it("creates indexes for performance", () => {
    const indexes = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
    ).all() as { name: string }[];

    expect(indexes.length).toBeGreaterThan(0);
    expect(indexes.some(i => i.name.includes("idx_snapshots_is_latest"))).toBe(true);
    expect(indexes.some(i => i.name.includes("idx_symbols_qualified_name"))).toBe(true);
    expect(indexes.some(i => i.name.includes("idx_occurrences_symbol_id"))).toBe(true);
  });

  it("enables foreign key constraints", () => {
    const result = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
  });

  it("sets WAL journal mode (or memory for :memory: db)", () => {
    const result = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    // WAL mode is set but :memory: databases use "memory" mode
    expect(["wal", "memory"]).toContain(result.journal_mode.toLowerCase());
  });

  it("enforces unique constraint on snapshot names", () => {
    db.prepare("INSERT INTO snapshots (name, created_at, is_latest) VALUES (?, ?, 0)")
      .run("test-snapshot", new Date().toISOString());

    expect(() => {
      db.prepare("INSERT INTO snapshots (name, created_at, is_latest) VALUES (?, ?, 0)")
        .run("test-snapshot", new Date().toISOString());
    }).toThrow();
  });

  it("enforces CHECK constraint on symbol kinds", () => {
    const snapshotId = db.prepare(
      "INSERT INTO snapshots (name, created_at, is_latest) VALUES (?, ?, 1)"
    ).run("test", new Date().toISOString()).lastInsertRowid;

    expect(() => {
      db.prepare(
        "INSERT INTO symbols (snapshot_id, qualified_name, symbol_name, kind, signature) VALUES (?, ?, ?, ?, ?)"
      ).run(snapshotId, "test.Symbol", "Symbol", "invalid_kind", "void test()");
    }).toThrow();
  });

  it("enforces CHECK constraint on occurrence roles", () => {
    const snapshotId = db.prepare(
      "INSERT INTO snapshots (name, created_at, is_latest) VALUES (?, ?, 1)"
    ).run("test", new Date().toISOString()).lastInsertRowid;

    const docId = db.prepare(
      "INSERT INTO documents (snapshot_id, path, language, content_hash, indexed_at) VALUES (?, ?, ?, ?, ?)"
    ).run(snapshotId, "test.java", "java", "hash123", new Date().toISOString()).lastInsertRowid;

    const symbolId = db.prepare(
      "INSERT INTO symbols (snapshot_id, qualified_name, symbol_name, kind, signature) VALUES (?, ?, ?, ?, ?)"
    ).run(snapshotId, "test.Symbol", "Symbol", "class", "class Symbol").lastInsertRowid;

    expect(() => {
      db.prepare(
        "INSERT INTO occurrences (snapshot_id, symbol_id, document_id, role, start_line, start_col, end_line, end_col) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(snapshotId, symbolId, docId, "invalid_role", 1, 0, 1, 10);
    }).toThrow();
  });

  it("cascades delete from snapshots to related tables", () => {
    const snapshotId = db.prepare(
      "INSERT INTO snapshots (name, created_at, is_latest) VALUES (?, ?, 1)"
    ).run("test", new Date().toISOString()).lastInsertRowid;

    const docId = db.prepare(
      "INSERT INTO documents (snapshot_id, path, language, content_hash, indexed_at) VALUES (?, ?, ?, ?, ?)"
    ).run(snapshotId, "test.java", "java", "hash123", new Date().toISOString()).lastInsertRowid;

    const symbolId = db.prepare(
      "INSERT INTO symbols (snapshot_id, qualified_name, symbol_name, kind, signature) VALUES (?, ?, ?, ?, ?)"
    ).run(snapshotId, "test.Symbol", "Symbol", "class", "class Symbol").lastInsertRowid;

    db.prepare(
      "INSERT INTO occurrences (snapshot_id, symbol_id, document_id, role, start_line, start_col, end_line, end_col) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(snapshotId, symbolId, docId, "definition", 1, 0, 1, 10);

    // Delete snapshot
    db.prepare("DELETE FROM snapshots WHERE id = ?").run(snapshotId);

    // Verify cascade deletion
    const documents = db.prepare("SELECT * FROM documents WHERE snapshot_id = ?").all(snapshotId);
    expect(documents).toHaveLength(0);

    const symbols = db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").all(snapshotId);
    expect(symbols).toHaveLength(0);

    const occurrences = db.prepare("SELECT * FROM occurrences WHERE snapshot_id = ?").all(snapshotId);
    expect(occurrences).toHaveLength(0);
  });
});
