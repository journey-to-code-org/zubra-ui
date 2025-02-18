import '../MasonryGrid/index.js';
import '../Loading/index.js';
import '../ContentModal/index.js';

// -----------------------------
// Define the gallery-image component
// -----------------------------
class GalleryImage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.mousePosition = { x: 0, y: 0 };
    }

    static get observedAttributes() {
        return ['srcset', 'sizes', 'src', 'alt', 'width', 'height', 'caption', 'thumbnail'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
        this.render();
    }

    connectedCallback() {
        console.log(this.thumbnail)
        this.render();
        const wrapper = this.shadowRoot.querySelector('.image-wrapper');

        wrapper.addEventListener('mouseenter', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const fromTop = y <= rect.height / 2;

            wrapper.classList.remove('from-top', 'from-bottom');
            wrapper.classList.add(fromTop ? 'from-top' : 'from-bottom');
        });

        // Ensure content-modal is in the document body
        if (!document.querySelector('content-modal')) {
            const modal = document.createElement('content-modal');
            document.body.appendChild(modal);
        }

        // Add click event to open modal with full-size image and caption
        wrapper.addEventListener('click', () => {
            const modal = document.querySelector('content-modal');
            if (modal) {
                modal.innerHTML = `
          <img src="${this.src}" alt="${this.alt}">
          <p style="margin-top: 10px;">${this.caption}</p>
        `;
                modal.open();
            } else {
                console.error('ContentModal element not found');
            }
        });
    }

    render() {
        const isPortrait = parseInt(this.height) > parseInt(this.width);
        // Updated the onerror to check for a fallback flag so it only runs once.
        this.shadowRoot.innerHTML = `
      <style>
        .image-wrapper {
          position: relative;
          overflow: hidden;
          cursor: pointer;
        }
        .responsive-image {
          width: 100%;
          height: auto;
          display: block;
        }
        figcaption {
          position: absolute;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 1rem;
          transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
          font-size: 0.9rem;
          opacity: 0;
        }
        .from-top figcaption {
          top: 0;
          transform: translateY(-100%);
        }
        .from-bottom figcaption {
          bottom: 0;
          transform: translateY(100%);
        }
        .image-wrapper:hover figcaption {
          transform: translateY(0);
          opacity: 1;
        }
        loading-flame-cubes {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .responsive-image.loaded + loading-flame-cubes {
          display: none;
        }
        .responsive-image.error {
          filter: grayscale(1);
          opacity: 0.7;
        }
      </style>
      <figure class="image-wrapper ${isPortrait ? 'portrait' : 'landscape'}">
          <img class="responsive-image" 
              srcset="${this.srcset}" 
              sizes="${this.sizes}" 
              src="${this.thumbnail}" 
              alt="${this.alt}"
              loading="lazy" 
              width="${this.width}" 
              height="${this.height}"
              onload="this.classList.add('loaded')"
              onerror="if(!this.dataset.fallback){console.error('Failed to load image:', this.src); this.dataset.fallback='true'; this.src='https://placehold.co/' + this.width + 'x' + this.height + '/e0e0e0/999999?text=Image+Not+Found'; this.classList.add('error'); this.classList.add('loaded');}">
          <loading-flame-cubes></loading-flame-cubes>
          <figcaption>${this.caption}</figcaption>
      </figure>
    `;
    }
}

customElements.define('gallery-image', GalleryImage);

