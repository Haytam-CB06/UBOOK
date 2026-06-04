import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-motion": ["framer-motion"],
          "vendor-data-viz": ["recharts", "@tanstack/react-table", "@tanstack/react-query"]
        }
      }
    }
  },
  server: {
    port: 5173
  }
});
