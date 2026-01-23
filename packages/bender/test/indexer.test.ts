/**
 * Tests for indexer orchestration and git integration.
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { Database } from "bun:sqlite";
import { indexDirectory } from "../src/indexer";
import { initializeDatabase } from "../src/db/schema";
import { getSnapshotByName, listSnapshots } from "../src/db/snapshots";

describe("indexer", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary directory for test databases
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bender-test-"));
    dbPath = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should index a directory with multiple Java files", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    const result = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "test-snapshot",
      description: "Test indexing",
      verbose: false,
    });

    expect(result.filesIndexed).toBeGreaterThan(0);
    expect(result.symbolsFound).toBeGreaterThan(0);
    expect(result.snapshotId).toBeGreaterThan(0);

    // Verify data in database
    const db = initializeDatabase(dbPath);

    const snapshot = getSnapshotByName(db, "test-snapshot");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.name).toBe("test-snapshot");
    expect(snapshot?.description).toBe("Test indexing");

    // Check documents were created (should equal files indexed)
    const docStmt = db.prepare("SELECT COUNT(*) as count FROM documents WHERE snapshot_id = ?");
    const docCount = (docStmt.get(result.snapshotId) as { count: number }).count;
    expect(docCount).toBe(result.filesIndexed);

    // Check symbols were created
    const symbolStmt = db.prepare("SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?");
    const symbolCount = (symbolStmt.get(result.snapshotId) as { count: number }).count;
    expect(symbolCount).toBe(result.symbolsFound);

    // Check occurrences were created
    const occStmt = db.prepare("SELECT COUNT(*) as count FROM occurrences WHERE snapshot_id = ?");
    const occCount = (occStmt.get(result.snapshotId) as { count: number }).count;
    expect(occCount).toBeGreaterThan(0);

    db.close();
  });

  it("should create snapshot with default name when no name provided", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    const result = await indexDirectory(fixtureDir, dbPath, {
      verbose: false,
    });

    expect(result.snapshotId).toBeGreaterThan(0);

    const db = initializeDatabase(dbPath);
    const snapshots = listSnapshots(db);
    expect(snapshots.length).toBeGreaterThan(0);

    // Should have a name (either git branch or "default")
    const snapshot = snapshots[0];
    expect(snapshot.name).toBeTruthy();

    db.close();
  });

  it("should replace existing snapshot when replace=true", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    // First index
    const result1 = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "replace-test",
      description: "First version",
      verbose: false,
    });

    expect(result1.filesIndexed).toBeGreaterThan(0);

    // Get initial counts
    const db1 = initializeDatabase(dbPath);
    const snapshot1 = getSnapshotByName(db1, "replace-test");
    expect(snapshot1).not.toBeNull();
    const snapshot1Id = snapshot1!.id;

    const docStmt1 = db1.prepare("SELECT COUNT(*) as count FROM documents WHERE snapshot_id = ?");
    const docCount1 = (docStmt1.get(snapshot1Id) as { count: number }).count;
    db1.close();

    // Second index with replace=true
    const result2 = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "replace-test",
      description: "Second version",
      replace: true,
      verbose: false,
    });

    expect(result2.filesIndexed).toBeGreaterThan(0);

    // Verify replacement
    const db2 = initializeDatabase(dbPath);
    const snapshots = listSnapshots(db2);

    // Should only have one snapshot with this name
    const replaceSnapshots = snapshots.filter((s) => s.name === "replace-test");
    expect(replaceSnapshots.length).toBe(1);

    // Description should be updated
    const snapshot2 = getSnapshotByName(db2, "replace-test");
    expect(snapshot2?.description).toBe("Second version");

    // Old snapshot ID should be gone
    const docStmt2 = db2.prepare("SELECT COUNT(*) as count FROM documents WHERE snapshot_id = ?");
    const oldDocCount = (docStmt2.get(snapshot1Id) as { count: number }).count;
    expect(oldDocCount).toBe(0); // Old documents should be deleted due to CASCADE

    db2.close();
  });

  it("should handle errors gracefully and continue indexing", async () => {
    // Create a temp directory with mixed valid and invalid files
    const testDir = path.join(tempDir, "mixed-files");
    await fs.mkdir(testDir, { recursive: true });

    // Create a valid Java file
    await fs.writeFile(
      path.join(testDir, "Valid.java"),
      `package com.example;
      public class Valid {
        public void method() {}
      }`
    );

    // Create an invalid Java file (syntax error)
    await fs.writeFile(
      path.join(testDir, "Invalid.java"),
      `package com.example;
      public class Invalid {
        this is not valid java syntax
      }`
    );

    // Create an empty file
    await fs.writeFile(path.join(testDir, "Empty.java"), "");

    // Index should complete despite errors
    const result = await indexDirectory(testDir, dbPath, {
      snapshotName: "error-test",
      verbose: false,
    });

    // At least some files should be indexed (the valid one)
    expect(result.snapshotId).toBeGreaterThan(0);

    // The valid file should be indexed
    const db = initializeDatabase(dbPath);
    const docStmt = db.prepare("SELECT COUNT(*) as count FROM documents WHERE snapshot_id = ?");
    const docCount = (docStmt.get(result.snapshotId) as { count: number }).count;
    expect(docCount).toBeGreaterThanOrEqual(1); // At least the valid file

    db.close();
  });

  it("should report accurate statistics", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    const result = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "stats-test",
      verbose: false,
    });

    // Verify statistics match database counts
    const db = initializeDatabase(dbPath);

    const docStmt = db.prepare("SELECT COUNT(*) as count FROM documents WHERE snapshot_id = ?");
    const docCount = (docStmt.get(result.snapshotId) as { count: number }).count;
    expect(docCount).toBe(result.filesIndexed);

    const symbolStmt = db.prepare("SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?");
    const symbolCount = (symbolStmt.get(result.snapshotId) as { count: number }).count;
    expect(symbolCount).toBe(result.symbolsFound);

    db.close();
  });

  it("should store git metadata when available", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    // Index with explicit git metadata retrieval
    const result = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "git-test",
      verbose: false,
    });

    const db = initializeDatabase(dbPath);
    const snapshot = getSnapshotByName(db, "git-test");

    expect(snapshot).not.toBeNull();

    // Git metadata may or may not be present depending on test environment
    // Just verify the fields exist
    expect(snapshot).toHaveProperty("git_branch");
    expect(snapshot).toHaveProperty("git_commit");

    db.close();
  });

  it("should set snapshot as latest", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    const result = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "latest-test",
      verbose: false,
    });

    const db = initializeDatabase(dbPath);
    const snapshot = getSnapshotByName(db, "latest-test");

    expect(snapshot).not.toBeNull();
    expect(snapshot?.is_latest).toBe(1);

    db.close();
  });

  it("should calculate content hash for files", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    const result = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "hash-test",
      verbose: false,
    });

    const db = initializeDatabase(dbPath);

    // Get a document and verify it has a content hash
    const docStmt = db.prepare("SELECT content_hash FROM documents WHERE snapshot_id = ? LIMIT 1");
    const doc = docStmt.get(result.snapshotId) as { content_hash: string } | undefined;

    expect(doc).toBeDefined();
    expect(doc?.content_hash).toBeTruthy();
    expect(doc?.content_hash.length).toBe(64); // SHA256 produces 64 hex characters

    db.close();
  });

  it("should store relative paths for documents", async () => {
    const fixtureDir = path.join(__dirname, "fixtures", "sample-java");

    const result = await indexDirectory(fixtureDir, dbPath, {
      snapshotName: "path-test",
      verbose: false,
    });

    const db = initializeDatabase(dbPath);

    // Get all document paths
    const docStmt = db.prepare("SELECT path FROM documents WHERE snapshot_id = ?");
    const docs = docStmt.all(result.snapshotId) as Array<{ path: string }>;

    expect(docs.length).toBeGreaterThan(0);

    // All paths should be relative (not start with /)
    for (const doc of docs) {
      expect(doc.path).not.toMatch(/^\//);
      expect(doc.path).toMatch(/\.java$/);
    }

    db.close();
  });

  it("should throw error for non-existent directory", async () => {
    const nonExistentDir = path.join(tempDir, "does-not-exist");

    await expect(
      indexDirectory(nonExistentDir, dbPath, {
        snapshotName: "error-test",
      })
    ).rejects.toThrow("Source directory does not exist");
  });

  it("should throw error for non-directory path", async () => {
    // Create a file instead of directory
    const filePath = path.join(tempDir, "not-a-dir.txt");
    await fs.writeFile(filePath, "test");

    await expect(
      indexDirectory(filePath, dbPath, {
        snapshotName: "error-test",
      })
    ).rejects.toThrow("Source path is not a directory");
  });
});
