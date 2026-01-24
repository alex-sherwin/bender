/**
 * Main indexing orchestration for scanning directories and indexing code.
 * @author GitHub Copilot
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Database } from "bun:sqlite";
import { initializeDatabase } from "./db/schema";
import { createSnapshot, replaceSnapshot } from "./db/snapshots";
import { insertDocument, insertSymbols, insertOccurrences, insertRelationships, insertDocumentations } from "./db/writer";
import { parseJavaFile } from "./parsers/java";
import { getCurrentBranch, getCurrentCommit } from "./git";
import { log } from "./logger";

/**
 * Options for indexing a directory.
 * @author GitHub Copilot
 */
export interface IndexOptions {
  /** Custom snapshot name (defaults to git branch or "default") */
  snapshotName?: string;
  /** Optional description for the snapshot */
  description?: string;
  /** If true, replace existing snapshot with same name */
  replace?: boolean;
  /** If true, log progress information */
  verbose?: boolean;
}

/**
 * Result of an indexing operation.
 * @author GitHub Copilot
 */
export interface IndexResult {
  /** Number of files successfully indexed */
  filesIndexed: number;
  /** Total number of symbols found */
  symbolsFound: number;
  /** ID of the created snapshot */
  snapshotId: number;
}

/**
 * Calculate SHA256 hash of file content.
 * @author GitHub Copilot
 * @param content File content to hash
 * @returns Hex-encoded SHA256 hash
 */
function calculateContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Recursively find all Java files in a directory.
 * @author GitHub Copilot
 * @param dirPath Directory to scan
 * @returns Array of absolute file paths
 */
async function findJavaFiles(dirPath: string): Promise<string[]> {
  const javaFiles: string[] = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories to ignore
        if (["node_modules", ".git", "build", "dist", "target"].includes(entry.name)) {
          continue;
        }
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".java")) {
        javaFiles.push(fullPath);
      }
    }
  }

  await walk(dirPath);
  return javaFiles;
}

/**
 * Index a single Java file and insert data into database.
 * @author GitHub Copilot
 * @param db Database instance
 * @param snapshotId Snapshot ID
 * @param filePath Absolute path to the file
 * @param sourceDir Source directory (for relative path calculation)
 * @param verbose Whether to log detailed progress
 * @returns Object with success status and symbol count
 */
async function indexFile(
  db: Database,
  snapshotId: number,
  filePath: string,
  sourceDir: string,
  verbose: boolean
): Promise<{ success: boolean; symbolCount: number }> {
  const relativePath = path.relative(sourceDir, filePath);
  
  try {
    // Read file content
    const content = await fs.readFile(filePath, "utf-8");
    const contentHash = calculateContentHash(content);

    // Parse the file
    const parseResult = await parseJavaFile(relativePath, content);

    // Use transaction for each file for atomicity
    const tx = db.transaction(() => {
      // Insert document
      const documentId = insertDocument(db, snapshotId, {
        path: relativePath,
        language: "java",
        content_hash: contentHash,
        indexed_at: new Date().toISOString(),
      });

      // Build map from qualified name to symbol ID
      const qualifiedNameToId = new Map<string, number>();

      // Insert symbols and build mapping
      const symbolIds: number[] = [];
      for (const symbol of parseResult.symbols) {
        // Map symbol kind to database schema
        let kind: "class" | "method" | "field" | "variable" | "parameter";
        if (symbol.kind === "class" || symbol.kind === "method" || symbol.kind === "field" || 
            symbol.kind === "variable" || symbol.kind === "parameter") {
          kind = symbol.kind;
        } else if (symbol.kind === "local_variable") {
          kind = "variable";
        } else {
          kind = "variable"; // fallback for unknown kinds
        }

        // First pass: insert symbols without parent references
        const symbolId = insertSymbols(db, snapshotId, [{
          qualified_name: symbol.qualifiedName,
          symbol_name: symbol.symbolName,
          kind,
          signature: symbol.signature ?? "",
          parent_symbol_id: undefined,
        }])[0];

        symbolIds.push(symbolId);
        qualifiedNameToId.set(symbol.qualifiedName, symbolId);
      }

      // Second pass: update parent references
      for (let i = 0; i < parseResult.symbols.length; i++) {
        const symbol = parseResult.symbols[i];
        if (symbol.parentSymbolId) {
          const parentId = qualifiedNameToId.get(symbol.parentSymbolId);
          if (parentId !== undefined) {
            const updateStmt = db.prepare("UPDATE symbols SET parent_symbol_id = ? WHERE id = ?");
            updateStmt.run(parentId, symbolIds[i]);
          }
        }
      }

      // Insert occurrences (map qualified names to symbol IDs)
      const occurrencesToInsert = parseResult.occurrences
        .map((occ) => {
          const symbolId = qualifiedNameToId.get(occ.symbolQualifiedName);
          if (symbolId === undefined) {
            if (verbose) {
              log.warn(`Symbol not found for occurrence: ${occ.symbolQualifiedName}`);
            }
            return null;
          }

          // Map role to database schema
          let role: "definition" | "reference" | "import";
          if (occ.role === "definition") {
            role = "definition";
          } else if (occ.role === "reference" || occ.role === "call") {
            role = "reference";
          } else {
            role = "reference"; // fallback
          }

          return {
            symbol_id: symbolId,
            document_id: documentId,
            role,
            start_line: occ.startLine,
            start_col: occ.startCol,
            end_line: occ.endLine,
            end_col: occ.endCol,
          };
        })
        .filter((occ) => occ !== null) as Array<{
          symbol_id: number;
          document_id: number;
          role: "definition" | "reference" | "import";
          start_line: number;
          start_col: number;
          end_line: number;
          end_col: number;
        }>;

      if (occurrencesToInsert.length > 0) {
        insertOccurrences(db, snapshotId, occurrencesToInsert);
      }

      // Insert relationships (map qualified names to symbol IDs)
      const relationshipsToInsert = parseResult.relationships
        .map((rel) => {
          const fromId = qualifiedNameToId.get(rel.fromQualifiedName);
          const toId = qualifiedNameToId.get(rel.toQualifiedName);

          if (fromId === undefined || toId === undefined) {
            if (verbose) {
              log.warn(`Skipping relationship: ${rel.fromQualifiedName} -> ${rel.toQualifiedName}`);
            }
            return null;
          }

          return {
            from_symbol_id: fromId,
            to_symbol_id: toId,
            kind: rel.kind,
          };
        })
        .filter((rel) => rel !== null) as Array<{
          from_symbol_id: number;
          to_symbol_id: number;
          kind: "extends" | "implements" | "calls" | "references" | "contains";
        }>;

      if (relationshipsToInsert.length > 0) {
        insertRelationships(db, snapshotId, relationshipsToInsert);
      }

      // Insert documentation (map qualified names to symbol IDs)
      const docsToInsert = parseResult.documentation
        .map((doc) => {
          const symbolId = qualifiedNameToId.get(doc.symbolQualifiedName);
          if (symbolId === undefined) {
            if (verbose) {
              log.warn(`Symbol not found for documentation: ${doc.symbolQualifiedName}`);
            }
            return null;
          }

          // Map doc type to database schema
          let docType: "javadoc" | "inline" | "block";
          if (doc.docType === "javadoc") {
            docType = "javadoc";
          } else if (doc.docType === "line_comment") {
            docType = "inline";
          } else if (doc.docType === "block_comment") {
            docType = "block";
          } else {
            docType = "block"; // fallback
          }

          return {
            symbol_id: symbolId,
            doc_type: docType,
            content: doc.content,
            start_line: doc.startLine,
          };
        })
        .filter((doc) => doc !== null) as Array<{
          symbol_id: number;
          doc_type: "javadoc" | "inline" | "block";
          content: string;
          start_line: number;
        }>;

      if (docsToInsert.length > 0) {
        insertDocumentations(db, docsToInsert);
      }

      return parseResult.symbols.length;
    });

    const symbolCount = tx();

    if (verbose) {
      log.info(`Indexed ${relativePath}: ${symbolCount} symbols`);
    }

    return { success: true, symbolCount };
  } catch (error) {
    log.error(`Error indexing file ${relativePath}:`, error);
    return { success: false, symbolCount: 0 }; // Continue with next file
  }
}

