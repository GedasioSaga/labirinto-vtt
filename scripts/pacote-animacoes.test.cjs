'use strict'
// Validação da meta de porta do pacote de animações (22/10/2026: durações por
// sentido, curvas e o som das cinco portas novas). Rodar: node --test scripts/pacote-animacoes.test.cjs
const test = require('node:test')
const assert = require('node:assert/strict')
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { PORTA_SONS, curvaValida, entradaDePorta } = require('./pacote-animacoes.cjs')

/** O `erro` do script sai do processo; aqui ele lança, para o teste ver a mensagem. */
function validar(meta) {
  return entradaDePorta('grade', 'Grade que sobe', meta, (mensagem) => {
    throw new Error(mensagem)
  })
}

test('os sons aceitos são os que o app sintetiza: as duas embutidas e as cinco do pacote', () => {
  assert.deepEqual(PORTA_SONS, ['rangido', 'trinco', 'dupla', 'grade', 'arrombada', 'sanfona', 'cortina'])
  const animacoesDePorta = fs.readFileSync(path.join(__dirname, '..', 'client', 'src', 'portas', 'animacoesDePorta.ts'), 'utf8')
  // A mesma lista do app, na mesma ordem (o script não importa TypeScript, então confere o texto).
  assert.ok(animacoesDePorta.includes(`SONS_DA_ANIMACAO_DE_PORTA = [${PORTA_SONS.map((s) => `'${s}'`).join(', ')}] as const`))
})

test('som válido entra na entrada do índice; som desconhecido, com caixa errada ou de outro tipo é recusado', () => {
  for (const som of PORTA_SONS) assert.equal(validar({ duracaoMs: 600, som }).som, som)
  for (const torto of ['sino', 'Grade', '', 7, null, ['grade'], { som: 'grade' }]) {
    assert.throws(() => validar({ duracaoMs: 600, som: torto }), /"som" é rangido, trinco, dupla, grade, arrombada, sanfona, cortina/)
  }
})

test('sem som, a porta é muda: o campo fica fora da entrada', () => {
  const entrada = validar({ duracaoMs: 600 })
  assert.deepEqual(entrada, { id: 'grade', tipo: 'porta', nome: 'Grade que sobe', duracaoMs: 600 })
})

test('duração de fechar e curvas: as válidas vão para o índice, as tortas são recusadas', () => {
  const entrada = validar({ duracaoMs: 600, duracaoFecharMs: 420, curvaAbrir: [0.37, 0, 0.63, 1], curvaFechar: [0.33, 1, 0.68, 1], som: 'grade' })
  assert.deepEqual(entrada, { id: 'grade', tipo: 'porta', nome: 'Grade que sobe', duracaoMs: 600, duracaoFecharMs: 420, curvaAbrir: [0.37, 0, 0.63, 1], curvaFechar: [0.33, 1, 0.68, 1], som: 'grade' })
  for (const fechar of [0, -1, 3001, '420', Number.NaN]) assert.throws(() => validar({ duracaoMs: 600, duracaoFecharMs: fechar }), /duracaoFecharMs/)
  // Fora de [0, 1] a curva volta ou passa do alvo (quique): recusada.
  for (const curva of [[0.3, -0.2, 0.6, 1], [0.3, 0, 0.6, 1.4], [0.3, 0, 0.6], 'ease-out', [0.3, 0, '0.6', 1]]) {
    assert.equal(curvaValida(curva), false)
    assert.throws(() => validar({ duracaoMs: 600, curvaAbrir: curva }), /curvaAbrir/)
  }
})

test('as metas das cinco portas novas do repositório passam na validação', () => {
  const pasta = path.join(__dirname, '..', 'client', 'src', 'animacoes', 'porta')
  for (const id of ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina']) {
    const meta = JSON.parse(fs.readFileSync(path.join(pasta, `${id}.json`), 'utf8'))
    const entrada = entradaDePorta(id, meta.nome, meta, (mensagem) => assert.fail(`${id}.json: ${mensagem}`))
    assert.equal(entrada.som, id)
    assert.ok(curvaValida(entrada.curvaAbrir) && curvaValida(entrada.curvaFechar), `${id}: curvas`)
  }
})

// O script de verdade, com uma fonte de som torto: sai com 1 e diz o campo. A
// chave só é conferida por existir (o script nunca a lê); sem ela, o script
// pararia antes da validação e o teste não diria nada sobre o som.
const CHAVE = path.join(os.homedir(), '.tauri', 'labirinto.key')
test('o script recusa a meta com som torto antes de compilar e sai com código 1', { skip: !fs.existsSync(CHAVE) && 'sem a chave de assinatura nesta máquina' }, () => {
  const fontes = fs.mkdtempSync(path.join(os.tmpdir(), 'pacote-som-'))
  const saida = path.join(fontes, 'saida')
  try {
    fs.mkdirSync(path.join(fontes, 'porta'))
    fs.writeFileSync(path.join(fontes, 'porta', 'teste-som.ts'), 'export default () => {}\n')
    fs.writeFileSync(path.join(fontes, 'porta', 'teste-som.json'), JSON.stringify({ nome: 'Teste', duracaoMs: 300, som: 'sino' }))
    const r = spawnSync(process.execPath, [path.join(__dirname, 'pacote-animacoes.cjs'), '--fontes', fontes, '--versao', '1', '--saida', saida], { encoding: 'utf8' })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /porta\/teste-som\.json: "som" é rangido, trinco, dupla, grade, arrombada, sanfona, cortina/)
    // Recusou antes de compilar: nenhuma saída foi criada.
    assert.equal(fs.existsSync(saida), false)
  } finally {
    fs.rmSync(fontes, { recursive: true, force: true })
  }
})
