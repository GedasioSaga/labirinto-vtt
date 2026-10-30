import { Container, ImageSource, type Geometry, type Mesh, type Renderer, type Shader } from 'pixi.js'
import type { PerfilDoPenhasco, Segmento } from '../lib/relevo'
import type { RegionPoint } from '../types/map'
import {
  ALTURAS_DO_TRACO,
  alturaDaVista,
  desvioDaBorda,
  linhaDaBorda,
  malhasDaFace,
  malhaSemModulos,
  sequenciaDeModulos,
  type AlturaDoTraco,
  type BordaDoTraco,
  type FaceDoTraco,
  type LinhaDaBorda,
  type MalhaDoTraco,
  type PecaComAltura,
  type PecaDoTraco,
  type QuadDoTraco,
} from '../texturas/desenhado/traco'
import { texturasDa, type TexturasDaTinta, type TintaDoBarranco } from './barrancoDesenhado'
import { meshDaBorda, meshDaBordaNoMar, meshDaFaceNoMar, soltarMesh, tracoNoMarCompila, type LinhaNaPlaca, type MascaraNaPlaca } from './malhaDoTraco'

/**
 * O PENHASCO DO CONTINENTE NO ESTILO DESENHADO (CONTRATO.md 11.12; pedido de
 * 29/10/2026): a parede de `lib/relevo.ts` (o perfil de `perfilDoPenhasco`, a
 * costa amostrada com a altura de cada ponto, a rampa incluída) sai com a face
 * e a borda do pacote, no lugar das faixas que `relevoRaster.ts` pinta no Atual.
 *
 * - Cai reto para o sul, como a do Atual: `baixo = (0, 1)` em todo trecho, o
 *   comprimento `s = x` e a espessura `t = altura` em px do protótipo. O px do
 *   protótipo é o px do traço (`k` = a unidade do relevo): a pedra da face fica
 *   na proporção dela contra a altura da parede (Médio, 18, usa a imagem do
 *   Baixo, de 20; Alto, 36, a do Médio, pela escolha de 11.4).
 * - Uma sequência de módulos só para o mapa inteiro, pelo x (`id`, `origem`):
 *   o mestre e o jogador veem a mesma pedra no mesmo lugar, e o que o jogador
 *   explora não sorteia a costa de novo.
 * - A malha é contínua (os trechos vizinhos dividem o canto): a dobra não tem
 *   emenda, e a luz (só a do relevo da imagem, a normal é a mesma) não muda de
 *   um trecho para o outro.
 * - A terra na frente esconde a parede de trás, como o `destination-out` do
 *   Atual: a face e a linha do pé leem a máscara do mar. A linha de cima da
 *   borda (a grama que debruça) vai por cima da terra, sem máscara.
 * - A borda: a linha de cima pelo chão pintado do lado alto (`chaoNoAlto`,
 *   11.11) e a do pé, a água, em todo trecho onde o pé é mar.
 * - A sombra no mar continua a do relevo (a silhueta é a terra mais a parede):
 *   a sombra do pé do pacote não entra, para a costa não escurecer duas vezes.
 *
 * Geometria uma vez por geração do relevo (o perfil muda junto com a textura),
 * nunca por quadro.
 */

type Pt = readonly [number, number]

export interface PedidoDoPenhasco {
  readonly perfil: PerfilDoPenhasco
  /** Px do mundo por px do traço (no continente, a unidade do relevo). */
  readonly k: number
  /** Onde o comprimento começa (px do mundo) e o id da sequência dos módulos e do desvio da borda. */
  readonly origem: number
  readonly id: string
  /** Texels do relevo por px do mundo: a tolerância da costa simplificada e a resolução da máscara. */
  readonly escala: number
  /** A terra, como o relevo a preenche (os polígonos e a fresta das fronteiras fechada com a folga). */
  readonly terra: { readonly poligonos: readonly (readonly RegionPoint[])[]; readonly fronteiras: readonly Segmento[]; readonly folga: number }
  /** O id do chão pintado no ponto (`null` = nada conhecido: a linha da grama). */
  readonly chaoNoAlto: (p: RegionPoint) => string | null
  /** O pé é água (a linha do pé molhado)? No continente, sim: a parede só nasce com mar logo abaixo. */
  readonly aguaNoPe: boolean
}

