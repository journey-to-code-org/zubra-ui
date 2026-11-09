// Serves dist/ for local use and the tests: node scripts/serve.mjs [--port 4174] [--dir dist]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };

/** Serve `dir` at the root; resolves to its URL and a close(). */
export function serve(dir, port = 0) {
  const server = createServer((request, response) => {
    let path = join(dir, decodeURIComponent(new URL(request.url, 'http://x').pathname));
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!path.startsWith(dir) || !existsSync(path)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' });
    createReadStream(path).pipe(response);
  });
  return new Promise((done) => server.listen(port, '127.0.0.1', () => done({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const { url } = await serve(resolve(option('--dir', 'dist')), Number(option('--port', 4174)));
  console.log(`zubra-ui: ${url}/r/registry.json`);
}
