'use strict'
/**
 * PROVAS das animações de porta (metas em provas/metas.json, escritas antes do código).
 *
 *   node docs/design/porta-animacoes/provas/gerar-provas.cjs
 *
 * Monta o protótipo (prototipo/montar.cjs), abre no Chromium do Playwright e usa o
 * laboratório da página (window.PortaLab) para: geometria de cada ponto do caminho,
 * corridas do animador com relógio de mentira (abrir, fechar, inverter, movimento
 * reduzido), comparação de pixel dos extremos, folhas de contato, gráficos do
 * movimento, 50 portas juntas e o som renderizado offline (medido com
 * scripts/som/medidas.cjs, o mesmo medidor das transições). Grava tudo nesta pasta
 * e o resumo em testes.json. Sai com código 1 se alguma meta falhar.
 */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const PASTA = __dirname
const RAIZ_DO_PROTOTIPO = path.resolve(PASTA, '..')
const RAIZ = path.resolve(PASTA, '..', '..', '..', '..')
const { chromium } = require(path.join(RAIZ, 'node_modules', 'playwright'))
const medidas = require(path.join(RAIZ, 'scripts', 'som', 'medidas.cjs'))
const { montar } = require(path.join(RAIZ_DO_PROTOTIPO, 'prototipo', 'montar.cjs'))
const metas = require('./metas.json')

const QUADRO_MS = 1000 / 60
const NOVAS = ['dupla', 'grade', 'arrombada', 'sanfona', 'cortina']

function navegador() {
  const base = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright')
  const candidatos = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1])) : []
  for (const d of candidatos) {
    const exe = path.join(base, d, 'chrome-win64', 'chrome.exe')
    if (fs.existsSync(exe)) return { executablePath: exe, nome: d }
  }
  return { executablePath: undefined, nome: 'chromium padrão do Playwright' }
}

const garantir = (p) => fs.mkdirSync(p, { recursive: true })
const r2 = (v) => Math.round(v * 100) / 100

// ---------------------------------------------------------------------------
// Geometria: rasteriza as formas da folha num bitmap no espaço da porta
// ---------------------------------------------------------------------------

