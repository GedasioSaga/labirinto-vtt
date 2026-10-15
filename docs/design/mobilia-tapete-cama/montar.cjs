// Junta o bundle de entrada.ts (que importa o código real do app) no modelo e grava prototipo.html ao lado.
// Rodar da raiz do repo: node docs/design/mobilia-tapete-cama/montar.cjs
const esbuild = require('C:/dev/labirinto/node_modules/esbuild')
const fs = require('node:fs')
const path = require('node:path')

const pasta = __dirname
const saida = esbuild.buildSync({
  entryPoints: [path.join(pasta, 'entrada.ts')],
  bundle: true,
  format: 'iife',
  write: false,
  target: 'es2020',
  minify: true,
  logLevel: 'warning',
  metafile: true,
})
const js = saida.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const modelo = fs.readFileSync(path.join(pasta, 'modelo.html'), 'utf8')
fs.writeFileSync(path.join(pasta, 'prototipo.html'), modelo.replace('/*BUNDLE*/', () => js))
const doApp = Object.keys(saida.metafile.inputs).filter((f) => f.includes('client/src'))
console.log('ok', (js.length / 1024).toFixed(1), 'KB; do app:', doApp.join(', '))
