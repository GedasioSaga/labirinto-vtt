#!/usr/bin/env node
/*
 * TESTE EM NÍVEIS — o portão rápido do Labirinto (docs/planos/teste-em-niveis.md).
 *
 *   node scripts/teste-rapido.cjs [--base main] [--topo <ref>] [--nivel 0|1|2]
 *                                 [--so tsc|vitest|e2e|cargo] [--dry] [--sem-fila]
 *
 * POR QUE EXISTE. Cada integração rodava o vitest inteiro (~17 mil testes, 16 a
 * 20 min com a máquina disputada) + tsc + e2e: ~50 min, e como só uma suíte
 * pesada roda por vez na máquina, tudo virava fila. Este script olha o que
 * mudou contra o merge-base e roda só o que pode ter quebrado — e, quando não
 * sabe decidir, roda MAIS (cai para o nível 2), nunca menos.
 *
 * O QUE ELE NÃO ENXERGA, e por isso compensa: o vitest `related` só segue o
 * grafo de importação. CSS solto, PNG do golden, JSON lido por caminho e
 * arquivo de `public/` ficam fora. Por isso o golden e as três jornadas
 * seladas rodam SEMPRE no N1, arquivo desconhecido acrescenta a fumaça, e os
 * gatilhos de `GATILHOS_DO_N2` (config, dependência, helper de e2e) forçam o N2.
 *
 * FILA. O plano inteiro roda numa vaga só da fila global de suítes
 * (~/.claude/scripts/suite-lock.cjs): o script se reexecuta por dentro dela.
 * Não embrulhe este script em outro suite-lock (a vaga seria pedida duas vezes
 * e a segunda esperaria a primeira para sempre).
 */
'use strict'
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawn, spawnSync } = require('node:child_process')
const { pathToFileURL } = require('node:url')

const RAIZ = path.resolve(__dirname, '..')
const CLIENTE = path.join(RAIZ, 'client')
const TAURI = path.join(RAIZ, 'desktop', 'src-tauri')
const VITEST = path.join(RAIZ, 'node_modules', 'vitest', 'vitest.mjs')
const TSC = path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')
const PLAYWRIGHT = path.join(RAIZ, 'node_modules', '@playwright', 'test', 'cli.js')
const SUITE_LOCK = path.join(os.homedir(), '.claude', 'scripts', 'suite-lock.cjs')
const PROJETOS_JSON = path.join(CLIENTE, 'vitest.projetos.json')
const MAPA_JSON = path.join(CLIENTE, 'e2e', 'mapa-de-specs.json')
const TESTE_DA_GUARDA = 'vitest.projetos.test.mjs'
// e2e vermelhos PRÉ-EXISTENTES (arquivo › título completo): o N2 só reprova falha NOVA.
const CONHECIDAS_JSON = process.env.TESTE_RAPIDO_CONHECIDAS || path.join(CLIENTE, 'e2e', 'vermelhas-conhecidas.json')
// O Playwright 1.62 pede o chromium-1234; a máquina tem o 1243 (client/playwright.config.ts).
const NAVEGADOR_DA_MAQUINA = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe')
// Acima disto a lista de arquivos do `vitest related` estoura a linha do cmd.exe
// (8191), que é o shell do suite-lock; aí o comando vira `--changed <merge-base>`.
const TETO_DA_LINHA = 6000
const DISCO_MINIMO_GB = 8
const LINHAS_DO_RABO = 40

// Mudança aqui muda o que TODO teste enxerga e fica fora do grafo de importação.
const GATILHOS_DO_N2 = [
  'package.json',
  'package-lock.json',
  'client/package.json',
  'client/vite.config.ts',
  'client/vitest.projetos.json',
  'client/projetosDoVitest.js',
  'client/projetosDoVitest.d.ts',
  'client/tsconfig*.json',
  'client/playwright.config.ts',
  'client/porta.js',
  'client/e2e/helpers/**',
  'client/e2e/fixtures/**',
  'desktop/**/Cargo.lock',
]
// Mudança aqui não muda teste nenhum.
const IGNORADOS = ['docs/**', '**/*.md', '.gitignore', '.gitattributes', '.claude-trail.md']
// Arquivo da própria ferramenta: o grafo do vitest não chega no teste da guarda (CJS fora do client).
const DA_FERRAMENTA = ['scripts/teste-rapido.cjs', 'client/e2e/mapa-de-specs.json']
const EXTENSOES_DO_GRAFO = /\.(?:[cm]?[jt]sx?|json|css)$/
const EH_TESTE = /\.(?:test|spec)\.[cm]?[jt]sx?$/
// LISTA BRANCA DO N1 (conselho de 24/10/2026): o N1 só vale para diff feita
// SÓ de código que o grafo enxerga inteiro. O resto força o N2. O cargo testa o
// crate inteiro, por isso .rs de src/ e tests/ entra.
const LISTA_BRANCA_DO_N1 = [/^client\/src\/.+\.tsx?$/, /^client\/e2e\/[^/]+\.spec\.ts$/, /^desktop\/src-tauri\/(?:src|tests)\/.+\.rs$/]
const EH_FIXTURE = /(?:^|\/)__fixtures__\/|\.fixture\.tsx?$/

