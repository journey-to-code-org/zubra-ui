# Layout System Documentation

A flexible layout management system using Web Components, consisting of a `layout-manager` container and `layout-item` children that adapt to different layout modes.

## Components

### Layout Manager (`<layout-manager>`)

The main container component that controls the layout mode and properties.

```html
<layout-manager height="500px" width="100%">
  <layout-item>Content 1</layout-item>
  <layout-item>Content 2</layout-item>
</layout-manager>
```

### Layout Item (`<layout-item>`)

Child components that automatically adapt to the parent's layout mode.

## Layout Manager Attributes

- `mode` - Specifies the active layout mode (e.g., `"flex"`, `"grid"`, or `"block"`).
- `height` - Sets the height of the layout manager (default: "auto").
- `width` - Sets the width of the layout manager (default: "100%").

## Layout Item Attributes

### Flex Layout Attributes

- `flex-grow` - Growth factor (default: "0")
- `flex-shrink` - Shrink factor (default: "1")
- `flex-basis` - Initial main size (default: "auto")
- `order` - Order in flex container (default: "0")
- `align-self` - Individual alignment (default: "auto")

### Grid Layout Attributes

- `grid-column` - Grid column position (default: "auto")
- `grid-row` - Grid row position (default: "auto")
- `grid-area` - Named grid area (default: "auto")

### Block Layout Attributes

- `display` - Display mode when parent is in block/inline-block mode (default: "block")

## Examples

### Flex Layout Example

```html
<layout-manager>
  <layout-item flex-grow="1" align-self="center"> Flexible item </layout-item>
  <layout-item flex-shrink="0" order="2"> Fixed width item </layout-item>
</layout-manager>
```

### Grid Layout Example

```html
<layout-manager>
  <layout-item grid-column="1 / 3" grid-row="1">
    Spans two columns
  </layout-item>
  <layout-item grid-area="sidebar"> Named grid area </layout-item>
</layout-manager>
```

### Block Layout Example

```html
<layout-manager>
  <layout-item display="inline-block"> Inline block item </layout-item>
  <layout-item display="block"> Block item </layout-item>
</layout-manager>
```

### Flex Layout Example 2

```html
<layout-manager
  mode="flex"
  flex-direction="row"
  justify-content="space-between"
  align-items="center"
  flex-wrap="wrap"
>
  <layout-item>Item 1</layout-item>
  <layout-item>Item 2</layout-item>
  <layout-item>Item 3</layout-item>
</layout-manager>
```

### Grid Layout Example 2

```html
<layout-manager
  mode="grid"
  grid-template-columns="repeat(3, 1fr)"
  grid-template-rows="auto"
  grid-gap="10px"
>
  <layout-item>Item A</layout-item>
  <layout-item>Item B</layout-item>
  <layout-item>Item C</layout-item>
</layout-manager>
```

## Behavior

- Layout items automatically adapt to the parent layout-manager's current mode
- Previous layout styles are cleared when switching modes
- Only relevant attributes for the current layout mode are applied
- Supports dynamic addition/removal of child items
- Maintains proper style encapsulation using Shadow DOM

## Technical Details

- Layout items observe their attributes for changes
- Layout manager notifies children when layout mode changes
- Uses Shadow DOM for style encapsulation
- Supports programmatic layout changes
- Handles dynamic DOM updates

## Best Practices

By exposing these properties as attributes, the `<layout-manager>` component becomes more flexible and easier to configure programmatically or declaratively via HTML, while ensuring that only the relevant styles for the chosen layout mode are applied.

1. **Attribute Usage**

   - Only use attributes relevant to the intended layout mode
   - Provide fallback styles for different layout modes

2. **Layout Switching**

   - Test layout behavior across different modes
   - Consider transition effects when switching layouts

3. **Style Management**

   - Use the layout system for structural layout only
   - Apply visual styles (colors, borders, etc.) separately

4. **Performance**

   - Minimize dynamic layout changes
   - Batch DOM updates when possible

5. **Layout Mode**

- **`mode`**: Specifies the active layout mode (e.g., `"flex"`, `"grid"`, or `"block"`). This tells the manager which set of rules to apply to its children.

6. **Flex Layout Attributes (when `mode="flex"`)**

- **`flex-direction`**: Defines the main axis direction (e.g., `"row"` or `"column"`).
- **`justify-content`**: Aligns children along the main axis (e.g., `"flex-start"`, `"center"`, `"space-between"`).
- **`align-items`**: Aligns children along the cross axis (e.g., `"stretch"`, `"center"`).
- **`flex-wrap`**: Controls whether items should wrap onto multiple lines (e.g., `"nowrap"`, `"wrap"`).

7. **Grid Layout Attributes (when `mode="grid"`)**

- **`grid-template-columns`**: Defines column sizes (e.g., `"1fr 1fr"`, or a custom set of sizes).
- **`grid-template-rows`**: Sets row sizes.
- **`grid-gap`** or **`gap`**: Specifies the spacing between grid items.
- **`grid-auto-flow`**: Determines how items are automatically placed (e.g., `"row"`, `"column"`).

8. **Block Layout Attributes (when `mode="block"`)**

- **`display`**: Determines the display behavior (e.g., `"block"` or `"inline-block"`) if more control is needed at the container level.

9. **Advanced/Utility Attributes**

- **`responsive`**: A flag (or breakpoint settings) to enable responsive adjustments based on screen size.
- **`transition`**: Specifies transition effects when switching between layout modes, enhancing visual smoothness.
