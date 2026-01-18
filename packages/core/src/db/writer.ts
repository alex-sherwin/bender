import { Database } from "bun:sqlite";
import type { ParsedFileData } from "./types";
import { log } from "../logger";

export function writeParsedFile(db: Database, snapshotId: string, parsed: ParsedFileData): void {
  try {
    const tx = db.transaction(() => {
      // Insert file
      const fileInsert = db.prepare("INSERT INTO files (snapshot_id, path, language, package) VALUES (?, ?, ?, ?)");
      const fileResult = fileInsert.run(snapshotId, parsed.file.path, parsed.file.language, parsed.file.package || null);
      const fileId = fileResult.lastInsertRowid as number;

      // Insert symbols first with parent_id = null, build map
      const symbolMap = new Map<string, number>();
      const symbolInsert = db.prepare("INSERT INTO symbols (snapshot_id, file_id, parent_id, kind, name, qualified_name, signature, metadata) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)");

      for (const symbol of parsed.symbols) {
        const result = symbolInsert.run(
          snapshotId,
          fileId,
          symbol.kind,
          symbol.name,
          symbol.qualified_name,
          symbol.signature,
          symbol.metadata ? JSON.stringify(symbol.metadata) : null
        );
        const id = result.lastInsertRowid as number;
        symbolMap.set(symbol.qualified_name, id);
      }

      // Update parent_id for symbols that have parent
      const updateParent = db.prepare("UPDATE symbols SET parent_id = ? WHERE id = ?");
      for (const symbol of parsed.symbols) {
        if (symbol.parent) {
          const parentId = symbolMap.get(symbol.parent);
          const symbolId = symbolMap.get(symbol.qualified_name);
          if (parentId !== undefined && symbolId !== undefined) {
            updateParent.run(parentId, symbolId);
          } else {
            log.warn(`Cannot set parent for ${symbol.qualified_name}: parent ${symbol.parent} not found`);
          }
        }
      }

       // Insert references
       const referenceInsert = db.prepare("INSERT INTO \"references\" (snapshot_id, from_symbol_id, to_qualified_name, to_symbol_id, ref_kind) VALUES (?, ?, ?, ?, ?)");
       for (const ref of parsed.references) {
         const fromSymbolId = symbolMap.get(ref.from_qualified_name);
         if (!fromSymbolId) {
           log.warn(`Reference from unknown symbol: ${ref.from_qualified_name}`);
           continue;
         }
         
         // Skip references with undefined to_qualified_name
         if (!ref.to_qualified_name) {
           continue;
         }
         
         // Try to resolve to_symbol_id from current batch first, then from database
         let toSymbolId = symbolMap.get(ref.to_qualified_name);
         if (!toSymbolId) {
           // Look in database for existing symbols
           const toSymbol = db.prepare(
             "SELECT id FROM symbols WHERE snapshot_id = ? AND qualified_name = ?"
           ).get(snapshotId, ref.to_qualified_name) as { id: number } | undefined;
           toSymbolId = toSymbol?.id;
         }
         
         referenceInsert.run(snapshotId, fromSymbolId, ref.to_qualified_name, toSymbolId || null, ref.ref_kind);
       }

       // Insert imports
       const importInsert = db.prepare("INSERT INTO imports (snapshot_id, file_id, source_package, wildcard, imported_names) VALUES (?, ?, ?, ?, ?)");
       for (const imp of parsed.imports) {
         // Skip imports with undefined source_package
         if (!imp.source_package) {
           continue;
         }
         importInsert.run(snapshotId, fileId, imp.source_package, imp.wildcard ? 1 : 0, JSON.stringify(imp.imported_names));
       }
    });

    tx();
  } catch (error) {
    log.error(`Error writing parsed file ${parsed.file.path}:`, error);
    throw error;
  }
}