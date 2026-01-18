import { Parser, Language, Node, Tree } from 'web-tree-sitter';

import { log } from "./logger";

import type { JsxElement, JsxAttribute } from './types';

/**
 * Create a TSX parser with support for JSX syntax.
 * 
 * @returns A configured Parser instance ready to parse TSX/JSX code
 */
export async function createTsxParser(): Promise<Parser> {
  await Parser.init();

  const TSX = await Language.load('public/tree-sitter-tsx.wasm');

  const parser = new Parser();
  parser.setLanguage(TSX);

  return parser;
}

/**
 * Find the first node of a specific type in the syntax tree.
 * 
 * @param target The root node or tree to start searching from
 * @param type The node type to search for
 * @returns The first node of the specified type, or null if not found
 */
export function findFirstNodeOfType(target: Node | Tree | null | undefined, type: string): Node | null {
  if (!target) {
    return null;
  }

  const node = target instanceof Tree ? target.rootNode as Node : target;

  if (node.type === type) {
    return node;
  }

  const results = node.descendantsOfType(type);

  return results[0] ?? null;
}

/**
 * Get all JSX elements from a code block.
 * 
 * @param tree The parse tree
 * @returns An array of JsxElement models
 */
export function getJsxElements(tree: Tree): JsxElement[] {
  const elements: JsxElement[] = [];

  // Get both jsx_element and jsx_self_closing_element nodes
  const jsxElements = tree.rootNode.descendantsOfType("jsx_element");
  const selfClosingElements = tree.rootNode.descendantsOfType("jsx_self_closing_element");

  for (const elementNode of jsxElements) {
    const element = getJsxElement(elementNode);
    if (element) {
      elements.push(element);
    }
  }

  for (const elementNode of selfClosingElements) {
    const element = getJsxSelfClosingElement(elementNode);
    if (element) {
      elements.push(element);
    }
  }

  return elements;
}

/**
 * Extract a single JSX self-closing element.
 * 
 * @param elementNode A jsx_self_closing_element node from the AST
 * @returns The populated JsxElement model or null if extraction fails
 */
export function getJsxSelfClosingElement(elementNode: Node): JsxElement | null {
  if (elementNode.type !== "jsx_self_closing_element") {
    return null;
  }

  // Extract tag name
  const tagName = getJsxTagName(elementNode);
  if (!tagName) {
    return null;
  }

  // Extract attributes
  const attributes = getJsxAttributes(elementNode);

  return {
    tag: tagName,
    attributes,
    children: [],
    selfClosing: true,
    text: elementNode.text,
  };
}

/**
 * Extract a single JSX element from a jsx_element node.
 * 
 * @param elementNode A jsx_element node from the AST
 * @returns The populated JsxElement model or null if extraction fails
 */
export function getJsxElement(elementNode: Node): JsxElement | null {
  if (elementNode.type !== "jsx_element") {
    return null;
  }

  // Get opening element - could be at position 0
  let openingElementNode: Node | null = null;
  if (elementNode.childCount > 0) {
    const firstChild = elementNode.child(0);
    if (firstChild && (firstChild.type === "jsx_opening_element" || firstChild.type === "jsx_self_closing_element")) {
      openingElementNode = firstChild;
    }
  }

  // Fallback: try using fieldname
  if (!openingElementNode) {
    openingElementNode = elementNode.childForFieldName("open_tag");
  }

  if (!openingElementNode) {
    return null;
  }

  // Extract tag name from opening element
  const tagName = getJsxTagName(openingElementNode);
  if (!tagName) {
    return null;
  }

  // Extract attributes
  const attributes = getJsxAttributes(openingElementNode);

  // Check if self-closing
  const selfClosing = elementNode.text.includes("/>");

  // Extract children
  const children = getJsxChildren(elementNode);

  return {
    tag: tagName,
    attributes,
    children,
    selfClosing,
    text: elementNode.text,
  };
}

/**
 * Extract tag name from a JSX opening element.
 * 
 * @param openingElementNode A jsx_opening_element node
 * @returns The tag name or null if not found
 */
