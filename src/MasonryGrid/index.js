class MasonryLayout extends HTMLElement {
    static get observedAttributes() {
        return ['columns', 'column-gap', 'item-gap', 'infinite-scroll'];
    }

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        // Observer to catch changes in light DOM children.
        this._observer = new MutationObserver(() => this._distributeContent());
        this._handleScroll = this._handleScroll.bind(this);
    }

    connectedCallback() {
        this.render();
        this._observer.observe(this, { childList: true });
        this._distributeContent();
        if (this.infiniteScroll) {
            window.addEventListener('scroll', this._handleScroll);
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
            this._distributeContent();
            if (name === 'infinite-scroll') {
                if (newValue !== null) {
                    window.addEventListener('scroll', this._handleScroll);
                } else {
                    window.removeEventListener('scroll', this._handleScroll);
                }
            }
        }
    }

    disconnectedCallback() {
        this._observer.disconnect();
        if (this.infiniteScroll) {
            window.removeEventListener('scroll', this._handleScroll);
        }
    }

    // Convenience getters for attributes with default values.
    get columns() {
        return parseInt(this.getAttribute('columns')) || 3;
    }

    get columnGap() {
        return this.getAttribute('column-gap') || '1rem';
    }

    get itemGap() {
        return this.getAttribute('item-gap') || '1rem';
    }

    get infiniteScroll() {
        return this.hasAttribute('infinite-scroll');
    }

    render() {
        if (this.shadowRoot) {
            // Clear existing content.
            this.shadowRoot.innerHTML = '';

            // Define styles using current attribute values.
            const style = document.createElement('style');
            style.textContent = `
          .masonry-container {
            display: flex;
            flex-direction: column;
          }
          .masonry-header,
          .masonry-footer {
            margin: 0.5rem 0;
          }
          .masonry-wrapper {
            display: grid;
            gap: ${this.columnGap};
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          }
          .masonry-column {
            display: flex;
            flex-direction: column;
            gap: ${this.itemGap};
          }
          @media (max-width: 600px) {
            .masonry-wrapper {
              grid-template-columns: 1fr;
            }
          }
        `;

            // Main container.
            const container = document.createElement('div');
            container.classList.add('masonry-container');

            // Header slot.
            const headerSlot = document.createElement('slot');
            headerSlot.name = 'header';
            headerSlot.classList.add('masonry-header');
            container.appendChild(headerSlot);

            // Masonry wrapper for columns.
            const wrapper = document.createElement('div');
            wrapper.classList.add('masonry-wrapper');

            // Create columns that each contain a named slot.
            this._columnSlotNames = [];
            for (let i = 0; i < this.columns; i++) {
                const col = document.createElement('div');
                col.classList.add('masonry-column');
                const slot = document.createElement('slot');
                // Each column gets a unique slot name.
                const slotName = `col-${i}`;
                slot.name = slotName;
                col.appendChild(slot);
                wrapper.appendChild(col);
                this._columnSlotNames.push(slotName);
            }
            container.appendChild(wrapper);

            // Footer slot.
            const footerSlot = document.createElement('slot');
            footerSlot.name = 'footer';
            footerSlot.classList.add('masonry-footer');
            container.appendChild(footerSlot);

            // Append style and container to shadow DOM.
            this.shadowRoot.appendChild(style);
            this.shadowRoot.appendChild(container);

            this._distributeContent(); // Ensure content is distributed after rendering columns
        }
    }

    _distributeContent() {
        // Filter out nodes that already have a slot value for header, footer, or columns.
        const nodes = Array.from(this.childNodes).filter(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const slotAttr = node.getAttribute('slot');
                return !(slotAttr === 'header' || slotAttr === 'footer' || (slotAttr && slotAttr.startsWith('col-')));
            } else if (node.nodeType === Node.TEXT_NODE) {
                // Exclude empty text nodes.
                return node.textContent.trim() !== '';
            }
            return false;
        });

        // Assign each default node a slot attribute based on round-robin.
        nodes.forEach((node, index) => {
            const columnLengths = this._columnSlotNames.map(slotName => {
                return this.querySelectorAll(`[slot="${slotName}"]`).length;
            });
            const minLength = Math.min(...columnLengths);
            const slotName = this._columnSlotNames[columnLengths.indexOf(minLength)];
            node.setAttribute('slot', slotName);
        });
    }

    _handleScroll() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;

        // Check the number of items in the last row
        const wrapper = this.shadowRoot.querySelector('.masonry-wrapper');
        const columns = Array.from(wrapper.children);
        const itemsInLastRow = columns.reduce((count, column) => {
            const items = Array.from(column.children);
            return count + items.filter(item => item.getBoundingClientRect().bottom <= windowHeight).length;
        }, 0);

        if (itemsInLastRow <= 8) {
            window.scrollTo(0, scrollTop); // Stop scrolling
        } else if (scrollTop + windowHeight >= documentHeight - 100) { // Increase the threshold
            window.scrollTo(0, scrollTop - 50); // Slow down scrolling more
        }
        
    }
}

// Define the custom element.
customElements.define('masonry-layout', MasonryLayout);