class CopyRight extends HTMLElement {
connectedCallback() {
    const est = this.getAttribute("est") || "2023";
    const year = this.getAttribute("year") || new Date().getFullYear();
    const template = document.createElement("template");
    this.attachShadow({ mode: "open" });

    let content = `&copy; ${est}-${year}`;
    if (!this.getAttribute("est") && !this.getAttribute("blank")) {
        content = `&copy; ${year} <slot>Your Company Name</slot>`;
    } else if (!this.hasAttribute("blank")) {
        content += ` <slot>Your Company Name</slot>`;
    }

    template.innerHTML = content;
    this.shadowRoot.appendChild(template.content.cloneNode(true));
}
}

customElements.define("copy-right", CopyRight);

class TradeMark extends HTMLElement {
  connectedCallback() {
    const template = document.createElement("template");
    this.attachShadow({ mode: "open" });

    let content = `&trade; <slot>Your Company Name</slot>`;
    if (!this.getAttribute("before") && !this.getAttribute("blank")) {
        content = ` <slot>Your Company Name</slot>&trade;`;
    } else if (!this.hasAttribute("blank")) {
        content += ` &trade; <slot>Your Company Name</slot>`;
    }

    template.innerHTML = content;
    this.shadowRoot.appendChild(template.content.cloneNode(true));
}
}

customElements.define("trade-mark", TradeMark);
