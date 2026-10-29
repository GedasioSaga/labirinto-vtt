/**
 * A mesa de prova dos carimbos e trechos do Desenhado (onda 3; CONTRATO.md, seção 9), no
 * NAVEGADOR: o Canvas 2D é o mesmo motor que o app usa para assar os carimbos de hoje.
 * O ferramentas/carimbo.ts abre esta página no Chromium do Playwright e chama
 * `window.mesaDoCarimbo(dados)`, que devolve os painéis em PNG (data URL).
 *
 * - O Desenhado é montado pela conta do contrato (9.4): a imagem nunca gira; o giro escolhe
 *   o arquivo e o espelho diagonal; a sombra é a silhueta andada e desfocada numa camada só.
 * - O Atual é o carimbo de hoje, com o código do PRÓPRIO app: `assarDesenho` (arte.ts) em
 *   256 texels (LADO_DA_ARTE de pixi/drawCarimbos.ts), a sombra da silhueta numa camada só
 *   com ALFA_DA_SOMBRA, os corpos por cima, como `drawCarimbos.ts`.
 * - Os dois usam os MESMOS objetos, soltos pelo spray do app (`criarSpray`, lib/carimbos.ts)
 *   com sorteio de semente fixa, no mapa de referência (200 x 200 casas).
 */
import { CARIMBOS_EMBUTIDOS, type DefinicaoDeCarimbo } from '../../../client/src/carimbos/embutidos'
import { ALFA_DA_SOMBRA, assarDesenho, QUADRO_DA_SOMBRA, type ArteEmTela } from '../../../client/src/carimbos/arte'
import { criarSpray, raioDoSpray, tamanhoNatural, varianteDoGiro } from '../../../client/src/lib/carimbos'
import type { Carimbo } from '../../../client/src/types/map'
import desenharGirassol from '../../../client/src/animacoes/carimbo/girassol'
import desenharGirassois from '../../../client/src/animacoes/carimbo/girassois'
import infoGirassol from '../../../client/src/animacoes/carimbo/girassol.json'
import infoGirassois from '../../../client/src/animacoes/carimbo/girassois.json'

/** pixi/drawCarimbos.ts, LADO_DA_ARTE (não importado: o arquivo puxa o Pixi inteiro). */
const LADO_DA_ARTE = 256
const GRID = 64
/** O mapa de referência: o mapa real do usuário, 200 x 200 casas (lib/relevo.ts, unidadeDoRelevo). */
const UNIDADE_REF = (200 * GRID) / 1242

interface SombraComum { direcao: [number, number]; borrao: number; alfa: number; cor: string }
/** A sombra "em-pe" (só carimbo): a silhueta deitada a partir do pé, como matrizDaSombra('em-pe') do app. */
type Sombra = SombraComum & ({ jeito: 'deslocada' | 'nenhuma'; deslocamento: number } | { jeito: 'em-pe'; comprimento: number })
type Espelho = 'diagonal' | 'nenhum'
interface Params {
  tipo: 'carimbo' | 'trecho'
  idDoApp: string
  destino?: 'carimbo' | 'movel'
  tamanhoDoApp?: number
  sprite?: { arquivos: string[]; ladoPx: number; unidadePx: number; ancoraPx: [number, number] }
  formas?: { variacoes: number; espelho?: Espelho }
  sombra: Sombra
  curva?: boolean
  casas?: [number, number]
  trecho?: { comprimentoPx: number; meiaLarguraPx: number; pontaPx: number; larguraImagemPx: number; alturaImagemPx: number }
  luz?: { forca: number; direcao: [number, number] }
}
interface Dados {
  params: Params
  sprites: string[]
  trecho: { cor: string; relevo: string } | null
  chao: { bosque100: string; soz100: string; soz300: string }
  atualChao: string | null
  cena: { casas: number; soz: { x0: number; y0: number; casas: number } }
  semAtual: boolean
}
interface Saida { imagens: Record<string, string>; info: Record<string, unknown> }

// ---------------------------------------------------------------------------
// Utilidades

function carregar(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => falha(new Error('imagem não carregou'))
    img.src = url
  })
}

function tela(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d') as CanvasRenderingContext2D
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  return { c, g }
}

/** mulberry32: o mesmo sorteio a cada rodada. */
function sorteador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Os objetos: o spray do app, em traços fixos sobre a cena (casas)