export interface PenhascoDoContinente {
  readonly camada: Container
  /** Pinta tudo de novo (o perfil, a tinta ou o chão pintado mudou). */
  pintar: (pedido: PedidoDoPenhasco, tinta: TintaDoBarranco) => void
  /** O shader compila no renderer deste palco? `null` = nenhum quadro ainda. */
  compila: () => boolean | null
  limpar: () => void
  destroy: () => void
}

// ---------- a costa em fitas (a mesma regra das fitas da parede do Atual) ----------

/** Amostras seguidas de uma cadeia com parede, x sempre crescendo. `h` = a altura em px do protótipo. */
export interface FitaDaCosta {
  readonly x: readonly number[]
  readonly y: readonly number[]
  readonly h: readonly number[]
}

/**
 * As fitas do perfil, em px do mundo: um lado entra se uma das duas amostras
 * tem parede; onde a costa volta para trás na horizontal, a fita é cortada
 * (o `fitasDaParede` de `relevoRaster.ts`, sem passar para texels).
 */
export function fitasDaCosta(perfil: PerfilDoPenhasco): FitaDaCosta[] {
  const fitas: FitaDaCosta[] = []
  for (const cadeia of perfil.cadeias) {
    const { x, y, altura, fechada } = cadeia
    const n = x.length
    const lados = fechada ? n : n - 1
    const desenha = (i: number) => altura[i % n] > 0 || altura[(i + 1) % n] > 0
    let inicio = 0
    if (fechada) {
      for (let i = 0; i < lados; i += 1) {
        if (!desenha(i)) {
          inicio = i + 1
          break
        }
      }
    }
    let atual: number[] = []
    let sentido = 0
    const fechar = () => {
      if (atual.length >= 2 && sentido !== 0) {
        const ordem = sentido > 0 ? atual : [...atual].reverse()
        fitas.push({ x: ordem.map((i) => x[i]), y: ordem.map((i) => y[i]), h: ordem.map((i) => altura[i]) })
      }
      atual = []
      sentido = 0
    }
    for (let q = 0; q < lados; q += 1) {
      const i = (inicio + q) % n
      const j = (i + 1) % n
      if (!desenha(i)) {
        fechar()
        continue
      }
      const sinal = Math.sign(x[j] - x[i])
      if (sinal !== 0 && sentido !== 0 && sinal !== sentido) {
        fechar()
        atual = [i]
      }
      if (sinal !== 0) sentido = sinal
      if (atual.length === 0) atual.push(i)
      atual.push(j)
    }
    fechar()
  }
  return fitas
}

/** Amostras puladas no máximo numa reta: o chão pintado e o alfa da borda ainda mudam ao longo dela. */
const JANELA_DA_RETA = 24
/** A altura pode sair da reta até isto (px do protótipo) sem a amostra entrar. */
const TOLERANCIA_DA_ALTURA = 0.15

/**
 * A fita com só as amostras que fazem diferença: o perfil vem a cada texel,
 * e a costa reta de altura igual vira um trecho só. A costa simplificada
 * fica a menos de `tolerancia` px do mundo da de verdade.
 */
export function simplificarFita(f: FitaDaCosta, tolerancia: number): FitaDaCosta {
  const n = f.x.length
  if (n <= 2) return f
  const x = [f.x[0]]
  const y = [f.y[0]]
  const h = [f.h[0]]
  let a = 0
  while (a < n - 1) {
    let b = a + 1
    while (b + 1 < n && b + 1 - a <= JANELA_DA_RETA && cabeNaReta(f, a, b + 1, tolerancia)) b += 1
    x.push(f.x[b])
    y.push(f.y[b])
    h.push(f.h[b])
    a = b
  }
  return { x, y, h }
}