function dentroDoPoligono(pontos, x, y) {
  let dentro = false
  for (let i = 0, j = pontos.length / 2 - 1; i < pontos.length / 2; j = i++) {
    const xi = pontos[2 * i]
    const yi = pontos[2 * i + 1]
    const xj = pontos[2 * j]
    const yj = pontos[2 * j + 1]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

/**
 * Cobertura do vão (fração do retângulo da porta fechada tapada pela folha) e
 * centro da folha (centróide da união das formas), em px de TELA.
 */
function medirFolha(formas, porta) {
  const passo = porta.espessura / 16
  const L = porta.meioComprimento
  const E = porta.espessura
  const minX = porta.cx - L - 20
  const minY = porta.cy - L - 20
  const largura = Math.ceil((2 * L + 40) / passo)
  const altura = Math.ceil((2 * L + 40) / passo)
  const bitmap = new Uint8Array(largura * altura)
  for (const f of formas) {
    let x0
    let x1
    let y0
    let y1
    if (f.tipo === 'circulo') {
      x0 = f.x - f.r
      x1 = f.x + f.r
      y0 = f.y - f.r
      y1 = f.y + f.r
    } else {
      const xs = f.pontos.filter((_, i) => i % 2 === 0)
      const ys = f.pontos.filter((_, i) => i % 2 === 1)
      x0 = Math.min(...xs)
      x1 = Math.max(...xs)
      y0 = Math.min(...ys)
      y1 = Math.max(...ys)
    }
    const i0 = Math.max(0, Math.floor((x0 - minX) / passo))
    const i1 = Math.min(largura - 1, Math.ceil((x1 - minX) / passo))
    const j0 = Math.max(0, Math.floor((y0 - minY) / passo))
    const j1 = Math.min(altura - 1, Math.ceil((y1 - minY) / passo))
    for (let j = j0; j <= j1; j++) {
      const y = minY + (j + 0.5) * passo
      for (let i = i0; i <= i1; i++) {
        const x = minX + (i + 0.5) * passo
        const dentro = f.tipo === 'circulo' ? (x - f.x) ** 2 + (y - f.y) ** 2 <= f.r * f.r : dentroDoPoligono(f.pontos, x, y)
        if (dentro) bitmap[j * largura + i] = 1
      }
    }
  }
  let cobertos = 0
  let total = 0
  let soma = 0
  let sx = 0
  let sy = 0
  for (let j = 0; j < altura; j++) {
    const y = minY + (j + 0.5) * passo
    for (let i = 0; i < largura; i++) {
      const x = minX + (i + 0.5) * passo
      const marcado = bitmap[j * largura + i] === 1
      // Coordenadas da porta: u ao longo da parede, v na normal.
      const u = (x - porta.cx) * porta.ux + (y - porta.cy) * porta.uy
      const v = -(x - porta.cx) * porta.uy + (y - porta.cy) * porta.ux
      if (Math.abs(u) <= L && Math.abs(v) <= E / 2) {
        total++
        if (marcado) cobertos++
      }
      if (marcado) {
        soma++
        sx += x
        sy += y
      }
    }
  }
  const escala = porta.escala
  return {
    cobertura: total > 0 ? cobertos / total : 0,
    area: soma,
    centro: soma > 0 ? { x: (sx / soma) * escala, y: (sy / soma) * escala } : null,
  }
}

const distancia = (a, b) => (a === null || b === null ? 0 : Math.hypot(a.x - b.x, a.y - b.y))
const foraDosTrechos = (p0, p1, trechos) => trechos.every(([a, b]) => Math.max(p0, p1) < a || Math.min(p0, p1) > b)

// ---------------------------------------------------------------------------
// Desenho das folhas e dos gráficos (roda DENTRO da página, canvas 2D)
// ---------------------------------------------------------------------------

async function compor(page, dados) {
  return page.evaluate(async ({ titulo, linhas, w, h }) => {
    const carregar = (src) =>
      new Promise((ok, erro) => {
        const img = new Image()
        img.onload = () => ok(img)
        img.onerror = erro
        img.src = src
      })
    const colunas = Math.max(...linhas.map((l) => l.quadros.length))
    const margem = 24
    const rotulo = 30
    const cabeca = 64
    const tituloLinha = 34
    const largura = margem * 2 + colunas * w + (colunas - 1) * 8
    const altura = cabeca + linhas.length * (tituloLinha + h + rotulo) + margem
    const c = document.createElement('canvas')
    c.width = largura
    c.height = altura
    const g = c.getContext('2d')
    g.fillStyle = '#fcfcfb'
    g.fillRect(0, 0, largura, altura)
    g.fillStyle = '#0b0b0b'
    g.font = '600 26px Barlow, system-ui, sans-serif'
    g.fillText(titulo, margem, 40)
    let y = cabeca
    for (const linha of linhas) {
      g.fillStyle = '#52514e'
      g.font = '500 19px Barlow, system-ui, sans-serif'
      g.fillText(linha.titulo, margem, y + 22)
      y += tituloLinha
      for (let i = 0; i < linha.quadros.length; i++) {
        const x = margem + i * (w + 8)
        const img = await carregar(linha.quadros[i].src)
        g.drawImage(img, x, y, w, h)
        g.fillStyle = '#0b0b0b'
        g.font = '500 17px Barlow, system-ui, sans-serif'
        const texto = linha.quadros[i].rotulo
        g.fillText(texto, x + (w - g.measureText(texto).width) / 2, y + h + 22)
      }
      y += h + rotulo
    }
    return c.toDataURL('image/png')
  }, dados)
}

async function grafico(page, dados) {
  return page.evaluate((d) => {
    const COR = { superficie: '#fcfcfb', texto: '#0b0b0b', suave: '#52514e', grade: '#e4e3df', progresso: '#2a78d6', cobertura: '#eb6834', som: '#1baf7a', tremor: '#f1efe9' }
    const W = 1400
    const H = 640
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d')
    g.fillStyle = COR.superficie
    g.fillRect(0, 0, W, H)
    g.fillStyle = COR.texto
    g.font = '600 24px Barlow, system-ui, sans-serif'
    g.fillText(d.titulo, 32, 40)
    g.fillStyle = COR.suave
    g.font = '400 16px Barlow, system-ui, sans-serif'
    g.fillText('Amostras a cada 50 ms (pontos). Em cima: progresso e cobertura do vão pela folha, de 0 a 1. Embaixo: volume do som (RMS, dBFS) na mesma linha do tempo.', 32, 66)
    // Legenda (2 séries + som).
    const legenda = [
      ['progresso', COR.progresso],
      ['cobertura do vão', COR.cobertura],
      ['som (RMS)', COR.som],
    ]
    let lx = 32
    for (const [nome, cor] of legenda) {
      g.fillStyle = cor
      g.fillRect(lx, 84, 22, 4)
      g.fillStyle = COR.texto
      g.font = '500 15px Barlow, system-ui, sans-serif'
      g.fillText(nome, lx + 28, 91)
      lx += 28 + g.measureText(nome).width + 26
    }
    const tMax = Math.max(...d.paineis.map((p) => p.tMax))
    const paineis = d.paineis.length
    const larguraPainel = (W - 64 - (paineis - 1) * 48) / paineis
    d.paineis.forEach((p, k) => {
      const x0 = 64 + k * (larguraPainel + 48)
      const x1 = x0 + larguraPainel - 16
      const X = (t) => x0 + (t / tMax) * (x1 - x0)
      const topo = 130
      const base = 400
      const Y = (v) => base - v * (base - topo)
      g.fillStyle = COR.texto
      g.font = '600 18px Barlow, system-ui, sans-serif'
      g.fillText(p.titulo, x0, 118)
      for (const [a, b] of p.tremores) {
        g.fillStyle = COR.tremor
        g.fillRect(X(a), topo, Math.max(1, X(b) - X(a)), base - topo)
        g.fillStyle = COR.suave
        g.font = '400 13px Barlow, system-ui, sans-serif'
        g.fillText('tremor', X(a) + 4, topo + 16)
      }
      g.strokeStyle = COR.grade
      g.lineWidth = 1
      g.font = '400 13px Barlow, system-ui, sans-serif'
      g.fillStyle = COR.suave
      for (const v of [0, 0.5, 1]) {
        g.beginPath()
        g.moveTo(x0, Y(v))
        g.lineTo(x1, Y(v))
        g.stroke()
        g.fillText(String(v).replace('.', ','), x0 - 30, Y(v) + 4)
      }
      for (let t = 0; t <= tMax; t += 100) {
        g.fillText(`${t}`, X(t) - 10, base + 20)
      }
      g.fillText('ms', x1 - 14, base + 38)
      const linha = (serie, cor) => {
        g.strokeStyle = cor
        g.lineWidth = 2
        g.beginPath()
        serie.forEach(([t, v], i) => (i === 0 ? g.moveTo(X(t), Y(v)) : g.lineTo(X(t), Y(v))))
        g.stroke()
        g.fillStyle = cor
        for (const [t, v] of serie) {
          g.beginPath()
          g.arc(X(t), Y(v), 4, 0, Math.PI * 2)
          g.fill()
        }
      }
      linha(p.cobertura, COR.cobertura)
      linha(p.progresso, COR.progresso)
      // Rótulos diretos no fim das linhas.
      const ultimo = (s) => s[s.length - 1]
      g.font = '500 14px Barlow, system-ui, sans-serif'
      g.fillStyle = COR.texto
      g.fillText('progresso', X(ultimo(p.progresso)[0]) + 8, Y(ultimo(p.progresso)[1]) + (ultimo(p.progresso)[1] > 0.5 ? 18 : -8))
      g.fillText('cobertura', X(ultimo(p.cobertura)[0]) + 8, Y(ultimo(p.cobertura)[1]) + (ultimo(p.cobertura)[1] > 0.5 ? 18 : -8))
      // Som, painel de baixo, eixo próprio (dB).
      const sTopo = 450
      const sBase = 600
      const dbMin = -80
      const S = (db) => sBase - ((Math.max(dbMin, db) - dbMin) / -dbMin) * (sBase - sTopo)
      g.strokeStyle = COR.grade
      g.fillStyle = COR.suave
      for (const db of [-80, -40, 0]) {
        g.beginPath()
        g.moveTo(x0, S(db))
        g.lineTo(x1, S(db))
        g.stroke()
        g.fillText(`${db} dB`, x0 - 52, S(db) + 4)
      }
      g.strokeStyle = COR.som
      g.lineWidth = 2
      g.beginPath()
      p.som.forEach(([t, db], i) => (i === 0 ? g.moveTo(X(t), S(db)) : g.lineTo(X(t), S(db))))
      g.stroke()
      g.fillStyle = COR.texto
      g.fillText(`som (${p.somResumo})`, x0, sTopo - 8)
      g.strokeStyle = COR.suave
      g.setLineDash([4, 4])
      g.beginPath()
      g.moveTo(X(p.duracao), topo)
      g.lineTo(X(p.duracao), sBase)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = COR.suave
      g.fillText(`fim: ${p.duracao} ms`, X(p.duracao) + 4, sBase + 18)
    })
    return c.toDataURL('image/png')
  }, dados)
}

const dePng = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')

// ---------------------------------------------------------------------------

async function main() {
  const inicio = Date.now()
  const montado = montar()
  const index = fs.readFileSync(path.join(RAIZ_DO_PROTOTIPO, 'prototipo', 'index.html'), 'utf8')
  const teste = path.join(os.tmpdir(), 'porta-animacoes-pagina-de-teste.html')
  fs.writeFileSync(teste, `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${index}</body></html>`)
  const url = 'file:///' + teste.replace(/\\/g, '/')
  for (const d of ['folhas', 'graficos', 'som', 'prints']) garantir(path.join(PASTA, d))
  const nav = navegador()
  const browser = await chromium.launch({ executablePath: nav.executablePath, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] })
  const consoleMsgs = []
  const ouvirConsole = (page, onde) => {
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') consoleMsgs.push({ onde, tipo: m.type(), texto: m.text() })
    })
    page.on('pageerror', (e) => consoleMsgs.push({ onde, tipo: 'pageerror', texto: e.message }))
  }
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  const page = await contexto.newPage()
  ouvirConsole(page, 'desktop 1440')
  await page.goto(url)
  await page.waitForFunction(() => document.documentElement.dataset.pronto !== undefined, null, { timeout: 30000 })
  const pronto = await page.evaluate(() => document.documentElement.dataset.pronto)
  if (pronto !== 'sim') throw new Error(`a página não abriu (pronto=${pronto})`)
  await page.evaluate(() => document.fonts.ready)
  const catalogo = await page.evaluate(() => window.PortaLab.catalogo())
  const porId = Object.fromEntries(catalogo.map((a) => [a.id, a]))

  const resultados = {}
  const falhas = []
  const reprovar = (meta, texto) => falhas.push(`${meta}: ${texto}`)

  for (const id of NOVAS) {
    const meta = porId[id]
    const r = { nome: meta.nome, duracaoMs: meta.duracaoMs, duracaoFecharMs: meta.duracaoFecharMs, curvaAbrir: meta.curvaAbrir, curvaFechar: meta.curvaFechar }

    // M2, M4, M5: 201 pontos de progresso, nos dois sentidos.
    const pontos = Array.from({ length: 201 }, (_, i) => i / 200)
    const amostras = await page.evaluate(({ id, pontos }) => [true, false].map((abrindo) => pontos.map((p) => window.PortaLab.geometria(id, p, abrindo))), { id, pontos })
    let alfaRuim = 0
    let subidaMax = 0
    let saltoMax = 0
    const coberturaPorP = []
    amostras.forEach((serie, k) => {
      const medidasDaSerie = serie.map((a) => {
        for (const f of a.formas) if (f.alfa < 1) alfaRuim++
        return medirFolha(a.formas, a.porta)
      })
      if (k === 0) medidasDaSerie.forEach((m, i) => coberturaPorP.push([pontos[i], m.cobertura]))
      for (let i = 1; i < pontos.length; i++) {
        const antes = medidasDaSerie[i - 1]
        const depois = medidasDaSerie[i]
        if (foraDosTrechos(pontos[i - 1], pontos[i], meta.trechosDeTremor)) subidaMax = Math.max(subidaMax, depois.cobertura - antes.cobertura)
        if (antes.centro !== null && depois.centro !== null) saltoMax = Math.max(saltoMax, distancia(antes.centro, depois.centro))
      }
    })
    const coberturaInicio = coberturaPorP[0][1]
    const coberturaFim = coberturaPorP[coberturaPorP.length - 1][1]
    r.M2_alfaAbaixoDe1 = alfaRuim
    r.M4 = { coberturaInicio: r2(coberturaInicio), coberturaFim: r2(coberturaFim), maiorSubidaForaDoTremor: Number(subidaMax.toFixed(4)), trechosDeTremor: meta.trechosDeTremor }
    r.M5_maiorPassoDoCentroPx = r2(saltoMax)
    if (alfaRuim > 0) reprovar('M2', `${id}: ${alfaRuim} preenchimentos com alfa < 1`)
    if (Math.abs(coberturaInicio - 1) > 0.001 || coberturaFim > 0.001 || subidaMax > 0.005) reprovar('M4', `${id}: cobertura ${r2(coberturaInicio)} → ${r2(coberturaFim)}, subida ${subidaMax.toFixed(4)}`)
    if (saltoMax > 1.5) reprovar('M5', `${id}: o centro da folha andou ${r2(saltoMax)} px de tela num passo de 0,5%`)

    // M3, M6, M8: corridas do animador.
    const corrida = await page.evaluate((id) => {
      const L = window.PortaLab
      const resumo = (c) => ({ terminouEm: c.terminouEm, quadros: c.quadros.map((q) => ({ t: q.t, progresso: q.progresso, abrindo: q.abrindo, formas: q.formas })) })
      return { abrir: resumo(L.correr(id)), fechar: resumo(L.correr(id, { fechar: true })), reduzido: resumo(L.correr(id, { reduzido: true })), inversoes: [0.25, 0.5, 0.75].map((f) => ({ f, ...resumo(L.correr(id, { inverterEm: f })) })) }
    }, id)
    const portaRef = amostras[0][0].porta
    const sentido = (c, abrindo) => {
      const animados = c.quadros.filter((q) => q.progresso !== null)
      const ps = animados.map((q) => q.progresso)
      let monotona = true
      for (let i = 1; i < ps.length; i++) if (abrindo ? ps[i] < ps[i - 1] - 1e-9 : ps[i] > ps[i - 1] + 1e-9) monotona = false
      const excesso = Math.max(0, ...ps.map((p) => p - 1), ...ps.map((p) => -p))
      const fim = c.quadros[c.terminouEm]
      const declarado = abrindo ? meta.duracaoMs : meta.duracaoFecharMs
      return { monotona, excesso, medidoMs: fim ? r2(fim.t) : null, declaradoMs: declarado, chegouNoAlvo: c.terminouEm > 0, quadrosAnimados: animados.length }
    }
    const abrir = sentido(corrida.abrir, true)
    const fechar = sentido(corrida.fechar, false)
    r.M3 = { abrir: { monotona: abrir.monotona, excesso: abrir.excesso }, fechar: { monotona: fechar.monotona, excesso: fechar.excesso } }
    r.M6 = { abrir: { declaradoMs: abrir.declaradoMs, medidoMs: abrir.medidoMs }, fechar: { declaradoMs: fechar.declaradoMs, medidoMs: fechar.medidoMs } }
    for (const [nome, s] of [
      ['abrir', abrir],
      ['fechar', fechar],
    ]) {
      if (!s.monotona || s.excesso > 0 || !s.chegouNoAlvo) reprovar('M3', `${id} ${nome}: monotona=${s.monotona} excesso=${s.excesso}`)
      if (s.medidoMs === null || s.medidoMs < s.declaradoMs - 0.01 || s.medidoMs > s.declaradoMs + QUADRO_MS + 0.01) reprovar('M6', `${id} ${nome}: medido ${s.medidoMs} ms, declarado ${s.declaradoMs} ms`)
      if (s.declaradoMs < 200 || s.declaradoMs > 900) reprovar('M6', `${id} ${nome}: ${s.declaradoMs} ms fora de 200-900 ms`)
    }
    r.M8_quadrosAnimadosComMovimentoReduzido = corrida.reduzido.quadros.filter((q) => q.progresso !== null).length
    if (r.M8_quadrosAnimadosComMovimentoReduzido !== 0) reprovar('M8', `${id}: ${r.M8_quadrosAnimadosComMovimentoReduzido} quadros animados com movimento reduzido`)

    // M7: inversão. Salto do centro da folha no quadro da inversão vs. maior passo da corrida normal.
    const centros = (quadros) => quadros.map((q) => medirFolha(q.formas, portaRef).centro)
    const normal = centros(corrida.abrir.quadros)
    let passoNormalMax = 0
    for (let i = 1; i < normal.length; i++) passoNormalMax = Math.max(passoNormalMax, distancia(normal[i - 1], normal[i]))
    r.M7 = { maiorPassoNormalPx: r2(passoNormalMax), inversoes: [] }
    for (const inv of corrida.inversoes) {
      const k = inv.quadros.findIndex((q, i) => i > 0 && q.abrindo === false)
      const cs = centros(inv.quadros)
      const salto = k > 0 ? distancia(cs[k - 1], cs[k]) : Infinity
      const pAntes = k > 0 ? inv.quadros[k - 1].progresso : null
      const pDepois = k > 0 ? inv.quadros[k].progresso : null
      const fim = inv.quadros[inv.terminouEm]
      r.M7.inversoes.push({ em: inv.f, saltoPx: r2(salto), progressoAntes: pAntes === null ? null : r2(pAntes), progressoDepois: pDepois === null ? null : r2(pDepois), voltouFechadaEmMs: fim ? r2(fim.t) : null })
      if (!(salto <= passoNormalMax + 1e-6)) reprovar('M7', `${id} invertendo a ${inv.f * 100}%: salto ${r2(salto)} px > maior passo normal ${r2(passoNormalMax)} px`)
    }

    // M12: som, abrir e fechar.
    r.som = {}
    const envoltorias = {}
    for (const abrindo of [true, false]) {
      const nome = abrindo ? 'abrir' : 'fechar'
      const s = await page.evaluate(({ id, abrindo }) => window.PortaLab.som(id, abrindo), { id, abrindo })
      const bytes = Buffer.from(s.base64, 'base64')
      const canal = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
      const copia = Float32Array.from(canal)
      const m = medidas.medirTudo([copia], s.taxa)
      fs.writeFileSync(path.join(PASTA, 'som', `${id}-${nome}.wav`), medidas.wav16([copia], s.taxa))
      const env = medidas.envoltoria([copia], s.taxa, 0.01)
      envoltorias[nome] = env.rms.map((db, i) => [Math.round(i * 10 - 10), Number.isFinite(db) ? db : -120])
      const ultimos = copia.subarray(copia.length - Math.round(0.01 * s.taxa))
      const rmsFim = medidas.db(Math.sqrt(ultimos.reduce((acc, v) => acc + v * v, 0) / ultimos.length))
      let ultimaAudivel = 0
      const limiar = 10 ** (-60 / 20)
      for (let i = copia.length - 1; i >= 0; i--)
        if (Math.abs(copia[i]) > limiar) {
          ultimaAudivel = i / s.taxa
          break
        }
      const acabaDepoisDaAnimacaoS = ultimaAudivel - 0.01 - s.animacaoS
      r.som[nome] = { picoVerdadeiroDbtp: m.picoVerdadeiroDbtp, lufsIntegrado: m.lufsIntegrado, cliques: m.cliques.length, ataques: m.ataques.length, cortes: m.cortes, dcPct: m.dcPct, ultimos10msDbfs: Number.isFinite(rmsFim) ? r2(rmsFim) : -120, acabaDepoisDaAnimacaoMs: Math.round(acabaDepoisDaAnimacaoS * 1000), wav: `som/${id}-${nome}.wav` }
      const q = r.som[nome]
      if (q.picoVerdadeiroDbtp > -12) reprovar('M12', `${id} ${nome}: pico ${q.picoVerdadeiroDbtp} dBTP`)
      if (!(q.lufsIntegrado >= -36 && q.lufsIntegrado <= -26)) reprovar('M12', `${id} ${nome}: ${q.lufsIntegrado} LUFS fora de -36..-26`)
      if (q.cliques > 0 || q.cortes > 0 || Math.abs(q.dcPct) > 0.5) reprovar('M12', `${id} ${nome}: cliques ${q.cliques}, cortes ${q.cortes}, DC ${q.dcPct}%`)
      if (q.ultimos10msDbfs > -60) reprovar('M12', `${id} ${nome}: fim a ${q.ultimos10msDbfs} dBFS (corte)`)
      if (q.acabaDepoisDaAnimacaoMs > 250) reprovar('M12', `${id} ${nome}: som acaba ${q.acabaDepoisDaAnimacaoMs} ms depois da animação`)
    }

    // Gráfico do movimento: amostras a cada 50 ms (progresso do animador e cobertura do vão).
    const amostrar = (c, duracao) => {
      const serieP = []
      const serieC = []
      for (let t = 0; t <= duracao + 50; t += 50) {
        let q = c.quadros[0]
        for (const quadro of c.quadros) if (quadro.t <= t + 1e-6) q = quadro
        const final = q.progresso === null && c.quadros.indexOf(q) > 0
        const abrindo = c.quadros[0].abrindo !== false
        const p = q.progresso === null ? (final ? (abrindo ? 1 : 0) : abrindo ? 0 : 1) : q.progresso
        serieP.push([t, r2(p)])
        serieC.push([t, r2(medirFolha(q.formas, portaRef).cobertura)])
      }
      return { serieP, serieC }
    }
    const tempoDosTremores = (c, abrindo) =>
      meta.trechosDeTremor
        .map(([a, b]) => {
          const ts = c.quadros.filter((q) => q.progresso !== null && q.progresso >= a && q.progresso <= b).map((q) => q.t)
          return ts.length ? [Math.min(...ts), Math.max(...ts)] : null
        })
        .filter((x) => x !== null)
        .map(([a, b]) => (abrindo ? [a, b] : [a, b]))
    const ga = amostrar(corrida.abrir, meta.duracaoMs)
    const gf = amostrar(corrida.fechar, meta.duracaoFecharMs)
    const resumoSom = (s) => `${String(s.lufsIntegrado).replace('.', ',')} LUFS, pico ${String(s.picoVerdadeiroDbtp).replace('.', ',')} dBTP`
    const png = await grafico(page, {
      titulo: `${meta.nome}: movimento e som`,
      paineis: [
        { titulo: `Abrir (${meta.duracaoMs} ms)`, tMax: Math.max(meta.duracaoMs, meta.duracaoFecharMs) + 260, duracao: meta.duracaoMs, progresso: ga.serieP, cobertura: ga.serieC, som: envoltorias.abrir, somResumo: resumoSom(r.som.abrir), tremores: tempoDosTremores(corrida.abrir, true) },
        { titulo: `Fechar (${meta.duracaoFecharMs} ms)`, tMax: Math.max(meta.duracaoMs, meta.duracaoFecharMs) + 260, duracao: meta.duracaoFecharMs, progresso: gf.serieP, cobertura: gf.serieC, som: envoltorias.fechar, somResumo: resumoSom(r.som.fechar), tremores: tempoDosTremores(corrida.fechar, false) },
      ],
    })
    fs.writeFileSync(path.join(PASTA, 'graficos', `${id}.png`), dePng(png))
    r.grafico = `graficos/${id}.png`
    r.amostras50ms = { abrir: ga, fechar: gf }

    // M14: folha de contato, 8 quadros abrindo + 8 fechando, no tempo real do animador.
    const linhas = []
    for (const [abrindo, c, duracao] of [
      [true, corrida.abrir, meta.duracaoMs],
      [false, corrida.fechar, meta.duracaoFecharMs],
    ]) {
      const quadros = []
      for (let k = 0; k < 8; k++) {
        const alvo = (k / 7) * duracao
        // O último quadro do animador no tempo alvo ou antes dele; o último da linha é a porta já parada.
        let q = c.quadros[0]
        for (const quadro of c.quadros) if (quadro.t <= alvo + 1e-6) q = quadro
        if (k === 7) q = c.quadros[c.terminouEm]
        const src = await page.evaluate((o) => window.PortaLab.quadroPng(o), { id, progresso: q.progresso, abrindo, aberta: abrindo, orientacao: 'horizontal', zoom: 3, recorte: { x: 75, y: 18, w: 150, h: 120 } })
        quadros.push({ src, rotulo: `${Math.round(q.t)} ms` })
      }
      linhas.push({ titulo: abrindo ? `Abrir: ${meta.duracaoMs} ms, curva cubic-bezier(${meta.curvaAbrir.join(', ')})` : `Fechar: ${meta.duracaoFecharMs} ms, curva cubic-bezier(${meta.curvaFechar.join(', ')})`, quadros })
    }
    const folha = await compor(page, { titulo: `${meta.nome}: folha de contato (zoom 300%, tempo do animador embaixo)`, linhas, w: 150 * 1.6, h: 120 * 1.6 })
    fs.writeFileSync(path.join(PASTA, 'folhas', `${id}.png`), dePng(folha))
    r.folha = { arquivo: `folhas/${id}.png`, quadros: linhas.reduce((n, l) => n + l.quadros.length, 0) }
    if (r.folha.quadros < 12 || r.folha.quadros > 16) reprovar('M14', `${id}: ${r.folha.quadros} quadros`)
    resultados[id] = r
    console.log(`${id}: ok (${Math.round((Date.now() - inicio) / 1000)} s)`)
  }

  // M1: extremos, todas as 7 (as de hoje como referência).
  const extremos = await page.evaluate(() => window.PortaLab.extremos())
  const extremosRuins = extremos.filter((l) => l.fechadaDiferentes > 0 || l.abertaDiferentes > 0)
  const extremosNovasRuins = extremosRuins.filter((l) => NOVAS.includes(l.id))
  if (extremosNovasRuins.length > 0) reprovar('M1', `${extremosNovasRuins.length} combinações com pixel diferente: ${JSON.stringify(extremosNovasRuins.slice(0, 3))}`)

  // M9: 50 portas.
  await page.locator('#estresse').scrollIntoViewIfNeeded()
  const estresse = await page.evaluate(() => window.PortaLab.estresse(4000))
  const longas200 = estresse.tarefasLongas.filter((d) => d >= 200).length
  if (estresse.quadroP95 > 20 || longas200 > 0 || estresse.reduzido) reprovar('M9', `p95 ${r2(estresse.quadroP95)} ms, longas >= 200 ms: ${longas200}`)
  await page.locator('#estresse').screenshot({ path: path.join(PASTA, 'prints', '4-cinquenta-portas.png') })

  // Print 1: desktop claro, portas no meio do caminho (0,25x), com cor e trancada.
  await page.evaluate(() => window.scrollTo(0, 0))
  const cartoes = page.locator('.cartao')
  await cartoes.nth(1).locator('.amostra').nth(3).click()
  await cartoes.nth(4).locator('.amostra').nth(4).click()
  await cartoes.nth(6).locator('.trancar').click()
  await page.locator('#velocidade button[data-valor="0.25"]').click()
  await page.locator('#abrir-todas').click()
  await page.waitForTimeout(420)
  await page.screenshot({ path: path.join(PASTA, 'prints', '1-desktop-1440-claro-no-meio.png'), fullPage: true })
  await page.locator('#velocidade button[data-valor="1"]').click()

  // Print 2: escuro, zoom 400%, telhado no meio da arrombada.
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.locator('#zoom button[data-valor="4"]').click()
  await page.locator('#fechar-todas').click()
  await page.waitForTimeout(900)
  await page.locator('#velocidade button[data-valor="0.25"]').click()
  await cartoes.nth(7).locator('.abrir').click()
  await cartoes.nth(2).locator('.abrir').click()
  await page.waitForTimeout(1100)
  await page.locator('#portas').screenshot({ path: path.join(PASTA, 'prints', '2-escuro-400-telhado.png') })
  await contexto.close()

  // M11 e print 3: 390 px.
  const celular = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p390 = await celular.newPage()
  ouvirConsole(p390, 'celular 390')
  await p390.goto(url)
  await p390.waitForFunction(() => document.documentElement.dataset.pronto === 'sim', null, { timeout: 30000 })
  await p390.evaluate(() => document.fonts.ready)
  const layout390 = await p390.evaluate(() => ({ larguraRolavel: document.scrollingElement.scrollWidth, larguraVisivel: window.innerWidth, maisLargos: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 0.5).map((el) => el.className || el.tagName).slice(0, 5) }))
  if (layout390.larguraRolavel > 390) reprovar('M11', `largura rolável ${layout390.larguraRolavel} px: ${layout390.maisLargos.join(', ')}`)
  await p390.locator('.cartao').first().scrollIntoViewIfNeeded()
  await p390.screenshot({ path: path.join(PASTA, 'prints', '3-celular-390.png') })
  await celular.close()
  await browser.close()

  const prints = fs.readdirSync(path.join(PASTA, 'prints')).filter((f) => f.endsWith('.png'))
  if (prints.length > 5) reprovar('M13', `${prints.length} prints`)
  const erros = consoleMsgs.filter((m) => m.tipo !== 'warning')
  if (erros.length > 0) reprovar('M10', `${erros.length} erros: ${erros.map((e) => e.texto).join(' | ')}`)

  const saida = {
    geradoEm: new Date().toISOString(),
    comando: 'node docs/design/porta-animacoes/provas/gerar-provas.cjs',
    navegador: `${nav.nome} (headless, WebGL por SwiftShader: GPU por software)`,
    prototipo: { bytes: montado.bytes, esbuild: montado.esbuild, codigoDoApp: montado.doApp },
    metas: metas.metas,
    veredito: falhas.length === 0 ? 'todas as metas passaram' : 'FALHOU',
    falhas,
    porAnimacao: resultados,
    M1_extremos: { combinacoes: extremos.length, comPixelDiferente: extremosRuins.length, novasComPixelDiferente: extremosNovasRuins.length, deHojeComPixelDiferente: extremosRuins.filter((l) => !NOVAS.includes(l.id)) },
    M9_50portas: { ...estresse, quadroP50: r2(estresse.quadroP50), quadroP95: r2(estresse.quadroP95), quadroMax: r2(estresse.quadroMax), desenhoP95: r2(estresse.desenhoP95), desenhoMax: r2(estresse.desenhoMax), tarefasLongas: estresse.tarefasLongas.map(r2), tarefasLongasDe200ms: longas200 },
    M10_console: { erros: erros.length, avisos: consoleMsgs.filter((m) => m.tipo === 'warning').length, mensagens: consoleMsgs },
    M11_390px: layout390,
    M13_prints: prints,
    segundos: Math.round((Date.now() - inicio) / 1000),
  }
  // As amostras de 50 ms ficam no testes.json; as formas não (seriam megabytes).
  fs.writeFileSync(path.join(PASTA, 'testes.json'), JSON.stringify(saida, null, 2) + '\n')
  console.log(falhas.length === 0 ? `TODAS AS METAS PASSARAM (${saida.segundos} s)` : `FALHAS:\n- ${falhas.join('\n- ')}`)
  process.exitCode = falhas.length === 0 ? 0 : 1
}


main().catch((erro) => {
  console.error(erro)
  process.exitCode = 2
})
