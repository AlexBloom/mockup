import { cpSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = resolve(root, 'node_modules/three/examples/jsm/libs/basis')
const dest = resolve(root, 'public/decoders/basis')

mkdirSync(dest, { recursive: true })
cpSync(src, dest, { recursive: true })
console.log(`Copied Basis transcoder to ${dest}`)
