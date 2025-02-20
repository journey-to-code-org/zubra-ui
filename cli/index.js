#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import exifParser from "exif-parser";
import inquirer from "inquirer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants and configuration
const COMPONENTS_SOURCE = path.resolve(__dirname, "../src");
const DEFAULT_PATHS = {
  components: "./src/components",
  html: "./src/index.html",
  map: "./components/map.js",
};

class FileHandler {
  static async ensureDirectory(path) {
    try {
      await fs.mkdir(path, { recursive: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  }

  static async exists(path) {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  static async copyRecursive(src, dest) {
    await this.ensureDirectory(dest);
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      entry.isDirectory()
        ? await this.copyRecursive(srcPath, destPath)
        : await fs.copyFile(srcPath, destPath);
    }
  }
}

class ImageProcessor {
  static sanitizeFileName(file) {
    return file.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  }

  static async processDirectory(folderPath) {
    await this.sanitizeFiles(folderPath);
    await this.convertImages(folderPath);
    await this.createThumbnails(folderPath);
    return this.gatherMetadata(folderPath);
  }

  static async sanitizeFiles(folderPath) {
    const files = await fs.readdir(folderPath);

    for (const file of files) {
      const sanitized = this.sanitizeFileName(file);
      const oldPath = path.join(folderPath, file);
      const newPath = path.join(folderPath, sanitized);

      if (oldPath !== newPath) {
        await fs.rename(oldPath, newPath);
        console.log(`Renamed ${file} to ${sanitized}`);
      }
    }
  }

  static async convertImages(folderPath) {
    const files = await fs.readdir(folderPath);

    for (const file of files) {
      if (file.startsWith("web-")) continue;

      const filePath = path.join(folderPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(file)) {
        await this.convertToWebp(filePath, folderPath);
      }
    }
  }

  static async convertToWebp(filePath, outputDir) {
    try {
      const outputFile = path.join(outputDir, `web-${path.basename(filePath)}`);
      const image = sharp(filePath);
      const { width } = await image.metadata();

      if (width > 1920) {
        await image.resize(1920).toFormat("webp").toFile(outputFile);
      } else {
        await image.toFormat("webp").toFile(outputFile);
      }

      console.log(`Converted to webp: ${outputFile}`);
    } catch (error) {
      console.error(`Conversion error: ${error.message}`);
    }
  }

  static async createThumbnails(folderPath) {
    const thumbsDir = path.join(folderPath, "thumbs");
    await FileHandler.ensureDirectory(thumbsDir);

    const files = await fs.readdir(folderPath);

    for (const file of files) {
      if (file.startsWith("web-")) continue;

      const filePath = path.join(folderPath, file);
      const outputPath = path.join(thumbsDir, file);

      await sharp(filePath)
        .resize(800, 600, { fit: "inside" })
        .toFormat("webp")
        .toFile(outputPath);

      console.log(`Created thumbnail: ${outputPath}`);
    }
  }

  static async gatherMetadata(folderPath) {
    const files = await fs.readdir(folderPath);
    const results = [];

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile() && /\.(jpg|jpeg|png|gif)$/i.test(file)) {
        try {
          const buffer = await fs.readFile(filePath);
          const { tags } = exifParser.create(buffer).parse();
          const image = sharp(filePath);
          const metadata = await image.metadata();

          results.push({
            fileName: file,
            dimensions: { width: metadata.width, height: metadata.height },
            metadata: {
              camera: `${tags.Make || ""} ${tags.Model || ""}`.trim(),
              date: tags.DateTimeOriginal || stats.birthtime,
              location:
                tags.GPSLatitude && tags.GPSLongitude
                  ? { lat: tags.GPSLatitude, lng: tags.GPSLongitude }
                  : null,
              exposure: `${tags.ExposureTime}s f/${tags.FNumber} ISO${tags.ISO}`,
            },
          });
        } catch (error) {
          console.error(`Metadata error: ${file} - ${error.message}`);
        }
      }
    }

    return results;
  }
}

class ComponentManager {
  static dependencies = {
    Gallery: ["MasonryGrid", "ContentModal", "Loading"],
    Example: [
      "Layout/AbsoluteContainer",
      "Layout/BlockContainer",
      "Layout/FlexContainer",
      "Layout/GridContainer",
      "utils/randomGenerator",
    ],
    "Layout/AbsoluteContainer": ["Layout"],
    "Layout/BlockContainer": ["Layout"],
    "Layout/FlexContainer": ["Layout"],
    "Layout/GridContainer": ["Layout"],
  };

  constructor() {
    this.installed = new Set();
  }

  async install(name, targetDir) {
    if (this.installed.has(name)) return;

    const sourcePath = await this.resolveComponentPath(name);
    const targetPath = path.join(targetDir, name);

    await FileHandler.copyRecursive(sourcePath, targetPath);
    this.installed.add(name);

    console.log(`Installed: ${name}`);

    // Handle dependencies
    for (const dep of ComponentManager.dependencies[name] || []) {
      await this.install(dep, targetDir);
    }

    await this.updateMapFile(targetDir);
    await CLI.updateHTML();
  }

