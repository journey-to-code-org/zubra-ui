class TabContent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
    }

    render() {
        this.shadowRoot.innerHTML = `
            <div class="tabs">
                <button class="tab-button active" data-tab="block">Block Demo</button>
                <button class="tab-button" data-tab="flex">Flex Demo</button>
                <button class="tab-button" data-tab="grid">Grid Demo</button>
                <button class="tab-button" data-tab="combined">Combined Layouts</button>
            </div>
        `;
    }
}

customElements.define('tab-content', TabContent);