// ---------------------------------------------------------------- glob

function escaparRegex(texto) {
  return texto.replace(/[.+^$()|[\]\\{}]/g, '\\$&')
}

/** Glob simples (`*`, `**`, `?`, `{a,b}` sem curinga dentro) para RegExp ancorada. */
function globParaRegex(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      const barra = glob[i + 2] === '/'
      re += barra ? '(?:.*/)?' : '.*'
      i += barra ? 2 : 1
    } else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else if (c === '{' && glob.indexOf('}', i) > i) {
      const fim = glob.indexOf('}', i)
      re += '(?:' + glob.slice(i + 1, fim).split(',').map(escaparRegex).join('|') + ')'
      i = fim
    } else re += escaparRegex(c)
  }
  return new RegExp('^' + re + '$')
}

function casaAlgum(arquivo, globs) {
  return globs.some((g) => globParaRegex(g).test(arquivo))
}

/** Todos os arquivos (caminho com `/`, relativo a `raiz`), sem node_modules nem .git. */
function listarArquivos(raiz, rel = '') {
  const saida = []
  for (const ent of fs.readdirSync(path.join(raiz, rel), { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue
    const filho = rel ? rel + '/' + ent.name : ent.name
    if (ent.isDirectory()) saida.push(...listarArquivos(raiz, filho))
    else saida.push(filho)
  }
  return saida
}

// ---------------------------------------------------------------- configuração

function lerJson(arquivo) {
  return JSON.parse(fs.readFileSync(arquivo, 'utf8'))
}

/** Globs de cada projeto do vitest, relativos a client/ (fonte: client/vitest.projetos.json). */
function lerProjetos(arquivo = PROJETOS_JSON) {
  const bruto = lerJson(arquivo)
  const globs = (lista) => (lista || []).map((item) => item.glob)
  return { lento: globs(bruto.lento), desempenho: globs(bruto.desempenho), bruto }
}

function projetoDoTeste(relCliente, projetos) {
  if (casaAlgum(relCliente, projetos.desempenho)) return 'desempenho'
  if (casaAlgum(relCliente, projetos.lento)) return 'lento'
  return 'rapido'
}

/** Expande os nomes/globs de spec contra a pasta client/e2e. */
function expandirSpecs(globs, specsExistentes) {
  const saida = new Set()
  for (const g of globs) {
    const re = globParaRegex(g)
    for (const s of specsExistentes) if (re.test(s)) saida.add(s)
  }
  return saida
}

function specsExistentes(raizCliente = CLIENTE) {
  return fs.readdirSync(path.join(raizCliente, 'e2e')).filter((n) => /\.spec\.ts$/.test(n))
}

// ---------------------------------------------------------------- git

function git(args) {
  const r = spawnSync('git', ['-C', RAIZ, '-c', 'core.quotePath=false', ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + String(r.stderr || '').trim())
  return r.stdout
}

function listaZ(saida) {
  return saida.split('\0').filter(Boolean)
}

/** Arquivos mudados: merge-base..HEAD + árvore suja + não rastreados (ou base..topo, sem a árvore). */
function arquivosMudados(base, topo) {
  if (topo) {
    const mergeBase = git(['merge-base', base, topo]).trim()
    return { mergeBase, arquivos: [...new Set(listaZ(git(['diff', '--name-only', '-z', '--no-renames', mergeBase, topo])))].sort() }
  }
  const mergeBase = git(['merge-base', 'HEAD', base]).trim()
  const commits = listaZ(git(['diff', '--name-only', '-z', '--no-renames', mergeBase, 'HEAD']))
  const sujos = listaZ(git(['diff', '--name-only', '-z', '--no-renames', 'HEAD']))
  const novos = listaZ(git(['ls-files', '-z', '--others', '--exclude-standard']))
  return { mergeBase, arquivos: [...new Set([...commits, ...sujos, ...novos])].sort() }
}

// ---------------------------------------------------------------- classificação

function novaClassificacao() {
  return {
    gatilhos: [], ignorados: [], fontesDoVitest: [], testesPorProjeto: { rapido: [], lento: [], desempenho: [] },
    specsMudados: new Set(), areas: new Set(), desconhecidos: [], removidos: [], desktop: [], extrasDoVitest: new Set(), centrais: [],
  }
}

function classificarArquivo(arq, ctx, c) {
  const existe = ctx.existe(arq)
  if (casaAlgum(arq, IGNORADOS)) return c.ignorados.push(arq)
  if (casaAlgum(arq, GATILHOS_DO_N2)) return c.gatilhos.push(arq)
  if (DA_FERRAMENTA.includes(arq)) return c.extrasDoVitest.add(TESTE_DA_GUARDA)
  if (arq.startsWith('desktop/')) return c.desktop.push(arq)
  const snapshot = /^client\/e2e\/([^/]+\.spec\.ts)-snapshots\//.exec(arq)
  if (snapshot) return c.specsMudados.add(snapshot[1])
  if (/^client\/e2e\/[^/]+\.spec\.ts$/.test(arq)) {
    if (existe) c.specsMudados.add(arq.slice('client/e2e/'.length))
    return
  }
  if (!arq.startsWith('client/src/')) return c.desconhecidos.push(arq)
  const relCliente = arq.slice('client/'.length)
  if (!existe) {
    c.removidos.push(arq)
    return c.desconhecidos.push(arq)
  }
  if (EH_TESTE.test(arq)) return c.testesPorProjeto[projetoDoTeste(relCliente, ctx.projetos)].push(relCliente)
  if (EXTENSOES_DO_GRAFO.test(arq)) c.fontesDoVitest.push(relCliente)
  if (casaAlgum(arq, ctx.mapa.centrais || [])) c.centrais.push(arq)
  const areas = (ctx.mapa.areas || []).filter((a) => casaAlgum(arq, a.fontes))
  for (const a of areas) c.areas.add(a.area)
  if (areas.length === 0 || !EXTENSOES_DO_GRAFO.test(arq)) c.desconhecidos.push(arq)
}

function classificar(arquivos, ctx) {
  const c = novaClassificacao()
  for (const arq of arquivos) classificarArquivo(arq, ctx, c)
  return c
}

/** Motivo para o arquivo tirar a diff do N1 (null = está na lista branca). Em dúvida, motivo. */
function foraDaListaBranca(arq, ctx) {
  if (casaAlgum(arq, IGNORADOS)) return null
  if (!LISTA_BRANCA_DO_N1.some((re) => re.test(arq))) return 'não é .ts/.tsx/.rs'
  if (EH_FIXTURE.test(arq)) return 'fixture'
  if (casaAlgum(arq, ctx.mapa.quentes || [])) return 'arquivo quente'
  if (!EH_TESTE.test(arq) && casaAlgum(arq, ctx.mapa.visuais || [])) return 'visual do Meio-Termo'
  if (!ctx.existe(arq)) return 'removido'
  const ehFonte = arq.startsWith('client/src/') && !EH_TESTE.test(arq)
  if (ehFonte && !(ctx.mapa.areas || []).some((a) => casaAlgum(arq, a.fontes))) return 'fora das áreas do mapa'
  return null
}

// ---------------------------------------------------------------- plano

function specsDoE2e(nivel, c, ctx) {
  const todos = ctx.specs
  if (nivel === 2) return { specs: [...todos].sort(), fumaca: false }
  const pedidos = new Set(c.specsMudados)
  // N0 é o laço do agente (alvo 90 s): da área, só a lista curta `n0`.
  for (const a of ctx.mapa.areas || []) {
    if (c.areas.has(a.area)) for (const s of expandirSpecs(nivel === 0 ? a.n0 || [] : a.specs, todos)) pedidos.add(s)
  }
  if (nivel === 1) {
    for (const s of expandirSpecs([...ctx.mapa.sempre, ...ctx.mapa.fumaca], todos)) pedidos.add(s)
  }
  return { specs: [...pedidos].sort() }
}

function etapaVitest(id, titulo, argsDoVitest, extra = {}) {
  return { id, tipo: 'vitest', titulo, exe: process.execPath, args: [VITEST, ...argsDoVitest], cwd: CLIENTE, ...extra }
}

function etapasDeTsc(cache) {
  const tsc = (id, config) => ({
    id, tipo: 'tsc', titulo: 'tsc --noEmit -p ' + config + ' (incremental)', exe: process.execPath, cwd: CLIENTE,
    args: [TSC, '--noEmit', '-p', config, '--incremental', '--tsBuildInfoFile', path.join(cache, id + '.tsbuildinfo')],
  })
  return [tsc('tsc-app', 'tsconfig.json'), tsc('tsc-e2e', 'tsconfig.e2e.json')]
}

function etapasDeVitest(nivel, c, plano) {
  if (nivel === 2) {
    return [etapaVitest('vitest-rapido-lento', 'vitest projetos rapido + lento (tudo menos desempenho)', ['run', '--project', 'rapido', '--project', 'lento'])]
  }
  const etapas = []
  // N1: os testes de "mapa salvo abre idêntico" (round-trip dos mapas reais) vão SEMPRE.
  const sempre = nivel === 1 ? plano.sempreNoVitest : []
  const relacionados = [...new Set([...c.fontesDoVitest, ...c.testesPorProjeto.rapido, ...c.extrasDoVitest, ...sempre])]
  if (relacionados.length > sempre.length) {
    const longa = relacionados.join(' ').length > TETO_DA_LINHA
    let args = ['related', '--run', '--project', 'rapido', '--passWithNoTests', ...relacionados]
    let titulo = 'vitest rapido: ' + relacionados.length + ' arquivos (mudados + sempre) e dependentes pelo grafo'
    if (longa && !plano.topo) args = ['run', '--changed', plano.mergeBase, '--project', 'rapido', '--passWithNoTests', ...sempre]
    if (longa && plano.topo) [args, titulo] = [['run', '--project', 'rapido'], 'vitest rapido inteiro (lista longa demais com --topo)']
    etapas.push(etapaVitest('vitest-rapido', titulo, args))
  } else if (sempre.length > 0) {
    etapas.push(etapaVitest('vitest-rapido', 'vitest rapido: só os ' + sempre.length + ' de sempre (nada de client/src mudou)', ['run', '--project', 'rapido', ...sempre]))
  }
  if (c.testesPorProjeto.lento.length > 0) {
    etapas.push(etapaVitest('vitest-lento-mudados', 'vitest lento: só os ' + c.testesPorProjeto.lento.length + ' arquivos de teste mudados', ['run', '--project', 'lento', ...c.testesPorProjeto.lento]))
  }
  return etapas
}

/** Nomes `arquivo › describe › título` (o formato do reporter list) do JSON do Playwright. */
function nomesDoRelatorioE2e(relatorio) {
  const falhas = new Set()
  const passaram = new Set()
  const andar = (suite, arquivo, titulos) => {
    const doArquivo = arquivo || String(suite.file || suite.title).replace(/\\/g, '/').replace(/^e2e\//, '')
    const caminho = arquivo ? [...titulos, suite.title] : []
    for (const spec of suite.specs || []) {
      const nome = [doArquivo, ...caminho, spec.title].join(' › ')
      for (const t of spec.tests || []) {
        if (t.status === 'unexpected') falhas.add(nome)
        else if (t.status === 'expected' || t.status === 'flaky') passaram.add(nome)
      }
    }
    for (const filha of suite.suites || []) andar(filha, doArquivo, caminho)
  }
  for (const suite of relatorio.suites || []) andar(suite, null, [])
  return { falhas, passaram }
}

function lerConhecidas(arquivo = CONHECIDAS_JSON) {
  return fs.existsSync(arquivo) ? new Set(lerJson(arquivo)) : new Set()
}

/** Falha nova reprova; conhecida que passou só avisa (a lista deve ser enxugada). */
function compararComConhecidas(falhas, passaram, conhecidas) {
  return { novas: [...falhas].filter((n) => !conhecidas.has(n)).sort(), curadas: [...conhecidas].filter((n) => passaram.has(n)).sort() }
}

function etapaDeE2e(specs, titulo) {
  // O playwright.config.ts usa 2 workers porque várias árvores rodavam juntas;
  // dentro da vaga da fila a máquina é só desta suíte.
  const env = process.env.PW_WORKERS ? {} : { PW_WORKERS: '4' }
  return { id: 'e2e', tipo: 'e2e', titulo, exe: process.execPath, cwd: CLIENTE, env, args: [PLAYWRIGHT, 'test', '--config', 'playwright.config.ts', '--reporter=list,json', '--retries=0', ...specs] }
}

function etapasDeCargo() {
  const env = { CARGO_INCREMENTAL: '0', CARGO_PROFILE_DEV_DEBUG: '0' }
  return [
    { id: 'cargo-clippy', tipo: 'cargo', titulo: 'cargo clippy (desktop/src-tauri)', exe: 'cargo', cwd: TAURI, env,
      args: ['clippy', '--all-targets', '--all-features', '--', '-D', 'warnings', '-W', 'clippy::unwrap_used', '-W', 'clippy::expect_used'] },
    { id: 'cargo-test', tipo: 'cargo', titulo: 'cargo test (desktop/src-tauri)', exe: 'cargo', cwd: TAURI, env, args: ['test', '--all-features'] },
  ]
}

function etapaDeDesempenho(nivel, c) {
  if (nivel === 2) return etapaVitest('vitest-desempenho', 'vitest desempenho (sozinho, em série, por último)', ['run', '--project', 'desempenho'], { reprise: true })
  if (c.testesPorProjeto.desempenho.length === 0) return null
  return etapaVitest('vitest-desempenho', 'vitest desempenho: só os ' + c.testesPorProjeto.desempenho.length + ' mudados (sozinhos, por último)',
    ['run', '--project', 'desempenho', ...c.testesPorProjeto.desempenho], { reprise: true })
}

/** Decide o nível e as etapas. Pura: todo I/O entra por `ctx`. */
function montarPlano({ nivelPedido, base, topo, mergeBase, arquivos, ctx, so }) {
  const c = classificar(arquivos, ctx)
  const avisos = []
  let nivel = nivelPedido
  if (c.gatilhos.length > 0 && nivel < 2) {
    avisos.push('N2 forçado: ' + c.gatilhos.join(', ') + ' muda o que todo teste enxerga')
    nivel = 2
  }
  if (nivel === 1) {
    const motivos = arquivos.map((a) => [a, foraDaListaBranca(a, ctx)]).filter(([, m]) => m)
    if (motivos.length > 0) {
      const lista = motivos.slice(0, 8).map(([a, m]) => a + ' (' + m + ')').join(', ')
      avisos.push('N2 forçado pela lista branca do N1: ' + lista + (motivos.length > 8 ? ' (+' + (motivos.length - 8) + ')' : ''))
      nivel = 2
    }
  }
  if (c.removidos.length > 0) avisos.push('removidos (dependentes só pelo tsc): ' + c.removidos.join(', '))
  if (c.centrais.length > 0) avisos.push('arquivo central (muitos dependentes no vitest): ' + c.centrais.join(', '))
  const sempreNoVitest = ctx.projetos.bruto.sempreNoN1 || []
  const plano = { nivel, nivelPedido, base, topo, mergeBase, arquivos, classificacao: c, avisos, etapas: [], fora: [], sempreNoVitest }
  const e2e = specsDoE2e(nivel, c, ctx)
  if (nivel === 0 && c.desconhecidos.length > 0) avisos.push('sem mapa (no N1 isto vira N2): ' + c.desconhecidos.slice(0, 6).join(', '))
  const etapas = [...etapasDeTsc(ctx.cache), ...etapasDeVitest(nivel, c, plano)]
  // N2 não passa filtro: o Playwright pega todo spec de client/e2e, até um que o mapa não conheça.
  if (nivel === 2) etapas.push(etapaDeE2e([], 'e2e: todos os specs de client/e2e (' + e2e.specs.length + ')'))
  else if (e2e.specs.length > 0) etapas.push(etapaDeE2e(e2e.specs, 'e2e: ' + e2e.specs.length + ' specs'))
  const comCargo = nivel >= 1 && c.desktop.length > 0
  if (comCargo) etapas.push(...etapasDeCargo())
  const desempenho = etapaDeDesempenho(nivel, c)
  if (desempenho) etapas.push(desempenho)
  plano.etapas = so ? etapas.filter((e) => e.tipo === so) : etapas
  if (!comCargo) plano.fora.push('cargo: ' + (c.desktop.length > 0 ? 'desktop/ mudou, mas N0 não roda cargo' : 'desktop/ sem mudança'))
  if (nivel < 2) plano.fora.push('vitest lento/desempenho: dependentes não mudados só no N2')
  if (nivel === 0) plano.fora.push('e2e: golden, seladas e fumaça só no N1')
  return plano
}

// ---------------------------------------------------------------- execução

function formatarTempo(ms) {
  const s = Math.round(ms / 1000)
  return s >= 60 ? Math.floor(s / 60) + 'min' + String(s % 60).padStart(2, '0') + 's' : s + 's'
}

function rodar(etapa, arquivoDeLog, argsExtras = []) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const log = fs.createWriteStream(arquivoDeLog)
    const env = { ...process.env, ...(etapa.env || {}) }
    const filho = spawn(etapa.exe, [...etapa.args, ...argsExtras], { cwd: etapa.cwd, env, windowsHide: true })
    filho.stdout.pipe(log, { end: false })
    filho.stderr.pipe(log, { end: false })
    const fim = (codigo) => log.end(() => resolve({ codigo, ms: Date.now() - t0 }))
    filho.on('error', (erro) => { log.write(String(erro) + '\n'); fim(127) })
    filho.on('close', (codigo) => fim(codigo === null ? 1 : codigo))
  })
}

function lerJsonDoVitest(arquivo) {
  try {
    return lerJson(arquivo)
  } catch {
    return null
  }
}

function resumoDoVitest(json) {
  if (!json) return 'sem relatório JSON'
  return json.testResults.length + ' arquivos, ' + json.numTotalTests + ' testes (' + json.numFailedTests + ' falharam)'
}

function resumoDoLog(etapa, texto) {
  if (etapa.tipo === 'e2e') {
    const n = (re) => (re.exec(texto) || [0, 0])[1]
    return n(/(\d+) passed/) + ' passaram, ' + n(/(\d+) failed/) + ' falharam, ' + n(/(\d+) flaky/) + ' instáveis'
  }
  if (etapa.tipo === 'tsc') return (texto.match(/error TS\d+/g) || []).length + ' erros'
  return ''
}

function rabo(texto) {
  return texto.split(/\r?\n/).slice(-LINHAS_DO_RABO).map((l) => '      ' + l).join('\n')
}

/** e2e: compara as falhas com as vermelhas conhecidas. Só o N2 troca o veredito; abaixo é informação. */
function julgarE2e(arquivoJson, codigo, nivel) {
  let relatorio
  try {
    relatorio = lerJson(arquivoJson)
  } catch {
    return { codigo, nota: ' | sem relatório JSON do Playwright' }
  }
  const { falhas, passaram } = nomesDoRelatorioE2e(relatorio)
  const { novas, curadas } = compararComConhecidas(falhas, passaram, lerConhecidas())
  let nota = ' | ' + falhas.size + ' falhas: ' + (falhas.size - novas.length) + ' conhecidas, ' + novas.length + ' NOVAS'
  if (curadas.length > 0) nota += ' | aviso: ' + curadas.length + ' conhecidas passaram (enxugue ' + path.basename(CONHECIDAS_JSON) + '): ' + curadas.slice(0, 5).join('; ')
  if (novas.length > 0) nota += '\n    NOVAS:\n' + novas.map((n) => '      ' + n).join('\n')
  // Exit ≠ 0 sem falha nenhuma no relatório é ruína (servidor que não subiu): continua vermelho.
  const soConhecidas = codigo !== 0 && falhas.size > 0 && novas.length === 0
  return { codigo: nivel === 2 && soConhecidas ? 0 : codigo, nota }
}

async function executarEtapa(etapa, pastaDeLog, nivel) {
  const log = path.join(pastaDeLog, etapa.id + '.log')
  const jsonDoVitest = path.join(pastaDeLog, etapa.id + '.json')
  const jsonDoE2e = path.join(pastaDeLog, 'e2e.json')
  if (etapa.tipo === 'e2e') etapa = { ...etapa, env: { ...etapa.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonDoE2e } }
  const extras = etapa.tipo === 'vitest' ? ['--reporter=default', '--reporter=json', '--outputFile.json=' + jsonDoVitest] : []
  let { codigo, ms } = await rodar(etapa, log, extras)
  const texto = fs.readFileSync(log, 'utf8')
  let json = etapa.tipo === 'vitest' ? lerJsonDoVitest(jsonDoVitest) : null
  let nota = etapa.tipo === 'vitest' ? resumoDoVitest(json) : resumoDoLog(etapa, texto)
  if (codigo !== 0 && etapa.reprise && json) {
    const falhos = json.testResults.filter((r) => r.status === 'failed').map((r) => path.relative(CLIENTE, r.name).replace(/\\/g, '/'))
    const reprise = { ...etapa, id: etapa.id + '-reprise', args: [VITEST, 'run', '--project', 'desempenho', ...falhos] }
    const jsonReprise = path.join(pastaDeLog, reprise.id + '.json')
    const r = await rodar(reprise, path.join(pastaDeLog, reprise.id + '.log'), ['--reporter=default', '--reporter=json', '--outputFile.json=' + jsonReprise])
    ms += r.ms
    nota += ' | reprise isolada de ' + falhos.length + ' arquivo(s): ' + (r.codigo === 0 ? 'PASSOU (instável sob carga: ' + falhos.join(', ') + ')' : 'falhou de novo')
    if (r.codigo === 0) codigo = 0
  }
  if (etapa.tipo === 'e2e') {
    const julgado = julgarE2e(jsonDoE2e, codigo, nivel)
    codigo = julgado.codigo
    nota += julgado.nota
  }
  const ok = codigo === 0
  console.log((ok ? 'PASSOU ' : 'FALHOU ') + etapa.id.padEnd(22) + formatarTempo(ms).padStart(8) + '  ' + nota)
  if (!ok) console.log('    log: ' + log + '\n' + rabo(texto))
  return { id: etapa.id, ok, ms, nota }
}

function discoLivreGb() {
  const estado = fs.statfsSync(RAIZ)
  return (estado.bavail * estado.bsize) / 1e9
}

/** CARGO_TARGET_DIR da árvore principal (o que já está quente), como o scripts/portao.cjs. */
function alvoDoCargo() {
  if (process.env.CARGO_TARGET_DIR) return process.env.CARGO_TARGET_DIR
  const comum = git(['rev-parse', '--git-common-dir']).trim()
  const principal = path.dirname(path.resolve(RAIZ, comum))
  const alvo = path.join(principal, 'desktop', 'src-tauri', 'target')
  return fs.existsSync(path.join(principal, 'desktop', 'src-tauri', 'Cargo.toml')) ? alvo : path.join(TAURI, 'target')
}

async function executarPlano(plano) {
  const pastaDeLog = plano.pastaDeLog
  fs.mkdirSync(pastaDeLog, { recursive: true })
  const t0 = Date.now()
  const resultados = []
  for (const etapa of plano.etapas) {
    if (etapa.tipo === 'cargo') {
      const livre = discoLivreGb()
      if (livre < DISCO_MINIMO_GB) {
        console.log('FALHOU ' + etapa.id.padEnd(22) + '      0s  disco com ' + livre.toFixed(1) + ' GB livres (mínimo ' + DISCO_MINIMO_GB + ')')
        resultados.push({ id: etapa.id, ok: false, ms: 0 })
        continue
      }
      etapa.env = { ...etapa.env, CARGO_TARGET_DIR: alvoDoCargo() }
    }
    resultados.push(await executarEtapa(etapa, pastaDeLog, plano.nivel))
  }
  const falhas = resultados.filter((r) => !r.ok)
  console.log('-'.repeat(72))
  console.log('N' + plano.nivel + ' ' + (falhas.length === 0 ? 'VERDE' : 'VERMELHO (' + falhas.map((f) => f.id).join(', ') + ')') +
    ' em ' + formatarTempo(Date.now() - t0) + ' (' + resultados.length + ' etapas; logs em ' + pastaDeLog + ')')
  return falhas.length === 0 ? 0 : 1
}

// ---------------------------------------------------------------- linha de comando

function lerArgs(argv) {
  const args = { base: 'main', topo: null, nivel: 1, so: null, dry: false, semFila: false, plano: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const valor = () => {
      if (argv[i + 1] === undefined) throw new Error(a + ' pede um valor')
      return argv[++i]
    }
    if (a === '--base') args.base = valor()
    else if (a === '--topo') args.topo = valor()
    else if (a === '--nivel') args.nivel = Number(valor())
    else if (a === '--so') args.so = valor()
    else if (a === '--dry') args.dry = true
    else if (a === '--sem-fila') args.semFila = true
    else if (a === '--executar-plano') args.plano = valor()
    else throw new Error('argumento desconhecido: ' + a)
  }
  if (![0, 1, 2].includes(args.nivel)) throw new Error('--nivel é 0, 1 ou 2')
  if (args.so && !['tsc', 'vitest', 'e2e', 'cargo'].includes(args.so)) throw new Error('--so é tsc, vitest, e2e ou cargo')
  return args
}

async function contextoReal() {
  const { portaDoProjeto } = await import(pathToFileURL(path.join(CLIENTE, 'porta.js')).href)
  return {
    projetos: lerProjetos(),
    mapa: lerJson(MAPA_JSON),
    specs: specsExistentes(),
    cache: path.join(CLIENTE, 'node_modules', '.cache', 'teste-rapido-' + portaDoProjeto()),
    existe: (rel) => fs.existsSync(path.join(RAIZ, rel)),
  }
}

function imprimirPlano(plano) {
  const c = plano.classificacao
  console.log('[teste-rapido] N' + plano.nivel + (plano.nivel !== plano.nivelPedido ? ' (pedido N' + plano.nivelPedido + ')' : '') +
    ' | base ' + plano.base + (plano.topo ? '..' + plano.topo : '') + ' merge-base ' + String(plano.mergeBase).slice(0, 8) +
    ' | ' + plano.arquivos.length + ' mudados (' + c.ignorados.length + ' ignorados, ' + c.desconhecidos.length + ' sem mapa)' +
    ' | áreas e2e: ' + ([...c.areas].join(', ') || 'nenhuma'))
  for (const aviso of plano.avisos) console.log('  aviso: ' + aviso)
  for (const fora of plano.fora) console.log('  fora deste nível: ' + fora)
  for (const e of plano.etapas) console.log('  etapa ' + e.id.padEnd(22) + e.titulo)
}

function nomeDaArvore() {
  return path.basename(RAIZ)
}

function comFila(arquivoDoPlano, nivel) {
  return new Promise((resolve) => {
    const args = [SUITE_LOCK, '--nome', nomeDaArvore() + '-teste-rapido-N' + nivel, '--', process.execPath, __filename, '--executar-plano', arquivoDoPlano]
    const filho = spawn(process.execPath, args, { stdio: 'inherit', windowsHide: true })
    filho.on('close', (codigo) => resolve(codigo === null ? 1 : codigo))
  })
}

async function principal() {
  const args = lerArgs(process.argv.slice(2))
  if (args.plano) return executarPlano(lerJson(args.plano))
  const ctx = await contextoReal()
  let plano
  try {
    const { mergeBase, arquivos } = arquivosMudados(args.base, args.topo)
    plano = montarPlano({ nivelPedido: args.nivel, base: args.base, topo: args.topo, mergeBase, arquivos, ctx, so: args.so })
  } catch (erro) {
    // Não soube decidir: roda MAIS, nunca menos.
    console.log('[teste-rapido] não consegui calcular a diff (' + erro.message + '); caindo para N2')
    plano = montarPlano({ nivelPedido: 2, base: args.base, topo: null, mergeBase: '?', arquivos: [], ctx, so: args.so })
  }
  if (args.topo) console.log('  aviso: --topo calcula a diff ' + args.base + '..' + args.topo + ' mas testa a árvore ATUAL')
  imprimirPlano(plano)
  if (args.dry) return 0
  if (!process.env.LAB_NAVEGADOR && fs.existsSync(NAVEGADOR_DA_MAQUINA)) process.env.LAB_NAVEGADOR = NAVEGADOR_DA_MAQUINA
  plano.pastaDeLog = path.join(os.tmpdir(), 'teste-rapido', nomeDaArvore() + '-' + Date.now())
  if (args.semFila || !fs.existsSync(SUITE_LOCK)) {
    if (!args.semFila) console.log('  aviso: suite-lock não encontrado em ' + SUITE_LOCK + '; rodando sem fila')
    return executarPlano(plano)
  }
  fs.mkdirSync(plano.pastaDeLog, { recursive: true })
  const arquivoDoPlano = path.join(plano.pastaDeLog, 'plano.json')
  fs.writeFileSync(arquivoDoPlano, JSON.stringify(plano))
  return comFila(arquivoDoPlano, plano.nivel)
}

module.exports = {
  GATILHOS_DO_N2, IGNORADOS, globParaRegex, casaAlgum, listarArquivos, lerProjetos, projetoDoTeste,
  expandirSpecs, specsExistentes, classificar, foraDaListaBranca, montarPlano,
  nomesDoRelatorioE2e, compararComConhecidas, lerConhecidas, CONHECIDAS_JSON,
}

if (require.main === module) {
  principal().then(
    (codigo) => process.exit(codigo),
    (erro) => {
      console.error('[teste-rapido] ' + (erro && erro.stack ? erro.stack : erro))
      process.exit(2)
    },
  )
}
