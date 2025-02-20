import { generateRandomArticles } from "../../utils/randomGenerator.js";
class DemoPage extends HTMLElement {
  static observedAttributes = ["theme-color", "layout-type"];
  
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    const template = document.createElement("template");
    template.id = "demo-page";
    const title = this.getAttribute("title") || "Layout Manager Demo";

    template.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 2rem;
          font-family: system-ui;
        }

        .demo-section {
          margin: 2rem 0;
          padding: 1.5rem;
          border: 1px solid #eee;
          border-radius: 8px;
          display: none;
        }

        .demo-section.active {
          display: block;
        }

        .tabs {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .tab-button {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 4px;
        }

        .tab-button.active {
          background: var(--theme-color);
          color: white;
          border-color: var(--theme-color);
        }

        .code-sample {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 4px;
          margin: 1rem 0;
          font-family: monospace;
        }

        .layout-visual {
          border: 2px dashed #ddd;
          padding: 1rem;
          margin: 1rem 0;
          min-height: 200px;
        }

        @media (prefers-color-scheme: dark) {
          .demo-section {
            border: 1px solid var(--theme-color-light-8);
          }
          .tab-button {
            background: var(--theme-text-color-light);
            color: var(--theme-color-light);
            border-color: var(--theme-color-light-8);
          }
          .tab-button.active {    
            background: var(--theme-color-light-8);
            color: var(--theme-text-color-light-8);
            border-color: var(--theme-text-color-light-8);
          }   
        }
      </style>

      <div class="demo-content">
        <h1>${title}</h1>
        <p>Explore different layout configurations using the Layout Manager.</p>
        
        <div class="tabs">
          <button class="tab-button" data-tab="absolute">Absolute Demo</button>
          <button class="tab-button active" data-tab="block">Block Demo</button>
          <button class="tab-button" data-tab="flex">Flex Demo</button>
          <button class="tab-button" data-tab="grid">Grid Demo</button>
          <button class="tab-button" data-tab="combined">Combined Layouts</button>
        </div>

        <!-- Absolute Layout Demo -->
        <div class="demo-section" data-tab-content="absolute">
          <h2>Absolute Layout</h2>
          <div class="layout-visual">
            <h3>Absolute Layout</h3>
            <div class="code-sample">
              &lt;absolute-container"&gt;...&lt;/layout-manager&gt;
            </div>
            <div >
                <absolute-container>
                    <div style="color: var(--theme-text-color-light-1); background: var(--theme-color-light-1); padding: 1rem;" >
                        Absolute Item 1
                    </div>
                    <div style="color: var(--theme-text-color-light-2); background: var(--theme-color-light-2); padding: 1rem;" slot="top-right">
                        Absolute Item 2
                    </div>
                    <div style="color: var(--theme-text-color-light-3); background: var(--theme-color-light-3); padding: 1rem;" slot="bottom-left">
                        Absolute Item 3
                    </div>
                    <div style="color: var(--theme-text-color-light-4); background: var(--theme-color-light-4); padding: 1rem;" slot="bottom-right">
                        Absolute Item 4
                    </div>
                </absolute-container>
            </div>
            <absolute-container>
              <div style="color: var(--theme-text-color-light-1); background: var(--theme-color-light-1); padding: 1rem;" slot="top-left">
                Absolute Item 5
              </div>
              <div style="color: var(--theme-text-color-light-2); background: var(--theme-color-light-2); padding: 1rem;" slot="top-right">
                Absolute Item 6
              </div>
              <div style="color: var(--theme-text-color-light-3); background: var(--theme-color-light-3); padding: 1rem;" slot="bottom-left">
                Absolute Item 7
              </div>
              <div style="color: var(--theme-text-color-light-4); background: var(--theme-color-light-4); padding: 1rem;" slot="bottom-right">
                Absolute Item 8
              </div>
            </absolute-container>

            <h3>Fixed Absolute Layout</h3>
            <div class="code-sample">
              &lt;layout-manager mode="inline-block"&gt;...&lt;/layout-manager&gt;
            </div>
            <absolute-container fixed>
              <div style="color: var(--theme-text-color-light-5); background: var(--theme-color-light-5); padding: 1rem;" slot="top-center">
                Fixed Item 1
              </div>
              <div style="color: var(--theme-text-color-light-6); background: var(--theme-color-light-6); padding: 1rem; " slot="mid-bottom-center">
                Fixed Item 2
              </div>
              <div style="color: var(--theme-text-color-light-7); background: var(--theme-color-light-7); padding: 1rem; " slot="bottom-center">
                Fixed Item 3
              </div>
            </absolute-container>


          </div>
        </div>

        <!-- Block Layout Demo -->
        <div class="demo-section active" data-tab-content="block">
          <h2>Block Layout</h2>
          <div class="layout-visual">
            <h3>Block Layout</h3>
            <div class="code-sample">
              &lt;layout-manager mode="block"&gt;...&lt;/layout-manager&gt;
            </div>
            <layout-manager mode="block">
              <div style="color: var(--theme-text-color-light-1); background: var(--theme-color-light-1); padding: 1rem;">
                Block Item 1
              </div>
              <div style="color: var(--theme-text-color-light-2); background: var(--theme-color-light-2); padding: 1rem;">
                Block Item 2
              </div>
              <div style="color: var(--theme-text-color-light-3); background: var(--theme-color-light-3); padding: 1rem;">
                Block Item 3
              </div>
              <div style="color: var(--theme-text-color-light-4); background: var(--theme-color-light-4); padding: 1rem;">
                Block Item 4
              </div>
            </layout-manager>

            <h3>Inline Block Layout</h3>
            <div class="code-sample">
              &lt;layout-manager mode="inline-block"&gt;...&lt;/layout-manager&gt;
            </div>
            <layout-manager mode="inline-block">
              <div style="color: var(--theme-text-color-light-5); background: var(--theme-color-light-5); padding: 1rem;">
                Inline Block Item 1
              </div>
              <div style="color: var(--theme-text-color-light-6); background: var(--theme-color-light-6); padding: 1rem;">
                Inline Block Item 2
              </div>
              <div style="color: var(--theme-text-color-light-7); background: var(--theme-color-light-7); padding: 1rem;">
                Inline Block Item 3
              </div>
            </layout-manager>
          </div>

        </div>

        <!-- Flex Layout Demo -->
        <div class="demo-section" data-tab-content="flex">
          <h2>Flex Layout</h2>
          <div class="code-sample">
            &lt;layout-manager mode="flex" flex-direction="row" justify-content="space-between"&gt;...&lt;/layout-manager&gt;
          </div>
          <layout-manager 
            mode="flex" 
            style="min-height: 300px;"
            flex-direction="row"
            justify-content="space-between"
            align-items="center">
            <div style="flex: 1; color: var(--theme-text-color-light-1); background: var(--theme-color-light-1); padding: 1rem;">
              Flex Item 1 (grow)
            </div>
            <div style="flex-shrink: 0; color: var(--theme-text-color-light-2); background: var(--theme-color-light-2); padding: 1rem;">
              Flex Item 2 (no shrink)
            </div>
            <div style="align-self: center; color: var(--theme-text-color-light-3); background: var(--theme-color-light-3); padding: 1rem;">
              Centered Item
            </div>
          </layout-manager>
        </div>

        <!-- Grid Layout Demo -->
        <div class="demo-section" data-tab-content="grid">
          <h2>Grid Layout</h2>
          <div class="code-sample">
            &lt;layout-manager mode="grid" grid-template-columns="repeat(3, 1fr)"&gt;...&lt;/layout-manager&gt;
          </div>
          <layout-manager 
            mode="grid" 
            style="height: 300px;"
            grid-template-columns="repeat(3, 1fr)"
            gap="10px">
            <div style="grid-column: span 2; color: var(--theme-text-color-light-4); background: var(--theme-color-light-4); padding: 1rem;">
              Wide Column
            </div>
            <div style="grid-row: span 2; color: var(--theme-text-color-light-5); background: var(--theme-color-light-5); padding: 1rem;">
              Tall Row
            </div>
            <div style="color: var(--theme-text-color-light-6); background: var(--theme-color-light-6); padding: 1rem;">
              Regular Cell
            </div>
          </layout-manager>
        </div>

        <!-- Combined Layouts Demo -->
        <div class="demo-section" data-tab-content="combined">
          <h2>Nested Layouts</h2>
          <layout-manager 
            mode="flex" 
            style="min-height: 400px;"
            flex-direction="row">
            <layout-manager 
              mode="grid"
              style="flex: 1; padding: 1rem;"
              grid-template-columns="1fr 1fr"
              grid-template-rows="100px auto"
              gap="10px">
              <div style="grid-column: 1 / 3; color: var(--theme-text-color-light-7); background: var(--theme-color-light-7); padding: 1rem;">
                Grid Header
              </div>
              <div style="color: var(--theme-text-color-light-8); background: var(--theme-color-light-8); padding: 1rem;">
                Grid Content
              </div>
              <div style="color: var(--theme-text-color-light-9); background: var(--theme-color-light-9); padding: 1rem;">
                Grid Sidebar
              </div>
            </layout-manager>
            <div style="flex: 0 0 250px; color: var(--theme-text-color-light-10); background: var(--theme-color-light-10); padding: 1rem;">
              Side Panel
            </div>
          </layout-manager>
        </div>
      </div>
    `;

    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.initTabSystem();
    this.updateThemeColor();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "theme-color") {
      this.updateThemeColor();
    }
  }

  updateThemeColor() {
    const getRandomHexColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
    const themeColor = this.getAttribute("theme-color") || getRandomHexColor();
    
    for (let i = 1; i <= 14; i++) {
      const adjustedColor = this.adjustColor(themeColor, i * 5);
      this.style.setProperty(`--theme-color-light-${i}`, adjustedColor);
      this.style.setProperty(`--theme-text-color-light-${i}`, this.getTextColor(adjustedColor));
    }
    
    this.style.setProperty("--theme-color", themeColor);
    this.style.setProperty("--theme-text-color", this.getTextColor(themeColor));
  }

  getTextColor(bgColor) {
    const color = bgColor.charAt(0) === "#" ? bgColor.substring(1, 7) : bgColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 125 ? "#000000" : "#FFFFFF";
  }

  adjustColor(color, percent) {
    let num = parseInt(color.slice(1), 16);
    let amt = Math.round(2.55 * percent);
    
    let R = Math.min(255, Math.max(0, (num >> 16) + amt));
    let G = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
    let B = Math.min(255, Math.max(0, (num & 0xff) + amt));
    
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`;
  }

  initTabSystem() {
    const tabs = this.shadowRoot.querySelectorAll(".tab-button");
    const contents = this.shadowRoot.querySelectorAll("[data-tab-content]");

    tabs.forEach(tab => {
      tab.addEventListener("click", () => {
        tabs.forEach(t => t.classList.remove("active"));
        contents.forEach(c => c.classList.remove("active"));
        
        tab.classList.add("active");
        const target = this.shadowRoot.querySelector(`[data-tab-content="${tab.dataset.tab}"]`);
        if (target) {
          target.classList.add("active");
        }
      });
    });
  }
}

customElements.define("demo-page", DemoPage);