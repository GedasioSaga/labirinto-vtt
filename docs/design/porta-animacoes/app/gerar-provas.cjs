'use strict'
/**
 * PROVAS DA FAIXA A3 (22/10/2026): o desenho novo da porta e as cinco
 * animações do pacote, NO APP.
 *
 *   node docs/design/porta-animacoes/app/gerar-provas.cjs
 *
 * Empacota `laboratorio.ts` (código REAL de client/src) com o esbuild, abre no
 * Chromium 1243 do Playwright e grava em `provas/`:
 *   folhas/<id>.png   folha de contato, 16 quadros (8 abrindo, 8 fechando), tempo embaixo
 *   som/<id>-<sentido>.wav   16 bits, para OUVIR (medir não é ouvir)
 *   testes.json       medidas e veredito de cada meta de metas.json
 * Sai com código 1 se alguma meta reprovar.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PASTA = __dirname
const PROVAS = path.join(PASTA, 'provas')
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))
const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
const medidas = require(path.join(RAIZ, 'scripts', 'som', 'medidas.cjs'))
const metas = require('./metas.json')

const NOVAS = ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina']
const TODAS = ['girar', 'deslizar', ...NOVAS]
const ZOOMS = [1, 2.5, 4]
const RESOLUCOES = [1, 2]
const CREME = 0xd9d2c0
const VERMELHA = 0xe2645a
const ESCURO = 0x15181a
const MUSGO = 0x5e8c4a
const CASOS = [
  { titulo: 'Sem cor (creme)', fechada: {}, aberta: { open: true } },
  { titulo: 'Cor própria musgo #5e8c4a', fechada: { cor: '#5e8c4a' }, aberta: { cor: '#5e8c4a', open: true } },
]
/** Trechos em que o desenho treme de propósito (golpe, corrente): a régua da continuidade não vale ali. */
const TREMOR = { grade: [0.18, 0.44], arrombada: [0.1, 0.34] }
/** M9: a medida do app com placa de vídeo, gravada por client/e2e/task-door-app-1440.spec.ts com PROVA_PORTA_APP=1. */
const DESEMPENHO_DO_APP = path.join(PROVAS, 'desempenho-app.json')
const QUADRO_P95_MAX_MS = 20
const TAREFA_LONGA_MAX_MS = 200
/** Renderizadores por software: com eles a medida do app não diz nada da placa de vídeo. */
const PLACA_DE_SOFTWARE = /swiftshader|llvmpipe|software|basic render/i

const r2 = (v) => Math.round(v * 100) / 100
const dePng = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')
function p95(valores) {
  const o = [...valores].sort((a, b) => a - b)
  return o.length === 0 ? 0 : o[Math.min(o.length - 1, Math.floor(o.length * 0.95))]
}
const hex = (c) => (c < 0 ? 'vazio' : `#${c.toString(16).padStart(6, '0')}`)

