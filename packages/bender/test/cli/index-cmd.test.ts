/**
 * Tests for index command handler
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleIndexCommand } from "../../src/cli/index-cmd";
import fs from "node:fs/promises";
import path from "node:path";
import { Database } from "bun:sqlite";
import { cleanupDatabase } from "../test-utils";

describe("index-cmd", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create temporary directory in test/tmp
    tempDir = path.join(__dirname, "..", "tmp", `index-cmd-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    dbPath = path.join(tempDir, "test.db");
  });

  afterEach(async () => {
    // Clean up database files and temp directory
    cleanupDatabase(dbPath);
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should throw error if source directory does not exist", async () => {
    const nonExistentDir = path.join(tempDir, "non-existent");
    
    await expect(
      handleIndexCommand(nonExistentDir, dbPath, {})
    ).rejects.toThrow("Source directory does not exist");
  });

  it("should throw error if source path is not a directory", async () => {
    const filePath = path.join(tempDir, "not-a-dir.txt");
    await fs.writeFile(filePath, "content");

    await expect(
      handleIndexCommand(filePath, dbPath, {})
    ).rejects.toThrow("Source path is not a directory");
  });

  it("should throw error if database path is not writable", async () => {
    const fixturesDir = path.join(process.cwd(), "test", "fixtures", "sample-java");
    const nonWritableDir = "/root/non-writable-dir";
    const nonWritableDb = path.join(nonWritableDir, "test.db");

    await expect(
      handleIndexCommand(fixturesDir, nonWritableDb, {})
    ).rejects.toThrow("Database path is not writable");
  });

  it("should successfully index a directory", async () => {
    const fixturesDir = path.join(process.cwd(), "test", "fixtures", "sample-java");

    await handleIndexCommand(fixturesDir, dbPath, {
      name: "test-snapshot",
      description: "Test description",
      verbose: false,
    });

    // Verify database was created
    const stats = await fs.stat(dbPath);
    expect(stats.isFile()).toBe(true);

    // Verify snapshot was created
    const db = new Database(dbPath);
    const snapshot = db.prepare("SELECT * FROM snapshots WHERE name = ?").get("test-snapshot");
    expect(snapshot).not.toBeNull();
    db.close();
  });

  it("should use custom snapshot name", async () => {
    const fixturesDir = path.join(process.cwd(), "test", "fixtures", "sample-java");

    await handleIndexCommand(fixturesDir, dbPath, {
      name: "custom-name",
      verbose: false,
    });

    const db = new Database(dbPath);
    const snapshot = db.prepare("SELECT * FROM snapshots WHERE name = ?").get("custom-name");
    expect(snapshot).not.toBeNull();
    db.close();
  });

  it("should replace existing snapshot when replace flag is set", async () => {
    const fixturesDir = path.join(process.cwd(), "test", "fixtures", "sample-java");

    // First index
    await handleIndexCommand(fixturesDir, dbPath, {
      name: "test-snapshot",
      verbose: false,
    });

    // Get first snapshot ID
    let db = new Database(dbPath);
    const firstSnapshot = db.prepare("SELECT id FROM snapshots WHERE name = ?").get("test-snapshot") as { id: number };
    const firstId = firstSnapshot.id;
    db.close();

    // Second index with replace
    await handleIndexCommand(fixturesDir, dbPath, {
      name: "test-snapshot",
      replace: true,
      verbose: false,
    });

    // Get second snapshot ID
    db = new Database(dbPath);
    const secondSnapshot = db.prepare("SELECT id FROM snapshots WHERE name = ?").get("test-snapshot") as { id: number };
    const secondId = secondSnapshot.id;
    db.close();

    // IDs should be different (old one deleted, new one created)
    expect(secondId).not.toBe(firstId);
  });

  it("should index files and find symbols", async () => {
    const fixturesDir = path.join(process.cwd(), "test", "fixtures", "sample-java");

    await handleIndexCommand(fixturesDir, dbPath, {
      name: "test-snapshot",
      verbose: false,
    });

    const db = new Database(dbPath);
    
    // Check that symbols were indexed
    const symbols = db.prepare("SELECT COUNT(*) as count FROM symbols").get() as { count: number };
    expect(symbols.count).toBeGreaterThan(0);
    
    // Check that documents were indexed
    const documents = db.prepare("SELECT COUNT(*) as count FROM documents").get() as { count: number };
    expect(documents.count).toBeGreaterThan(0);
    
    db.close();
  });
});
