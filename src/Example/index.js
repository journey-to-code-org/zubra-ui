import { generateRandomArticles } from "../../utils/randomGenerator.js";
("../../utils/randomGenerator.js");
class WebComponentsDemo extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <header>
        <absolute-container>
          <div slot="mid-top-center">
            <h1>Web Components Demo</h1>
            <p>
              A simple web components demo using custom elements, shadow DOM, and
              slots.
            </p>
          </div>
        </absolute-container>
      </header>
      <main>
        <slot></slot>
      </main>
      <footer>
        <absolute-container fixed>
          <div slot="bottom-center">
            <p> 
              <copy-right est="1989">Mikey Nichols</copy-right>
            </p>
          </div>
          <div>Floating in the middle</div>
            <div slot="bottom-right">
              <trade-mark before>Journey to Code</trade-mark>
            </div>
        </absolute-container>
        <absolute-container position="sticky">
            
        </absolute-container>
      </footer>
    `;

  }
}

customElements.define("demo-page1", WebComponentsDemo);
