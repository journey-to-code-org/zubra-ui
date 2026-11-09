import "../index.js";

class FlexContainer extends HTMLElement {
  static get observedAttributes() {
    return [
      "flex-direction",
      "justify-content",
      "align-items",
      "flex-wrap",
      "align-content",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this.updateLayout(name, newValue);
    }
  }

  updateLayout(attribute, value) {
    this.style[attribute] = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>

        ::slotted(*) {
          display: flex;
          flex-direction: ${this.getAttribute("flex-direction") || "row"};
          justify-content: ${this.getAttribute("justify-content") || "flex-start"};
          align-items: ${this.getAttribute("align-items") || "stretch"};
          flex-wrap: ${this.getAttribute("flex-wrap") || "nowrap"};
          align-content: ${this.getAttribute("align-content") || "stretch"};
        }
      </style>
      <slot></slot>
    `;
  }
}

customElements.define("flex-container", FlexContainer);
