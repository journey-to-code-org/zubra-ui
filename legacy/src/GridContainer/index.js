import '../Layout/index.js';
class GridContainer extends HTMLElement {
    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = `
            ::slotted(*) {
                display: grid;
                grid-template-columns: var(--columns, auto);
                grid-gap: var(--gap, 10px);
            }
        `;
        shadow.appendChild(style);
        const slot = document.createElement('slot');
        shadow.appendChild(slot);
    }

    static get observedAttributes() {
        return ['columns', 'gap'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.style.setProperty(`--${name}`, newValue);
            this.shadowRoot.querySelector('slot').assignedNodes().forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    node.style.setProperty(`--${name}`, newValue);
                }
            });
        }
    }
}

customElements.define('grid-container', GridContainer);