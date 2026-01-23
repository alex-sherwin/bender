/**
 * Query engine for searching and traversing indexed code
 * @author GitHub Copilot
 */

import type { Database } from "bun:sqlite";
import fs from "node:fs/promises";
import type { SymbolRow, OccurrenceRow, RelationshipRow, DocumentationRow } from "./types";

/**
 * Options for symbol search queries
 */
export interface QueryOptions {
  type?: "class" | "method" | "field" | "variable" | "parameter";
  snapshotId?: number;
}

/**
 * Symbol result with definition location
 */
export interface QuerySymbol {
  id: number;
  qualifiedName: string;
  symbolName: string;
  kind: "class" | "method" | "field" | "variable" | "parameter";
  signature: string;
  definitionLine: number | null;
  definitionFile: string | null;
}

/**
 * Occurrence information with file location
 */
export interface OccurrenceInfo {
  role: "definition" | "reference" | "import";
  filePath: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

/**
 * Related symbol with relationship information
 */
export interface RelatedSymbol {
  id: number;
  qualifiedName: string;
  symbolName: string;
  kind: "class" | "method" | "field" | "variable" | "parameter";
  relationshipKind: "extends" | "implements" | "calls" | "references" | "contains";
  distance: number;
}

/**
 * Documentation entry
 */
export interface DocumentationInfo {
  docType: "javadoc" | "inline" | "block";
  content: string;
  startLine: number;
}

/**
 * Source code snippet with context
 */
export interface SourceInfo {
  filePath: string;
  startLine: number;
  endLine: number;
  sourceCode: string;
}

/**
 * Register custom REGEXP function for SQLite
 * Note: Bun's SQLite doesn't support db.function(), but we keep this for API compatibility.
 * Actual regex filtering is done in JavaScript in findSymbolsByPattern.
 * @author GitHub Copilot
 * @param db Database instance
 */
export function registerRegexpFunction(db: Database): void {
  // Bun's SQLite doesn't support custom functions
  // This is a no-op but kept for API compatibility
  // Regex matching is done in JavaScript in the query functions
}

/**
 * Get latest snapshot ID or throw error if none exists
 * @author GitHub Copilot
 * @param db Database instance
 * @returns Latest snapshot ID
 */
function getLatestSnapshotId(db: Database): number {
  const result = db.prepare("SELECT id FROM snapshots WHERE is_latest = 1").get() as { id: number } | undefined;
  if (!result) {
    throw new Error("No snapshots found in database");
  }
  return result.id;
}

/**
 * Find symbols matching a regex pattern
 * Note: Bun's SQLite doesn't support custom functions, so we query all symbols
 * and filter with JavaScript regex. This is acceptable as the dataset is typically small.
 * @author GitHub Copilot
 * @param db Database instance
 * @param pattern Regular expression pattern
 * @param options Query options (type filter, snapshot)
 * @returns Array of matching symbols with definition locations
 */
export function findSymbolsByPattern(
  db: Database,
  pattern: string,
  options: QueryOptions = {}
): QuerySymbol[] {
  const snapshotId = options.snapshotId ?? getLatestSnapshotId(db);
  
  // Build query to get all symbols (or filtered by type)
  let query = `
    SELECT 
      s.id,
      s.qualified_name as qualifiedName,
      s.symbol_name as symbolName,
      s.kind,
      s.signature,
      o.start_line as definitionLine,
      d.path as definitionFile
    FROM symbols s
    LEFT JOIN occurrences o ON s.id = o.symbol_id AND o.role = 'definition' AND o.snapshot_id = ?
    LEFT JOIN documents d ON o.document_id = d.id
    WHERE s.snapshot_id = ?
  `;

  const params: (string | number)[] = [snapshotId, snapshotId];

  if (options.type) {
    query += " AND s.kind = ?";
    params.push(options.type);
  }

  query += " ORDER BY s.qualified_name";

  const stmt = db.prepare(query);
  const allSymbols = stmt.all(...params) as Array<{
    id: number;
    qualifiedName: string;
    symbolName: string;
    kind: "class" | "method" | "field" | "variable" | "parameter";
    signature: string;
    definitionLine: number | null;
    definitionFile: string | null;
  }>;

  // Filter in JavaScript with regex (case-insensitive)
  try {
    const regex = new RegExp(pattern, "i");
    return allSymbols.filter(symbol => 
      regex.test(symbol.qualifiedName) || regex.test(symbol.symbolName)
    );
  } catch (error) {
    // Invalid regex pattern - return empty results
    return [];
  }
}

/**
 * Get all occurrences of a symbol
 * @author GitHub Copilot
 * @param db Database instance
 * @param symbolId Symbol ID
 * @param snapshotId Snapshot ID (defaults to latest)
 * @returns Array of occurrences with file locations
 */
export function getSymbolOccurrences(
  db: Database,
  symbolId: number,
  snapshotId?: number
): OccurrenceInfo[] {
  const actualSnapshotId = snapshotId ?? getLatestSnapshotId(db);

  const stmt = db.prepare(`
    SELECT 
      o.role,
      d.path as filePath,
      o.start_line as startLine,
      o.start_col as startCol,
      o.end_line as endLine,
      o.end_col as endCol
    FROM occurrences o
    JOIN documents d ON o.document_id = d.id
    WHERE o.symbol_id = ? AND o.snapshot_id = ?
    ORDER BY d.path, o.start_line, o.start_col
  `);

  const results = stmt.all(symbolId, actualSnapshotId) as Array<{
    role: "definition" | "reference" | "import";
    filePath: string;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  }>;

  return results;
}

/**
 * Get related symbols using recursive traversal
 * @author GitHub Copilot
 * @param db Database instance
 * @param symbolId Starting symbol ID
 * @param snapshotId Snapshot ID (defaults to latest)
 * @param radius Maximum traversal depth
 * @returns Array of related symbols with relationship info
 */
export function getSymbolRelationships(
  db: Database,
  symbolId: number,
  snapshotId: number | undefined,
  radius: number
): RelatedSymbol[] {
  const actualSnapshotId = snapshotId ?? getLatestSnapshotId(db);

  // Use recursive CTE to traverse relationships bidirectionally
  const stmt = db.prepare(`
    WITH RECURSIVE relationship_graph AS (
      -- Base case: direct relationships (both directions)
      SELECT 
        r.to_symbol_id as symbol_id,
        r.kind as relationshipKind,
        1 as distance
      FROM relationships r
      WHERE r.from_symbol_id = ? AND r.snapshot_id = ?
      
      UNION
      
      SELECT 
        r.from_symbol_id as symbol_id,
        r.kind as relationshipKind,
        1 as distance
      FROM relationships r
      WHERE r.to_symbol_id = ? AND r.snapshot_id = ?
      
      UNION ALL
      
      -- Recursive case: continue traversing (both directions)
      SELECT 
        r.to_symbol_id as symbol_id,
        r.kind as relationshipKind,
        rg.distance + 1 as distance
      FROM relationships r
      JOIN relationship_graph rg ON r.from_symbol_id = rg.symbol_id
      WHERE r.snapshot_id = ? AND rg.distance < ?
      
      UNION ALL
      
      SELECT 
        r.from_symbol_id as symbol_id,
        r.kind as relationshipKind,
        rg.distance + 1 as distance
      FROM relationships r
      JOIN relationship_graph rg ON r.to_symbol_id = rg.symbol_id
      WHERE r.snapshot_id = ? AND rg.distance < ?
    )
    SELECT DISTINCT
      s.id,
      s.qualified_name as qualifiedName,
      s.symbol_name as symbolName,
      s.kind,
      rg.relationshipKind,
      MIN(rg.distance) as distance
    FROM relationship_graph rg
    JOIN symbols s ON rg.symbol_id = s.id
    WHERE s.snapshot_id = ?
    GROUP BY s.id, s.qualified_name, s.symbol_name, s.kind, rg.relationshipKind
    ORDER BY distance, s.qualified_name
  `);

  const results = stmt.all(
    symbolId, actualSnapshotId, // Base forward
    symbolId, actualSnapshotId,  // Base backward
    actualSnapshotId, radius,    // Recursive forward
    actualSnapshotId, radius,    // Recursive backward
    actualSnapshotId             // Final filter
  ) as Array<{
    id: number;
    qualifiedName: string;
    symbolName: string;
    kind: "class" | "method" | "field" | "variable" | "parameter";
    relationshipKind: "extends" | "implements" | "calls" | "references" | "contains";
    distance: number;
  }>;

  return results;
}

/**
 * Get documentation for a symbol
 * @author GitHub Copilot
 * @param db Database instance
 * @param symbolId Symbol ID
 * @returns Array of documentation entries
 */
export function getSymbolDocumentation(
  db: Database,
  symbolId: number
): DocumentationInfo[] {
  const stmt = db.prepare(`
    SELECT 
      doc_type as docType,
      content,
      start_line as startLine
    FROM documentation
    WHERE symbol_id = ?
    ORDER BY start_line
  `);

  const results = stmt.all(symbolId) as Array<{
    docType: "javadoc" | "inline" | "block";
    content: string;
    startLine: number;
  }>;

  return results;
}

/**
 * Get source code snippet for a symbol with context lines
 * @author GitHub Copilot
 * @param db Database instance
 * @param symbolId Symbol ID
 * @param snapshotId Snapshot ID (defaults to latest)
 * @param contextLines Number of context lines before/after
 * @returns Source code info or null if not found
 */
export async function getSymbolSource(
  db: Database,
  symbolId: number,
  snapshotId?: number,
  contextLines: number = 3
): Promise<SourceInfo | null> {
  const actualSnapshotId = snapshotId ?? getLatestSnapshotId(db);

  // Find the definition occurrence
  const stmt = db.prepare(`
    SELECT 
      d.path as filePath,
      o.start_line as startLine,
      o.end_line as endLine
    FROM occurrences o
    JOIN documents d ON o.document_id = d.id
    WHERE o.symbol_id = ? AND o.snapshot_id = ? AND o.role = 'definition'
    LIMIT 1
  `);

  const result = stmt.get(symbolId, actualSnapshotId) as {
    filePath: string;
    startLine: number;
    endLine: number;
  } | undefined;

  if (!result) {
    return null;
  }

  try {
    // Read the file content
    const content = await fs.readFile(result.filePath, "utf-8");
    const lines = content.split("\n");

    // Calculate line range with context
    const startLineWithContext = Math.max(0, result.startLine - contextLines - 1);
    const endLineWithContext = Math.min(lines.length - 1, result.endLine + contextLines - 1);

    // Extract the relevant lines
    const sourceLines = lines.slice(startLineWithContext, endLineWithContext + 1);
    const sourceCode = sourceLines.join("\n");

    return {
      filePath: result.filePath,
      startLine: startLineWithContext + 1,
      endLine: endLineWithContext + 1,
      sourceCode,
    };
  } catch (error) {
    // File might not exist or be readable
    return null;
  }
}
