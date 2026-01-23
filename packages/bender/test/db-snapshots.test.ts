/**
 * Tests for snapshot management functions
 * @author GitHub Copilot
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Database } from "bun:sqlite";
import { initializeDatabase } from "../src/db/schema";
import {
  createSnapshot,
  getLatestSnapshot,
  getSnapshotByName,
  replaceSnapshot,
  listSnapshots,
  setLatestSnapshot,
} from "../src/db/snapshots";

describe("Snapshot Management", () => {
  let db: Database;

  beforeEach(() => {
    db = initializeDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  describe("createSnapshot", () => {
    it("creates a snapshot with minimal fields", () => {
      const snapshot = createSnapshot(db, "v1.0");

      expect(snapshot.id).toBeGreaterThan(0);
      expect(snapshot.name).toBe("v1.0");
      expect(snapshot.is_latest).toBe(1);
      expect(snapshot.created_at).toBeTruthy();
      expect(snapshot.description ?? undefined).toBeUndefined();
      expect(snapshot.git_branch ?? undefined).toBeUndefined();
      expect(snapshot.git_commit ?? undefined).toBeUndefined();
    });

    it("creates a snapshot with all fields", () => {
      const snapshot = createSnapshot(
        db,
        "v2.0",
        "Test release",
        "main",
        "abc123"
      );

      expect(snapshot.name).toBe("v2.0");
      expect(snapshot.description).toBe("Test release");
      expect(snapshot.git_branch).toBe("main");
      expect(snapshot.git_commit).toBe("abc123");
      expect(snapshot.is_latest).toBe(1);
    });

    it("marks new snapshot as latest and unmarks previous", () => {
      const snapshot1 = createSnapshot(db, "v1.0");
      expect(snapshot1.is_latest).toBe(1);

      const snapshot2 = createSnapshot(db, "v2.0");
      expect(snapshot2.is_latest).toBe(1);

      // Verify v1.0 is no longer latest
      const oldSnapshot = getSnapshotByName(db, "v1.0");
      expect(oldSnapshot?.is_latest).toBe(0);
    });

    it("throws error on duplicate name", () => {
      createSnapshot(db, "v1.0");

      expect(() => {
        createSnapshot(db, "v1.0");
      }).toThrow();
    });
  });

  describe("getLatestSnapshot", () => {
    it("returns null when no snapshots exist", () => {
      const snapshot = getLatestSnapshot(db);
      expect(snapshot).toBeNull();
    });

    it("returns the latest snapshot", () => {
      createSnapshot(db, "v1.0");
      createSnapshot(db, "v2.0");
      const latest = getLatestSnapshot(db);

      expect(latest?.name).toBe("v2.0");
      expect(latest?.is_latest).toBe(1);
    });
  });

  describe("getSnapshotByName", () => {
    it("returns null when snapshot not found", () => {
      const snapshot = getSnapshotByName(db, "nonexistent");
      expect(snapshot).toBeNull();
    });

    it("returns snapshot by name", () => {
      createSnapshot(db, "v1.0", "First version");
      const snapshot = getSnapshotByName(db, "v1.0");

      expect(snapshot).not.toBeNull();
      expect(snapshot?.name).toBe("v1.0");
      expect(snapshot?.description).toBe("First version");
    });
  });

  describe("replaceSnapshot", () => {
    it("deletes snapshot and cascades to related data", () => {
      const snapshot = createSnapshot(db, "v1.0");

      // Add related data
      db.prepare(
        "INSERT INTO documents (snapshot_id, path, language, content_hash, indexed_at) VALUES (?, ?, ?, ?, ?)"
      ).run(snapshot.id, "test.java", "java", "hash123", new Date().toISOString());

      db.prepare(
        "INSERT INTO symbols (snapshot_id, qualified_name, symbol_name, kind, signature) VALUES (?, ?, ?, ?, ?)"
      ).run(snapshot.id, "test.Class", "Class", "class", "class Class");

      replaceSnapshot(db, "v1.0");

      // Verify snapshot is deleted
      const deletedSnapshot = getSnapshotByName(db, "v1.0");
      expect(deletedSnapshot).toBeNull();

      // Verify related data is deleted
      const documents = db.prepare("SELECT * FROM documents WHERE snapshot_id = ?").all(snapshot.id);
      expect(documents).toHaveLength(0);

      const symbols = db.prepare("SELECT * FROM symbols WHERE snapshot_id = ?").all(snapshot.id);
      expect(symbols).toHaveLength(0);
    });

    it("does nothing if snapshot does not exist", () => {
      expect(() => {
        replaceSnapshot(db, "nonexistent");
      }).not.toThrow();
    });
  });

  describe("listSnapshots", () => {
    it("returns empty array when no snapshots exist", () => {
      const snapshots = listSnapshots(db);
      expect(snapshots).toHaveLength(0);
    });

    it("returns all snapshots ordered by created_at desc", async () => {
      createSnapshot(db, "v1.0");
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      createSnapshot(db, "v2.0");
      await new Promise(resolve => setTimeout(resolve, 10));
      createSnapshot(db, "v3.0");

      const snapshots = listSnapshots(db);
      expect(snapshots).toHaveLength(3);
      expect(snapshots[0].name).toBe("v3.0");
      expect(snapshots[1].name).toBe("v2.0");
      expect(snapshots[2].name).toBe("v1.0");
    });
  });

  describe("setLatestSnapshot", () => {
    it("marks specified snapshot as latest", () => {
      const snapshot1 = createSnapshot(db, "v1.0");
      const snapshot2 = createSnapshot(db, "v2.0");

      // v2.0 should be latest now
      expect(getLatestSnapshot(db)?.name).toBe("v2.0");

      // Set v1.0 as latest
      setLatestSnapshot(db, snapshot1.id);

      const latest = getLatestSnapshot(db);
      expect(latest?.name).toBe("v1.0");

      // Verify v2.0 is no longer latest
      const snapshot2Updated = getSnapshotByName(db, "v2.0");
      expect(snapshot2Updated?.is_latest).toBe(0);
    });

    it("unmarks all other snapshots", () => {
      const snapshot1 = createSnapshot(db, "v1.0");
      const snapshot2 = createSnapshot(db, "v2.0");
      const snapshot3 = createSnapshot(db, "v3.0");

      setLatestSnapshot(db, snapshot1.id);

      const snapshots = listSnapshots(db);
      const latestCount = snapshots.filter(s => s.is_latest === 1).length;
      expect(latestCount).toBe(1);
      expect(snapshots.find(s => s.id === snapshot1.id)?.is_latest).toBe(1);
    });
  });
});
