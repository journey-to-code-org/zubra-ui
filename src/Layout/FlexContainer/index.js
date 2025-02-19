class flexContainer extends HTMLElement {
    static get observedAttributes() {
      // Observe attributes relevant for both flex behavior and potential mode changes.
      return ['height', 'width', 'mode', 'display', 'breakpoint', 'direction'];
    }
  
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }
  
    connectedCallback() {
      this.render();
      this._updateAllAttributes();
    }
  
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) {
        this._updateAttribute(name, newValue);
      }
    }
  
    _updateAllAttributes() {
      // Loop through all observed attributes and update them accordingly.
      flexContainer.observedAttributes.forEach(attr => {
        if (this.hasAttribute(attr)) {
          this._updateAttribute(attr, this.getAttribute(attr));
        }
      });
    }
  
    _updateAttribute(name, value) {
      // For attributes that should be forwarded to the inner <layout-manager>
      const layoutManager = this.shadowRoot.querySelector('layout-manager');
      if (!layoutManager) return;
  
      // For mode and display, forward directly to layout-manager.
      if (['mode', 'display'].includes(name)) {
        layoutManager.setAttribute(name, value);
      } else if (name === 'breakpoint' || name === 'direction') {
        // You might handle responsive or direction-based styles here.
        // For example, setting CSS custom properties or directly updating styles.
        if (name === 'breakpoint') {
          // Example: Adjust styles based on breakpoint
          if (value === 'small') {
            this.style.setProperty('font-size', '12px');
            this.style.setProperty('padding', '8px');
          } else if (value === 'medium') {
            this.style.setProperty('font-size', '16px');
            this.style.setProperty('padding', '12px');
          } else if (value === 'large') {
            this.style.setProperty('font-size', '20px');
            this.style.setProperty('padding', '16px');
          }
        } else if (name === 'direction') {
          // Example: Adjust styles based on direction
          if (value === 'horizontal') {
            this.style.setProperty('flex-direction', 'row');
          } else if (value === 'vertical') {
            this.style.setProperty('flex-direction', 'column');
          }
        }
        this.style.setProperty(`--${name}`, value);
      } else {
        // For height and width, update the host style.
        this.style.setProperty(name, value);
      }
    }
  
    render() {
      // We default to mode="flex", but allow overrides via attribute.
      const mode = this.getAttribute('mode') || 'flex';
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: flex;
            width: 100%;
            height: auto;
          }
        </style>
        <layout-manager mode="${mode}">
          <slot></slot>
        </layout-manager>
      `;
    }
  }
  
  customElements.define('flex-container', flexContainer);
  