/**
 * Java parser for extracting SCIP symbols, occurrences, relationships, and documentation.
 * @author GitHub Copilot
 */

import { Parser, Language, Tree, Node } from "web-tree-sitter";
import type {
  ParseResult,
  ParsedSymbol,
  ParsedOccurrence,
  ParsedRelationship,
  ParsedDocumentation,
} from "./types";

/**
 * Initialize the Java parser with tree-sitter.
 * @returns Initialized Parser instance configured for Java
 * @author GitHub Copilot
 */
export async function initJavaParser(): Promise<Parser> {
  await Parser.init();
  const Java = await Language.load("public/tree-sitter-java.wasm");
  const parser = new Parser();
  parser.setLanguage(Java);
  return parser;
}

/**
 * Parse a Java file and extract all symbols, occurrences, relationships, and documentation.
 * @param filePath Path to the file being parsed
 * @param content Content of the Java file
 * @returns Complete parse result with all extracted data
 * @author GitHub Copilot
 */
export async function parseJavaFile(
  filePath: string,
  content: string
): Promise<ParseResult> {
  const parser = await initJavaParser();
  const tree = parser.parse(content);
  
  if (!tree) {
    throw new Error(`Failed to parse file: ${filePath}`);
  }

  const context = new ParserContext(filePath, content, tree);
  context.parse();

  return {
    symbols: context.symbols,
    occurrences: context.occurrences,
    relationships: context.relationships,
    documentation: context.documentation,
  };
}

/**
 * Context object that maintains state during parsing.
 * @author GitHub Copilot
 */
class ParserContext {
  filePath: string;
  content: string;
  tree: Tree;
  packageName: string = "";
  
  symbols: ParsedSymbol[] = [];
  occurrences: ParsedOccurrence[] = [];
  relationships: ParsedRelationship[] = [];
  documentation: ParsedDocumentation[] = [];
  
  // Stack to track current symbol context (package -> class -> method)
  symbolStack: string[] = [];
  
  // Map from node to qualified name for quick lookup
  nodeToSymbol = new Map<Node, string>();

  constructor(filePath: string, content: string, tree: Tree) {
    this.filePath = filePath;
    this.content = content;
    this.tree = tree;
  }

  /**
   * Main parsing entry point.
   * @author GitHub Copilot
   */
  parse(): void {
    this.extractPackage();
    this.extractDocumentation();
    this.walkTree(this.tree.rootNode);
  }

  /**
   * Extract package declaration.
   * @author GitHub Copilot
   */
  private extractPackage(): void {
    const pkgNode = this.findFirstNodeOfType(this.tree.rootNode, "package_declaration");
    if (pkgNode) {
      const scopedId = this.findFirstChildOfType(pkgNode, "scoped_identifier");
      if (scopedId) {
        this.packageName = scopedId.text;
      }
    }
  }
  
  /**
   * Find first node of type in tree.
   * @author GitHub Copilot
   */
  private findFirstNodeOfType(node: Node, type: string): Node | null {
    if (node.type === type) return node;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        if (child.type === type) return child;
        const found = this.findFirstNodeOfType(child, type);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Extract all documentation comments and associate them with symbols.
   * @author GitHub Copilot
   */
  private extractDocumentation(): void {
    const cursor = this.tree.walk();
    const commentNodes: Array<{ node: Node; type: string }> = [];
    
    const walk = (cursor: any): void => {
      do {
        const nodeType = cursor.nodeType;
        if (nodeType === "block_comment" || nodeType === "line_comment") {
          commentNodes.push({ node: cursor.currentNode, type: nodeType });
        }
        
        if (cursor.gotoFirstChild()) {
          walk(cursor);
          cursor.gotoParent();
        }
      } while (cursor.gotoNextSibling());
    };
    
    walk(cursor);
    
    // Store comments for later association with symbols
    this.documentationNodes = commentNodes;
  }

  private documentationNodes: Array<{ node: Node; type: string }> = [];

  /**
   * Walk the AST tree and extract symbols.
   * Uses tree.walk() as recommended in AGENTS.md.
   * @author GitHub Copilot
   */
  private walkTree(node: Node): void {
    // Process this node first
    this.processNode(node);
    
    // Recursively process children
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.walkTree(child);
      }
    }
    
