// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Chỉ nhận env bắt đầu bằng VITE_ (mặc định của Vite)
  envPrefix: "VITE_",
  server: {
    host: "0.0.0.0",   // cho phép truy cập từ ngoài VPS
    port: 5173,        // cố định port
    strictPort: true,  // nếu 5173 bận thì fail (đỡ “nhảy” cổng khác)
    // Nếu chạy sau reverse proxy (Nginx/Caddy) và client ở ngoài không xài được HMR,
    // mở dòng dưới, set clientPort = port public:
    // hmr: { clientPort: 5173 },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
  },
  build: {
    sourcemap: false,  // cho build gọn; cần debug thì đổi true
    outDir: "dist",
  },
});