function cabeNaReta(f: FitaDaCosta, a: number, b: number, tolerancia: number): boolean {
  const dx = f.x[b] - f.x[a]
  if (!(dx > 1e-9)) return false
  // A ponta da parede (altura 0 de um lado) fica: é onde a rampa começa.
  if ((f.h[a] > 0) !== (f.h[b] > 0)) return false
  for (let k = a + 1; k < b; k += 1) {
    const u = (f.x[k] - f.x[a]) / dx
    if (Math.abs(f.y[a] + (f.y[b] - f.y[a]) * u - f.y[k]) > tolerancia) return false
    if (Math.abs(f.h[a] + (f.h[b] - f.h[a]) * u - f.h[k]) > TOLERANCIA_DA_ALTURA) return false
  }
  return true
}

/** A altura (px do protótipo) da fita no x, pela reta entre as amostras. */
function alturaNoX(f: FitaDaCosta, x: number): number {
  const n = f.x.length
  if (x <= f.x[0]) return f.h[0]
  if (x >= f.x[n - 1]) return f.h[n - 1]
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (f.x[m] <= x) lo = m
    else hi = m
  }
  const u = (x - f.x[lo]) / Math.max(1e-9, f.x[hi] - f.x[lo])
  return f.h[lo] + (f.h[hi] - f.h[lo]) * u
}

// ---------- os quads de uma fita ----------

const BAIXO: Pt = [0, 1]

interface QuadsDaFita {
  readonly face: QuadDoTraco[]
  readonly pecas: PecaComAltura[]
  /** Os trechos da fita (i, i + 1) com parede, para a borda. */
  readonly trechos: number[]
  /** A altura da face no mundo (a imagem da parte mais alta da fita): o alfa da borda e a folga de cima e de baixo. */
  readonly hMundo: number
}

function quadsDaFita(f: FitaDaCosta, face: FaceDoTraco, pedido: PedidoDoPenhasco, pecasDoMapa: readonly PecaDoTraco[]): QuadsDaFita | null {
  const { k, origem } = pedido
  const n = f.x.length
  const maisAlta = Math.max(...f.h)
  if (!(maisAlta > 0)) return null
  // A imagem da parte mais alta (11.4, px do traço = px do protótipo): a dela estica exatamente na altura.
  const H = face.alturas[alturaDaVista(maisAlta, 'alto', face.limites)].hPx
  const a = face.acimaPx / H
  const b = face.abaixoPx / H
  const t = (i: number) => f.h[i] * k
  const quads: QuadDoTraco[] = []
  const trechos: number[] = []
  for (let i = 0; i + 1 < n; i += 1) {
    const j = i + 1
    if (f.h[i] <= 0 && f.h[j] <= 0) continue
    if (!(f.x[j] - f.x[i] > 1e-6)) continue
    trechos.push(i)
    quads.push({
      q0: [f.x[i], f.y[i] - a * t(i)],
      q1: [f.x[j], f.y[j] - a * t(j)],
      q2: [f.x[j], f.y[j] + (1 + b) * t(j)],
      q3: [f.x[i], f.y[i] + (1 + b) * t(i)],
      sIni: (f.x[i] - origem) / k,
      sFim: (f.x[j] - origem) / k,
      vDe: -a,
      vAte: 1 + b,
      baixo: BAIXO,
      contra: false,
      extraIni: 0,
      extraFim: 0,
      extraFixo: 0,
    })
  }
  if (quads.length === 0) return null
  // As peças do mapa que caem nesta fita, cada uma com a imagem da espessura no meio dela.
  const s0 = (f.x[0] - origem) / k
  const s1 = (f.x[n - 1] - origem) / k
  const pecas: PecaComAltura[] = []
  for (const p of pecasDoMapa) {
    if (p.s1 <= s0 || p.s0 >= s1) continue
    const meio = origem + ((p.s0 + p.s1) / 2) * k
    pecas.push({ ...p, altura: alturaDaVista(alturaNoX(f, meio), 'alto', face.limites) })
  }
  if (pecas.length === 0) return null
  return { face: quads, pecas, trechos, hMundo: H * k }
}

