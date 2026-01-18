import { Database } from "bun:sqlite";


const CREATE_TABLE_SNAPSHOTS = `
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  is_latest INTEGER NOT NULL DEFAULT 0,
  description TEXT
);
`;

const CREATE_TABLE_FILES = `
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  package TEXT,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  UNIQUE(snapshot_id, path)
);
`;

const CREATE_TABLE_SYMBOLS = `
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  file_id INTEGER NOT NULL,
  parent_id INTEGER,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  signature TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES symbols(id) ON DELETE CASCADE
);
`;

const CREATE_TABLE_REFERENCES = `
CREATE TABLE IF NOT EXISTS "references" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  from_symbol_id INTEGER NOT NULL,
  to_qualified_name TEXT NOT NULL,
  to_symbol_id INTEGER,
  ref_kind TEXT NOT NULL,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (from_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE,
  FOREIGN KEY (to_symbol_id) REFERENCES symbols(id) ON DELETE CASCADE
);
`;

const CREATE_TABLE_IMPORTS = `
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot_id TEXT NOT NULL,
  file_id INTEGER NOT NULL,
  source_package TEXT NOT NULL,
  wildcard INTEGER NOT NULL DEFAULT 0,
  imported_names TEXT,
  FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);
`;

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS idx_snapshots_is_latest ON snapshots(is_latest);",
  "CREATE INDEX IF NOT EXISTS idx_files_snapshot_path ON files(snapshot_id, path);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_snapshot_qualified_name ON symbols(snapshot_id, qualified_name);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_snapshot_name ON symbols(snapshot_id, name);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_snapshot_kind ON symbols(snapshot_id, kind);",
  "CREATE INDEX IF NOT EXISTS idx_symbols_parent_id ON symbols(parent_id);",
  "CREATE INDEX IF NOT EXISTS idx_references_snapshot_from ON \"references\"(snapshot_id, from_symbol_id);",
  "CREATE INDEX IF NOT EXISTS idx_references_snapshot_to ON \"references\"(snapshot_id, to_symbol_id);",
  "CREATE INDEX IF NOT EXISTS idx_references_snapshot_to_qualified ON \"references\"(snapshot_id, to_qualified_name);",
  "CREATE INDEX IF NOT EXISTS idx_imports_snapshot_file ON imports(snapshot_id, file_id);",
];

export function initDatabase(dbPath: string): Database {
  const db = new Database(dbPath);

  // Enable foreign key constraint enforcement
  db.exec("PRAGMA foreign_keys = ON");

  db.exec(CREATE_TABLE_SNAPSHOTS);
  db.exec(CREATE_TABLE_FILES);
  db.exec(CREATE_TABLE_SYMBOLS);
  db.exec(CREATE_TABLE_REFERENCES);
  db.exec(CREATE_TABLE_IMPORTS);

  for (const index of INDEXES) {
    db.exec(index);
  }

  return db;
}

export function createSnapshot(db: Database, description?: string): string {
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const tx = db.transaction(() => {
    // Set all existing snapshots to not latest
    db.exec("UPDATE snapshots SET is_latest = 0");

    // Insert new snapshot
    const insertStmt = db.prepare("INSERT INTO snapshots (id, created_at, is_latest, description) VALUES (?, ?, 1, ?)");
    insertStmt.run(id, created_at, description ?? null);
  });

  tx();

  return id;
}