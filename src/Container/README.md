# Container Web Components

## AppContainer

The `AppContainer` component is a flexible container that supports both grid and flex layouts. It allows customization of various attributes to control its appearance and behavior.

### Attributes

- `layout`: Specifies the layout type (`grid` or `flex`). Default is `grid`.
- `columns`: Number of columns (only applicable for grid layout). Default is `1`.
- `theme-color`: Background color of the container. Default is `#ffffff`.
- `padding`: Padding inside the container. Default is `16px`.
- `margin`: Margin outside the container. Default is `0`.
- `align-items`: Alignment of items along the cross axis. Default is `stretch`.
- `justify-items`: Alignment of items along the main axis. Default is `start`.
- `responsive`: If present, the container will adjust its layout for smaller screens.

### Example Usage

```html
<app-container layout="grid" columns="3" theme-color="#f0f0f0" padding="20px" margin="10px" align-items="center" justify-items="center" responsive>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</app-container>
```

## MasonryLayout

The `MasonryLayout` component creates a masonry-style layout with customizable columns and gaps between items.

### Attributes

- `columns`: Number of columns. Default is `3`.
- `column-gap`: Gap between columns. Default is `1rem`.
- `item-gap`: Gap between items within columns. Default is `1rem`.

### Example Usage

```html
<masonry-layout columns="4" column-gap="10px" item-gap="10px">
  <div slot="header">Header Content</div>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
  <div slot="footer">Footer Content</div>
</masonry-layout>
```

In this example, the `MasonryLayout` component will distribute the items into 4 columns with 10px gaps between columns and items. The header and footer content will be placed in their respective slots.