/** Uma linha da borda ao longo dos trechos: de `ancora - acima` a `ancora + abaixo`, o s andado pelo desvio (11.11). */
function quadDaBorda(f: FitaDaCosta, i: number, borda: BordaDoTraco, noPe: boolean, pedido: PedidoDoPenhasco, desvio: number, hMundo: number): QuadDoTraco {
  const { k, origem } = pedido
  const j = i + 1
  const ti = f.h[i] * k
  const tj = f.h[j] * k
  const yi = f.y[i] + (noPe ? ti : 0)
  const yj = f.y[j] + (noPe ? tj : 0)
  return {
    q0: [f.x[i], yi - borda.acimaPx * k],
    q1: [f.x[j], yj - borda.acimaPx * k],
    q2: [f.x[j], yj + borda.abaixoPx * k],
    q3: [f.x[i], yi + borda.abaixoPx * k],
    sIni: (f.x[i] - origem) / k + desvio,
    sFim: (f.x[j] - origem) / k + desvio,
    vDe: 0,
    vAte: 1,
    baixo: BAIXO,
    contra: false,
    extraIni: ti,
    extraFim: tj,
    extraFixo: hMundo,
  }
}

/** Várias malhas numa só (os índices andados): um Mesh por imagem, não um por fita. */
export function juntarMalhas(lista: readonly (MalhaDoTraco | null)[]): MalhaDoTraco | null {
  const cheias = lista.filter((m): m is MalhaDoTraco => m !== null)
  if (cheias.length === 0) return null
  if (cheias.length === 1) return cheias[0]
  const total = (pegar: (m: MalhaDoTraco) => Float32Array | Uint32Array) => cheias.reduce((s, m) => s + pegar(m).length, 0)
  const juntar = (pegar: (m: MalhaDoTraco) => Float32Array): Float32Array => {
    const out = new Float32Array(total(pegar))
    let o = 0
    for (const m of cheias) {
      out.set(pegar(m), o)
      o += pegar(m).length
    }
    return out
  }
  const indices = new Uint32Array(total((m) => m.indices))
  let o = 0
  let base = 0
  for (const m of cheias) {
    for (let i = 0; i < m.indices.length; i += 1) indices[o + i] = m.indices[i] + base
    o += m.indices.length
    base += m.posicoes.length / 2
  }
  return {
    posicoes: juntar((m) => m.posicoes),
    quadA: juntar((m) => m.quadA),
    quadB: juntar((m) => m.quadB),
    aoLongo: juntar((m) => m.aoLongo),
    modulo: juntar((m) => m.modulo),
    quadro: juntar((m) => m.quadro),
    indices,
  }
}

// ---------- a máscara do mar ----------

/** Teto do lado da máscara, em texels: 1024² RGBA = 4 MiB na placa, sem mipmaps. */
const TETO_DA_MASCARA = 1024

