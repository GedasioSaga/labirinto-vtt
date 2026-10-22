'use strict'
/**
 * PROVAS DA PORTA REFINADA E DO SOM (fatia 22, faixa A, etapa 2).
 *
 *   node docs/design/porta-som/provas/gerar-provas.cjs
 *
 * Empacota `laboratorio.ts` (código REAL do app: Pixi, drawDoors, o animador e
 * o som) com o esbuild, abre no Chromium 1243 do Playwright e grava, nesta pasta:
 *   folhas/<id>.png      folha de contato, 4 linhas x 14 quadros, tempo embaixo
 *   graficos/<id>.png    gráfico do movimento + volume do som, mesma linha do tempo
 *   som/<evento>.wav     16 bits, para OUVIR (medir não é ouvir)
 *   testes.json          medidas e veredito de cada meta de metas.json
 * Sai com código 1 se alguma meta reprovar.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PASTA = __dirname
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))
const esbuild = require(path.join(RAIZ, 'node_modules', 'esbuild'))
const medidas = require(path.join(RAIZ, 'scripts', 'som', 'medidas.cjs'))
const metas = require('./metas.json')

const ANIMACOES = ['girar', 'deslizar']
const LINHAS = [
  { titulo: 'Laranja de sempre (sem cor própria)', fechada: {}, aberta: { open: true } },
  { titulo: 'Azul #3a7bd5', fechada: { cor: '#3a7bd5' }, aberta: { cor: '#3a7bd5', open: true } },
  { titulo: 'Musgo #5e8c4a', fechada: { cor: '#5e8c4a' }, aberta: { cor: '#5e8c4a', open: true } },
  { titulo: 'Ameixa #7a4a6e trancada: "destrancar e abrir", depois "fechar e trancar"', fechada: { cor: '#7a4a6e', locked: true }, aberta: { cor: '#7a4a6e', open: true } },
]
const ZOOMS = [1, 2.5, 4]
const EVENTOS_DE_SOM = [
  { nome: 'girar-abrir', evento: { tipo: 'abrir', som: 'rangido', duracaoMs: 300 }, animacaoMs: 300, faixaLufs: [-36, -26] },
  { nome: 'girar-fechar', evento: { tipo: 'fechar', som: 'rangido', duracaoMs: 260 }, animacaoMs: 260, faixaLufs: [-36, -26] },
  { nome: 'deslizar-abrir', evento: { tipo: 'abrir', som: 'trinco', duracaoMs: 240 }, animacaoMs: 240, faixaLufs: [-42, -28] },
  { nome: 'deslizar-fechar', evento: { tipo: 'fechar', som: 'trinco', duracaoMs: 240 }, animacaoMs: 240, faixaLufs: [-42, -28] },
  { nome: 'trancar', evento: { tipo: 'trancar' }, animacaoMs: null, faixaLufs: [-42, -28] },
  { nome: 'destrancar', evento: { tipo: 'destrancar' }, animacaoMs: null, faixaLufs: [-42, -28] },
]

const garantir = (p) => fs.mkdirSync(p, { recursive: true })
const r2 = (v) => Math.round(v * 100) / 100
const dePng = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')
function p95(valores) {
  const ordenados = [...valores].sort((a, b) => a - b)
  return ordenados.length === 0 ? 0 : ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * 0.95))]
}

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
  })
  // Um "</script" dentro do pacote fecharia a tag no meio da página.
  const codigo = pacote.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')
  const arquivo = path.join(os.tmpdir(), 'porta-som-laboratorio.html')
  fs.writeFileSync(arquivo, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Laboratório da porta</title></head><body style="margin:0;background:#1b1711"><script>${codigo}</script></body></html>`)
  return 'file:///' + arquivo.replace(/\\/g, '/')
}

function navegador() {
  const exe = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1243', 'chrome-win64', 'chrome.exe')
  return fs.existsSync(exe) ? exe : undefined
}

/** Volume do som (RMS dBFS a cada 10 ms) desde o começo do evento, para o gráfico. */
function envoltoriaDoSom(som) {
  const { rms } = medidas.envoltoria([Float32Array.from(som.amostras)], som.taxa, 0.01)
  return rms.map((db, i) => [i * 10 - som.inicioS * 1000, Number.isFinite(db) ? db : -120]).filter(([t]) => t >= 0)
}

/** Onde o som acaba: último bloco de 10 ms acima de -60 dBFS, em ms desde o começo do evento. */
function fimDoSomMs(envoltoria) {
  let fim = 0
  for (const [t, db] of envoltoria) if (db > -60) fim = t + 10
  return fim
}

