#!/usr/bin/env node
/**
 * RELATÓRIO DA CONVERSÃO DOS ITENS (docs/design/itens-rework/PLANO.md, E1, A9: decisão do Claude).
 * Ferramenta SÓ DE LEITURA, não teste: nunca grava nada.
 *
 *   node scripts/relatorio-conversao-itens.cjs <pasta-das-fichas> [--acervo <itens.json>]
 *
 * <pasta-das-fichas> = a pasta que tem o `rpg.json` (pasta de mapas) ou o `adventure.json`.
 * Sem --acervo, lê `%APPDATA%/com.labirinto.app/itens/itens.json`.
 *
 * Por ficha, imprime a soma das quantidades por item ANTES e DEPOIS (vagas + pentes), os itens que
 * a conversão cria ou completa e os "Confira". ANTES = a cópia `.antes-itens-v2` quando ela existe
 * (a conversão já rodou); senão, o arquivo de agora, e DEPOIS = o que a conversão faria com ele.
 * Prova "nada se perdeu" sem abrir ficha por ficha. A conversão é a do app (`lib/itens/conversao`),
 * empacotada na hora pelo esbuild da raiz, sem cópia da regra aqui.
 */
const fs = require('node:fs')
const path = require('node:path')

const RAIZ = path.resolve(__dirname, '..')
const CLIENT = path.join(RAIZ, 'client')
const SUFIXO_DA_COPIA = '.antes-itens-v2'

function uso(mensagem) {
  if (mensagem) console.error(mensagem)
  console.error('uso: node scripts/relatorio-conversao-itens.cjs <pasta-das-fichas> [--acervo <itens.json>]')
  process.exit(2)
}

function argumentos(argv) {
  const lista = argv.slice(2)
  let pasta = null
  let acervo = null
  for (let i = 0; i < lista.length; i += 1) {
    if (lista[i] === '--acervo') {
      acervo = lista[i + 1] ?? uso('--acervo sem caminho')
      i += 1
    } else if (pasta === null) pasta = lista[i]
    else uso(`argumento a mais: ${lista[i]}`)
  }
  if (pasta === null) uso()
  const appData = process.env.APPDATA ?? path.join(process.env.HOME ?? '', '.config')
  return { pasta: path.resolve(pasta), acervo: path.resolve(acervo ?? path.join(appData, 'com.labirinto.app', 'itens', 'itens.json')) }
}

