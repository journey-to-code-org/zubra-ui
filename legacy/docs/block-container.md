# Block Container Documentation

## Overview

The `<block-container>` is a custom element designed to wrap the `<layout-manager>` to handle block-items while maintaining semantic HTML. This document provides guidelines and examples for using `<block-container>` effectively.

## Guidelines

### Use Meaningful Markup

- Wrap your block container in semantically appropriate tags or use ARIA roles if necessary.
- Ensure that the content inside each `<layout-item>` remains semantically correct (e.g., using `<article>`, `<header>`, `<p>`, etc.).

### Custom Element as a Structural Wrapper

- The `<block-container>` should act as a structural wrapper that internally uses `<layout-manager mode="block">` without altering the intended meaning of the content.
- Design the `<block-container>` so that its shadow DOM (or light DOM, if preferred) contains the `<layout-manager>`, ensuring that the block behavior is applied while keeping your HTML semantic.

### Clear API for Developers

- Document which attributes or properties control layout behavior versus content semantics.
- Keep the usage of `<block-container>` intuitive, avoiding the mix of layout configuration with semantic markup.

## Example Usage

Imagine you’re building a news list where each block item is an article:

```html
<section aria-label="Latest News">
  <block-container>
    <layout-item>
      <article>
        <header><h2>News Title 1</h2></header>
        <p>Summary of news article 1...</p>
      </article>
    </layout-item>
    <layout-item>
      <article>
        <header><h2>News Title 2</h2></header>
        <p>Summary of news article 2...</p>
      </article>
    </layout-item>
  </block-container>
</section>
```

### Explanation

- **Semantic Markup**: By using a `<section>` and semantic elements like `<article>`, `<header>`, and `<p>`, you maintain the meaning and accessibility of your content.
- **Layout Management**: The `<layout-manager mode="block">` ensures that only block-related styles are applied to its children, keeping your layout behavior isolated.

## Shadow DOM Considerations

If your `<block-container>` uses Shadow DOM to encapsulate styles, ensure that it doesn’t obscure meaningful content from accessibility tools. Use slots for content insertion so that semantic tags are preserved in the light DOM.

## Accessibility and SEO

- Maintain clear document structure. Custom elements like `<block-container>` can be styled and scripted, but they should not replace native semantic elements when those elements are necessary for accessibility and SEO.
- Consider adding appropriate ARIA attributes or roles if the custom element itself needs to convey semantic meaning.

## Implementation Example

Below is an example implementation of a `<block-container>` web component that leverages `<layout-manager mode="block">` to manage its children while preserving semantic HTML.

```javascript
class BlockContainer extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
      </style>
      <layout-manager mode="block">
        <slot></slot>
      </layout-manager>
    `;
  }
}

customElements.define('block-container', BlockContainer);
```

### Usage Example

```html
<section aria-label="Latest News">
  <block-container>
    <layout-item>
      <article>
        <header><h2>News Title 1</h2></header>
        <p>Summary of news article 1...</p>
      </article>
    </layout-item>
    <layout-item>
      <article>
        <header><h2>News Title 2</h2></header>
        <p>Summary of news article 2...</p>
      </article>
    </layout-item>
  </block-container>
</section>
```

### Explanation

- **Shadow DOM**: The `<block-container>` encapsulates its internal markup using the Shadow DOM, preventing styling conflicts while still allowing light DOM content (the `<layout-item>` elements) to be slotted in.
- **Semantic Markup**: By using a `<section>` and semantic elements like `<article>`, `<header>`, and `<p>`, you maintain the meaning and accessibility of your content.
- **Layout Management**: The `<layout-manager mode="block">` ensures that only block-related styles are applied to its children, keeping your layout behavior isolated.

## Design Considerations

### Separation of Concerns

- **Layout vs. Semantics**: `<layout-manager>` focuses on managing layout properties, whereas `<block-container>` provides a semantically meaningful container for block-level content.

### Encapsulation and Flexibility

- **Internal Implementation**: By composing `<layout-manager>` inside `<block-container>`, you can encapsulate the layout logic and decide which attributes or behaviors to expose.

### API Clarity

- **Simplified Interface**: Composition allows `<block-container>` to offer a simplified, specialized interface for block content, hiding the underlying complexity.

### Customization and Specialization

- **Default Settings**: With composition, `<block-container>` can set defaults (like mode="block") without exposing the entire API of `<layout-manager>`.
- **Additional Semantic Features**: Composition allows you to layer additional semantic or accessibility enhancements on top without modifying the base layout logic.
