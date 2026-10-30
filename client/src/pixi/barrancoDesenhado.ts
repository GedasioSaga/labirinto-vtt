import { Container, Graphics, type Geometry, type Mesh, type Renderer, type Shader, type TextureSource } from 'pixi.js'
import { corridas, type GeoDoBarranco } from '../lib/barranco'
import type { BordaCarregada, FaceCarregada } from '../texturas/desenhado/carregadorDoTraco'
import {
  ALTURAS_DO_TRACO,
  alturaDaVista,
  CASA_DO_TRACO,
  desvioDaBorda,
  linhaDaBorda,
  LUZ_DO_TRACO,
  malhasDaFace,
  malhaSemModulos,
  sequenciaDeModulos,
  type AlturaDoTraco,
  type BordaDoTraco,
  type FaceDoTraco,
  type LinhaDaBorda,
  type PecaComAltura,
  type QuadDoTraco,
} from '../texturas/desenhado/traco'
import { rgb } from '../texturas/ruido'
import { meshDaBorda, meshDaFace, meshDaSombra, soltarMesh, texturaDoTraco, tracoCompila, type ImagemNaPlaca } from './malhaDoTraco'

/**
 * O BARRANCO NO ESTILO DESENHADO (plano de 29/10/2026, F4a; CONTRATO.md 11.12):
 * a face do penhasco do pacote ao longo de cada beira, a sombra do pé e a
 * borda de cima, na ordem da referência (`godot/desenhado/ferramentas/traco.ts`,
 * `pintarDesenhado`): nível por nível, a sombra, as faces, as rampas e o alto
 * mais claro, e a borda por cima; os riscos por último.
 *
 * A geometria é a do app (`geosDoBarranco`): nada dela muda. Cada trecho da
 * beira vira um quadrilátero de `lip + vn * (-acima)` a `lip + vn * (t + abaixo)`;
 * a sequência de módulos e a imagem de cada um (11.4, 11.6) saem uma vez por
 * geometria, quando o barranco muda, nunca por quadro.
 *
 * As partes sem desenho no pacote (a rampa, o alto mais claro) são do Atual e
 * vêm de quem chama (`PassosDoAtual`).
 */

type Pt = readonly [number, number]

/** As imagens do pacote prontas (a borda é opcional: sem ela a face sai sozinha). */
export interface TintaDoBarranco {
  readonly face: FaceCarregada
  readonly borda: BordaCarregada | null
}

/** O que o Desenhado ainda pinta pelo Atual. */
export interface PassosDoAtual {
  rampas: (g: Graphics, lista: readonly GeoDoBarranco[]) => void
  topo: (g: Graphics, lista: readonly GeoDoBarranco[], nivel: number, alfa: number) => void
}

export interface PedidoDoDesenhado {
  readonly geos: readonly GeoDoBarranco[]
  readonly grid: number
  /** A altura de cada beira (o risco tem a dele; a área, a dos quadrados). */
  readonly alturaDe: (geo: GeoDoBarranco) => AlturaDoTraco
  /** O id do chão do lado alto junto da beira (a linha de cima da borda); `null` = a primeira linha. */
  readonly chaoNoAlto: (geo: GeoDoBarranco) => string | null
  /** O lado baixo é água? (A linha do pé molhado.) */
  readonly aguaNoPe: (geo: GeoDoBarranco) => boolean
}

export interface BarrancoDesenhado {
  readonly camada: Container
  /** Pinta tudo de novo (o barranco, a grade ou a tinta mudou). */
  pintar: (pedido: PedidoDoDesenhado, tinta: TintaDoBarranco, passos: PassosDoAtual) => void
  limpar: () => void
  destroy: () => void
}

/** A alfa do alto de cada degrau no Desenhado (a referência: 0,06 por nível). */
const ALFA_DO_TOPO = 0.06

// ---------- a geometria por trecho (a mesma de `trechosDe` e `tEm` da referência) ----------

interface Trecho {
  readonly i: number
  readonly j: number
}

function trechosDe(geo: GeoDoBarranco): Trecho[] {
  const n = geo.lip.length
  const out: Trecho[] = []
  for (const c of corridas(geo)) {
    const idx = c.fechada ? [...c.idx, c.idx[0]] : c.idx
    for (let k = 0; k + 1 < idx.length; k += 1) out.push({ i: idx[k], j: idx[k + 1] % n })
  }
  return out
}

