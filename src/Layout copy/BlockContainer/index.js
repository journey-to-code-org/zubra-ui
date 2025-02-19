class BlockContainer extends HTMLElement {
  static get observedAttributes() {
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
    BlockContainer.observedAttributes.forEach((attr) => {
      if (this.hasAttribute(attr)) {
        this._updateAttribute(attr, this.getAttribute(attr));
      }
    });
  }

  _updateAttribute(name, value) {
    const layoutManager = this.shadowRoot.querySelector("layout-manager");
    if (!layoutManager) return;

    if (["mode", "display"].includes(name)) {
      layoutManager.setAttribute(name, value);
    } else if (name === "breakpoint") {
      this._updateBreakpointStyles(value);
    } else if (name === "direction") {
      this._updateDirectionStyles(value);
    } else {
      this.style.setProperty(name, value);
    }
  }

  _updateBreakpointStyles(value) {
    const styles = {
      small: { fontSize: "12px", padding: "8px" },
      medium: { fontSize: "16px", padding: "12px" },
      large: { fontSize: "20px", padding: "16px" },
    };
    const style = styles[value] || {};
    Object.entries(style).forEach(([key, val]) => {
      this.style.setProperty(key, val);
    });
    this.style.setProperty("--breakpoint", value);
  }

  _updateDirectionStyles(value) {
    const styles = {
      horizontal: { display: "flex", flexDirection: "row" },
      vertical: { display: "flex", flexDirection: "column" },
    };
    const style = styles[value] || {};
    Object.entries(style).forEach(([key, val]) => {
      this.style.setProperty(key, val);
    });
    this.style.setProperty("--direction", value);
  }

  render() {
    const mode = this.getAttribute("mode") || "block";
    if (mode === "inline-block") {
      this.style.display = "block";
    }

    this.shadowRoot.innerHTML = `
      <layout-manager mode="${mode}">
        <slot>
        </slot>
      </layout-manager>
    `;
  }
}

customElements.define("block-container", BlockContainer);
