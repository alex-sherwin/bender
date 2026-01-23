/**
 * Database schema initialization for SCIP-inspired schema
 * @author GitHub Copilot
 */

import { Database } from "bun:sqlite";

const CREATE_TABLE_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  description TEXT,
  git_branch TEXT,
  git_commit TEXT,
  is_latest INTEGER NOT NULL DEFAULT 0
);
`;

const CREATE_TABLE_DOCUMENTS = `
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  indexed_at TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, path)
);
`;

const CREATE_TABLE_SYMBOLS = `
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  qualified_name TEXT NOT NULL,
  symbol_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('class', 'method', 'field', 'variable', 'parameter')),
  signature TEXT NOT NULL,
  parent_symbol_id INTEGER,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, qualified_name)
);
`;

const CREATE_TABLE_OCCURRENCES = `
CREATE TABLE IF NOT EXISTS occurrences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  symbol_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('definition', 'reference', 'import')),
  start_line INTEGER NOT NULL,
  start_col INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  end_col INTEGER NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
`;

const CREATE_TABLE_RELATIONSHIPS = `
CREATE TABLE IF NOT EXISTS relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id INTEGER NOT NULL,
  from_symbol_id INTEGER NOT NULL,
  to_symbol_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('extends', 'implements', 'calls', 'references', 'contains')),
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (from_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (to_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);
`;

const CREATE_TABLE_DOCUMENTATION = `
CREATE TABLE IF NOT EXISTS documentation (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL,
  doc_type TEXT NOT NULL CHECK(doc_type IN ('javadoc', 'inline', 'block')),
  content TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  FOREIGN KEY (symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);
`;

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_snapshots_is_latest ON snapshots(is_latest);",
  "CREATE INDEX IF NOT EXISTS idx_snapshots_name ON snapshots(name);",
  "CREATE INDEX IF NOT EXISTS idx_documents_snapshot_id ON documents(snapshot_id);",
  "CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_snapshot_id ON symbols(snapshot_id);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_qualified_name ON symbols(qualified_name);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_symbol_name ON symbols(symbol_name);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_parent_symbol_id ON symbols(parent_symbol_id);",
  "CREATE INDEX IF NOT EXISTS idx_occurrences_snapshot_id ON occurrences(snapshot_id);",
  "CREATE INDEX IF NOT EXISTS idx_occurrences_symbol_id ON occurrences(symbol_id);",
  "CREATE INDEX IF NOT EXISTS idx_occurrences_document_id ON occurrences(document_id);",
  "CREATE INDEX IF NOT EXISTS idx_occurrences_role ON occurrences(role);",
  "CREATE INDEX IF NOT EXISTS idx_relationships_snapshot_id ON relationships(snapshot_id);",
  "CREATE INDEX IF NOT EXISTS idx_relationships_from_symbol_id ON relationships(from_symbol_id);",
  "CREATE INDEX IF NOT EXISTS idx_relationships_to_symbol_id ON relationships(to_symbol_id);",
  "CREATE INDEX IF NOT EXISTS idx_relationships_kind ON relationships(kind);",
  "CREATE INDEX IF NOT EXISTS idx_documentation_symbol_id ON documentation(symbol_id);",
];

/**
 * Initialize database with SCIP-inspired schema and performance settings
 * @author GitHub Copilot
 * @param dbPath Path to SQLite database file (or ":memory:" for in-memory)
 * @returns Initialized Database instance
 */
export function initializeDatabase(dbPath: string): Database {
  const db = new Database(dbPath);

  // Enable performance optimizations
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA temp_store = MEMORY;");

  // Create tables
  db.exec(CREATE_TABLE_SNAPSHOTS);
  db.exec(CREATE_TABLE_DOCUMENTS);
  db.exec(CREATE_TABLE_SYMBOLS);
  db.exec(CREATE_TABLE_OCCURRENCES);
  db.exec(CREATE_TABLE_RELATIONSHIPS);
  db.exec(CREATE_TABLE_DOCUMENTATION);

  // Create indexes
  for (const index of INDEXES) {
    db.exec(index);
  }

  return db;
}