/** A conversão do app num módulo CommonJS em memória. */
function carregarConversao() {
  const esbuild = require(require.resolve('esbuild', { paths: [RAIZ, CLIENT] }))
  const entrada = [
    "export { converterFichas } from './src/lib/itens/conversao/ficha'",
    "export { converterItensDoAcervo } from './src/lib/itens/conversao/acervo'",
    "export { acervoDoTexto } from './src/lib/acervoDeItens'",
    "export { personagensDoArquivo } from './src/lib/personagem'",
  ].join('\n')
  const pacote = esbuild.buildSync({
    stdin: { contents: entrada, resolveDir: CLIENT, sourcefile: 'relatorio.ts', loader: 'ts' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    logLevel: 'silent',
    loader: { '.webp': 'empty', '.png': 'empty', '.svg': 'empty', '.css': 'empty', '.mp3': 'empty', '.ogg': 'empty', '.wav': 'empty' },
    write: false,
  })
  const modulo = { exports: {} }
  new Function('module', 'exports', 'require', pacote.outputFiles[0].text)(modulo, modulo.exports, require)
  return modulo.exports
}

function lerJson(caminho) {
  return JSON.parse(fs.readFileSync(caminho, 'utf8'))
}

function arquivoDasFichas(pasta) {
  for (const nome of ['rpg.json', 'adventure.json']) {
    const caminho = path.join(pasta, nome)
    if (fs.existsSync(caminho)) return caminho
  }
  uso(`sem rpg.json nem adventure.json em ${pasta}`)
}

/** Por ficha: quantos de cada item (pelo itemId; a vaga só com nome conta pelo nome), vagas + pentes. */
function contagem(personagem) {
  const soma = new Map()
  const somar = (chave, n) => soma.set(chave, (soma.get(chave) ?? 0) + n)
  for (const vaga of personagem.mochila ?? []) {
    somar(vaga.itemId ?? `nome:${vaga.nome}`, vaga.quantidade ?? 1)
    if (vaga.pente !== undefined) somar(vaga.pente.balaId, vaga.pente.n)
  }
  return soma
}

function main() {
  const { pasta, acervo: caminhoDoAcervo } = argumentos(process.argv)
  const conv = carregarConversao()
  const arquivo = arquivoDasFichas(pasta)
  const copia = `${arquivo}${SUFIXO_DA_COPIA}`
  const jaConvertida = fs.existsSync(copia)
  const acervoLido = fs.existsSync(caminhoDoAcervo) ? conv.acervoDoTexto(fs.readFileSync(caminhoDoAcervo, 'utf8')) : null
  const acervo = acervoLido === null ? [] : conv.converterItensDoAcervo(acervoLido.itens)
  const antes = conv.personagensDoArquivo(lerJson(jaConvertida ? copia : arquivo).personagens) ?? []
  const simulada = conv.converterFichas(acervo, jaConvertida ? conv.personagensDoArquivo(lerJson(arquivo).personagens) ?? [] : antes)
  const depois = simulada.personagens
  const nomeDoItem = new Map([...acervo, ...simulada.novos].map((item) => [item.id, item.nome]))
  const rotulo = (chave) => (chave.startsWith('nome:') ? `${chave.slice(5)} (só nome)` : `${nomeDoItem.get(chave) ?? '?'} [${chave}]`)

  console.log(`Fichas: ${arquivo}`)
  console.log(`Acervo: ${caminhoDoAcervo}${acervoLido === null ? ' (não achado: sem itens para casar)' : ` (${acervo.length} itens)`}`)
  console.log(jaConvertida ? `ANTES = ${copia} (a conversão já rodou); DEPOIS = o arquivo de agora` : 'ANTES = o arquivo de agora; DEPOIS = o que a conversão faria (nada foi gravado)')
  if (jaConvertida && simulada.personagens.some((p, i) => p !== conv.personagensDoArquivo(lerJson(arquivo).personagens)[i])) {
    console.log('ATENÇÃO: converter o arquivo de agora ainda mudaria alguma ficha (a conversão não está parada).')
  }
  let perdas = 0
  for (const ficha of antes) {
    const depoisDela = depois.find((p) => p.id === ficha.id)
    const a = contagem(ficha)
    const d = depoisDela === undefined ? new Map() : contagem(depoisDela)
    const linhas = []
    for (const chave of new Set([...a.keys(), ...d.keys()])) {
      const de = a.get(chave) ?? 0
      const para = d.get(chave) ?? 0
      // A vaga só com nome que ganhou itemId muda de chave: a soma pelo nome sai e a do item entra.
      if (de !== para) linhas.push(`    ${rotulo(chave)}: ${de} -> ${para}`)
    }
    const relatorio = simulada.relatorios.find((r) => r.personagemId === ficha.id)
    if (linhas.length === 0 && (relatorio === undefined || relatorio.confira.length === 0)) continue
    console.log(`\n${ficha.nome} (${ficha.id})`)
    for (const linha of linhas) console.log(linha)
    for (const frase of relatorio?.confira ?? []) console.log(`    Confira: ${frase}`)
    const somaAntes = [...a.values()].reduce((s, n) => s + n, 0)
    const somaDepois = [...d.values()].reduce((s, n) => s + n, 0)
    if (somaDepois < somaAntes) {
      perdas += 1
      console.log(`    PERDA: ${somaAntes} itens antes, ${somaDepois} depois`)
    }
  }
  console.log(`\nItens que a conversão cria ou completa no Acervo: ${simulada.novos.length}`)
  for (const item of simulada.novos) {
    console.log(`  ${item.nome} [${item.id}] tipo ${item.tipo ?? '?'}`)
    for (const confira of item.confira ?? []) console.log(`    Confira: ${confira.texto}${confira.antes ? ` (antes: ${confira.antes})` : ''}`)
  }
  console.log(perdas === 0 ? '\nNenhuma ficha ficou com menos itens.' : `\n${perdas} ficha(s) com menos itens: confira acima.`)
}

main()
