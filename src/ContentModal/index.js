class ContentModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  open() {
    this.shadowRoot.querySelector(".modal").classList.add("open");
    document.body.style.overflow = "hidden"; // Prevent scrolling
  }

  close() {
    this.shadowRoot.querySelector(".modal").classList.remove("open");
    document.body.style.overflow = ""; // Restore scrolling
  }

  render() {
    const prefersDarkMode =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    const modalBackground = prefersDarkMode ? "rgba(0, 0, 0, 0.9)" : "rgba(255, 255, 255, 0.9)";
    const modalContentBackground = prefersDarkMode ? "white" : "black";
    const modalContentColor = !prefersDarkMode ? "white" : "black";

    this.shadowRoot.innerHTML = `
            <style>
            .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${modalBackground};
                justify-content: center;
                align-items: center;
                z-index: 1000;
            }
            .modal.open {
                display: flex;
            }
            .modal-content {
                background: ${modalContentBackground};
                padding: 20px;
                border-radius: 5px;
                max-width: 100%;
                max-height: 90vh; /* Ensure modal content fits within the viewport */
                overflow-x: hidden;
                overflow-y: auto; /* Enable scrolling if content overflows */
                color: ${modalContentColor};
                position: relative;
            }

            .modal-content img {
                max-height: 88vh;
            }
            .close-button {
                position: absolute;
                top: -2px;
                right: -2px;
                background: none;
                border: none;
                font-size: 1.5rem;
                color: ${modalContentColor};
                cursor: pointer;
                transition: font-size 0.2s;
            }
            .close-button:hover {
                font-size: 1.6rem;
                
            </style>
            <div class="modal">
                <div class="modal-content">
                    <button class="close-button" aria-label="Close">&times;</button>
                    <slot></slot>
                </div>
            </div>
        `;

    this.shadowRoot
      .querySelector(".close-button")
      .addEventListener("click", () => this.close());
    this.shadowRoot
      .querySelector(".modal")
      .addEventListener("click", (event) => {
        if (event.target === this.shadowRoot.querySelector(".modal")) {
          this.close();
        }
      });
    this.shadowRoot
      .querySelector(".modal-content")
      .addEventListener("click", (event) => {
        event.stopPropagation();
      });
  }
}

customElements.define("content-modal", ContentModal);
