/**
 * Output formatter with YAML/JSON support and enrichment options
 * @author GitHub Copilot
 */

import type { Database } from "bun:sqlite";
import yaml from "js-yaml";
import type { QuerySymbol } from "../db/queries";
import {
  getSymbolOccurrences,
  getSymbolRelationships,
  getSymbolDocumentation,
  getSymbolSource,
} from "../db/queries";
import type {
  OutputSymbol,
  OutputOccurrence,
  OutputRelationship,
  OutputDocumentation,
  OutputSource,
  QueryOutput,
  OutputOptions,
} from "./types";

/**
 * Format query output as YAML or JSON
 * @author GitHub Copilot
 * @param symbols Array of output symbols
 * @param format Output format (yaml or json)
 * @returns Formatted string
 */
export function formatOutput(symbols: OutputSymbol[], format: "yaml" | "json"): string {
  const output = {
    symbols,
    totalMatches: symbols.length,
  };

  if (format === "yaml") {
    return yaml.dump(output, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
    });
  } else {
    return JSON.stringify(output, null, 2);
  }
}

/**
 * Enrich symbols with occurrence information
 * @author GitHub Copilot
 * @param db Database instance
 * @param sourceDir Source directory (not used for occurrences, but kept for consistency)
 * @param symbols Query symbols to enrich
 * @param snapshotId Snapshot ID
 * @returns Enriched output symbols
 */
export function enrichWithOccurrences(
  db: Database,
  sourceDir: string,
  symbols: QuerySymbol[],
  snapshotId?: number
): OutputSymbol[] {
  return symbols.map((symbol) => {
    const occurrences = getSymbolOccurrences(db, symbol.id, snapshotId);
    
    const outputOccurrences: OutputOccurrence[] = occurrences.map((occ) => ({
      role: occ.role,
      file: occ.filePath,
      line: occ.startLine,
      column: occ.startCol,
    }));

    return {
      qualifiedName: symbol.qualifiedName,
      symbolName: symbol.symbolName,
      kind: symbol.kind,
      signature: symbol.signature || undefined,
      line: symbol.definitionLine ?? undefined,
      file: symbol.definitionFile ?? undefined,
      occurrences: outputOccurrences,
    };
  });
}

/**
 * Enrich symbols with relationship information
 * @author GitHub Copilot
 * @param db Database instance
 * @param symbols Output symbols to enrich
 * @param radius Maximum traversal depth
 * @param snapshotId Snapshot ID
 * @returns Enriched output symbols
 */
export function enrichWithRelationships(
  db: Database,
  symbols: OutputSymbol[],
  radius: number,
  snapshotId?: number
): OutputSymbol[] {
  // We need to map back from OutputSymbol to get the ID
  // For this, we'll need to query the database again
  return symbols.map((symbol) => {
    // Find the symbol ID by qualified name
    const stmt = db.prepare(`
      SELECT id FROM symbols 
      WHERE qualified_name = ? AND snapshot_id = ?
      LIMIT 1
    `);
    
    const actualSnapshotId = snapshotId ?? getLatestSnapshotId(db);
    const result = stmt.get(symbol.qualifiedName, actualSnapshotId) as { id: number } | undefined;
    
    if (!result) {
      return symbol;
    }

    const relationships = getSymbolRelationships(db, result.id, snapshotId, radius);
    
    const outputRelationships: OutputRelationship[] = relationships.map((rel) => ({
      symbol: rel.qualifiedName,
      kind: rel.relationshipKind,
      distance: rel.distance,
    }));

    return {
      ...symbol,
      relationships: outputRelationships,
    };
  });
}

/**
 * Enrich symbols with documentation
 * @author GitHub Copilot
 * @param db Database instance
 * @param symbols Output symbols to enrich
 * @returns Enriched output symbols
 */
