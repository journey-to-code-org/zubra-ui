# ImageGallery Component Documentation

## Overview

**ImageGallery** is a standalone web component for creating a modular, metadata-driven photo gallery. It dynamically loads image data from an external JSON file and renders a gallery complete with image thumbnails and detailed metadata.

## Features

- **Dynamic Data Loading**: Fetches image data from a specified JSON file.
- **Metadata Extraction**: Displays image details such as file name, dimensions, format, size, and EXIF metadata.
- **Modular & Reusable**: Easily embed the component anywhere in your project.
- **Customizable Styling**: Supports CSS custom properties for theme and style adjustments.
- **Accessibility**: Built with keyboard navigation and ARIA attributes for improved usability.

## Installation

Include the ImageGallery component in your project by importing its JavaScript module:

```html
<script type="module" src="path/to/image-gallery.js"></script>
```

## Usage

Add the `<image-gallery>` element to your HTML and set the `src` attribute to the URL of your JSON file:

```html
<image-gallery src="path/to/photos.json"></image-gallery>
```

### Attribute Details

- **`src`**:  
  - **Type**: URL (string)  
  - **Description**: Points to the JSON file containing the image metadata.  
  - **Example**: `<image-gallery src="data/photos.json"></image-gallery>`
- **`infinite`**:  
  - **Type**: Boolean (string)  
  - **Description**: Enables infinite scrolling to load more images as the user scrolls.  
  - **Example**: `<image-gallery src="data/photos.json" infinite></image-gallery>`
- **`columns`**:  
  - **Type**: Number (string)  
  - **Description**: Specifies the number of columns in the gallery layout.  
  - **Example**: `<image-gallery src="data/photos.json" columns="4"></image-gallery>`
- **`column-gap`**:  
  - **Type**: CSS Length (string)  
  - **Description**: Sets the gap between columns.  
  - **Example**: `<image-gallery src="data/photos.json" column-gap="20px"></image-gallery>`
- **`item-gap`**:  
  - **Type**: CSS Length (string)  
  - **Description**: Sets the gap between items within each column.  
  - **Example**: `<image-gallery src="data/photos.json" item-gap="15px"></image-gallery>`

## JSON Data Format

The JSON file should contain an array of objects, where each object represents an image and its metadata. Below is an example structure:

```json
[
  {
    "fileName": "1-19 087.jpg",
    "dimensions": {
      "width": 2748,
      "height": 3664
    },
    "format": "jpeg",
    "size": 1883091,
    "creationDate": "2025-02-18T01:46:12.282Z",
    "modificationDate": "2009-05-19T20:45:38.000Z",
    "exif": {
      "make": "EASTMAN KODAK COMPANY",
      "model": "KODAK EASYSHARE C1013 DIGITAL CAMERA",
      "dateTimeOriginal": 1242141599,
      "description": "N/A",
      "author": "N/A",
      "software": "N/A",
      "location": {
        "latitude": "N/A",
        "longitude": "N/A"
      },
      "exposureTime": 0.005,
      "fNumber": 2.7,
      "iso": 64,
      "focalLength": 6.1
    }
  },
  {
    "fileName": "1-19 105.jpg",
    "dimensions": {
      "width": 2748,
      "height": 3664
    },
    "format": "jpeg",
    "size": 818945,
    "creationDate": "2025-02-18T01:46:12.283Z",
    "modificationDate": "2009-05-19T20:45:58.000Z",
    "exif": {
      "make": "EASTMAN KODAK COMPANY",
      "model": "KODAK EASYSHARE C1013 DIGITAL CAMERA",
      "dateTimeOriginal": 1242486312,
      "description": "N/A",
      "author": "N/A",
      "software": "N/A",
      "location": {
        "latitude": "N/A",
        "longitude": "N/A"
      },
      "exposureTime": 0.016667,
      "fNumber": 2.7,
      "iso": 160,
      "focalLength": 6.1
    }
  },
  {
    "fileName": "1-19 113.jpg",
    "dimensions": {
      "width": 3664,
      "height": 2748
    },
    "format": "jpeg",
    "size": 1924943,
    "creationDate": "2025-02-18T01:46:12.285Z",
    "modificationDate": "2009-05-19T20:46:06.000Z",
    "exif": {
      "make": "EASTMAN KODAK COMPANY",
      "model": "KODAK EASYSHARE C1013 DIGITAL CAMERA",
      "dateTimeOriginal": 1242488292,
      "description": "N/A",
      "author": "N/A",
      "software": "N/A",
      "location": {
        "latitude": "N/A",
        "longitude": "N/A"
      },
      "exposureTime": 0.002,
      "fNumber": 2.7,
      "iso": 64,
      "focalLength": 6.1
    }
  }
]
```

## Component Behavior

When initialized, the `ImageGallery` component will:

1. **Fetch and Parse JSON Data**: Retrieve the JSON file from the URL specified in the `src` attribute and parse the image metadata.
2. **Render the Gallery**: Dynamically create the gallery layout, displaying each image along with its metadata.
3. **Handle Errors**: Show a friendly error message if the JSON file fails to load or if the data is invalid.
4. **Infinite Scroll**: If the `infinite` attribute is set, the component will load more images as the user scrolls down.

## Customization and Styling

The component encapsulates its styles using Shadow DOM, but you can still customize its appearance using CSS custom properties. For example:

```css
image-gallery {
  --gallery-background: #f5f5f5;
  --thumbnail-border: 2px solid #ccc;
  --thumbnail-hover-border: 2px solid #999;
}
```

Override these variables in your stylesheet to match your design preferences.

## Accessibility

The ImageGallery component is built with accessibility in mind:

- **Keyboard Navigation**: Navigate through the gallery using the keyboard.
- **ARIA Attributes**: Utilizes appropriate ARIA roles and properties to ensure compatibility with assistive technologies.

## Browser Support

ImageGallery is developed using modern web standards such as ES6 modules and the Shadow DOM API. It is best supported in modern browsers. For older browsers, consider including polyfills.

## Example Integration

Below is a simple example demonstrating how to integrate the ImageGallery component into your HTML:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ImageGallery Example</title>
  <script type="module" src="path/to/image-gallery.js"></script>
  <style>
    image-gallery {
      display: block;
      max-width: 800px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <h1>My Photo Gallery</h1>
  <image-gallery src="photos.json" infinite columns="4" column-gap="20px" item-gap="15px"></image-gallery>
</body>
</html>
```

## Conclusion

The **ImageGallery** component provides an easy, modular way to integrate a photo gallery with rich metadata into your web projects. By separating data (via the JSON file) from presentation, it allows for easy updates and customization.

For more information or to contribute, please refer to the project repository or the official documentation site.

*Last updated: 2025-02-17*