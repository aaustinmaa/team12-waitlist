import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Three pages, each its own app: the family app (/), the clinic portal
// (/clinic/) and the Demo Day guide (/demo/). The sample clinic exports live
// in ../data/samples and are imported with ?raw.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: [".."] } },
  build: {
    rollupOptions: {
      input: {
        // relative to web/, where npm runs the build
        family: "index.html",
        clinic: "clinic/index.html",
        demo: "demo/index.html",
      },
    },
  },
});
