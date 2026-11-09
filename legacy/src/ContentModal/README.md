
# ContentModal Component

The `ContentModal` component is a custom HTML element that provides a modal dialog with overlay functionality. 

## Usage

### Importing the Component

To use the `ContentModal` component, you need to import it into your project:

```javascript
import './path/to/ContentModal';
```

### Adding the Component to Your HTML

You can add the `ContentModal` component to your HTML as follows:

```html
<content-modal id="myModal">
    <p>Your content goes here...</p>
</content-modal>
```

### Opening and Closing the Modal

To open the modal, you can use the `open` method or set the `open` attribute:

```javascript
document.getElementById('myModal').open();
```

Or:

```html
<content-modal id="myModal" open>
    <p>Your content goes here...</p>
</content-modal>
```

To close the modal, you can use the `close` method or remove the `open` attribute:

```javascript
document.getElementById('myModal').close();
```

### Styling the Modal

The modal can be styled using CSS. The following classes are available for styling:

- `.modal-overlay`: Styles the overlay background.
- `.modal-content`: Styles the content area of the modal.
- `.close-btn`: Styles the close button.

### Example

Here is a complete example of using the `ContentModal` component:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ContentModal Example</title>
    <script type="module" src="./path/to/ContentModal.js"></script>
</head>
<body>
    <button id="openModalBtn">Open Modal</button>
    <content-modal id="myModal">
        <h2>Modal Title</h2>
        <p>This is the content of the modal.</p>
    </content-modal>

    <script>
        document.getElementById('openModalBtn').addEventListener('click', () => {
            document.getElementById('myModal').open();
        });
    </script>
</body>
</html>
```
