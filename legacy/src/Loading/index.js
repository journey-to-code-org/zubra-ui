const flameCubesStyles = `
.loader {
    --cell-size: 52px;
    --cell-spacing: 1px;
    --cells: 3;
    --total-size: calc(var(--cells) * (var(--cell-size) + 2 * var(--cell-spacing)));
    display: flex;
    flex-wrap: wrap;
    width: var(--total-size);
    height: var(--total-size);
    transform: rotate(45deg);
    flex-direction: column;
    }
    
    .cell {
    flex: 0 0 var(--cell-size);
    margin: var(--cell-spacing);
    background-color: transparent;
    box-sizing: border-box;
    border-radius: 4px;
    animation: 1.5s flame ease infinite;
    }
    
    .cell.d-1 { animation-delay: 100ms; }
    .cell.d-2 { animation-delay: 200ms; }
    .cell.d-3 { animation-delay: 300ms; }
    .cell.d-4 { animation-delay: 400ms; }
    
    /* Fire colors from top (cooler) to bottom (hot) */
    .cell:nth-child(1) { --cell-color: #FFD700; }  /* Golden yellow */
    .cell:nth-child(2) { --cell-color: #FFC800; }
    .cell:nth-child(3) { --cell-color: #FFB600; }
    .cell:nth-child(4) { --cell-color: #FFA500; }
    .cell:nth-child(5) { --cell-color: #FF9300; }
    .cell:nth-child(6) { --cell-color: #FF8100; }
    .cell:nth-child(7) { --cell-color: #FF7000; }
    .cell:nth-child(8) { --cell-color: #FF5E00; }
    .cell:nth-child(9) { --cell-color: #FF4D00; }  /* Hot orange-red */
    
    @keyframes flame {
    0% {
      background-color: transparent;
      transform: translateY(0);
    }
    30% {
      background-color: var(--cell-color);
      transform: translateY(-10px);
    }
    60% {
      background-color: transparent;
      transform: translateY(-20px);
    }
    100% {
      background-color: transparent;
      transform: translateY(-30px);
    }
    }
`;

const dancingCubesStyles = `
@keyframes square-animation {
 0% {
  left: 0;
  top: 0;
 }

 10.5% {
  left: 0;
  top: 0;
 }

 12.5% {
  left: 32px;
  top: 0;
 }

 23% {
  left: 32px;
  top: 0;
 }

 25% {
  left: 64px;
  top: 0;
 }

 35.5% {
  left: 64px;
  top: 0;
 }

 37.5% {
  left: 64px;
  top: 32px;
 }

 48% {
  left: 64px;
  top: 32px;
 }

 50% {
  left: 32px;
  top: 32px;
 }

 60.5% {
  left: 32px;
  top: 32px;
 }

 62.5% {
  left: 32px;
  top: 64px;
 }

 73% {
  left: 32px;
  top: 64px;
 }

 75% {
  left: 0;
  top: 64px;
 }

 85.5% {
  left: 0;
  top: 64px;
 }

 87.5% {
  left: 0;
  top: 32px;
 }

 98% {
  left: 0;
  top: 32px;
 }

 100% {
  left: 0;
  top: 0;
 }
}

.loader {
 position: relative;
 width: 96px;
 height: 96px;
 transform: rotate(45deg);
}

.loader-square {
 position: absolute;
 top: 0;
 left: 0;
 width: 28px;
 height: 28px;
 margin: 2px;
 border-radius: 0px;
 background: white;
 background-size: cover;
 background-position: center;
 background-attachment: fixed;
 animation: square-animation 10s ease-in-out infinite both;
}

.loader-square:nth-of-type(0) {
 animation-delay: 0s;
}

.loader-square:nth-of-type(1) {
 animation-delay: -1.4285714286s;
}

.loader-square:nth-of-type(2) {
 animation-delay: -2.8571428571s;
}

.loader-square:nth-of-type(3) {
 animation-delay: -4.2857142857s;
}

.loader-square:nth-of-type(4) {
 animation-delay: -5.7142857143s;
}

.loader-square:nth-of-type(5) {
 animation-delay: -7.1428571429s;
}

.loader-square:nth-of-type(6) {
 animation-delay: -8.5714285714s;
}

.loader-square:nth-of-type(7) {
 animation-delay: -10s;
}
`;

class LoadingFlameCubes extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
        <style>
        ${flameCubesStyles}
        </style>
        <div class="loader">
          <div class="cell d-4"></div>
          <div class="cell d-3"></div>
          <div class="cell d-2"></div>

          <div class="cell d-3"></div>
          <div class="cell d-2"></div>
          <div class="cell d-1"></div>

          <div class="cell d-2"></div>
          <div class="cell d-1"></div>
          <div class="cell d-0"></div>
        </div>
        `;
  }
}

class LoadingDancingCubes extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
    <style>
    ${dancingCubesStyles}
    </style>
    <div class="loader">
      <div class="loader-square"></div>
      <div class="loader-square"></div>
      <div class="loader-square"></div>
      <div class="loader-square"></div>
      <div class="loader-square"></div>
      <div class="loader-square"></div>
      <div class="loader-square"></div>
    </div>
    `;
  }
}

customElements.define("loading-flame-cubes", LoadingFlameCubes);
customElements.define("loading-dancing-cubes", LoadingDancingCubes);
