import { readdir, readFile } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';
import { Database } from "bun:sqlite";


import { initDatabase, createSnapshot } from './db/schema';
import { writeParsedFile } from './db/writer';
import { getParserForFile, detectLanguage } from './parsers';
import { log } from './logger';
import type { ParsedFileData as ParserParsedFileData } from './parsers/types';
import type { ParsedFileData as DbParsedFileData, SymbolData, ReferenceData, ImportData } from './db/types';

/**
 * Convert parser ParsedFileData to database ParsedFileData format
 * @author GitHub Copilot
 */
function convertParsedFileData(input: ParserParsedFileData, rootDir: string): DbParsedFileData {
  const relativePath = relative(rootDir, input.file.path);

  // Convert symbols
  const symbols: SymbolData[] = input.symbols.map((symbol: any) => {
    let qualified_name = symbol.qualified_name;
    let parent = symbol.parent;

    // Fix qualified names for TypeScript files to use relative paths
    if (input.file.language === 'typescript') {
      // Replace absolute path prefix with relative path
      const absolutePrefix = input.file.path.replace(/\.tsx?$/, '');
      const relativePrefix = relativePath.replace(/\.tsx?$/, '');
      if (qualified_name.startsWith(absolutePrefix)) {
        qualified_name = qualified_name.replace(absolutePrefix, relativePrefix + '.ts');
      }
      if (parent && parent.startsWith(absolutePrefix)) {
        parent = parent.replace(absolutePrefix, relativePrefix + '.ts');
      }
    }

    return {
      kind: symbol.kind,
      name: symbol.name,
      qualified_name,
      signature: symbol.signature,
      metadata: symbol.metadata,
      parent,
    };
  });

  // Convert references
  const references: ReferenceData[] = input.references.map((ref: any) => {
    let from_qualified_name = ref.from_qualified_name;
    let to_qualified_name = ref.to_qualified_name;

    // Fix qualified names for TypeScript files to use relative paths
    if (input.file.language === 'typescript') {
      // Replace absolute path prefix with relative path
      const absolutePrefix = input.file.path.replace(/\.tsx?$/, '');
      const relativePrefix = relativePath.replace(/\.tsx?$/, '');
      if (from_qualified_name && from_qualified_name.startsWith(absolutePrefix)) {
        from_qualified_name = from_qualified_name.replace(absolutePrefix, relativePrefix + '.ts');
      }
      if (to_qualified_name && to_qualified_name.startsWith(absolutePrefix)) {
        to_qualified_name = to_qualified_name.replace(absolutePrefix, relativePrefix + '.ts');
      }
    }

    return {
      from_qualified_name: from_qualified_name,
      to_qualified_name: to_qualified_name,
      ref_kind: ref.ref_kind,
    };
  });

  // Convert imports
  const imports: ImportData[] = input.imports.map((imp: any) => ({
    source_package: imp.source_package,
    wildcard: imp.wildcard,
    imported_names: imp.imported_names,
  }));

  return {
    file: {
      path: relative(rootDir, input.file.path),
      language: input.file.language,
      package: input.file.package,
    },
    symbols,
    references,
    imports,
  };
}

/**
 * Recursively find all supported files in a directory
 * @param dirPath Directory to scan
 * @returns Array of file paths
 * @author GitHub Copilot
 */
async function findSupportedFiles(dirPath: string): Promise<string[]> {
  const supportedExtensions = new Set(['.java', '.ts', '.tsx', '.cs', '.sh']);
  const files: string[] = [];

  async function scanDir(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip common directories that shouldn't be indexed
        if (!['node_modules', '.git', 'build', 'dist', 'target', '.next'].includes(entry.name)) {
          await scanDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (supportedExtensions.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await scanDir(dirPath);
  return files;
}

/**
 * Main indexing function
 * @param dirPath Directory to index
 * @param dbPath Path to SQLite database
 * @param description Optional snapshot description
 * @author GitHub Copilot
 */
export async function indexDirectory(dirPath: string, dbPath: string, description?: string): Promise<void> {
  log.info(`Starting indexing of directory: ${dirPath}`);

  // Initialize database and create snapshot
  const db = initDatabase(dbPath);
  const snapshotId = createSnapshot(db, description);
  log.info(`Created snapshot: ${snapshotId}`);

  // Find all supported files
  const files = await findSupportedFiles(dirPath);
  log.info(`Found ${files.length} supported files`);

  let indexedFiles = 0;
  let totalSymbols = 0;
  let totalReferences = 0;

  // Process each file
  for (const filePath of files) {
    try {
      log.debug(`Processing file: ${filePath}`);

      // Read file content
      const content = await readFile(filePath, 'utf-8');

      // Get parser for file
      const parser = await getParserForFile(filePath);
      if (!parser) {
        log.warn(`No parser found for file: ${filePath}`);
        continue;
      }

      // Parse file
      const parsedData: ParserParsedFileData = parser.parseFile(filePath, content);

      // Convert to database format
      const dbParsedData = convertParsedFileData(parsedData, dirPath);

      // Write to database
      writeParsedFile(db, snapshotId, dbParsedData);

      indexedFiles++;
      totalSymbols += dbParsedData.symbols.length;
      totalReferences += dbParsedData.references.length;

      log.debug(`Indexed ${relative(dirPath, filePath)}: ${dbParsedData.symbols.length} symbols, ${dbParsedData.references.length} references`);

    } catch (error) {
      log.error(`Failed to index file ${filePath}:`, error);
      // Continue with next file
    }
  }

  // Close database
  db.close();

  // Print summary
  log.info(`Indexing complete:`);
  log.info(`  Files indexed: ${indexedFiles}`);
  log.info(`  Symbols extracted: ${totalSymbols}`);
  log.info(`  References found: ${totalReferences}`);
  log.info(`  Snapshot ID: ${snapshotId}`);
}