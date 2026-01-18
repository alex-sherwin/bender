import { Parser, Node, Tree } from 'web-tree-sitter';

import { initTreeSitter, loadParser, walkAST, getLocation, getBlockComment } from './base';
import type { LanguageParser, ParsedFileData, SymbolData, ReferenceData, ImportData } from './types';

export class TypeScriptParser implements LanguageParser {
  private parser: Parser | null = null;
  private currentFilePath: string = '';

  async initialize(): Promise<void> {
    if (!this.parser) {
      await initTreeSitter();
      const language = await loadParser('typescript', 'public/tree-sitter-typescript.wasm');
      this.parser = new Parser();
      this.parser.setLanguage(language);
    }
  }

  parseFile(filePath: string, content: string): ParsedFileData {
    this.currentFilePath = filePath;
    if (!this.parser) {
      throw new Error('Parser not initialized. Call initialize() first.');
    }

    const tree = this.parser.parse(content);
    if (!tree) {
      throw new Error('Failed to parse file');
    }

    const symbols = this.extractSymbols(tree, filePath);
    const references = this.extractReferences(tree, symbols);
    const imports = this.extractImports(tree);

    return {
      file: {
        path: filePath,
        language: 'typescript',
      },
      symbols,
      references,
      imports,
    };
  }

  private extractSymbols(tree: Tree, filePath: string): SymbolData[] {
    const symbols: SymbolData[] = [];
    const filePrefix = filePath.replace(/\.tsx?$/, '');

    walkAST(tree.rootNode, (node) => {
      if (node.type === 'interface_declaration') {
        const interfaceSymbol = this.extractInterfaceSymbol(node, filePrefix);
        if (interfaceSymbol) {
          symbols.push(interfaceSymbol);
          // Add interface members as separate symbols
          const members = this.extractInterfaceMembers(node, interfaceSymbol.qualified_name);
          symbols.push(...members);
        }
      } else if (node.type === 'type_alias_declaration') {
        const typeSymbol = this.extractTypeSymbol(node, filePrefix);
        if (typeSymbol) symbols.push(typeSymbol);
      } else if (node.type === 'class_declaration') {
        const classSymbol = this.extractClassSymbol(node, filePrefix);
        if (classSymbol) {
          symbols.push(classSymbol);
          // Add class members
          const methods = this.extractClassMethods(node, classSymbol.qualified_name);
          const properties = this.extractClassProperties(node, classSymbol.qualified_name);
          symbols.push(...methods, ...properties);
        }
      } else if (node.type === 'function_declaration') {
        const funcSymbol = this.extractFunctionSymbol(node, filePrefix);
        if (funcSymbol) symbols.push(funcSymbol);
      } else if (node.type === 'variable_declaration' || node.type === 'lexical_declaration') {
        const varSymbols = this.extractVariableSymbols(node, filePrefix);
        symbols.push(...varSymbols);
      }
    });

    return symbols;
  }

  private extractInterfaceSymbol(node: Node, filePrefix: string): SymbolData | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualified_name = `${filePrefix}:${name}`;
    const comment = getBlockComment(node);

