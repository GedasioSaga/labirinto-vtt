/**
 * LABORATÓRIO das provas (window.PortaLab), usado por provas/gerar-provas.cjs no
 * Chromium do Playwright. Tudo roda o código de verdade: o drawDoors e o
 * animador propostos, os módulos novos, o Girar e o Deslizar do app, o Pixi.
 *
 * O "gravador" abaixo é um Graphics de mentira que anota as formas pedidas
 * (polígono, círculo, retângulo) e o estilo de cada preenchimento: dá a
 * geometria exata de cada quadro, sem ruído de pixel, para medir cobertura do
 * vão, centro da folha e alfa. Só tem os métodos que o desenho da porta usa.
 */
import { autoDetectRenderer, Ticker, type Graphics, type Renderer } from 'pixi.js'
import type { PortaParaDesenho } from '../portas/animacoesDePorta'
import { duracaoDoSentido } from '../portas/animacoesDePorta'
import { createAnimadorDePortas } from '../proposta/animadorDePortas'
import { drawDoors, type PortaAnimando } from '../proposta/drawDoors'
import { animacaoPorId, NOVAS, todasAsAnimacoes } from './catalogo'
import { estresseDaPagina } from './pagina'
import { ALTURA_CSS, centroNoCanvas, criarCena, LARGURA_CSS, montarFundo, paredeDaPorta, pintarNoCanvas, type Orientacao } from './palco'
import { agendarSom, duracaoDoSomS, temSom } from './som'

type Forma = { tipo: 'poli'; pontos: number[]; cor: number; alfa: number } | { tipo: 'circulo'; x: number; y: number; r: number; cor: number; alfa: number }
type Caminho = { tipo: 'poli'; pontos: number[] } | { tipo: 'circulo'; x: number; y: number; r: number } | { tipo: 'linha' }
interface Estilo {
  color?: number
  alpha?: number
}

class Gravador {
  formas: Forma[] = []
  tracos = 0
  private caminho: Caminho[] = []
  private usado = false
  private novo(): void {
    if (this.usado) {
      this.caminho = []
      this.usado = false
    }
  }
  clear(): this {
    this.formas = []
    this.tracos = 0
    this.caminho = []
    this.usado = false
    return this
  }
  beginPath(): this {
    this.caminho = []
    this.usado = false
    return this
  }
  poly(pontos: number[]): this {
    this.novo()
    this.caminho.push({ tipo: 'poli', pontos: [...pontos] })
    return this
  }
  rect(x: number, y: number, w: number, h: number): this {
    this.novo()
    this.caminho.push({ tipo: 'poli', pontos: [x, y, x + w, y, x + w, y + h, x, y + h] })
    return this
  }
  circle(x: number, y: number, r: number): this {
    this.novo()
    this.caminho.push({ tipo: 'circulo', x, y, r })
    return this
  }
  moveTo(): this {
    this.novo()
    this.caminho.push({ tipo: 'linha' })
    return this
  }
  lineTo(): this {
    return this
  }
  arc(): this {
    return this
  }
  fill(estilo: Estilo): this {
    for (const c of this.caminho) {
      if (c.tipo === 'linha') continue
      this.formas.push({ ...c, cor: estilo.color ?? 0, alfa: estilo.alpha ?? 1 })
    }
    this.usado = true
    return this
  }
  stroke(): this {
    this.tracos += this.caminho.length
    this.usado = true
    return this
  }
  /** Só para o teste: o desenho da porta usa só os métodos acima. */
  comoGraphics(): Graphics {
    return this as unknown as Graphics
  }
}

/** Troca, durante `corpo`, o `desenhar` da animação por um espião que anota cada chamada. */
function espiar<T>(id: string, corpo: (chamadas: { progresso: number; abrindo: boolean; porta: PortaParaDesenho }[]) => T): T {
  const animacao = animacaoPorId(id)
  if (animacao === null) throw new Error(`animação desconhecida: ${id}`)
  const original = animacao.desenhar
  const chamadas: { progresso: number; abrindo: boolean; porta: PortaParaDesenho }[] = []
  animacao.desenhar = (g, porta, progresso, abrindo) => {
    chamadas.push({ progresso, abrindo, porta: { ...porta } })
    original(g, porta, progresso, abrindo)
  }
  try {
    return corpo(chamadas)
  } finally {
    animacao.desenhar = original
  }
}

function catalogo() {
  return todasAsAnimacoes().map((a) => ({
    id: a.id,
    nome: a.nome,
    duracaoMs: duracaoDoSentido(a, true),
    duracaoFecharMs: duracaoDoSentido(a, false),
    curvaAbrir: a.curvaAbrir ?? null,
    curvaFechar: a.curvaFechar ?? null,
    nova: NOVAS.some((n) => n.id === a.id),
    trechosDeTremor: NOVAS.find((n) => n.id === a.id)?.trechosDeTremor ?? [],
  }))
}

