// Provas do protótipo da vila: primeira pintura, robô que anda como gente até as 7 portas,
// tamanho e folga das portas, controles de verdade, travada, celular, mesma imagem e os prints.
// Rodar da raiz do repo: node docs/design/vila/provas/gerar-provas.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { chromium } = require('playwright')

const PASTA = __dirname
const PROTOTIPO = path.join(PASTA, '..', 'prototipo')
const PAGINA_TESTE = path.join(os.tmpdir(), 'vila-pagina-de-teste.html')

// Metas escritas antes de codar (pedido de 21/10/2026).
const PRIMEIRA_PINTURA_MAX_MS = 400
const P95_QUADRO_MAX_MS = 20
const TAREFA_LONGA_MS = 200
const PORTA_MIN = { menor: 18, maior: 24 }
const SEMENTES = [1, 2, 3, 4, 5]
const PECAS_MIN = 25
const PECAS_MAX = 35
/** O telhado some em 300 ms; com a folga de um quadro (60 Hz) para medir. */
const TELHADO_MAX_MS = 320

function montarPaginaDeTeste() {
  require(path.join(PROTOTIPO, 'montar.cjs')).montar()
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
const mediana = (lista) => {
  const o = [...lista].sort((a, b) => a - b)
  return o[Math.floor(o.length / 2)]
}
const r1 = (x) => Math.round(x * 10) / 10

const OBSERVAR_TAREFAS = () => {
  window.__tarefasLongas = []
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) window.__tarefasLongas.push(Math.round(e.duration))
    }).observe({ type: 'longtask', buffered: true })
  } catch (e) { /* sem longtask: a lista fica vazia e a prova diz */ }
}

async function abrir(contexto, url, erros) {
  const pagina = await contexto.newPage()
  pagina.on('pageerror', (e) => erros.push(String(e)))
  pagina.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()) })
  await pagina.addInitScript(OBSERVAR_TAREFAS)
  await pagina.goto(url)
  await pagina.waitForFunction(() => window.__vila && window.__vila.primeiraPintura !== null)
  return pagina
}
const esperarPronto = (pagina) => pagina.waitForFunction(() => window.__vila.pronto && window.__vila.fila() === 0, null, { timeout: 90000 })
const esperarQuadro = (pagina) => pagina.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))))

/** Impressão digital do canvas: muda se qualquer pixel amostrado mudar. */
const DIGITAL = () => {
  const c = document.querySelector('#mapa')
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let h = 2166136261
  for (let i = 0; i < d.length; i += 4 * 7) h = Math.imul(h ^ (d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7), 16777619)
  return h >>> 0
}
const digital = async (pagina) => {
  await esperarQuadro(pagina)
  return pagina.evaluate(DIGITAL)
}
/** Cor do pixel do canvas no ponto do mundo. */
const corNoMundo = (pagina, x, y) => pagina.evaluate(([x, y]) => {
  const [sx, sy] = window.__vila.paraTela(x, y)
  const dpr = window.devicePixelRatio || 1
  const d = document.querySelector('#mapa').getContext('2d').getImageData(Math.round(sx * dpr), Math.round(sy * dpr), 1, 1).data
  return { r: d[0], g: d[1], b: d[2] }
}, [x, y])
const hexRgb = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) })
const distCor = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b)

/** Põe o pino num ponto (só preparação; o que se prova vem depois, por tecla, clique ou toque). */
const porPino = (pagina, x, y) => pagina.evaluate(([x, y]) => {
  const v = window.__vila
  v.est.pino = [x, y]
  v.est.rota = null
  v.est.destino = null
  v.redesenhar()
}, [x, y])
const pino = (pagina) => pagina.evaluate(() => window.__vila.est.pino.slice())

async function segurar(pagina, tecla, ms) {
  await pagina.keyboard.down(tecla)
  await pagina.waitForTimeout(ms)
  await pagina.keyboard.up(tecla)
  await esperarQuadro(pagina)
}

let navegadorAberto = null

