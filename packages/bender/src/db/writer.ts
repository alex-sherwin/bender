/**
 * Database writer functions for inserting parsed data
 * @author GitHub Copilot
 */

import type { Database } from "bun:sqlite";
import type { DocumentRow, SymbolRow, OccurrenceRow, RelationshipRow, DocumentationRow } from "./types";

/**
 * Insert a document into the database
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param document Document data
 * @returns The ID of the inserted document
 */
export function insertDocument(
  db: Database,
  snapshotId: number,
  document: Omit<DocumentRow, "id" | "snapshot_id">
): number {
  const stmt = db.prepare(
    "INSERT INTO documents (snapshot_id, path, language, content_hash, indexed_at) VALUES (?, ?, ?, ?, ?)"
  );
  
  const result = stmt.run(
    snapshotId,
    document.path,
    document.language,
    document.content_hash,
    document.indexed_at
  );

  return result.lastInsertRowid as number;
}

/**
 * Insert multiple documents in a transaction
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param documents Array of documents to insert
 * @returns Array of inserted document IDs
 */
export function insertDocuments(
  db: Database,
  snapshotId: number,
  documents: Omit<DocumentRow, "id" | "snapshot_id">[]
): number[] {
  const stmt = db.prepare(
    "INSERT INTO documents (snapshot_id, path, language, content_hash, indexed_at) VALUES (?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    const ids: number[] = [];
    for (const doc of documents) {
      const result = stmt.run(snapshotId, doc.path, doc.language, doc.content_hash, doc.indexed_at);
      ids.push(result.lastInsertRowid as number);
    }
    return ids;
  });

  return tx();
}

/**
 * Insert a symbol into the database
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param symbol Symbol data
 * @returns The ID of the inserted symbol
 */
export function insertSymbol(
  db: Database,
  snapshotId: number,
  symbol: Omit<SymbolRow, "id" | "snapshot_id">
): number {
  const stmt = db.prepare(
    "INSERT INTO symbols (snapshot_id, qualified_name, symbol_name, kind, signature, parent_symbol_id) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const result = stmt.run(
    snapshotId,
    symbol.qualified_name,
    symbol.symbol_name,
    symbol.kind,
    symbol.signature,
    symbol.parent_symbol_id ?? null
  );

  return result.lastInsertRowid as number;
}

/**
 * Insert multiple symbols in a transaction
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param symbols Array of symbols to insert
 * @returns Array of inserted symbol IDs
 */
export function insertSymbols(
  db: Database,
  snapshotId: number,
  symbols: Omit<SymbolRow, "id" | "snapshot_id">[]
): number[] {
  const stmt = db.prepare(
    "INSERT INTO symbols (snapshot_id, qualified_name, symbol_name, kind, signature, parent_symbol_id) VALUES (?, ?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    const ids: number[] = [];
    for (const sym of symbols) {
      const result = stmt.run(
        snapshotId,
        sym.qualified_name,
        sym.symbol_name,
        sym.kind,
        sym.signature,
        sym.parent_symbol_id ?? null
      );
      ids.push(result.lastInsertRowid as number);
    }
    return ids;
  });

  return tx();
}

/**
 * Insert an occurrence into the database
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param occurrence Occurrence data
 */
export function insertOccurrence(
  db: Database,
  snapshotId: number,
  occurrence: Omit<OccurrenceRow, "id" | "snapshot_id">
): void {
  const stmt = db.prepare(
    "INSERT INTO occurrences (snapshot_id, symbol_id, document_id, role, start_line, start_col, end_line, end_col) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  stmt.run(
    snapshotId,
    occurrence.symbol_id,
    occurrence.document_id,
    occurrence.role,
    occurrence.start_line,
    occurrence.start_col,
    occurrence.end_line,
    occurrence.end_col
  );
}

/**
 * Insert multiple occurrences in a transaction
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param occurrences Array of occurrences to insert
 */
export function insertOccurrences(
  db: Database,
  snapshotId: number,
  occurrences: Omit<OccurrenceRow, "id" | "snapshot_id">[]
): void {
  const stmt = db.prepare(
    "INSERT INTO occurrences (snapshot_id, symbol_id, document_id, role, start_line, start_col, end_line, end_col) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    for (const occ of occurrences) {
      stmt.run(
        snapshotId,
        occ.symbol_id,
        occ.document_id,
        occ.role,
        occ.start_line,
        occ.start_col,
        occ.end_line,
        occ.end_col
      );
    }
  });

  tx();
}

/**
 * Insert a relationship into the database
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param relationship Relationship data
 */
export function insertRelationship(
  db: Database,
  snapshotId: number,
  relationship: Omit<RelationshipRow, "id" | "snapshot_id">
): void {
  const stmt = db.prepare(
    "INSERT INTO relationships (snapshot_id, from_symbol_id, to_symbol_id, kind) VALUES (?, ?, ?, ?)"
  );

  stmt.run(
    snapshotId,
    relationship.from_symbol_id,
    relationship.to_symbol_id,
    relationship.kind
  );
}

/**
 * Insert multiple relationships in a transaction
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param relationships Array of relationships to insert
 */
export function insertRelationships(
  db: Database,
  snapshotId: number,
  relationships: Omit<RelationshipRow, "id" | "snapshot_id">[]
): void {
  const stmt = db.prepare(
    "INSERT INTO relationships (snapshot_id, from_symbol_id, to_symbol_id, kind) VALUES (?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    for (const rel of relationships) {
      stmt.run(snapshotId, rel.from_symbol_id, rel.to_symbol_id, rel.kind);
    }
  });

  tx();
}

/**
 * Insert documentation into the database
 * @author GitHub Copilot
 * @param db Database instance
 * @param documentation Documentation data
 */
export function insertDocumentation(
  db: Database,
  documentation: Omit<DocumentationRow, "id">
): void {
  const stmt = db.prepare(
    "INSERT INTO documentation (symbol_id, doc_type, content, start_line) VALUES (?, ?, ?, ?)"
  );

  stmt.run(
    documentation.symbol_id,
    documentation.doc_type,
    documentation.content,
    documentation.start_line
  );
}

/**
 * Insert multiple documentation entries in a transaction
 * @author GitHub Copilot
 * @param db Database instance
 * @param docs Array of documentation entries to insert
 */
export function insertDocumentations(
  db: Database,
  docs: Omit<DocumentationRow, "id">[]
): void {
  const stmt = db.prepare(
    "INSERT INTO documentation (symbol_id, doc_type, content, start_line) VALUES (?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    for (const doc of docs) {
      stmt.run(doc.symbol_id, doc.doc_type, doc.content, doc.start_line);
    }
  });

  tx();
}
