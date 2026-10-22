import { Application, Container, Graphics, Rectangle, Ticker, UPDATE_PRIORITY } from 'pixi.js'
import { createAnimadorDePortas } from '../../../../client/src/pixi/animadorDePortas'
import { drawDoors, type PortaAnimando } from '../../../../client/src/pixi/drawDoors'
import { drawWalls } from '../../../../client/src/pixi/drawWalls'
import { ABAFADOR_HZ } from '../../../../client/src/lib/sons/contexto'
import { animacaoDePorta, duracaoDoSentido, GIRO_ABERTA_RAD } from '../../../../client/src/portas/animacoesDePorta'
import { agendarSomDePorta, type EventoDeSomDaPorta } from '../../../../client/src/portas/somDePorta'
import type { DoorState, Wall } from '../../../../client/src/types/map'

/**
 * LABORATÓRIO DAS PROVAS da porta (fatia 22): roda no Chromium com o código
 * REAL do app (Pixi, `drawDoors`, `createAnimadorDePortas`,
 * `agendarSomDePorta`), empacotado pelo `gerar-provas.cjs`. Cada função
 * devolve dados; quem grava arquivo e julga as metas é o gerador.
 */

const QUADRO_MS = 1000 / 60
const LARGURA = 240
const ALTURA = 170
const ZOOM_DA_FOLHA = 2
const CHAO = 0x1b1711

export interface Linha {
  titulo: string
  /** Porta no começo e no fim do abrir; o fechar volta da segunda à primeira. */
  fechada: Partial<DoorState>
  aberta: Partial<DoorState>
}

