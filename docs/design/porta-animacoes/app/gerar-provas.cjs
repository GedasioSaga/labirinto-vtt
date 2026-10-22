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

    // --- M5 ----------------------------------------------------------------------
    const cont = await page.evaluate((x) => window.PortaA3.continuidade(x), id)
    a.continuidade = { maiorPassoPx: r2(cont.maiorPassoPx), ondeMaior: cont.ondeMaior }
    const tremor = TREMOR[id]
    const noTremor = tremor !== undefined && cont.ondeMaior >= tremor[0] && cont.ondeMaior <= tremor[1] + 0.005
    if (cont.maiorPassoPx > 1.5 && !noTremor) reprovar('M5_continuidade', `${id}: passo de ${r2(cont.maiorPassoPx)} px em ${cont.ondeMaior}`)

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
  const e = await page.evaluate(() => window.PortaA3.estresse(4000))
  r.desempenho = {
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
  if (!(r.desempenho.intervaloP95Ms <= 20)) reprovar('M9_desempenho', `quadro p95 ${r.desempenho.intervaloP95Ms} ms`)
  if (r.desempenho.tarefaLongaMaxMs >= 200) reprovar('M9_desempenho', `tarefa longa de ${r.desempenho.tarefaLongaMaxMs} ms`)
  if (!e.observadorAtivo) reprovar('M9_desempenho', 'observador de tarefas longas não ligou')

  const daFerramenta = (m) => /GPU stall due to ReadPixels/.test(m.texto)
  r.console = avisos.filter((m) => !daFerramenta(m))
  r.avisosDaFerramentaDeProva = avisos.filter(daFerramenta).length
  if (r.console.length > 0) reprovar('M10_console', `${r.console.length} mensagens: ${r.console.slice(0, 3).map((m) => m.texto).join(' | ')}`)
  r.falhas = falhas
  r.passou = falhas.length === 0
  // Escritas DEPOIS da primeira rodada (22/10/2026), sem mudar veredito nenhum: o porquê de cada reprovação que sobrou.
  r.notas = {
    M5_continuidade: 'A régua mede o centro de TODOS os pixels pintados, não o centro da folha. No girar e na arrombada, de 0 a 0,5% a folha começa a sair da caixa do vão e a área nova (um triângulo fino na ponta livre, ~120 px) puxa o centro 4 a 6 px, embora a ponta tenha andado 1,2 px. No deslizar, a 0,63 uma linha inteira da sombra (86 px) muda de pixel de uma vez (sem antialias). Não é salto da folha: o teste de unidade que mede o centro da própria folha (animacoesDePorta.test.ts, "não salta") passa com 1,5 px. A régua precisa ser trocada por uma de deslocamento (pixel novo longe do desenho anterior) antes de valer como prova.',
    M9_desempenho: 'O custo do animador (JS) fica em p95 0,6 ms; o intervalo de 25 ms é o SwiftShader (WebGL por software do Chromium headless) pintando 1440x900. A meta de quadro p95 até 20 ms precisa ser medida no app com GPU.',
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