export function getJsxTagName(openingElementNode: Node): string | null {
  // The tag name is typically an identifier or member expression
  const identifierNodes = openingElementNode.descendantsOfType("identifier");
  
  if (identifierNodes.length === 0) {
    return null;
  }

  // For simple cases like <div>, <Component>, etc., the first identifier is the tag
  return identifierNodes[0].text;
}

/**
 * Extract attributes from a JSX opening element.
 * 
 * @param openingElementNode A jsx_opening_element or jsx_self_closing_element node
 * @returns An array of JsxAttribute models
 */
export function getJsxAttributes(openingElementNode: Node): JsxAttribute[] {
  const attributes: JsxAttribute[] = [];

  // Get all JSX attributes from the element
  const attributeNodes = openingElementNode.descendantsOfType("jsx_attribute");
  
  // Also check for jsx_expression attributes
  const expressionAttributes = openingElementNode.descendantsOfType("jsx_expression");

  for (const attrNode of attributeNodes) {
    const attr = getJsxAttribute(attrNode);
    if (attr) {
      attributes.push(attr);
    }
  }

  // Handle spread attributes and other expression attributes separately if needed
  for (const exprNode of expressionAttributes) {
    // Skip if it's a spread or complex expression
    if (!exprNode.text.includes("{...")) {
      // This might be an attribute expression
      const parent = exprNode.parent;
      if (parent && parent.type === "jsx_attribute") {
        // Already handled by jsx_attribute parsing
        continue;
      }
    }
  }

  return attributes;
}

/**
 * Extract a single JSX attribute.
 * 
 * @param attrNode A jsx_attribute node
 * @returns The populated JsxAttribute model or null if extraction fails
 */
export function getJsxAttribute(attrNode: Node): JsxAttribute | null {
  if (attrNode.type !== "jsx_attribute") {
    return null;
  }

  // Get attribute name
  const nameNode = attrNode.childForFieldName("name");
  if (!nameNode) {
    return null;
  }

  const name = nameNode.text;

  // Get attribute value if present
  let value: string | undefined;
  
  // Try to get the value using childForFieldName
  const valueNode = attrNode.childForFieldName("value");
  
  if (valueNode) {
    let valueText = valueNode.text;
    
    // Remove quotes if it's a string literal
    if ((valueText.startsWith('"') && valueText.endsWith('"')) ||
        (valueText.startsWith("'") && valueText.endsWith("'"))) {
      value = valueText.slice(1, -1);
    } else {
      // It might be an expression or other type
      value = valueText;
    }
  }

  return {
    name,
    value,
  };
}

/**
 * Extract children from a JSX element.
 * 
 * @param elementNode A jsx_element node
 * @returns An array of children (mixed JsxElement and string text)
 */
export function getJsxChildren(elementNode: Node): (JsxElement | string)[] {
  const children: (JsxElement | string)[] = [];

  // Get child JSX elements
  const childElements = elementNode.descendantsOfType("jsx_element");
  
  // Get JSX text nodes
  const textNodes = elementNode.descendantsOfType("jsx_text");

  // Get JSX expressions (for now, just capture their text)
  const expressionNodes = elementNode.descendantsOfType("jsx_expression");

  // Process all node children to maintain order
  for (let i = 0; i < elementNode.childCount; i++) {
    const child = elementNode.child(i);
    if (!child) continue;

    if (child.type === "jsx_element") {
      const element = getJsxElement(child);
      if (element) {
        children.push(element);
      }
    } else if (child.type === "jsx_text") {
      const text = child.text.trim();
      if (text) {
        children.push(text);
      }
    } else if (child.type === "jsx_expression") {
      // For now, capture expression text
      const exprText = child.text.trim();
      if (exprText) {
        children.push(exprText);
      }
    }
  }

  return children;
}

/**
 * Parse a TSX/JSX code snippet and extract JSX elements.
 * 
 * @param parser The TSX parser instance
 * @param sourceCode The source code to parse
 * @returns An object with extracted JSX elements
 */
export function parseTsxCode(parser: Parser, sourceCode: string): { elements: JsxElement[] } {
  const tree: Tree | null = parser.parse(sourceCode);

  if (!tree) {
    return { elements: [] };
  }

  const elements = getJsxElements(tree);

  return { elements };
}
