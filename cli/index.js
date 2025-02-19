#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import exifParser from 'exif-parser';
import inquirer from 'inquirer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function sanitizeFileNames(folderPath) {
  const files = fs.readdirSync(folderPath);
  files.forEach(file => {
    const sanitizedFileName = file.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const oldFilePath = path.join(folderPath, file);
    const newFilePath = path.join(folderPath, sanitizedFileName);
    if (oldFilePath !== newFilePath) {
      fs.renameSync(oldFilePath, newFilePath);
      console.log(`Renamed ${oldFilePath} to ${newFilePath}`);
    }
  });
}
async function convertImagesToWebFriendly(folderPath) {

  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const fileStats = fs.statSync(filePath);
    if (file.startsWith('web-')) {
      return;
    }

    if (fileStats.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(file)) {
      try {
        const outputFilePath = path.join(folderPath, `web-${file}`);
        const metadata = await sharp(filePath).metadata();
        if (metadata.width > 1920) {
          await sharp(filePath)
            .resize({ width: 1920 })
            .toFormat('webp')
            .toFile(outputFilePath);
        } else {
          await sharp(filePath)
            .toFormat('webp')
            .toFile(outputFilePath);
        }
        console.log(`Converted ${file} to web-friendly version: ${outputFilePath}`);
      } catch (error) {
        console.error(`Error converting file ${file}: ${error.message}`);
      }
    }
    if (fileStats.isFile() && /\.webp$/i.test(file)) {
      const equivalentFile = filePath.replace(/\.webp$/i, (match) => {
        const extensions = ['.jpg', '.jpeg', '.png'];
        for (const ext of extensions) {
          const equivalentFilePath = filePath.replace(/\.webp$/i, ext);
          if (fs.existsSync(equivalentFilePath)) {
            fs.unlinkSync(equivalentFilePath);
            console.log(`Removed equivalent file: ${equivalentFilePath}`);
          }
        }

        return match;
      });
    }


  }
}

async function createThumbnails(folderPath) {
  const thumbsDir = path.join(folderPath, 'thumbs');
  if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir);
  }

  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    if (file.startsWith('web-')) {
      console.log(`Skipping file ${file} as it starts with 'web-'`);
      continue;
    }
    const filePath = path.join(folderPath, file);
    const fileStats = fs.statSync(filePath);

    if (fileStats.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(file)) {
      try {
        const outputFilePath = path.join(thumbsDir, `${file}`);

        // Randomly change the aspect ratio
        let newWidth, newHeight;
        const image = sharp(filePath);
        if (process.argv.includes('-randomAspectRatio')) {
          const randomAspectRatio = Math.random() * (1.5 - 0.5) + 0.5;
          const randomNumber = () => Math.random() * (2800 - 1080) + 1080;
          newWidth = Math.round(randomNumber() * randomAspectRatio);
          newHeight = Math.round(randomNumber() * randomAspectRatio);
        } else {
          const metadata = await image.metadata();
          newWidth = metadata.width;
          newHeight = metadata.height;
        }

        await image
        .resize({ width: newWidth, height: newHeight })
        .toFormat('webp')
        .toFile(outputFilePath);
        console.log(`Created thumbnail for ${file}: ${outputFilePath}`);
      } catch (error) {
        console.error(`Error creating thumbnail for file ${file}: ${error.message}`);
      }
    }
  }
}

async function gatherImageInfo(folderPath) {
  sanitizeFileNames(folderPath);
  await convertImagesToWebFriendly(folderPath);
  await createThumbnails(folderPath);
  const files = fs.readdirSync(folderPath);
  const imageInfoList = [];
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const fileStats = fs.statSync(filePath);

    if (fileStats.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(file)) {
      try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        const buffer = fs.readFileSync(filePath);
        const parser = exifParser.create(buffer);
        const exifData = parser.parse();

        const sanitizedComponentName = componentName.replace('/public/', '/').replace('/src/', '/').replace('./', '');
        const imageInfo = {
          fileName: `${sanitizedComponentName}/web-${file}`,
          dimensions: {
            width: metadata.width,
            height: metadata.height,
          },
          thumbnail: `${sanitizedComponentName}/thumbs/${file}`,
          format: metadata.format,
          size: fileStats.size,
          creationDate: fileStats.birthtime,
          modificationDate: fileStats.mtime,
          exif: {
            make: exifData.tags.Make || 'N/A',
            model: exifData.tags.Model || 'N/A',
            dateTimeOriginal: exifData.tags.DateTimeOriginal || 'N/A',
            description: exifData.tags.ImageDescription || 'N/A',
            author: exifData.tags.Artist || 'N/A',
            software: exifData.tags.Software || 'N/A',
            location: {
              latitude: exifData.tags.GPSLatitude || 'N/A',
              longitude: exifData.tags.GPSLongitude || 'N/A',
            },
            exposureTime: exifData.tags.ExposureTime || 'N/A',
            fNumber: exifData.tags.FNumber || 'N/A',
            iso: exifData.tags.ISO || 'N/A',
            focalLength: exifData.tags.FocalLength || 'N/A',
          },
        };

        imageInfoList.push(imageInfo);
      } catch (error) {
        console.error(`Error processing file ${file}: ${error.message}`);
      }
    }
  }
  return imageInfoList;
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



