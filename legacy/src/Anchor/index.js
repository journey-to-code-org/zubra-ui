// --- Customized Built-in Element: Extends native <a> ---
class CustomAnchor extends HTMLAnchorElement {
    constructor() {
        super();
        // Additional initialization if needed
        this.addEventListener('click', this.handleClick);
    }

    connectedCallback() {
        // Optionally, add behaviors or event listeners here
        console.log('CustomAnchor connected');
    }

    disconnectedCallback() {
        // Clean up event listeners
        this.removeEventListener('click', this.handleClick);
    }

    handleClick(event) {
        // Custom click behavior
        console.log('CustomAnchor clicked');
        this.dispatchEvent(new CustomEvent('custom-anchor-click', {
            detail: { message: 'Custom anchor clicked!' },
            bubbles: true,
            composed: true
        }));
    }
}

// Define the customized built-in element so it can be used as:
// <a is="custom-anchor" ...>...</a>
customElements.define('custom-anchor', CustomAnchor, { extends: 'a' });

// --- Autonomous Custom Element: A Simplified Wrapper ---
class SimpleAnchor extends HTMLElement {
    constructor() {
        super();
        // Create a shadow root for style encapsulation
        this.attachShadow({ mode: 'open' });
        this._render();
    }

    static get observedAttributes() {
        return ['href', 'tooltip', 'theme-color'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this._render();
        }
    }

    _render() {
        // Retrieve attribute values with defaults
        const href = this.getAttribute('href') || '#';
        const tooltip = this.getAttribute('tooltip') || '';
        const themeColor = this.getAttribute('theme-color') || 'blue';

        // Calculate hover background and text colors based on theme color
        const hoverBgColor = this._calculateHoverBgColor(themeColor);
        const hoverTextColor = this._calculateHoverTextColor(themeColor);

        // Render the inner template of our custom element.
        // We're using <a is="custom-anchor"> to leverage our extended anchor.
        this.shadowRoot.innerHTML = `
            <style>
                a {
                    color: ${themeColor};
                    text-decoration: none;
                    position: relative;
                }
                a:focus {
                    outline: 2px solid ${themeColor};
                }
            
                a:hover::after {
                    content: '${tooltip}';
                    position: absolute;
                    top: 100%;
                    background: ${hoverBgColor};
                    color: ${hoverTextColor};
                    padding: 5px;
                    border-radius: 3px;
                    white-space: nowrap;
                }
                    a:hover {
                    background-color: ${hoverBgColor};
                    color: ${hoverTextColor};
                };
            </style>
            <a is="custom-anchor" href="${href}" tabindex="0">
                <slot></slot>
            </a>
        `;
    }

    _calculateHoverBgColor(themeColor) {
        // Logic to calculate hover background color based on theme color
        return this._darkenColor(themeColor, 20);
    }

    _calculateHoverTextColor(themeColor) {
        // Logic to calculate hover text color based on theme color
        const num = parseInt(themeColor.replace("#", ""), 16);
        const R = (num >> 16) & 0xff;
        const G = (num >> 8) & 0xff;
        const B = num & 0xff;
        const brightness = (R * 299 + G * 587 + B * 114) / 1000;
        return brightness > 125 ? '#000' : '#fff';
    }

    _darkenColor(color, percent) {
        // Simple function to darken a color by a percentage
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return `#${(0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)}`;
    }
}

// Define the autonomous custom element so it can be used as:
customElements.define('wcl-anchor', SimpleAnchor);
