// Row types for database tables

export interface SnapshotRow {
  id: string;
  created_at: string;
  is_latest: number;
  description?: string;
}

export interface FileRow {
  id: number;
  snapshot_id: string;
  path: string;
  language: string;
  package?: string;
}

export interface SymbolRow {
  id: number;
  snapshot_id: string;
  file_id: number;
  parent_id?: number;
  kind: string;
  name: string;
  qualified_name: string;
  signature: string;
  metadata?: string;
}

export interface ReferenceRow {
  id: number;
  snapshot_id: string;
  from_symbol_id: number;
  to_qualified_name: string;
  to_symbol_id?: number;
  ref_kind: string;
}

export interface ImportRow {
  id: number;
  snapshot_id: string;
  file_id: number;
  source_package: string;
  wildcard: number;
  imported_names?: string;
}

// Shared data types for parsers

export interface SymbolData {
  kind: string;
  name: string;
  qualified_name: string;
  signature: string;
  metadata?: any;
  parent?: string; // qualified name of parent symbol
}

export interface ReferenceData {
  from_qualified_name: string;
  to_qualified_name: string;
  ref_kind: string;
}

export interface ImportData {
  source_package: string;
  wildcard: boolean;
  imported_names: string[];
}

export interface ParsedFileData {
  file: {
    path: string;
    language: string;
    package?: string;
  };
  symbols: SymbolData[];
  references: ReferenceData[];
  imports: ImportData[];
}

// Query result types

export interface BlastRadiusResult {
  qualified_name: string;
  kind: string;
  file_path: string;
  depth: number;
}

export interface SymbolSearchResult {
  id: number;
  qualified_name: string;
  kind: string;
  file_path: string;
  line?: number;
}

export interface UsageResult {
  file_path: string;
  line: number;
  ref_kind: string;
  context?: string;
}

export interface FileSymbolsResult {
  qualified_name: string;
  kind: string;
  name: string;
  signature: string;
}