import { Parser, Node, Tree } from 'web-tree-sitter';

import { initTreeSitter, loadParser, walkAST, getLocation, findFirstNodeOfType, getBlockComment } from './base';
import type { LanguageParser, ParsedFileData, SymbolData, ReferenceData, ImportData } from './types';

export class JavaParser implements LanguageParser {
  private parser: Parser | null = null;

  async initialize(): Promise<void> {
    if (!this.parser) {
      await initTreeSitter();
      const language = await loadParser('java', 'public/tree-sitter-java.wasm');
      this.parser = new Parser();
      this.parser.setLanguage(language);
    }
  }

  parseFile(filePath: string, content: string): ParsedFileData {
    if (!this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    const tree = this.parser.parse(content);
    if (!tree) {
      throw new Error('Failed to parse file');
    }

    const pkg = this.getPackage(tree);
    const symbols = this.extractSymbols(tree, pkg);
    const references = this.extractReferences(tree, symbols);
    const imports = this.extractImports(tree);

    return {
      file: {
        path: filePath,
        language: 'java',
        package: pkg,
      },
      symbols,
      references,
      imports,
    };
  }

  private getPackage(tree: Tree): string | undefined {
    const packageNode = findFirstNodeOfType(tree, 'package_declaration');
    if (!packageNode) return undefined;

    const scopedId = findFirstNodeOfType(packageNode, 'scoped_identifier');
    return scopedId?.text;
  }

  private extractSymbols(tree: Tree, pkg?: string): SymbolData[] {
    const symbols: SymbolData[] = [];
    const packagePrefix = pkg ? `${pkg}.` : '';

    walkAST(tree.rootNode, (node) => {
      if (node.type === 'class_declaration' || node.type === 'interface_declaration') {
        const classSymbol = this.extractClassSymbol(node, packagePrefix);
        if (classSymbol) {
          symbols.push(classSymbol);

           // Extract methods and fields from this class
           const methods = this.extractMethods(node, classSymbol.qualified_name);
           const fields = this.extractFields(node, classSymbol.qualified_name);

          symbols.push(...methods, ...fields);
        }
      } else if (node.type === 'method_declaration') {
        // Check if this is a top-level method (not inside a class)
        let isInClass = false;
        let current = node.parent;
        while (current) {
          if (current.type === 'class_declaration' || current.type === 'interface_declaration') {
            isInClass = true;
            break;
          }
          current = current.parent;
        }
        if (!isInClass) {
          const methodSymbol = this.extractMethodSymbol(node, packagePrefix);
          if (methodSymbol) symbols.push(methodSymbol);
        }
      } else if (node.type === 'field_declaration') {
        // Check if this is a top-level field (not inside a class)
        let isInClass = false;
        let current = node.parent;
        while (current) {
          if (current.type === 'class_declaration' || current.type === 'interface_declaration') {
            isInClass = true;
            break;
          }
          current = current.parent;
        }
        if (!isInClass) {
          const fieldSymbols = this.extractFieldSymbols(node, packagePrefix);
          symbols.push(...fieldSymbols);
        }
      }
    });

    return symbols;
  }

   private extractClassSymbol(node: Node, packagePrefix: string): SymbolData | null {
     const nameNode = node.childForFieldName('name');
     if (!nameNode) return null;

     const name = nameNode.text;
     const qualified_name = `${packagePrefix}${name}`;
     const comment = getBlockComment(node);

     return {
       kind: node.type === 'class_declaration' ? 'class' : 'interface',
       name,
       qualified_name,
       signature: node.text,
       location: getLocation(node),
       metadata: {
         comment,
       },
     };
   }

  private extractMethods(classNode: Node, classQualifiedName: string): SymbolData[] {
    const methods: SymbolData[] = [];
    const methodNodes = classNode.descendantsOfType('method_declaration');

    for (const methodNode of methodNodes) {
      const methodSymbol = this.extractMethodSymbol(methodNode, classQualifiedName);
      if (methodSymbol) methods.push(methodSymbol);
    }

    return methods;
  }

   private extractMethodSymbol(methodNode: Node, parentQualifiedName: string): SymbolData | null {
     const nameNode = methodNode.childForFieldName('name');
     if (!nameNode) return null;

     const name = nameNode.text;
     const qualified_name = `${parentQualifiedName}.${name}`;

     // Extract metadata
     const returnType = methodNode.childForFieldName('type')?.text ?? 'void';
     const parameters = this.extractMethodParameters(methodNode);
     const modifiers = this.extractModifiers(methodNode);
     const comment = getBlockComment(methodNode);

     return {
       kind: 'method',
       name,
       qualified_name,
       signature: methodNode.text,
       location: getLocation(methodNode),
       parent: parentQualifiedName,
       metadata: {
         returnType,
         parameters,
         modifiers,
         comment,
       },
     };
   }

  private extractFields(classNode: Node, classQualifiedName: string): SymbolData[] {
    const fields: SymbolData[] = [];
    const fieldNodes = classNode.descendantsOfType('field_declaration');

    for (const fieldNode of fieldNodes) {
      const fieldSymbols = this.extractFieldSymbols(fieldNode, classQualifiedName);
      fields.push(...fieldSymbols);
    }

    return fields;
  }

   private extractFieldSymbols(fieldNode: Node, parentQualifiedName: string): SymbolData[] {
     const symbols: SymbolData[] = [];
     const typeNode = fieldNode.childForFieldName('type');
     if (!typeNode) return symbols;

     const fieldType = typeNode.text;
     const declarators = fieldNode.descendantsOfType('variable_declarator');
     const modifiers = this.extractModifiers(fieldNode);

     for (const declarator of declarators) {
       const nameNode = declarator.childForFieldName('name');
       if (nameNode) {
         const name = nameNode.text;
         const qualified_name = `${parentQualifiedName}.${name}`;

         symbols.push({
           kind: 'field',
           name,
           qualified_name,
           signature: declarator.text,
           location: getLocation(declarator),
           parent: parentQualifiedName,
           metadata: {
             type: fieldType,
             modifiers,
           },
         });
       }
     }

     return symbols;
   }

  private extractMethodParameters(methodNode: Node): Array<{ name: string; type: string }> {
    const parameters: Array<{ name: string; type: string }> = [];
    const paramList = methodNode.childForFieldName('parameters');
    if (!paramList) return parameters;

    const formalParams = paramList.descendantsOfType('formal_parameter');
    for (const param of formalParams) {
      const typeNode = param.childForFieldName('type');
      const nameNode = param.childForFieldName('name');
      if (typeNode && nameNode) {
        parameters.push({
          name: nameNode.text,
          type: typeNode.text,
        });
      }
    }

    return parameters;
  }

  private extractModifiers(node: Node): string[] {
    const modifiers: string[] = [];
    const modifierNodes = node.descendantsOfType('modifier');
    for (const mod of modifierNodes) {
      modifiers.push(mod.text);
    }
    return modifiers;
  }

   private extractReferences(tree: Tree, symbols: SymbolData[]): ReferenceData[] {
     const references: ReferenceData[] = [];
     const symbolMap = new Map(symbols.map(s => [s.qualified_name, s]));

     // Track current symbol context
     const symbolStack: SymbolData[] = [];

     walkAST(tree.rootNode, (node) => {
       // Update symbol context
       if (node.type === 'class_declaration' || node.type === 'interface_declaration') {
         const className = node.childForFieldName('name')?.text;
         if (className) {
           const qualified_name = this.getPackage(tree) ? `${this.getPackage(tree)}.${className}` : className;
           const symbol = symbols.find(s => s.qualified_name === qualified_name);
           if (symbol) {
             symbolStack.push(symbol);
           }
         }
       } else if (node.type === 'method_declaration') {
         const methodName = node.childForFieldName('name')?.text;
         if (methodName && symbolStack.length > 0) {
           const parentSymbol = symbolStack[symbolStack.length - 1];
           const qualified_name = `${parentSymbol.qualified_name}.${methodName}`;
           const symbol = symbols.find(s => s.qualified_name === qualified_name);
           if (symbol) {
             symbolStack.push(symbol);
           }
         }
       }

       // Extract references
       if (node.type === 'method_invocation') {
         const ref = this.extractMethodCallReference(node, symbolMap, symbolStack);
         if (ref) references.push(ref);
       } else if (node.type === 'field_access') {
         const ref = this.extractFieldAccessReference(node, symbolMap, symbolStack);
         if (ref) references.push(ref);
       } else if (node.type === 'type_identifier' || node.type === 'scoped_identifier') {
         const ref = this.extractTypeReference(node, symbolMap, symbolStack);
         if (ref) references.push(ref);
       }

       // Pop symbol context when leaving
       if ((node.type === 'class_declaration' || node.type === 'interface_declaration' || node.type === 'method_declaration') && symbolStack.length > 0) {
         // Check if we're leaving this symbol's scope
         const currentSymbol = symbolStack[symbolStack.length - 1];
         if (currentSymbol.location.end.line === node.endPosition.row &&
             currentSymbol.location.end.column === node.endPosition.column) {
           symbolStack.pop();
         }
       }
     });

     return references;
   }

   private extractMethodCallReference(node: Node, symbolMap: Map<string, SymbolData>, symbolStack: SymbolData[]): ReferenceData | null {
     // This is complex - we'd need to resolve the method being called
     // For now, create a reference with best-effort qualified name
     const methodName = node.childForFieldName('name')?.text;
     if (!methodName) return null;

     // Try to build qualified name from context
     let qualified_name = methodName;
     // TODO: Implement proper method resolution

     const from_qualified_name = symbolStack.length > 0 ? symbolStack[symbolStack.length - 1].qualified_name : '';

     return {
       from_qualified_name,
       to_qualified_name: symbolMap.has(qualified_name) ? qualified_name : undefined,
       ref_kind: 'call',
       location: getLocation(node),
     };
   }

   private extractFieldAccessReference(node: Node, symbolMap: Map<string, SymbolData>, symbolStack: SymbolData[]): ReferenceData | null {
     const fieldName = node.childForFieldName('field')?.text;
     if (!fieldName) return null;

     let qualified_name = fieldName;
     // TODO: Implement proper field resolution

     const from_qualified_name = symbolStack.length > 0 ? symbolStack[symbolStack.length - 1].qualified_name : '';

     return {
       from_qualified_name,
       to_qualified_name: symbolMap.has(qualified_name) ? qualified_name : undefined,
       ref_kind: 'field_access',
       location: getLocation(node),
     };
   }

   private extractTypeReference(node: Node, symbolMap: Map<string, SymbolData>, symbolStack: SymbolData[]): ReferenceData | null {
     const typeName = node.text;
     if (!typeName || this.isPrimitiveType(typeName)) return null;

     const from_qualified_name = symbolStack.length > 0 ? symbolStack[symbolStack.length - 1].qualified_name : '';

     return {
       from_qualified_name,
       to_qualified_name: symbolMap.has(typeName) ? typeName : undefined,
       ref_kind: 'type_reference',
       location: getLocation(node),
     };
   }

  private extractImports(tree: Tree): ImportData[] {
    const imports: ImportData[] = [];
    const importNodes = tree.rootNode.descendantsOfType('import_declaration');

    for (const importNode of importNodes) {
      const importData = this.extractImport(importNode);
      if (importData) imports.push(importData);
    }

    return imports;
  }

   private extractImport(importNode: Node): ImportData | null {
     const scopedId = findFirstNodeOfType(importNode, 'scoped_identifier');
     if (!scopedId) return null;

     const fullImport = scopedId.text;
     const asterisk = findFirstNodeOfType(importNode, 'asterisk') !== null;

     let source_package: string;
     let imported_names: string[];

     if (asterisk) {
       source_package = fullImport;
       imported_names = [];
     } else {
       const lastDot = fullImport.lastIndexOf('.');
       source_package = fullImport.substring(0, lastDot);
       imported_names = [fullImport.substring(lastDot + 1)];
     }

     return {
       source_package,
       imported_names,
       wildcard: asterisk,
       location: getLocation(importNode),
     };
   }

  private isPrimitiveType(typeName: string): boolean {
    const primitives = new Set(['boolean', 'byte', 'char', 'short', 'int', 'long', 'float', 'double', 'void']);
    return primitives.has(typeName);
  }

  private findEnclosingSymbol(node: Node, locationToSymbol: Map<string, string>): string | null {
    const refStartLine = node.startPosition.row;
    const refStartCol = node.startPosition.column;

    let innermostSymbol: string | null = null;
    let smallestRange = Infinity;

    // Find the innermost symbol that contains this reference
    for (const [key, symbol] of locationToSymbol) {
      const [startLine, startCol, endLine, endCol] = key.split('-').map(Number);
      if (refStartLine > startLine || (refStartLine === startLine && refStartCol >= startCol)) {
        if (refStartLine < endLine || (refStartLine === endLine && refStartCol <= endCol)) {
          // Calculate range size to find the most specific (innermost) symbol
          const rangeSize = (endLine - startLine) + (endCol - startCol);
          if (rangeSize < smallestRange) {
            smallestRange = rangeSize;
            innermostSymbol = symbol;
          }
        }
      }
    }

    return innermostSymbol;
  }
}