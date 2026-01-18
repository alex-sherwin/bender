import { Database } from "bun:sqlite";
import { log } from "../logger";
import type {
  SnapshotRow,
  SymbolRow,
  BlastRadiusResult,
  SymbolSearchResult,
  UsageResult,
  FileSymbolsResult,
} from "./types";

/**
 * Get the latest snapshot ID
 * @param db Database instance
 * @returns Latest snapshot ID or null if none exist
 * @author GitHub Copilot
 */
export function getLatestSnapshot(db: Database): string | null {
  try {
    const stmt = db.prepare("SELECT id FROM snapshots WHERE is_latest = 1 LIMIT 1");
    const result = stmt.get() as { id: string } | undefined;
    return result?.id ?? null;
  } catch (error) {
    log.error("Error getting latest snapshot:", error);
    throw error;
  }
}

/**
 * Find a symbol by its qualified name
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param qualifiedName Qualified name of the symbol
 * @returns SymbolRow or null if not found
 * @author GitHub Copilot
 */
export function findSymbol(db: Database, snapshotId: string, qualifiedName: string): SymbolRow | null {
  try {
    const stmt = db.prepare(`
      SELECT * FROM symbols
      WHERE snapshot_id = ? AND qualified_name = ?
      LIMIT 1
    `);
    return stmt.get(snapshotId, qualifiedName) as SymbolRow | undefined ?? null;
  } catch (error) {
    log.error(`Error finding symbol ${qualifiedName}:`, error);
    throw error;
  }
}

/**
 * Find all symbols with a given name (across all files)
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param name Symbol name
 * @returns Array of SymbolRow
 * @author GitHub Copilot
 */
export function findSymbolsByName(db: Database, snapshotId: string, name: string): SymbolRow[] {
  try {
    const stmt = db.prepare(`
      SELECT * FROM symbols
      WHERE snapshot_id = ? AND name = ?
    `);
    return stmt.all(snapshotId, name) as SymbolRow[];
  } catch (error) {
    log.error(`Error finding symbols by name ${name}:`, error);
    throw error;
  }
}

/**
 * Get blast radius (call graph) for a symbol using recursive CTE
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param qualifiedName Qualified name of the symbol
 * @param depth Maximum depth to traverse (default 3)
 * @returns Array of BlastRadiusResult
 * @author GitHub Copilot
 */
export function getBlastRadius(
  db: Database,
  snapshotId: string,
  qualifiedName: string,
  depth: number = 3
): BlastRadiusResult[] {
  try {
    // First find the symbol ID
    const symbol = findSymbol(db, snapshotId, qualifiedName);
    if (!symbol) {
      return [];
    }

    const stmt = db.prepare(`
      WITH RECURSIVE call_graph AS (
        -- Base case: the starting symbol
        SELECT
          s.id as symbol_id,
          s.qualified_name,
          s.kind,
          f.path as file_path,
          0 as depth
        FROM symbols s
        JOIN files f ON s.file_id = f.id
        WHERE s.snapshot_id = ? AND s.id = ?

        UNION ALL

        -- Recursive case: methods called by this method
        SELECT
          s.id as symbol_id,
          s.qualified_name,
          s.kind,
          f.path as file_path,
          cg.depth + 1
        FROM "references" r
        JOIN symbols s ON r.to_symbol_id = s.id
        JOIN files f ON s.file_id = f.id
        JOIN call_graph cg ON r.from_symbol_id = cg.symbol_id
        WHERE r.snapshot_id = ? AND r.ref_kind = 'call' AND cg.depth < ?
      )
      SELECT DISTINCT qualified_name, kind, file_path, depth
      FROM call_graph
      ORDER BY depth, qualified_name
    `);

    return stmt.all(snapshotId, symbol.id, snapshotId, depth) as BlastRadiusResult[];
  } catch (error) {
    log.error(`Error getting blast radius for ${qualifiedName}:`, error);
    throw error;
  }
}

/**
 * Find all references to a symbol
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param qualifiedName Qualified name of the symbol
 * @returns Array of UsageResult
 * @author GitHub Copilot
 */
export function findReferences(db: Database, snapshotId: string, qualifiedName: string): UsageResult[] {
  try {
    // First find the symbol ID
    const symbol = findSymbol(db, snapshotId, qualifiedName);
    if (!symbol) {
      return [];
    }

    const stmt = db.prepare(`
      SELECT
        f.path as file_path,
        r.ref_kind,
        s.qualified_name as from_qualified_name
      FROM "references" r
      JOIN symbols s ON r.from_symbol_id = s.id
      JOIN files f ON s.file_id = f.id
      WHERE r.snapshot_id = ? AND (r.to_symbol_id = ? OR r.to_qualified_name = ?)
      ORDER BY f.path, s.qualified_name
    `);

    const results = stmt.all(snapshotId, symbol.id, qualifiedName) as Array<{
      file_path: string;
      ref_kind: string;
      from_qualified_name: string;
    }>;

    // Map to UsageResult format
    return results.map(r => ({
      file_path: r.file_path,
      line: 0, // TODO: Add line number when location is added to schema
      ref_kind: r.ref_kind,
      context: r.from_qualified_name,
    }));
  } catch (error) {
    log.error(`Error finding references for ${qualifiedName}:`, error);
    throw error;
  }
}

/**
 * Get direct callers of a method
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param symbolId Symbol ID
 * @returns Array of SymbolRow (callers)
 * @author GitHub Copilot
 */
export function getCallersOfMethod(db: Database, snapshotId: string, symbolId: number): SymbolRow[] {
  try {
    const stmt = db.prepare(`
      SELECT s.*
      FROM "references" r
      JOIN symbols s ON r.from_symbol_id = s.id
      WHERE r.snapshot_id = ? AND r.to_symbol_id = ? AND r.ref_kind = 'call'
    `);
    return stmt.all(snapshotId, symbolId) as SymbolRow[];
  } catch (error) {
    log.error(`Error getting callers for symbol ID ${symbolId}:`, error);
    throw error;
  }
}

/**
 * Get all symbols in a file
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param filePath File path
 * @returns Array of FileSymbolsResult
 * @author GitHub Copilot
 */
export function getFileSymbols(db: Database, snapshotId: string, filePath: string): FileSymbolsResult[] {
  try {
    const stmt = db.prepare(`
      SELECT s.qualified_name, s.kind, s.name, s.signature
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE s.snapshot_id = ? AND f.path = ?
      ORDER BY s.qualified_name
    `);
    return stmt.all(snapshotId, filePath) as FileSymbolsResult[];
  } catch (error) {
    log.error(`Error getting symbols for file ${filePath}:`, error);
    throw error;
  }
}

export function searchSymbols(db: Database, snapshotId: string, pattern: string): SymbolSearchResult[] {
  try {
    const stmt = db.prepare(`
      SELECT s.id, s.qualified_name, s.kind, f.path as file_path
      FROM symbols s
      JOIN files f ON s.file_id = f.id
      WHERE s.snapshot_id = ? AND s.qualified_name LIKE ?
      ORDER BY s.qualified_name
    `);
    // Add wildcards if not already present
    const searchPattern = pattern.includes('%') ? pattern : `%${pattern}%`;
    return stmt.all(snapshotId, searchPattern) as SymbolSearchResult[];
  } catch (error) {
    log.error(`Error searching symbols with pattern ${pattern}:`, error);
    throw error;
  }
}
