class PreviewArea extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
            :host {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    width: 100%;
                    position: relative;
                    z-index: 1;
                    overflow: hidden;
            }
        `;

    const slot = document.createElement("slot");
    shadow.appendChild(style);
    shadow.appendChild(slot);
  }
}

customElements.define("preview-area", PreviewArea);
