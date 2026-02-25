import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite reads env vars at runtime; we use this to keep the dev stack resilient when ports are occupied.
const CLIENT_PORT = Number(process.env.VITE_PORT ?? "5173");
const API_TARGET = process.env.VITE_API_TARGET ?? "http://localhost:5174";

export default defineConfig({
  plugins: [react()],
  server: {
    port: CLIENT_PORT,
    strictPort: true,
    proxy: {
      "/api": {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  }
});
