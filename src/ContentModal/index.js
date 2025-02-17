class ContentModal extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    open() {
        this.shadowRoot.querySelector('.modal').classList.add('open');
    }

    close() {
        this.shadowRoot.querySelector('.modal').classList.remove('open');
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                .modal {
                    display: none;
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                .modal.open {
                    display: flex;
                }
                .modal-content {
                    background: white;
                    padding: 20px;
                    border-radius: 5px;
                    max-width: 90%;
                    max-height: 90%;
                    overflow: auto;
                    color: black;
                }
                .close-button {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    color: white;
                    cursor: pointer;
                }
            </style>
            <div class="modal">
                <button class="close-button" aria-label="Close">&times;</button>
                <div class="modal-content">
                    <slot></slot>
                </div>
            </div>
        `;

        this.shadowRoot.querySelector('.close-button').addEventListener('click', () => this.close());
        this.shadowRoot.querySelector('.modal').addEventListener('click', (event) => {
            if (event.target === this.shadowRoot.querySelector('.modal')) {
                this.close();
            }
        });
    }
}

customElements.define('content-modal', ContentModal);
