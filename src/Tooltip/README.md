# Tooltip Web Component

The `wcl-tooltip` web component provides a simple way to add tooltips to your web application. This component uses the Shadow DOM for style encapsulation and supports both mouse and keyboard interactions.

## Usage

### Installation

Include the `wcl-tooltip` component in your project by importing the JavaScript file:

```html
<script src="path/to/Tooltip/index.js"></script>
```

### Basic Example

To use the `wcl-tooltip` component, wrap the element you want to have a tooltip with the `wcl-tooltip` tag and provide the tooltip text using the `tooltip` attribute:

```html
<wcl-tooltip tooltip="This is a tooltip">
  <button>Hover or focus me</button>
</wcl-tooltip>
```

### Customizing Tooltip Text

You can customize the tooltip text by setting the `tooltip` attribute:

```html
<wcl-tooltip tooltip="Custom tooltip text">
  <span>Hover or focus me</span>
</wcl-tooltip>
```

### Accessibility

The `wcl-tooltip` component automatically links the trigger element with the tooltip for accessibility using the `aria-describedby` attribute.

### Styling

The tooltip is styled using the following default CSS:

```css
:host {
  position: relative;
  display: inline-block;
}
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
:host([visible]) .tooltip {
  visibility: visible;
  opacity: 1;
}
```

You can override these styles by adding custom CSS to your project.

## Methods

The `wcl-tooltip` component does not expose any public methods. Tooltip visibility is controlled automatically based on mouse and keyboard interactions.

## Events

The `wcl-tooltip` component does not emit any custom events.

## License

This project is licensed under the MIT License.
