import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// Check if mkcert certificates exist
const certPath = path.resolve(__dirname, 'cert.pem');
const keyPath = path.resolve(__dirname, 'key.pem');
const hasCustomCerts = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        coach: path.resolve(__dirname, 'coach.html'),
        'coach-stream': path.resolve(__dirname, 'coach-stream.html'),
        'coach-feedback': path.resolve(__dirname, 'coach-feedback.html'),
        client: path.resolve(__dirname, 'client.html'),
        summary: path.resolve(__dirname, 'summary.html'),
      },
    },
    assetsDir: 'assets',
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces (allows access from mobile)
    port: 5173,
    strictPort: false,
    https: hasCustomCerts
      ? {
          // Use mkcert certificates if they exist (trusted by browsers)
          cert: fs.readFileSync(certPath),
          key: fs.readFileSync(keyPath),
        }
      : true, // Otherwise use auto-generated self-signed certificate
  },
});

