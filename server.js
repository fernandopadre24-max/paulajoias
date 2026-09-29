import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = process.cwd();
const port = Number(process.env.PORT || 8080);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(root, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end('403');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' && !path.extname(urlPath)) {
        fs.readFile(path.join(root, 'index.html'), (e2, d2) => {
          if (e2) return res.writeHead(404).end('404');
          res.writeHead(200, { 'Content-Type': mime['.html'] }).end(d2);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('404 - nao encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': mime[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(port, () => {
  const url = `http://localhost:${port}`;
  console.log(`\n  Paula Controle rodando em ${url}`);
  console.log(`  (para abrir no celular, use o IP desta maquina, ex: http://192.168.0.10:${port})\n`);
  if (process.argv.includes('--open')) {
    import('node:child_process').then(({ exec }) => exec(`start "" "${url}"`));
  }
});