async function main() {
  const url = montarPaginaDeTeste()
  const navegador = await chromium.launch(opcoesDoNavegador())
  navegadorAberto = navegador
  const erros = []

  // ---------- computador, 1440, tela 1x ----------
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'light' })
  const pagina = await abrir(contexto, url, erros)
  const inicio = await pagina.evaluate(() => ({
    abertura: window.__vila.primeiraPinturaDesdeAbertura,
    script: window.__vila.primeiraPintura,
    chegada: performance.getEntriesByType('navigation')[0].responseEnd,
    tempos: window.__vila.tempos,
  }))
  const desdeOHtml = inicio.abertura - inicio.chegada
  checar('Primeira pintura do mapa inteiro (computador, tela 1x), desde que o HTML chegou', desdeOHtml <= PRIMEIRA_PINTURA_MAX_MS,
    `${r1(desdeOHtml)} ms (meta ≤ ${PRIMEIRA_PINTURA_MAX_MS}); etapas: ${Object.entries(inicio.tempos).map(([k, v]) => `${k} ${v}`).join(', ')} ms`)
  await esperarPronto(pagina)

  // contagem de peças
  const contagem = await pagina.evaluate(() => {
    const V = window.__vila.V
    const tipos = {}
    for (const p of V.PECAS) tipos[p.t] = (tipos[p.t] || 0) + 1
    return { n: V.PECAS.length, tipos, dentro: V.PECAS_DE_DENTRO.length, fora: V.ARVORES_DE_FORA.length, placas: V.PLACAS.length }
  })
  checar(`A praça tem entre ${PECAS_MIN} e ${PECAS_MAX} peças`, contagem.n >= PECAS_MIN && contagem.n <= PECAS_MAX,
    `${contagem.n} peças (${Object.entries(contagem.tipos).map(([k, v]) => `${v} ${k}`).join(', ')}); fora da conta: ${contagem.placas} placas de direção, ${contagem.fora} árvores fora do muro, ${contagem.dentro} móveis dentro das casas`)

  // portas: tamanho a 100% e nada na frente
  const portas = await pagina.evaluate(() => {
    const V = window.__vila.V
    const pecas = [...V.PECAS, ...V.PLACAS, ...V.ARVORES_DE_FORA, ...V.PECAS_DE_SEBE]
    const caixas = pecas.map((p) => {
      const img = V.imagemDaPeca(p, 1)
      return { t: p.t, x: p.x, y: p.y, b: [p.x + img.pecas[0], p.y + img.pecas[1], p.x + img.pecas[2], p.y + img.pecas[3]] }
    })
    const cruza = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
    const fisPecas = V.montarFisica(pecas.map(V.formaDaPeca).filter(Boolean))
    const M = V.MUNDO
    const linhas = [
      ...V.CASAS.map((c) => ({ nome: 'caminho da ' + c.nome, pts: V.caminhoDaPorta(c), meia: V.LARGURA_DO_CAMINHO / 2 })),
      ...V.ESTRADAS.flatMap((e) => [{ nome: e.nome + ' (dentro)', pts: e.dentro, meia: e.largura / 2 }, { nome: e.nome + ' (fora)', pts: e.fora, meia: e.largura / 2 }]),
    ]
    const bloqueios = []
    for (const l of linhas) {
      for (const [x, y] of V.amostrarLinha(l.pts, 3)) {
        if (x < M.x0 + l.meia || x > M.x1 - l.meia || y < M.y0 + l.meia || y > M.y1 - l.meia) continue
        if (V.folga(fisPecas, x, y, l.meia) < -0.01) {
          bloqueios.push(`${l.nome} em (${Math.round(x)}, ${Math.round(y)})`)
          break
        }
      }
    }
    return {
      casas: V.CASAS.map((c) => {
        const b = V.caixaDaPorta(c)
        const frente = [Math.min(c.porta[0], c.fora[0]) - 18, Math.min(c.porta[1], c.fora[1]) - 18, Math.max(c.porta[0], c.fora[0]) + 18, Math.max(c.porta[1], c.fora[1]) + 18]
        return {
          nome: c.nome, w: b[2] - b[0], h: b[3] - b[1],
          cobrem: caixas.filter((k) => cruza(k.b, [b[0] - 2, b[1] - 2, b[2] + 2, b[3] + 2]) || cruza(k.b, frente)).map((k) => `${k.t} (${k.x}, ${k.y})`),
        }
      }),
      bloqueios,
    }
  })
  const tamanhos = portas.casas.map((c) => ({ ...c, menor: Math.min(c.w, c.h), maior: Math.max(c.w, c.h) }))
  checar(`Cada porta tem pelo menos ${PORTA_MIN.menor} x ${PORTA_MIN.maior} px no zoom 100%`, tamanhos.every((c) => c.menor >= PORTA_MIN.menor && c.maior >= PORTA_MIN.maior),
    tamanhos.map((c) => `${c.nome} ${c.w} x ${c.h}`).join('; ') + ' (hoje: 5 x 5)')
  const cobertas = portas.casas.filter((c) => c.cobrem.length)
  checar('Nenhuma peça cobre a porta nem fica na frente dela (até 30 px para fora)', cobertas.length === 0,
    cobertas.length ? cobertas.map((c) => `${c.nome}: ${c.cobrem.join(', ')}`).join('; ') : '7 de 7 portas livres')
  checar('Nenhuma peça em cima dos caminhos das portas nem das duas estradas', portas.bloqueios.length === 0,
    portas.bloqueios.length ? portas.bloqueios.join('; ') : '9 caminhos livres na largura inteira')

  // a porta aparece no mapa (pela cor do pixel da folha, no zoom 100%)
  const vistas = []
  for (let i = 0; i < 7; i += 1) {
    const casa = await pagina.evaluate((i) => {
      const c = window.__vila.V.CASAS[i]
      window.__vila.camera(c.porta[0], c.porta[1], 1)
      return { nome: c.nome, folha: c.corDaFolha, x: c.porta[0] + c.normal[0] * 1 - c.eixo[0] * 1, y: c.porta[1] + c.normal[1] * 1 - c.eixo[1] * 1 }
    }, i)
    await esperarQuadro(pagina)
    const cor = await corNoMundo(pagina, casa.x, casa.y)
    vistas.push({ ...casa, d: distCor(cor, hexRgb(casa.folha)) })
  }
  checar('A folha de cada porta aparece por cima do telhado (cor do pixel, zoom 100%)', vistas.every((v) => v.d <= 40),
    vistas.map((v) => `${v.nome} ${v.d}`).join(', ') + ' (diferença de cor; meta ≤ 40)')

  // ---------- controles de verdade ----------
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  const d0 = await digital(pagina)
  await pagina.click('[data-modo="antes"]')
  const dAntes = await digital(pagina)
  const nomesNoAntes = await pagina.evaluate(() => ({ nomes: document.querySelector('#b-nomes').disabled, aviso: !document.querySelector('#aviso').hidden, casa: document.querySelector('.casa').disabled }))
  await pagina.click('[data-modo="depois"]')
  const dDepois = await digital(pagina)
  checar('Antes troca o mapa pelo de hoje e Depois volta ao mesmo desenho', dAntes !== d0 && dDepois === d0, `digitais ${d0} → ${dAntes} → ${dDepois}`)
  checar('No Antes, Nomes e as casas ficam desabilitados com o motivo escrito', nomesNoAntes.nomes && nomesNoAntes.aviso && nomesNoAntes.casa, JSON.stringify(nomesNoAntes))
  // teclado nos rádios: seta troca
  await pagina.focus('[data-modo="depois"]')
  await pagina.keyboard.press('ArrowLeft')
  const modoPelaSeta = await pagina.evaluate(() => window.__vila.est.modo)
  await pagina.keyboard.press('ArrowRight')
  checar('A seta troca Antes/Depois quando o foco está nos botões', modoPelaSeta === 'antes' && (await pagina.evaluate(() => window.__vila.est.modo)) === 'depois', `seta esquerda → ${modoPelaSeta}`)

  await pagina.click('#b-grade')
  const dSemGrade = await digital(pagina)
  await pagina.click('#b-grade')
  const dComGrade = await digital(pagina)
  checar('Grade liga e desliga (ligada ao abrir)', dSemGrade !== d0 && dComGrade === d0, `digitais ${d0} → ${dSemGrade} → ${dComGrade}`)
  await pagina.click('#b-nomes')
  const dNomes = await digital(pagina)
  const nomePressionado = await pagina.getAttribute('#b-nomes', 'aria-pressed')
  await pagina.click('#b-nomes')
  checar('Nomes escreve o nome das casas no mapa', dNomes !== d0 && nomePressionado === 'true' && (await digital(pagina)) === d0, `aria-pressed ${nomePressionado}`)

  const z0 = await pagina.textContent('#z-valor')
  await pagina.click('#z-mais')
  const z1 = await pagina.textContent('#z-valor')
  await pagina.click('#z-menos')
  await pagina.click('#z-menos')
  const z2 = await pagina.textContent('#z-valor')
  await pagina.click('#z-valor')
  const z3 = await pagina.textContent('#z-valor')
  checar('Os botões de zoom mudam o zoom e 100% volta para 100%', z1 !== z0 && z2 !== z1 && z3 === '100%', `${z0} → ${z1} → ${z2} → ${z3}`)
  await pagina.click('#z-enquadrar')

  // teclado: setas e WASD andam
  await porPino(pagina, 380, 330)
  await pagina.focus('#mapa')
  const a0 = await pino(pagina)
  await segurar(pagina, 'ArrowRight', 500)
  const a1 = await pino(pagina)
  await segurar(pagina, 'KeyW', 400)
  const a2 = await pino(pagina)
  checar('Setas e WASD andam com o pino', a1[0] - a0[0] > 50 && a2[1] - a1[1] < -40, `→ ${r1(a1[0] - a0[0])} px em 0,5 s; W ${r1(a2[1] - a1[1])} px em 0,4 s`)

  // colisão: a parede da taverna segura o pino fora da porta; a porta deixa passar e o telhado some
  await porPino(pagina, 180, 236)
  await segurar(pagina, 'ArrowUp', 900)
  const b1 = await pino(pagina)
  checar('A parede da casa segura o pino (fora da porta)', b1[1] >= 198 + 2 + 11 - 0.5, `subindo 0,9 s contra a taverna: parou em y = ${r1(b1[1])} (parede em 198)`)
  await porPino(pagina, 248, 232)
  await esperarQuadro(pagina)
  const corTelhadoFora = await corNoMundo(pagina, 160, 110)
  await pagina.evaluate(() => {
    window.__amostrasDoTelhado = []
    const v = window.__vila
    const amostrar = (t) => {
      window.__amostrasDoTelhado.push([t, v.est.pino[1], v.est.telhado.get('taverna')])
      if (window.__amostrasDoTelhado.length < 120) requestAnimationFrame(amostrar)
    }
    requestAnimationFrame(amostrar)
  })
  await segurar(pagina, 'ArrowUp', 700)
  await pagina.waitForTimeout(500)
  const amostras = await pagina.evaluate(() => window.__amostrasDoTelhado)
  const cruzou = amostras.find((a) => a[1] < 198)
  const sumiu = amostras.find((a) => a[2] >= 1)
  const tempoDoTelhado = cruzou && sumiu ? sumiu[0] - cruzou[0] : Infinity
  const b2 = await pino(pagina)
  const corTelhadoDentro = await corNoMundo(pagina, 160, 110)
  checar('A porta deixa passar: o pino entra na taverna', b2[1] < 198 - 11, `y = ${r1(b2[1])}`)
  checar(`O telhado some em até ${TELHADO_MAX_MS} ms depois que o pino cruza a parede, e a sala aparece`, tempoDoTelhado <= TELHADO_MAX_MS && distCor(corTelhadoFora, corTelhadoDentro) > 60,
    `${r1(tempoDoTelhado)} ms; pixel do telhado ${JSON.stringify(corTelhadoFora)} → assoalho ${JSON.stringify(corTelhadoDentro)}`)
  await segurar(pagina, 'ArrowDown', 700)
  await pagina.waitForTimeout(400)
  const voltou = await pagina.evaluate(() => window.__vila.est.telhado.get('taverna'))
  checar('Saindo pela porta, o telhado volta', voltou === 0, `progresso ${voltou}`)

  // clique no chão: o pino vai até lá pelo caminho
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  const alvo = [700, 330]
  const tela = await pagina.evaluate(([x, y]) => window.__vila.paraTela(x, y), alvo)
  const caixaDoMapa = await pagina.locator('#mapa').boundingBox()
  await pagina.mouse.click(caixaDoMapa.x + tela[0], caixaDoMapa.y + tela[1])
  await pagina.waitForTimeout(2200)
  const c1 = await pino(pagina)
  checar('Clique no chão leva o pino até o ponto', Math.hypot(c1[0] - alvo[0], c1[1] - alvo[1]) < 6, `parou a ${r1(Math.hypot(c1[0] - alvo[0], c1[1] - alvo[1]))} px do ponto clicado`)

  // botão de cada casa: o pino vai até a porta e entra
  const idas = []
  for (const nome of ['Templo', 'Estábulo']) {
    await pagina.click(`.casa[aria-label^="${nome}"]`)
    const t0 = Date.now()
    await pagina.waitForFunction((n) => window.__vila.V.CASAS.find((c) => c.nome === n).id === window.__vila.est.onde, nome, { timeout: 20000 }).catch(() => {})
    idas.push({ nome, ok: await pagina.evaluate((n) => window.__vila.V.CASAS.find((c) => c.nome === n).id === window.__vila.est.onde, nome), s: (Date.now() - t0) / 1000 })
  }
  checar('O botão da casa leva o pino até lá dentro, pela porta', idas.every((i) => i.ok), idas.map((i) => `${i.nome} ${i.ok ? r1(i.s) + ' s' : 'não chegou'}`).join('; '))

  // ---------- travada: andando e dando zoom ----------
  await pagina.evaluate(() => window.scrollTo(0, 0))
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  await pagina.focus('#mapa')
  await pagina.evaluate(() => {
    window.__vila.medidas.quadros.length = 0
    window.__vila.medidas.desenho.length = 0
  })
  const caixaDoMapa2 = await pagina.locator('#mapa').boundingBox()
  await pagina.keyboard.down('ArrowRight')
  await pagina.keyboard.down('ArrowDown')
  for (let i = 0; i < 8; i += 1) {
    await pagina.mouse.move(caixaDoMapa2.x + 640, caixaDoMapa2.y + 420)
    await pagina.mouse.wheel(0, i < 4 ? -240 : 240)
    await pagina.waitForTimeout(160)
  }
  await pagina.keyboard.up('ArrowDown')
  await segurar(pagina, 'ArrowLeft', 900)
  await pagina.keyboard.up('ArrowRight')
  await pagina.mouse.move(caixaDoMapa2.x + 300, caixaDoMapa2.y + 300)
  await pagina.mouse.down()
  for (let i = 0; i < 20; i += 1) await pagina.mouse.move(caixaDoMapa2.x + 300 + i * 12, caixaDoMapa2.y + 300 + i * 6)
  await pagina.mouse.up()
  await pagina.waitForTimeout(300)
  const sessao = await pagina.evaluate(() => ({ quadros: window.__vila.medidas.quadros.slice(1), desenho: window.__vila.medidas.desenho.slice(), longas: window.__tarefasLongas.slice() }))
  checar(`Sem travada andando e dando zoom: intervalo entre quadros p95 ≤ ${P95_QUADRO_MAX_MS} ms`, p95(sessao.quadros) <= P95_QUADRO_MAX_MS,
    `p95 ${r1(p95(sessao.quadros))} ms em ${sessao.quadros.length} quadros (maior ${r1(Math.max(...sessao.quadros))} ms); desenhar o mapa p95 ${r1(p95(sessao.desenho))} ms`)
  checar(`Nenhuma tarefa longa ≥ ${TAREFA_LONGA_MS} ms na sessão inteira (abrir, gerar 2x, andar, zoom)`, sessao.longas.every((d) => d < TAREFA_LONGA_MS),
    sessao.longas.length ? `maior ${Math.max(...sessao.longas)} ms; ${sessao.longas.length} acima de 50 ms` : 'nenhuma acima de 50 ms')

  // ---------- robô que anda como gente (página própria: a conta trava o quadro de propósito) ----------
  const paginaRobo = await abrir(contexto, url, erros)
  await esperarPronto(paginaRobo)
  const robo = await paginaRobo.evaluate((sementes) => {
    const v = window.__vila
    const V = v.V
    const nav = v.navegacao()
    const existe = V.CASAS.map((c) => !!V.caminho(nav, V.INICIO_DO_PINO, c.dentro))
    const corridas = []
    for (const s of sementes) for (let i = 0; i < V.CASAS.length; i += 1) corridas.push({ s, casa: V.CASAS[i].nome, ...v.robo(s, i) })
    return { existe, corridas }
  }, SEMENTES)
  checar('Existe caminho pelo chão andável do pino até dentro das 7 casas', robo.existe.every(Boolean), `${robo.existe.filter(Boolean).length} de 7`)
  const okR = robo.corridas.filter((c) => c.ok)
  const porCasa = {}
  for (const c of robo.corridas) (porCasa[c.casa] ||= []).push(c)
  checar(`Robô com 250 ms de atraso e erro de direção chega às 7 portas e entra, nas ${SEMENTES.length} sementes`, okR.length === robo.corridas.length,
    `${okR.length} de ${robo.corridas.length}; tempo mediano ${r1(mediana(okR.map((c) => c.tempo)))} s, pior ${r1(Math.max(...okR.map((c) => c.tempo)))} s; ${robo.corridas.reduce((a, c) => a + (c.replanos || 0), 0)} vezes empacou e refez o caminho` +
      (okR.length < robo.corridas.length ? '; falhou: ' + robo.corridas.filter((c) => !c.ok).map((c) => `${c.casa}/semente ${c.s}`).join(', ') : ''))

  // ---------- mesma entrada, mesma imagem ----------
  // duas aberturas novas (a do robô e outra), sem a história de zoom da primeira
  const outra = await abrir(contexto, url, erros)
  await esperarPronto(outra)
  for (const p of [paginaRobo, outra]) {
    await p.evaluate(() => {
      window.__vila.est.pino = window.__vila.V.INICIO_DO_PINO.slice()
      window.__vila.camera(586, 400, 1)
    })
    await p.waitForTimeout(400)
    await esperarPronto(p)
  }
  const [h1, h2] = [await digital(paginaRobo), await digital(outra)]
  checar('Mesma entrada, mesma imagem (duas aberturas, mesma câmera)', h1 === h2, `${h1} e ${h2}`)

  // ---------- prints do computador ----------
  await pagina.evaluate(() => window.scrollTo(0, 0))
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  await esperarPronto(pagina)
  await esperarQuadro(pagina)
  await pagina.screenshot({ path: path.join(PASTA, 'desktop-1440.png'), fullPage: true })
  const mapaDepois = await pagina.locator('#mapa').screenshot()
  await pagina.click('[data-modo="antes"]')
  await esperarQuadro(pagina)
  const mapaAntes = await pagina.locator('#mapa').screenshot()
  await pagina.click('[data-modo="depois"]')
  for (const [nome, x, y] of [['detalhe-poco.png', 586, 412], ['detalhe-porta.png', 262, 214]]) {
    await pagina.evaluate(([x, y]) => window.__vila.camera(x, y, 2.6), [x, y])
    await pagina.waitForTimeout(250)
    await esperarPronto(pagina)
    await esperarQuadro(pagina)
    const caixa = await pagina.locator('#mapa').boundingBox()
    await pagina.screenshot({ path: path.join(PASTA, nome), clip: { x: caixa.x + caixa.width / 2 - 360, y: caixa.y + caixa.height / 2 - 230, width: 720, height: 460 } })
  }
  const lado = await contexto.newPage()
  await lado.setViewportSize({ width: 1600, height: 600 })
  const img = (b) => 'data:image/png;base64,' + b.toString('base64')
  await lado.setContent(`<body style="margin:0;background:#1d211c;font:600 18px system-ui;color:#eee"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px">
    <figure style="margin:0"><figcaption style="padding:0 0 6px">Antes (o mapa de hoje)</figcaption><img style="width:100%;display:block;border-radius:8px" src="${img(mapaAntes)}"></figure>
    <figure style="margin:0"><figcaption style="padding:0 0 6px">Depois (mesma câmera)</figcaption><img style="width:100%;display:block;border-radius:8px" src="${img(mapaDepois)}"></figure></div></body>`)
  await lado.screenshot({ path: path.join(PASTA, 'antes-depois.png'), fullPage: true })

  // ---------- celular, 390 px, tela 2x, toque ----------
  const celular = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' })
  const pc = await abrir(celular, url, erros)
  const inicioCel = await pc.evaluate(() => ({ abertura: window.__vila.primeiraPinturaDesdeAbertura, chegada: performance.getEntriesByType('navigation')[0].responseEnd }))
  checar('Primeira pintura no celular (390 px, tela 2x), desde que o HTML chegou', inicioCel.abertura - inicioCel.chegada <= PRIMEIRA_PINTURA_MAX_MS, `${r1(inicioCel.abertura - inicioCel.chegada)} ms (meta ≤ ${PRIMEIRA_PINTURA_MAX_MS})`)
  await esperarPronto(pc)
  const larguras = await pc.evaluate(() => ({ doc: document.documentElement.scrollWidth, janela: window.innerWidth, zoom: window.__vila.est.cam.z }))
  checar('Celular de 390 px: sem rolagem para o lado', larguras.doc <= larguras.janela, `largura do conteúdo ${larguras.doc} px, janela ${larguras.janela} px`)
  const portaNoCelular = Math.round(36 * larguras.zoom)
  checar(`No celular, o mapa abre num zoom em que a porta continua com pelo menos ${PORTA_MIN.menor} x ${PORTA_MIN.maior} px na tela`, Math.min(24, 36) * larguras.zoom >= PORTA_MIN.menor - 0.01 && 36 * larguras.zoom >= PORTA_MIN.maior,
    `zoom ${Math.round(larguras.zoom * 100)}%: porta com ${portaNoCelular} x ${Math.round(24 * larguras.zoom)} px na tela`)
  const caixaCel = await pc.locator('#mapa').boundingBox()
  const antesDoToque = await pino(pc)
  const alvoCel = await pc.evaluate(() => {
    const v = window.__vila
    return [v.est.pino[0] - 80, v.est.pino[1] - 40]
  })
  const telaCel = await pc.evaluate(([x, y]) => window.__vila.paraTela(x, y), alvoCel)
  await pc.touchscreen.tap(caixaCel.x + telaCel[0], caixaCel.y + telaCel[1])
  await pc.waitForTimeout(1500)
  const depoisDoToque = await pino(pc)
  checar('Toque no chão leva o pino até o ponto (celular)', Math.hypot(depoisDoToque[0] - alvoCel[0], depoisDoToque[1] - alvoCel[1]) < 8,
    `de (${antesDoToque.map(Math.round)}) até (${depoisDoToque.map(Math.round)}); alvo (${alvoCel.map(Math.round)})`)
  await pc.evaluate(() => window.scrollTo(0, 0))
  await esperarQuadro(pc)
  await pc.screenshot({ path: path.join(PASTA, 'celular-390.png') })

  checar('Nenhum erro no console (computador, robô, segunda abertura e celular)', erros.length === 0, erros.length ? erros.slice(0, 3).join(' | ') : '0 erros')

  const ok = resultados.filter((r) => r.ok).length
  fs.writeFileSync(path.join(PASTA, 'testes.json'), JSON.stringify({
    data: new Date().toISOString(),
    navegador: `Chromium ${navegador.version()} sem tela (headless), esta máquina`,
    metas: { PRIMEIRA_PINTURA_MAX_MS, P95_QUADRO_MAX_MS, TAREFA_LONGA_MS, PORTA_MIN, SEMENTES, PECAS_MIN, PECAS_MAX, TELHADO_MAX_MS },
    total: resultados.length,
    passaram: ok,
    resultados,
    robo: robo.corridas.map((c) => ({ semente: c.s, casa: c.casa, ok: c.ok, tempo: c.tempo, replanos: c.replanos, andou: c.andou })),
  }, null, 2))
  console.log(`\n${ok} de ${resultados.length} provas passaram. Saída em ${PASTA}`)
  await navegador.close()
  process.exitCode = ok === resultados.length ? 0 : 1
}

main().catch(async (e) => {
  console.error(e)
  if (navegadorAberto) await navegadorAberto.close()
  process.exitCode = 1
})
