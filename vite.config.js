import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Firebase Auth and Firestore are most of the bundle (about 270 kB gzipped in all).
export default defineConfig({
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1000 },
  server: { port: 5181, strictPort: true },
});
