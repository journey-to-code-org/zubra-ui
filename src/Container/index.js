class MasonryLayout extends HTMLElement {
  static get observedAttributes() {
    return ['columns', 'column-gap', 'item-gap'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // Observer to catch changes in light DOM children.
    this._observer = new MutationObserver(() => this._distributeContent());
  }

  connectedCallback() {
    this.render();
    this._observer.observe(this, { childList: true });
    this._distributeContent();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.render();
      this._distributeContent();
    }
  }

  disconnectedCallback() {
    this._observer.disconnect();
  }

  // Convenience getters for attributes with default values.
  get columns() {
    return parseInt(this.getAttribute('columns')) || 3;
  }

  get columnGap() {
    return this.getAttribute('column-gap') || '1rem';
  }

  get itemGap() {
    return this.getAttribute('item-gap') || '1rem';
  }

  render() {
    if (this.shadowRoot) {
      // Clear existing content.
      this.shadowRoot.innerHTML = '';

      // Define styles using current attribute values.
      const style = document.createElement('style');
      style.textContent = `
        .masonry-container {
          display: flex;
          flex-direction: column;
        }
        .masonry-header,
        .masonry-footer {
          margin: 0.5rem 0;
        }
        .masonry-wrapper {
          display: flex;
          gap: ${this.columnGap};
        }
        .masonry-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: ${this.itemGap};
        }
      `;

      // Main container.
      const container = document.createElement('div');
      container.classList.add('masonry-container');

      // Header slot.
      const headerSlot = document.createElement('slot');
      headerSlot.name = 'header';
      headerSlot.classList.add('masonry-header');
      container.appendChild(headerSlot);

      // Masonry wrapper for columns.
      const wrapper = document.createElement('div');
      wrapper.classList.add('masonry-wrapper');

      // Create columns that each contain a named slot.
      this._columnSlotNames = [];
      for (let i = 0; i < this.columns; i++) {
        const col = document.createElement('div');
        col.classList.add('masonry-column');
        const slot = document.createElement('slot');
        // Each column gets a unique slot name.
        const slotName = `col-${i}`;
        slot.name = slotName;
        col.appendChild(slot);
        wrapper.appendChild(col);
        this._columnSlotNames.push(slotName);
      }
      container.appendChild(wrapper);

      // Footer slot.
      const footerSlot = document.createElement('slot');
      footerSlot.name = 'footer';
      footerSlot.classList.add('masonry-footer');
      container.appendChild(footerSlot);

      // Append style and container to shadow DOM.
      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(container);
    }
  }

  _distributeContent() {
    // Filter out nodes that already have a slot value for header, footer, or columns.
    const nodes = Array.from(this.childNodes).filter(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const slotAttr = node.getAttribute('slot');
        return !(slotAttr === 'header' || slotAttr === 'footer' || (slotAttr && slotAttr.startsWith('col-')));
      } else if (node.nodeType === Node.TEXT_NODE) {
        // Exclude empty text nodes.
        return node.textContent.trim() !== '';
      }
      return false;
    });

    // Assign each default node a slot attribute based on round-robin.
    nodes.forEach((node, index) => {
      const slotName = this._columnSlotNames[index % this.columns];
      node.setAttribute('slot', slotName);
    });
  }
}

class AppContainer extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Application Container');
    shadow.appendChild(container);

    const style = document.createElement('style');
    shadow.appendChild(style);

    this.updateStyle();
  }

  static get observedAttributes() {
    return ['layout', 'columns', 'theme-color', 'padding', 'margin', 'align-items', 'justify-items', 'responsive'];
  }

  attributeChangedCallback() {
    this.updateStyle();
  }

  connectedCallback() {
    this.updateStyle();
    this._renderChildren();
  }

  updateStyle() {
    const layout = this.getAttribute('layout') || 'grid';
    const columns = this.getAttribute('columns') || '1';
    const themeColor = this.getAttribute('theme-color') || '#ffffff';
    const padding = this.getAttribute('padding') || '16px';
    const margin = this.getAttribute('margin') || '0';
    const alignItems = this.getAttribute('align-items') || 'stretch';
    const justifyItems = this.getAttribute('justify-items') || 'start';
    const responsive = this.hasAttribute('responsive');

    const container = this.shadowRoot.querySelector('div');
    const style = this.shadowRoot.querySelector('style');

    container.style.backgroundColor = themeColor;
    container.style.padding = padding;
    container.style.margin = margin;
    container.style.display = layout === 'flex' ? 'flex' : 'grid';
    container.style.alignItems = alignItems;
    container.style.justifyItems = justifyItems;

    if (layout === 'grid') {
      container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
      container.style.gap = '16px';
    } else if (layout === 'flex') {
      container.style.flexWrap = 'wrap';
      container.style.gap = '16px';
    }

    let responsiveStyles = '';
    if (responsive) {
      responsiveStyles = `
        @media (max-width: 600px) {
          div {
            grid-template-columns: 1fr !important;
            flex-direction: column !important;
          }
        }
      `;
    }

    style.textContent = `
      :host {
        display: block;
      }
      div {
        box-sizing: border-box;
      }
      ${responsiveStyles}
    `;
  }

  _renderChildren() {
    const container = this.shadowRoot.querySelector('div');
    container.innerHTML = '';
    Array.from(this.children).forEach(child => {
      container.appendChild(child.cloneNode(true));
    });
  }
}

customElements.define('app-container', AppContainer);
customElements.define('masonry-layout', MasonryLayout);