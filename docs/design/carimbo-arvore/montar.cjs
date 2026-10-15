// Junta o bundle da entrada no modelo e grava prototipo.html ao lado.
// A árvore de antes vem do último commit: rode antes
//   git show HEAD:client/src/carimbos/embutidos.ts > docs/design/carimbo-arvore/embutidos-antes.ts
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
})
const js = saida.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
const modelo = fs.readFileSync(path.join(pasta, 'modelo.html'), 'utf8')
fs.writeFileSync(path.join(pasta, 'prototipo.html'), modelo.replace('/*BUNDLE*/', () => js))
console.log('ok', (js.length / 1024).toFixed(1), 'KB')
