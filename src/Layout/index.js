class LayoutManager extends HTMLElement {
  static get observedAttributes() {
    return [
      'mode', 
      'height', 
      'width', 
      'flex-direction', 
      'justify-content', 
      'align-items', 
      'flex-wrap', 
      'align-content',
      'grid-template-columns',
      'grid-template-rows',
      'gap',
      'grid-auto-flow',
      'direction',
      'breakpoint'
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      // Apply the update based on the attribute name and current mode
      this.updateLayout(name, newValue);
    }
  }

  updateLayout(attribute, value) {
    // Example: update the component's style based on the changed attribute
    const child = this.shadowRoot.querySelector('slot').assignedNodes()[0];
    if (child) {
      child.style[attribute] = value;
    } else {
      this.render();
    }
    switch (attribute) {
      case 'flex-direction':
      case 'justify-content':
      case 'align-items':
      case 'flex-wrap':
      case 'align-content':
        if (this.getAttribute('mode') === 'flex') {
          this.style[attribute] = value;
        }
        break;
      case 'grid-template-columns':
      case 'grid-template-rows':
      case 'gap':
      case 'grid-auto-flow':
        if (this.getAttribute('mode') === 'grid') {
          this.style[attribute] = value;
        }
        break;
      case 'direction':
        this.style.direction = value;
        break;
      // Handle other attributes as needed
      default:
        // Fallback for general attribute updates
        this.style[attribute] = value;
        break;
    }
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
      <slot></slot>
    `;
  }
}

customElements.define('layout-manager', LayoutManager);
