import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The sample clinic exports live in ../data/samples and are imported with ?raw.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: [".."] } },
});
