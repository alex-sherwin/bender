import { Database } from "bun:sqlite";
import { initDatabase } from "../src/db/schema";
import { indexDirectory } from "../src/indexer";
import type { SupportedLanguage } from "../src/cli/args-parser";
import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";

/**
 * Create a test database with file-based storage and index a source directory.
 *
 * This helper creates a temporary SQLite database file, initializes the schema,
 * and indexes the specified directory with the given language filters.
 * The database is persisted to a temporary file during indexing and can be
 * queried afterward.
 *
 * @param sourceDir The directory to index
 * @param languages Optional set of languages to index. If undefined, all languages are indexed.
 * @returns A Database instance containing the indexed data
 */
export async function createTestIndex(
  sourceDir: string,
  languages?: Set<SupportedLanguage>,
): Promise<Database> {
  // Create a unique temporary database path
  const randomId = randomBytes(8).toString('hex');
  const dbPath = `/tmp/bender-test-${randomId}.db`;
  
  // Index the directory (this creates and initializes the database)
  await indexDirectory(sourceDir, dbPath, undefined, languages);
  
  // Open the database to access the indexed data
  const db = initDatabase(dbPath);
  
  // Store the path for cleanup in the database object
  (db as any).__testDbPath = dbPath;
  
  return db;
}

/**
 * Get the count of indexed files grouped by language for a specific snapshot.
 *
 * Queries the files table to count how many files of each language are indexed
 * in the given snapshot.
 *
 * @param db The database instance
 * @param snapshotId The snapshot ID to query
 * @returns An object mapping language names to file counts (e.g., { typescript: 5, java: 3 })
 */
export function getFileCountByLanguage(
  db: Database,
  snapshotId: string,
): Record<string, number> {
  const query = db.prepare(
    "SELECT language, COUNT(*) as count FROM files WHERE snapshot_id = ? GROUP BY language",
  );
  const results = query.all(snapshotId) as Array<{ language: string; count: number }>;

  const counts: Record<string, number> = {};
  for (const row of results) {
    counts[row.language] = row.count;
  }

  return counts;
}

/**
 * Get the ID of the latest snapshot in the database.
 *
 * Queries the snapshots table for the snapshot marked as latest.
 *
 * @param db The database instance
 * @returns The ID of the latest snapshot
 * @throws Error if no latest snapshot exists
 */
export function getLatestSnapshotId(db: Database): string {
  const query = db.prepare("SELECT id FROM snapshots WHERE is_latest = 1 LIMIT 1");
  const result = query.get() as { id: string } | undefined;

  if (!result) {
    throw new Error("No latest snapshot found in database");
  }

  return result.id;
}

/**
 * Assert that only expected languages are indexed in the snapshot.
 *
 * Verifies that the indexed files contain only the expected languages and throws
 * a meaningful error if any unexpected languages are found.
 *
 * @param db The database instance
 * @param snapshotId The snapshot ID to verify
 * @param expectedLanguages Set of languages that should be indexed
 * @throws Error if unexpected languages are found in the index
 */
export function assertLanguagesIndexed(
  db: Database,
  snapshotId: string,
  expectedLanguages: Set<SupportedLanguage>,
): void {
  const counts = getFileCountByLanguage(db, snapshotId);
  const indexedLanguages = new Set(Object.keys(counts));

  for (const lang of indexedLanguages) {
    if (!expectedLanguages.has(lang as SupportedLanguage)) {
      throw new Error(
        `Unexpected language indexed: ${lang}. Expected: ${Array.from(expectedLanguages).join(", ")}`,
      );
    }
  }

  for (const expectedLang of expectedLanguages) {
    if (!indexedLanguages.has(expectedLang)) {
      throw new Error(
        `Expected language not indexed: ${expectedLang}. Found: ${Array.from(indexedLanguages).join(", ")}`,
      );
    }
  }
}