async function main() {
  const inicio = Date.now()
  for (const d of ['folhas', 'graficos', 'som']) garantir(path.join(PASTA, d))
  const url = montarPagina()
  const browser = await chromium.launch({ executablePath: navegador(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
  const console_ = []
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console_.push({ tipo: m.type(), texto: m.text() })
  })
  page.on('pageerror', (e) => console_.push({ tipo: 'pageerror', texto: e.message }))
  await page.goto(url)
  await page.waitForFunction(() => document.documentElement.dataset.pronto === 'sim', null, { timeout: 30000 })

  const falhas = []
  const reprovar = (meta, texto) => falhas.push(`${meta}: ${texto}`)
  const r = { metas: metas.metas, navegador: navegador() ?? 'chromium padrão do Playwright', animacoes: {}, som: {}, desempenho: {} }

  // --- Som (antes do gráfico, que mostra a envoltória) ---------------------
  const sons = {}
  for (const { nome, evento, animacaoMs, faixaLufs } of EVENTOS_DE_SOM) {
    const som = await page.evaluate((e) => window.PortaSom.renderizarSom(e), evento)
    const canal = Float32Array.from(som.amostras)
    sons[nome] = som
    fs.writeFileSync(path.join(PASTA, 'som', `${nome}.wav`), medidas.wav16([canal], som.taxa))
    const m = medidas.medirTudo([canal], som.taxa)
    const ultimos = canal.slice(canal.length - Math.round(0.01 * som.taxa))
    const rmsFim = medidas.db(Math.sqrt(ultimos.reduce((acc, v) => acc + v * v, 0) / ultimos.length))
    const env = envoltoriaDoSom(som)
    const fimMs = fimDoSomMs(env)
    const linha = { picoVerdadeiroDbtp: m.picoVerdadeiroDbtp, lufsIntegrado: m.lufsIntegrado, cliques: m.cliques.length, cortes: m.cortes, dcPct: m.dcPct, ultimos10msDbfs: Number.isFinite(rmsFim) ? r2(rmsFim) : -120, somAcabaEmMs: fimMs, animacaoMs, wav: `som/${nome}.wav` }
    r.som[nome] = linha
    if (!(m.picoVerdadeiroDbtp <= -12)) reprovar('M8_som', `${nome}: pico verdadeiro ${m.picoVerdadeiroDbtp} dBTP`)
    if (!(m.lufsIntegrado >= faixaLufs[0] && m.lufsIntegrado <= faixaLufs[1])) reprovar('M8_som', `${nome}: ${m.lufsIntegrado} LUFS fora de ${faixaLufs.join(' a ')}`)
    if (m.cliques.length > 0) reprovar('M8_som', `${nome}: ${m.cliques.length} cliques`)
    if (m.cortes > 0) reprovar('M8_som', `${nome}: ${m.cortes} amostras cortadas`)
    if (m.dcPct > 0.5) reprovar('M8_som', `${nome}: DC ${m.dcPct}%`)
    if (!(linha.ultimos10msDbfs < -60)) reprovar('M8_som', `${nome}: fim em ${linha.ultimos10msDbfs} dBFS`)
    if (animacaoMs !== null && fimMs > animacaoMs + 120) reprovar('M8_som', `${nome}: som acaba ${fimMs - animacaoMs} ms depois da animação`)
  }

  for (const id of ANIMACOES) {
    const a = { extremos: [], folha: null, inversao: {}, medalha: null, reduzido: null, monotonia: {} }
    r.animacoes[id] = a

    // --- M9: folha de contato ------------------------------------------------
    const linhas = []
    for (const linha of LINHAS) linhas.push(await page.evaluate(({ id, linha }) => window.PortaSom.linhaDaFolha(id, linha), { id, linha }))
    const titulo = id === 'girar' ? 'Girar na dobradiça (abre 300 ms, fecha 260 ms), refinado' : 'Deslizar (240 ms), refinado'
    fs.writeFileSync(path.join(PASTA, 'folhas', `${id}.png`), dePng(await page.evaluate(({ titulo, linhas }) => window.PortaSom.compor(titulo, linhas), { titulo, linhas })))
    a.folha = { arquivo: `folhas/${id}.png`, linhas: linhas.length, quadrosPorLinha: linhas.map((l) => l.quadros.length) }
    if (linhas.some((l) => l.quadros.length < 12 || l.quadros.length > 16)) reprovar('M9_folhas', `${id}: linha fora de 12 a 16 quadros`)

    // --- M1 e M2: extremos e opacidade --------------------------------------
    for (const linha of LINHAS) {
      for (const zoom of ZOOMS) {
        const e = await page.evaluate(({ id, linha, zoom }) => window.PortaSom.extremosEOpacidade(id, linha, zoom), { id, linha, zoom })
        a.extremos.push({ linha: linha.titulo, zoom, ...e })
        if (e.diferentesNoFimDoAbrir !== 0 || e.diferentesNoFimDoFechar !== 0) reprovar('M1_extremos', `${id} ${linha.titulo} zoom ${zoom}: ${e.diferentesNoFimDoAbrir}/${e.diferentesNoFimDoFechar} pixels diferentes`)
        if (e.pixelsTranslucidos !== 0) reprovar('M2_opaco', `${id} ${linha.titulo} zoom ${zoom}: ${e.pixelsTranslucidos} pixels translúcidos`)
      }
    }

    // --- M3: sem quique; gráfico --------------------------------------------
    const abrir = await page.evaluate((id) => window.PortaSom.amostrar(id, true), id)
    const fechar = await page.evaluate((id) => window.PortaSom.amostrar(id, false), id)
    for (const [sentido, corrida, sobe] of [['abrir', abrir, true], ['fechar', fechar, false]]) {
      let contra = 0
      let fora = 0
      for (let i = 1; i < corrida.amostras.length; i += 1) {
        const passo = corrida.amostras[i].caminho - corrida.amostras[i - 1].caminho
        if (sobe ? passo < -1e-9 : passo > 1e-9) contra += 1
      }
      for (const s of corrida.amostras) if (s.caminho < -1e-9 || s.caminho > 1 + 1e-9) fora += 1
      a.monotonia[sentido] = { amostras: corrida.amostras.length, passosContraOSentido: contra, foraDe0a1: fora }
      if (contra > 0 || fora > 0) reprovar('M3_sem_quique', `${id} ${sentido}: ${contra} passos contra o sentido, ${fora} fora de [0, 1]`)
    }

    // --- M4: medalha no mesmo ângulo (só o Girar gira) ----------------------
    const series = (corrida) => [
      { nome: id === 'girar' ? 'ângulo da folha / 70°' : 'vão livre (folha recolhida)', cor: '#2a78d6', pontos: corrida.amostras.map((s) => [s.ms, s.caminho]) },
      { nome: 'comprimento da folha', cor: '#eb6834', pontos: corrida.amostras.map((s) => [s.ms, s.folha]) },
      { nome: 'sombra (px / 2)', cor: '#6b4fd6', pontos: corrida.amostras.map((s) => [s.ms, s.sombraPx / 2]) },
    ]
    const paineis = [
      { titulo: 'Abrindo', duracaoMs: id === 'girar' ? 300 : 240, series: series(abrir), som: envoltoriaDoSom(sons[`${id}-abrir`]), somResumo: `${r.som[`${id}-abrir`].lufsIntegrado} LUFS` },
      { titulo: 'Fechando', duracaoMs: id === 'girar' ? 260 : 240, series: series(fechar), som: envoltoriaDoSom(sons[`${id}-fechar`]), somResumo: `${r.som[`${id}-fechar`].lufsIntegrado} LUFS` },
    ]
    if (id === 'girar') {
      const tempos = abrir.amostras.map((s) => s.ms)
      const medalhaAbrir = await page.evaluate((t) => window.PortaSom.anguloDaMedalha(300, t), tempos)
      const temposF = fechar.amostras.map((s) => s.ms)
      const medalhaFechar = (await page.evaluate((t) => window.PortaSom.anguloDaMedalha(260, t), temposF)).map((g) => 70 - g)
      const difAbrir = Math.max(...abrir.amostras.map((s, i) => Math.abs(s.caminho * 70 - medalhaAbrir[i])))
      const difFechar = Math.max(...fechar.amostras.map((s, i) => Math.abs(s.caminho * 70 - medalhaFechar[i])))
      a.medalha = { diferencaMaximaGrausAbrindo: r2(difAbrir), diferencaMaximaGrausFechando: r2(difFechar) }
      if (difAbrir > 2 || difFechar > 2) reprovar('M4_medalha', `girar: ${r2(difAbrir)}° abrindo, ${r2(difFechar)}° fechando`)
      paineis[0].series.push({ nome: 'medalha da ficha (CSS) / 70°', cor: '#1baf7a', pontos: tempos.map((t, i) => [t, medalhaAbrir[i] / 70]) })
      paineis[1].series.push({ nome: 'medalha da ficha (CSS) / 70°', cor: '#1baf7a', pontos: temposF.map((t, i) => [t, medalhaFechar[i] / 70]) })
    }
    const tituloDoGrafico = `${id === 'girar' ? 'Girar na dobradiça' : 'Deslizar'}: movimento e som`
    fs.writeFileSync(path.join(PASTA, 'graficos', `${id}.png`), dePng(await page.evaluate(({ t, p }) => window.PortaSom.grafico(t, p), { t: tituloDoGrafico, p: paineis })))

    // --- M5: inverter no meio não salta --------------------------------------
    const maiorPasso = (amostras) => Math.max(...amostras.slice(1).map((s, i) => Math.abs(s.caminho - amostras[i].caminho)))
    // Invertida, a porta passa a FECHAR, no ritmo do fechar (o Girar fecha mais depressa): a régua é o maior passo das duas corridas.
    const passoNormal = Math.max(maiorPasso(abrir.amostras), maiorPasso(fechar.amostras))
    for (const fracao of [0.25, 0.5, 0.75]) {
      const corrida = await page.evaluate(({ id, f }) => window.PortaSom.amostrar(id, true, f), { id, f: fracao })
      const salto = maiorPasso(corrida.amostras)
      a.inversao[fracao] = { maiorPassoComInversao: r2(salto * 100) / 100, maiorPassoSemInversao: r2(passoNormal * 100) / 100, sonsPedidos: corrida.sons.map((s) => s.tipo) }
      if (salto > passoNormal + 1e-9) reprovar('M5_inversao', `${id} a ${fracao}: passo ${salto} contra ${passoNormal}`)
    }

    // --- M6: movimento reduzido ----------------------------------------------
    const reduzido = await page.evaluate((id) => window.PortaSom.amostrar(id, true, null, true), id)
    a.reduzido = { quadrosIntermediarios: reduzido.quadrosIntermediarios, sons: reduzido.sons.length }
    if (reduzido.quadrosIntermediarios !== 0 || reduzido.sons.length !== 0) reprovar('M6_reduzido', `${id}: ${reduzido.quadrosIntermediarios} quadros, ${reduzido.sons.length} sons`)
  }

  // --- M7: desempenho com 60 portas -----------------------------------------
  for (const [nome, umaSo] of [['abrindo 1 de 60', true], ['abrindo as 60 juntas', false]]) {
    const e = await page.evaluate((u) => window.PortaSom.estresse(u, 4000), umaSo)
    const linha = {
      portas: e.portas,
      quadros: e.intervalos.length,
      intervaloP95Ms: r2(p95(e.intervalos)),
      intervaloMaxMs: r2(Math.max(...e.intervalos)),
      tarefaLongaMaxMs: e.tarefasLongas.length === 0 ? 0 : r2(Math.max(...e.tarefasLongas)),
      tarefasLongas: e.tarefasLongas.length,
      observadorDeTarefasLongas: e.observadorAtivo,
      custoDoAnimadorP95Ms: r2(p95(e.custoDoAnimador)),
      custoDoAnimadorMaxMs: r2(Math.max(...e.custoDoAnimador)),
    }
    r.desempenho[nome] = linha
    if (!(linha.intervaloP95Ms <= 20)) reprovar('M7_desempenho', `${nome}: quadro p95 ${linha.intervaloP95Ms} ms`)
    if (linha.tarefaLongaMaxMs >= 200) reprovar('M7_desempenho', `${nome}: tarefa longa de ${linha.tarefaLongaMaxMs} ms`)
    if (!e.observadorAtivo) reprovar('M7_desempenho', `${nome}: observador de tarefas longas não ligou`)
  }
  const custo = await page.evaluate(() => window.PortaSom.custoPorQuadro())
  r.desempenho.custoPorQuadro = { repintarAs60Ms: Math.round(custo.todasMs * 1000) / 1000, repintarSoAQueAndaMs: Math.round(custo.soAQueAndaMs * 1000) / 1000 }
  if (!(custo.soAQueAndaMs < custo.todasMs)) reprovar('M7_desempenho', 'repintar só a que anda não ficou mais barato')

  // O `extract.pixels` da própria prova (M1, M2) lê a GPU de volta, e o driver avisa uma vez. Não é do app: fica registrado à parte.
  const daFerramenta = (m) => /GPU stall due to ReadPixels/.test(m.texto)
  r.console = console_.filter((m) => !daFerramenta(m))
  r.avisosDaFerramentaDeProva = console_.filter(daFerramenta)
  if (r.console.length > 0) reprovar('M10_console', `${r.console.length} mensagens`)
  r.falhas = falhas
  r.passou = falhas.length === 0
  r.duracaoS = Math.round((Date.now() - inicio) / 100) / 10
  fs.writeFileSync(path.join(PASTA, 'testes.json'), JSON.stringify(r, null, 2) + '\n')
  await browser.close()
  console.log(JSON.stringify({ passou: r.passou, falhas, som: r.som, desempenho: r.desempenho, medalha: r.animacoes.girar.medalha, duracaoS: r.duracaoS }, null, 1))
  process.exitCode = falhas.length === 0 ? 0 : 1
}

main().catch((erro) => {
  console.error(erro)
  process.exitCode = 2
})