interface CaixaDoMundo {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** A terra numa tela do tamanho da caixa das paredes: branco opaco no mar, transparente na terra. */
function mascaraDoMar(pedido: PedidoDoPenhasco, caixa: CaixaDoMundo): { tela: HTMLCanvasElement; onde: Omit<MascaraNaPlaca, 'imagem'> } | null {
  const largura = caixa.maxX - caixa.minX
  const altura = caixa.maxY - caixa.minY
  if (!(largura > 0) || !(altura > 0)) return null
  const escala = Math.min(pedido.escala, TETO_DA_MASCARA / Math.max(largura, altura))
  const w = Math.max(1, Math.ceil(largura * escala))
  const h = Math.max(1, Math.ceil(altura * escala))
  const tela = document.createElement('canvas')
  tela.width = w
  tela.height = h
  const g = tela.getContext('2d')
  if (g === null) return null
  g.fillStyle = '#fff'
  g.fillRect(0, 0, w, h)
  g.globalCompositeOperation = 'destination-out'
  g.setTransform(escala, 0, 0, escala, -caixa.minX * escala, -caixa.minY * escala)
  for (const poligono of pedido.terra.poligonos) {
    if (poligono.length < 3 || !tocaACaixa(poligono, caixa)) continue
    // Cada polígono sozinho, como a terra do relevo (num caminho só o "nonzero" abriria buraco).
    g.beginPath()
    g.moveTo(poligono[0].x, poligono[0].y)
    for (let i = 1; i < poligono.length; i += 1) g.lineTo(poligono[i].x, poligono[i].y)
    g.closePath()
    g.fill()
  }
  if (pedido.terra.fronteiras.length > 0) {
    g.lineWidth = 2 * pedido.terra.folga
    g.lineCap = 'round'
    g.beginPath()
    for (const { a, b } of pedido.terra.fronteiras) {
      g.moveTo(a.x, a.y)
      g.lineTo(b.x, b.y)
    }
    g.stroke()
  }
  return { tela, onde: { x: caixa.minX, y: caixa.minY, porMundoX: escala / w, porMundoY: escala / h } }
}

/** A caixa do polígono encosta na caixa das paredes? (O que não encosta não muda a máscara.) */
function tocaACaixa(pontos: readonly RegionPoint[], caixa: CaixaDoMundo): boolean {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return minX <= caixa.maxX && maxX >= caixa.minX && minY <= caixa.maxY && maxY >= caixa.minY
}

// ---------- o palco ----------

/** A sequência de módulos do mapa inteiro é uma, pelo x: a parede passa deste fim só num mapa absurdo. */
function pecasDoMapa(face: FaceDoTraco, pedido: PedidoDoPenhasco, fitas: readonly FitaDaCosta[]): PecaDoTraco[] {
  let fim = 0
  for (const f of fitas) fim = Math.max(fim, (f.x[f.x.length - 1] - pedido.origem) / pedido.k)
  return sequenciaDeModulos(face, pedido.id, Math.max(1, fim + 1), false)
}

/**
 * O penhasco do continente num palco. `aoFalhar` é chamado (uma vez, antes do
 * primeiro quadro que mostraria a malha) quando o shader não compila neste
 * renderer: quem usa limpa e volta a pintar a parede do Atual na textura.
 */
export function criarPenhascoDoContinente(aoFalhar: () => void): PenhascoDoContinente {
  const camada = new Container()
  camada.label = 'penhasco-do-continente'
  camada.eventMode = 'none'
  let meshes: Mesh<Geometry, Shader>[] = []
  let texturas: TexturasDaTinta | null = null
  let mascara: ImageSource | null = null
  let renderer: Renderer | null = null
  let conferido: Renderer | null = null
  let falhou = false

  camada.onRender = (r: Renderer) => {
    renderer = r
    if (conferido === r || meshes.length === 0) return
    conferido = r
    if (!tracoNoMarCompila(r)) {
      falhou = true
      limpar()
      aoFalhar()
    }
  }

  function limpar(): void {
    // O palco pode ter destruído a camada antes (a troca de cena desmonta tudo).
    if (!camada.destroyed) camada.removeChildren()
    for (const m of meshes) soltarMesh(m)
    meshes = []
    mascara?.destroy()
    mascara = null
  }

  function soltarTexturas(): void {
    if (texturas === null) return
    for (const t of texturas.todas) t.destroy()
    texturas = null
  }

  function porMesh(m: Mesh<Geometry, Shader>): void {
    meshes.push(m)
    camada.addChild(m)
  }

  function pintar(pedido: PedidoDoPenhasco, tinta: TintaDoBarranco): void {
    limpar()
    if (falhou || camada.destroyed) return
    const fitas = fitasDaCosta(pedido.perfil).map((f) => simplificarFita(f, 0.35 / pedido.escala))
    if (fitas.length === 0) return
    if (texturas?.tinta !== tinta) {
      soltarTexturas()
      texturas = texturasDa(tinta)
    }
    const tx = texturas
    const face = tinta.face.face
    const borda = tinta.borda?.borda ?? null
    const pecas = pecasDoMapa(face, pedido, fitas)
    const desvio = borda === null ? 0 : desvioDaBorda(borda, pedido.id)
    const porAltura: Record<AlturaDoTraco, (MalhaDoTraco | null)[]> = { baixo: [], medio: [], alto: [] }
    const doPe: QuadDoTraco[] = []
    const deCima = new Map<LinhaDaBorda, QuadDoTraco[]>()
    const linhaDoPe = borda === null || !pedido.aguaNoPe ? null : linhaDaBorda(borda, 'pe', 'agua')
    const caixa: CaixaDoMundo = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    for (const f of fitas) {
      const q = quadsDaFita(f, face, pedido, pecas)
      if (q === null) continue
      const malhas = malhasDaFace(face, q.face, q.pecas)
      for (const a of ALTURAS_DO_TRACO) porAltura[a].push(malhas[a])
      for (const quad of q.face) for (const p of [quad.q0, quad.q1, quad.q2, quad.q3]) incluir(caixa, p)
      if (borda === null) continue
      for (const i of q.trechos) {
        if (linhaDoPe !== null) {
          const pe = quadDaBorda(f, i, borda, true, pedido, desvio, q.hMundo)
          doPe.push(pe)
          for (const p of [pe.q2, pe.q3]) incluir(caixa, p)
        }
        // O chão do lado alto: no meio do trecho, dentro da faixa da grama que debruça.
        const xm = (f.x[i] + f.x[i + 1]) / 2
        const ym = (f.y[i] + f.y[i + 1]) / 2 - borda.acimaPx * pedido.k * 0.5
        const linha = linhaDaBorda(borda, 'beira', pedido.chaoNoAlto({ x: xm, y: ym }))
        if (linha === null) continue
        const lista = deCima.get(linha) ?? []
        lista.push(quadDaBorda(f, i, borda, false, pedido, desvio, q.hMundo))
        deCima.set(linha, lista)
      }
    }
    if (!Number.isFinite(caixa.minX)) return
    const m = mascaraDoMar(pedido, { minX: caixa.minX - 2, minY: caixa.minY - 2, maxX: caixa.maxX + 2, maxY: caixa.maxY + 2 })
    if (m === null) return
    mascara = new ImageSource({ resource: m.tela, autoGenerateMipmaps: false, scaleMode: 'linear', addressMode: 'clamp-to-edge', alphaMode: 'no-premultiply-alpha' })
    const naPlaca: MascaraNaPlaca = { imagem: mascara, ...m.onde }
    // 1. A face, uma malha por imagem; 2. a linha do pé; 3. a de cima, por cima de tudo (11.11).
    for (const a of ALTURAS_DO_TRACO) {
      const malha = juntarMalhas(porAltura[a])
      if (malha !== null) porMesh(meshDaFaceNoMar(malha, tx.alturas[a], face.luz, naPlaca))
    }
    const imagemDaBorda = tx.borda
    if (borda === null || imagemDaBorda === null) return
    const linhaNaPlaca = (linha: LinhaDaBorda): LinhaNaPlaca => ({
      imagem: imagemDaBorda,
      periodoPx: borda.comprimentoPx,
      yPx: linha.yPx,
      linhaPx: borda.linhaPx,
      alturaPx: borda.acimaPx + borda.abaixoPx,
      largura: borda.largura,
      altura: borda.altura,
    })
    if (linhaDoPe !== null) {
      const malha = malhaSemModulos(doPe)
      if (malha !== null) porMesh(meshDaBordaNoMar(malha, linhaNaPlaca(linhaDoPe), naPlaca))
    }
    for (const [linha, quads] of deCima) {
      const malha = malhaSemModulos(quads)
      if (malha !== null) porMesh(meshDaBorda(malha, linhaNaPlaca(linha)))
    }
  }

  return {
    camada,
    pintar,
    compila: () => (falhou ? false : renderer === null ? null : tracoNoMarCompila(renderer)),
    limpar,
    destroy: () => {
      limpar()
      soltarTexturas()
      if (!camada.destroyed) {
        camada.onRender = null
        camada.destroy()
      }
    },
  }
}

function incluir(c: CaixaDoMundo, p: Pt): void {
  c.minX = Math.min(c.minX, p[0])
  c.minY = Math.min(c.minY, p[1])
  c.maxX = Math.max(c.maxX, p[0])
  c.maxY = Math.max(c.maxY, p[1])
}