/**
 * Index a directory of Java files and store results in database.
 * @author GitHub Copilot
 * @param sourceDir Path to source directory to index
 * @param dbPath Path to SQLite database file
 * @param options Indexing options
 * @returns Index result with statistics
 */
export async function indexDirectory(
  sourceDir: string,
  dbPath: string,
  options: IndexOptions = {}
): Promise<IndexResult> {
  const { snapshotName, description, replace = false, verbose = false } = options;

  // Verify source directory exists
  try {
    const stats = await fs.stat(sourceDir);
    if (!stats.isDirectory()) {
      throw new Error(`Source path is not a directory: ${sourceDir}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("not a directory")) {
      throw error;
    }
    throw new Error(`Source directory does not exist: ${sourceDir}`);
  }

  // Initialize database
  const db = initializeDatabase(dbPath);

  // Determine snapshot name
  let finalSnapshotName = snapshotName;
  if (!finalSnapshotName) {
    const gitBranch = getCurrentBranch(sourceDir);
    finalSnapshotName = gitBranch ?? "default";
  }

  // Get git metadata
  const gitBranch = getCurrentBranch(sourceDir);
  const gitCommit = getCurrentCommit(sourceDir);

  if (verbose) {
    log.info(`Creating snapshot: ${finalSnapshotName}`);
    if (gitBranch) log.info(`Git branch: ${gitBranch}`);
    if (gitCommit) log.info(`Git commit: ${gitCommit}`);
  }

  // Handle replace mode
  if (replace) {
    replaceSnapshot(db, finalSnapshotName);
    if (verbose) {
      log.info(`Replaced existing snapshot: ${finalSnapshotName}`);
    }
  }

  // Create snapshot
  const snapshot = createSnapshot(db, finalSnapshotName, description, gitBranch ?? undefined, gitCommit ?? undefined);

  if (verbose) {
    log.info(`Snapshot created with ID: ${snapshot.id}`);
  }

  // Find all Java files
  const javaFiles = await findJavaFiles(sourceDir);

  if (verbose) {
    log.info(`Found ${javaFiles.length} Java files`);
  }

  // Index each file
  let filesIndexed = 0;
  let symbolsFound = 0;

  for (const filePath of javaFiles) {
    const result = await indexFile(db, snapshot.id, filePath, sourceDir, verbose);
    if (result.success) {
      filesIndexed++;
      symbolsFound += result.symbolCount;
    }
  }

  if (verbose) {
    log.info(`Indexing complete: ${filesIndexed} files, ${symbolsFound} symbols`);
  }

  db.close();

  return {
    filesIndexed,
    symbolsFound,
    snapshotId: snapshot.id,
  };
}