    return {
      kind: 'interface',
      name,
      qualified_name,
      signature: node.text,
      location: getLocation(node),
      metadata: {
        comment,
      },
    };
  }

  private extractInterfaceMembers(interfaceNode: Node, interfaceQualifiedName: string): SymbolData[] {
    const members: SymbolData[] = [];
    const bodyNode = interfaceNode.childForFieldName('body');
    if (!bodyNode) return members;

    const propertySignatures = bodyNode.descendantsOfType('property_signature');
    const methodSignatures = bodyNode.descendantsOfType('method_signature');

    for (const propNode of propertySignatures) {
      const memberSymbol = this.extractInterfaceMember(propNode, interfaceQualifiedName, 'property');
      if (memberSymbol) members.push(memberSymbol);
    }

    for (const methodNode of methodSignatures) {
      const memberSymbol = this.extractInterfaceMember(methodNode, interfaceQualifiedName, 'method');
      if (memberSymbol) members.push(memberSymbol);
    }

    return members;
  }

  private extractInterfaceMember(memberNode: Node, parentQualifiedName: string, kind: string): SymbolData | null {
    const nameNode = memberNode.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualified_name = `${parentQualifiedName}.${name}`;
    const typeNode = memberNode.childForFieldName('type');
    const type = typeNode?.text ?? 'any';
    const optional = memberNode.text.includes('?');

    return {
      kind,
      name,
      qualified_name,
      signature: memberNode.text,
      location: getLocation(memberNode),
      parent: parentQualifiedName,
      metadata: {
        type,
        optional,
      },
    };
  }

  private extractTypeSymbol(node: Node, filePrefix: string): SymbolData | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualified_name = `${filePrefix}:${name}`;
    const comment = getBlockComment(node);

    return {
      kind: 'type',
      name,
      qualified_name,
      signature: node.text,
      location: getLocation(node),
      metadata: {
        comment,
      },
    };
  }

  private extractClassSymbol(node: Node, filePrefix: string): SymbolData | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualified_name = `${filePrefix}:${name}`;
    const comment = getBlockComment(node);

    return {
      kind: 'class',
      name,
      qualified_name,
      signature: node.text,
      location: getLocation(node),
      metadata: {
        comment,
      },
    };
  }

  private extractClassMethods(classNode: Node, classQualifiedName: string): SymbolData[] {
    const methods: SymbolData[] = [];
    const methodNodes = classNode.descendantsOfType('method_definition');

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
    const parameters = this.extractFunctionParameters(methodNode);
    const returnType = methodNode.childForFieldName('return_type')?.text ?? 'void';
    const comment = getBlockComment(methodNode);

    return {
      kind: 'method',
      name,
      qualified_name,
      signature: methodNode.text,
      location: getLocation(methodNode),
      parent: parentQualifiedName,
      metadata: {
        parameters,
        returnType,
        comment,
      },
    };
  }

  private extractClassProperties(classNode: Node, classQualifiedName: string): SymbolData[] {
    const properties: SymbolData[] = [];
    const propertyNodes = [
      ...classNode.descendantsOfType('public_field_definition'),
      ...classNode.descendantsOfType('private_property_definition'),
    ];

    for (const propNode of propertyNodes) {
      const propSymbol = this.extractPropertySymbol(propNode, classQualifiedName);
      if (propSymbol) properties.push(propSymbol);
    }

    return properties;
  }

  private extractPropertySymbol(propNode: Node, parentQualifiedName: string): SymbolData | null {
    const nameNode = propNode.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualified_name = `${parentQualifiedName}.${name}`;
    const typeNode = propNode.childForFieldName('type');
    const type = typeNode?.text ?? 'any';

    return {
      kind: 'property',
      name,
      qualified_name,
      signature: propNode.text,
      location: getLocation(propNode),
      parent: parentQualifiedName,
      metadata: {
        type,
      },
    };
  }

  private extractFunctionSymbol(node: Node, filePrefix: string): SymbolData | null {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) return null;

    const name = nameNode.text;
    const qualified_name = `${filePrefix}:${name}`;
    const parameters = this.extractFunctionParameters(node);
    const returnType = node.childForFieldName('return_type')?.text ?? 'any';
    const comment = getBlockComment(node);

    return {
      kind: 'function',
      name,
      qualified_name,
      signature: node.text,
      location: getLocation(node),
      metadata: {
        parameters,
        returnType,
        comment,
      },
    };
  }

  private extractVariableSymbols(node: Node, filePrefix: string): SymbolData[] {
    const symbols: SymbolData[] = [];
    // TypeScript variable declarations can have multiple declarators
    // For exported variables, create symbols

    // Check if this is an export
    const isExported = this.isExported(node);

    if (isExported) {
      // Extract variable declarators
      for (const child of node.children) {
        if (child.type === 'variable_declarator') {
          const nameNode = child.childForFieldName('name');
          if (nameNode) {
            const name = nameNode.text;
            const qualified_name = `${filePrefix}:${name}`;
            const typeNode = child.childForFieldName('type');
            const type = typeNode?.text ?? 'any';

            symbols.push({
              kind: 'variable',
              name,
              qualified_name,
              signature: child.text,
              location: getLocation(child),
              metadata: {
                type,
              },
            });
          }
        }
      }
    }

    return symbols;
  }

  private isExported(node: Node): boolean {
    let current: Node | null = node;
    while (current) {
      if (current.type === 'function_declaration' || current.type === 'method_definition') {
        return false;
      }
      if (current.type === 'export_statement') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  private extractFunctionParameters(funcNode: Node): Array<{ name: string; type: string; optional: boolean }> {
    const parameters: Array<{ name: string; type: string; optional: boolean }> = [];
    const paramsNode = funcNode.childForFieldName('parameters');
    if (!paramsNode) return parameters;

    const paramNodes = [
      ...paramsNode.descendantsOfType('required_parameter'),
      ...paramsNode.descendantsOfType('optional_parameter'),
      ...paramsNode.descendantsOfType('rest_parameter'),
    ];

    for (const paramNode of paramNodes) {
      const nameNode = paramNode.childForFieldName('name') || paramNode.childForFieldName('pattern');
      if (nameNode) {
        const name = nameNode.text;
        const typeNode = paramNode.childForFieldName('type');
        const type = typeNode?.text ?? 'any';
        const optional = paramNode.type === 'optional_parameter' || paramNode.type === 'rest_parameter';

        parameters.push({ name, type, optional });
      }
    }

    return parameters;
  }

  private getFilePrefix(): string {
    return this.currentFilePath.replace(/\.tsx?$/, '');
  }



  private extractReferences(tree: Tree, symbols: SymbolData[]): ReferenceData[] {
    // TODO: Implement proper reference extraction for TypeScript
    // For now, return empty array to avoid issues with unresolved references
    return [];
  }



  private extractImports(tree: Tree): ImportData[] {
    const imports: ImportData[] = [];
    const importNodes = tree.rootNode.descendantsOfType('import_statement');

    for (const importNode of importNodes) {
      const importData = this.extractImport(importNode);
      if (importData) imports.push(importData);
    }

    return imports;
  }

  private extractImport(importNode: Node): ImportData | null {
    const sourceNode = importNode.descendantsOfType('string')[0];
    if (!sourceNode) return null;

    let source_package = sourceNode.text.replace(/['"`]/g, '');
    const imported_names: string[] = [];

    // Extract imported names from import clause
    const importClause = importNode.childForFieldName('import_clause');
    if (importClause) {
      // Handle different import types: named, default, namespace
      const namedImports = importClause.descendantsOfType('named_imports');
      for (const named of namedImports) {
        const identifiers = named.descendantsOfType('identifier');
        for (const id of identifiers) {
          imported_names.push(id.text);
        }
      }

      const namespaceImport = importClause.descendantsOfType('namespace_import')[0];
      if (namespaceImport) {
        imported_names.push(namespaceImport.text);
      }
    }

    return {
      source_package,
      imported_names,
      wildcard: imported_names.length === 0, // namespace import treated as wildcard
      location: getLocation(importNode),
    };
  }
}