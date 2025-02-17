 class TooltipComponent extends HTMLElement {
      constructor() {
        super();
        // Attach shadow DOM for style encapsulation.
        this.attachShadow({ mode: 'open' });
        // Get the tooltip text from the attribute, or use a default.
        this.tooltipText = this.getAttribute('tooltip') || 'Default tooltip text';
        // Generate a unique ID for the tooltip.
        this._tooltipId = `tooltip-${crypto.randomUUID()}`;
        // Bind methods.
        this._showTooltip = this._showTooltip.bind(this);
        this._hideTooltip = this._hideTooltip.bind(this);
      }

      connectedCallback() {
        // Render the component's HTML and CSS.
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              position: relative;
              display: inline-block;
            }
            /* Tooltip styling */
            .tooltip {
              position: absolute;
              bottom: 100%;
              left: 50%;
              transform: translateX(-50%);
              background-color: #333;
              color: #fff;
              padding: 5px 10px;
              border-radius: 4px;
              font-size: 12px;
              white-space: nowrap;
              visibility: hidden;
              opacity: 0;
              transition: opacity 0.2s ease-in-out;
              pointer-events: none;
              z-index: 10;
            }
            /* When visible, show the tooltip */
            :host([visible]) .tooltip {
              visibility: visible;
              opacity: 1;
            }
          </style>
          <slot></slot>
          <div class="tooltip" role="tooltip" id="${this._tooltipId}">
            ${this.tooltipText}
          </div>
        `;

        // Find the first element in the slot to act as the trigger.
        const slot = this.shadowRoot.querySelector('slot');
        const assignedNodes = slot.assignedNodes().filter(node => node.nodeType === Node.ELEMENT_NODE);
        if (assignedNodes.length) {
          this._triggerElement = assignedNodes[0];
          // Link the trigger element with the tooltip for accessibility.
          this._triggerElement.setAttribute('aria-describedby', this._tooltipId);
          // Add event listeners for both mouse and keyboard interactions.
          this._triggerElement.addEventListener('mouseenter', this._showTooltip);
          this._triggerElement.addEventListener('mouseleave', this._hideTooltip);
          this._triggerElement.addEventListener('focus', this._showTooltip);
          this._triggerElement.addEventListener('blur', this._hideTooltip);
        }
      }

      disconnectedCallback() {
        // Clean up event listeners when the element is removed.
        if (this._triggerElement) {
          this._triggerElement.removeEventListener('mouseenter', this._showTooltip);
          this._triggerElement.removeEventListener('mouseleave', this._hideTooltip);
          this._triggerElement.removeEventListener('focus', this._showTooltip);
          this._triggerElement.removeEventListener('blur', this._hideTooltip);
        }
      }

      // Show the tooltip by setting a custom attribute.
      _showTooltip() {
        this.setAttribute('visible', '');
      }

      // Hide the tooltip by removing the custom attribute.
      _hideTooltip() {
        this.removeAttribute('visible');
      }
    }

    // Define the custom element.
    customElements.define('wcl-tooltip', TooltipComponent);