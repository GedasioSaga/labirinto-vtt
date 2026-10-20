// Provas do protótipo dos objetos com textura: tempos, toda combinação desenha,
// a troca de desenho pega todos, controles de verdade, travada, celular e as folhas.
// Rodar da raiz do repo: node docs/design/objetos/provas/gerar-provas.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { chromium } = require('playwright')

const PASTA = __dirname
const PROTOTIPO = path.join(PASTA, '..', 'prototipo')
const PAGINA_TESTE = path.join(os.tmpdir(), 'objetos-pagina-de-teste.html')

const PRIMEIRA_PINTURA_MAX_MS = 300
const GERAR_MAX_MS = 50
const TAREFA_LONGA_MS = 200
const P95_QUADRO_MAX_MS = 17
/** Cor contida: 95% dos pixels de cada móvel com saturação até 0,62 (o chão do app, #a8776a, tem 0,37; carvalho 0,49). */
const SATURACAO_MAX = 0.62
/** Cobertura mínima: a parte opaca do desenho cobre pelo menos isto da pegada do móvel. */
const COBERTURA_MIN = 0.2

function montarPaginaDeTeste() {
  require(path.join(PROTOTIPO, 'montar.cjs'))
  const corpo = fs.readFileSync(path.join(PROTOTIPO, 'index.html'), 'utf8')
  // Mesmo esqueleto que o Artifact põe em volta da página.
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>${corpo}</body></html>`
  fs.writeFileSync(PAGINA_TESTE, html)
  return pathToFileURL(PAGINA_TESTE).href
}

// O Playwright do repo às vezes pede um Chromium que não foi baixado; usa o mais novo que existir.
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
  resultados.push({ n: resultados.length + 1, nome, ok: !!ok, detalhe })
  console.log(`${String(resultados.length).padStart(2)} ${ok ? 'OK   ' : 'FALHA'} ${nome}${detalhe ? ' — ' + detalhe : ''}`)
}

const p95 = (lista) => {
  if (!lista.length) return 0
  const o = [...lista].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.floor(o.length * 0.95))]
}
const r1 = (x) => Math.round(x * 10) / 10
const diferenca = (a, b) => (a && b ? Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) : 0)

/** Grava tarefas longas desde a abertura da página. */
const OBSERVAR_TAREFAS = () => {
  window.__tarefasLongas = []
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__tarefasLongas.push(Math.round(e.duration))
    }).observe({ type: 'longtask', buffered: true })
  } catch (e) { /* sem longtask no navegador: a lista fica vazia e a prova diz */ }
}

async function abrir(contexto, url, erros) {
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => erros.push(String(e)))
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  await pagina.addInitScript(OBSERVAR_TAREFAS)
  await pagina.goto(url)
  await pagina.waitForFunction(() => window.__objetos && window.__objetos.primeiraPintura !== null)
  return pagina
}

const esperarQuadro = (pagina) => pagina.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))

let navegadorAberto = null
const T_INICIO = Date.now()
const marcar = (o) => console.log(`   [${((Date.now() - T_INICIO) / 1000).toFixed(1)} s] ${o}`)

async function main() {
  const url = montarPaginaDeTeste()
  const navegador = await chromium.launch(opcoesDoNavegador())
  navegadorAberto = navegador
  const erros = []

  // ---------- computador, 1440 ----------
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'light' })
  const pagina = await abrir(contexto, url, erros)
  const inicio = await pagina.evaluate(() => ({
    script: window.__objetos.primeiraPintura,
    abertura: window.__objetos.primeiraPinturaDesdeAbertura,
    chegada: performance.getEntriesByType('navigation')[0].responseEnd,
    tempos: window.__objetos.tempos(),
    S: window.__objetos.resolucaoAtual,
  }))
  // Espera a sala ficar nítida e o outro desenho ficar pronto em segundo plano.
  await pagina.waitForFunction(() => window.__objetos.filaPendente === 0 && window.__objetos.salaNitida !== null, null, { timeout: 30000 })
  inicio.nitida = await pagina.evaluate(() => window.__objetos.salaNitida)
  inicio.desdeOHtml = inicio.abertura - inicio.chegada
  checar('Primeira pintura da sala inteira (computador, tela 1x), desde que o HTML chegou', inicio.desdeOHtml <= PRIMEIRA_PINTURA_MAX_MS,
    `${r1(inicio.desdeOHtml)} ms desde que o HTML chegou (${r1(inicio.script)} ms desde o script; ${r1(inicio.abertura)} ms desde o pedido da página, com ${r1(inicio.chegada)} ms de abrir o navegador frio e ler o arquivo); tudo em 1x na primeira pintura, nítida (${inicio.S}x) ${r1(inicio.nitida - inicio.chegada)} ms depois que o HTML chegou; meta ≤ ${PRIMEIRA_PINTURA_MAX_MS} ms`)

  // Todas as combinações: tempo, cobertura, cor.
  const combinacoes = await pagina.evaluate(() => window.__objetos.combinacoes())
  const medidas = []
  for (const S of [2, 3]) {
    for (const def of combinacoes) {
      const m = await pagina.evaluate(({ def, S }) => window.__objetos.gerar(def, S), { def, S })
      medidas.push({ S, def, ...m })
    }
  }
  const nome = (d) => [d.tipo, d.estilo, d.vista, d.forma !== 'retangular' ? d.forma : '', d.curva ? `curva ${d.curva}` : '', Object.values(d.materiais).join('+')].filter(Boolean).join(' ')
  for (const S of [2, 3]) {
    const doS = medidas.filter((m) => m.S === S)
    const pior = doS.reduce((a, b) => (b.ms > a.ms ? b : a))
    checar(`Cada imagem gerada em até ${GERAR_MAX_MS} ms, a ${S} px por px do mapa (${S === 2 ? 'zoom até 133% na tela comum' : 'zoom maior e tela 2x'})`, pior.ms <= GERAR_MAX_MS,
      `${doS.length} imagens; mais lenta ${r1(pior.ms)} ms (${nome(pior.def)}); p95 ${r1(p95(doS.map((m) => m.ms)))} ms`)
  }
  const vazias = medidas.filter((m) => m.S === 2 && (m.opacos === 0 || m.cobertura < COBERTURA_MIN))
  const menor = medidas.filter((m) => m.S === 2).reduce((a, b) => (b.cobertura < a.cobertura ? b : a))
  checar('Toda combinação objeto × material × desenho × vista × forma desenha algo', vazias.length === 0,
    `${combinacoes.length} combinações; menor cobertura ${Math.round(menor.cobertura * 100)}% da pegada (${nome(menor.def)}); ${vazias.length} abaixo de ${COBERTURA_MIN * 100}%`)
  const coloridas = medidas.filter((m) => m.S === 2 && m.def.tipo !== 'fogueira' && m.sat95 > SATURACAO_MAX)
  const maisSat = medidas.filter((m) => m.S === 2 && m.def.tipo !== 'fogueira').reduce((a, b) => (b.sat95 > a.sat95 ? b : a))
  const fogo = medidas.filter((m) => m.S === 2 && m.def.tipo === 'fogueira').reduce((a, b) => (b.sat95 > a.sat95 ? b : a))
  checar(`Cor contida: em cada móvel, 95% dos pixels com saturação até ${SATURACAO_MAX}`, coloridas.length === 0,
    `mais saturado ${maisSat.sat95.toFixed(2)} (${nome(maisSat.def)}); ${coloridas.length} acima. Fogueira fora da regra (brasa e chama): ${fogo.sat95.toFixed(2)}`)
  const escuras = medidas.filter((m) => m.S === 2 && m.lumMedia < 0.12)
  const maisEscura = medidas.filter((m) => m.S === 2).reduce((a, b) => (b.lumMedia < a.lumMedia ? b : a))
  checar('Nenhum móvel some de tão escuro (brilho médio ≥ 0,12)', escuras.length === 0,
    `mais escuro ${maisEscura.lumMedia.toFixed(2)} (${nome(maisEscura.def)})`)

  marcar("controles")
  // Clique no mapa escolhe o objeto; clique no chão fecha.
  const caixaMapa = await pagina.locator('#mapa').boundingBox()
  const naTela = (id) => pagina.evaluate((id) => window.__objetos.ondeNaTela(id), id)
  const pMesa = await naTela('mesa')
  await pagina.mouse.click(caixaMapa.x + pMesa.x, caixaMapa.y + pMesa.y)
  const escolheuMesa = await pagina.evaluate(() => window.__objetos.estado().selecionado)
  const tituloMesa = await pagina.locator('#painel-titulo').textContent()
  const pChao = await pagina.evaluate(() => {
    const e = window.__objetos.estado()
    return { x: e.panX + 6.5 * 56 * e.zoom, y: e.panY + 6.5 * 56 * e.zoom }
  })
  await pagina.mouse.click(caixaMapa.x + pChao.x, caixaMapa.y + pChao.y)
  const depoisDoChao = await pagina.evaluate(() => window.__objetos.estado().selecionado)
  checar('Clicar no móvel no mapa abre o painel dele; clicar no chão fecha', escolheuMesa === 'mesa' && tituloMesa === 'Mesa' && depoisDoChao === null,
    `clique na mesa: ${escolheuMesa} ("${tituloMesa}"); clique no chão: ${depoisDoChao}`)

  // Material: clicar na amostra muda o móvel no mapa, nos 11 do catálogo.
  const trocas = []
  const ids = await pagina.$$eval('.cartao', (bs) => bs.map((b) => b.dataset.id))
  for (const id of ids) {
    await pagina.click(`.cartao[data-id="${id}"]`)
    const antes = await pagina.evaluate((id) => ({ cor: window.__objetos.corNoMapa(id), obj: window.__objetos.objetos().find((o) => o.id === id) }), id)
    const grupo = pagina.locator('#ranhuras .amostras').first()
    const ranhura = await grupo.getAttribute('data-ranhura')
    const alvo = grupo.locator('.amostra[aria-checked="false"]').first()
    const mat = await alvo.getAttribute('data-mat')
    await alvo.click()
    const depois = await pagina.evaluate((id) => ({ cor: window.__objetos.corNoMapa(id), obj: window.__objetos.objetos().find((o) => o.id === id) }), id)
    const rotulo = await pagina.locator(`#rotulo-${ranhura} output`).textContent()
    const cartao = await pagina.locator(`.cartao[data-id="${id}"] .cartao-mat`).textContent()
    trocas.push({ id, ranhura, mat, ok: depois.obj.materiais[ranhura] === mat && depois.obj.desenhado !== antes.obj.desenhado && diferenca(antes.cor, depois.cor) > 0.5 && cartao.includes(rotulo), dif: diferenca(antes.cor, depois.cor) })
  }
  const falhas = trocas.filter((t) => !t.ok)
  checar('Clicar numa amostra de material troca o móvel no mapa, o rótulo e o cartão (11 de 11)', falhas.length === 0,
    `${trocas.length - falhas.length}/${trocas.length}; menor mudança de cor média ${r1(Math.min(...trocas.map((t) => t.dif)))}${falhas.length ? '; falhou: ' + falhas.map((f) => f.id).join(', ') : ''}`)

  // Setas no grupo de amostras trocam o material (um ponto de parada do Tab só).
  await pagina.click('.cartao[data-id="barril"]')
  const antesSeta = await pagina.evaluate(() => window.__objetos.objetos().find((o) => o.id === 'barril').materiais.madeira)
  await pagina.locator('#ranhuras .amostras').first().locator('.amostra[aria-checked="true"]').focus()
  await pagina.keyboard.press('ArrowRight')
  const depoisSeta = await pagina.evaluate(() => window.__objetos.objetos().find((o) => o.id === 'barril').materiais.madeira)
  const paradas = await pagina.$$eval('#ranhuras .amostras', (gs) => gs.map((g) => [...g.querySelectorAll('.amostra')].filter((b) => b.tabIndex === 0).length))
  checar('Seta para a direita no grupo de amostras troca o material; cada grupo tem uma parada de Tab só', antesSeta !== depoisSeta && paradas.every((n) => n === 1),
    `madeira do barril: ${antesSeta} para ${depoisSeta}; paradas por grupo: ${paradas.join(', ')}`)

  // Vista Frente/Lado, forma do tapete e curva da cerca: as opções de hoje continuam e mudam o desenho.
  await pagina.click('.cartao[data-id="cadeira"]')
  await pagina.click('#grupo-vista [data-valor="lado"]')
  const cadeira = await pagina.evaluate(() => window.__objetos.objetos().find((o) => o.id === 'cadeira'))
  await pagina.click('.cartao[data-id="tapete"]')
  await pagina.click('#grupo-forma [data-valor="redondo"]')
  const tapete = await pagina.evaluate(() => window.__objetos.objetos().find((o) => o.id === 'tapete'))
  await pagina.click('.cartao[data-id="cerca"]')
  await pagina.evaluate(() => {
    const r = document.getElementById('curva')
    r.value = '90'
    r.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await esperarQuadro(pagina)
  const cerca = await pagina.evaluate(() => window.__objetos.objetos().find((o) => o.id === 'cerca'))
  const comVista = await pagina.evaluate(async () => {
    const tipos = ['cadeira', 'bau', 'armario', 'aparador', 'fogueira', 'tapete']
    return tipos.filter((t) => {
      document.querySelector(`.cartao[data-id="${t}"]`).click()
      return !!document.querySelector('#grupo-vista [data-valor="lado"]')
    })
  })
  checar('Vista Frente/Lado (6 tipos), tapete redondo e curva da cerca continuam e mudam o desenho',
    cadeira.vista === 'lado' && cadeira.altura === 42 && cadeira.desenhado.includes('|lado|') && tapete.forma === 'redondo' && tapete.largura === 112 && tapete.desenhado.includes('|redondo|') && cerca.curva === 90 && cerca.desenhado.includes('|90|') && comVista.length === 6,
    `cadeira de lado ${cadeira.largura}×${cadeira.altura} px; tapete ${tapete.forma} ${tapete.largura}×${tapete.altura}; cerca curva ${cerca.curva}°; Vista aparece em ${comVista.length}/6 (${comVista.join(', ')})`)

  // Troca de desenho: todos os móveis passam para o 3/4 (e voltam), pelo botão de verdade.
  await pagina.evaluate(() => window.__objetos.enquadrar())
  const coresCima = await pagina.evaluate(() => Object.fromEntries(window.__objetos.objetos().map((o) => [o.id, window.__objetos.corNoMapa(o.id)])))
  const t34 = Date.now()
  await pagina.click('#grupo-estilo [data-estilo="34"]')
  const msTroca = Date.now() - t34
  const em34 = await pagina.evaluate(() => window.__objetos.objetos().map((o) => ({ id: o.id, desenhado: o.desenhado, cor: window.__objetos.corNoMapa(o.id) })))
  const naoTrocou = em34.filter((o) => !o.desenhado.includes('|34|') || diferenca(o.cor, coresCima[o.id]) <= 0.3)
  await pagina.click('#grupo-estilo [data-estilo="cima"]')
  const deVolta = await pagina.evaluate(() => window.__objetos.objetos().filter((o) => !o.desenhado.includes('|cima|')).length)
  checar('O botão 3/4 troca o desenho dos 12 móveis da sala; De cima volta todos', naoTrocou.length === 0 && deVolta === 0,
    `${em34.length - naoTrocou.length}/${em34.length} trocaram (clique a imagem pronta: ${msTroca} ms com a ida e volta do Playwright); ${deVolta} ficaram no 3/4 na volta${naoTrocou.length ? '; não trocou: ' + naoTrocou.map((o) => o.id).join(', ') : ''}`)

  // Teclado: Enter no cartão abre e põe o foco no título; Esc fecha e devolve o foco ao cartão.
  await pagina.evaluate(() => window.__objetos.fechar())
  await pagina.locator('.cartao[data-id="bau"]').focus()
  await pagina.keyboard.press('Enter')
  const focoAberto = await pagina.evaluate(() => document.activeElement && document.activeElement.id)
  await pagina.keyboard.press('Escape')
  const focoFechado = await pagina.evaluate(() => ({ id: document.activeElement && document.activeElement.dataset && document.activeElement.dataset.id, aberto: document.getElementById('painel').dataset.aberto }))
  checar('Enter no cartão abre o painel com foco no título; Esc fecha e o foco volta ao cartão', focoAberto === 'painel-titulo' && focoFechado.id === 'bau' && focoFechado.aberto === 'false',
    `foco ao abrir: ${focoAberto}; depois do Esc: cartão ${focoFechado.id}, painel aberto=${focoFechado.aberto}`)

  // Travada andando e dando zoom com o mouse de verdade (roda e arrasto), nos dois desenhos.
  const quadros = []
  for (const estilo of ['cima', '34']) {
    await pagina.click(`#grupo-estilo [data-estilo="${estilo}"]`)
    await pagina.evaluate(() => {
      window.__intervalos = []
      window.__gravando = true
      let antes = performance.now()
      const passo = (agora) => {
        window.__intervalos.push(agora - antes)
        antes = agora
        if (window.__gravando) requestAnimationFrame(passo)
      }
      requestAnimationFrame(passo)
    })
    const n0 = (await pagina.evaluate(() => window.__objetos.duracoes())).length
    const cx = caixaMapa.x + caixaMapa.width / 2
    const cy = caixaMapa.y + caixaMapa.height / 2
    await pagina.mouse.move(cx, cy)
    for (let i = 0; i < 24; i += 1) {
      await pagina.mouse.wheel(0, i < 12 ? -60 : 60)
      await pagina.waitForTimeout(16)
    }
    await pagina.mouse.down()
    for (let i = 0; i < 50; i += 1) {
      await pagina.mouse.move(cx + Math.sin(i / 8) * 160, cy + Math.cos(i / 10) * 90)
      await pagina.waitForTimeout(16)
    }
    await pagina.mouse.up()
    const r = await pagina.evaluate((n0) => {
      window.__gravando = false
      return { intervalos: window.__intervalos.slice(2), duracoes: window.__objetos.duracoes().slice(n0) }
    }, n0)
    quadros.push({ estilo, ...r })
  }
  const todosDesenhos = quadros.flatMap((q) => q.duracoes)
  const todosIntervalos = quadros.flatMap((q) => q.intervalos)
  checar(`p95 do quadro ≤ ${P95_QUADRO_MAX_MS} ms andando e dando zoom (roda + arrasto, nos dois desenhos)`, p95(todosDesenhos) <= P95_QUADRO_MAX_MS && p95(todosIntervalos) <= P95_QUADRO_MAX_MS + 0.5,
    `desenhar o mapa: p95 ${r1(p95(todosDesenhos))} ms, pior ${r1(Math.max(...todosDesenhos))} ms em ${todosDesenhos.length} quadros; intervalo entre quadros: p95 ${r1(p95(todosIntervalos))} ms`)

  const longasPc = await pagina.evaluate(() => window.__tarefasLongas)
  // Print do computador numa página nova: a sala como abre, a cama escolhida com um clique no mapa.
  const limpa = await abrir(contexto, url, erros)
  await limpa.waitForFunction(() => window.__objetos.filaPendente === 0, null, { timeout: 30000 })
  const caixaLimpa = await limpa.locator('#mapa').boundingBox()
  const pCama = await limpa.evaluate(() => window.__objetos.ondeNaTela('cama'))
  await limpa.mouse.click(caixaLimpa.x + pCama.x, caixaLimpa.y + pCama.y + 12)
  await esperarQuadro(limpa)
  await limpa.screenshot({ path: path.join(PASTA, 'desktop-1440.png'), fullPage: true })
  longasPc.push(...(await limpa.evaluate(() => window.__tarefasLongas)))

  marcar("folhas")
  // ---------- folhas ----------
  const ESCALA_FOLHA = 2
  const G = 56
  const def = (tipo, estilo, extra = {}) => {
    const o = { tipo, estilo, vista: 'frente', forma: 'retangular', curva: 0, materiais: {}, ...extra }
    const tam = { barril: [0.7, 0.7], caixa: [0.8, 0.8], bau: [1, 0.6], catre: [1, 2], mesa: [2, 1], cadeira: [0.5, 0.5], cerca: [2, 0.25], armario: [1, 0.5], aparador: [2, 0.5], fogueira: [1, 1] }
    const lado = { bau: [0.6, 0.6], cadeira: [0.5, 0.75], armario: [1, 1.5], aparador: [2, 0.9], fogueira: [1, 1.25] }
    let t = o.vista === 'lado' ? lado[tipo] : tam[tipo]
    if (tipo === 'tapete') t = o.forma === 'redondo' ? (o.vista === 'lado' ? [2, 0.25] : [2, 2]) : (o.vista === 'lado' ? [3, 0.25] : [3, 2])
    o.largura = (o.casas || t[0]) * G
    o.altura = t[1] * G
    o.chao = tipo === 'fogueira' || tipo === 'cerca' ? '#857655' : '#a8776a'
    return o
  }
  const linhas = [
    ['Barril', 'barril'], ['Caixa', 'caixa'], ['Baú', 'bau', true], ['Cama', 'catre'], ['Mesa', 'mesa'], ['Cadeira', 'cadeira', true],
    ['Cerca', 'cerca'], ['Cerca curva (150°)', 'cerca', false, { casas: 3, curva: 150, materiais: { madeira: 'pinho', ligacao: 'corda' } }],
    ['Armário de cozinha', 'armario', true], ['Aparador', 'aparador', true], ['Fogueira', 'fogueira', true], ['Tapete', 'tapete', true], ['Tapete redondo', 'tapete', true, { forma: 'redondo' }],
  ]
  const celulas = []
  for (const [rotulo, tipo, temLado, extra] of linhas) {
    const defs = [def(tipo, 'cima', extra), def(tipo, '34', extra)]
    if (temLado) defs.push(def(tipo, 'cima', { ...extra, vista: 'lado' }), def(tipo, '34', { ...extra, vista: 'lado' }))
    const imgs = await pagina.evaluate(({ defs, e }) => window.__objetos.ladrilhos(defs, e), { defs, e: ESCALA_FOLHA })
    celulas.push({ rotulo, imgs })
  }
  const estiloFolha = 'body{margin:0;background:#2b2b2b;color:#ece6da;font:14px/1.3 system-ui,sans-serif;padding:20px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 14px;color:#b9b2a5}table{border-collapse:collapse}td,th{padding:8px 10px;vertical-align:middle;text-align:left;border-top:1px solid #3c3c3c}th{font-weight:600;color:#cfc8ba;font-size:13px}td.n{font-weight:600;white-space:nowrap}img{display:block}figure{margin:0}figcaption{font-size:11px;color:#b9b2a5;margin-top:3px;max-width:150px}.lin{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:flex-end}.grupo{color:#cfc8ba;font-size:12px;margin:2px 0 4px}'
  const folha = await contexto.newPage()
  await folha.setContent(`<!doctype html><html><head><style>${estiloFolha}</style></head><body><h1>Folha de contato: os 11 móveis nos dois desenhos</h1><p>Zoom 200%, materiais padrão. De cima com volume e 3/4; à direita, a vista Lado dos 6 tipos que têm.</p><table><tr><th></th><th>De cima</th><th>3/4</th><th>Lado, de cima</th><th>Lado, 3/4</th></tr>${celulas.map((c) => `<tr><td class="n">${c.rotulo}</td>${[0, 1, 2, 3].map((i) => `<td>${c.imgs[i] ? `<img src="${c.imgs[i]}">` : ''}</td>`).join('')}</tr>`).join('')}</table></body></html>`)
  await folha.waitForFunction(() => [...document.images].every((i) => i.complete))
  await folha.screenshot({ path: path.join(PASTA, 'folha-contato.png'), fullPage: true })

  // Folha de materiais: cada móvel com cada material de cada escolha (as outras no padrão), de cima, zoom 125%.
  const ranhuras = await pagina.evaluate(() => {
    const R = Objetos.RANURAS
    return Object.fromEntries(Object.keys(R).map((t) => [t, R[t].map((r) => ({ id: r.id, nome: r.nome, padrao: r.padrao, opcoes: r.opcoes.map((o) => [o, Objetos.MATERIAIS[o].nome]) }))]))
  })
  const blocos = []
  for (const [rotulo, tipo] of linhas.filter((l) => !l[3])) {
    const grupos = []
    for (const r of ranhuras[tipo]) {
      const padrao = Object.fromEntries(ranhuras[tipo].map((x) => [x.id, x.padrao]))
      const defs = r.opcoes.map(([o]) => def(tipo, 'cima', { materiais: { ...padrao, [r.id]: o } }))
      const imgs = await pagina.evaluate(({ defs }) => window.__objetos.ladrilhos(defs, 1.25), { defs })
      grupos.push({ nome: r.nome, itens: r.opcoes.map(([, n], i) => ({ n, img: imgs[i] })) })
    }
    blocos.push({ rotulo, grupos })
  }
  await folha.setContent(`<!doctype html><html><head><style>${estiloFolha}</style></head><body><h1>Folha de materiais</h1><p>Cada escolha de material de cada móvel, as outras no padrão. De cima com volume, zoom 125%.</p><table>${blocos.map((b) => `<tr><td class="n">${b.rotulo}</td><td>${b.grupos.map((g) => `<div class="grupo">${g.nome}</div><div class="lin">${g.itens.map((it) => `<figure><img src="${it.img}"><figcaption>${it.n}</figcaption></figure>`).join('')}</div>`).join('')}</td></tr>`).join('')}</table></body></html>`)
  await folha.waitForFunction(() => [...document.images].every((i) => i.complete))
  await folha.screenshot({ path: path.join(PASTA, 'folha-materiais.png'), fullPage: true })

  marcar("celular")
  // ---------- celular, 390 ----------
  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' })
  const pc = await abrir(celular, url, erros)
  await pc.waitForFunction(() => window.__objetos.salaNitida !== null, null, { timeout: 30000 })
  const inicioCel = await pc.evaluate(() => ({ abertura: window.__objetos.primeiraPinturaDesdeAbertura, chegada: performance.getEntriesByType('navigation')[0].responseEnd, nitida: window.__objetos.salaNitida, S: window.__objetos.resolucaoAtual }))
  inicioCel.desdeOHtml = inicioCel.abertura - inicioCel.chegada
  checar('Primeira pintura no celular (390 px, tela 2x), desde que o HTML chegou', inicioCel.desdeOHtml <= PRIMEIRA_PINTURA_MAX_MS,
    `${r1(inicioCel.desdeOHtml)} ms (${r1(inicioCel.abertura)} ms desde o pedido), tudo em 1x; nítida (${inicioCel.S}x) ${r1(inicioCel.nitida - inicioCel.chegada)} ms depois que o HTML chegou`)
  const larguras = await pc.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, tela: window.innerWidth }))
  checar('Sem rolagem para o lado no celular de 390 px', larguras.rolagem <= larguras.tela, `scrollWidth ${larguras.rolagem} para tela de ${larguras.tela}`)
  await pc.tap('#grupo-estilo [data-estilo="34"]')
  await pc.tap('.cartao[data-id="cama"]')
  await pc.waitForTimeout(900)
  const folhaAberta = await pc.evaluate(() => {
    const r = document.getElementById('painel').getBoundingClientRect()
    const m = document.getElementById('mapa').getBoundingClientRect()
    return { aberto: document.getElementById('painel').dataset.aberto, topo: Math.round(r.top), base: Math.round(r.bottom), tela: window.innerHeight, mapaTopo: Math.round(m.top), mapaBase: Math.round(m.bottom) }
  })
  await esperarQuadro(pc)
  await pc.screenshot({ path: path.join(PASTA, 'celular-390.png') })
  // Arrastar a alça para baixo fecha a folha.
  const alca = await pc.locator('#alca').boundingBox()
  await pc.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2)
  await pc.mouse.down()
  for (let i = 1; i <= 12; i += 1) await pc.mouse.move(alca.x + alca.width / 2, alca.y + alca.height / 2 + i * 20)
  await pc.mouse.up()
  await pc.waitForTimeout(400)
  const aposArrasto = await pc.evaluate(() => ({ aberto: document.getElementById('painel').dataset.aberto, inerte: document.getElementById('painel').inert, topo: Math.round(document.getElementById('painel').getBoundingClientRect().top) }))
  checar('Celular: tocar no cartão abre a folha de baixo com o mapa visível acima; arrastar a alça para baixo fecha',
    folhaAberta.aberto === 'true' && folhaAberta.topo < folhaAberta.tela && folhaAberta.mapaTopo >= 0 && folhaAberta.mapaBase <= folhaAberta.topo && folhaAberta.base <= folhaAberta.tela + 1 && aposArrasto.aberto === 'false' && aposArrasto.inerte === true && aposArrasto.topo >= folhaAberta.tela,
    `aberta: topo ${folhaAberta.topo} px de ${folhaAberta.tela}, mapa inteiro acima dela (${folhaAberta.mapaTopo} a ${folhaAberta.mapaBase} px); depois do arrasto: aberta=${aposArrasto.aberto}, inerte=${aposArrasto.inerte}, topo ${aposArrasto.topo} px`)
  const longasCel = await pc.evaluate(() => window.__tarefasLongas)

  // ---------- tema escuro ----------
  const escuro = await navegador.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, colorScheme: 'dark' })
  const pe = await abrir(escuro, url, erros)
  const temas = await pe.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.match(/\d+(\.\d+)?/g).map(Number)
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    }
    const fundo = lum(getComputedStyle(document.body).backgroundColor)
    const texto = lum(getComputedStyle(document.querySelector('h1') || document.body).color)
    document.documentElement.dataset.theme = 'light'
    const fundoClaro = lum(getComputedStyle(document.body).backgroundColor)
    return { fundo, texto, fundoClaro }
  })
  checar('Tema escuro do sistema troca o fundo e o texto; data-theme="light" força o claro', temas.fundo < 0.2 && temas.texto > 0.7 && temas.fundoClaro > 0.8,
    `brilho do fundo escuro ${temas.fundo.toFixed(2)}, do texto ${temas.texto.toFixed(2)}; com data-theme=light o fundo vai a ${temas.fundoClaro.toFixed(2)}`)
  const longasEsc = await pe.evaluate(() => window.__tarefasLongas)

  const longas = [...longasPc, ...longasCel, ...longasEsc]
  checar(`Nenhuma tarefa longa ≥ ${TAREFA_LONGA_MS} ms (abrir, tocar, trocar, andar e gerar todas as combinações)`, longas.every((d) => d < TAREFA_LONGA_MS),
    longas.length ? `tarefas acima de 50 ms: ${longas.length}, a maior ${Math.max(...longas)} ms` : 'nenhuma tarefa acima de 50 ms')
  checar('Nenhum erro no console', erros.length === 0, erros.length ? erros.slice(0, 3).join(' | ') : '0 erros nas 3 páginas')

  await navegador.close()
  fs.rmSync(PAGINA_TESTE, { force: true })
  const ok = resultados.filter((r) => r.ok).length
  fs.writeFileSync(path.join(PASTA, 'testes.json'), JSON.stringify({
    geradoEm: new Date().toISOString(),
    passou: ok,
    total: resultados.length,
    resultados,
    tempos: {
      primeiraPinturaComputadorMs: r1(inicio.desdeOHtml),
      primeiraPinturaComputadorDesdeOPedidoMs: r1(inicio.abertura),
      salaNitidaComputadorMs: r1(inicio.nitida - inicio.chegada),
      primeiraPinturaCelularMs: r1(inicioCel.desdeOHtml),
      salaNitidaCelularMs: r1(inicioCel.nitida - inicioCel.chegada),
      combinacoes: combinacoes.length,
      gerarS2: { piorMs: r1(Math.max(...medidas.filter((m) => m.S === 2).map((m) => m.ms))), p95Ms: r1(p95(medidas.filter((m) => m.S === 2).map((m) => m.ms))) },
      gerarS3: { piorMs: r1(Math.max(...medidas.filter((m) => m.S === 3).map((m) => m.ms))), p95Ms: r1(p95(medidas.filter((m) => m.S === 3).map((m) => m.ms))) },
      quadroP95Ms: r1(p95(todosDesenhos)),
      intervaloP95Ms: r1(p95(todosIntervalos)),
    },
    imagens: ['folha-contato.png', 'folha-materiais.png', 'desktop-1440.png', 'celular-390.png'],
  }, null, 2))
  console.log(`\n${ok}/${resultados.length} provas passaram`)
  process.exitCode = ok === resultados.length ? 0 : 1
}

main().catch(async (e) => {
  console.error(e)
  process.exitCode = 1
  if (navegadorAberto) await navegadorAberto.close().catch(() => {})
})
