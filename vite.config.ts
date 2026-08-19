import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clientPort = Number(env.VITE_DEV_PORT || 5180);
  const apiPort = Number(env.PORT || 3002);

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: clientPort,
      strictPort: true,
      host: true,
      allowedHosts: ['.trycloudflare.com'],
      // Tunnel / onglet mobile : le reconnect HMR recharge toute la page au retour
      hmr: process.env.DISABLE_HMR === '1' ? false : undefined,
      proxy: {
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
    },
  };
});
