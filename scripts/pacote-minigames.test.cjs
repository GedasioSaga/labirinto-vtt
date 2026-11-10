'use strict'
// O pacote de minigames de ponta a ponta, com um export web falso (pequeno).
// Rodar: node --test scripts/pacote-minigames.test.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const crypto = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { assinaturaConfere } = require('./publicar-versao.cjs')
const { escolherMotorMinimo, MOTOR_MINIMO_PISO } = require('./pacote-minigames.cjs')

const SCRIPT = path.join(__dirname, 'pacote-minigames.cjs')
const CHAVE = path.join(os.homedir(), '.tauri', 'labirinto.key')
const SEM_CHAVE = !fs.existsSync(CHAVE) && 'sem a chave de assinatura nesta máquina'

/** Um export do Godot em miniatura: o HTML com o GODOT_CONFIG e os tamanhos certos. */
function exportFalso(pasta, { wasm = Buffer.alloc(5000, 7) } = {}) {
  const pck = Buffer.from('pck de mentira')
  const config = { executable: 'index', fileSizes: { 'index.pck': pck.length, 'index.wasm': 5000 } }
  fs.writeFileSync(path.join(pasta, 'index.html'), `<html><script src="index.js"></script><script>const GODOT_CONFIG = ${JSON.stringify(config)};</script></html>`)
  fs.writeFileSync(path.join(pasta, 'index.js'), 'console.log("motor")')
  fs.writeFileSync(path.join(pasta, 'index.wasm'), wasm)
  fs.writeFileSync(path.join(pasta, 'index.pck'), pck)
  fs.writeFileSync(path.join(pasta, 'index.png.import'), 'coisa do editor')
}

function rodar(build, saida) {
  return spawnSync(process.execPath, [SCRIPT, '--build', build, '--versao', '3', '--saida', saida], { encoding: 'utf8' })
}

test('empacota: um .gz por arquivo, o índice lista o sha256 e o tamanho de cada um e a assinatura confere', { skip: SEM_CHAVE }, () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pacote-minigames-'))
  const saida = path.join(raiz, 'saida')
  try {
    exportFalso(raiz)
    const r = rodar(raiz, saida)
    assert.equal(r.status, 0, r.stderr)
    const indice = JSON.parse(fs.readFileSync(path.join(saida, 'fogo.indice.json'), 'utf8'))
    assert.deepEqual(
      { formato: indice.formato, jogo: indice.jogo, versao: indice.versao, entrada: indice.entrada },
      { formato: 1, jogo: 'fogo', versao: 3, entrada: 'index.html' },
    )
    // O .import do editor fica de fora; a versão do índice vai no nome (publicar a
    // próxima nunca troca um arquivo do índice publicado); o nome servido sai do nome.
    assert.deepEqual(indice.arquivos.map((a) => a.nome), ['fogo.v3.index.html.gz', 'fogo.v3.index.js.gz', 'fogo.v3.index.pck.gz', 'fogo.v3.index.wasm.gz'])
    assert.deepEqual(fs.readdirSync(saida).sort(), [...indice.arquivos.map((a) => a.nome), 'fogo.indice.json', 'fogo.indice.json.sig'].sort())
    for (const arquivo of indice.arquivos) {
      const gz = fs.readFileSync(path.join(saida, arquivo.nome))
      assert.equal(gz.length, arquivo.tamanho)
      assert.equal(crypto.createHash('sha256').update(gz).digest('hex'), arquivo.sha256)
      const servido = arquivo.nome.slice(`fogo.v${indice.versao}.`.length, -'.gz'.length)
      assert.ok(zlib.gunzipSync(gz).equals(fs.readFileSync(path.join(raiz, servido))), `${servido} volta igual`)
    }
    const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'src-tauri', 'tauri.conf.json'), 'utf8'))
    const sig = fs.readFileSync(path.join(saida, 'fogo.indice.json.sig'), 'utf8').trim()
    assert.ok(assinaturaConfere(path.join(saida, 'fogo.indice.json'), sig, conf.plugins.updater.pubkey))
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
})

test('recusa build copiado pela metade (tamanho fora do GODOT_CONFIG) sem gerar saída', { skip: SEM_CHAVE }, () => {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'pacote-minigames-'))
  const saida = path.join(raiz, 'saida')
  try {
    exportFalso(raiz, { wasm: Buffer.alloc(1234, 7) })
    const r = rodar(raiz, saida)
    assert.equal(r.status, 1)
    assert.match(r.stderr, /index\.wasm tem 1234 bytes, mas o GODOT_CONFIG diz 5000/)
    assert.equal(fs.existsSync(saida), false)
  } finally {
    fs.rmSync(raiz, { recursive: true, force: true })
  }
})

test('motorMinimo: sem pedido é a versão do app desta árvore; com --motor-minimo, só entre o piso e ela', () => {
  const erro = (mensagem) => {
    throw new Error(mensagem)
  }
  assert.equal(escolherMotorMinimo(null, '0.5.44', erro), '0.5.44')
  assert.equal(escolherMotorMinimo(null, '0.5.30', erro), MOTOR_MINIMO_PISO)
  // Pacote que só conserta o jogo: chega a quem ainda está num app mais antigo.
  assert.equal(escolherMotorMinimo('0.5.40', '0.5.44', erro), '0.5.40')
  assert.equal(escolherMotorMinimo('0.5.44', '0.5.44', erro), '0.5.44')
  assert.throws(() => escolherMotorMinimo('0.5.36', '0.5.44', erro), /abaixo do piso/)
  assert.throws(() => escolherMotorMinimo('0.5.45', '0.5.44', erro), /passa da versão do app/)
  assert.throws(() => escolherMotorMinimo('0.5', '0.5.44', erro), /pede uma versão/)
})
