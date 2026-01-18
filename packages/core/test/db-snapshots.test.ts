import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from "bun:sqlite";


import { initDatabase, createSnapshot } from '../src/db/schema';
import { writeParsedFile } from '../src/db/writer';
import {
  listSnapshots,
  compareSnapshots,
  deleteSnapshot,
  setLatestSnapshot,
  getSnapshotStats,
} from '../src/db/snapshots';
import type { ParsedFileData } from '../src/db/types';

describe('Database Snapshots', () => {
  let db: Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('listSnapshots returns all snapshots with symbol counts', () => {
    // Create first snapshot
    const snapshot1 = createSnapshot(db, 'First snapshot');
    const parsedData1: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' },
        { kind: 'method', name: 'method1', qualified_name: 'Test.method1', signature: 'void method1()', parent: 'Test' },
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshot1, parsedData1);

    // Create second snapshot
    const snapshot2 = createSnapshot(db, 'Second snapshot');
    const parsedData2: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' },
        { kind: 'method', name: 'method1', qualified_name: 'Test.method1', signature: 'void method1()', parent: 'Test' },
        { kind: 'method', name: 'method2', qualified_name: 'Test.method2', signature: 'void method2()', parent: 'Test' },
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshot2, parsedData2);

    const snapshots = listSnapshots(db);
    expect(snapshots).toHaveLength(2);
    expect(snapshots[0].symbolCount).toBe(3); // Latest snapshot (snapshot2)
    expect(snapshots[1].symbolCount).toBe(2); // Older snapshot (snapshot1)
    expect(snapshots[0].is_latest).toBe(1);
    expect(snapshots[1].is_latest).toBe(0);
  });

  it('compareSnapshots shows differences between snapshots', () => {
    // Create first snapshot
    const snapshot1 = createSnapshot(db, 'Original');
    const parsedData1: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' },
        { kind: 'method', name: 'oldMethod', qualified_name: 'Test.oldMethod', signature: 'void oldMethod()', parent: 'Test' },
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshot1, parsedData1);

    // Create second snapshot with changes
    const snapshot2 = createSnapshot(db, 'Modified');
    const parsedData2: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' }, // Same
        { kind: 'method', name: 'newMethod', qualified_name: 'Test.newMethod', signature: 'void newMethod()', parent: 'Test' }, // Added
        { kind: 'method', name: 'modifiedMethod', qualified_name: 'Test.modifiedMethod', signature: 'int modifiedMethod()', parent: 'Test' }, // Modified (different signature)
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshot2, parsedData2);

    const comparison = compareSnapshots(db, snapshot1, snapshot2);

    expect(comparison.addedSymbols).toHaveLength(2); // newMethod and modifiedMethod (since signature changed)
    expect(comparison.removedSymbols).toHaveLength(1); // oldMethod
    expect(comparison.modifiedSymbols).toHaveLength(0); // Since we compare by qualified_name, and modifiedMethod is "new"

    const addedNames = comparison.addedSymbols.map(s => s.name);
    expect(addedNames).toEqual(expect.arrayContaining(['newMethod', 'modifiedMethod']));

    const removedNames = comparison.removedSymbols.map(s => s.name);
    expect(removedNames).toEqual(['oldMethod']);
  });

  it('deleteSnapshot removes snapshot and cascades', () => {
    const snapshot1 = createSnapshot(db, 'To be deleted');
    const parsedData: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' },
      ],
      references: [
        { from_qualified_name: 'Test', to_qualified_name: 'String', ref_kind: 'type_reference' },
      ],
       imports: [
         { source_package: 'java.util', wildcard: true, imported_names: [] },
       ],
    };
    writeParsedFile(db, snapshot1, parsedData);

    const snapshot2 = createSnapshot(db, 'Will remain');

    // Verify data exists
    let snapshots = listSnapshots(db);
    expect(snapshots).toHaveLength(2);

    let files = db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
    expect(files.count).toBe(1);

    let symbols = db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number };
    expect(symbols.count).toBe(1);

    // Delete snapshot1
    deleteSnapshot(db, snapshot1);

    // Verify data was removed
    snapshots = listSnapshots(db);
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe(snapshot2);

    files = db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
    expect(files.count).toBe(0);

    symbols = db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number };
    expect(symbols.count).toBe(0);
  });

  it('setLatestSnapshot changes which snapshot is latest', () => {
    const snapshot1 = createSnapshot(db, 'First');
    const snapshot2 = createSnapshot(db, 'Second');
    const snapshot3 = createSnapshot(db, 'Third');

    // Initially, snapshot3 should be latest
    let snapshots = listSnapshots(db);
    expect(snapshots[0].id).toBe(snapshot3);
    expect(snapshots[0].is_latest).toBe(1);
    expect(snapshots[1].is_latest).toBe(0);
    expect(snapshots[2].is_latest).toBe(0);

    // Set snapshot1 as latest
    setLatestSnapshot(db, snapshot1);

    snapshots = listSnapshots(db);
    expect(snapshots.find(s => s.id === snapshot1)?.is_latest).toBe(1);
    expect(snapshots.filter(s => s.id !== snapshot1).every(s => s.is_latest === 0)).toBe(true);
  });

  it('getSnapshotStats returns correct statistics', () => {
    const snapshot = createSnapshot(db, 'Stats test');
    const parsedData: ParsedFileData = {
      file: { path: 'com/example/Test.java', language: 'java', package: 'com.example' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'com.example.Test', signature: 'public class Test' },
        { kind: 'method', name: 'method1', qualified_name: 'com.example.Test.method1', signature: 'public void method1()', parent: 'com.example.Test' },
        { kind: 'field', name: 'field1', qualified_name: 'com.example.Test.field1', signature: 'private int field1', parent: 'com.example.Test' },
      ],
      references: [
        { from_qualified_name: 'com.example.Test.method1', to_qualified_name: 'com.example.Test.field1', ref_kind: 'field_access' },
        { from_qualified_name: 'com.example.Test.method1', to_qualified_name: 'System.out.println', ref_kind: 'call' },
      ],
      imports: [
        { source_package: 'java.util.List', wildcard: false, _names: ['List'] },
        { source_package: 'java.io', wildcard: true, _names: [] },
      ],
    };
    writeParsedFile(db, snapshot, parsedData);

    const stats = getSnapshotStats(db, snapshot);

    expect(stats.fileCount).toBe(1);
    expect(stats.symbolCount).toBe(3);
    expect(stats.referenceCount).toBe(2);
    expect(stats.importCount).toBe(2);
  });

  it('snapshot isolation prevents cross-snapshot data access', () => {
    const snapshot1 = createSnapshot(db, 'Snapshot 1');
    const parsedData1: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' },
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshot1, parsedData1);

    const snapshot2 = createSnapshot(db, 'Snapshot 2');
    const parsedData2: ParsedFileData = {
      file: { path: 'Test.java', language: 'java' },
      symbols: [
        { kind: 'class', name: 'Test', qualified_name: 'Test', signature: 'class Test' },
        { kind: 'method', name: 'newMethod', qualified_name: 'Test.newMethod', signature: 'void newMethod()', parent: 'Test' },
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshot2, parsedData2);

    // Query snapshot1 - should only see original data
    const symbols1 = db.prepare('SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?').get(snapshot1) as { count: number };
    expect(symbols1.count).toBe(1);

    // Query snapshot2 - should see new data
    const symbols2 = db.prepare('SELECT COUNT(*) as count FROM symbols WHERE snapshot_id = ?').get(snapshot2) as { count: number };
    expect(symbols2.count).toBe(2);

    // Compare snapshots
    const comparison = compareSnapshots(db, snapshot1, snapshot2);
    expect(comparison.addedSymbols).toHaveLength(1);
    expect(comparison.addedSymbols[0].name).toBe('newMethod');
    expect(comparison.removedSymbols).toHaveLength(0);
  });
});