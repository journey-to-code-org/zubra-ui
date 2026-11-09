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
