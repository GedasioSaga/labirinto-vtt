// Provas do protótipo do telhado: regras de passagem, gráfico do movimento, folha de contato, travada e prints de layout.
// 19/10/2026: + modelos e cores (controles de verdade, folha 2 modelos × 6 cores × retângulo e L,
// folha de zoom, tempo de gerar cada telhado e travada trocando cor andando).
// Rodar da raiz do repo: node docs/design/telhado/provas/gerar-provas.cjs
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { chromium } = require('playwright')
const { montar } = require('../prototipo/montar.cjs')

const PASTA = __dirname
const PROTOTIPO = path.join(PASTA, '..', 'prototipo', 'index.html')
const PAGINA_TESTE = path.join(PASTA, 'pagina-de-teste.html')

const AMOSTRA_MS = 25
const TEMPO_TELHADO = 300
const FOLGA_MS = 2 * AMOSTRA_MS
const SALTO_MAX = 0.36 // easeOutQuart a 300 ms anda no máximo ~0,33 por amostra de 25 ms
const P95_MAX_MS = 20
const TAREFA_LONGA_MS = 200
const GERAR_MAX_MS = 50 // meta de 19/10: telhado de uma sala de 1024 × 1024 em até 50 ms

// Mesmo esqueleto que o Artifact põe em volta da página.
function montarPaginaDeTeste() {
  const corpo = fs.readFileSync(PROTOTIPO, 'utf8')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${corpo}</body></html>`
  fs.writeFileSync(PAGINA_TESTE, html)
  return pathToFileURL(PAGINA_TESTE).href
}

// O Playwright do repo às vezes pede uma versão do Chromium que não está baixada; usa a mais nova que existir.
function opcoesDoNavegador() {
  if (fs.existsSync(chromium.executablePath())) return {}
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  const pastas = fs.existsSync(base) ? fs.readdirSync(base).filter((p) => p.startsWith('chromium_headless_shell-')).sort().reverse() : []
  for (const pasta of pastas) {
    const exe = path.join(base, pasta, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
    if (fs.existsSync(exe)) return { executablePath: exe }
  }
  return {}
}

const resultados = []
function checar(nome, ok, detalhe) {
  resultados.push({ nome, ok: !!ok, detalhe })
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? ' — ' + detalhe : ''}`)
}

// Anda o pino com o relógio parado e devolve a série amostrada a cada AMOSTRA_MS.
async function gravarCaminhada(pagina, inicio, destino, duracaoMs) {
  return pagina.evaluate(({ inicio, destino, duracaoMs, passo }) => {
    const T = window.__telhado
    T.congelarRelogio(0)
    T.teleportar(inicio[0], inicio[1])
    T.avancar(1000) // o telhado assenta antes de começar a gravar
    const chegou = T.irPara(destino[0], destino[1])
    const serie = []
    for (let t = 0; t <= duracaoMs; t += passo) {
      if (t > 0) T.avancar(passo)
      const a = T.amostra()
      serie.push({ t, x: a.x, y: a.y, sala: a.telhados.sala, deposito: a.telhados.deposito, status: a.status })
    }
    return { chegou, serie }
  }, { inicio, destino, duracaoMs, passo: AMOSTRA_MS })
}

function primeiroIndice(serie, teste) {
  const i = serie.findIndex(teste)
  return i < 0 ? null : i
}
function maiorSalto(serie, campo) {
  let maior = 0
  for (let i = 1; i < serie.length; i++) maior = Math.max(maior, Math.abs(serie[i][campo] - serie[i - 1][campo]))
  return maior
}

