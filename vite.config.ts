import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { devinProxy } from './scripts/devin-proxy';

export default defineConfig(({ mode }) => {
  // Only DEVIN_* variables are read, and they stay server-side (Vite exposes only VITE_* to the browser).
  const env = loadEnv(mode, process.cwd(), 'DEVIN_');
  return {
    plugins: [
      react(),
      devinProxy({ apiKey: env.DEVIN_API_KEY, orgId: env.DEVIN_ORG_ID, maxAcu: env.DEVIN_MAX_ACU }),
    ],
    test: {
      include: ['src/**/*.test.{ts,tsx}'],
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      restoreMocks: true,
    },
  };
});
