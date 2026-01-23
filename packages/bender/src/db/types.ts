/**
 * Database row types for SCIP-inspired schema
 * @author GitHub Copilot
 */

/**
 * Represents a snapshot of the codebase at a specific point in time
 */
export interface SnapshotRow {
  id: number;
  name: string;
  created_at: string;
  description?: string;
  git_branch?: string;
  git_commit?: string;
  is_latest: number;
}

/**
 * Represents a document (source file) in the codebase
 */
export interface DocumentRow {
  id: number;
  snapshot_id: number;
  path: string;
  language: string;
  content_hash: string;
  indexed_at: string;
}

/**
 * Represents a symbol (class, method, field, variable, parameter) in the code
 */
export interface SymbolRow {
  id: number;
  snapshot_id: number;
  qualified_name: string;
  symbol_name: string;
  kind: "class" | "method" | "field" | "variable" | "parameter";
  signature: string;
  parent_symbol_id?: number;
}

/**
 * Represents an occurrence of a symbol in a document
 */
export interface OccurrenceRow {
  id: number;
  snapshot_id: number;
  symbol_id: number;
  document_id: number;
  role: "definition" | "reference" | "import";
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
}

/**
 * Represents a relationship between two symbols
 */
export interface RelationshipRow {
  id: number;
  snapshot_id: number;
  from_symbol_id: number;
  to_symbol_id: number;
  kind: "extends" | "implements" | "calls" | "references" | "contains";
}

/**
 * Represents documentation associated with a symbol
 */
export interface DocumentationRow {
  id: number;
  symbol_id: number;
  doc_type: "javadoc" | "inline" | "block";
  content: string;
  start_line: number;
}