    // Pop symbol context when leaving scope
    if (this.isScopeNode(node.type)) {
      this.symbolStack.pop();
    }
  }

  /**
   * Process a single AST node.
   * @author GitHub Copilot
   */
  private processNode(node: Node): void {
    switch (node.type) {
      case "import_declaration":
        this.processImport(node);
        break;
      case "class_declaration":
      case "interface_declaration":
      case "enum_declaration":
      case "annotation_type_declaration":
        this.processClass(node);
        break;
      case "method_declaration":
        this.processMethod(node);
        break;
      case "field_declaration":
        this.processField(node);
        break;
      case "local_variable_declaration":
        this.processLocalVariable(node);
        break;
      case "method_invocation":
        this.processMethodCall(node);
        break;
      case "field_access":
        this.processFieldAccess(node);
        break;
      case "type_identifier":
        this.processTypeReference(node);
        break;
    }
  }

  /**
   * Check if a node type creates a new symbol scope.
   * @author GitHub Copilot
   */
  private isScopeNode(nodeType: string): boolean {
    return [
      "class_declaration",
      "interface_declaration",
      "enum_declaration",
      "annotation_type_declaration",
      "method_declaration",
    ].includes(nodeType);
  }

  /**
   * Process import declaration and create reference occurrences.
   * @author GitHub Copilot
   */
  private processImport(node: Node): void {
    const scopedId = this.findFirstChildOfType(node, "scoped_identifier");
    if (!scopedId) return;
    
    const importedName = scopedId.text;
    
    this.occurrences.push({
      symbolQualifiedName: importedName,
      role: "reference",
      startLine: node.startPosition.row,
      startCol: node.startPosition.column,
      endLine: node.endPosition.row,
      endCol: node.endPosition.column,
    });
  }

  /**
   * Process class/interface/enum declaration.
   * @author GitHub Copilot
   */
  private processClass(node: Node): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    
    const className = nameNode.text;
    const qualifiedName = this.buildQualifiedName(className);
    
    // Determine kind
    let kind = "class";
    if (node.type === "interface_declaration") kind = "interface";
    else if (node.type === "enum_declaration") kind = "enum";
    else if (node.type === "annotation_type_declaration") kind = "annotation";
    
    // Add symbol
    const symbol: ParsedSymbol = {
      qualifiedName,
      symbolName: className,
      kind,
      parentSymbolId: this.symbolStack.length > 0 ? this.symbolStack[this.symbolStack.length - 1] : undefined,
      startLine: node.startPosition.row,
      startCol: node.startPosition.column,
      endLine: node.endPosition.row,
      endCol: node.endPosition.column,
    };
    
    this.symbols.push(symbol);
    this.nodeToSymbol.set(node, qualifiedName);
    
    // Add definition occurrence
    this.occurrences.push({
      symbolQualifiedName: qualifiedName,
      role: "definition",
      startLine: nameNode.startPosition.row,
      startCol: nameNode.startPosition.column,
      endLine: nameNode.endPosition.row,
      endCol: nameNode.endPosition.column,
    });
    
    // Extract documentation
    this.associateDocumentation(node, qualifiedName);
    
    // Extract inheritance relationships
    this.processInheritance(node, qualifiedName);
    
    // Add parent relationship if nested
    if (this.symbolStack.length > 0) {
      const parentQualifiedName = this.symbolStack[this.symbolStack.length - 1];
      this.relationships.push({
        fromQualifiedName: parentQualifiedName,
        toQualifiedName: qualifiedName,
        kind: "contains",
      });
    }
    
    // Push to stack for nested processing
    this.symbolStack.push(qualifiedName);
  }

  /**
   * Process inheritance (extends, implements).
   * @author GitHub Copilot
   */
  private processInheritance(node: Node, qualifiedName: string): void {
    // Process extends
    const superclass = node.childForFieldName("superclass");
    if (superclass) {
      const typeId = this.findFirstChildOfType(superclass, "type_identifier");
      if (typeId) {
        const superclassName = typeId.text;
        this.relationships.push({
          fromQualifiedName: qualifiedName,
          toQualifiedName: this.resolveTypeName(superclassName),
          kind: "extends",
        });
        
        // Add reference occurrence
        this.occurrences.push({
          symbolQualifiedName: this.resolveTypeName(superclassName),
          role: "reference",
          startLine: typeId.startPosition.row,
          startCol: typeId.startPosition.column,
          endLine: typeId.endPosition.row,
          endCol: typeId.endPosition.column,
        });
      }
    }
    
    // Process implements
    const interfaces = node.childForFieldName("interfaces");
    if (interfaces) {
      const typeIds = this.findAllChildrenOfType(interfaces, "type_identifier");
      for (const typeId of typeIds) {
        const interfaceName = typeId.text;
        this.relationships.push({
          fromQualifiedName: qualifiedName,
          toQualifiedName: this.resolveTypeName(interfaceName),
          kind: "implements",
        });
        
        // Add reference occurrence
        this.occurrences.push({
          symbolQualifiedName: this.resolveTypeName(interfaceName),
          role: "reference",
          startLine: typeId.startPosition.row,
          startCol: typeId.startPosition.column,
          endLine: typeId.endPosition.row,
          endCol: typeId.endPosition.column,
        });
      }
    }
  }

  /**
   * Process method declaration.
   * @author GitHub Copilot
   */
  private processMethod(node: Node): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    
    const methodName = nameNode.text;
    const qualifiedName = this.buildQualifiedName(methodName);
    
    // Build signature
    const signature = this.buildMethodSignature(node);
    
    // Add symbol
    const symbol: ParsedSymbol = {
      qualifiedName,
      symbolName: methodName,
      kind: "method",
      signature,
      parentSymbolId: this.symbolStack.length > 0 ? this.symbolStack[this.symbolStack.length - 1] : undefined,
      startLine: node.startPosition.row,
      startCol: node.startPosition.column,
      endLine: node.endPosition.row,
      endCol: node.endPosition.column,
    };
    
    this.symbols.push(symbol);
    this.nodeToSymbol.set(node, qualifiedName);
    
    // Add definition occurrence
    this.occurrences.push({
      symbolQualifiedName: qualifiedName,
      role: "definition",
      startLine: nameNode.startPosition.row,
      startCol: nameNode.startPosition.column,
      endLine: nameNode.endPosition.row,
      endCol: nameNode.endPosition.column,
    });
    
    // Extract documentation
    this.associateDocumentation(node, qualifiedName);
    
    // Add parent relationship
    if (this.symbolStack.length > 0) {
      const parentQualifiedName = this.symbolStack[this.symbolStack.length - 1];
      this.relationships.push({
        fromQualifiedName: parentQualifiedName,
        toQualifiedName: qualifiedName,
        kind: "contains",
      });
    }
    
    // Push to stack for processing method body
    this.symbolStack.push(qualifiedName);
  }

  /**
   * Build method signature with parameters and return type.
   * @author GitHub Copilot
   */
  private buildMethodSignature(node: Node): string {
    const params: string[] = [];
    
    const paramList = node.childForFieldName("parameters");
    if (paramList) {
      const formalParams = this.findAllChildrenOfType(paramList, "formal_parameter");
      for (const param of formalParams) {
        const typeNode = param.childForFieldName("type");
        const nameNode = param.childForFieldName("name");
        if (typeNode && nameNode) {
          params.push(`${typeNode.text} ${nameNode.text}`);
        }
      }
    }
    
    const returnType = node.childForFieldName("type");
    const returnTypeStr = returnType?.text ?? "void";
    
    return `${returnTypeStr} ${node.childForFieldName("name")?.text}(${params.join(", ")})`;
  }

  /**
   * Process field declaration.
   * @author GitHub Copilot
   */
  private processField(node: Node): void {
    const typeNode = node.childForFieldName("type");
    if (!typeNode) return;
    
    const declarators = this.findAllChildrenOfType(node, "variable_declarator");
    
    for (const declarator of declarators) {
      const nameNode = declarator.childForFieldName("name");
      if (!nameNode) continue;
      
      const fieldName = nameNode.text;
      const qualifiedName = this.buildQualifiedName(fieldName);
      
      // Add symbol
      const symbol: ParsedSymbol = {
        qualifiedName,
        symbolName: fieldName,
        kind: "field",
        signature: `${typeNode.text} ${fieldName}`,
        parentSymbolId: this.symbolStack.length > 0 ? this.symbolStack[this.symbolStack.length - 1] : undefined,
        startLine: declarator.startPosition.row,
        startCol: declarator.startPosition.column,
        endLine: declarator.endPosition.row,
        endCol: declarator.endPosition.column,
      };
      
      this.symbols.push(symbol);
      
      // Add definition occurrence
      this.occurrences.push({
        symbolQualifiedName: qualifiedName,
        role: "definition",
        startLine: nameNode.startPosition.row,
        startCol: nameNode.startPosition.column,
        endLine: nameNode.endPosition.row,
        endCol: nameNode.endPosition.column,
      });
      
      // Add parent relationship
      if (this.symbolStack.length > 0) {
        const parentQualifiedName = this.symbolStack[this.symbolStack.length - 1];
        this.relationships.push({
          fromQualifiedName: parentQualifiedName,
          toQualifiedName: qualifiedName,
          kind: "contains",
        });
      }
    }
  }

  /**
   * Process local variable declaration.
   * @author GitHub Copilot
   */
  private processLocalVariable(node: Node): void {
    const typeNode = node.childForFieldName("type");
    if (!typeNode) return;
    
    const declarators = this.findAllChildrenOfType(node, "variable_declarator");
    
    for (const declarator of declarators) {
      const nameNode = declarator.childForFieldName("name");
      if (!nameNode) continue;
      
      const varName = nameNode.text;
      const qualifiedName = this.buildQualifiedName(varName);
      
      // Add symbol
      const symbol: ParsedSymbol = {
        qualifiedName,
        symbolName: varName,
        kind: "local_variable",
        signature: `${typeNode.text} ${varName}`,
        parentSymbolId: this.symbolStack.length > 0 ? this.symbolStack[this.symbolStack.length - 1] : undefined,
        startLine: declarator.startPosition.row,
        startCol: declarator.startPosition.column,
        endLine: declarator.endPosition.row,
        endCol: declarator.endPosition.column,
      };
      
      this.symbols.push(symbol);
      
      // Add definition occurrence
      this.occurrences.push({
        symbolQualifiedName: qualifiedName,
        role: "definition",
        startLine: nameNode.startPosition.row,
        startCol: nameNode.startPosition.column,
        endLine: nameNode.endPosition.row,
        endCol: nameNode.endPosition.column,
      });
    }
  }

  /**
   * Process method invocation (method call).
   * @author GitHub Copilot
   */
  private processMethodCall(node: Node): void {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) return;
    
    const methodName = nameNode.text;
    
    // Try to resolve the method - for now use simple name
    // In a full implementation, we'd need type inference
    const resolvedName = this.resolveMethodName(methodName, node);
    
    // Add call occurrence
    this.occurrences.push({
      symbolQualifiedName: resolvedName,
      role: "call",
      startLine: nameNode.startPosition.row,
      startCol: nameNode.startPosition.column,
      endLine: nameNode.endPosition.row,
      endCol: nameNode.endPosition.column,
    });
    
    // Add call relationship if we're in a method
    if (this.symbolStack.length > 0) {
      const fromQualifiedName = this.symbolStack[this.symbolStack.length - 1];
      this.relationships.push({
        fromQualifiedName,
        toQualifiedName: resolvedName,
        kind: "calls",
      });
    }
  }

  /**
   * Process field access.
   * @author GitHub Copilot
   */
  private processFieldAccess(node: Node): void {
    const fieldNode = node.childForFieldName("field");
    if (!fieldNode) return;
    
    const fieldName = fieldNode.text;
    const resolvedName = this.resolveFieldName(fieldName, node);
    
    // Add reference occurrence
    this.occurrences.push({
      symbolQualifiedName: resolvedName,
      role: "reference",
      startLine: fieldNode.startPosition.row,
      startCol: fieldNode.startPosition.column,
      endLine: fieldNode.endPosition.row,
      endCol: fieldNode.endPosition.column,
    });
  }

  /**
   * Process type reference (e.g., in variable declarations, parameters).
   * @author GitHub Copilot
   */
  private processTypeReference(node: Node): void {
    // Skip primitive types
    const typeName = node.text;
    if (this.isPrimitiveType(typeName)) return;
    
    // Skip if this is part of a definition we already processed
    if (this.isPartOfDefinition(node)) return;
    
    const resolvedName = this.resolveTypeName(typeName);
    
    // Add reference occurrence
    this.occurrences.push({
      symbolQualifiedName: resolvedName,
      role: "reference",
      startLine: node.startPosition.row,
      startCol: node.startPosition.column,
      endLine: node.endPosition.row,
      endCol: node.endPosition.column,
    });
  }

  /**
   * Associate documentation comments with a symbol.
   * @author GitHub Copilot
   */
  private associateDocumentation(node: Node, qualifiedName: string): void {
    // Find comments immediately before this node
    const nodeStartLine = node.startPosition.row;
    
    for (const { node: commentNode } of this.documentationNodes) {
      const commentEndLine = commentNode.endPosition.row;
      
      // Check if comment is within 1 line before the symbol
      if (commentEndLine >= nodeStartLine - 1 && commentEndLine <= nodeStartLine) {
        const content = commentNode.text;
        
        let docType: "javadoc" | "line_comment" | "block_comment" = "block_comment";
        if (content.startsWith("/**")) {
          docType = "javadoc";
        } else if (content.startsWith("//")) {
          docType = "line_comment";
        }
        
        this.documentation.push({
          symbolQualifiedName: qualifiedName,
          docType,
          content,
          startLine: commentNode.startPosition.row,
        });
      }
    }
  }

  /**
   * Build qualified name based on current context.
   * @author GitHub Copilot
   */
  private buildQualifiedName(simpleName: string): string {
    const parts: string[] = [];
    
    if (this.packageName) {
      parts.push(this.packageName);
    }
    
    // Add all but the last element from symbolStack (to avoid duplication)
    for (const sym of this.symbolStack) {
      const symSimpleName = sym.split(".").pop();
      if (symSimpleName) {
        parts.push(symSimpleName);
      }
    }
    
    parts.push(simpleName);
    
    return parts.join(".");
  }

  /**
   * Resolve a type name to a qualified name.
   * @author GitHub Copilot
   */
  private resolveTypeName(typeName: string): string {
    // If already qualified, return as-is
    if (typeName.includes(".")) {
      return typeName;
    }
    
    // Check if it's in the same package
    if (this.packageName) {
      return `${this.packageName}.${typeName}`;
    }
    
    return typeName;
  }

  /**
   * Resolve a method name to a qualified name.
   * @author GitHub Copilot
   */
  private resolveMethodName(methodName: string, node: Node): string {
    // Check if it's a qualified call (e.g., obj.method())
    const parent = node.parent;
    if (parent?.type === "field_access") {
      // For now, just return the method name
      // Full implementation would need type inference
      return methodName;
    }
    
    // Check if it's a method in the current class
    if (this.symbolStack.length > 0) {
      const currentClass = this.symbolStack[0];
      return `${currentClass}.${methodName}`;
    }
    
    return methodName;
  }

  /**
   * Resolve a field name to a qualified name.
   * @author GitHub Copilot
   */
  private resolveFieldName(fieldName: string, _node: Node): string {
    // Similar to method resolution
    if (this.symbolStack.length > 0) {
      const currentClass = this.symbolStack[0];
      return `${currentClass}.${fieldName}`;
    }
    
    return fieldName;
  }

  /**
   * Check if a type name is a Java primitive.
   * @author GitHub Copilot
   */
  private isPrimitiveType(typeName: string): boolean {
    const primitives = new Set([
      "boolean", "byte", "char", "short", "int", "long", "float", "double", "void"
    ]);
    return primitives.has(typeName);
  }

  /**
   * Check if a node is part of a symbol definition we already processed.
   * @author GitHub Copilot
   */
  private isPartOfDefinition(node: Node): boolean {
    let current: Node | null = node.parent;
    while (current) {
      const type = current.type;
      if (
        type === "class_declaration" ||
        type === "interface_declaration" ||
        type === "enum_declaration" ||
        type === "method_declaration" ||
        type === "field_declaration"
      ) {
        // Check if this node is the name field
        const nameField = current.childForFieldName("name");
        if (nameField === node) {
          return true;
        }
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * Find first child node of a specific type.
   * @author GitHub Copilot
   */
  private findFirstChildOfType(node: Node, type: string): Node | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child?.type === type) {
        return child;
      }
    }
    
    // Search recursively
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const found = this.findFirstChildOfType(child, type);
        if (found) return found;
      }
    }
    
    return null;
  }

  /**
   * Find all children nodes of a specific type.
   * @author GitHub Copilot
   */
  private findAllChildrenOfType(node: Node, type: string): Node[] {
    const results: Node[] = [];
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        if (child.type === type) {
          results.push(child);
        }
        results.push(...this.findAllChildrenOfType(child, type));
      }
    }
    
    return results;
  }
}
