// Provas do protótipo do Meio-termo: paleta e contorno (sem preto), primeira pintura, robô que anda
// como gente até as 7 portas, portas e caminhos livres, barranco e saídas, controles de verdade com os
// 4 modos, travada, celular, mesma imagem, chão que não repete, meio-termo medido, presença das peças
// pedidas e os 6 prints.
// Rodar da raiz do repo: node docs/design/vila-meio-termo/provas/gerar-provas.cjs
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const { chromium } = require('playwright')

const PASTA = __dirname
const PROTOTIPO = path.join(PASTA, '..', 'prototipo')
const PAGINA_TESTE = path.join(os.tmpdir(), 'vila-meio-termo-pagina-de-teste.html')

// Metas escritas antes de codar (pedido de 21/10/2026), as mesmas do Estilo Mother mais (h), (i), (j) e (k).
const PRIMEIRA_PINTURA_MAX_MS = 400
const P95_QUADRO_MAX_MS = 20
const TAREFA_LONGA_MS = 200
const PORTA_MIN = { menor: 18, maior: 24 }
const SEMENTES = [1, 2, 3, 4, 5]
const PECAS_MIN = 25
const PECAS_MAX = 35
/** O telhado some em 300 ms; com a folga de um quadro (60 Hz) para medir. */
const TELHADO_MAX_MS = 320
/**
 * (h) Nenhum pixel do mapa abaixo desta luminância relativa (o preto é 0). Mais baixo que o do Estilo Mother (0,04)
 * porque os objetos e os telhados da Textura têm sombra de verdade; o meio.js levanta todo pixel opaco até 0,045.
 */
const PISO_DE_LUMINANCIA = 0.03
const PALETA_MIN = 8
const PALETA_MAX = 40
/** (i) O chão de grama dividido em blocos de 96 x 96 px: nenhum bloco igual a outro. */
const BLOCO = 96
/** (i) Autocorrelação do detalhe fino da grama (passa-alta), de 16 a 384 px: nenhum pico acima disto. */
const AUTOCORRELACAO_MAX = 0.3
/** (k) Fração mínima de pixels da caixa da peça diferentes do chão sem a peça (distância de cor > 40). */
const PRESENCA_MIN = 0.15

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
/** Luminância relativa de cada pixel do canvas: o mínimo e quantos ficam abaixo do piso. */
const LUMINANCIAS = (piso) => {
  const c = document.querySelector('#mapa')
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  const lin = new Float32Array(256)
  for (let v = 0; v < 256; v += 1) {
    const u = v / 255
    lin[v] = u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
  }
  let min = 1
  let abaixo = 0
  let pior = null
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * lin[d[i]] + 0.7152 * lin[d[i + 1]] + 0.0722 * lin[d[i + 2]]
    if (l < min) {
      min = l
      pior = [d[i], d[i + 1], d[i + 2]]
    }
    if (l < piso) abaixo += 1
  }
  return { min, abaixo, pixels: d.length / 4, pior }
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

/** Prova estática da paleta: toda cor do meio.js mora no bloco PALETA. */
function provarPaletaNoCodigo() {
  const fonte = fs.readFileSync(path.join(PROTOTIPO, 'meio.js'), 'utf8')
  const inicio = fonte.indexOf('// <PALETA>')
  const fim = fonte.indexOf('// </PALETA>')
  const bloco = fonte.slice(inicio, fim)
  const fora = (fonte.slice(0, inicio) + fonte.slice(fim))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
  const literais = fora.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d|hsla?\(\s*\d/g) || []
  const declaradas = new Set((bloco.replace(/\/\/.*$/gm, '').match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toLowerCase()))
  return { achouBloco: inicio > 0 && fim > inicio, literais, declaradas: declaradas.size }
}

let navegadorAberto = null

