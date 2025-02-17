class ToggleGroup extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.addEventListener("click", this.handleClick);
  }

  connectedCallback() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          gap: 8px;
        }
      </style>
      <slot></slot>
    `;
  }

  handleClick(event) {
    const target = event.target;
    if (target.tagName.toLowerCase() === "toggle-group-item") {
      this.clearSelection();
      target.setAttribute("aria-pressed", "true");
    }
  }

  clearSelection() {
    const items = this.querySelectorAll("toggle-group-item");
    items.forEach((item) => item.setAttribute("aria-pressed", "false"));
  }
}

class ToggleGroupItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.addEventListener("click", this.handleClick);
  }

  connectedCallback() {
    const icon = this.getAttribute("icon");
    const iconSVG = this.getIconSVG(icon);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          padding: 8px 16px;
          background-color: #f0f0f0;
          border: 1px solid #ccc;
          cursor: pointer;
          user-select: none;
          color: #000000;
        }

        :host([aria-pressed="true"]) {
          background-color: #007bff;
          color: white;
        }

        svg {
          width: 40px;
          height: 40px; 
        }
      </style>
      <slot></slot>
      ${iconSVG}
    `;
    this.setAttribute("aria-pressed", "false");
    this.tabIndex = 0;
  }

  getIconSVG(icon) {
    switch (icon) {
      case "bold":
        return `
         <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
          <text x="10" y="40" font-family="Arial" font-size="40" font-weight="bold">B</text>
        </svg>


        `;
      case "italic":
        return `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <text x="10" y="40" font-family="Arial" font-size="24" font-style="italic">I</text>
          </svg>

        `;
      case "underline":
        return `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <text x="10" y="40" font-family="Arial" font-size="24" font-style="underline">U</text>
          </svg>

        `;
      default:
        return "";
    }
  }

  handleClick() {
    const isPressed = this.getAttribute("aria-pressed") === "true";
    this.setAttribute("aria-pressed", isPressed ? "false" : "true");
  }
}

customElements.define("toggle-group", ToggleGroup);
customElements.define("toggle-group-item", ToggleGroupItem);