function getComponentDependencies(componentName) {
  const dependencies = {
    'Gallery': ['MasonryGrid', 'ContentModal', 'Loading'],
    'BlockContainer': ['Layout'],
    'FlexContainer': ['Layout'],
    "InlineContainer": ['Layout'],
    "GridContainer": ['Layout'],
    // Add other components and their dependencies here
  };
  return dependencies[componentName] || [];
}

function installComponent(componentName, destDir, componentsDir, installedComponents = new Set()) {
  if (installedComponents.has(componentName)) {
    console.log(`Component ${componentName} already installed, skipping...`);
    return;
  }

  const destComponentDir = path.join(destDir, componentName);
  const destPath = path.join(destComponentDir, "index.js");
  const componentPath = path.join(componentsDir, componentName, "index.js");

  if (!fs.existsSync(componentPath)) {
    throw new Error(`Component ${componentName} not found in ${componentsDir}`);
  }

  // Create component directory if it doesn't exist
  if (!fs.existsSync(destComponentDir)) {
    fs.mkdirSync(destComponentDir, { recursive: true });
  }

  fs.copyFileSync(componentPath, destPath);
  installedComponents.add(componentName);
  console.log(`Successfully installed ${componentName} to ${destPath}`);

  // Get and install dependencies first
  const dependencies = getComponentDependencies(componentName);
  for (const dependency of dependencies) {
    installComponent(dependency, destDir, componentsDir, installedComponents);
  }

  // After installing dependencies, update map.js with imports
  const mapFilePath = path.resolve(process.cwd(), "./src/components/map.js");
  if (!fs.existsSync(mapFilePath)) {
    fs.writeFileSync(mapFilePath, "", "utf-8");
    console.log(`Created ${mapFilePath}`);
  }

  // Add imports for both component and its dependencies
  injectImportStatement(mapFilePath, `./${componentName}/index.js`);
  dependencies.forEach(dep => {
    injectImportStatement(mapFilePath, `./${dep}/index.js`);
  });

  return installedComponents;
}

if (command === 'image-info') {
  async function promptForFolder() {
    const { folderPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'folderPath',
        message: 'Please enter the relative path to the folder containing images:',
        default: './images',
      },
    ]);
    return folderPath;
  }

  (async () => {
    try {
      const folderPath = process.argv[3] || await promptForFolder();
      const absoluteFolderPath = path.resolve(process.cwd(), folderPath);
      if (!fs.existsSync(absoluteFolderPath)) {
        console.error(`Folder not found: ${absoluteFolderPath}`);
        process.exit(1);
      }
      const imageInfoList = await gatherImageInfo(absoluteFolderPath);
      const outputFilePath = path.join(folderPath, 'index.json');
      fs.writeFileSync(outputFilePath, JSON.stringify(imageInfoList, null, 2), 'utf-8');
      console.log(`Image info written to ${outputFilePath}`);

      await convertImagesToWebFriendly(absoluteFolderPath);
    } catch (error) {
      console.error(`Error gathering image info: ${error.message}`);
      process.exit(1);
    }
  })();
}

else if (command === 'boilerplate' || command === 'init') {
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
    try {
      installComponent(component, destDir, componentsDir);
      const htmlFilePath = path.resolve(process.cwd(), "./src/index.html");
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
  const componentsDir = path.resolve(__dirname, "../src");

  try {
    const installedComponents = installComponent(componentName, destDir, componentsDir, new Set());
    console.log('Installed components:', Array.from(installedComponents).join(', '));

    const htmlFilePath = path.resolve(process.cwd(), "./src/index.html");
    if (fs.existsSync(htmlFilePath)) {
      injectScriptTag(htmlFilePath);
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