interface Traco { escolha: number; densidade: number; largura: number; caminho: [number, number][] }
const TRACOS: Traco[] = [
  { escolha: 100, densidade: 0.5, largura: 48, caminho: [[3.5, 3.5], [8, 3], [11, 6], [9.5, 10], [5, 10.5], [3.5, 7]] },
  { escolha: 100, densidade: 1, largura: 40, caminho: [[15, 14.5], [19.5, 14], [21, 18], [19, 21], [15.5, 20]] },
  { escolha: 75, densidade: 0.35, largura: 60, caminho: [[3, 15], [6.5, 19.5], [10.5, 18.5]] },
  { escolha: 135, densidade: 0.6, largura: 44, caminho: [[15, 3.5], [20.5, 5.5], [19, 9.5]] },
]
const SOLTOS: { escolha: number; ponto: [number, number] }[] = [
  { escolha: 160, ponto: [12.5, 13] },
  { escolha: 60, ponto: [14.2, 15.4] },
  { escolha: 100, ponto: [7.5, 14] },
]

function tamanhoDoObjeto(p: Params, escolha: number): number {
  if (p.destino === 'movel') return (GRID * escolha) / 100
  return tamanhoNatural(UNIDADE_REF, GRID, p.tamanhoDoApp ?? 10, escolha)
}

function espalhar(p: Params, casas: number): Carimbo[] {
  const sorteio = sorteador(20261028)
  let n = 0
  const novoId = () => `c${n++}`
  const lista: Carimbo[] = []
  const dentro = (q: { x: number; y: number }) => q.x > GRID * 0.6 && q.y > GRID * 0.6 && q.x < GRID * (casas - 0.6) && q.y < GRID * (casas - 0.6)
  for (const t of TRACOS) {
    const spray = criarSpray({ tipo: p.idDoApp, tamanho: tamanhoDoObjeto(p, t.escolha), raio: raioDoSpray(UNIDADE_REF, t.largura), densidade: t.densidade, existentes: lista, sorteio, novoId, aceita: dentro })
    const pts = t.caminho.map(([x, y]) => ({ x: x * GRID, y: y * GRID }))
    spray.comecar(pts[0])
    for (let volta = 0; volta < 2; volta++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const passos = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 8)
        for (let k = 1; k <= passos; k++) spray.passar({ x: a.x + ((b.x - a.x) * k) / passos, y: a.y + ((b.y - a.y) * k) / passos })
      }
      pts.reverse()
    }
    lista.push(...spray.soltos())
  }
  for (const s of SOLTOS) {
    lista.push({ id: novoId(), tipo: p.idDoApp, x: s.ponto[0] * GRID, y: s.ponto[1] * GRID, tamanho: tamanhoDoObjeto(p, s.escolha), giro: Math.floor(sorteio() * 360) } as Carimbo)
  }
  return lista
}

// ---------------------------------------------------------------------------
// Desenhado: a conta do contrato (9.4)

interface Desenhado { sprites: HTMLImageElement[]; silhuetas: HTMLCanvasElement[]; p: Params }

/** A forma k (0..7): o arquivo e o espelho diagonal (com espelho "nenhum", só o arquivo). */
export function formaDoGiro(k: number, variacoes: number, espelho: Espelho = 'diagonal'): { arquivo: number; espelho: boolean } {
  return { arquivo: k % variacoes, espelho: espelho === 'diagonal' && Math.floor(k / variacoes) % 2 === 1 }
}

/**
 * A sombra "em-pe" do app (client/src/carimbos/arte.ts, matrizDaSombra): o ponto a altura h
 * acima do pé (y = -h a partir da âncora) cai h x comprimento na direção da sombra, ou seja,
 * (x, y) -> (x - l.dx.y, -l.dy.y): o pé fica, o alto se deita para baixo e para a direita.
 * Aplicada por cima da matriz do corpo (r, relativa ao pé), e o pé posto em X, Y.
 */
function deitarNoChao(g: CanvasRenderingContext2D, r: [number, number, number, number, number, number], X: number, Y: number, l: number, dx: number, dy: number): void {
  const [a, b, c, d, e, f] = r
  g.setTransform(a - l * dx * b, -l * dy * b, c - l * dx * d, -l * dy * d, X + e - l * dx * f, Y - l * dy * f)
}

