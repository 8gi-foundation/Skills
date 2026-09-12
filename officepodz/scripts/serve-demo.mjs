/**
 * Static file server for the demo.
 *
 *   npm run demo   then open http://localhost:5173/examples/vanilla/
 *
 * Node only, no dependencies. It exists so the demo runs from a clean clone
 * without installing a bundler.
 */
import { createServer } from "node:http"
import { createReadStream, existsSync, statSync } from "node:fs"
import { extname, join, normalize, resolve } from "node:path"
import { ROOT } from "./lib.mjs"

const PORT = Number(process.env.PORT ?? 5173)
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json; charset=utf-8",
}

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`)
  let path = resolve(ROOT, `.${normalize(url.pathname)}`)
  if (!path.startsWith(ROOT)) {
    response.writeHead(403).end("forbidden")
    return
  }
  if (url.pathname === "/") path = join(ROOT, "examples/vanilla/index.html")
  if (url.pathname === "/favicon.ico") {
    response.writeHead(204).end()
    return
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html")
  if (!existsSync(path)) {
    response.writeHead(404).end("not found")
    return
  }
  response.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" })
  createReadStream(path).pipe(response)
}).listen(PORT, () => {
  console.log(`OfficePodz demo at http://localhost:${PORT}/examples/vanilla/`)
})