/** O comprimento da beira no ponto j do trecho (o fim do laço fechado é o comprimento inteiro). */
function sNoFim(geo: GeoDoBarranco, i: number, j: number): number {
  return j === 0 && i !== 0 ? geo.len : geo.s[j]
}

/** A espessura da beira no comprimento s (px do mundo, como geo.s). */
function tEm(geo: GeoDoBarranco, s: number): number {
  const n = geo.s.length
  if (n === 0) return 0
  if (s <= geo.s[0]) return geo.t[0]
  if (s >= geo.s[n - 1]) {
    if (!geo.fechado || geo.len <= geo.s[n - 1]) return geo.t[n - 1]
    const u = (s - geo.s[n - 1]) / (geo.len - geo.s[n - 1])
    return geo.t[n - 1] + (geo.t[0] - geo.t[n - 1]) * Math.min(1, u)
  }
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1
    if (geo.s[m] <= s) lo = m
    else hi = m
  }
  const u = (s - geo.s[lo]) / Math.max(1e-6, geo.s[hi] - geo.s[lo])
  return geo.t[lo] + (geo.t[hi] - geo.t[lo]) * u
}

function ponto(geo: GeoDoBarranco, q: number, d: number): Pt {
  return [geo.lip[q][0] + geo.vn[q][0] * d, geo.lip[q][1] + geo.vn[q][1] * d]
}

/** O quadrilátero do trecho entre `de` e `ate` (px do mundo da beira, em cada ponta). */
function quadDoTrecho(geo: GeoDoBarranco, tr: Trecho, de: (q: number) => number, ate: (q: number) => number, resto: Omit<QuadDoTraco, 'q0' | 'q1' | 'q2' | 'q3' | 'baixo' | 'contra'>): QuadDoTraco {
  const { i, j } = tr
  const sn = geo.sn[i]
  // A imagem anda sempre para "ao longo" = o baixo girado um quarto de volta (no sul, o leste).
  const tx = geo.lip[j][0] - geo.lip[i][0]
  const ty = geo.lip[j][1] - geo.lip[i][1]
  const contra = tx * sn[1] - ty * sn[0] < 0
  return { q0: ponto(geo, i, de(i)), q1: ponto(geo, j, de(j)), q2: ponto(geo, j, ate(j)), q3: ponto(geo, i, ate(i)), baixo: [sn[0], sn[1]], contra, ...resto }
}

// ---------- as três partes ----------

/** A face de uma beira: os quads e as peças (o módulo e a imagem de cada um). */
function faceDaBeira(geo: GeoDoBarranco, face: FaceDoTraco, k: number, alt: AlturaDoTraco): { quads: QuadDoTraco[]; pecas: PecaComAltura[] } {
  const H = face.alturas[alt].hPx
  const a = face.acimaPx / H
  const b = face.abaixoPx / H
  const pecas = sequenciaDeModulos(face, geo.id, geo.len / k, geo.fechado).map((p) => ({ ...p, altura: alturaDaVista(tEm(geo, ((p.s0 + p.s1) / 2) * k) / k, alt, face.limites) }))
  const quads: QuadDoTraco[] = []
  for (const tr of trechosDe(geo)) {
    if (geo.t[tr.i] < 0.2 && geo.t[tr.j] < 0.2) continue
    quads.push(
      quadDoTrecho(geo, tr, (q) => -a * geo.t[q], (q) => (1 + b) * geo.t[q], {
        sIni: geo.s[tr.i] / k,
        sFim: sNoFim(geo, tr.i, tr.j) / k,
        vDe: -a,
        vAte: 1 + b,
        extraIni: 0,
        extraFim: 0,
        extraFixo: 0,
      }),
    )
  }
  return { quads, pecas }
}

/**
 * A largura da caixa do desfoque da referência (3 passadas de caixa de 2r + 1
 * px para o desvio sigma = borrão / 2), em px do mundo a 100%.
 */
export function caixaDoDesfoque(borraoPx: number, k: number): number {
  const sigma = borraoPx * k * 0.5
  if (sigma < 0.3) return 0.5
  const r = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2 - 0.5))
  return 2 * r + 1
}

/**
 * A sombra do pé (11.9): de d0 = t / 2 a d1 = t + comprimento + 1,05 t
 * deCostas, mais `folga` px do mundo para cada lado (negativa = só o miolo,
 * onde a cobertura é 1). O quad leva, no lugar do s, d0 no começo e no fim;
 * no lugar de v, d1; nos extras, a beira do começo.
 */
