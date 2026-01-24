/**
 * Test utilities for database and file cleanup
 * @author GitHub Copilot
 */

import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Clean up a SQLite database and its WAL and SHM companion files
 * @author GitHub Copilot
 */
export function cleanupDatabase(dbPath: string): void {
  const paths = [
    dbPath,
    `${dbPath}-wal`,
    `${dbPath}-shm`,
  ];

  for (const path of paths) {
    try {
      if (existsSync(path)) {
        unlinkSync(path);
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Get test database path in the tmp/ directory
 * @author GitHub Copilot
 */
export function getTestDbPath(testName: string): string {
  return join(import.meta.dir, "tmp", `${testName}-${Date.now()}-${Math.random()}.db`);
}