function montarPagina() {
  const pacote = esbuild.buildSync({
    entryPoints: [path.join(PASTA, 'laboratorio.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    minify: true,
    legalComments: 'none',
    write: false,
    logLevel: 'warning',
    loader: { '.json': 'json' },
  })
  // Um "</script" dentro do pacote fecharia a tag no meio da página.
  const codigo = pacote.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
  const arquivo = path.join(os.tmpdir(), 'porta-a3-laboratorio.html')
  fs.writeFileSync(arquivo, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Laboratório da porta A3</title></head><body style="margin:0;background:#1b1711"><script>${codigo}</script></body></html>`)
  return { url: 'file:///' + arquivo.replace(/\\/g, '/'), arquivo }
}

function navegador() {
  const exe = process.env.LAB_NAVEGADOR || path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe')
  return fs.existsSync(exe) ? exe : undefined
}

/** A medida do app com placa de vídeo (M9), ou null se o teste do app ainda não a gravou. */
function lerDesempenhoDoApp() {
  if (!fs.existsSync(DESEMPENHO_DO_APP)) return null
  return JSON.parse(fs.readFileSync(DESEMPENHO_DO_APP, 'utf8'))
}

/** A seção transversal esperada da porta parada: escuro, cor, escuro, com 4 e 1 px de tela vezes a resolução. */
function secaoConfere(corridas, cor, res, anel) {
  let pintadas = corridas.filter(([c]) => c !== -1)
  // A trancada com cor própria tem o anel vermelho por FORA do contorno escuro, dos dois lados.
  if (anel) {
    if (pintadas.length !== 5 || pintadas[0][0] !== VERMELHA || pintadas[4][0] !== VERMELHA || pintadas[0][1] < 1 || pintadas[4][1] < 1) return false
    pintadas = pintadas.slice(1, 4)
  }
  const e = Math.round(1 * res)
  const t = Math.round(4 * res)
  return pintadas.length === 3 && pintadas[0][0] === ESCURO && pintadas[0][1] === e && pintadas[1][0] === cor && pintadas[1][1] === t - e && pintadas[2][0] === ESCURO && pintadas[2][1] === e
}

async function main() {
  const inicio = Date.now()
  for (const d of ['folhas', 'som']) fs.mkdirSync(path.join(PROVAS, d), { recursive: true })
  const { url, arquivo } = montarPagina()
  const browser = await chromium.launch({ executablePath: navegador(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
  const avisos = []
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') avisos.push({ tipo: m.type(), texto: m.text() })
  })
  page.on('pageerror', (e) => avisos.push({ tipo: 'pageerror', texto: e.message }))
  await page.goto(url)
  await page.waitForFunction(() => document.documentElement.dataset.pronto === 'sim', null, { timeout: 30000 })

  const falhas = []
  const reprovar = (meta, texto) => falhas.push(`${meta}: ${texto}`)
  const r = { metas: metas.metas, navegador: navegador() ?? 'chromium padrão do Playwright', registro: null, parada: [], animacoes: {}, som: {}, desempenho: null }

  // --- M0 --------------------------------------------------------------------
  r.registro = await page.evaluate(() => window.PortaA3.carregarAsCinco())
  for (const id of TODAS) if (!r.registro.includes(id)) reprovar('M0_registro', `${id} fora do registro`)

  // --- M11: a porta parada no pixel -------------------------------------------
  const estados = [
    { nome: 'fechada sem cor', estado: {}, cor: CREME, cadeado: false },
    { nome: 'trancada sem cor', estado: { locked: true }, cor: VERMELHA, cadeado: false },
    { nome: 'fechada com cor', estado: { cor: '#5e8c4a' }, cor: MUSGO, cadeado: false },
    { nome: 'trancada com cor', estado: { cor: '#5e8c4a', locked: true }, cor: MUSGO, cadeado: true },
    { nome: 'secreta trancada com cor', estado: { cor: '#5e8c4a', locked: true, secret: true }, cor: MUSGO, cadeado: false, secreta: true },
  ]
  const cadeadoPorRes = {}
  for (const e of estados) {
    for (const zoom of ZOOMS) {
      for (const res of RESOLUCOES) {
        for (const vertical of [false, true]) {
          const m = await page.evaluate((a) => window.PortaA3.parada(a.estado, a.zoom, a.res, a.vertical), { estado: e.estado, zoom, res, vertical })
          const onde = `${e.nome} zoom ${zoom} res ${res} ${vertical ? 'vertical' : 'horizontal'}`
          const linha = { onde, transversal: m.transversal.map(([c, n]) => `${hex(c)}x${n}`).join(' '), cadeadoPx: m.cadeado, semOpacidade: m.semOpacidade }
          if (!e.secreta) {
            if (!secaoConfere(m.transversal, e.cor, res, e.cadeado)) reprovar('M11_parada', `${onde}: seção ${linha.transversal}`)
            // Ao longo do vão: a corrida da cor da porta (pode ser partida pelo cadeado no meio) começa e acaba nas pontas.
            let pos = 0
            let primeiro = null
            let ultimo = null
            for (const [c, n] of m.aoLongo) {
              if (c === e.cor) {
                if (primeiro === null) primeiro = pos
                ultimo = pos + n
              }
              pos += n
            }
            const ini = primeiro === null ? NaN : primeiro / res
            const fim = ultimo === null ? NaN : ultimo / res
            linha.corDe = r2(ini)
            linha.corAte = r2(fim)
            linha.vaoDe = r2(m.inicioDoVaoPx)
            linha.vaoAte = r2(m.fimDoVaoPx)
            if (!(Math.abs(ini - m.inicioDoVaoPx) <= 1 && Math.abs(fim - m.fimDoVaoPx) <= 1)) reprovar('M11_parada', `${onde}: cor de ${r2(ini)} a ${r2(fim)} px, vão de ${m.inicioDoVaoPx} a ${m.fimDoVaoPx}`)
          }
          if (e.cadeado) {
            if (m.cadeado === 0) reprovar('M11_parada', `${onde}: sem cadeado`)
            cadeadoPorRes[res] = cadeadoPorRes[res] ?? new Set()
            cadeadoPorRes[res].add(m.cadeado)
          } else if (m.cadeado !== 0) reprovar('M11_parada', `${onde}: ${m.cadeado} pixels de cadeado`)
          if (m.semOpacidade !== 0) reprovar('M11_parada', `${onde}: ${m.semOpacidade} pixels translúcidos`)
          r.parada.push(linha)
        }
      }
    }
  }
  for (const [res, tamanhos] of Object.entries(cadeadoPorRes)) if (tamanhos.size !== 1) reprovar('M11_parada', `cadeado muda de tamanho com o zoom na resolução ${res}: ${[...tamanhos].join(', ')} px`)
  r.cadeadoPxPorResolucao = Object.fromEntries(Object.entries(cadeadoPorRes).map(([k, v]) => [k, [...v]]))

  // --- Som (M12) ----------------------------------------------------------------
  for (const id of NOVAS) {
    for (const abrindo of [true, false]) {
      const nome = `${id}-${abrindo ? 'abrir' : 'fechar'}`
      const evento = await page.evaluate((a) => window.PortaA3.eventoDoCaminho(a.id, a.abrindo), { id, abrindo })
      const som = await page.evaluate((e) => window.PortaA3.renderizarSom(e), evento)
      const canal = Float32Array.from(som.amostras)
      fs.writeFileSync(path.join(PROVAS, 'som', `${nome}.wav`), medidas.wav16([canal], som.taxa))
      const m = medidas.medirTudo([canal], som.taxa)
      const ultimos = canal.slice(canal.length - Math.round(0.01 * som.taxa))
      const rmsFim = medidas.db(Math.sqrt(ultimos.reduce((acc, v) => acc + v * v, 0) / ultimos.length))
      const { rms } = medidas.envoltoria([canal], som.taxa, 0.01)
      let fimMs = 0
      rms.forEach((db, i) => {
        const t = i * 10 - som.inicioS * 1000
        if (t >= 0 && Number.isFinite(db) && db > -60) fimMs = t + 10
      })
      const linha = { evento, lufsIntegrado: m.lufsIntegrado, picoVerdadeiroDbtp: m.picoVerdadeiroDbtp, cliques: m.cliques.length, cortes: m.cortes, dcPct: m.dcPct, ultimos10msDbfs: Number.isFinite(rmsFim) ? r2(rmsFim) : -120, somAcabaEmMs: fimMs, animacaoMs: evento.duracaoMs, wav: `provas/som/${nome}.wav` }
      r.som[nome] = linha
      if (!(m.lufsIntegrado >= -34 && m.lufsIntegrado <= -30)) reprovar('M12_som', `${nome}: ${m.lufsIntegrado} LUFS`)
      if (!(m.picoVerdadeiroDbtp <= -12)) reprovar('M12_som', `${nome}: pico ${m.picoVerdadeiroDbtp} dBTP`)
      if (m.cliques.length > 0) reprovar('M12_som', `${nome}: ${m.cliques.length} cliques`)
      if (m.cortes > 0) reprovar('M12_som', `${nome}: ${m.cortes} cortes`)
      if (m.dcPct > 0.5) reprovar('M12_som', `${nome}: DC ${m.dcPct}%`)
      if (!(linha.ultimos10msDbfs < -60)) reprovar('M12_som', `${nome}: fim em ${linha.ultimos10msDbfs} dBFS`)
      if (fimMs > evento.duracaoMs + 250) reprovar('M12_som', `${nome}: som acaba ${fimMs - evento.duracaoMs} ms depois`)
    }
  }

  for (const id of TODAS) {
    const a = { extremos: { combinacoes: 0, piores: {} }, curva: null, tempo: {}, continuidade: null, inversao: {}, reduzido: null, folha: null }
    r.animacoes[id] = a

    // --- M1, M2, M2b ---------------------------------------------------------
    let pior = { em0: 0, em1: 0, fimDoAbrir: 0, fimDoFechar: 0, semOpacidade: 0, telhado: 0 }
    for (const caso of CASOS) {
      for (const zoom of ZOOMS) {
        for (const res of RESOLUCOES) {
          for (const vertical of [false, true]) {
            const e = await page.evaluate((x) => window.PortaA3.extremos(x.id, x.caso, x.zoom, x.res, x.vertical), { id, caso, zoom, res, vertical })
            a.extremos.combinacoes += 1
            const onde = `${id} ${caso.titulo} zoom ${zoom} res ${res} ${vertical ? 'vertical' : 'horizontal'}`
            for (const k of Object.keys(pior)) pior[k] = Math.max(pior[k], e[k])
            if (e.em0 !== 0 || e.em1 !== 0 || e.fimDoAbrir !== 0 || e.fimDoFechar !== 0) reprovar('M1_extremos', `${onde}: ${e.em0}/${e.em1}/${e.fimDoAbrir}/${e.fimDoFechar}`)
            if (e.semOpacidade !== 0) reprovar('M2_opaco', `${onde}: ${e.semOpacidade} pixels translúcidos em ${e.quadros} quadros`)
            if (e.telhado !== 0) reprovar('M2b_telhado', `${onde}: ${e.telhado}`)
          }
        }
      }
    }
    a.extremos.piores = pior

    // --- M3 --------------------------------------------------------------------
    const c = await page.evaluate((x) => window.PortaA3.curva(x), id)
    const monotona = (v) => v.every((y, i) => i === 0 || y >= v[i - 1] - 1e-12) && v.every((y) => y >= 0 && y <= 1) && v[0] === 0 && v[v.length - 1] === 1
    a.curva = { abrirMonotona: monotona(c.abrir), fecharMonotona: monotona(c.fechar) }
    if (!a.curva.abrirMonotona || !a.curva.fecharMonotona) reprovar('M3_curva', `${id}: curva volta ou passa do alvo`)

    // --- M3, M6 pelo animador ----------------------------------------------------
    const corridas = {}
    for (const abrindo of [true, false]) {
      const s = await page.evaluate((x) => window.PortaA3.amostrar(x.id, x.abrindo), { id, abrindo })
      corridas[abrindo ? 'abrir' : 'fechar'] = s
      let contra = 0
      for (let i = 1; i < s.progressos.length; i += 1) {
        const passo = s.progressos[i].p - s.progressos[i - 1].p
        if (abrindo ? passo < -1e-9 : passo > 1e-9) contra += 1
      }
      const sentido = abrindo ? 'abrir' : 'fechar'
      a.tempo[sentido] = { declaradoMs: s.declaradoMs, chegouEmMs: s.chegouEmMs === null ? null : Math.round(s.chegouEmMs), passosContraOSentido: contra, quadros: s.quadrosIntermediarios }
      if (contra > 0) reprovar('M3_curva', `${id} ${sentido}: ${contra} passos contra o sentido`)
      const ultimo = s.progressos[s.progressos.length - 1]
      if (ultimo === undefined || ultimo.p !== (abrindo ? 1 : 0)) reprovar('M3_curva', `${id} ${sentido}: não chegou`)
      if (s.chegouEmMs === null || s.chegouEmMs < s.declaradoMs || s.chegouEmMs > s.declaradoMs + 17) reprovar('M6_tempo', `${id} ${sentido}: chegou em ${s.chegouEmMs} ms, declarado ${s.declaradoMs}`)
    }

    // --- M5 (régua de deslocamento) -------------------------------------------------
    const { passos, refinados } = await page.evaluate((x) => window.PortaA3.continuidade(x), id)
    const tremor = TREMOR[id]
    const noTremor = (em) => tremor !== undefined && em >= tremor[0] && em <= tremor[1] + 0.005
    let fora = { px: 0, em: 0 }
    let dentro = { px: 0, em: 0 }
    passos.forEach((px, i) => {
      const em = (i + 1) / 200
      if (noTremor(em) && px > dentro.px) dentro = { px, em }
      if (!noTremor(em) && px > fora.px) fora = { px, em }
    })
    const refinadosFora = refinados.filter((f) => !noTremor(f.em))
    const piorRefinado = refinadosFora.reduce((pior, f) => (f.refinadoPx > pior.refinadoPx ? f : pior), { em: 0, px: 0, refinadoPx: 0 })
    a.continuidade = {
      maiorPassoPx: r2(fora.px),
      ondeMaior: fora.em,
      maiorPassoNoTremorPx: r2(dentro.px),
      ondeMaiorNoTremor: dentro.em,
      m5ComoEscrita: fora.px <= 1.5 ? 'passa' : `reprova por ${r2(fora.px)} px (veredito em M5b)`,
      passosAcimaDe1_5px: refinadosFora.length,
      m5bPiorRefinadoPx: r2(piorRefinado.refinadoPx),
      m5bOnde: piorRefinado.em,
    }
    for (const f of refinadosFora) if (f.refinadoPx > 1.5) reprovar('M5b_salto_real', `${id}: em ${f.em}, ${r2(f.px)} px no passo de 0,5% e ${r2(f.refinadoPx)} px a 0,05%`)

    // --- M15 -----------------------------------------------------------------------
    a.pontoPorAtravessar = []
    for (const progresso of [0, 0.25, 0.5, 0.75, 1]) {
      for (const abrindo of [true, false]) {
        const m = await page.evaluate((x) => window.PortaA3.pontoPorAtravessar(x.id, x.progresso, x.abrindo), { id, progresso, abrindo })
        a.pontoPorAtravessar.push({ progresso, sentido: abrindo ? 'abrir' : 'fechar', ...m })
        const onde = `${id} ${abrindo ? 'abrindo' : 'fechando'} em ${progresso}`
        if (m.visiveis < 3) reprovar('M15_ponto_por_atravessar', `${onde}: ${m.visiveis} pixels visíveis do ponto`)
        if (m.diferenteDaParada !== null && m.diferenteDaParada !== 0) reprovar('M15_ponto_por_atravessar', `${onde}: ${m.diferenteDaParada} pixels diferentes do ponto da porta parada`)
      }
    }

    // --- M7 ----------------------------------------------------------------------
    const maiorPasso = (ps) => Math.max(...ps.slice(1).map((s, i) => Math.abs(s.p - ps[i].p)))
    const normal = Math.max(maiorPasso(corridas.abrir.progressos), maiorPasso(corridas.fechar.progressos))
    for (const f of [0.25, 0.5, 0.75]) {
      const s = await page.evaluate((x) => window.PortaA3.amostrar(x.id, true, x.f), { id, f })
      const salto = maiorPasso(s.progressos)
      a.inversao[f] = { maiorPassoComInversao: r2(salto * 1000) / 1000, maiorPassoSemInversao: r2(normal * 1000) / 1000 }
      if (salto > normal + 1e-9) reprovar('M7_inversao', `${id} a ${f}: ${salto} contra ${normal}`)
    }

    // --- M8 ----------------------------------------------------------------------
    const red = await page.evaluate((x) => window.PortaA3.amostrar(x, true, null, true), id)
    a.reduzido = { quadrosIntermediarios: red.quadrosIntermediarios, sons: red.sons.length }
    if (red.quadrosIntermediarios !== 0 || red.sons.length !== 0) reprovar('M8_reduzido', `${id}: ${red.quadrosIntermediarios} quadros, ${red.sons.length} sons`)

    // --- M14 ---------------------------------------------------------------------
    const linhas = []
    for (const caso of CASOS) linhas.push(await page.evaluate((x) => window.PortaA3.linhaDaFolha(x.id, x.caso), { id, caso }))
    fs.writeFileSync(path.join(PROVAS, 'folhas', `${id}.png`), dePng(await page.evaluate((x) => window.PortaA3.compor(x.t, x.l), { t: `${id}: desenho novo (creme com contorno, vão inteiro)`, l: linhas })))
    a.folha = { arquivo: `provas/folhas/${id}.png`, quadrosPorLinha: linhas.map((l) => l.quadros.length) }
    if (linhas.some((l) => l.quadros.length !== 16)) reprovar('M14_folhas', `${id}: linha sem 16 quadros`)
  }

  // --- M9 ------------------------------------------------------------------------
  // O laboratório mede e registra, mas não reprova: o WebGL dele é software (M9_mudanca em metas.json).
  const e = await page.evaluate(() => window.PortaA3.estresse(4000))
  const laboratorio = {
    informativo: true,
    nota: 'software, SwiftShader: informativo, não reprova (M9_mudanca em metas.json)',
    portas: e.portas,
    quadros: e.intervalos.length,
    intervaloP95Ms: r2(p95(e.intervalos)),
    intervaloMaxMs: r2(Math.max(...e.intervalos)),
    tarefasLongas: e.tarefasLongas.length,
    tarefaLongaMaxMs: e.tarefasLongas.length === 0 ? 0 : r2(Math.max(...e.tarefasLongas)),
    observadorDeTarefasLongas: e.observadorAtivo,
    custoDoAnimadorP95Ms: r2(p95(e.custo)),
    custoDoAnimadorMaxMs: r2(Math.max(...e.custo)),
    onde: 'laboratório (Chromium 1243 headless, WebGL por SwiftShader), 1440x900',
  }
  const app = lerDesempenhoDoApp()
  r.desempenho = { criterio: `app com placa de vídeo: quadro p95 até ${QUADRO_P95_MAX_MS} ms e nenhuma tarefa longa de ${TAREFA_LONGA_MAX_MS} ms ou mais`, app, laboratorio }
  if (app === null) reprovar('M9_desempenho', `falta ${path.relative(RAIZ, DESEMPENHO_DO_APP)}: rode client/e2e/task-door-app-1440.spec.ts com PROVA_PORTA_APP=1`)
  else {
    if (PLACA_DE_SOFTWARE.test(app.placa)) reprovar('M9_desempenho', `a medida do app não usou placa de vídeo: ${app.placa}`)
    if (!(app.intervaloP95Ms <= QUADRO_P95_MAX_MS)) reprovar('M9_desempenho', `app: quadro p95 ${app.intervaloP95Ms} ms`)
    if (!(app.tarefaLongaMaxMs < TAREFA_LONGA_MAX_MS)) reprovar('M9_desempenho', `app: tarefa longa de ${app.tarefaLongaMaxMs} ms`)
    if (app.observadorDeTarefasLongas !== true) reprovar('M9_desempenho', 'app: observador de tarefas longas não ligou')
    if (!(app.quadrosDePortaNoMeio > 0)) reprovar('M9_desempenho', 'app: nenhuma porta do pacote andou durante a medida')
  }

  const daFerramenta = (m) => /GPU stall due to ReadPixels/.test(m.texto)
  r.console = avisos.filter((m) => !daFerramenta(m))
  r.avisosDaFerramentaDeProva = avisos.filter(daFerramenta).length
  if (r.console.length > 0) reprovar('M10_console', `${r.console.length} mensagens: ${r.console.slice(0, 3).map((m) => m.texto).join(' | ')}`)
  r.falhas = falhas
  r.passou = falhas.length === 0
  // Escritas DEPOIS das rodadas (22/10/2026), sem mudar veredito nenhum: o que mudou e por quê.
  r.notas = {
    M5b_salto_real: 'ANTES (rodada de 22/10/2026): a Arrombada fechando reprovava de 0,735 a 0,765, com passos refinados de 5,1, 2,83, 5 e 10,44 px. Abrindo, os 5 estilhaços encolhiam até sumir no ar, a 7-15 px da fechadura; fechando (o mesmo desenho de trás para a frente, decisão 1 do README) cada um nascia do nada, longe de tudo. DEPOIS (client/src/animacoes/porta/arrombada.ts): os estilhaços saltam da fechadura e caem na soleira, dentro do vão, onde se desfazem; começam e acabam em cima do batente, então fechando nascem colados nele e voltam para a fechadura. Tempos (560/320), curvas e o resto do desenho iguais. O número de agora está em animacoes.arrombada.continuidade.',
    M9_desempenho: 'O laboratório roda o WebGL por SwiftShader (software) e dá um intervalo de quadro p95 perto de 25 ms com o custo do animador (JS) em p95 de 0,6 ms: o tempo é o SwiftShader pintando 1440x900, não a porta. Por isso o número do laboratório fica registrado como informativo e o critério que reprova é o do app com placa de vídeo (desempenho.app, M9_mudanca em metas.json).',
  }
  r.duracaoS = Math.round((Date.now() - inicio) / 100) / 10
  fs.writeFileSync(path.join(PROVAS, 'testes.json'), JSON.stringify(r, null, 2) + '\n')
  await browser.close()
  fs.rmSync(arquivo, { force: true })
  console.log(JSON.stringify({ passou: r.passou, falhas: falhas.slice(0, 40), totalDeFalhas: falhas.length, som: Object.fromEntries(Object.entries(r.som).map(([k, v]) => [k, `${v.lufsIntegrado} LUFS, ${v.picoVerdadeiroDbtp} dBTP, ${v.cliques} cliques, ${v.cortes} cortes`])), desempenho: r.desempenho, duracaoS: r.duracaoS }, null, 1))
  process.exitCode = falhas.length === 0 ? 0 : 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 2
})
