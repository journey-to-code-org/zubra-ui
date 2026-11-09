# WCL Anchor Component

A flexible and enhanced anchor component that provides additional functionality over the native HTML anchor element.

## Installation

### Option 1: Using in HTML directly
```html
<!-- Add to your HTML head -->
<script type="module" src="/path/to/wcl/src/Anchor/index.js"></script>
```

### Option 2: Using in JavaScript modules
```js
import '/path/to/wcl/src/Anchor';
```

## Usage

The Anchor component can be used in two ways:

### 1. Customized Built-in Element

Extends the native `<a>` element with additional functionality:

```html
<a is="custom-anchor" href="/some-path">Click me</a>
```

#### Features
- Dispatches a custom `custom-anchor-click` event
- Maintains all native anchor functionality
- Enhanced click handling

### 2. Autonomous Custom Element

A fully customized anchor component with additional features:

```html
<wcl-anchor 
  href="/some-path"
  tooltip="Click to navigate"
  theme-color="#007bff">
  Click me
</wcl-anchor>
```

#### Attributes

| Attribute    | Type   | Default | Description                    |
|-------------|--------|----------|--------------------------------|
| href        | string | '#'      | URL to navigate to             |
| tooltip     | string | ''       | Tooltip text on hover          |
| theme-color | string | 'blue'   | Primary color for the element  |

#### Styling

The component uses Shadow DOM for style encapsulation and provides a themed appearance with:
- Custom hover effects
- Tooltip display
- Focus states
- Color theming

## Events

### Custom Anchor (`is="custom-anchor"`)
- `custom-anchor-click`: Fired when the anchor is clicked
  ```javascript
  document.querySelector('a[is="custom-anchor"]')
    .addEventListener('custom-anchor-click', (e) => {
      console.log(e.detail.message);
    });
  ```

## Browser Support

The component requires browsers that support:
- Custom Elements V1
- Shadow DOM V1
- ES2015+ (Modern JavaScript)

For older browsers, you may need to include the following polyfills:
```html
<script src="https://unpkg.com/@webcomponents/custom-elements"></script>
<script src="https://unpkg.com/@webcomponents/shadydom"></script>
```

## Examples

```html
<!-- Basic usage -->
<wcl-anchor href="/home">Home</wcl-anchor>

<!-- With tooltip -->
<wcl-anchor 
  href="/profile" 
  tooltip="View your profile">
  Profile
</wcl-anchor>

<!-- Custom themed -->
<wcl-anchor 
  href="/settings" 
  theme-color="#ff4444"
  tooltip="Change your settings">
  Settings
</wcl-anchor>
```
