import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from "bun:sqlite";


import { initDatabase, createSnapshot } from '../src/db/schema';
import { writeParsedFile } from '../src/db/writer';
import {
  getLatestSnapshot,
  findSymbol,
  findSymbolsByName,
  getBlastRadius,
  findReferences,
  getFileSymbols,
  searchSymbols,
} from '../src/db/queries';
import type { ParsedFileData } from '../src/db/types';

describe('Database Queries', () => {
  let db: Database;
  let snapshotId: string;

  beforeEach(() => {
    db = initDatabase(':memory:');
    snapshotId = createSnapshot(db, 'Test snapshot');

    // Insert test data
    const javaData: ParsedFileData = {
      file: {
        path: 'com/example/Calculator.java',
        language: 'java',
        package: 'com.example',
      },
      symbols: [
        {
          kind: 'class',
          name: 'Calculator',
          qualified_name: 'com.example.Calculator',
          signature: 'public class Calculator',
        },
        {
          kind: 'method',
          name: 'add',
          qualified_name: 'com.example.Calculator.add',
          signature: 'public int add(int a, int b)',
          parent: 'com.example.Calculator',
        },
        {
          kind: 'method',
          name: 'multiply',
          qualified_name: 'com.example.Calculator.multiply',
          signature: 'public int multiply(int a, int b)',
          parent: 'com.example.Calculator',
        },
      ],
      references: [
        {
          from_qualified_name: 'com.example.Calculator.add',
          to_qualified_name: 'com.example.Calculator.multiply',
          ref_kind: 'call',
        },
      ],
      imports: [],
    };

    const tsData: ParsedFileData = {
      file: {
        path: 'src/utils.ts',
        language: 'typescript',
      },
      symbols: [
        {
          kind: 'function',
          name: 'formatDate',
          qualified_name: 'src/utils.ts:formatDate',
          signature: 'export function formatDate(date: Date): string',
        },
        {
          kind: 'variable',
          name: 'PI',
          qualified_name: 'src/utils.ts:PI',
          signature: 'export const PI = 3.14159',
        },
      ],
      references: [
        {
          from_qualified_name: 'src/utils.ts:formatDate',
          to_qualified_name: 'Date',
          ref_kind: 'type_reference',
        },
      ],
      imports: [],
    };

    writeParsedFile(db, snapshotId, javaData);
    writeParsedFile(db, snapshotId, tsData);
  });

  afterEach(() => {
    db.close();
  });

  it('getLatestSnapshot returns the latest snapshot', () => {
    const latest = getLatestSnapshot(db);
    expect(latest).toBe(snapshotId);
  });

  it('findSymbol finds symbol by qualified name', () => {
    const symbol = findSymbol(db, snapshotId, 'com.example.Calculator');
    expect(symbol).not.toBeNull();
    expect(symbol!.name).toBe('Calculator');
    expect(symbol!.kind).toBe('class');

    const notFound = findSymbol(db, snapshotId, 'nonexistent.Symbol');
    expect(notFound).toBeNull();
  });

  it('findSymbolsByName finds symbols by name across files', () => {
    const symbols = findSymbolsByName(db, snapshotId, 'add');
    expect(symbols).toHaveLength(1);
    expect(symbols[0].qualified_name).toBe('com.example.Calculator.add');

    // Test with multiple matches
    // Add another 'add' method
    const extraData: ParsedFileData = {
      file: {
        path: 'com/example/AdvancedCalculator.java',
        language: 'java',
        package: 'com.example',
      },
      symbols: [
        {
          kind: 'method',
          name: 'add',
          qualified_name: 'com.example.AdvancedCalculator.add',
          signature: 'public double add(double a, double b)',
        },
      ],
      references: [],
      imports: [],
    };
    writeParsedFile(db, snapshotId, extraData);

    const addSymbols = findSymbolsByName(db, snapshotId, 'add');
    expect(addSymbols).toHaveLength(2);
  });

  it('getBlastRadius calculates call graph', () => {
    // Create a more complex call graph
    const serviceData: ParsedFileData = {
      file: {
        path: 'com/example/MathService.java',
        language: 'java',
        package: 'com.example',
      },
      symbols: [
        {
          kind: 'class',
          name: 'MathService',
          qualified_name: 'com.example.MathService',
          signature: 'public class MathService',
        },
        {
          kind: 'method',
          name: 'calculate',
          qualified_name: 'com.example.MathService.calculate',
          signature: 'public int calculate()',
          parent: 'com.example.MathService',
        },
        {
          kind: 'method',
          name: 'helper',
          qualified_name: 'com.example.MathService.helper',
          signature: 'private int helper()',
          parent: 'com.example.MathService',
        },
        {
          kind: 'method',
          name: 'deepHelper',
          qualified_name: 'com.example.MathService.deepHelper',
          signature: 'private int deepHelper()',
          parent: 'com.example.MathService',
        },
      ],
      references: [
        {
          from_qualified_name: 'com.example.MathService.calculate',
          to_qualified_name: 'com.example.MathService.helper',
          ref_kind: 'call',
        },
        {
          from_qualified_name: 'com.example.MathService.helper',
          to_qualified_name: 'com.example.MathService.deepHelper',
          ref_kind: 'call',
        },
        {
          from_qualified_name: 'com.example.MathService.calculate',
          to_qualified_name: 'com.example.Calculator.add',
          ref_kind: 'call',
        },
      ],
      imports: [],
    };

    writeParsedFile(db, snapshotId, serviceData);

    const blastRadius = getBlastRadius(db, snapshotId, 'com.example.MathService.calculate', 3);

    // Should include the method itself, helper, deepHelper, and Calculator.add
    expect(blastRadius.length).toBeGreaterThan(1);
    const names = blastRadius.map(r => r.qualified_name);
    expect(names).toContain('com.example.MathService.calculate');
    expect(names).toContain('com.example.MathService.helper');
    expect(names).toContain('com.example.MathService.deepHelper');
    expect(names).toContain('com.example.Calculator.add');
  });

  it('findReferences finds all usages of a symbol', () => {
    const references = findReferences(db, snapshotId, 'com.example.Calculator.multiply');
    expect(references).toHaveLength(1);
    expect(references[0].ref_kind).toBe('call');

    // Add more references
    const extraData: ParsedFileData = {
      file: {
        path: 'com/example/Client.java',
        language: 'java',
        package: 'com.example',
      },
      symbols: [
        {
          kind: 'method',
          name: 'useCalculator',
          qualified_name: 'com.example.Client.useCalculator',
          signature: 'public void useCalculator()',
        },
      ],
      references: [
        {
          from_qualified_name: 'com.example.Client.useCalculator',
          to_qualified_name: 'com.example.Calculator.multiply',
          ref_kind: 'call',
        },
        {
          from_qualified_name: 'com.example.Client.useCalculator',
          to_qualified_name: 'com.example.Calculator',
          ref_kind: 'type_reference',
        },
      ],
      imports: [],
    };

    writeParsedFile(db, snapshotId, extraData);

    const allReferences = findReferences(db, snapshotId, 'com.example.Calculator.multiply');
    expect(allReferences).toHaveLength(2);
    expect(allReferences.map(r => r.ref_kind)).toEqual(['call', 'call']);
  });

  it('getFileSymbols returns all symbols in a file', () => {
    const symbols = getFileSymbols(db, snapshotId, 'com/example/Calculator.java');
    expect(symbols).toHaveLength(3);
    expect(symbols.map(s => s.name)).toEqual(['Calculator', 'add', 'multiply']);
    expect(symbols.map(s => s.kind)).toEqual(['class', 'method', 'method']);
  });

  it('searchSymbols performs wildcard search', () => {
    const results = searchSymbols(db, snapshotId, 'add');
    expect(results.length).toBeGreaterThanOrEqual(1);

    // Test partial match
    const partialResults = searchSymbols(db, snapshotId, 'Calc');
    expect(partialResults.length).toBeGreaterThanOrEqual(2); // Calculator class and MathService.calculate

    // Test case insensitive
    const caseResults = searchSymbols(db, snapshotId, 'FORMAT');
    expect(caseResults).toHaveLength(1);
    expect(caseResults[0].qualified_name).toBe('src/utils.ts:formatDate');
  });

  it('handles non-existent snapshot', () => {
    const latest = getLatestSnapshot(db);
    expect(latest).not.toBe('nonexistent-snapshot');

    const symbol = findSymbol(db, 'nonexistent-snapshot', 'any.symbol');
    expect(symbol).toBeNull();
  });
});