function silhueta(img: HTMLImageElement, cor: string): HTMLCanvasElement {
  const { c, g } = tela(img.width, img.height)
  g.drawImage(img, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = cor
  g.fillRect(0, 0, img.width, img.height)
  return c
}

/**
 * Põe a imagem (px da imagem, âncora a) no ponto X, Y da tela, com s px da tela por px da
 * imagem. O espelho é a imagem TRANSPOSTA ((x, y) -> (y, x) nos px da imagem quadrada: a
 * copa, desenhada no meio, fica no meio) com a mesma translação: os pontos da diagonal da
 * imagem, o meio incluído, caem no mesmo lugar com e sem espelho (CONTRATO.md 9.4).
 */
function transformar(g: CanvasRenderingContext2D, X: number, Y: number, s: number, a: [number, number], espelho: boolean): void {
  if (espelho) g.setTransform(0, s, s, 0, X - s * a[0], Y - s * a[1])
  else g.setTransform(s, 0, 0, s, X - s * a[0], Y - s * a[1])
}

function pintarDesenhado(g: CanvasRenderingContext2D, d: Desenhado, objetos: Carimbo[], zoom: number, ox: number, oy: number, fixa?: number): void {
  const sp = d.p.sprite!
  const sombra = d.p.sombra
  const n = d.p.formas!.variacoes
  const espelho = d.p.formas!.espelho ?? 'diagonal'
  const ordem = [...objetos].sort((a, b) => a.y - b.y)
  const forma = (c: Carimbo) => formaDoGiro(fixa ?? varianteDoGiro(c.giro), n, espelho)
  const corpo = (gg: CanvasRenderingContext2D, c: Carimbo, img: CanvasImageSource, dx = 0, dy = 0) => {
    const f = forma(c)
    const s = (c.tamanho * zoom) / sp.unidadePx
    transformar(gg, (c.x - ox) * zoom + dx, (c.y - oy) * zoom + dy, s, sp.ancoraPx, f.espelho)
    gg.drawImage(img, 0, 0)
  }
  if (sombra.jeito === 'nenhuma') {
    // Objeto do chão (a poça de hoje): por baixo de tudo, sem sombra.
    for (const c of ordem) corpo(g, c, d.sprites[forma(c).arquivo])
    g.setTransform(1, 0, 0, 1, 0, 0)
    return
  }
  const { c: camada, g: gs } = tela(g.canvas.width, g.canvas.height)
  const [dx0, dy0] = sombra.direcao
  const nd = Math.hypot(dx0, dy0)
  for (const c of ordem) {
    const t = c.tamanho * zoom
    gs.filter = sombra.borrao > 0 ? `blur(${(sombra.borrao * t).toFixed(2)}px)` : 'none'
    if (sombra.jeito === 'em-pe') {
      const f = forma(c)
      const s = (c.tamanho * zoom) / sp.unidadePx
      const [ax, ay] = sp.ancoraPx
      const r: [number, number, number, number, number, number] = f.espelho ? [0, s, s, 0, -s * ax, -s * ay] : [s, 0, 0, s, -s * ax, -s * ay]
      deitarNoChao(gs, r, (c.x - ox) * zoom, (c.y - oy) * zoom, sombra.comprimento, dx0 / nd, dy0 / nd)
      gs.drawImage(d.silhuetas[f.arquivo], 0, 0)
    } else corpo(gs, c, d.silhuetas[forma(c).arquivo], (dx0 / nd) * sombra.deslocamento * t, (dy0 / nd) * sombra.deslocamento * t)
  }
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.globalAlpha = sombra.alfa
  g.drawImage(camada, 0, 0)
  g.globalAlpha = 1
  for (const c of ordem) corpo(g, c, d.sprites[forma(c).arquivo])
  g.setTransform(1, 0, 0, 1, 0, 0)
}

// ---------------------------------------------------------------------------
// Atual: o carimbo de hoje, com o código do app

function definicaoDoApp(id: string): DefinicaoDeCarimbo | null {
  const embutido = CARIMBOS_EMBUTIDOS.find((c) => c.id === id)
  if (embutido !== undefined) return embutido
  if (id === 'girassol') return { id, nome: infoGirassol.nome, tamanho: infoGirassol.tamanho, sombra: infoGirassol.sombra as DefinicaoDeCarimbo['sombra'], desenhar: desenharGirassol }
  if (id === 'girassois') return { id, nome: infoGirassois.nome, tamanho: infoGirassois.tamanho, sombra: infoGirassois.sombra as DefinicaoDeCarimbo['sombra'], desenhar: desenharGirassois }
  return null
}

function artesDoApp(def: DefinicaoDeCarimbo): (ArteEmTela | null)[] {
  const artes: (ArteEmTela | null)[] = []
  for (let v = 0; v < 8; v++) artes.push(assarDesenho(def.desenhar, def.sombra, (v * Math.PI) / 4, v, LADO_DA_ARTE))
  return artes
}

function pintarAtual(g: CanvasRenderingContext2D, artes: (ArteEmTela | null)[], objetos: Carimbo[], zoom: number, ox: number, oy: number, fixa?: number): void {
  const ordem = [...objetos].sort((a, b) => a.y - b.y)
  const arte = (c: Carimbo) => artes[fixa ?? varianteDoGiro(c.giro)]
  const corpo = (c: Carimbo) => {
    const a = arte(c)
    if (a === null) return
    const u = c.tamanho * zoom
    const q = a.quadro
    g.drawImage(a.corpo, (c.x - ox) * zoom + q.esquerda * u, (c.y - oy) * zoom + q.topo * u, q.lado * u, q.lado * u)
  }
  for (const c of ordem) if (arte(c)?.chao === true) corpo(c)
  const { c: camada, g: gs } = tela(g.canvas.width, g.canvas.height)
  for (const c of ordem) {
    const a = arte(c)
    if (a === null || a.sombra === null) continue
    const u = c.tamanho * zoom
    const s = QUADRO_DA_SOMBRA
    gs.drawImage(a.sombra, (c.x - ox) * zoom + s.esquerda * u, (c.y - oy) * zoom + s.topo * u, s.largura * u, s.altura * u)
  }
  g.globalAlpha = ALFA_DA_SOMBRA
  g.drawImage(camada, 0, 0)
  g.globalAlpha = 1
  for (const c of ordem) if (arte(c)?.chao !== true) corpo(c)
}

/** O centro do desenho de hoje (pelo alfa), em unidades a partir da base do objeto. */
function centroDaArte(a: ArteEmTela): { x: number; y: number; raio: number } {
  const { width: w, height: h } = a.corpo
  const dados = (a.corpo.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, w, h).data
  let sx = 0
  let sy = 0
  let s = 0
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const al = dados[(y * w + x) * 4 + 3] / 255
    sx += x * al
    sy += y * al
    s += al
  }
  const q = a.quadro
  const area = (s * 4) / (w * h)
  return { x: q.esquerda + (sx / s / w) * q.lado, y: q.topo + (sy / s / h) * q.lado, raio: Math.sqrt(area / Math.PI) * q.lado }
}