/** Geometria de UM ponto do caminho (sem relógio): o que drawDoors pinta com a porta nesse progresso. */
function geometria(id: string, progresso: number, abrindo: boolean, orientacao: Orientacao = 'horizontal', zoom = 2) {
  const animacao = animacaoPorId(id)
  if (animacao === null) throw new Error(`animação desconhecida: ${id}`)
  const g = new Gravador()
  const parede = paredeDaPorta(orientacao, { aberta: !abrindo, trancada: false, animacao: id, cor: undefined })
  const animando = new Map<string, PortaAnimando>([['porta', { animacao, progresso, abrindo }]])
  return espiar(id, (chamadas) => {
    drawDoors(g.comoGraphics(), [parede], null, zoom, 1, undefined, animando)
    return { formas: g.formas, tracos: g.tracos, porta: chamadas[0]?.porta ?? null }
  })
}

/**
 * Corre o ANIMADOR proposto com relógio de mentira (quadros de 1/60 s): clique em
 * t = 0, inversão opcional numa fração do tempo de abrir. Cada quadro devolve o
 * progresso que o animador deu à animação (ou null = porta parada) e a geometria.
 */
function correr(id: string, opcoes: { inverterEm?: number; reduzido?: boolean; orientacao?: Orientacao; zoom?: number; fechar?: boolean } = {}) {
  const animacao = animacaoPorId(id)
  if (animacao === null) throw new Error(`animação desconhecida: ${id}`)
  const zoom = opcoes.zoom ?? 2
  const orientacao = opcoes.orientacao ?? 'horizontal'
  const passo = 1000 / 60
  let agora = 0
  const ticker = new Ticker()
  ticker.autoStart = false
  const animador = createAnimadorDePortas({ ticker, reducedMotion: () => opcoes.reduzido === true, now: () => agora })
  const g = new Gravador()
  const abrir = opcoes.fechar !== true
  const estado = { aberta: !abrir, trancada: false, animacao: id, cor: undefined }
  return espiar(id, (chamadas) => {
    const quadros: { t: number; progresso: number | null; abrindo: boolean | null; formas: Forma[] }[] = []
    const anotar = (): void => {
      const ultima = chamadas.length > 0 ? chamadas[chamadas.length - 1] : null
      quadros.push({ t: agora, progresso: ultima?.progresso ?? null, abrindo: ultima?.abrindo ?? null, formas: g.formas })
      chamadas.length = 0
    }
    animador.desenhar(g.comoGraphics(), [paredeDaPorta(orientacao, estado)], null, zoom, 1)
    chamadas.length = 0
    estado.aberta = abrir
    animador.desenhar(g.comoGraphics(), [paredeDaPorta(orientacao, estado)], null, zoom, 1)
    anotar()
    let invertido = false
    const tempoDeIda = duracaoDoSentido(animacao, abrir)
    while (agora < 4000) {
      agora += passo
      if (opcoes.inverterEm !== undefined && !invertido && agora >= opcoes.inverterEm * tempoDeIda) {
        invertido = true
        estado.aberta = !abrir
        animador.desenhar(g.comoGraphics(), [paredeDaPorta(orientacao, estado)], null, zoom, 1)
        anotar()
        continue
      }
      if (ticker.count === 0) break
      ticker.update(agora + 1)
      anotar()
    }
    animador.cancelar()
    return { quadros, terminouEm: quadros.findIndex((q, i) => i > 0 && q.progresso === null) }
  })
}

const renderizadores = new Map<number, Promise<Renderer>>()

function renderizador(resolucao: number): Promise<Renderer> {
  let r = renderizadores.get(resolucao)
  if (r === undefined) {
    r = autoDetectRenderer({ width: LARGURA_CSS, height: ALTURA_CSS, resolution: resolucao, antialias: true, preserveDrawingBuffer: true, background: 0x2b2b2b, preference: 'webgl' })
    renderizadores.set(resolucao, r)
  }
  return r
}

/** Pinta a porta (animando num progresso, ou parada) num palco do app e devolve o canvas 2D com o resultado. */
async function pintar(opcoes: { id: string | null; progresso: number | null; abrindo: boolean; aberta: boolean; orientacao: Orientacao; zoom: number; resolucao: number; cor?: number; telhado?: boolean; trancada?: boolean }): Promise<HTMLCanvasElement> {
  const renderer = await renderizador(opcoes.resolucao)
  const cena = criarCena(opcoes.telhado === true, () => 0, () => true)
  montarFundo(cena, opcoes.orientacao, opcoes.zoom, 'escuro', opcoes.resolucao)
  const parede = paredeDaPorta(opcoes.orientacao, { aberta: opcoes.aberta, trancada: opcoes.trancada === true, animacao: opcoes.id, cor: opcoes.cor })
  const animacao = animacaoPorId(opcoes.id)
  const animando = new Map<string, PortaAnimando>()
  if (animacao !== null && opcoes.progresso !== null) animando.set('porta', { animacao, progresso: opcoes.progresso, abrindo: opcoes.abrindo })
  drawDoors(cena.portas, [parede], null, opcoes.zoom, opcoes.resolucao, undefined, animando)
  if (cena.portasNoTelhado !== null) drawDoors(cena.portasNoTelhado, [parede], null, opcoes.zoom, opcoes.resolucao, undefined, animando)
  const tela = document.createElement('canvas')
  tela.width = LARGURA_CSS * opcoes.resolucao
  tela.height = ALTURA_CSS * opcoes.resolucao
  const ctx = tela.getContext('2d', { willReadFrequently: true })
  if (ctx === null) throw new Error('canvas 2D indisponível')
  pintarNoCanvas(renderer, cena, ctx)
  cena.raiz.destroy({ children: true })
  return tela
}