async function main() {
  // O index.html leva o pacote das funções do app: monta antes, para provar o código de agora.
  const pacote = montar()
  console.log(`pacote do telhado: ${(pacote.bytes / 1024).toFixed(1)} KB (esbuild ${pacote.esbuild})`)
  const url = montarPaginaDeTeste()
  const navegador = await chromium.launch(opcoesDoNavegador())
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
  const pagina = await contexto.newPage()
  const errosConsole = []
  pagina.on('pageerror', (e) => errosConsole.push(String(e)))
  pagina.on('console', (m) => { if (m.type() === 'error') errosConsole.push(m.text()) })
  await pagina.goto(url)
  await pagina.evaluate(() => document.fonts.ready)
  await pagina.waitForFunction(() => !!window.__telhado)

  // 1. Regras de passagem: só a porta deixa entrar.
  const passagens = await pagina.evaluate(() => {
    const p = window.__telhado.podePassar
    return {
      paredeSala: p([4, 7], [4, 6]),
      portaSala: p([5, 7], [5, 6]),
      saidaSala: p([5, 6], [5, 7]),
      paredeLateral: p([1, 4], [2, 4]),
      paredeDeposito: p([10, 3], [11, 3]),
      portaDeposito: p([10, 4], [11, 4]),
      arvore: p([1, 9], [1, 10]),
    }
  })
  checar('parede da sala segura o pino', passagens.paredeSala === false && passagens.paredeLateral === false)
  checar('porta da sala deixa entrar e sair', passagens.portaSala && passagens.saidaSala)
  checar('depósito: parede segura, porta deixa entrar', passagens.paredeDeposito === false && passagens.portaDeposito)
  checar('árvore bloqueia a casa', passagens.arvore === false)

  const inicial = await pagina.evaluate(() => window.__telhado.amostra())
  checar('começa fora com os dois telhados fechados', inicial.telhados.sala === 1 && inicial.telhados.deposito === 1 && inicial.status.startsWith('Fora'))

  // 2. Gráfico do movimento: entrar na sala.
  const LINHA_PAREDE = 280
  const entrada = await gravarCaminhada(pagina, [5, 8], [5, 5], 1200)
  const s = entrada.serie
  const iCruzou = primeiroIndice(s, (a) => a.y < LINHA_PAREDE)
  const antes = s.slice(0, iCruzou)
  checar('caminho até dentro da sala existe', entrada.chegou && iCruzou !== null)
  checar('telhado fica fechado enquanto o pino está fora', antes.every((a) => a.sala === 1), `${antes.length} amostras fora`)
  const iAberto = primeiroIndice(s, (a) => a.sala <= 0.01)
  const msAteAbrir = (iAberto - iCruzou) * AMOSTRA_MS
  checar('telhado some em até 300 ms depois de cruzar a porta', iAberto !== null && msAteAbrir <= TEMPO_TELHADO + FOLGA_MS, `${msAteAbrir} ms`)
  const fade = s.slice(iCruzou, iAberto + 1)
  checar('telhado só desce (não pisca) ao entrar', fade.every((a, i) => i === 0 || a.sala <= fade[i - 1].sala + 1e-9))
  checar('telhado do depósito não mexe quando entra na sala', s.every((a) => a.deposito === 1))
  checar('status diz que está na sala', s[s.length - 1].status.startsWith('Na sala'))

  // 3. Sair: o telhado volta.
  const saida = await gravarCaminhada(pagina, [5, 5], [5, 8], 1200)
  const ss = saida.serie
  const iSaiu = primeiroIndice(ss, (a) => a.y > LINHA_PAREDE)
  const iFechado = primeiroIndice(ss, (a) => a.sala >= 0.99)
  const msAteFechar = (iFechado - iSaiu) * AMOSTRA_MS
  checar('telhado volta em até 300 ms depois de sair', iSaiu !== null && iFechado !== null && msAteFechar <= TEMPO_TELHADO + FOLGA_MS, `${msAteFechar} ms`)
  checar('dentro, o telhado fica aberto', ss.slice(0, iSaiu).every((a) => a.sala === 0))

  // 4. Entra e sai na hora: o telhado vira no meio sem pular.
  const vaiVolta = await pagina.evaluate(({ passo }) => {
    const T = window.__telhado
    T.congelarRelogio(0)
    T.teleportar(5, 7)
    T.andar(0, -1)
    const serie = []
    for (let t = 0; t <= 900; t += passo) {
      if (t > 0) T.avancar(passo)
      if (t === 225) T.andar(0, 1)
      serie.push({ t, ...T.amostra() })
    }
    return serie.map((a) => ({ t: a.t, y: a.y, sala: a.telhados.sala }))
  }, { passo: AMOSTRA_MS })
  const minimo = Math.min(...vaiVolta.map((a) => a.sala))
  const salto = maiorSalto(vaiVolta, 'sala')
  checar('entrar e sair rápido: telhado vira sem pular', salto <= SALTO_MAX && minimo > 0 && vaiVolta[vaiVolta.length - 1].sala >= 0.99, `maior salto ${salto.toFixed(3)}, mínimo ${minimo.toFixed(3)}`)

  // 5. Depósito.
  const deposito = await gravarCaminhada(pagina, [10, 5], [12, 4], 900)
  const fimDep = deposito.serie[deposito.serie.length - 1]
  checar('entrar no depósito abre só o telhado dele', deposito.chegou && fimDep.deposito <= 0.01 && fimDep.sala === 1 && fimDep.status.startsWith('No depósito'))

  // 6. O que aparece na tela: o mordomo fica escondido de fora (jogador), aparece por baixo do vidro (mestre) e de dentro.
  const pixel = async () => pagina.evaluate(() => {
    const d = document.getElementById('mapa').getContext('2d').getImageData(300, 170, 1, 1).data
    return [d[0], d[1], d[2]]
  })
  const distancia = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])))
  const FICHA_MORDOMO = [0x55, 0x40, 0x6e]
  await pagina.evaluate(() => { const T = window.__telhado; T.congelarRelogio(0); T.teleportar(5, 9); T.definirVisao('jogador'); T.avancar(16) })
  const deFora = await pixel()
  await pagina.evaluate(() => { const T = window.__telhado; T.definirVisao('mestre'); T.avancar(16) })
  const mestreDeFora = await pixel()
  await pagina.evaluate(() => { const T = window.__telhado; T.definirVisao('jogador'); T.teleportar(5, 5); T.avancar(400) })
  const deDentro = await pixel()
  checar('jogador de fora não vê o mordomo', distancia(deFora, FICHA_MORDOMO) > 30, `pixel ${deFora}`)
  checar('mestre vê o mordomo por baixo do telhado', distancia(mestreDeFora, deFora) > 20 && distancia(mestreDeFora, FICHA_MORDOMO) < distancia(deFora, FICHA_MORDOMO), `pixel ${mestreDeFora}`)
  checar('jogador de dentro vê o mordomo', distancia(deDentro, FICHA_MORDOMO) <= 4, `pixel ${deDentro}`)

  // 7. Folha de contato da entrada (14 quadros, relógio parado).
  const folha = await pagina.evaluate(({ passo }) => {
    const T = window.__telhado
    T.definirVisao('jogador')
    T.congelarRelogio(0)
    T.teleportar(5, 8)
    T.irPara(5, 5)
    const tela = document.getElementById('mapa')
    const recorte = { x: 40, y: 40, w: 360, h: 320 }
    const quadros = []
    const INICIO = 175 // um pouco antes do pino chegar na porta
    T.avancar(INICIO)
    for (let i = 0; i < 14; i++) {
      if (i > 0) T.avancar(passo * 2)
      const a = T.amostra()
      const c = document.createElement('canvas')
      c.width = recorte.w; c.height = recorte.h
      c.getContext('2d').drawImage(tela, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, recorte.w, recorte.h)
      quadros.push({ t: INICIO + i * passo * 2, alfa: a.telhados.sala, url: c.toDataURL('image/png') })
    }
    return quadros
  }, { passo: AMOSTRA_MS })
  await pagina.evaluate(() => window.__telhado.soltarRelogio())

  const paginaFolha = await contexto.newPage()
  await paginaFolha.setViewportSize({ width: 1340, height: 800 })
  await paginaFolha.setContent(`<!doctype html><html><body style="margin:0;background:#111;color:#ddd;font:13px system-ui">
    <div style="padding:14px 16px 6px;font-weight:600">Entrada na sala — quadro a cada 50 ms (tempo do telhado 300 ms)</div>
    <div style="display:grid;grid-template-columns:repeat(7,180px);gap:10px;padding:8px 16px 16px">
    ${folha.map((q) => `<figure style="margin:0"><img src="${q.url}" style="width:180px;display:block;border-radius:4px"><figcaption style="padding-top:4px;font-variant-numeric:tabular-nums">${q.t} ms · telhado ${(q.alfa * 100).toFixed(0)}%</figcaption></figure>`).join('')}
    </div></body></html>`)
  await paginaFolha.screenshot({ path: path.join(PASTA, 'folha-contato.png'), fullPage: true })

  // 8. Gráfico do movimento (entrada e saída).
  const grafico = (titulo, serie, linhaParede) => {
    const W = 600, H = 220, M = 36
    const tMax = serie[serie.length - 1].t
    const xT = (t) => M + (t / tMax) * (W - 2 * M)
    const yA = (a) => H - M - a * (H - 2 * M)
    const yMin = Math.min(...serie.map((a) => a.y)), yMax = Math.max(...serie.map((a) => a.y))
    const yP = (y) => H - M - ((y - yMin) / (yMax - yMin || 1)) * (H - 2 * M)
    const caminho = (f) => serie.map((a, i) => `${i ? 'L' : 'M'}${xT(a.t).toFixed(1)},${f(a).toFixed(1)}`).join('')
    const yParede = yP(linhaParede)
    return `<figure style="margin:0 0 18px"><figcaption style="font-weight:600;padding-bottom:4px">${titulo}</figcaption>
      <svg width="${W}" height="${H}" style="background:#1a1d1a;border-radius:6px">
        <line x1="${M}" x2="${W - M}" y1="${yParede}" y2="${yParede}" stroke="#777" stroke-dasharray="4 4"/>
        <text x="${W - M}" y="${yParede - 5}" fill="#999" font-size="11" text-anchor="end">parede (y = ${linhaParede})</text>
        <path d="${caminho((a) => yP(a.y))}" fill="none" stroke="#6fb0d0" stroke-width="2"/>
        <path d="${caminho((a) => yA(a.sala))}" fill="none" stroke="#d18c71" stroke-width="2.5"/>
        <text x="${M}" y="${H - 10}" fill="#999" font-size="11">0 ms</text>
        <text x="${W - M}" y="${H - 10}" fill="#999" font-size="11" text-anchor="end">${tMax} ms</text>
        <text x="${M + 4}" y="${M - 12}" fill="#d18c71" font-size="11">telhado (0 a 100%)</text>
        <text x="${M + 130}" y="${M - 12}" fill="#6fb0d0" font-size="11">altura do pino no mapa</text>
      </svg></figure>`
  }
  await paginaFolha.setContent(`<!doctype html><html><body style="margin:0;padding:16px;background:#111;color:#ddd;font:13px system-ui">
    ${grafico('Entrando na sala', s, LINHA_PAREDE)}${grafico('Saindo da sala', ss, LINHA_PAREDE)}${grafico('Entra e sai na hora', vaiVolta, LINHA_PAREDE)}
    </body></html>`)
  await paginaFolha.screenshot({ path: path.join(PASTA, 'grafico-movimento.png'), fullPage: true })
  await paginaFolha.close()

  // 9. Travada: relógio de verdade, pino andando a trilha inteira.
  const desempenho = await pagina.evaluate(async () => {
    const T = window.__telhado
    T.soltarRelogio()
    T.teleportar(5, 10)
    const longas = []
    let obs = null
    try {
      obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => longas.push(e.duration)))
      obs.observe({ type: 'longtask', buffered: false })
    } catch {}
    const roteiro = [[5, 5], [5, 9], [10, 9], [12, 4], [10, 4], [12, 10], [10, 9], [5, 9], [5, 6]]
    const tempos = []
    let anterior = performance.now()
    let alvo = 0
    const fim = anterior + 6000
    await new Promise((resolve) => {
      function f(t) {
        tempos.push(t - anterior); anterior = t
        const a = T.amostra()
        const destino = roteiro[alvo % roteiro.length]
        if (a.casa[0] === destino[0] && a.casa[1] === destino[1]) { alvo++; const d = roteiro[alvo % roteiro.length]; T.irPara(d[0], d[1]) }
        if (t < fim) requestAnimationFrame(f); else resolve()
      }
      T.irPara(...roteiro[0])
      requestAnimationFrame(f)
    })
    if (obs) obs.disconnect()
    const ordenado = tempos.slice(1).sort((a, b) => a - b)
    return { p95: ordenado[Math.floor(ordenado.length * 0.95)], quadros: ordenado.length, maiorTarefaLonga: longas.length ? Math.max(...longas) : 0, salasVisitadas: alvo }
  })
  checar(`quadro p95 <= ${P95_MAX_MS} ms andando pela trilha`, desempenho.p95 <= P95_MAX_MS, `p95 ${desempenho.p95.toFixed(1)} ms em ${desempenho.quadros} quadros`)
  checar(`nenhuma tarefa longa >= ${TAREFA_LONGA_MS} ms`, desempenho.maiorTarefaLonga < TAREFA_LONGA_MS, `maior ${desempenho.maiorTarefaLonga.toFixed(0)} ms`)

  // 11. Modelos e cores (19/10/2026): os controles mudam o teto de verdade, pelo clique e pelo teclado.
  const lib = await pagina.evaluate(() => {
    const L = window.__telhado.lib
    return { padrao: L.COR_PADRAO_DO_TETO, modeloPadrao: L.MODELO_PADRAO_DO_TETO, paleta: L.PALETA_DO_TETO }
  })
  const tetosIniciais = await pagina.evaluate(() => window.__telhado.tetos())
  checar('a sala começa no padrão: telha colonial barro', tetosIniciais.sala.modelo === 'telhas' && tetosIniciais.sala.cor === lib.padrao && lib.modeloPadrao === 'telhas', JSON.stringify(tetosIniciais.sala))
  checar('6 cores por modelo, com nome', ['telhas', 'madeira'].every((m) => lib.paleta[m].length === 6 && lib.paleta[m].every((c) => /^#[0-9a-f]{6}$/.test(c.hex) && c.nome)))
  const quadroParado = () => pagina.evaluate(() => { const T = window.__telhado; T.congelarRelogio(0); T.teleportar(5, 10); T.definirVisao('jogador'); T.avancar(16) })
  // Água norte da barra da casa em L, longe das emendas.
  const PIXEL_CASA = [620, 331]
  const pixelCasa = () => pagina.evaluate(([x, y]) => window.__telhado.pixel(x, y), PIXEL_CASA)
  await quadroParado()
  await pagina.click('[data-casa="casa"]')
  await pagina.click('[data-modelo="telhas"]')
  await pagina.click('#grupo-cor [aria-label="Azul colonial"]')
  await pagina.evaluate(() => window.__telhado.avancar(16))
  const azul = await pagina.evaluate(() => window.__telhado.tetos().casa)
  const pxAzul = await pixelCasa()
  checar('clicar Telhas e Azul colonial muda o teto da casa em L', azul.modelo === 'telhas' && azul.cor === lib.paleta.telhas[4].hex && pxAzul[2] > pxAzul[0], `${JSON.stringify(azul)}, pixel ${pxAzul}`)
  await pagina.click('[data-modelo="madeira"]')
  const voltouPadrao = await pagina.evaluate(() => window.__telhado.tetos().casa)
  await pagina.click('#grupo-cor [aria-label="Verde"]')
  await pagina.evaluate(() => window.__telhado.avancar(16))
  const pxVerde = await pixelCasa()
  const verde = await pagina.evaluate(() => window.__telhado.tetos().casa)
  checar('trocar para Madeira leva à cor padrão dela; Verde pinta o telhado de verde', voltouPadrao.cor === lib.paleta.madeira[0].hex && verde.cor === lib.paleta.madeira[5].hex && pxVerde[1] > pxVerde[0] && pxVerde[1] > pxVerde[2], `pixel ${pxVerde}`)
  await pagina.evaluate(() => { const c = document.getElementById('cor-livre'); c.value = '#3f7fbf'; c.dispatchEvent(new Event('input', { bubbles: true })) })
  await pagina.evaluate(() => window.__telhado.avancar(16))
  const livre = await pagina.evaluate(() => ({ teto: window.__telhado.tetos().casa, nome: document.getElementById('nome-cor').textContent, ativo: document.getElementById('amostra-livre').dataset.ativo, marcadas: document.querySelectorAll('#grupo-cor [aria-checked="true"]').length }))
  const pxLivre = await pixelCasa()
  checar('"Outra cor…" aplica a cor livre e mostra o nome dela', livre.teto.cor === '#3f7fbf' && livre.ativo === 'true' && livre.marcadas === 0 && livre.nome.includes('#3f7fbf') && pxLivre[2] > pxLivre[0] + 30, `${livre.nome}, pixel ${pxLivre}`)
  await pagina.click('#grupo-cor [aria-label="Carvalho"]')
  await pagina.keyboard.press('ArrowRight')
  const peloTeclado = await pagina.evaluate(() => ({ cor: window.__telhado.tetos().casa.cor, foco: document.activeElement && document.activeElement.getAttribute('aria-label') }))
  checar('seta para a direita escolhe a próxima cor e leva o foco junto', peloTeclado.cor === lib.paleta.madeira[1].hex && peloTeclado.foco === lib.paleta.madeira[1].nome, JSON.stringify(peloTeclado))
  await pagina.evaluate(() => document.getElementById('cor-livre').click())
  const lembrada = await pagina.evaluate(() => window.__telhado.tetos().casa.cor)
  checar('tocar de novo em "Outra cor…" volta à última cor livre', lembrada === '#3f7fbf', lembrada)
  const outrasSalas = await pagina.evaluate(() => window.__telhado.tetos())
  checar('trocar o teto de uma casa não mexe nas outras', JSON.stringify(outrasSalas.sala) === JSON.stringify(tetosIniciais.sala) && JSON.stringify(outrasSalas.deposito) === JSON.stringify(tetosIniciais.deposito))

  // 12. Folha dos modelos: 2 modelos × 6 cores × (retângulo, L), no zoom normal do mapa (1 px = 1 px), sobre a grama.
  const folhaModelos = await pagina.evaluate(() => {
    const L = window.__telhado.lib
    const p = (x, y) => ({ x, y })
    const ret = [p(0, 0), p(200, 0), p(200, 160), p(0, 160)]
    const ele = [p(0, 0), p(200, 0), p(200, 80), p(120, 80), p(120, 200), p(0, 200)]
    const cena = (poligono, modelo, cor, escala) => {
      const img = L.pintarTelhado(poligono, modelo, cor, escala)
      const telhado = document.createElement('canvas')
      telhado.width = img.largura; telhado.height = img.altura
      telhado.getContext('2d').putImageData(new ImageData(img.pixels, img.largura, img.altura), 0, 0)
      const sombra = document.createElement('canvas')
      sombra.width = img.largura; sombra.height = img.altura
      const gs = sombra.getContext('2d')
      gs.drawImage(telhado, 0, 0); gs.globalCompositeOperation = 'source-in'; gs.fillStyle = '#0a0c06'; gs.fillRect(0, 0, img.largura, img.altura)
      const folga = Math.round(16 * escala)
      const c = document.createElement('canvas')
      c.width = img.largura + folga * 2; c.height = img.altura + folga * 2
      const g = c.getContext('2d')
      g.fillStyle = '#56693f'; g.fillRect(0, 0, c.width, c.height)
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1
      for (let x = 0; x < c.width; x += 40 * escala) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, c.height); g.stroke() }
      for (let y = 0; y < c.height; y += 40 * escala) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(c.width, y + 0.5); g.stroke() }
      g.globalAlpha = 0.32; g.drawImage(sombra, folga + 6 * escala, folga + 8 * escala)
      g.globalAlpha = 1; g.drawImage(telhado, folga, folga)
      return c.toDataURL('image/png')
    }
    const linhas = []
    for (let i = 0; i < 6; i += 1) {
      const t = L.PALETA_DO_TETO.telhas[i]
      const m = L.PALETA_DO_TETO.madeira[i]
      linhas.push({ telha: t, madeira: m, imagens: [cena(ret, 'telhas', t.hex, 1), cena(ele, 'telhas', t.hex, 1), cena(ret, 'madeira', m.hex, 1), cena(ele, 'madeira', m.hex, 1)] })
    }
    const zoom = [0.5, 1, 2].flatMap((z) => [
      { z, modelo: 'telhas', nome: L.PALETA_DO_TETO.telhas[0].nome, url: cena(ele, 'telhas', L.PALETA_DO_TETO.telhas[0].hex, z) },
      { z, modelo: 'madeira', nome: L.PALETA_DO_TETO.madeira[0].nome, url: cena(ele, 'madeira', L.PALETA_DO_TETO.madeira[0].hex, z) },
    ])
    return { linhas, zoom }
  })
  const paginaModelos = await contexto.newPage()
  await paginaModelos.setViewportSize({ width: 1100, height: 900 })
  const legenda = (c) => `<figcaption style="padding-top:4px">${c.nome} <span style="color:#8a8f88;font-variant-numeric:tabular-nums">${c.hex}</span></figcaption>`
  await paginaModelos.setContent(`<!doctype html><html><body style="margin:0;background:#111;color:#ddd;font:13px system-ui">
    <div style="padding:14px 16px 4px;font-weight:600">Telhas e madeira, 6 cores cada, retângulo (4 águas) e L (águas calculadas) — zoom normal do mapa, casa de 40 px</div>
    <div style="display:grid;grid-template-columns:repeat(4,auto);gap:10px 14px;padding:8px 16px 16px;justify-content:start">
      <div style="font-weight:600">Telhas · retângulo</div><div style="font-weight:600">Telhas · L</div><div style="font-weight:600">Madeira · retângulo</div><div style="font-weight:600">Madeira · L</div>
      ${folhaModelos.linhas.map((l) => l.imagens.map((url, i) => `<figure style="margin:0"><img src="${url}" style="display:block;border-radius:4px">${legenda(i < 2 ? l.telha : l.madeira)}</figure>`).join('')).join('')}
    </div></body></html>`)
  await paginaModelos.screenshot({ path: path.join(PASTA, 'folha-modelos.png'), fullPage: true })
  await paginaModelos.setContent(`<!doctype html><html><body style="margin:0;background:#111;color:#ddd;font:13px system-ui">
    <div style="padding:14px 16px 4px;font-weight:600">A casa em L em 3 zooms (a imagem é gerada na escala do zoom, como o app vai fazer)</div>
    <div style="display:grid;grid-template-columns:repeat(2,auto);gap:10px 18px;padding:8px 16px 16px;justify-content:start;align-items:end">
      ${folhaModelos.zoom.map((q) => `<figure style="margin:0"><img src="${q.url}" style="display:block;border-radius:4px;width:${q.z === 2 ? 'auto' : 'auto'}"><figcaption style="padding-top:4px">${q.modelo === 'telhas' ? 'Telhas' : 'Madeira'} ${q.nome} · zoom ${q.z * 100}%</figcaption></figure>`).join('')}
    </div></body></html>`)
  await paginaModelos.screenshot({ path: path.join(PASTA, 'folha-zoom.png'), fullPage: true })
  await paginaModelos.close()

  // 13. Tempo de gerar cada telhado: sala de 1024 × 1024 no zoom normal, 3 formas × 2 modelos, mediana de 5.
  const geracao = await pagina.evaluate(() => {
    const L = window.__telhado.lib
    const p = (x, y) => ({ x, y })
    const formas = {
      retângulo: [p(0, 0), p(1024, 0), p(1024, 1024), p(0, 1024)],
      L: [p(0, 0), p(1024, 0), p(1024, 400), p(400, 400), p(400, 1024), p(0, 1024)],
      octógono: Array.from({ length: 8 }, (_, i) => { const a = (Math.PI / 4) * i + Math.PI / 8; return p(512 + Math.cos(a) * 512, 512 + Math.sin(a) * 512) }),
    }
    const medidas = []
    for (const [forma, poligono] of Object.entries(formas)) {
      for (const modelo of ['telhas', 'madeira']) {
        const cor = L.corPadraoDoModelo(modelo)
        L.pintarTelhado(poligono, modelo, cor, 1)
        const tempos = []
        for (let i = 0; i < 5; i += 1) { const t0 = performance.now(); L.pintarTelhado(poligono, modelo, cor, 1); tempos.push(performance.now() - t0) }
        tempos.sort((a, b) => a - b)
        medidas.push({ forma, modelo, mediana: tempos[2], pior: tempos[4] })
      }
    }
    return medidas
  })
  const piorMediana = Math.max(...geracao.map((g) => g.mediana))
  checar(`gerar o telhado de uma sala de 1024 × 1024 em até ${GERAR_MAX_MS} ms`, piorMediana <= GERAR_MAX_MS, geracao.map((g) => `${g.forma} ${g.modelo} ${g.mediana.toFixed(1)} ms`).join(', '))
  const geracaoNoMapa = await pagina.evaluate(() => window.__telhado.temposDeGeracao())

  // 14. Travada trocando de cor andando: relógio de verdade, uma troca a cada 250 ms pelas 3 casas e 12 cores.
  const trocando = await pagina.evaluate(async (paleta) => {
    const T = window.__telhado
    T.soltarRelogio()
    T.teleportar(5, 10)
    const trocas = []
    for (let i = 0; i < 24; i += 1) {
      const modelo = i % 2 ? 'madeira' : 'telhas'
      trocas.push([['sala', 'deposito', 'casa'][i % 3], modelo, paleta[modelo][Math.floor(i / 2) % 6].hex])
    }
    const longas = []
    let obs = null
    try {
      obs = new PerformanceObserver((l) => l.getEntries().forEach((e) => longas.push(e.duration)))
      obs.observe({ type: 'longtask', buffered: false })
    } catch {}
    const tempos = []
    const custos = []
    let anterior = performance.now()
    const inicio = anterior
    let proxima = 0
    await new Promise((resolve) => {
      function f(t) {
        tempos.push(t - anterior); anterior = t
        if (proxima < trocas.length && t - inicio >= proxima * 250) { custos.push(T.definirTeto(...trocas[proxima])); proxima += 1 }
        const a = T.amostra()
        if (a.casa[0] === 5 && a.casa[1] === 10) T.irPara(12, 10)
        if (a.casa[0] === 12 && a.casa[1] === 10) T.irPara(5, 10)
        if (proxima < trocas.length || t - inicio < trocas.length * 250 + 300) requestAnimationFrame(f); else resolve()
      }
      requestAnimationFrame(f)
    })
    if (obs) obs.disconnect()
    const ordenado = tempos.slice(1).sort((a, b) => a - b)
    return { p95: ordenado[Math.floor(ordenado.length * 0.95)], maiorQuadro: ordenado[ordenado.length - 1], quadros: ordenado.length, maiorTarefaLonga: longas.length ? Math.max(...longas) : 0, maiorTroca: Math.max(...custos), trocas: custos.length }
  }, lib.paleta)
  checar(`trocando de cor andando: nenhuma tarefa longa >= ${TAREFA_LONGA_MS} ms`, trocando.maiorTarefaLonga < TAREFA_LONGA_MS, `maior ${trocando.maiorTarefaLonga.toFixed(0)} ms; maior quadro ${trocando.maiorQuadro.toFixed(1)} ms; troca mais cara ${trocando.maiorTroca.toFixed(1)} ms`)
  checar(`trocando de cor andando: quadro p95 <= ${P95_MAX_MS} ms`, trocando.p95 <= P95_MAX_MS, `p95 ${trocando.p95.toFixed(1)} ms em ${trocando.quadros} quadros, ${trocando.trocas} trocas`)
  // Volta cada casa ao teto do começo, para os prints.
  await pagina.evaluate((t) => { const T = window.__telhado; for (const [id, v] of Object.entries(t)) T.definirTeto(id, v.modelo, v.cor) }, tetosIniciais)
  await pagina.click('[data-casa="sala"]')
  await pagina.mouse.move(0, 0)
  await pagina.waitForTimeout(300) // os botões terminam a transição de cor antes do print

  // 10. Prints só de layout: desktop de fora, celular de dentro, desktop escuro na visão do mestre.
  await pagina.evaluate(() => { const T = window.__telhado; T.congelarRelogio(0); T.teleportar(5, 10); T.definirVisao('jogador'); T.avancar(16) })
  await pagina.screenshot({ path: path.join(PASTA, 'desktop-1440-fora.png'), fullPage: true })

  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const paginaCelular = await celular.newPage()
  await paginaCelular.goto(url)
  await paginaCelular.evaluate(() => document.fonts.ready)
  await paginaCelular.waitForFunction(() => !!window.__telhado)
  await paginaCelular.evaluate(() => { const T = window.__telhado; T.congelarRelogio(0); T.teleportar(5, 5); T.avancar(400) })
  const largura = await paginaCelular.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth }))
  checar('celular 390 px sem rolagem para o lado', largura.doc <= largura.janela, `${largura.doc} <= ${largura.janela}`)
  await paginaCelular.screenshot({ path: path.join(PASTA, 'celular-390-dentro.png'), fullPage: true })
  await celular.close()

  const escuro = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'dark' })
  const paginaEscura = await escuro.newPage()
  await paginaEscura.goto(url)
  await paginaEscura.evaluate(() => document.fonts.ready)
  await paginaEscura.waitForFunction(() => !!window.__telhado)
  await paginaEscura.evaluate(() => { const T = window.__telhado; T.congelarRelogio(0); T.teleportar(5, 10); T.definirVisao('mestre'); T.avancar(16) })
  await paginaEscura.locator('.palco').screenshot({ path: path.join(PASTA, 'mestre-escuro-1440.png') })
  await escuro.close()

  checar('sem erro no console', errosConsole.length === 0, errosConsole.join(' | '))

  await navegador.close()
  fs.writeFileSync(path.join(PASTA, 'testes.json'), JSON.stringify({ geradoEm: new Date().toISOString(), resultados, desempenho, geracao, geracaoNoMapa, trocando }, null, 2))
  const falhas = resultados.filter((r) => !r.ok).length
  console.log(`\n${resultados.length - falhas} de ${resultados.length} testes passaram`)
  process.exitCode = falhas ? 1 : 0
}

main().catch((e) => { console.error(e); process.exitCode = 1 })