// ---------------------------------------------------------------------------
// Os painéis

function fundo(img: HTMLImageElement | HTMLCanvasElement, sx: number, sy: number, sw: number, sh: number, w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const t = tela(w, h)
  t.g.imageSmoothingQuality = 'low' // bilinear: o que a placa faz com os pedaços do chão
  t.g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  t.g.imageSmoothingQuality = 'high'
  return t
}

async function mesaDoCarimbo(d: Dados): Promise<Saida> {
  const p = d.params
  const imagens: Record<string, string> = {}
  const info: Record<string, unknown> = {}
  const casas = d.cena.casas
  const soz = d.cena.soz
  const chaoBosque = await carregar(d.chao.bosque100)
  const chaoSoz100 = await carregar(d.chao.soz100)
  const chaoSoz300 = await carregar(d.chao.soz300)
  const atualChao = d.atualChao === null ? null : await carregar(d.atualChao)
  const sprites = await Promise.all(d.sprites.map(carregar))
  const des: Desenhado = { sprites, silhuetas: sprites.map((s) => silhueta(s, p.sombra.cor)), p }
  const objetos = espalhar(p, casas)
  const sp = p.sprite!
  const n = p.formas!.variacoes
  info.objetos = objetos.length
  info.formas = p.formas!.espelho === 'nenhum' ? n : n * 2
  if (p.formas!.espelho === 'nenhum') info.tituloFormas = `As formas: o giro do mestre de 45 em 45 graus escolhe um dos ${n} desenhos (sem espelho: o desenho fica de pé; o giro k e o k + ${n} dão o mesmo), a 100%`

  // O objeto sozinho: no meio do quadrado, com a âncora onde o meio da imagem cai no meio.
  const t100 = tamanhoDoObjeto(p, 100)
  const meio = { x: (soz.x0 + soz.casas / 2) * GRID, y: (soz.y0 + soz.casas / 2) * GRID }
  const sozinho = (k: number): Carimbo => ({
    id: 's', tipo: p.idDoApp, tamanho: t100, giro: k * 45,
    x: meio.x + ((sp.ancoraPx[0] - sp.ladoPx / 2) / sp.unidadePx) * t100,
    y: meio.y + ((sp.ancoraPx[1] - sp.ladoPx / 2) / sp.unidadePx) * t100,
  } as Carimbo)
  const ladoSoz = soz.casas * GRID
  const o0 = { x: soz.x0 * GRID, y: soz.y0 * GRID }
  for (const [nome, zoom, chao] of [['soz-desenhado-100', 1, chaoSoz100], ['soz-desenhado-300', 3, chaoSoz300]] as const) {
    const { c, g } = fundo(chao, 0, 0, chao.width, chao.height, ladoSoz * zoom, ladoSoz * zoom)
    pintarDesenhado(g, des, [sozinho(0)], zoom, o0.x, o0.y, 0)
    imagens[nome] = c.toDataURL('image/png')
  }
  for (let k = 0; k < 2 * n; k++) {
    const { c, g } = fundo(chaoSoz100, 0, 0, chaoSoz100.width, chaoSoz100.height, ladoSoz, ladoSoz)
    pintarDesenhado(g, des, [sozinho(k)], 1, o0.x, o0.y, k)
    imagens[`forma-${k}`] = c.toDataURL('image/png')
  }
  {
    const { c, g } = fundo(chaoBosque, 0, 0, chaoBosque.width, chaoBosque.height, casas * GRID, casas * GRID)
    pintarDesenhado(g, des, objetos, 1, 0, 0)
    imagens['bosque-desenhado-100'] = c.toDataURL('image/png')
  }

  // O Atual.
  const def = d.semAtual ? null : definicaoDoApp(p.idDoApp)
  info.atual = def !== null && atualChao !== null
  if (d.semAtual) info.motivoAtual = 'pedido --sem-atual'
  else if (def === null) info.motivoAtual = `o app não tem carimbo '${p.idDoApp}' (móvel: o Atual ainda não é pintado aqui)`
  else if (atualChao === null) info.motivoAtual = 'a grama do Atual (ferramentas/atual.ts) não saiu'
  if (def !== null && atualChao !== null) {
    const artes = artesDoApp(def)
    const a0 = artes[0]
    const centro = a0 === null ? { x: 0, y: 0, raio: 0 } : centroDaArte(a0)
    info.centroDoAtual = { x: +centro.x.toFixed(3), y: +centro.y.toFixed(3), raio: +centro.raio.toFixed(3), sobre: 'unidades do tamanho a partir da base do objeto de hoje (o pé); raio = raio do círculo de mesma área' }
    const sozAtual = (k: number): Carimbo => ({ id: 's', tipo: p.idDoApp, tamanho: t100, giro: k * 45, x: meio.x - centro.x * t100, y: meio.y - centro.y * t100 } as Carimbo)
    for (const zoom of [1, 3]) {
      const { c, g } = fundo(atualChao, o0.x, o0.y, ladoSoz, ladoSoz, ladoSoz * zoom, ladoSoz * zoom)
      pintarAtual(g, artes, [sozAtual(0)], zoom, o0.x, o0.y, 0)
      imagens[`soz-atual-${zoom * 100}`] = c.toDataURL('image/png')
    }
    for (let k = 0; k < 8; k++) {
      const { c, g } = fundo(atualChao, o0.x, o0.y, ladoSoz, ladoSoz, ladoSoz, ladoSoz)
      pintarAtual(g, artes, [sozAtual(k)], 1, o0.x, o0.y, k)
      imagens[`atual-forma-${k}`] = c.toDataURL('image/png')
    }
    const { c, g } = fundo(atualChao, 0, 0, casas * GRID, casas * GRID, casas * GRID, casas * GRID)
    pintarAtual(g, artes, objetos, 1, 0, 0)
    imagens['bosque-atual-100'] = c.toDataURL('image/png')
  }
  info.tamanhoNoMapaRefPx = +t100.toFixed(1)
  return { imagens, info }
}

