
### Flex Layout Example 1

```html
<layout-manager>
  <layout-item flex-grow="1" align-self="center"> Flexible item </layout-item>
  <layout-item flex-shrink="0" order="2"> Fixed width item </layout-item>
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

6. **Flex Layout Attributes (when `mode="flex"`)**

- **`flex-direction`**: Defines the main axis direction (e.g., `"row"` or `"column"`).
- **`justify-content`**: Aligns children along the main axis (e.g., `"flex-start"`, `"center"`, `"space-between"`).
- **`align-items`**: Aligns children along the cross axis (e.g., `"stretch"`, `"center"`).
- **`flex-wrap`**: Controls whether items should wrap onto multiple lines (e.g., `"nowrap"`, `"wrap"`).