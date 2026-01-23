/**
 * Snapshot management functions for database
 * @author GitHub Copilot
 */

import type { Database } from "bun:sqlite";
import type { SnapshotRow } from "./types";

/**
 * Create a new snapshot and mark it as latest
 * @author GitHub Copilot
 * @param db Database instance
 * @param name Unique name for the snapshot
 * @param description Optional description
 * @param gitBranch Optional git branch name
 * @param gitCommit Optional git commit hash
 * @returns The created snapshot row
 */
export function createSnapshot(
  db: Database,
  name: string,
  description?: string,
  gitBranch?: string,
  gitCommit?: string
): SnapshotRow {
  const createdAt = new Date().toISOString();

  const tx = db.transaction(() => {
    // Set all existing snapshots to not latest
    db.exec("UPDATE snapshots SET is_latest = 0");

    // Insert new snapshot
    const insertStmt = db.prepare(
      "INSERT INTO snapshots (name, created_at, description, git_branch, git_commit, is_latest) VALUES (?, ?, ?, ?, ?, 1)"
    );
    insertStmt.run(name, createdAt, description ?? null, gitBranch ?? null, gitCommit ?? null);

    // Get the inserted snapshot
    const selectStmt = db.prepare("SELECT * FROM snapshots WHERE name = ?");
    return selectStmt.get(name) as SnapshotRow;
  });

  return tx();
}

/**
 * Get the latest snapshot
 * @author GitHub Copilot
 * @param db Database instance
 * @returns The latest snapshot or null if none exists
 */
export function getLatestSnapshot(db: Database): SnapshotRow | null {
  const stmt = db.prepare("SELECT * FROM snapshots WHERE is_latest = 1");
  return (stmt.get() as SnapshotRow | undefined) ?? null;
}

/**
 * Get a snapshot by name
 * @author GitHub Copilot
 * @param db Database instance
 * @param name Snapshot name
 * @returns The snapshot or null if not found
 */
export function getSnapshotByName(db: Database, name: string): SnapshotRow | null {
  const stmt = db.prepare("SELECT * FROM snapshots WHERE name = ?");
  return (stmt.get(name) as SnapshotRow | undefined) ?? null;
}

/**
 * Replace an existing snapshot by deleting old data and creating new
 * @author GitHub Copilot
 * @param db Database instance
 * @param name Snapshot name to replace
 */
export function replaceSnapshot(db: Database, name: string): void {
  const tx = db.transaction(() => {
    const snapshot = getSnapshotByName(db, name);
    if (snapshot) {
      // Delete the snapshot (CASCADE will delete related data)
      const deleteStmt = db.prepare("DELETE FROM snapshots WHERE id = ?");
      deleteStmt.run(snapshot.id);
    }
  });

  tx();
}

/**
 * List all snapshots ordered by creation date (newest first)
 * @author GitHub Copilot
 * @param db Database instance
 * @returns Array of all snapshots
 */
export function listSnapshots(db: Database): SnapshotRow[] {
  const stmt = db.prepare("SELECT * FROM snapshots ORDER BY created_at DESC");
  return stmt.all() as SnapshotRow[];
}

/**
 * Set a specific snapshot as the latest
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId ID of snapshot to mark as latest
 */
export function setLatestSnapshot(db: Database, snapshotId: number): void {
  const tx = db.transaction(() => {
    // Set all snapshots to not latest
    db.exec("UPDATE snapshots SET is_latest = 0");

    // Set the specified snapshot as latest
    const updateStmt = db.prepare("UPDATE snapshots SET is_latest = 1 WHERE id = ?");
    updateStmt.run(snapshotId);
  });

  tx();
}