function sombraDaBeira(geo: GeoDoBarranco, face: FaceDoTraco, k: number, folga: number): QuadDoTraco[] {
  const sb = face.sombra
  const deCostas = (q: number): number => Math.max(0, -(geo.un[q][0] * LUZ_DO_TRACO[0] + geo.un[q][1] * LUZ_DO_TRACO[1]))
  const d0 = (q: number): number => geo.t[q] * 0.5
  const d1 = (q: number): number => geo.t[q] + sb.comprimentoPx * k + geo.t[q] * 1.05 * deCostas(q)
  const de = (q: number): number => d0(q) - folga
  // O miolo de uma ponta fina some (largura 0), sem virar do avesso.
  const ate = (q: number): number => Math.max(de(q), d1(q) + folga)
  const quads: QuadDoTraco[] = []
  for (const tr of trechosDe(geo)) {
    if (geo.t[tr.i] < 0.4 && geo.t[tr.j] < 0.4) continue
    quads.push(
      quadDoTrecho(geo, tr, de, ate, {
        sIni: d0(tr.i),
        sFim: d0(tr.j),
        vDe: d1(tr.i),
        vAte: d1(tr.j),
        extraIni: geo.lip[tr.i][0],
        extraFim: geo.lip[tr.i][1],
        extraFixo: 0,
      }),
    )
  }
  return quads
}

/** A borda de uma beira numa linha (11.11): de `ancora - acima` a `ancora + abaixo`, o s andado pelo desvio. */
function bordaDaBeira(geo: GeoDoBarranco, borda: BordaDoTraco, linha: LinhaDaBorda, hMundo: number, k: number): QuadDoTraco[] {
  const noPe = linha.ancora === 'pe'
  const ancora = (q: number): number => (noPe ? geo.t[q] : 0)
  const desvio = desvioDaBorda(borda, geo.id)
  const quads: QuadDoTraco[] = []
  for (const tr of trechosDe(geo)) {
    if (geo.t[tr.i] < 0.2 && geo.t[tr.j] < 0.2) continue
    quads.push(
      quadDoTrecho(geo, tr, (q) => ancora(q) - borda.acimaPx * k, (q) => ancora(q) + borda.abaixoPx * k, {
        sIni: geo.s[tr.i] / k + desvio,
        sFim: sNoFim(geo, tr.i, tr.j) / k + desvio,
        vDe: 0,
        vAte: 1,
        extraIni: geo.t[tr.i],
        extraFim: geo.t[tr.j],
        extraFixo: hMundo,
      }),
    )
  }
  return quads
}

// ---------- as texturas de um palco ----------

/** As texturas da tinta num palco (o penhasco do continente, `penhascoDoContinente.ts`, faz as dele igual). */
export interface TexturasDaTinta {
  readonly tinta: TintaDoBarranco
  readonly alturas: Readonly<Record<AlturaDoTraco, ImagemNaPlaca>>
  readonly borda: TextureSource | null
  readonly todas: readonly TextureSource[]
}

export function texturasDa(tinta: TintaDoBarranco): TexturasDaTinta {
  const todas: TextureSource[] = []
  const imagem = (a: AlturaDoTraco): ImagemNaPlaca => {
    const img = tinta.face.imagens[a]
    const medidas = tinta.face.face.alturas[a]
    const cor = texturaDoTraco(img.cor, false)
    const relevo = texturaDoTraco(img.relevo, true)
    todas.push(cor, relevo)
    return { cor, relevo, acimaPx: tinta.face.face.acimaPx, hPx: medidas.hPx, largura: medidas.largura, altura: medidas.altura }
  }
  const alturas = { baixo: imagem('baixo'), medio: imagem('medio'), alto: imagem('alto') }
  const borda = tinta.borda === null ? null : texturaDoTraco(tinta.borda.imagem, false)
  if (borda !== null) todas.push(borda)
  return { tinta, alturas, borda, todas }
}

/** A cor da sombra (0..1). */
export function corDe(hex: string): readonly [number, number, number] {
  const c = rgb(hex)
  return [c[0] / 255, c[1] / 255, c[2] / 255]
}

/**
 * O barranco Desenhado num palco. `aoFalhar` é chamado (uma vez, antes do
 * primeiro quadro que mostraria a malha) quando o shader não compila neste
 * renderer: quem usa limpa e pinta o Atual.
 */
