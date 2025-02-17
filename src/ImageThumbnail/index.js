
class ImageThumbnail extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const getRandomImage = () => {
        const images = [
            'https://picsum.photos/400/300',
            'https://picsum.photos/800/600',
            'https://picsum.photos/1200/900'
        ];
        return images[Math.floor(Math.random() * images.length)];
    };

    const randomImage = getRandomImage();

    shadow.innerHTML = `
        <style>
            .image-wrapper {
                display: inline-block;
                margin: 0;
            }
            .responsive-image {
                width: 100%;
                height: auto;
            }
        </style>
        <figure class="image-wrapper">
            <img
                class="responsive-image"
                srcset="
                    ${randomImage} 400w,
                    ${randomImage} 800w,
                    ${randomImage} 1200w
                "
                sizes="(max-width: 768px) 100vw,
                             (max-width: 1200px) 50vw,
                             33vw"
                src="${randomImage}"
                alt="Random placeholder image"
                loading="lazy"
                width="800"
                height="600"
            />
            <figcaption>Responsive image with multiple sizes</figcaption>
        </figure>
    `;
  }
}

customElements.define('image-thumbnail', ImageThumbnail);
