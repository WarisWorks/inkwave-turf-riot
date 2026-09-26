import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { CHARACTER_ASSETS } from "./src/game/characters/characterAssets";

const characterRuntimeModels = new Set(Object.values(CHARACTER_ASSETS).map(asset => `${asset}.glb`));

export default defineConfig(({ command }) => ({
  // Ship runtime assets only; exclude dotfiles and unused authoring models.
  publicDir: command === "serve" ? "public" : false,
  plugins: [react(), tailwindcss(), {
    name: "runtime-public-assets",
    apply: "build",
    generateBundle() {
      const root = fileURLToPath(new URL("./public/", import.meta.url));
      const visit = (folder: string) => {
        for (const entry of readdirSync(join(root, folder), { withFileTypes: true })) {
          if (entry.name.startsWith(".")) continue;
          const name = folder ? `${folder}/${entry.name}` : entry.name;
          // Keep new authoring models locally; package only the active roster.
          if (folder === "models/characters" && entry.name.endsWith(".glb") && !characterRuntimeModels.has(entry.name)) continue;
          if (folder === "models/urumqi" && entry.name !== "runtime") continue;
          if (entry.isDirectory()) visit(name);
          else if (entry.isFile()) this.emitFile({ type: "asset", fileName: name, source: readFileSync(join(root, name)) });
        }
      };
      visit("");
    },
  }],
  server: { host: true, port: 5173 },
}));
