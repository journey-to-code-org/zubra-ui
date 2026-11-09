class LayoutManager extends HTMLElement {
  static get observedAttributes() {
    return [
      "mode",
      "height",
      "width",
      "flex-direction",
      "justify-content",
      "align-items",
      "flex-wrap",
      "align-content",
      "grid-template-columns",
      "grid-template-rows",
      "gap",
      "grid-auto-flow",
      "direction",
      "breakpoint",
      "element-type",
      "position",
      "x",
      "y",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      // Apply the update based on the attribute name and current mode
      this.updateLayout(name, newValue);
    }
  }

  updateLayout(attribute, value) {
    switch (attribute) {
      case "mode":
        if (value === "flex" || value === "grid" || value ==="inline-flex" || value === "inline-grid" || value === "block" || value === "inline-block") {
          this.style.display = value;
        } else if (value === "inline") {
          this.style.display = "inline-block";
        } else {
          console.warn(`Unsupported mode: ${value}`);
        } 
        this.style.display = value;
        break;
      case "height":
      case "width":
        this.style[attribute] = value;
        break;
      case "x":
      case "y":
        this.style.setProperty(`--${attribute}`, value);
        break;

      case "flex-direction":
      case "justify-content":
      case "align-items":
      case "flex-wrap":
      case "align-content":
        if (this.getAttribute("mode") === "flex") {
          this.style[attribute] = value;
        }
        break;
      case "grid-template-columns":
      case "grid-template-rows":
      case "grid-gap":
      case "grid-auto-flow":
        if (this.getAttribute("mode") === "grid") {
          this.style[attribute] = value;
        }
        break;
      case "direction":
        this.style.direction = value;
        break;
      case "breakpoint":
        this.style["--breakpoint"] = value;
        break;
      // Handle other attributes as needed
      default:
        // Fallback for general attribute updates
        this.style[attribute] = value;
        break;
    }
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    console.log("Rendering LayoutManager with mode:", this.getAttribute("mode"));
    const displayMode = this.getAttribute("mode") || "block";
    console.log("Display mode:", displayMode);
    this.style.display = displayMode;
    this.shadowRoot.innerHTML = `
      <style>
      :host {
        display: ${displayMode};
      }
      ::slotted(*) {
        display: ${displayMode};
      }
      </style>
      <slot></slot>
    `;
  }
}

customElements.define("layout-manager", LayoutManager);
