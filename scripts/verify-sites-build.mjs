import { access, readFile } from 'node:fs/promises'

const requiredFiles = [
  new URL('../dist/server/index.js', import.meta.url),
  new URL('../dist/server/wrangler.json', import.meta.url),
  new URL('../dist/client/index.html', import.meta.url),
  new URL('../dist/.openai/hosting.json', import.meta.url),
]

await Promise.all(requiredFiles.map((file) => access(file)))

const workerConfig = JSON.parse(
  await readFile(new URL('../dist/server/wrangler.json', import.meta.url), 'utf8'),
)

if (workerConfig.assets?.directory !== '../client') {
  throw new Error('Sites build must bind static assets from dist/client')
}

if (workerConfig.assets?.not_found_handling !== 'single-page-application') {
  throw new Error('Sites build must enable SPA fallback routing')
}

console.log('Sites deployment artifact verified.')