function porta(door: Partial<DoorState>, id = 'porta', x = 0, y = 0): Wall {
  return { id, x1: x, y1: y, x2: x + 100, y2: y, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', ...door } }
}

function parede(id: string, x1: number, x2: number, y = 0): Wall {
  return { id, x1, y1: y, x2, y2: y, blocksLight: true, blocksMove: true, door: null }
}

let app: Application | null = null

async function aplicacao(): Promise<Application> {
  if (app !== null) return app
  const nova = new Application()
  // Sem antialias: borda serrilhada é 0 ou 255 de alfa, e a prova de "opaco" lê o alfa de cada pixel.
  await nova.init({ width: 1200, height: 800, antialias: false, backgroundAlpha: 0, preference: 'webgl', resolution: 1, autoStart: false })
  app = nova
  return nova
}

/** Um palco com chão, paredes dos lados e a camada das portas, como no editor. */
function palco(zoom: number, comChao: boolean) {
  const cena = new Container()
  const mundo = new Container()
  if (comChao) cena.addChild(new Graphics().rect(0, 0, LARGURA, ALTURA).fill({ color: CHAO }))
  cena.addChild(mundo)
  mundo.scale.set(zoom)
  mundo.position.set(LARGURA / 2 - 50 * zoom, ALTURA * 0.24)
  const paredes = new Graphics()
  const portas = new Graphics()
  mundo.addChild(paredes, portas)
  drawWalls(paredes, [parede('w1', -80, 0), parede('w2', 100, 180)], null, zoom, 1)
  return { cena, portas }
}

function relogio() {
  const ticker = new Ticker()
  let agora = 1000
  return {
    ticker,
    agora: () => agora,
    andar(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

/** Os tempos de uma linha da folha: 8 no abrir (0 ao fim) e 6 no fechar. */
function temposDaFolha(abrirMs: number, fecharMs: number): { sentido: 'abrir' | 'fechar'; ms: number }[] {
  const abrir = Array.from({ length: 8 }, (_, i) => ({ sentido: 'abrir' as const, ms: Math.round((abrirMs * i) / 7) }))
  const fechar = Array.from({ length: 6 }, (_, i) => ({ sentido: 'fechar' as const, ms: Math.round((fecharMs * (i + 1)) / 6) }))
  return [...abrir, ...fechar]
}

async function quadro(renderizador: Application, alvo: Container): Promise<string> {
  renderizador.renderer.render(alvo)
  return renderizador.renderer.extract.base64({ target: alvo, frame: new Rectangle(0, 0, LARGURA, ALTURA) })
}

/** Quadros de uma linha da folha de contato, pelo animador real no relógio de mentira. */
async function linhaDaFolha(id: string, linha: Linha): Promise<{ titulo: string; quadros: { src: string; rotulo: string }[] }> {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const renderizador = await aplicacao()
  const { cena, portas } = palco(ZOOM_DA_FOLHA, true)
  const r = relogio()
  const animador = createAnimadorDePortas({ ticker: r.ticker, reducedMotion: () => false, now: r.agora })
  const comAnimacao = (d: Partial<DoorState>): Wall[] => [porta({ ...d, animacao: id })]
  const quadros: { src: string; rotulo: string }[] = []
  let sentidoAtual: 'abrir' | 'fechar' | null = null
  let andado = 0
  for (const { sentido, ms } of temposDaFolha(duracaoDoSentido(animacao, true), duracaoDoSentido(animacao, false))) {
    if (sentido !== sentidoAtual) {
      animador.desenhar(portas, comAnimacao(sentido === 'abrir' ? linha.fechada : linha.aberta), null, ZOOM_DA_FOLHA, 1)
      animador.desenhar(portas, comAnimacao(sentido === 'abrir' ? linha.aberta : linha.fechada), null, ZOOM_DA_FOLHA, 1)
      sentidoAtual = sentido
      andado = 0
    }
    if (ms > andado) r.andar(ms - andado)
    andado = ms
    quadros.push({ src: await quadro(renderizador, cena), rotulo: `${sentido} ${ms} ms` })
  }
  animador.cancelar()
  cena.destroy({ children: true })
  return { titulo: linha.titulo, quadros }
}

/** Pixels (RGBA) do palco sem chão: só paredes e porta, fundo transparente. */
function pixels(renderizador: Application, alvo: Container): Uint8ClampedArray {
  renderizador.renderer.render(alvo)
  return renderizador.renderer.extract.pixels({ target: alvo, frame: new Rectangle(0, 0, LARGURA, ALTURA) }).pixels
}

/**
 * M1 e M2: o fim do abrir e do fechar pelo animador contra a porta parada
 * (pixels diferentes), e o alfa de cada pixel em cada quadro do caminho.
 */
async function extremosEOpacidade(id: string, linha: Linha, zoom: number): Promise<{ diferentesNoFimDoAbrir: number; diferentesNoFimDoFechar: number; pixelsTranslucidos: number; quadros: number }> {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const renderizador = await aplicacao()
  const animado = palco(zoom, false)
  const parado = palco(zoom, false)
  const r = relogio()
  const animador = createAnimadorDePortas({ ticker: r.ticker, reducedMotion: () => false, now: r.agora })
  const comAnimacao = (d: Partial<DoorState>): Wall[] => [porta({ ...d, animacao: id })]
  const diferentes = (a: Uint8ClampedArray, b: Uint8ClampedArray): number => {
    let n = 0
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n += 1
    return n
  }
  let translucidos = 0
  let quadros = 0
  const contarAlfa = (p: Uint8ClampedArray): void => {
    for (let i = 3; i < p.length; i += 4) if (p[i] !== 0 && p[i] !== 255) translucidos += 1
    quadros += 1
  }
  const caminho = (de: Partial<DoorState>, para: Partial<DoorState>, abrindo: boolean): number => {
    animador.desenhar(animado.portas, comAnimacao(de), null, zoom, 1)
    animador.desenhar(animado.portas, comAnimacao(para), null, zoom, 1)
    const fim = duracaoDoSentido(animacao, abrindo)
    for (let t = 0; t < fim + QUADRO_MS; t += QUADRO_MS) {
      contarAlfa(pixels(renderizador, animado.cena))
      r.andar(QUADRO_MS)
    }
    drawDoors(parado.portas, comAnimacao(para), null, zoom, 1)
    return diferentes(pixels(renderizador, animado.cena), pixels(renderizador, parado.cena))
  }
  const diferentesNoFimDoAbrir = caminho(linha.fechada, linha.aberta, true)
  const diferentesNoFimDoFechar = caminho(linha.aberta, linha.fechada, false)
  animador.cancelar()
  animado.cena.destroy({ children: true })
  parado.cena.destroy({ children: true })
  return { diferentesNoFimDoAbrir, diferentesNoFimDoFechar, pixelsTranslucidos: translucidos, quadros }
}

type Instrucao = Graphics['context']['instructions'][number]

function pontosDo(instrucao: Instrucao): number[] {
  if (instrucao.action !== 'fill') return []
  const poly = instrucao.data.path.instructions.find((i) => i.action === 'poly')
  if (poly === undefined || poly.action !== 'poly') return []
  const [plano] = poly.data
  return Array.isArray(plano) ? plano.filter((v): v is number => typeof v === 'number') : []
}

/** A folha (último preenchimento) e a sombra (o miolo, penúltimo) de um Graphics sem pai. */
function leitura(g: Graphics): { angulo: number; comprimento: number; sombraPx: number } | null {
  const fills = g.context.instructions.filter((i) => i.action === 'fill')
  const folha = fills[fills.length - 1]
  if (folha === undefined) return null
  const p = pontosDo(folha)
  if (p.length < 8) return null
  const ax = p[2] - p[0]
  const ay = p[3] - p[1]
  const centro = (q: number[]) => ({ x: (q[0] + q[2] + q[4] + q[6]) / 4, y: (q[1] + q[3] + q[5] + q[7]) / 4 })
  const miolo = fills.length >= 3 ? pontosDo(fills[fills.length - 2]) : []
  const sombraPx = miolo.length >= 8 ? centro(miolo).y - centro(p).y : 0
  return { angulo: (Math.atan2(ay, ax) * 180) / Math.PI, comprimento: Math.hypot(ax, ay), sombraPx }
}

export interface Amostra {
  ms: number
  /** Quanto a porta já abriu, de 0 a 1. Girar: ângulo da folha / 70°. Deslizar: parte do vão já livre da folha. */
  caminho: number
  /** Comprimento da folha / folha inteira. */
  folha: number
  sombraPx: number
}

/**
 * Gráfico do movimento: o animador real num Graphics sem pai (tudo no mesmo,
 * a leitura fica simples), amostrado a cada quadro de 60 Hz. `inverterEm` =
 * fração do tempo do abrir em que a porta volta a fechar (M5).
 */
function amostrar(id: string, abrindo: boolean, inverterEm: number | null = null, reduzido = false): { amostras: Amostra[]; sons: EventoDeSomDaPorta[]; quadrosIntermediarios: number } {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const g = new Graphics()
  const r = relogio()
  const sons: EventoDeSomDaPorta[] = []
  const animador = createAnimadorDePortas({ ticker: r.ticker, reducedMotion: () => reduzido, now: r.agora, som: (e) => sons.push(e) })
  const comAnimacao = (open: boolean): Wall[] => [porta({ animacao: id, open })]
  const folhaInteira = 60
  const ler = (ms: number): Amostra => {
    const l = leitura(g)
    // Sem folha = só o batente: a porta aberta, nas duas.
    if (l === null) return { ms, caminho: 1, folha: 0, sombraPx: 0 }
    const caminho = id === 'girar' ? Math.abs(l.angulo) / ((GIRO_ABERTA_RAD * 180) / Math.PI) : 1 - l.comprimento / folhaInteira
    return { ms, caminho, folha: l.comprimento / folhaInteira, sombraPx: l.sombraPx }
  }
  animador.desenhar(g, comAnimacao(!abrindo))
  animador.desenhar(g, comAnimacao(abrindo))
  const amostras: Amostra[] = [ler(0)]
  const total = duracaoDoSentido(animacao, abrindo) * 2
  let invertido = false
  let intermediarios = 0
  for (let ms = QUADRO_MS; ms <= total + QUADRO_MS; ms += QUADRO_MS) {
    r.andar(QUADRO_MS)
    if (inverterEm !== null && !invertido && ms >= duracaoDoSentido(animacao, abrindo) * inverterEm) {
      animador.desenhar(g, comAnimacao(!abrindo))
      invertido = true
    }
    const amostra = ler(ms)
    if (r.ticker.count > 0) intermediarios += 1
    amostras.push(amostra)
  }
  animador.cancelar()
  g.destroy()
  return { amostras, sons, quadrosIntermediarios: intermediarios }
}

/** M4: o ângulo da medalha da ficha, com a MESMA curva de CSS, avaliado pelo navegador (Web Animations). */
function anguloDaMedalha(duracaoMs: number, tempos: readonly number[]): number[] {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const anim = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(70deg)' }], { duration: duracaoMs, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', fill: 'both' })
  anim.pause()
  const angulos = tempos.map((t) => {
    anim.currentTime = Math.min(t, duracaoMs)
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform)
    if (m === null) return 0
    const [a, b] = m[1].split(',').map(Number)
    return (Math.atan2(b, a) * 180) / Math.PI
  })
  anim.cancel()
  el.remove()
  return angulos
}

/** Renderização offline de um evento de som, com o mestre e o passa-baixa da mesa (`lib/sons/contexto.ts`). */
async function renderizarSom(evento: EventoDeSomDaPorta): Promise<{ amostras: number[]; taxa: number; inicioS: number; fimS: number }> {
  const taxa = 48000
  const inicioS = 0.05
  const duracaoS = 1.2
  const ctx = new OfflineAudioContext(1, Math.ceil(duracaoS * taxa), taxa)
  const mestre = ctx.createGain()
  const abafador = ctx.createBiquadFilter()
  abafador.type = 'lowpass'
  abafador.frequency.setValueAtTime(ABAFADOR_HZ, 0)
  mestre.connect(abafador)
  abafador.connect(ctx.destination)
  // No volume máximo da mesa (o toque recebe volume² = 1).
  // `AudioNode` explícito: o `connect` do Web Audio também aceita AudioParam, e a inferência escolheria esse.
  const fimS = agendarSomDePorta<AudioNode>(ctx, mestre, inicioS, evento)
  const buffer = await ctx.startRendering()
  return { amostras: Array.from(buffer.getChannelData(0)), taxa, inicioS, fimS }
}

/**
 * M7: 60 portas (6 x 10) no relógio REAL do Pixi, abrindo e fechando a cada
 * 400 ms por `duracaoMs`: só a primeira (`umaSo`) ou as 60. Mede o intervalo
 * entre quadros (rAF), as tarefas longas e o custo do animador por quadro
 * (dois ouvintes do ticker, um logo antes e outro logo depois dele).
 */
async function estresse(umaSo: boolean, duracaoMs: number): Promise<{ intervalos: number[]; tarefasLongas: number[]; custoDoAnimador: number[]; portas: number; observadorAtivo: boolean }> {
  const renderizador = new Application()
  await renderizador.init({ width: 1280, height: 720, antialias: true, background: CHAO, preference: 'webgl', resolution: 1 })
  document.body.appendChild(renderizador.canvas)
  const mundo = new Container()
  mundo.scale.set(0.9)
  const paredes = new Graphics()
  const portas = new Graphics()
  mundo.addChild(paredes, portas)
  renderizador.stage.addChild(mundo)
  const fechadas: Wall[] = []
  for (let linha = 0; linha < 6; linha += 1) for (let coluna = 0; coluna < 10; coluna += 1) fechadas.push(porta({ animacao: (linha + coluna) % 2 === 0 ? 'girar' : 'deslizar' }, `p${linha}-${coluna}`, 20 + coluna * 140, 40 + linha * 130))
  drawWalls(paredes, fechadas.map((w, i) => parede(`w${i}`, w.x1 - 20, w.x1, w.y1)), null, 0.9, 1)
  const animador = createAnimadorDePortas({ ticker: renderizador.ticker, reducedMotion: () => false })
  let abertas = false
  const estado = (): Wall[] => fechadas.map((w, i) => (umaSo && i > 0) || w.door === null ? w : { ...w, door: { ...w.door, open: abertas } })
  animador.desenhar(portas, estado(), null, 0.9, 1)
  const custoDoAnimador: number[] = []
  let antes = 0
  const marcarAntes = (): void => {
    antes = performance.now()
  }
  const marcarDepois = (): void => {
    custoDoAnimador.push(performance.now() - antes)
  }
  renderizador.ticker.add(marcarAntes, undefined, UPDATE_PRIORITY.NORMAL + 1)
  renderizador.ticker.add(marcarDepois, undefined, UPDATE_PRIORITY.NORMAL - 1)
  const tarefasLongas: number[] = []
  let observadorAtivo = false
  const observador = new PerformanceObserver((lista) => {
    for (const e of lista.getEntries()) tarefasLongas.push(e.duration)
  })
  try {
    observador.observe({ type: 'longtask', buffered: false })
    observadorAtivo = true
  } catch {
    observadorAtivo = false
  }
  const intervalos: number[] = []
  const troca = setInterval(() => {
    abertas = !abertas
    animador.desenhar(portas, estado(), null, 0.9, 1)
  }, 400)
  await new Promise<void>((pronto) => {
    let anterior = performance.now()
    const inicio = anterior
    const passo = (agora: number): void => {
      intervalos.push(agora - anterior)
      anterior = agora
      if (agora - inicio < duracaoMs) requestAnimationFrame(passo)
      else pronto()
    }
    requestAnimationFrame(passo)
  })
  clearInterval(troca)
  observador.disconnect()
  animador.cancelar()
  renderizador.destroy(true, { children: true })
  return { intervalos: intervalos.slice(1), tarefasLongas, custoDoAnimador, portas: fechadas.length, observadorAtivo }
}

/**
 * M7, o ganho do conserto: custo de CPU de um quadro com 1 porta andando entre
 * 60 — repintar as 60 (o de antes) contra repintar só a que anda (o de agora).
 */
function custoPorQuadro(): { todasMs: number; soAQueAndaMs: number } {
  const g = new Graphics()
  const walls: Wall[] = Array.from({ length: 60 }, (_, i) => porta({ animacao: 'girar' }, `p${i}`, (i % 10) * 140, Math.floor(i / 10) * 130))
  const animacao = animacaoDePorta('girar')
  if (animacao === null) throw new Error('sem girar')
  const animando = new Map<string, PortaAnimando>([['p0', { animacao, progresso: 0.4, abrindo: true }]])
  const vezes = 400
  const medir = (desenhar: () => void): number => {
    for (let i = 0; i < 40; i += 1) desenhar()
    const inicio = performance.now()
    for (let i = 0; i < vezes; i += 1) desenhar()
    return (performance.now() - inicio) / vezes
  }
  const primeira = walls.slice(0, 1)
  const todasMs = medir(() => drawDoors(g, walls, null, 1, 1, undefined, animando))
  const soAQueAndaMs = medir(() => drawDoors(g, primeira, null, 1, 1, undefined, animando))
  g.destroy()
  return { todasMs, soAQueAndaMs }
}

/** Folha de contato: as linhas, um quadro ao lado do outro, o tempo embaixo de cada um. */
async function compor(titulo: string, linhas: { titulo: string; quadros: { src: string; rotulo: string }[] }[]): Promise<string> {
  const carregar = (src: string) =>
    new Promise<HTMLImageElement>((ok, erro) => {
      const img = new Image()
      img.onload = () => ok(img)
      img.onerror = () => erro(new Error('quadro não carregou'))
      img.src = src
    })
  const colunas = Math.max(...linhas.map((l) => l.quadros.length))
  const margem = 24
  const espaco = 6
  const c = document.createElement('canvas')
  c.width = margem * 2 + colunas * LARGURA + (colunas - 1) * espaco
  c.height = 70 + linhas.length * (34 + ALTURA + 30) + margem
  const g = c.getContext('2d')
  if (g === null) throw new Error('sem canvas 2D')
  g.fillStyle = '#fcfcfb'
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#0b0b0b'
  g.font = '600 26px system-ui, sans-serif'
  g.fillText(titulo, margem, 42)
  let y = 70
  for (const linha of linhas) {
    g.fillStyle = '#52514e'
    g.font = '500 19px system-ui, sans-serif'
    g.fillText(linha.titulo, margem, y + 22)
    y += 34
    for (let i = 0; i < linha.quadros.length; i += 1) {
      const x = margem + i * (LARGURA + espaco)
      g.drawImage(await carregar(linha.quadros[i].src), x, y, LARGURA, ALTURA)
      g.fillStyle = '#0b0b0b'
      g.font = '500 16px system-ui, sans-serif'
      const texto = linha.quadros[i].rotulo
      g.fillText(texto, x + (LARGURA - g.measureText(texto).width) / 2, y + ALTURA + 22)
    }
    y += ALTURA + 30
  }
  return c.toDataURL('image/png')
}

export interface Painel {
  titulo: string
  duracaoMs: number
  series: { nome: string; cor: string; pontos: [number, number][] }[]
  /** Volume do som (RMS, dBFS) na mesma linha do tempo, a cada 10 ms. */
  som: [number, number][]
  somResumo: string
}

/** Gráfico do movimento: em cima as séries de 0 a 1 (sombra em px dividida por 2), embaixo o som em dB. */
function grafico(titulo: string, paineis: Painel[]): string {
  const W = 1500
  const H = 680
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  if (g === null) throw new Error('sem canvas 2D')
  g.fillStyle = '#fcfcfb'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#0b0b0b'
  g.font = '600 24px system-ui, sans-serif'
  g.fillText(titulo, 32, 40)
  g.fillStyle = '#52514e'
  g.font = '400 15px system-ui, sans-serif'
  g.fillText('Amostras a cada quadro de 60 Hz, pelo animador real. Em cima, de 0 a 1: caminho, folha e sombra (px / 2). Embaixo: volume do som (RMS, dBFS) a cada 10 ms, mesma linha do tempo.', 32, 64)
  const largura = (W - 80 - (paineis.length - 1) * 40) / paineis.length
  paineis.forEach((p, k) => {
    const x0 = 70 + k * (largura + 40)
    const x1 = x0 + largura - 10
    const tMax = Math.max(p.duracaoMs * 1.6, 200)
    const X = (t: number): number => x0 + (Math.min(t, tMax) / tMax) * (x1 - x0)
    const topo = 120
    const base = 400
    const Y = (v: number): number => base - Math.max(0, Math.min(1.05, v)) * (base - topo)
    g.fillStyle = '#0b0b0b'
    g.font = '600 17px system-ui, sans-serif'
    g.fillText(p.titulo, x0, 106)
    g.strokeStyle = '#e4e3df'
    g.lineWidth = 1
    g.font = '400 13px system-ui, sans-serif'
    g.fillStyle = '#52514e'
    for (const v of [0, 0.5, 1]) {
      g.beginPath()
      g.moveTo(x0, Y(v))
      g.lineTo(x1, Y(v))
      g.stroke()
      g.fillText(String(v).replace('.', ','), x0 - 28, Y(v) + 4)
    }
    for (let t = 0; t <= tMax; t += 100) g.fillText(`${t}`, X(t) - 10, base + 18)
    g.fillText('ms', x1 - 16, base + 34)
    let legenda = topo - 2
    for (const serie of p.series) {
      g.strokeStyle = serie.cor
      g.lineWidth = 2
      g.beginPath()
      serie.pontos.forEach(([t, v], i) => (i === 0 ? g.moveTo(X(t), Y(v)) : g.lineTo(X(t), Y(v))))
      g.stroke()
      g.fillStyle = serie.cor
      for (const [t, v] of serie.pontos) g.fillRect(X(t) - 2, Y(v) - 2, 4, 4)
      g.font = '500 13px system-ui, sans-serif'
      g.fillText(serie.nome, x1 - g.measureText(serie.nome).width, legenda + 16)
      legenda += 16
    }
    const sTopo = 460
    const sBase = 620
    const dbMin = -80
    const S = (db: number): number => sBase - ((Math.max(dbMin, db) - dbMin) / -dbMin) * (sBase - sTopo)
    g.strokeStyle = '#e4e3df'
    g.fillStyle = '#52514e'
    g.font = '400 13px system-ui, sans-serif'
    for (const db of [-80, -40, 0]) {
      g.beginPath()
      g.moveTo(x0, S(db))
      g.lineTo(x1, S(db))
      g.stroke()
      g.fillText(`${db} dB`, x0 - 52, S(db) + 4)
    }
    g.strokeStyle = '#1baf7a'
    g.lineWidth = 2
    g.beginPath()
    p.som.forEach(([t, db], i) => (i === 0 ? g.moveTo(X(t), S(db)) : g.lineTo(X(t), S(db))))
    g.stroke()
    g.fillStyle = '#0b0b0b'
    g.fillText(`som (${p.somResumo})`, x0, sTopo - 8)
    g.strokeStyle = '#52514e'
    g.setLineDash([4, 4])
    g.beginPath()
    g.moveTo(X(p.duracaoMs), topo)
    g.lineTo(X(p.duracaoMs), sBase)
    g.stroke()
    g.setLineDash([])
    g.fillText(`fim: ${p.duracaoMs} ms`, X(p.duracaoMs) + 4, sBase + 18)
  })
  return c.toDataURL('image/png')
}

declare global {
  interface Window {
    PortaSom: typeof api
  }
}

const api = { linhaDaFolha, extremosEOpacidade, amostrar, anguloDaMedalha, renderizarSom, estresse, custoPorQuadro, compor, grafico }

window.PortaSom = api
document.documentElement.dataset.pronto = 'sim'