  async uninstall(name, targetDir) {
    const componentPath = path.join(targetDir, name);

    if (await FileHandler.exists(componentPath)) {
      await fs.rm(componentPath, { recursive: true });
      console.log(`Removed: ${name}`);
      await this.cleanMapFile(targetDir);
      this.installed.delete(name);
      if (this.installed.size < 1) {
        await CLI.updateHTML(false);
        await CLI.asyncRemoveComponentsFolder();
      }
    }
  }

  async resolveComponentPath(name) {
    const pathsToCheck = [
      path.join(COMPONENTS_SOURCE, name),
      path.join(COMPONENTS_SOURCE, "utils", name),
      // Add other potential locations
    ];

    for (const p of pathsToCheck) {
      if (await FileHandler.exists(p)) return p;
    }

    throw new Error(`Component not found: ${name}`);
  }

  async updateMapFile(targetDir) {
    const mapPath = path.resolve(targetDir, "map.js");
    let content = (await FileHandler.exists(mapPath))
      ? await fs.readFile(mapPath, "utf-8")
      : "";

    for (const component of this.installed) {
      const importLine = `import './${component}/index.js';\n`;
      if (!content.includes(importLine)) {
        content = importLine + content;
      }
    }

    await fs.writeFile(mapPath, content);
  }

  async cleanMapFile(targetDir) {
    const mapPath = path.resolve(targetDir, "map.js");
    if (!(await FileHandler.exists(mapPath))) return;

    const content = await fs.readFile(mapPath, "utf-8");
    const updated = content
      .split("\n")
      .filter(
        (line) => !this.installed.has(line.match(/import '\.\/(\w+)'/)?.[1])
      )
      .join("\n");

    await fs.writeFile(mapPath, updated);
  }
}

class CLI {
  static commands = {
    "image-info": {
      execute: async (args) => {
        const folder = args[0] || (await this.promptFolder());
        const absolutePath = path.resolve(process.cwd(), folder);

        if (!(await FileHandler.exists(absolutePath))) {
          throw new Error(`Directory not found: ${absolutePath}`);
        }

        const metadata = await ImageProcessor.processDirectory(absolutePath);
        const outputPath = path.join(absolutePath, "metadata.json");

        await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2));
        console.log(`Metadata saved to: ${outputPath}`);
      },
      promptFolder: async () => {
        const { folder } = await inquirer.prompt([
          {
            type: "input",
            name: "folder",
            message: "Enter image directory path:",
            default: "./images",
          },
        ]);
        return folder;
      },
    },

    install: {
      execute: async ([component]) => {
        const targetDir = path.resolve(DEFAULT_PATHS.components);
        await FileHandler.ensureDirectory(targetDir);

        const manager = new ComponentManager();

        if (component === "all") {
          const allComponents = await fs.readdir(COMPONENTS_SOURCE);
          for (const name of allComponents) {
            await manager.install(name, targetDir);
          }
        } else {
          await manager.install(component, targetDir);
        }

        await this.updateHTML();
      },
    },

    uninstall: {
      execute: async ([component]) => {
        const targetDir = path.resolve(DEFAULT_PATHS.components);
        const manager = new ComponentManager();

        if (component === "all") {
          const installed = await fs.readdir(targetDir);
          for (const name of installed) {
            await manager.uninstall(name, targetDir);
          }
        } else {
          await manager.uninstall(component, targetDir);
        }

        await this.updateHTML(false);
      },
    },

    init: {
      execute: async () => {
        await FileHandler.ensureDirectory(DEFAULT_PATHS.components);
        await this.createHTML();
        console.log("Project initialized");
      },

      createHTML: async () => {
        const htmlPath = path.resolve(DEFAULT_PATHS.html);
        if (await FileHandler.exists(htmlPath)) return;

        const content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Web Components</title>
  <script type="module" src="${DEFAULT_PATHS.map}"></script>
</head>
<body>
  <main></main>
</body>
</html>`;

        await fs.writeFile(htmlPath, content);
      },
    },
  };

  static async run() {
    const [command, ...args] = process.argv.slice(2);

    if (!this.commands[command]) {
      console.log(
        `Available commands: ${Object.keys(this.commands).join(", ")}`
      );
      process.exit(1);
    }

    try {
      await this.commands[command].execute(args);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  }

  static async asyncRemoveComponentsFolder() {
    try {
      const componentsPath = path.resolve(DEFAULT_PATHS.components);
      if (await FileHandler.exists(componentsPath)) {
        const folderIsEmpty = (await fs.readdir(componentsPath)).length === 0;
        if (!folderIsEmpty) return false;
        await fs.rm(componentsPath, { recursive: true });
        return true;
      }
    } catch (error) {
      console.error(`Error removing components folder: ${error.message}`);
    }
  }

  static async updateHTML(install = true) {
    try {
      const htmlPath = path.resolve(DEFAULT_PATHS.html);
      if (!(await FileHandler.exists(htmlPath))) return;
      const content = await fs.readFile(htmlPath, "utf-8");
      const importStatement = `<script type="module" src="${DEFAULT_PATHS.map}"></script>`;
      const hasScript = content.includes(importStatement);
      if (hasScript === install) return;
      const updatedContent = install
        ? content.replace("</head>", `  ${importStatement}\n</head>`)
        : content
            .split("\n")
            .filter((line) => !line.includes(importStatement))
            .join("\n");
      await fs.writeFile(htmlPath, updatedContent);
    } catch (error) {
      console.error(`Error updating HTML: ${error.message}`);
    }
  }
}

CLI.run();