// -----------------------------
// Define the merged image-gallery component
// -----------------------------
class ImageGallery extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.page = 1;
        this.loading = false;
        this._infinite = false;
        this.loadingThreshold = 0.5; // Load more when 50% of the sentinel is visible
    }

    static get observedAttributes() {
        return ['src', 'infinite', 'columns', 'column-gap', 'item-gap'];
    }

    get infinite() {
        return this._infinite;
    }

    set infinite(value) {
        this._infinite = (value === '' || value === 'true');
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'src') {
            if (newValue) {
                this.fetchData(newValue);
            }
        } else if (name === 'infinite') {
            this.infinite = newValue;
        } else if (name === 'columns' || name === 'column-gap' || name === 'item-gap') {
            // Update masonry-layout attributes directly
            const gallery = this.shadowRoot.querySelector('#imageGallery');
            if (gallery) {
                gallery.setAttribute(name, newValue);
            }
        }
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        #container {
          display: flex;
          flex-direction: column;
        }
        #sentinel {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 20px 0;
        }
      </style>
      <div id="container">
        <masonry-layout id="imageGallery" 
            columns="${this.getAttribute('columns') || 3}" 
            column-gap="${this.getAttribute('column-gap') || '10px'}" 
            item-gap="${this.getAttribute('item-gap') || '10px'}">
        </masonry-layout>
      </div>
    `;

        // Ensure content-modal exists
        if (!document.querySelector('content-modal')) {
            const modal = document.createElement('content-modal');
            document.body.appendChild(modal);
        }

        // Initial load
        if (this.hasAttribute('src')) {
            this.fetchData(this.getAttribute('src')).then(() => {
                if (this.infinite) {
                    this.setupInfiniteScroll();
                }
            });
        } else {
            this.createImages();
            if (this.infinite) {
                this.setupInfiniteScroll();
            }
        }
    }

    disconnectedCallback() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }

    // -----------------------------
    // Fetched Data Mode Methods
    // -----------------------------
    async fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            // Store the fetched data for later duplication if needed
            this.fetchedData = data;
            this.renderFetchedImages(data);
        } catch (error) {
            this.renderError(error);
        }
    }

    renderFetchedImage(placeholder, image) {
        const galleryImage = document.createElement('gallery-image');
        const imageUrl = image.fileName;
        const thumbnailUrl = `${image.fileName.replace(/^images\/web-/, 'images/thumbs/')}`;
        console.log(thumbnailUrl)
        galleryImage.setAttribute('src', imageUrl);
        galleryImage.setAttribute('thumbnail', thumbnailUrl);
        galleryImage.setAttribute('alt', image.fileName);
        galleryImage.setAttribute('width', image.dimensions.width);
        galleryImage.setAttribute('height', image.dimensions.height);
        galleryImage.setAttribute('caption', `Format: ${image.format} - ${image.size} bytes`);
        galleryImage.setAttribute('srcset', `${thumbnailUrl} 1x, ${thumbnailUrl} 2x`);
        galleryImage.setAttribute('sizes', '100vw');
        placeholder.replaceWith(galleryImage);
    };

    renderFetchedImages(data) {
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        const columns = parseInt(gallery.getAttribute('columns')) || 3;
        const columnGap = parseInt(gallery.getAttribute('column-gap')) || 10;
        const columnWidth = (gallery.clientWidth - (columns - 1) * columnGap) / columns;

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.renderFetchedImage(entry.target, entry.target.imageData);
                    observer.unobserve(entry.target);
                }
            });
        });

        data.forEach((image, index) => {
            const aspectRatio = image.dimensions.height / image.dimensions.width;
            const placeholderHeight = columnWidth * aspectRatio;
            const placeholder = document.createElement('div');
            placeholder.style.height = `${placeholderHeight}px`;
            placeholder.style.width = `${columnWidth}px`;
            placeholder.imageData = image;
            placeholder.setAttribute('slot', index % 5); // Assign slot from 0 to 4
            gallery.appendChild(placeholder);
            observer.observe(placeholder);
        });
    }

    // This method duplicates the fetched images (i.e. re-appends them)
    duplicateFetchedImages() {
        if (!this.fetchedData) return;
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        const galleryWidth = gallery.clientWidth;
        const columns = parseInt(gallery.getAttribute('columns')) || 3;
        const columnGap = parseInt(gallery.getAttribute('column-gap')) || 10;
        const columnWidth = (galleryWidth - (columns - 1) * columnGap) / columns;

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.renderFetchedImage(entry.target, entry.target.imageData);
                    observer.unobserve(entry.target);
                }
            });
        });

        this.fetchedData.forEach(image => {
            const aspectRatio = image.dimensions.height / image.dimensions.width;
            const placeholderHeight = columnWidth * aspectRatio;
            const placeholder = document.createElement('loading-flame-cubes');
            placeholder.style.height = `${placeholderHeight}px`;
            placeholder.style.width = `${columnWidth}px`;

            placeholder.imageData = image;
            gallery.appendChild(placeholder);
            observer.observe(placeholder);
        });
    }

    renderError(error) {
        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: red;
        }
      </style>
      <div>Error loading gallery: ${error.message}</div>
    `;
    }

    // -----------------------------
    // Random/Infinite Mode Methods
    // -----------------------------
    getPlaceholderUrl(width, height) {
        return `https://placehold.co/${width}x${height}/e0e0e0/999999`;
    }

    createImage(index) {
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        const randomWidth = () => Math.floor(Math.random() * 1000) + 400;
        const randomHeight = () => Math.floor(Math.random() * 1000) + 300;
        const width = randomWidth();
        const height = randomHeight();
        const selectedImage = `https://picsum.photos/seed/${Math.random()}/${width}/${height}`;
        const thumbnailUrl = `./thumbs/thumb-${selectedImage.split('/').pop()}`;

        const image = {
            srcset: `${selectedImage} 400w, ${selectedImage} 800w, ${selectedImage} 1200w`,
            sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
            src: selectedImage,
            thumbnail: thumbnailUrl,
            alt: "Random placeholder image",
            width: `${width}`,
            height: `${height}`,
            caption: "Responsive image with multiple sizes"
        };
        const galleryImage = document.createElement('gallery-image');
        galleryImage.setAttribute('srcset', image.srcset);
        galleryImage.setAttribute('sizes', image.sizes);
        galleryImage.setAttribute('src', image.src);
        galleryImage.setAttribute('thumbnail', image.thumbnail);
        galleryImage.setAttribute('alt', image.alt);
        galleryImage.setAttribute('width', image.width);
        galleryImage.setAttribute('height', image.height);
        galleryImage.setAttribute('caption', image.caption);
        galleryImage.setAttribute('slot', index % 5); // Assign slot from 0 to 4
        gallery.appendChild(galleryImage);
    }

    createImages() {
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        const columns = parseInt(gallery.getAttribute('columns')) || 3;
        const imagesToLoad = columns * 3; // For example, load 3 images per column

        for (let i = 0; i < imagesToLoad; i++) {
            this.createImage(i);
        }
    }

    async loadMoreImages() {
        if (this.loading) return;

        this.loading = true;
        try {
            // If a src attribute is provided, duplicate the fetched images;
            // otherwise, create random images.
            if (this.hasAttribute('src')) {
                this.duplicateFetchedImages();
            } else {
                this.createImages();
            }
            this.page++;
        } catch (error) {
            console.error('Failed to load more images:', error);
        } finally {
            this.loading = false;
        }
    }

    setupInfiniteScroll() {
        const container = this.shadowRoot.querySelector('#container');
        const sentinel = document.createElement('div');
        sentinel.id = 'sentinel';
        container.appendChild(sentinel);

        const loadingIndicator = document.createElement('loading-flame-cubes');
        loadingIndicator.style.display = 'none';
        sentinel.appendChild(loadingIndicator);

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.loading && this.infinite) {
                    loadingIndicator.style.display = 'block';
                    this.loadMoreImages().then(() => {
                        loadingIndicator.style.display = 'none';
                    });
                }
            });
        }, {
            rootMargin: '100px',
            threshold: this.loadingThreshold
        });

        this.observer.observe(sentinel);
    }
}

customElements.define('image-gallery', ImageGallery);