// ---------------------------------------------------------------------------
// Trecho (sebe, jardineira): a conta do contrato (9.5), pixel a pixel

interface ImagemLida { w: number; h: number; d: Uint8ClampedArray }
function lerImagem(img: HTMLImageElement): ImagemLida {
  const { g } = tela(img.width, img.height)
  g.drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data }
}

/** Bilinear, sem repetir (as bordas grudam). Devolve 4 canais de 0 a 1 (alfa reto). */
function amostrar(im: ImagemLida, x: number, y: number): [number, number, number, number] {
  const fx = Math.min(Math.max(x - 0.5, 0), im.w - 1)
  const fy = Math.min(Math.max(y - 0.5, 0), im.h - 1)
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const x1 = Math.min(x0 + 1, im.w - 1)
  const y1 = Math.min(y0 + 1, im.h - 1)
  const tx = fx - x0
  const ty = fy - y0
  const r: [number, number, number, number] = [0, 0, 0, 0]
  for (let k = 0; k < 4; k++) {
    const a = im.d[(y0 * im.w + x0) * 4 + k] * (1 - tx) + im.d[(y0 * im.w + x1) * 4 + k] * tx
    const b = im.d[(y1 * im.w + x0) * 4 + k] * (1 - tx) + im.d[(y1 * im.w + x1) * 4 + k] * tx
    r[k] = (a * (1 - ty) + b * ty) / 255
  }
  return r
}

