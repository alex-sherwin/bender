/**
 * Tests for query command handler
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { handleQueryCommand } from "../../src/cli/query-cmd";
import { handleIndexCommand } from "../../src/cli/index-cmd";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("query-cmd", () => {
  let tempDir: string;
  let dbPath: string;
  let fixturesDir: string;

  beforeEach(async () => {
    // Create temporary directory for test databases
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "bender-test-"));
    dbPath = path.join(tempDir, "test.db");
    fixturesDir = path.join(process.cwd(), "test", "fixtures", "sample-java");

    // Index the fixtures directory first
    await handleIndexCommand(fixturesDir, dbPath, {
      name: "test-snapshot",
      verbose: false,
    });
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("should throw error if database does not exist", async () => {
    const nonExistentDb = path.join(tempDir, "non-existent.db");

    await expect(
      handleQueryCommand(".*", nonExistentDb, {})
    ).rejects.toThrow("Database file does not exist");
  });

  it("should throw error for invalid regex pattern", async () => {
    await expect(
      handleQueryCommand("[invalid(", dbPath, {})
    ).rejects.toThrow("Invalid regular expression pattern");
  });

  it("should throw error if --sources flag used without --source-dir", async () => {
    await expect(
      handleQueryCommand("Simple.*", dbPath, { sources: true })
    ).rejects.toThrow("--source-dir is required when --sources flag is used");
  });

  it("should throw error if source-dir does not exist when sources requested", async () => {
    const nonExistentDir = path.join(tempDir, "non-existent");

    await expect(
      handleQueryCommand("Simple.*", dbPath, { sources: true, sourceDir: nonExistentDir })
    ).rejects.toThrow("Source directory does not exist");
  });

  it("should throw error if source-dir is not a directory", async () => {
    const filePath = path.join(tempDir, "not-a-dir.txt");
    await fs.writeFile(filePath, "content");

    await expect(
      handleQueryCommand("Simple.*", dbPath, { sources: true, sourceDir: filePath })
    ).rejects.toThrow("Source directory path is not a directory");
  });

  it("should throw error if snapshot not found", async () => {
    await expect(
      handleQueryCommand("Simple.*", dbPath, { snapshot: "non-existent-snapshot" })
    ).rejects.toThrow("Snapshot not found");
  });

  it("should throw error for invalid format", async () => {
    await expect(
      handleQueryCommand("Simple.*", dbPath, { format: "xml" as "yaml" })
    ).rejects.toThrow("Invalid format");
  });

  it("should find symbols by pattern", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand("Simple.*", dbPath, { format: "json" });

      // Verify output was generated
      expect(logs.length).toBeGreaterThan(0);
      
      // Parse the JSON output
      const output = JSON.parse(logs[0]);
      expect(output.symbols).toBeDefined();
      expect(output.totalMatches).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });

  it("should handle no results gracefully", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand("NonExistentSymbol.*", dbPath, {});

      // Should output "No symbols found"
      expect(logs[0]).toBe("No symbols found");
    } finally {
      console.log = originalLog;
    }
  });

  it("should filter by symbol type", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand(".*", dbPath, { type: "class", format: "json" });

      // Parse the JSON output
      const output = JSON.parse(logs[0]);
      
      // All returned symbols should be classes
      for (const symbol of output.symbols) {
        expect(symbol.kind).toBe("class");
      }
    } finally {
      console.log = originalLog;
    }
  });

  it("should output in YAML format by default", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand("Simple.*", dbPath, {});

      // YAML output should contain symbols: and totalMatches:
      expect(logs[0]).toContain("symbols:");
      expect(logs[0]).toContain("totalMatches:");
    } finally {
      console.log = originalLog;
    }
  });

  it("should output in JSON format when specified", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand("Simple.*", dbPath, { format: "json" });

      // Should be valid JSON
      expect(() => JSON.parse(logs[0])).not.toThrow();
    } finally {
      console.log = originalLog;
    }
  });

  it("should include relationships when radius specified", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand(".*", dbPath, { radius: 2, format: "json" });

      // Parse the JSON output
      const output = JSON.parse(logs[0]);
      
      // Symbols should have relationships field
      if (output.symbols.length > 0) {
        // At least some symbols should have relationships
        expect(output.symbols.some((s: { relationships?: unknown[] }) => s.relationships !== undefined)).toBe(true);
      }
    } finally {
      console.log = originalLog;
    }
  });

  it("should use specified snapshot", async () => {
    // Mock console.log to capture output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await handleQueryCommand("Simple.*", dbPath, { 
        snapshot: "test-snapshot",
        format: "json"
      });

      // Should successfully query the specified snapshot
      const output = JSON.parse(logs[0]);
      expect(output.symbols).toBeDefined();
    } finally {
      console.log = originalLog;
    }
  });
});
