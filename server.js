#!/usr/bin/env node

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 5000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  let filePath = req.url === '/' ? '/web/index.html' : req.url;
  
  // If no extension, assume it's an HTML file in the web directory
  if (!extname(filePath)) {
    filePath = `/web${filePath}.html`;
  } else if (!filePath.startsWith('/web/')) {
    filePath = `/web${filePath}`;
  }
  
  const fullPath = join(__dirname, filePath);
  const ext = extname(fullPath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(fullPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>404 - Not Found</title></head>
          <body>
            <h1>404 - Page Not Found</h1>
            <p>The requested file was not found.</p>
            <a href="/">Go to Home</a>
          </body>
        </html>
      `);
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`🌐 Quotebook Web Simulator running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from ./web/ directory`);
});