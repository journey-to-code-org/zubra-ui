class BlockContainer extends HTMLElement {
  static get observedAttributes() {
    // Observe attributes relevant for both block behavior and potential mode changes.
    return ["height", "width", "mode", "breakpoint", "direction", "inline"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
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
    BlockContainer.observedAttributes.forEach((attr) => {
      if (this.hasAttribute(attr)) {
        this._updateAttribute(attr, this.getAttribute(attr));
      }
    });
  }

  _updateAttribute(name, value) {
    // For attributes that should be forwarded to the inner <layout-manager>
    const layoutManager = this.shadowRoot.querySelector("layout-manager");
    if (!layoutManager || !name || !value && name !== 'inline') return;
    layoutManager.setAttribute(name, value);
    
    if (name === "inline") {
      // this.style.setProperty("display", value === "true" ? "inline-block" : "block");
      const slottedElements = this.shadowRoot.querySelector('slot').assignedElements();
      slottedElements.forEach(el => {
        el.style.display = "inline-block";
      });
    } 
    // For mode and display, forward directly to layout-manager.
    else if (["mode", "display"].includes(name)) {
      layoutManager.setAttribute(name, value);
    } else if (name === "breakpoint" || name === "direction") {
      // You might handle responsive or direction-based styles here.
      // For example, setting CSS custom properties or directly updating styles.
      if (name === "breakpoint") {
        // Example: Adjust styles based on breakpoint
        if (value === "small") {
          this.style.setProperty("font-size", "12px");
          this.style.setProperty("padding", "8px");
        } else if (value === "medium") {
          this.style.setProperty("font-size", "16px");
          this.style.setProperty("padding", "12px");
        } else if (value === "large") {
          this.style.setProperty("font-size", "20px");
          this.style.setProperty("padding", "16px");
        }
      } else if (name === "direction") {
        // Example: Adjust styles based on direction
        if (value === "horizontal") {
          this.style.setProperty("display", "flex");
          this.style.setProperty("flex-direction", "row");
        } else if (value === "vertical") {
          this.style.setProperty("display", "flex");
          this.style.setProperty("flex-direction", "column");
        }
      }
      this.style.setProperty(`--${name}`, value);
    } else {
      // For height and width, update the host style.
      this.style.setProperty(name, value);
    }
  }

  render() {
    // We default to mode="block", but allow overrides via attribute.
    const mode = this.getAttribute("mode") || "block";
    this.shadowRoot.innerHTML = `
        <style>
          :host {
            width: 100%;
            height: auto;
          }
            p.warning {
              color: var(--warning-color, orange);
            }
          :host([mode="inline"]) {
            display: inline-block;
          }
            ::slotted(*) {
             
            }
        </style>
        <layout-manager mode="${mode}">
          <slot>
            <p class="warning">Update the content of this block container.</p>
          </slot>
        </layout-manager>
        <block-container height="200px" width="100%" mode="block">
          <p>Block Container Example 1</p>
        </block-container>
        <block-container height="150px" width="50%" mode="inline">
          <p>Block Container Example 2</p>
        </block-container>
        <block-container height="100px" width="75%" mode="block" breakpoint="medium">
          <p>Block Container Example 3</p>
        </block-container>
      `;
  }
}

customElements.define("block-container", BlockContainer);
