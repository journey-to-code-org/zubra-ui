import '../Container/index.js';
import '../Loading/index.js';
import '../ContentModal/index.js'; // Import ContentModal

class GalleryImage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.mousePosition = { x: 0, y: 0 };
    }

    static get observedAttributes() {
        return ['srcset', 'sizes', 'src', 'alt', 'width', 'height', 'caption'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this[name] = newValue;
        this.render();
    }

    connectedCallback() {
        this.render();
        const wrapper = this.shadowRoot.querySelector('.image-wrapper');

        wrapper.addEventListener('mouseenter', (e) => {
            const rect = wrapper.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const fromTop = y <= rect.height / 2;

            wrapper.classList.remove('from-top', 'from-bottom');
            wrapper.classList.add(fromTop ? 'from-top' : 'from-bottom');
        });

        // Add click event to open modal with full-size image
        wrapper.addEventListener('click', () => {
            const modal = document.querySelector('content-modal');
            modal.innerHTML = `<img src="${this.src}" alt="${this.alt}" style="width: 100%; height: auto;">`;
            modal.open();
        });
    }

    render() {
        const isPortrait = parseInt(this.height) > parseInt(this.width);
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
                    src="${this.src}" 
                    alt="${this.alt}"
                    loading="lazy" 
                    width="${this.width}" 
                    height="${this.height}"
                    onload="this.classList.add('loaded')"
                    onerror="this.src='https://placehold.co/' + this.width + 'x' + this.height + '/e0e0e0/999999?text=Image+Not+Found'; this.classList.add('error'); this.classList.add('loaded');">
                <loading-flame-cubes></loading-flame-cubes>
                <figcaption>${this.caption}</figcaption>
            </figure>
        `;
    }
}

customElements.define('gallery-image', GalleryImage);

class ImageGallery extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.page = 1;
        this.loading = false;
        this._infinite = false;
        this.loadingThreshold = 0.5; // Load more when 50% of sentinel is visible
        this.resizeTimeout = null;
        this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
    }

    static get observedAttributes() {
        return ['infinite'];
    }

    get infinite() {
        return this._infinite;
    }

    set infinite(value) {
        this._infinite = value === '' || value === 'true';
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'infinite') {
            this.infinite = newValue;
        }
    }

    setupInfiniteScroll() {
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        if (!gallery) return;

        // Create and style sentinel element
        const sentinel = document.createElement('div');
        sentinel.id = 'sentinel';
        sentinel.style.width = '100%';
        sentinel.style.height = '50px';
        sentinel.style.marginTop = '20px';
        gallery.after(sentinel);

        // Create loading indicator
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
            root: null,
            rootMargin: '100px',
            threshold: this.loadingThreshold
        });

        this.observer.observe(sentinel);
    }

    async loadMoreImages() {
        if (this.loading) return;

        this.loading = true;
        try {
            await this.createImages();
            this.page++;
        } catch (error) {
            console.error('Failed to load more images:', error);
        } finally {
            this.loading = false;
        }
    }

    getPlaceholderUrl(width, height) {
        return `https://placehold.co/${width}x${height}/e0e0e0/999999`;
    }

    createImage() {
        const randomWidth = () => Math.floor(Math.random() * 1000) + 400;
        const randomHeight = () => Math.floor(Math.random() * 1000) + 300;
        const width = randomWidth();
        const height = randomHeight();
        const fallbackUrl = this.getPlaceholderUrl(width, height);
        const selectedImage = `https://picsum.photos/seed/${Math.random()}/${width}/${height}`;

        const image = {
            srcset: `${selectedImage} 400w, ${selectedImage} 800w, ${selectedImage} 1200w`,
            sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
            src: selectedImage,
            alt: "Random placeholder image",
            width: `${width}`,
            height: `${height}`,
            caption: "Responsive image with multiple sizes"
        };
        const galleryImage = document.createElement('gallery-image');
        galleryImage.setAttribute('srcset', image.srcset);
        galleryImage.setAttribute('sizes', image.sizes);
        galleryImage.setAttribute('src', image.src);
        galleryImage.setAttribute('alt', image.alt);
        galleryImage.setAttribute('width', image.width);
        galleryImage.setAttribute('height', image.height);
        galleryImage.setAttribute('caption', image.caption);
        this.shadowRoot.querySelector('#imageGallery').appendChild(galleryImage);

    }

    createImages() {
        const randomWidth = () => Math.floor(Math.random() * 1000) + 400;
        const randomHeight = () => Math.floor(Math.random() * 1000) + 300;
        const randomCaption = () => {
            const captions = [
                "A beautiful scenery",
                "An amazing sunset",
                "A stunning landscape",
                "A picturesque view",
                "A breathtaking moment",
                "A serene environment",
                "A captivating scene",
                "A lovely snapshot",
                "A charming picture",
                "A delightful image",
                "A tranquil beach",
                "A vibrant cityscape",
                "A majestic mountain",
                "A peaceful forest",
                "A bustling market",
                "A quiet village",
                "A historic landmark",
                "A colorful garden",
                "A snowy landscape",
                "A starry night",
                "A lively festival",
                "A serene lake",
                "A rustic cabin",
                "A golden field",
                "A misty morning",
                "A crystal-clear river",
                "A dramatic cliff",
                "A cozy cottage",
                "A winding road",
                "A hidden waterfall",
                "A lush valley",
                "A charming street",
                "A radiant sunrise",
                "A foggy forest",
                "A tranquil pond",
                "A vibrant sunset",
                "A picturesque harbor",
                "A scenic overlook",
                "A peaceful meadow",
                "A bustling city"
            ];
            return captions[Math.floor(Math.random() * captions.length)];
        };
        const images = Array.from({ length: 9 }, () => {

            const width = randomWidth();
            const height = randomHeight();
            const fallbackUrl = this.getPlaceholderUrl(width, height);
            const selectedImage = `https://picsum.photos/seed/${Math.random()}/${width}/${height}`;

            return {
                srcset: `${selectedImage} 400w, ${selectedImage} 800w, ${selectedImage} 1200w`,
                sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw",
                src: selectedImage,
                alt: "Random placeholder image",
                width: `${width}`,
                height: `${height}`,
                caption: randomCaption()
            };
        });

        images.forEach(image => {
            const galleryImage = document.createElement('gallery-image');
            galleryImage.setAttribute('srcset', image.srcset);
            galleryImage.setAttribute('sizes', image.sizes);
            galleryImage.setAttribute('src', image.src);
            galleryImage.setAttribute('alt', image.alt);
            galleryImage.setAttribute('width', image.width);
            galleryImage.setAttribute('height', image.height);
            galleryImage.setAttribute('caption', image.caption);
            this.shadowRoot.querySelector('#imageGallery').appendChild(galleryImage);
        });
        const pageImages = images.map(image => ({
            ...image,
            src: `${image.src}?page=${this.page}`,
            srcset: image.srcset.split(', ').map(set => `${set.split(' ')[0]}?page=${this.page} ${set.split(' ')[1]}`).join(', '),
            caption: `${image.caption} (Set ${this.page})`
        }));

        pageImages.forEach(image => {
            this.createImage();
        });
    }

    handleResize(entries) {
        // Debounce resize events
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            this.recalculateLayout();
        }, 250); // Wait for resize to finish
    }

    recalculateLayout() {
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        if (!gallery) return;

        const columns = parseInt(gallery.getAttribute('columns')) || 3;
        const images = Array.from(gallery.children);

        // Sort images by their natural height to create more balanced columns
        images.sort((a, b) => {
            const heightA = parseInt(a.getAttribute('height'));
            const heightB = parseInt(b.getAttribute('height'));
            return heightB - heightA;
        });

        // Clear gallery
        while (gallery.firstChild) {
            gallery.removeChild(gallery.firstChild);
        }

        // Reinsert images in sorted order
        images.forEach(image => {
            gallery.appendChild(image);
        });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                }
                #sentinel {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                loading-flame-cubes {
                    margin: 20px 0;
                }
            </style>
            <div style="display: flex; flex-direction: column;">
                <masonry-layout id="imageGallery" 
                    columns="${this.getAttribute('columns') || 3}" 
                    column-gap="${this.getAttribute('column-gap') || '10px'}" 
                    item-gap="${this.getAttribute('item-gap') || '10px'}">
                </masonry-layout>
                <content-modal></content-modal> <!-- Add ContentModal here -->
            </div>
        `;

        this.createImages();

        // Setup infinite scroll if enabled
        if (this.infinite) {
            this.setupInfiniteScroll();
        }

        // Observe gallery for resize events
        const gallery = this.shadowRoot.querySelector('#imageGallery');
        if (gallery) {
            this.resizeObserver.observe(gallery);
        }
    }

    disconnectedCallback() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
    }
}

customElements.define('image-gallery', ImageGallery);