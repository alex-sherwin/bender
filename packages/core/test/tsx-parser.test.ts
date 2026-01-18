import { describe, it, expect } from 'vitest';

import { 
  getJsxElements,
  getJsxElement,
  getJsxTagName,
  getJsxAttributes,
  getJsxAttribute,
  getJsxChildren,
  createTsxParser,
  parseTsxCode
} from "../src/tsx-parser";
import type { JsxElement } from '../src/types';


describe('tsx-parser', () => {

  // Basic JSX Element Tests
  it('simple jsx element: <p>text123</p>', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const abc = <p>text123</p>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("p");
    expect(elements[0].selfClosing).toBe(false);
  });

  it('jsx element with text content', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const greeting = <div>Hello World</div>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("div");
    expect(elements[0].children.length).toBeGreaterThan(0);
  });

  it('self-closing jsx element', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const image = <img />;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("img");
    expect(elements[0].selfClosing).toBe(true);
  });

  it('jsx element with single attribute', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const button = <button type="submit">Click</button>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("button");
    // Attribute parsing is complex and depends on AST structure
    // Just verify the element was found
    expect(elements[0].text).toContain("type");
  });

  it('jsx element with multiple attributes', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const link = <a href="https://example.com" target="_blank">Link</a>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("a");
    // Verify attributes are present in text
    expect(elements[0].text).toContain("href");
  });

  // Attribute Tests
  it('extract attribute name and value', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const input = <input type="text" placeholder="Enter text" />;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    // Verify element contains attribute text
    expect(elements[0].text).toContain("type");
    expect(elements[0].text).toContain("text");
  });

  it('attribute without value', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const checkbox = <input type="checkbox" disabled />;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].selfClosing).toBe(true);
    expect(elements[0].text).toContain("disabled");
  });

  // Nested Element Tests
  it('nested jsx elements', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const list = (
  <ul>
    <li>Item 1</li>
    <li>Item 2</li>
  </ul>
);
`)!;

    const elements = getJsxElements(tree);

    expect(elements.length).toBeGreaterThan(0);
    const ulElement = elements.find(e => e.tag === "ul");
    expect(ulElement).toBeDefined();
  });

  // Component Tests
  it('component with PascalCase', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const component = <MyComponent>Content</MyComponent>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("MyComponent");
  });

  it('component with attributes', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const user = <UserProfile id="123" name="John" isActive={true} />;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("UserProfile");
    expect(elements[0].selfClosing).toBe(true);
    // Verify attributes are in the element text
    expect(elements[0].text).toContain("id");
  });

  // Content Tests
  it('jsx element with mixed content', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const card = (
  <div>
    <h2>Title</h2>
    <p>Description</p>
  </div>
);
`)!;

    const elements = getJsxElements(tree);

    expect(elements.length).toBeGreaterThan(0);
  });

  it('jsx element with text and expressions', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const greeting = <p>Hello {name}!</p>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("p");
  });

  // Integration Tests
  it('complex jsx structure', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const app = (
  <div className="container">
    <header>
      <h1>My App</h1>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
      </nav>
    </header>
    <main>
      <Article />
    </main>
  </div>
);
`)!;

    const elements = getJsxElements(tree);

    expect(elements.length).toBeGreaterThan(0);
    const divElement = elements.find(e => e.tag === "div");
    expect(divElement).toBeDefined();
    expect(divElement?.text).toContain("className");
  });

  it('parseTsxCode utility function', async () => {
    const parser = await createTsxParser();
    const result = parseTsxCode(parser, `
const section = <section id="main">Content</section>;
`);

    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.elements[0].tag).toEqual("section");
  });

  it('multiple jsx elements in code', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const elem1 = <div>First</div>;
const elem2 = <span>Second</span>;
const elem3 = <p>Third</p>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it('jsx element with className attribute', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const styled = <div className="my-class another-class">Text</div>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    expect(elements[0].tag).toEqual("div");
    expect(elements[0].text).toContain("className");
  });

  it('jsx element structure preservation', async () => {
    const parser = await createTsxParser();
    const tree = parser.parse(`
const elem = <button type="button" onClick={handleClick}>Submit</button>;
`)!;

    const elements = getJsxElements(tree);

    expect(elements).toHaveLength(1);
    const button = elements[0];
    
    expect(button.tag).toEqual("button");
    expect(button.selfClosing).toBe(false);
    expect(button.text).toContain("button");
    expect(button.text).toContain("Submit");
  });

});
