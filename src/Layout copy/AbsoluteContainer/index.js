class AbsoluteContainer extends HTMLElement {
  static get observedAttributes() {
    return ["fixed", "position", "x", "y"];
  }

  constructor() {
    super();
    const shadowRoot = this.attachShadow({ mode: "open" });
    const wrapper = document.createElement('div');
    wrapper.classList.add('wrapper');
    const defaultHTML = `
      <style>
        .slot-container {
          position: absolute;
          min-width: 50px;
          min-height: 30px;
        }
     /* Default Positioning */
      [data-position="default"] { top: 50%; left: 50%; transform: translate(-50%, -50%); }
      /* Top Row Positioning */
      [data-position="top-left"] { top: 0; left: 0; }
      [data-position="top-center"] { top: 0; left: 50%; transform: translateX(-50%); }
      [data-position="top-right"] { top: 0; right: 0; }

      /* Middle Top Row Positioning */
      [data-position="mid-top-left"] { top: 33%; left: 0; }
      [data-position="mid-top-center"] { top: 33%; left: 50%; transform: translateX(-50%); }
      [data-position="mid-top-right"] { top: 33%; right: 0; }

      /* Middle Bottom Row Positioning */
      [data-position="mid-bottom-left"] { top: 66%; left: 0; }
      [data-position="mid-bottom-center"] { top: 66%; left: 50%; transform: translateX(-50%); }
      [data-position="mid-bottom-right"] { top: 66%; right: 0; }

      /* Bottom Row Positioning */
      [data-position="bottom-left"] { bottom: 0; left: 0; }
      [data-position="bottom-center"] { bottom: 0; left: 50%; transform: translateX(-50%); }
      [data-position="bottom-right"] { bottom: 0; right: -0; }
      </style>
      <div class="wrapper">
              <div>
        <!-- Default Positioning -->
        <div class="slot-container" data-position="default" slot="default">
          <slot></slot>
        </div>
        <!-- Top Row -->
        <div class="slot-container" data-position="top-left">
          <slot name="top-left"></slot>
        </div>
        <div class="slot-container" data-position="top-center">
          <slot name="top-center"></slot>
        </div>
        <div class="slot-container" data-position="top-right">
          <slot name="top-right"></slot>
        </div>

        <!-- Middle Top Row -->
        <div class="slot-container" data-position="mid-top-left">
          <slot name="mid-top-left"></slot>
        </div>
        <div class="slot-container" data-position="mid-top-center">
          <slot name="mid-top-center"></slot>
        </div>
        <div class="slot-container" data-position="mid-top-right">
          <slot name="mid-top-right"></slot>
        </div>

        <!-- Middle Bottom Row -->
        <div class="slot-container" data-position="mid-bottom-left">
          <slot name="mid-bottom-left"></slot>
        </div>
        <div class="slot-container" data-position="mid-bottom-center">
          <slot name="mid-bottom-center"></slot>
        </div>
        <div class="slot-container" data-position="mid-bottom-right">
          <slot name="mid-bottom-right"></slot>
        </div>

        <!-- Bottom Row -->
        <div class="slot-container" data-position="bottom-left">
          <slot name="bottom-left"></slot>
        </div>
        <div class="slot-container" data-position="bottom-center">
          <slot name="bottom-center"></slot>
        </div>
        <div class="slot-container" data-position="bottom-right">
          <slot name="bottom-right"></slot>
        </div>
      </div>
      </div>
    `;
    // shadowRoot.innerHTML = defaultHTML;
    wrapper.innerHTML = defaultHTML;
    const style = document.createElement('style');
    style.textContent = `
      :host {
      position: relative;
      display: block;
      contain: content;
      }
    `;
    // shadowRoot.appendChild(style);
    shadowRoot.appendChild(wrapper);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    console.log(name, newValue
    );
    const containers = this.shadowRoot.querySelectorAll('.slot-container');
    
    switch(name) {
      case 'fixed':
        const position = this.hasAttribute('fixed') ? 'fixed' : 'absolute';
        containers.forEach(c => c.style.position = position);
        break;
      case 'x':
        this.style.left = `${newValue}px`;
        break;
      case 'y':
        this.style.top = `${newValue}px`;
        break;
      case 'position':
        containers.forEach(c => c.style.position = newValue);
        break;
    }
  }
}

customElements.define('absolute-container', AbsoluteContainer);