async function main() {
  const estatica = provarPaletaNoCodigo()
  checar('Nenhuma cor escrita no meio.js fora do bloco PALETA', estatica.achouBloco && estatica.literais.length === 0,
    estatica.literais.length ? 'achou: ' + estatica.literais.slice(0, 5).join(', ') : `bloco PALETA com ${estatica.declaradas} valores hex declarados; 0 cores fora dele`)

  const url = montarPaginaDeTeste()
  const navegador = await chromium.launch(opcoesDoNavegador())
  navegadorAberto = navegador
  const erros = []

  // ---------- computador, 1440, tela 1x ----------
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1, colorScheme: 'light' })
  const pagina = await abrir(contexto, url, erros)
  const inicio = await pagina.evaluate(() => ({
    abertura: window.__vila.primeiraPinturaDesdeAbertura,
    chegada: performance.getEntriesByType('navigation')[0].responseEnd,
    tempos: window.__vila.tempos,
    modo: window.__vila.est.modo,
  }))
  const desdeOHtml = inicio.abertura - inicio.chegada
  checar('Primeira pintura do mapa inteiro no Meio-termo (computador, tela 1x), desde que o HTML chegou', inicio.modo === 'meio' && desdeOHtml <= PRIMEIRA_PINTURA_MAX_MS,
    `${r1(desdeOHtml)} ms (meta ≤ ${PRIMEIRA_PINTURA_MAX_MS}); abre em ${inicio.modo}; etapas: ${Object.entries(inicio.tempos).map(([k, v]) => `${k} ${v}`).join(', ')} ms`)
  await esperarPronto(pagina)

  // paleta: quantas bases e todo contorno derivado acima do piso
  const paleta = await pagina.evaluate(() => ({ tons: window.Meio.tonsDaPaleta(), piso: window.Meio.PISO_DO_CONTORNO }))
  const nBases = paleta.tons.length
  const tonsUnicos = new Set(paleta.tons.flatMap((t) => [t.base, t.realce, t.sombra, t.contorno, t.linha].map((h) => h.toLowerCase())))
  checar(`A paleta tem entre ${PALETA_MIN} e ${PALETA_MAX} cores base`, nBases >= PALETA_MIN && nBases <= PALETA_MAX,
    `${nBases} cores base; com realce, sombra, contorno e traço derivados são ${tonsUnicos.size} tons ao todo`)
  const contornoMaisEscuro = paleta.tons.reduce((a, t) => (t.lumContorno < a.lumContorno ? t : a))
  checar(`Todo contorno da paleta é colorido, nunca preto (luminância ≥ ${paleta.piso})`, paleta.tons.every((t) => t.lumContorno >= paleta.piso - 1e-9),
    `o mais escuro é o de ${contornoMaisEscuro.nome}, ${contornoMaisEscuro.contorno}, luminância ${contornoMaisEscuro.lumContorno.toFixed(3)}`)

  // contagem de peças
  const contagem = await pagina.evaluate(() => {
    const M = window.Mae
    const tipos = {}
    for (const p of M.PECAS) tipos[p.t] = (tipos[p.t] || 0) + 1
    return { n: M.PECAS.length, tipos, fora: M.ARVORES_DE_FORA.length, placas: window.__vila.V.PLACAS.length, sebes: M.SEBES.length }
  })
  checar(`A praça tem entre ${PECAS_MIN} e ${PECAS_MAX} peças`, contagem.n >= PECAS_MIN && contagem.n <= PECAS_MAX,
    `${contagem.n} peças (${Object.entries(contagem.tipos).map(([k, v]) => `${v} ${k}`).join(', ')}); fora da conta: ${contagem.placas} placas de direção, ${contagem.sebes} sebes, ${contagem.fora} árvores fora do barranco`)

  // portas: tamanho a 100% e nada na frente; caminhos e as 4 estradas livres
  const portas = await pagina.evaluate(() => {
    const V = window.__vila.V
    const M = window.Mae
    const caixas = window.Meio.EXTERNAS.map((p) => {
      const img = window.Meio.imagemDaPeca(p, 1)
      return { t: p.t, x: p.x, y: p.y, b: [p.x + img.pecas[0], p.y + img.pecas[1], p.x + img.pecas[2], p.y + img.pecas[3]] }
    })
    const cruza = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]
    const fisPecas = V.montarFisica(M.formasDasPecas())
    const MUNDO = V.MUNDO
    const linhas = [
      ...V.CASAS.map((c) => ({ nome: 'caminho da ' + c.nome, pts: V.caminhoDaPorta(c), meia: V.LARGURA_DO_CAMINHO / 2, fis: fisPecas })),
      // as estradas contra tudo: peças, sebes, barranco e casas
      ...M.ESTRADAS.map((e) => ({ nome: e.nome, pts: e.pts, meia: e.largura / 2, fis: M.fisica() })),
    ]
    const bloqueios = []
    for (const l of linhas) {
      for (const [x, y] of V.amostrarLinha(l.pts, 3)) {
        if (x < MUNDO.x0 + l.meia || x > MUNDO.x1 - l.meia || y < MUNDO.y0 + l.meia || y > MUNDO.y1 - l.meia) continue
        if (V.folga(l.fis, x, y, l.meia) < -0.01) {
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
      nLinhas: linhas.length,
    }
  })
  const tamanhos = portas.casas.map((c) => ({ ...c, menor: Math.min(c.w, c.h), maior: Math.max(c.w, c.h) }))
  checar(`Cada porta tem pelo menos ${PORTA_MIN.menor} x ${PORTA_MIN.maior} px no zoom 100%`, tamanhos.every((c) => c.menor >= PORTA_MIN.menor && c.maior >= PORTA_MIN.maior),
    tamanhos.map((c) => `${c.nome} ${c.w} x ${c.h}`).join('; '))
  const cobertas = portas.casas.filter((c) => c.cobrem.length)
  checar('Nenhuma peça cobre a porta nem fica na frente dela (até 30 px para fora)', cobertas.length === 0,
    cobertas.length ? cobertas.map((c) => `${c.nome}: ${c.cobrem.join(', ')}`).join('; ') : '7 de 7 portas livres')
  checar('Nenhuma peça em cima dos caminhos das portas; nada (peça, sebe, barranco, casa) em cima das 4 estradas', portas.bloqueios.length === 0,
    portas.bloqueios.length ? portas.bloqueios.join('; ') : `${portas.nLinhas} caminhos livres na largura inteira`)

  // a porta aparece no mapa (pela cor do pixel da folha, no zoom 100%)
  const vistas = []
  for (let i = 0; i < 7; i += 1) {
    const casa = await pagina.evaluate((i) => {
      const c = window.__vila.V.CASAS[i]
      window.__vila.camera(c.porta[0], c.porta[1], 1)
      return { nome: c.nome, folha: window.Meio.corDaFolha(c), x: c.porta[0] + c.normal[0] * 1 - c.eixo[0] * 1, y: c.porta[1] + c.normal[1] * 1 - c.eixo[1] * 1 }
    }, i)
    await esperarQuadro(pagina)
    const cor = await corNoMundo(pagina, casa.x, casa.y)
    vistas.push({ ...casa, d: distCor(cor, hexRgb(casa.folha)) })
  }
  checar('A folha de cada porta aparece por cima do telhado (cor do pixel, zoom 100%)', vistas.every((v) => v.d <= 40),
    vistas.map((v) => `${v.nome} ${v.d}`).join(', ') + ' (diferença de cor; meta ≤ 40)')

  // nenhum pixel preto no mapa: vila inteira e dois detalhes de perto
  const lums = []
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  await esperarPronto(pagina)
  lums.push({ onde: 'vila inteira', ...(await pagina.evaluate(LUMINANCIAS, PISO_DE_LUMINANCIA)) })
  for (const [onde, x, y] of [['porta da taverna, 260%', 262, 214], ['poço, 260%', 586, 412]]) {
    await pagina.evaluate(([x, y]) => window.__vila.camera(x, y, 2.6), [x, y])
    await pagina.waitForTimeout(250)
    await esperarPronto(pagina)
    await esperarQuadro(pagina)
    lums.push({ onde, ...(await pagina.evaluate(LUMINANCIAS, PISO_DE_LUMINANCIA)) })
  }
  checar(`Nenhum pixel do mapa abaixo da luminância ${PISO_DE_LUMINANCIA} (contorno nunca preto)`, lums.every((l) => l.abaixo === 0),
    lums.map((l) => `${l.onde}: ${l.abaixo} de ${l.pixels} abaixo, mais escuro ${l.min.toFixed(3)} (rgb ${l.pior.join(', ')})`).join('; '))

  // (i), (j) e (k) leem o canvas inteiro e fazem contas pesadas dentro da página: rodam depois da sessão de travada
  // (como as provas de pixel do Estilo Mother rodavam antes dela), para a página já lida comparar o mesmo que lá.
  const provasDeEstilo = async () => {
  // (i) o chão não repete: blocos de 96 x 96 px sem nenhum par igual, e autocorrelação sem pico
  const repeticao = await pagina.evaluate(({ BLOCO }) => {
    const medir = (cv) => {
      const W = cv.width
      const H = cv.height
      const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
      const vistos = new Set()
      let blocos = 0
      let iguais = 0
      for (let by = 0; by + BLOCO <= H; by += BLOCO) {
        for (let bx = 0; bx + BLOCO <= W; bx += BLOCO) {
          let h = 2166136261
          for (let y = by; y < by + BLOCO; y += 1) {
            for (let x = bx, i = (y * W + bx) * 4; x < bx + BLOCO; x += 1, i += 4) h = Math.imul(h ^ (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16)), 16777619)
          }
          blocos += 1
          if (vistos.has(h >>> 0)) iguais += 1
          else vistos.add(h >>> 0)
        }
      }
      // detalhe fino: luminância menos a média numa caixa de 9 x 9 (imagem integral)
      const L = new Float64Array((W + 1) * (H + 1))
      for (let y = 0; y < H; y += 1) {
        let linha = 0
        for (let x = 0; x < W; x += 1) {
          const i = (y * W + x) * 4
          linha += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          L[(y + 1) * (W + 1) + x + 1] = L[y * (W + 1) + x + 1] + linha
        }
      }
      const R = 4
      const hp = new Float32Array(W * H)
      for (let y = R; y < H - R; y += 1) {
        for (let x = R; x < W - R; x += 1) {
          const s = L[(y + R + 1) * (W + 1) + x + R + 1] - L[(y - R) * (W + 1) + x + R + 1] - L[(y + R + 1) * (W + 1) + x - R] + L[(y - R) * (W + 1) + x - R]
          const i = (y * W + x) * 4
          hp[y * W + x] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] - s / 81
        }
      }
      let e = 0
      for (let i = 0; i < hp.length; i += 1) e += hp[i] * hp[i]
      let maior = { r: -1, lag: 0, eixo: '' }
      for (let lag = 16; lag <= 384; lag += 4) {
        for (const [eixo, dx, dy] of [['x', lag, 0], ['y', 0, lag]]) {
          let s = 0
          for (let y = 0; y + dy < H; y += 2) for (let x = 0; x + dx < W; x += 2) s += hp[y * W + x] * hp[(y + dy) * W + x + dx]
          const r = (s * 4) / e
          if (r > maior.r) maior = { r, lag, eixo }
        }
      }
      return { blocos, iguais, maior }
    }
    const grama = medir(window.Meio.camadaDaGrama())
    const chao = medir(window.Meio.chao(1).canvas)
    // controle: o mesmo teste no ladrilho de grama da Textura, repetido no mesmo tamanho, tem que achar o pico
    const t = window.__vila.V.ladrilho('grama', 1)
    const tile = t.canvas || t
    const cv = document.createElement('canvas')
    cv.width = 1520
    cv.height = 1080
    const g = cv.getContext('2d', { willReadFrequently: true })
    g.fillStyle = g.createPattern(tile, 'repeat')
    g.fillRect(0, 0, cv.width, cv.height)
    const textura = medir(cv)
    return { grama, chao, textura, ladoDoLadrilho: tile.width }
  }, { BLOCO })
  const fmtR = (m) => `${m.maior.r.toFixed(3)} (lag ${m.maior.lag} px em ${m.maior.eixo})`
  checar(`O chão não repete: blocos de ${BLOCO} x ${BLOCO} px todos diferentes (grama sozinha e chão inteiro)`, repeticao.grama.iguais === 0 && repeticao.chao.iguais === 0,
    `grama: ${repeticao.grama.iguais} iguais em ${repeticao.grama.blocos} blocos; chão inteiro: ${repeticao.chao.iguais} iguais em ${repeticao.chao.blocos}; controle (ladrilho da Textura repetido): ${repeticao.textura.iguais} iguais em ${repeticao.textura.blocos}`)
  checar(`A autocorrelação do detalhe da grama não tem pico de repetição (≤ ${AUTOCORRELACAO_MAX} de 16 a 384 px)`, repeticao.grama.maior.r <= AUTOCORRELACAO_MAX && repeticao.textura.maior.r > AUTOCORRELACAO_MAX,
    `maior pico ${fmtR(repeticao.grama)}; chão inteiro ${fmtR(repeticao.chao)}; controle, ladrilho da Textura (${repeticao.ladoDoLadrilho} px) repetido: ${fmtR(repeticao.textura)}`)

  // (j) o meio-termo medido: croma médio (OKLCH) e energia de borda média do mapa inteiro, nos 3 estilos
  const MEDIR_ESTILO = () => {
    const c = document.querySelector('#mapa')
    const W = c.width
    const H = c.height
    const d = c.getContext('2d').getImageData(0, 0, W, H).data
    const lin = new Float32Array(256)
    for (let v = 0; v < 256; v += 1) {
      const u = v / 255
      lin[v] = u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4
    }
    const Lok = new Float32Array(W * H)
    let croma = 0
    for (let p = 0, i = 0; p < W * H; p += 1, i += 4) {
      const r = lin[d[i]]
      const g = lin[d[i + 1]]
      const b = lin[d[i + 2]]
      const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
      const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
      const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
      Lok[p] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
      const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
      const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
      croma += Math.hypot(A, B)
    }
    let borda = 0
    let n = 0
    for (let y = 1; y < H - 1; y += 1) {
      for (let x = 1; x < W - 1; x += 1) {
        const q = y * W + x
        const gx = Lok[q - W + 1] + 2 * Lok[q + 1] + Lok[q + W + 1] - Lok[q - W - 1] - 2 * Lok[q - 1] - Lok[q + W - 1]
        const gy = Lok[q + W - 1] + 2 * Lok[q + W] + Lok[q + W + 1] - Lok[q - W - 1] - 2 * Lok[q - W] - Lok[q - W + 1]
        borda += Math.hypot(gx, gy)
        n += 1
      }
    }
    return { croma: croma / (W * H), borda: borda / n }
  }
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  await pagina.click('#b-grade')
  const estilos = {}
  for (const modo of ['depois', 'mother', 'meio']) {
    await pagina.click(`[data-modo="${modo}"]`)
    await esperarPronto(pagina)
    await esperarQuadro(pagina)
    estilos[modo] = await pagina.evaluate(MEDIR_ESTILO)
  }
  await pagina.click('#b-grade')
  const entre = (k) => {
    const [a, b] = [estilos.depois[k], estilos.mother[k]].sort((x, y) => x - y)
    return estilos.meio[k] > a && estilos.meio[k] < b
  }
  const fmtE = (k, casas) => ['depois', 'mother', 'meio'].map((m) => `${{ depois: 'Textura', mother: 'Mother', meio: 'Meio-termo' }[m]} ${estilos[m][k].toFixed(casas)}`).join(', ')
  checar('Meio-termo medido: o croma médio (OKLCH) do mapa inteiro fica estritamente entre Textura e Estilo Mother', entre('croma'), fmtE('croma', 4) + ' (sem a grade, mesma câmera)')
  checar('Meio-termo medido: a energia de borda média (Sobel na luz OKLab) fica estritamente entre Textura e Estilo Mother', entre('borda'), fmtE('borda', 4) + ' (sem a grade, mesma câmera)')

  // (k) presença: árvore, poço com o campo florido, jardineira, arco, placa de seta e as 7 chaminés
  // a câmera vai até cada peça (zoom 100%) e só a caixa dela é lida; o chão sem a peça é a imagem do chão
  const LER_CAIXA = ({ b, tipo, casa }) => {
    const v = window.__vila
    const Me = window.Meio
    const c = document.querySelector('#mapa')
    const dpr = window.devicePixelRatio || 1
    const [sx0, sy0] = v.paraTela(b[0], b[1])
    const [sx1, sy1] = v.paraTela(b[2], b[3])
    const X0 = Math.round(sx0 * dpr)
    const Y0 = Math.round(sy0 * dpr)
    const W = Math.max(1, Math.round(sx1 * dpr) - X0 + 1)
    const H = Math.max(1, Math.round(sy1 * dpr) - Y0 + 1)
    const tela = c.getContext('2d').getImageData(X0, Y0, W, H).data
    const ch = Me.chaoPronto()
    const M = v.V.MUNDO
    const chao = ch.canvas.getContext('2d').getImageData(Math.round((b[0] - M.x0) * ch.k), Math.round((b[1] - M.y0) * ch.k), Math.round((b[2] - b[0]) * ch.k) + 1, Math.round((b[3] - b[1]) * ch.k) + 1)
    const dist = (a, q) => Math.abs(a[0] - q[0]) + Math.abs(a[1] - q[1]) + Math.abs(a[2] - q[2])
    // para a chaminé, o "chão sem a peça" é o mesmo telhado pintado sem ela
    const semChamine = tipo === 'chamine' ? Me.telhadoSemChamine(v.V.CASAS[casa]) : null
    const telhadoSem = semChamine ? semChamine.canvas.getContext('2d').getImageData(0, 0, semChamine.canvas.width, semChamine.canvas.height) : null
    let n = 0
    let ok = 0
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const i = (y * W + x) * 4
      const p = [tela[i], tela[i + 1], tela[i + 2]]
      n += 1
      if (tipo === 'chamine') {
        const tx = Math.min(telhadoSem.width - 1, Math.round((b[0] + x / dpr / v.est.cam.z - semChamine.x) * semChamine.e))
        const ty = Math.min(telhadoSem.height - 1, Math.round((b[1] + y / dpr / v.est.cam.z - semChamine.y) * semChamine.e))
        const j = (ty * telhadoSem.width + tx) * 4
        if (dist(p, [telhadoSem.data[j], telhadoSem.data[j + 1], telhadoSem.data[j + 2]]) > 40) ok += 1
      } else {
        const cx = Math.min(chao.width - 1, Math.round((x / dpr / v.est.cam.z) * ch.k))
        const cy = Math.min(chao.height - 1, Math.round((y / dpr / v.est.cam.z) * ch.k))
        const j = (cy * chao.width + cx) * 4
        if (dist(p, [chao.data[j], chao.data[j + 1], chao.data[j + 2]]) > 40) ok += 1
      }
    }
    return ok / n
  }
  const alvos = await pagina.evaluate(() => {
    const Me = window.Meio
    const caixaDe = (p) => {
      const img = Me.imagemDaPeca(p, 1)
      return [Math.round(p.x + img.pecas[0]), Math.round(p.y + img.pecas[1]), Math.round(p.x + img.pecas[2]), Math.round(p.y + img.pecas[3])]
    }
    const lista = []
    for (const [nome, t] of [['árvore', 'arvore'], ['jardineira', 'jardineira'], ['arco do portão', 'arco'], ['placa de seta', 'placa'], ['poço', 'poco']]) {
      for (const p of Me.EXTERNAS.filter((q) => q.t === t && !q.fora)) lista.push({ nome: `${nome} (${Math.round(p.x)}, ${Math.round(p.y)})`, x: p.x, y: p.y, b: caixaDe(p), tipo: 'peca' })
    }
    window.__vila.V.CASAS.forEach((casa, i) => {
      const [x, y] = Me.posicaoDaChamine(casa)
      const h = Me.LADO_DA_CHAMINE / 2 - 0.5
      lista.push({ nome: casa.nome, x, y, b: [Math.round(x - h), Math.round(y - h), Math.round(x + h), Math.round(y + h)], tipo: 'chamine', casa: i })
    })
    return lista
  })
  const medidos = []
  for (const a of alvos) {
    await pagina.evaluate(([x, y]) => window.__vila.camera(x, y, 1), [a.x, a.y])
    await esperarQuadro(pagina)
    medidos.push({ ...a, f: await pagina.evaluate(LER_CAIXA, { b: a.b, tipo: a.tipo, casa: a.casa }) })
  }
  // o campo florido: o anel de grama em volta do poço, com flores, na imagem do chão
  const campo = await pagina.evaluate(() => {
    const Me = window.Meio
    const ch = Me.chaoPronto()
    const M = window.__vila.V.MUNDO
    const [cx, cy] = window.__vila.V.CENTRO
    const d = ch.canvas.getContext('2d').getImageData(0, 0, ch.canvas.width, ch.canvas.height).data
    const dist = (a, q) => Math.abs(a[0] - q[0]) + Math.abs(a[1] - q[1]) + Math.abs(a[2] - q[2])
    const flores = ['rosa', 'amarelo', 'violeta', 'branco'].map((k) => [1, 3, 5].map((i) => parseInt(Me.tons(k).base.slice(i, i + 2), 16)))
    let verde = 0
    let flor = 0
    let anel = 0
    for (let y = cy - 52; y <= cy + 52; y += 1) for (let x = cx - 52; x <= cx + 52; x += 1) {
      const r = Math.hypot(x - cx, y - cy)
      if (r < 34 || r > 50) continue
      anel += 1
      const i = (Math.round((y - M.y0) * ch.k) * ch.canvas.width + Math.round((x - M.x0) * ch.k)) * 4
      const p = [d[i], d[i + 1], d[i + 2]]
      if (p[1] > p[0] + 12 && p[1] > p[2] + 12) verde += 1
      if (flores.some((f) => dist(p, f) <= 60)) flor += 1
    }
    return { verde: verde / anel, flor }
  })
  const presenca = { itens: medidos.filter((m) => m.tipo === 'peca'), campo, chamines: medidos.filter((m) => m.tipo === 'chamine') }
  await pagina.click('#z-enquadrar')
  const fracos = presenca.itens.filter((i) => i.f < PRESENCA_MIN)
  checar(`Árvore, jardineira, arco, placa de seta e poço aparecem (≥ ${Math.round(PRESENCA_MIN * 100)}% da caixa diferente do chão)`, fracos.length === 0 && presenca.itens.length >= 13,
    presenca.itens.map((i) => `${i.nome} ${Math.round(i.f * 100)}%`).join(', '))
  checar('O poço tem o campo florido em volta (anel de 34 a 50 px: ≥ 60% verde e ≥ 30 pixels de flor)', presenca.campo.verde >= 0.6 && presenca.campo.flor >= 30,
    `${Math.round(presenca.campo.verde * 100)}% verde, ${presenca.campo.flor} pixels de flor`)
  checar(`As 7 casas têm chaminé por cima do telhado (≥ ${Math.round(PRESENCA_MIN * 100)}% da caixa diferente do telhado sem ela)`, presenca.chamines.every((c) => c.f >= PRESENCA_MIN),
    presenca.chamines.map((c) => `${c.nome} ${Math.round(c.f * 100)}%`).join(', '))
  return { repeticao, estilos }
  }

  // ---------- controles de verdade ----------
  await pagina.click('#z-enquadrar')
  await porPino(pagina, 518, 462)
  const d0 = await digital(pagina)
  await pagina.click('[data-modo="antes"]')
  const dHoje = await digital(pagina)
  const travadosNoHoje = await pagina.evaluate(() => ({ nomes: document.querySelector('#b-nomes').disabled, aviso: !document.querySelector('#aviso').hidden, casa: document.querySelector('.casa').disabled }))
  await pagina.click('[data-modo="depois"]')
  const dTextura = await digital(pagina)
  const livresNaTextura = await pagina.evaluate(() => ({ nomes: !document.querySelector('#b-nomes').disabled, aviso: document.querySelector('#aviso').hidden }))
  await pagina.click('[data-modo="mother"]')
  const dMother = await digital(pagina)
  await pagina.click('[data-modo="meio"]')
  const dMeio = await digital(pagina)
  checar('Os 4 modos trocam o mapa com a mesma câmera e voltar ao Meio-termo dá a mesma imagem', new Set([d0, dHoje, dTextura, dMother]).size === 4 && dMeio === d0,
    `digitais Meio-termo ${d0}, Hoje ${dHoje}, Textura ${dTextura}, Mother ${dMother}, Meio-termo de novo ${dMeio}`)
  checar('No Hoje, Nomes e as casas ficam desabilitados com o motivo escrito; na Textura voltam', travadosNoHoje.nomes && travadosNoHoje.aviso && travadosNoHoje.casa && livresNaTextura.nomes && livresNaTextura.aviso,
    `Hoje ${JSON.stringify(travadosNoHoje)}; Textura ${JSON.stringify(livresNaTextura)}`)
  // teclado nos rádios: seta troca e dá a volta
  await pagina.focus('[data-modo="meio"]')
  const seq = []
  for (const tecla of ['ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowLeft', 'ArrowRight']) {
    await pagina.keyboard.press(tecla)
    seq.push(await pagina.evaluate(() => [window.__vila.est.modo, document.activeElement.dataset.modo].join('/')))
  }
  await pagina.click('[data-modo="meio"]')
  checar('As setas andam pelos 4 modos com o foco junto (e dão a volta)', seq.join(' ') === 'mother/mother depois/depois antes/antes meio/meio antes/antes', `Meio-termo, ← ← ← ← →: ${seq.join(', ')}`)

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

  // barranco: segura o pino fora das saídas; a saída do oeste deixa passar
  await porPino(pagina, 200, 760)
  await segurar(pagina, 'ArrowDown', 900)
  const e1 = await pino(pagina)
  await porPino(pagina, 0, 500)
  await segurar(pagina, 'ArrowLeft', 1000)
  const e2 = await pino(pagina)
  checar('O barranco segura o pino; a saída do oeste deixa passar', e1[1] < 792 - 6 && e2[0] < -40 - 11,
    `descendo 0,9 s contra o barranco sul: parou em y = ${r1(e1[1])} (barranco em 792); pela saída do oeste chegou a x = ${r1(e2[0])} (barranco em -40)`)

  // colisão: a parede da taverna segura o pino fora da porta; a porta deixa passar e o telhado some
  await porPino(pagina, 180, 236)
  await segurar(pagina, 'ArrowUp', 900)
  const b1 = await pino(pagina)
  checar('A parede da casa segura o pino (fora da porta)', b1[1] >= 198 + 2 + 11 - 0.5, `subindo 0,9 s contra a taverna: parou em y = ${r1(b1[1])} (parede em 198)`)
  await porPino(pagina, 248, 232)
  await esperarQuadro(pagina)
  // um ponto de assoalho sem móvel em cima (em 160, 110 fica um prato da mesa)
  const corTelhadoFora = await corNoMundo(pagina, 100, 180)
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
  const corTelhadoDentro = await corNoMundo(pagina, 100, 180)
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
  // A prova roda numa página nova, como a de quem abre o link: sem as leituras de pixel (getImageData)
  // que as provas acima fazem no canvas, que podem tirar o canvas da placa de vídeo. A primeira subida
  // de zoom gera as imagens 2x no meio da sessão, como acontece com a pessoa.
  // A mesma sessão na página já lida entra no detalhe, só para comparar.
  async function sessaoDeTravada(p) {
    await p.evaluate(() => window.scrollTo(0, 0))
    await p.click('#z-enquadrar')
    await porPino(p, 518, 462)
    await p.focus('#mapa')
    await p.evaluate(() => {
      window.__vila.medidas.quadros.length = 0
      window.__vila.medidas.desenho.length = 0
    })
    const caixa = await p.locator('#mapa').boundingBox()
    await p.keyboard.down('ArrowRight')
    await p.keyboard.down('ArrowDown')
    for (let i = 0; i < 8; i += 1) {
      await p.mouse.move(caixa.x + 640, caixa.y + 420)
      await p.mouse.wheel(0, i < 4 ? -240 : 240)
      await p.waitForTimeout(160)
    }
    await p.keyboard.up('ArrowDown')
    await segurar(p, 'ArrowLeft', 900)
    await p.keyboard.up('ArrowRight')
    await p.mouse.move(caixa.x + 300, caixa.y + 300)
    await p.mouse.down()
    for (let i = 0; i < 20; i += 1) await p.mouse.move(caixa.x + 300 + i * 12, caixa.y + 300 + i * 6)
    await p.mouse.up()
    await p.waitForTimeout(300)
    return p.evaluate(() => ({ quadros: window.__vila.medidas.quadros.slice(1), desenho: window.__vila.medidas.desenho.slice(), longas: window.__tarefasLongas.slice(), etapas: Object.fromEntries(window.Meio.tempoDasEtapas) }))
  }
  const paginaFluida = await abrir(contexto, url, erros)
  await esperarPronto(paginaFluida)
  const sessao = await sessaoDeTravada(paginaFluida)
  const sessaoLida = await sessaoDeTravada(pagina)
  await paginaFluida.close()
  checar(`Sem travada andando e dando zoom: intervalo entre quadros p95 ≤ ${P95_QUADRO_MAX_MS} ms`, p95(sessao.quadros) <= P95_QUADRO_MAX_MS,
    `p95 ${r1(p95(sessao.quadros))} ms em ${sessao.quadros.length} quadros (maior ${r1(Math.max(...sessao.quadros))} ms); desenhar o mapa p95 ${r1(p95(sessao.desenho))} ms. ` +
      `Na página já lida pelas provas de pixel: p95 ${r1(p95(sessaoLida.quadros))} ms, desenhar p95 ${r1(p95(sessaoLida.desenho))} ms`)
  checar(`Nenhuma tarefa longa ≥ ${TAREFA_LONGA_MS} ms (abrir, gerar 2x, andar e zoom; e a outra página, que também trocou de modo)`, sessao.longas.every((d) => d < TAREFA_LONGA_MS) && sessaoLida.longas.every((d) => d < TAREFA_LONGA_MS),
    [['página nova', sessao], ['página lida', sessaoLida]].map(([n, s]) => `${n}: ${s.longas.length ? `maior ${Math.max(...s.longas)} ms, ${s.longas.length} acima de 50 ms` : 'nenhuma acima de 50 ms'}`).join('; ') +
      `; etapas do chão (ms) na página nova: ${JSON.stringify(sessao.etapas)}`)

  const { repeticao, estilos } = await provasDeEstilo()

  // ---------- robô que anda como gente (página própria: a conta trava o quadro de propósito) ----------
  const paginaRobo = await abrir(contexto, url, erros)
  await esperarPronto(paginaRobo)
  const robo = await paginaRobo.evaluate((sementes) => {
    const v = window.__vila
    const V = v.V
    const nav = v.navegacao()
    const existe = V.CASAS.map((c) => !!V.caminho(nav, V.INICIO_DO_PINO, c.dentro))
    const saidas = window.Mae.ESTRADAS.map((e) => ({ nome: e.nome, ok: !!V.caminho(nav, V.INICIO_DO_PINO, e.fim) }))
    const corridas = []
    for (const s of sementes) for (let i = 0; i < V.CASAS.length; i += 1) corridas.push({ s, casa: V.CASAS[i].nome, ...v.robo(s, i) })
    return { modo: v.est.modo, existe, saidas, corridas }
  }, SEMENTES)
  checar('Existe caminho pelo chão andável do pino até dentro das 7 casas e até as 4 saídas', robo.modo === 'meio' && robo.existe.every(Boolean) && robo.saidas.every((s) => s.ok),
    `casas ${robo.existe.filter(Boolean).length} de 7; saídas ${robo.saidas.map((s) => `${s.nome} ${s.ok ? 'sim' : 'NÃO'}`).join(', ')}`)
  const okR = robo.corridas.filter((c) => c.ok)
  checar(`Robô com 250 ms de atraso e erro de direção chega às 7 portas e entra, nas ${SEMENTES.length} sementes (Meio-termo)`, okR.length === robo.corridas.length,
    `${okR.length} de ${robo.corridas.length}; tempo mediano ${r1(mediana(okR.map((c) => c.tempo)))} s, pior ${r1(Math.max(...okR.map((c) => c.tempo)))} s; ${robo.corridas.reduce((a, c) => a + (c.replanos || 0), 0)} vezes empacou e refez o caminho` +
      (okR.length < robo.corridas.length ? '; falhou: ' + robo.corridas.filter((c) => !c.ok).map((c) => `${c.casa}/semente ${c.s}`).join(', ') : ''))

  // ---------- mesma entrada, mesma imagem ----------
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
  const mapas = {}
  for (const modo of ['antes', 'depois', 'mother', 'meio']) {
    await pagina.click(`[data-modo="${modo}"]`)
    await esperarPronto(pagina)
    await esperarQuadro(pagina)
    mapas[modo] = await pagina.locator('#mapa').screenshot()
  }
  const recorte = async (x, y, z, w, h) => {
    await pagina.evaluate(([x, y, z]) => window.__vila.camera(x, y, z), [x, y, z])
    await pagina.waitForTimeout(250)
    await esperarPronto(pagina)
    await esperarQuadro(pagina)
    const caixa = await pagina.locator('#mapa').boundingBox()
    return pagina.screenshot({ clip: { x: caixa.x + caixa.width / 2 - w / 2, y: caixa.y + caixa.height / 2 - h / 2, width: w, height: h } })
  }
  fs.writeFileSync(path.join(PASTA, 'detalhe-poco.png'), await recorte(586, 404, 2.6, 720, 460))
  fs.writeFileSync(path.join(PASTA, 'detalhe-arvore-jardineira.png'), await recorte(706, 598, 1.8, 720, 460))
  // a porta antes (Textura) e depois (Meio-termo), mesma câmera, lado a lado
  const portaMeio = await recorte(262, 214, 3, 420, 300)
  await pagina.click('[data-modo="depois"]')
  const portaTextura = await recorte(262, 214, 3, 420, 300)
  await pagina.click('[data-modo="meio"]')
  const lado = await contexto.newPage()
  const img = (b) => 'data:image/png;base64,' + b.toString('base64')
  const figura = (titulo, b) => `<figure style="margin:0"><figcaption style="padding:0 0 6px">${titulo}</figcaption><img style="width:100%;display:block;border-radius:8px" src="${img(b)}"></figure>`
  await lado.setViewportSize({ width: 880, height: 300 })
  await lado.setContent(`<body style="margin:0;background:#1d211c;font:600 18px system-ui;color:#eee"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px">
    ${figura('Porta antes (Textura), 300%', portaTextura)}${figura('Porta polida (Meio-termo), 300%', portaMeio)}</div></body>`)
  await lado.screenshot({ path: path.join(PASTA, 'detalhe-porta.png'), fullPage: true })
  await lado.setViewportSize({ width: 2000, height: 300 })
  await lado.setContent(`<body style="margin:0;background:#1d211c;font:600 18px system-ui;color:#eee"><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px">
    ${figura('Hoje (o mapa de hoje)', mapas.antes)}${figura('Textura (o protótipo v1)', mapas.depois)}${figura('Estilo Mother', mapas.mother)}${figura('Meio-termo (mesma câmera)', mapas.meio)}</div></body>`)
  await lado.screenshot({ path: path.join(PASTA, 'lado-a-lado.png'), fullPage: true })
  await lado.close()

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
    metas: { PRIMEIRA_PINTURA_MAX_MS, P95_QUADRO_MAX_MS, TAREFA_LONGA_MS, PORTA_MIN, SEMENTES, PECAS_MIN, PECAS_MAX, TELHADO_MAX_MS, PISO_DE_LUMINANCIA, PALETA_MIN, PALETA_MAX, BLOCO, AUTOCORRELACAO_MAX, PRESENCA_MIN },
    meioTermo: estilos,
    repeticao: { grama: repeticao.grama, chao: repeticao.chao, controleTextura: repeticao.textura },
    total: resultados.length,
    passaram: ok,
    resultados,
    paleta: paleta.tons,
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
