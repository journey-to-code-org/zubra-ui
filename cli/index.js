#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const [, , command, componentName] = process.argv;

// Update components directory path
const componentsDir = path.resolve(__dirname, "../src");

function findComponentsFolder() {
  const componentsPath = path.resolve(process.cwd(), "./src/components");
  if (fs.existsSync(componentsPath)) {
    return componentsPath;
  }
  const srcPath = path.resolve(process.cwd(), "./src/components");
  if (fs.existsSync(srcPath)) {
    return srcPath;
  }
  return path.resolve(process.cwd(), "./src/components");
}

function extractCustomElements(filePath) {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const customElements = [];
  const customElementRegex = /customElements\.define\(['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = customElementRegex.exec(fileContent)) !== null) {
    customElements.push(match[1]);
  }
  return customElements;
}

function injectScriptTag(htmlFilePath) {
  const fileContent = fs.readFileSync(htmlFilePath, "utf-8");
  const scriptTag = `<script type="module" src="./components/map.js"></script>`;
  if (!fileContent.includes(scriptTag)) {
    const updatedContent = fileContent.replace(
      "</head>",
      `${scriptTag}\n</head>`
    );
    fs.writeFileSync(htmlFilePath, updatedContent, "utf-8");
    console.log(`Injected script tag into ${htmlFilePath}`);
  } else {
    console.log(`Script tag already exists in ${htmlFilePath}`);
  }
}

function removeScriptTags(htmlFilePath) {
  const fileContent = fs.readFileSync(htmlFilePath, "utf-8");
  const scriptTag = `<script type="module" src="./components/map.js"></script>`;
  if (fileContent.includes(scriptTag)) {
    const updatedContent = fileContent.replace(scriptTag, "").replace(/^\s*$(?:\r\n?|\n)/gm, "");
    fs.writeFileSync(htmlFilePath, updatedContent, "utf-8");
    console.log(`Removed script tag from ${htmlFilePath}`);
  } else {
    console.log(`Script tag not found in ${htmlFilePath}`);
  }
}

function injectImportStatement(jsFilePath, importPath) {
  const fileContent = fs.readFileSync(jsFilePath, "utf-8");
  const importStatement = `import '${importPath}';\n`;
  if (!fileContent.includes(importStatement)) {
    const updatedContent = importStatement + fileContent;
    fs.writeFileSync(jsFilePath, updatedContent, "utf-8");
    console.log(`Injected import statement into ${jsFilePath}`);
  } else {
    console.log(`Import statement already exists in ${jsFilePath}`);
  }
}
if (command === 'boilerplate' || command === 'init') { 
    const srcDir = path.resolve(process.cwd(), "./src");
    const htmlFilePath = path.resolve(srcDir, "index.html");
    const componentsDir = path.resolve(srcDir, "components");
    const mapFilePath = path.resolve(componentsDir, "map.js");

    // Ensure ./src directory exists
    if (!fs.existsSync(srcDir)) {
        fs.mkdirSync(srcDir, { recursive: true });
        console.log(`Created directory: ${srcDir}`);
    }

    // Ensure ./src/components directory exists
    if (!fs.existsSync(componentsDir)) {
        fs.mkdirSync(componentsDir, { recursive: true });
        console.log(`Created directory: ${componentsDir}`);
    }

    // Ensure ./src/components/map.js file exists
    if (!fs.existsSync(mapFilePath)) {
        fs.writeFileSync(mapFilePath, "", "utf-8");
        console.log(`Created ${mapFilePath}`);
    }

    // Check if index.html exists in the current working directory
    const existingHtmlFilePath = path.resolve(process.cwd(), "index.html");
    if (fs.existsSync(existingHtmlFilePath)) {
        fs.renameSync(existingHtmlFilePath, htmlFilePath);
        console.log(`Moved existing index.html to ${htmlFilePath}`);
    } else if (!fs.existsSync(htmlFilePath)) {
        // Create a basic HTML boilerplate if index.html does not exist
        const boilerplateContent = `<!DOCTYPE html>
<html lang="en">
<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Web Component Library</title>
        <script type="module" src="./components/map.js"></script>
</head>
<body>
        <h1>Welcome to Web Component Library</h1>
</body>
</html>`;
        fs.writeFileSync(htmlFilePath, boilerplateContent, "utf-8");
        console.log(`Created new index.html at ${htmlFilePath}`);
    } else {
        console.log(`index.html already exists at ${htmlFilePath}`);
    }

    // Inject script tag into index.html if it exists
    if (fs.existsSync(htmlFilePath)) {
        injectScriptTag(htmlFilePath);
    }
}
if (
  (command === "install" && componentName === "all") ||
  (command === "i" && componentName === "all")
) {
  const destDir = findComponentsFolder();
  const componentsDir = path.resolve(__dirname, "../src");
  const components = fs.readdirSync(componentsDir);
  components.forEach((component) => {
    const destComponentDir = path.join(destDir, component);
    const destPath = path.join(destComponentDir, "index.js");

    if (fs.existsSync(destPath)) {
      fs.unlinkSync(destPath);
    }

    const componentPath = path.join(componentsDir, component, "index.js");

    try {
      if (!fs.existsSync(componentPath)) {
        throw new Error(`Component ${component} not found in ${componentsDir}`);
      }

      // Create component directory if it doesn't exist
      if (!fs.existsSync(destComponentDir)) {
        fs.mkdirSync(destComponentDir, { recursive: true });
      }

      fs.copyFileSync(componentPath, destPath);
      console.log(`Successfully installed ${component} to ${destPath}`);

      const customElements = extractCustomElements(destPath);
      if (customElements.length > 0) {
        console.log(`Custom elements defined in ${component}:`);
        customElements.forEach((element) => console.log(`- ${element}`));
      } else {
        console.log(`No custom elements defined in ${component}`);
      }
      const htmlFilePath = path.resolve(process.cwd(), "./src/index.html");

      const mapFilePath = path.resolve(
        process.cwd(),
        "./src/components/map.js"
      );
      if (!fs.existsSync(mapFilePath)) {
        fs.writeFileSync(mapFilePath, "", "utf-8");
        console.log(`Created ${mapFilePath}`);
      }
      injectImportStatement(mapFilePath, `./${component}/index.js`);

      // Inject map.js into index.html
      if (fs.existsSync(htmlFilePath)) {
        injectScriptTag(htmlFilePath, "./components/map.js");
      }
    } catch (error) {
      console.error(`Installation failed: ${error.message}`);
      process.exit(1);
    }
  });
} else if (
  (command === "install" && componentName) ||
  (command === "i" && componentName)
) {
  const destDir = findComponentsFolder();
  const destComponentDir = path.join(destDir, componentName);
  const destPath = path.join(destComponentDir, "index.js");

  if (fs.existsSync(destPath)) {
    fs.unlinkSync(destPath);
    console.log(`Uninstalled old version of ${componentName} from ${destPath}`);
  }

  const componentPath = path.join(componentsDir, componentName, "index.js");

  try {
    if (!fs.existsSync(componentPath)) {
      throw new Error(
        `Component ${componentName} not found in ${componentsDir}`
      );
    }

    // Create component directory if it doesn't exist
    if (!fs.existsSync(destComponentDir)) {
      fs.mkdirSync(destComponentDir, { recursive: true });
    }

    fs.copyFileSync(componentPath, destPath);
    console.log(`Successfully installed ${componentName} to ${destPath}`);

    const customElements = extractCustomElements(destPath);
    if (customElements.length > 0) {
      console.log(`Custom elements defined in ${componentName}:`);
      customElements.forEach((element) => console.log(`- ${element}`));
    } else {
      console.log(`No custom elements defined in ${componentName}`);
    }
    const htmlFilePath = path.resolve(process.cwd(), "./src/index.html");

    const mapFilePath = path.resolve(process.cwd(), "./src/components/map.js");
    if (!fs.existsSync(mapFilePath)) {
      fs.writeFileSync(mapFilePath, "", "utf-8");
      console.log(`Created ${mapFilePath}`);
    }
    injectImportStatement(mapFilePath, `./${componentName}/index.js`);

    // Inject map.js into index.html
    if (fs.existsSync(htmlFilePath)) {
      injectScriptTag(htmlFilePath, "./components/map.js");
    }
  } catch (error) {
    console.error(`Installation failed: ${error.message}`);
    process.exit(1);
  }
} else if (
  (command === "uninstall" && componentName === "all") ||
  (command === "u" && componentName === "all")
) {
  const destDir = findComponentsFolder();
  const htmlFilePath = path.resolve(process.cwd(), "./src/index.html");
  const mapFilePath = path.resolve(process.cwd(), "./src/components/map.js");
  // Remove all components
  if (fs.existsSync(destDir)) {
    const components = fs.readdirSync(destDir);
    components.forEach((component) => {
      const componentPath = path.join(destDir, component);
      if (fs.lstatSync(componentPath).isDirectory()) {
        fs.rmSync(componentPath, { recursive: true, force: true });
        console.log(`Removed component directory: ${componentPath}`);
      }
    });
  }

  // Remove map.js file
  if (fs.existsSync(mapFilePath)) {
    fs.unlinkSync(mapFilePath);
  }
  // Remove script tags from HTML file
  if (fs.existsSync(htmlFilePath)) {
    removeScriptTags(htmlFilePath);
  }
} else if (
  (command === "uninstall" && componentName) ||
  (command === "u" && componentName)
) {
  const destDir = findComponentsFolder();
  const destPath = path.join(destDir, `${componentName}/index.js`);
  if (fs.existsSync(destPath)) {
    const componentDir = path.dirname(destPath);
    fs.rmSync(componentDir, { recursive: true, force: true });
    const htmlFilePath = path.resolve(process.cwd(), "./src/index.html");
    if (fs.existsSync(htmlFilePath)) {
      const mapFilePath = path.resolve(process.cwd(), "./src/components/map.js");
      if (fs.existsSync(mapFilePath)) {
        const fileContent = fs.readFileSync(mapFilePath, "utf-8");
        if (fileContent.trim().length === 0) {
          const componentDir = path.join(destDir, componentName);
          if (fs.existsSync(componentDir)) {
            fs.rmSync(componentDir, { recursive: true, force: true });
            console.log(`Removed component directory: ${componentDir}`);
          }
          console.log(`Removed empty ${mapFilePath}`);
        } else {
          console.log(`${mapFilePath} is not empty`);
        }
      } else {
        console.log(`${mapFilePath} does not exist`);
      }
    } else {
      console.log(
        "No HTML or JS file found to remove the script tag or import statement"
      );
    }

    const mapFilePath = path.resolve(process.cwd(), "./src/components/map.js");
    if (fs.existsSync(mapFilePath)) {
      // Removing import statement from map.js file
      const fileContent = fs.readFileSync(mapFilePath, "utf-8");
      const importStatement = `import './${componentName}/index.js';`;
      if (fileContent.includes(importStatement)) {
        const updatedContent = fileContent.replace(importStatement, "").replace(/^\s*$(?:\r\n?|\n)/gm, "");
        fs.writeFileSync(mapFilePath, updatedContent, "utf-8");
        console.log(`Removed import statement from ${mapFilePath}`);
      } else {
        console.log(`Import statement not found in ${mapFilePath}`);
      }
    } else {
      console.log("No map.js file found to remove the import statement");
    }
    // Check if all components are removed
    const remainingComponents = fs
      .readdirSync(destDir)
      .filter((file) => fs.lstatSync(path.join(destDir, file)).isDirectory());
    if (remainingComponents.length === 0) {
      removeScriptTags(htmlFilePath);
    }
  } else {
    console.error(`Component ${componentName} not found in ${destDir}`);
  }
} else {
  console.log("Usage: npx web-components-library install <component-name>");
}
