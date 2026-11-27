'use strict'
// Lê só o bloco JSON de um .glb (bytes, sem executar nada) e imprime asset, contagens e materiais.
// Uso: node ler-glb.cjs <arquivo.glb>
const fs = require('node:fs')

const arquivo = process.argv[2]
if (!arquivo) {
  console.error('uso: node ler-glb.cjs <arquivo.glb>')
  process.exit(2)
}
const bytes = fs.readFileSync(arquivo)
if (bytes.readUInt32LE(0) !== 0x46546c67) throw new Error('não é glb (magic)')
const tamanhoJson = bytes.readUInt32LE(12)
if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('primeiro bloco não é JSON')
const json = JSON.parse(bytes.subarray(20, 20 + tamanhoJson).toString('utf8'))

console.log('asset:', JSON.stringify(json.asset, null, 2))
console.log('extensoes usadas:', json.extensionsUsed ?? [])
console.log('cenas:', (json.scenes ?? []).map((c) => c.name))
console.log('nos:', (json.nodes ?? []).length, 'malhas:', (json.meshes ?? []).length)
for (const m of json.meshes ?? []) {
  const prims = m.primitives.map((p) => {
    const pos = json.accessors[p.attributes.POSITION]
    return { vertices: pos.count, min: pos.min, max: pos.max, material: p.material }
  })
  console.log('malha', m.name, JSON.stringify(prims))
}
for (const [i, mat] of (json.materials ?? []).entries()) console.log('material', i, JSON.stringify(mat))
for (const [i, img] of (json.images ?? []).entries()) console.log('imagem', i, img.name, img.mimeType, img.uri ?? '(embutida)')
console.log('animacoes:', (json.animations ?? []).length, 'peles:', (json.skins ?? []).length)