export function enrichWithDocumentation(
  db: Database,
  symbols: OutputSymbol[]
): OutputSymbol[] {
  return symbols.map((symbol) => {
    // Find the symbol ID by qualified name
    const stmt = db.prepare(`
      SELECT id FROM symbols 
      WHERE qualified_name = ?
      LIMIT 1
    `);
    
    const result = stmt.get(symbol.qualifiedName) as { id: number } | undefined;
    
    if (!result) {
      return symbol;
    }

    const docs = getSymbolDocumentation(db, result.id);
    
    const outputDocs: OutputDocumentation[] = docs.map((doc) => ({
      type: doc.docType,
      content: doc.content,
    }));

    return {
      ...symbol,
      documentation: outputDocs.length > 0 ? outputDocs : undefined,
    };
  });
}

/**
 * Enrich symbols with source code snippets
 * @author GitHub Copilot
 * @param db Database instance
 * @param sourceDir Source directory (for resolving relative paths)
 * @param symbols Output symbols to enrich
 * @param snapshotId Snapshot ID
 * @param contextLines Number of context lines before/after
 * @returns Enriched output symbols
 */
export async function enrichWithSource(
  db: Database,
  sourceDir: string,
  symbols: OutputSymbol[],
  snapshotId?: number,
  contextLines: number = 3
): Promise<OutputSymbol[]> {
  const enriched: OutputSymbol[] = [];

  for (const symbol of symbols) {
    // Find the symbol ID by qualified name
    const stmt = db.prepare(`
      SELECT id FROM symbols 
      WHERE qualified_name = ? AND snapshot_id = ?
      LIMIT 1
    `);
    
    const actualSnapshotId = snapshotId ?? getLatestSnapshotId(db);
    const result = stmt.get(symbol.qualifiedName, actualSnapshotId) as { id: number } | undefined;
    
    if (!result) {
      enriched.push(symbol);
      continue;
    }

    const source = await getSymbolSource(db, result.id, snapshotId, contextLines);
    
    if (source) {
      const outputSource: OutputSource = {
        file: source.filePath,
        startLine: source.startLine,
        endLine: source.endLine,
        code: source.sourceCode,
      };

      enriched.push({
        ...symbol,
        source: outputSource,
      });
    } else {
      enriched.push(symbol);
    }
  }

  return enriched;
}

/**
 * Build complete query output with selected enrichments
 * @author GitHub Copilot
 * @param db Database instance
 * @param sourceDir Source directory
 * @param symbols Query symbols
 * @param options Enrichment options
 * @returns Complete query output
 */
export async function buildQueryOutput(
  db: Database,
  sourceDir: string,
  symbols: QuerySymbol[],
  options: OutputOptions = {}
): Promise<QueryOutput> {
  let outputSymbols: OutputSymbol[];

  // Start with basic conversion or occurrences if requested
  if (options.includeOccurrences) {
    outputSymbols = enrichWithOccurrences(db, sourceDir, symbols, undefined);
  } else {
    // Basic conversion without occurrences
    outputSymbols = symbols.map((symbol) => ({
      qualifiedName: symbol.qualifiedName,
      symbolName: symbol.symbolName,
      kind: symbol.kind,
      signature: symbol.signature || undefined,
      line: symbol.definitionLine ?? undefined,
      file: symbol.definitionFile ?? undefined,
    }));
  }

  // Apply relationships if requested
  if (options.includeRelationships && options.radius !== undefined) {
    outputSymbols = enrichWithRelationships(db, outputSymbols, options.radius, undefined);
  }

  // Apply documentation if requested
  if (options.includeDocumentation) {
    outputSymbols = enrichWithDocumentation(db, outputSymbols);
  }

  // Apply source code if requested (async operation)
  if (options.includeSources) {
    outputSymbols = await enrichWithSource(
      db,
      sourceDir,
      outputSymbols,
      undefined,
      options.contextLines ?? 3
    );
  }

  return {
    symbols: outputSymbols,
    totalMatches: outputSymbols.length,
  };
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