function pixelsDiferentes(a: HTMLCanvasElement, b: HTMLCanvasElement): number {
  const da = a.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, a.width, a.height).data
  const dbb = b.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, b.width, b.height).data
  if (da === undefined || dbb === undefined) throw new Error('sem leitura de pixel')
  let diferentes = 0
  for (let i = 0; i < da.length; i += 4) if (da[i] !== dbb[i] || da[i + 1] !== dbb[i + 1] || da[i + 2] !== dbb[i + 2] || da[i + 3] !== dbb[i + 3]) diferentes += 1
  return diferentes
}

/** M1: progresso 0 (abrindo) = fechada parada; progresso 1 (fechando) = aberta parada. Pixel a pixel. */
async function extremos(ids?: string[]) {
  const linhas: { id: string; orientacao: Orientacao; zoom: number; resolucao: number; telhado: boolean; fechadaDiferentes: number; abertaDiferentes: number }[] = []
  for (const id of ids ?? todasAsAnimacoes().map((a) => a.id)) {
    for (const orientacao of ['horizontal', 'vertical'] as const) {
      for (const zoom of [1, 2, 4]) {
        for (const resolucao of [1, 2]) {
          for (const telhado of [false, true]) {
            if (telhado && (zoom !== 2 || resolucao !== 1 || orientacao !== 'horizontal')) continue
            const base = { id, orientacao, zoom, resolucao, telhado }
            const fechadaAnim = await pintar({ ...base, progresso: 0, abrindo: true, aberta: false })
            const fechadaParada = await pintar({ ...base, progresso: null, abrindo: true, aberta: false })
            const abertaAnim = await pintar({ ...base, progresso: 1, abrindo: false, aberta: true })
            const abertaParada = await pintar({ ...base, progresso: null, abrindo: false, aberta: true })
            linhas.push({ ...base, fechadaDiferentes: pixelsDiferentes(fechadaAnim, fechadaParada), abertaDiferentes: pixelsDiferentes(abertaAnim, abertaParada) })
          }
        }
      }
    }
  }
  return linhas
}

/** Um quadro recortado em volta da porta, como PNG (para a folha de contato). */
async function quadroPng(opcoes: { id: string; progresso: number | null; abrindo: boolean; aberta: boolean; orientacao: Orientacao; zoom: number; cor?: number; telhado?: boolean; trancada?: boolean; recorte?: { x: number; y: number; w: number; h: number } }): Promise<string> {
  const resolucao = 2
  const tela = await pintar({ ...opcoes, resolucao })
  const centro = centroNoCanvas(opcoes.orientacao)
  const r = opcoes.recorte ?? { x: centro.x - 70, y: centro.y - 30, w: 140, h: 110 }
  const saida = document.createElement('canvas')
  saida.width = r.w * resolucao
  saida.height = r.h * resolucao
  saida.getContext('2d')?.drawImage(tela, r.x * resolucao, r.y * resolucao, r.w * resolucao, r.h * resolucao, 0, 0, saida.width, saida.height)
  return saida.toDataURL('image/png')
}

/** Som de um sentido renderizado OFFLINE (48 kHz, mono), com o mesmo código do botão Ouvir. Volta em base64 de Float32. */
async function som(id: string, abrindo: boolean): Promise<{ taxa: number; base64: string; duracaoS: number; animacaoS: number }> {
  const animacao = animacaoPorId(id)
  if (animacao === null || !temSom(id)) throw new Error(`sem som: ${id}`)
  const taxa = 48000
  const inicio = 0.01
  const duracaoS = inicio + duracaoDoSomS(animacao, abrindo) + 0.05
  const ctx = new OfflineAudioContext(1, Math.ceil(duracaoS * taxa), taxa)
  agendarSom(ctx, ctx.destination, id, abrindo, inicio, animacao)
  const buffer = await ctx.startRendering()
  const dados = buffer.getChannelData(0)
  const bytes = new Uint8Array(dados.buffer, dados.byteOffset, dados.byteLength)
  let binario = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return { taxa, base64: btoa(binario), duracaoS, animacaoS: duracaoDoSentido(animacao, abrindo) / 1000 }
}

async function estresse(ms = 4000) {
  const e = estresseDaPagina()
  if (e === null) throw new Error('a página ainda não montou as 50 portas')
  return e.rodar(ms)
}

export function instalarLaboratorio(): void {
  Object.assign(window, { PortaLab: { catalogo, geometria, correr, extremos, quadroPng, som, estresse } })
}
