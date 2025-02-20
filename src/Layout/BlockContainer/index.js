class BlockContainer extends HTMLElement {
  static get observedAttributes() {
    // Observe attributes relevant for both block behavior and potential mode changes.
    return ["height", "width", "mode", "breakpoint", "direction"];
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
    if (!layoutManager) return;

    // For mode and display, forward directly to layout-manager.
    if (["mode", "display"].includes(name)) {
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
    const mode = this.getAttribute("mode") === "inline" || "inline";
    if (mode === "inline-block") {
      this.style.display = "inline-block";
    }
    this.shadowRoot.innerHTML = `
        <style>
          :host {
           
            width: 100%;
            height: auto;
          }
        </style>
        <layout-manager mode="${mode}">
          <slot>
              <div>
      <article>
        <header>
          <h2>Featured Article 1</h2>
        </header>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      </article>
    </div>
    <div>
      <article>
        <header>
          <h2>Featured Article 2</h2>
        </header>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
      </article>
    </div>
    <div>
      <article>
        <header>
          <h2>Featured Article 3</h2>
        </header>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
      </article>
    </div>
          </slot>
        </layout-manager>
      `;
  }
}

customElements.define("block-container", BlockContainer);