export function criarBarrancoDesenhado(aoFalhar: () => void): BarrancoDesenhado {
  const camada = new Container()
  camada.eventMode = 'none'
  let meshes: Mesh<Geometry, Shader>[] = []
  let vetores: Graphics[] = []
  let texturas: TexturasDaTinta | null = null
  let conferido: Renderer | null = null
  let falhou = false

  camada.onRender = (renderer: Renderer) => {
    if (conferido === renderer || meshes.length === 0) return
    conferido = renderer
    if (!tracoCompila(renderer)) {
      falhou = true
      limpar()
      aoFalhar()
    }
  }

  function limpar(): void {
    camada.removeChildren()
    for (const m of meshes) soltarMesh(m)
    for (const g of vetores) g.destroy()
    meshes = []
    vetores = []
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

  function porVetor(pintar: (g: Graphics) => void): void {
    const g = new Graphics()
    g.eventMode = 'none'
    pintar(g)
    vetores.push(g)
    camada.addChild(g)
  }

  function pintar(pedido: PedidoDoDesenhado, tinta: TintaDoBarranco, passos: PassosDoAtual): void {
    limpar()
    if (falhou) return
    if (texturas?.tinta !== tinta) {
      soltarTexturas()
      texturas = texturasDa(tinta)
    }
    const tx = texturas
    const face = tinta.face.face
    const k = pedido.grid / CASA_DO_TRACO
    const caixa = caixaDoDesfoque(face.sombra.borraoPx, k)
    const corDaSombra = corDe(face.sombra.cor)
    const grupos: { lista: GeoDoBarranco[]; nivel: number }[] = []
    for (let n = 1; n <= 3; n += 1) grupos.push({ lista: pedido.geos.filter((g) => g.tipo === 'area' && g.nivel === n), nivel: n })
    grupos.push({ lista: pedido.geos.filter((g) => g.tipo === 'risco'), nivel: 0 })
    let ordem = 0
    for (const { lista, nivel } of grupos) {
      if (lista.length === 0) continue
      // 1. A sombra do nível por baixo de todas as faces dele: o miolo cheio primeiro, a faixa inteira
      //    depois (o teste de profundidade de `meshDaSombra` pinta cada pixel uma vez, como a união).
      if (face.sombra.jeito === 'pe') {
        const alcance = 1.5 * caixa
        for (const folga of [-alcance, alcance]) {
          const m = malhaSemModulos(lista.flatMap((g) => sombraDaBeira(g, face, k, folga)))
          if (m !== null) porMesh(meshDaSombra(m, corDaSombra, face.sombra.alfa, caixa, ordem))
        }
      }
      ordem += 1
      // 2. As faces: uma malha por imagem (Baixo, Médio, Alto) em cada beira.
      for (const g of lista) {
        const f = faceDaBeira(g, face, k, pedido.alturaDe(g))
        const malhas = malhasDaFace(face, f.quads, f.pecas)
        for (const a of ALTURAS_DO_TRACO) {
          const malha = malhas[a]
          if (malha !== null) porMesh(meshDaFace(malha, tx.alturas[a], face.luz))
        }
      }
      // 3. As rampas e o alto mais claro, pelo Atual.
      porVetor((g) => {
        passos.rampas(g, lista)
        if (nivel > 0) passos.topo(g, lista, nivel, ALFA_DO_TOPO)
      })
      // 4. A borda: a linha do pé onde o lado baixo é água, a de cima pelo chão do lado alto.
      const borda = tinta.borda?.borda ?? null
      if (borda !== null && tx.borda !== null) {
        const porLinha = new Map<LinhaDaBorda, QuadDoTraco[]>()
        for (const g of lista) {
          const hMundo = face.alturas[pedido.alturaDe(g)].hPx * k
          const linhas = [linhaDaBorda(borda, 'pe', pedido.aguaNoPe(g) ? 'agua' : null), linhaDaBorda(borda, 'beira', pedido.chaoNoAlto(g))]
          for (const linha of linhas) {
            if (linha === null) continue
            const quads = porLinha.get(linha) ?? []
            quads.push(...bordaDaBeira(g, borda, linha, hMundo, k))
            porLinha.set(linha, quads)
          }
        }
        for (const [linha, quads] of porLinha) {
          const m = malhaSemModulos(quads)
          if (m === null) continue
          porMesh(meshDaBorda(m, { imagem: tx.borda, periodoPx: borda.comprimentoPx, yPx: linha.yPx, linhaPx: borda.linhaPx, alturaPx: borda.acimaPx + borda.abaixoPx, largura: borda.largura, altura: borda.altura }))
        }
      }
    }
  }

  return {
    camada,
    pintar,
    limpar,
    destroy: () => {
      limpar()
      soltarTexturas()
      camada.onRender = null
      camada.destroy()
    },
  }
}