/** Um trecho no mundo: o eixo sai de (x, y) na direção ang (rad), corda px, e verga volta graus (0 = reto). */
interface TrechoNoMundo { x: number; y: number; ang: number; corda: number; volta: number }

/** s (ao longo, 0 no começo do eixo), c (atravessando) e as direções no ponto, ou null. */
function noTrecho(t: TrechoNoMundo, px: number, py: number): { s: number; c: number; total: number; tx: number; ty: number } | null {
  const dx = Math.cos(t.ang)
  const dy = Math.sin(t.ang)
  if (Math.abs(t.volta) < 0.5) {
    const vx = px - t.x
    const vy = py - t.y
    return { s: vx * dx + vy * dy, c: -vx * dy + vy * dx, total: t.corda, tx: dx, ty: dy }
  }
  const phi = (t.volta * Math.PI) / 180
  const R = t.corda / (2 * Math.sin(Math.abs(phi) / 2))
  const sinal = Math.sign(phi)
  // O centro fica do lado n = (-dy, dx) para volta positiva.
  const mx = t.x + (dx * t.corda) / 2
  const my = t.y + (dy * t.corda) / 2
  const h = R * Math.cos(Math.abs(phi) / 2)
  const ox = mx + -dy * h * sinal
  const oy = my + dx * h * sinal
  const a0 = Math.atan2(t.y - oy, t.x - ox)
  let da = Math.atan2(py - oy, px - ox) - a0
  // O ângulo andado no sentido do arco (de -pi a pi em volta do meio do arco).
  da = (((da * sinal - phi * sinal / 2) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI + (phi * sinal) / 2
  const s = R * da
  const ang = a0 + da * sinal
  const r = Math.hypot(px - ox, py - oy)
  // A tangente no sentido de andar e o lado +c = (-ty, tx).
  const tx = -Math.sin(ang) * sinal
  const ty = Math.cos(ang) * sinal
  const qx = ox + Math.cos(ang) * R
  const qy = oy + Math.sin(ang) * R
  const c = (px - qx) * -ty + (py - qy) * tx
  return Number.isFinite(r) ? { s, c, total: R * Math.abs(phi), tx, ty } : null
}

function realce(c: number[]): number[] {
  return [c[0] * 1.1 * 0.92 + 0.98 * 0.08, c[1] * 1.1 * 0.92 + 0.93 * 0.08, c[2] * 1.1 * 0.92 + 0.7 * 0.08]
}

/** Pinta os trechos numa camada RGBA do tamanho da tela (zoom z, origem ox, oy do mundo). */
function camadaDeTrechos(p: Params, cor: ImagemLida, relevo: ImagemLida, trechos: TrechoNoMundo[], w: number, h: number, z: number, ox: number, oy: number): ImageData {
  const t = p.trecho!
  const L = t.comprimentoPx
  const meia = t.meiaLarguraPx
  const ponta = t.pontaPx
  const forca = p.luz!.forca
  const [lx, ly] = p.luz!.direcao
  const saida = new ImageData(w, h)
  for (const tr of trechos) {
    const alcance = tr.corda + ponta + meia + 4
    const x0 = Math.max(0, Math.floor((tr.x - alcance - ox) * z))
    const y0 = Math.max(0, Math.floor((tr.y - alcance - oy) * z))
    const x1 = Math.min(w, Math.ceil((tr.x + alcance - ox) * z))
    const y1 = Math.min(h, Math.ceil((tr.y + alcance - oy) * z))
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) {
      const q = noTrecho(tr, ox + (i + 0.5) / z, oy + (j + 0.5) / z)
      if (q === null || Math.abs(q.c) > meia || q.s < -ponta || q.s > q.total + ponta) continue
      let xi: number
      let sinalAoLongo = 1
      if (q.s < 0) xi = (ponta + q.s) * 2
      else if (q.s > q.total) {
        xi = (ponta + (q.total - q.s)) * 2
        sinalAoLongo = -1
      } else xi = (ponta + (q.s % L)) * 2
      const yi = (q.c + meia) * 2
      const a = amostrar(cor, xi, yi)
      if (a[3] <= 0.001) continue
      const rl = amostrar(relevo, xi, yi)
      const ladoAo = (2 * rl[0] - 1) * sinalAoLongo
      const ladoAt = 2 * rl[1] - 1
      const nx = ladoAo * q.tx + ladoAt * -q.ty
      const ny = ladoAo * q.ty + ladoAt * q.tx
      const luz = nx * lx + ny * ly
      let c = [a[0], a[1], a[2]]
      if (luz >= 0) {
        const r = realce(c)
        c = c.map((v, k) => v + (r[k] - v) * luz * forca)
      } else c = c.map((v) => v * (1 - 0.3 * forca * -luz))
      const o = (j * w + i) * 4
      const fundo = saida.data[o + 3] / 255
      const al = a[3] + fundo * (1 - a[3])
      for (let k = 0; k < 3; k++) saida.data[o + k] = Math.round(((c[k] * a[3] + (saida.data[o + k] / 255) * fundo * (1 - a[3])) / Math.max(al, 1e-4)) * 255)
      saida.data[o + 3] = Math.round(al * 255)
    }
  }
  return saida
}

function pintarTrechos(g: CanvasRenderingContext2D, p: Params, cor: ImagemLida, relevo: ImagemLida, trechos: TrechoNoMundo[], z: number, ox: number, oy: number): void {
  const w = g.canvas.width
  const h = g.canvas.height
  const camada = tela(w, h)
  camada.g.putImageData(camadaDeTrechos(p, cor, relevo, trechos, w, h, z, ox, oy), 0, 0)
  const s = p.sombra
  if (s.jeito === 'deslocada') {
    const largura = 2 * p.trecho!.meiaLarguraPx * z
    const sil = tela(w, h)
    sil.g.drawImage(camada.c, 0, 0)
    sil.g.globalCompositeOperation = 'source-in'
    sil.g.fillStyle = s.cor
    sil.g.fillRect(0, 0, w, h)
    const n = Math.hypot(s.direcao[0], s.direcao[1])
    g.save()
    g.globalAlpha = s.alfa
    g.filter = s.borrao > 0 ? `blur(${(s.borrao * largura).toFixed(2)}px)` : 'none'
    g.drawImage(sil.c, (s.direcao[0] / n) * s.deslocamento * largura, (s.direcao[1] / n) * s.deslocamento * largura)
    g.restore()
  }
  g.drawImage(camada.c, 0, 0)
}

async function mesaDoTrecho(d: Dados): Promise<Saida> {
  const p = d.params
  const imagens: Record<string, string> = {}
  const casas = d.cena.casas
  const soz = d.cena.soz
  const chaoBosque = await carregar(d.chao.bosque100)
  const chaoSoz100 = await carregar(d.chao.soz100)
  const chaoSoz300 = await carregar(d.chao.soz300)
  const cor = lerImagem(await carregar(d.trecho!.cor))
  const relevo = lerImagem(await carregar(d.trecho!.relevo))
  const C = GRID
  const curva = p.curva === true
  const padrao = (p.casas ?? [2, 0.5])[0] * C
  const meio = { x: (soz.x0 + soz.casas / 2) * C, y: (soz.y0 + soz.casas / 2) * C }
  const centrado = (ang: number, corda: number, volta: number): TrechoNoMundo => {
    // O eixo centrado no quadrado: o meio da corda no meio, o arco para o lado dele.
    const dx = Math.cos(ang)
    const dy = Math.sin(ang)
    const flecha = Math.abs(volta) < 0.5 ? 0 : (corda / 2) * Math.tan((Math.abs(volta) * Math.PI) / 720) * Math.sign(volta)
    return { x: meio.x - (dx * corda) / 2 - -dy * flecha * 0.5, y: meio.y - (dy * corda) / 2 - dx * flecha * 0.5, ang, corda, volta }
  }
  const o0 = { x: soz.x0 * C, y: soz.y0 * C }
  const lado = soz.casas * C
  const umSo = centrado(0, padrao * 1.5, 0)
  for (const [nome, z, chao] of [['soz-desenhado-100', 1, chaoSoz100], ['soz-desenhado-300', 3, chaoSoz300]] as const) {
    const { c, g } = fundo(chao, 0, 0, chao.width, chao.height, lado * z, lado * z)
    pintarTrechos(g, p, cor, relevo, [umSo], z, o0.x, o0.y)
    imagens[nome] = c.toDataURL('image/png')
  }
  const formas: [number, number, number][] = curva
    ? [[0, 1.5, 0], [45, 1.5, 0], [90, 1.5, 0], [135, 1.5, 0], [0, 1.5, 90], [0, 1.5, -90], [0, 1.2, 180], [0, 0.5, 0]]
    : [[0, 1.5, 0], [45, 1.5, 0], [90, 1.5, 0], [135, 1.5, 0], [180, 1.5, 0], [225, 1.5, 0], [270, 1.5, 0], [0, 0.6, 0]]
  formas.forEach(([g0, k, v], i) => {
    const { c, g } = fundo(chaoSoz100, 0, 0, chaoSoz100.width, chaoSoz100.height, lado, lado)
    pintarTrechos(g, p, cor, relevo, [centrado((g0 * Math.PI) / 180, padrao * k, v)], 1, o0.x, o0.y)
    imagens[`forma-${i}`] = c.toDataURL('image/png')
  })
  const cena: TrechoNoMundo[] = [
    { x: 3 * C, y: 3 * C, ang: 0, corda: 6 * C, volta: 0 },
    { x: 3 * C, y: 6 * C, ang: Math.PI / 6, corda: 4 * C, volta: 0 },
    { x: 13 * C, y: 2.5 * C, ang: Math.PI / 2, corda: 3 * C, volta: 0 },
    { x: 17 * C, y: 3 * C, ang: 0, corda: padrao, volta: 0 },
    { x: 17 * C, y: 5 * C, ang: 0.3, corda: padrao, volta: 0 },
    { x: 3 * C, y: 13 * C, ang: 0, corda: 6 * C, volta: curva ? 90 : 0 },
    { x: 12 * C, y: 12 * C, ang: 0, corda: 6 * C, volta: curva ? -120 : 0 },
    { x: 5 * C, y: 19 * C, ang: -0.2, corda: 5 * C, volta: curva ? 180 : 0 },
    { x: 13 * C, y: 20 * C, ang: -0.25, corda: 9 * C, volta: curva ? 30 : 0 },
  ]
  {
    const { c, g } = fundo(chaoBosque, 0, 0, chaoBosque.width, chaoBosque.height, casas * C, casas * C)
    pintarTrechos(g, p, cor, relevo, cena, 1, 0, 0)
    imagens['bosque-desenhado-100'] = c.toDataURL('image/png')
  }
  return {
    imagens,
    info: {
      objetos: cena.length,
      formas: formas.length,
      atual: false,
      motivoAtual: `o móvel "${p.idDoApp}" de hoje é do Meio-Termo (texturas/meioTermo/moveis/): o Atual ainda não é pintado nesta mesa`,
      tamanhoNoMapaRefPx: padrao,
      tituloFormas: curva
        ? 'As formas: reto a 0, 45, 90 e 135 graus, a curva de 90 e de -90 graus, a de 180 e um curto (a luz é do app: tem de vir sempre de cima à esquerda), a 100%'
        : 'As formas: o mesmo trecho girado de 45 em 45 graus e um curto (a luz é do app: tem de vir sempre de cima à esquerda), a 100%',
      tituloBosque: 'Vários trechos sobre a grama (retos, girados' + (curva ? ', curvos' : '') + ', curtos e longos): procure emenda, repetição e luz errada',
    },
  }
}

const janela = window as unknown as { mesaDoCarimbo: typeof mesaDoCarimbo; mesaDoTrecho: typeof mesaDoTrecho }
janela.mesaDoCarimbo = mesaDoCarimbo
janela.mesaDoTrecho = mesaDoTrecho
