import { Database } from "bun:sqlite";
import { log } from "../logger";
import type { SnapshotRow, SymbolRow } from "./types";

/**
 * Get all snapshots with metadata
 * @param db Database instance
 * @returns Array of snapshots with symbol counts
 * @author GitHub Copilot
 */
export function listSnapshots(db: Database): Array<SnapshotRow & { symbolCount: number }> {
  try {
    const stmt = db.prepare(`
      SELECT s.*, COUNT(sym.id) as symbolCount
      FROM snapshots s
      LEFT JOIN symbols sym ON s.id = sym.snapshot_id
      GROUP BY s.id
      ORDER BY s.is_latest DESC, s.created_at DESC
    `);
    return stmt.all() as Array<SnapshotRow & { symbolCount: number }>;
  } catch (error) {
    log.error("Error listing snapshots:", error);
    throw error;
  }
}

/**
 * Compare two snapshots and return diff of symbols
 * @param db Database instance
 * @param snapshot1 First snapshot ID
 * @param snapshot2 Second snapshot ID
 * @returns Comparison result with added, removed, and modified symbols
 * @author GitHub Copilot
 */
export function compareSnapshots(
  db: Database,
  snapshot1: string,
  snapshot2: string
): {
  addedSymbols: SymbolRow[];
  removedSymbols: SymbolRow[];
  modifiedSymbols: { old: SymbolRow; new: SymbolRow }[];
} {
  try {
    // Get all symbols from both snapshots
    const stmt = db.prepare(`
      SELECT * FROM symbols
      WHERE snapshot_id IN (?, ?)
      ORDER BY qualified_name
    `);
    const allSymbols = stmt.all(snapshot1, snapshot2) as SymbolRow[];

    const symbols1 = new Map<string, SymbolRow>();
    const symbols2 = new Map<string, SymbolRow>();

    for (const symbol of allSymbols) {
      if (symbol.snapshot_id === snapshot1) {
        symbols1.set(symbol.qualified_name, symbol);
      } else {
        symbols2.set(symbol.qualified_name, symbol);
      }
    }

    const addedSymbols: SymbolRow[] = [];
    const removedSymbols: SymbolRow[] = [];
    const modifiedSymbols: { old: SymbolRow; new: SymbolRow }[] = [];

    // Find added and modified
    for (const [qualName, symbol2] of symbols2) {
      const symbol1 = symbols1.get(qualName);
      if (!symbol1) {
        addedSymbols.push(symbol2);
      } else if (symbol1.signature !== symbol2.signature) {
        modifiedSymbols.push({ old: symbol1, new: symbol2 });
      }
    }

    // Find removed
    for (const [qualName, symbol1] of symbols1) {
      if (!symbols2.has(qualName)) {
        removedSymbols.push(symbol1);
      }
    }

    return { addedSymbols, removedSymbols, modifiedSymbols };
  } catch (error) {
    log.error(`Error comparing snapshots ${snapshot1} and ${snapshot2}:`, error);
    throw error;
  }
}

/**
 * Delete a snapshot and all associated data
 * @param db Database instance
 * @param snapshotId Snapshot ID to delete
 * @author GitHub Copilot
 */
export function deleteSnapshot(db: Database, snapshotId: string): void {
  try {
    const tx = db.transaction(() => {
      const stmt = db.prepare("DELETE FROM snapshots WHERE id = ?");
      const result = stmt.run(snapshotId);
      if (result.changes === 0) {
        throw new Error(`Snapshot ${snapshotId} not found`);
      }
    });
    tx();
  } catch (error) {
    log.error(`Error deleting snapshot ${snapshotId}:`, error);
    throw error;
  }
}

/**
 * Set a snapshot as the latest
 * @param db Database instance
 * @param snapshotId Snapshot ID to set as latest
 * @author GitHub Copilot
 */
export function setLatestSnapshot(db: Database, snapshotId: string): void {
  try {
    const tx = db.transaction(() => {
      // First check if snapshot exists
      const checkStmt = db.prepare("SELECT id FROM snapshots WHERE id = ?");
      const exists = checkStmt.get(snapshotId);
      if (!exists) {
        throw new Error(`Snapshot ${snapshotId} not found`);
      }

      // Update all to not latest, then set this one
      db.exec("UPDATE snapshots SET is_latest = 0");
      const updateStmt = db.prepare("UPDATE snapshots SET is_latest = 1 WHERE id = ?");
      updateStmt.run(snapshotId);
    });
    tx();
  } catch (error) {
    log.error(`Error setting latest snapshot to ${snapshotId}:`, error);
    throw error;
  }
}

/**
 * Get statistics for a snapshot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @returns Statistics object
 * @author GitHub Copilot
 */
export function getSnapshotStats(db: Database, snapshotId: string): {
  fileCount: number;
  symbolCount: number;
  referenceCount: number;
  importCount: number;
} {
  try {
    // Get file count
    const fileStmt = db.prepare("SELECT COUNT(*) as count FROM files WHERE snapshot_id = ?");
    const fileCount = (fileStmt.get(snapshotId) as { count: number }).count;

    // Get symbol count
    const symbolStmt = db.prepare("SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?");
    const symbolCount = (symbolStmt.get(snapshotId) as { count: number }).count;

    // Get reference count
    const refStmt = db.prepare('SELECT COUNT(*) as count FROM "references" WHERE snapshot_id = ?');
    const referenceCount = (refStmt.get(snapshotId) as { count: number }).count;

    // Get import count
    const importStmt = db.prepare("SELECT COUNT(*) as count FROM imports WHERE snapshot_id = ?");
    const importCount = (importStmt.get(snapshotId) as { count: number }).count;

    return { fileCount, symbolCount, referenceCount, importCount };
  } catch (error) {
    log.error(`Error getting stats for snapshot ${snapshotId}:`, error);
    throw error;
  }
}