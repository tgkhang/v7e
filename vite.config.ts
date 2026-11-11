import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const contentDir = fileURLToPath(new URL('./content', import.meta.url));

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
};

/**
 * Topic folders hold more than Markdown: standalone HTML visualizers, images, raw notes.
 * Dev: serve them untouched at /content/... (Vite would otherwise transform the HTML).
 * Build: copy the whole folder to dist/content so links keep working.
 */
function contentAssets(): Plugin {
  let outDir = 'dist';
  return {
    name: 'content-assets',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/content', (req, res, next) => {
        // Module requests (?raw, ?import, ?t=) belong to Vite.
        if (!req.url || req.url.includes('?')) return next();
        const file = path.join(contentDir, decodeURIComponent(req.url));
        if (!file.startsWith(contentDir + path.sep)) return next();
        fs.stat(file, (err, stat) => {
          if (err || !stat.isFile()) return next();
          res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
          fs.createReadStream(file).pipe(res);
        });
      });
    },
    closeBundle() {
      fs.cpSync(contentDir, path.join(outDir, 'content'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), contentAssets()],
  server: { open: true },
  build: { chunkSizeWarningLimit: 1500 }, // local tool; mermaid's diagram chunks are big but lazy
});
