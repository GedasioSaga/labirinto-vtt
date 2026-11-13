import type { Prop, Region, TracoDeAreia } from '../../types/map'
import type { FloorPolygon } from '../floorContour'
import { visibleRegions, type FonteDeCamadas } from '../layers'
import { ehConstrucao } from '../mobilia/construcoes'
import { propCorners } from '../objectTransform'

/**
 * ÁGUA E O QUE ESTÁ EM VOLTA (MAR MAIS FÁCIL, 13/11/2026): o retângulo do
 * mapa, o chão que fica POR CIMA da água (salas e Chão Liso: a água abre
 * buraco) e o que tira a margem da beira (salas, Chão Liso e construções: por
 * baixo ou a menos de meia casa, sem raso, espuma nem areia). Tudo em px de
 * mundo; lógica pura, quem desenha é `pixi/aguaDoMapa.ts`.
 *
 * No jogador o entorno sai só do que ele recebe (as salas e o Chão do recorte):
 * a sala secreta que não chega a ele não abre buraco nem tira margem.
 */

/** Uma forma: anéis fechados (x, y, x, y...) em px de mundo, dentro por par ou ímpar entre os anéis. */
export interface FormaDoEntorno {
  aneis: readonly (readonly number[])[]
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface EntornoDaAgua {
  /** O mapa (px de mundo): a água não passa dele, e a beira na borda não é margem. `null` = mapa sem tamanho. */
  mapa: { largura: number; altura: number } | null
  /** Por cima da água: o fundo das salas e o Chão Liso. */
  porCima: readonly FormaDoEntorno[]
  /** A beira por baixo ou perto destas não é margem: salas, Chão Liso e construções. */
  semMargem: readonly FormaDoEntorno[]
  /** Muda quando o conteúdo muda (a assinatura do campo). */
  chave: string
}

/** A beira a menos disto (em casas) de sala, Chão Liso ou construção não é margem. */
export const PERTO_DA_ESTRUTURA = 0.5
/** A beira a menos disto (em casas) da borda do mapa, ou fora dele, não é margem (o mar segue para fora). */
export const NA_BORDA = 0.05
/** O pincel de areia esmaece nesta distância (em casas): a areia some aos poucos, sem corte reto. */
export const ESMAECER_DA_AREIA = 0.5

export const SEM_ENTORNO: EntornoDaAgua = { mapa: null, porCima: [], semMargem: [], chave: '' }

const arred = (v: number): number => Math.round(v * 2) / 2

function formaDosAneis(aneis: readonly (readonly number[])[]): FormaDoEntorno | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const validos = aneis.filter((a) => a.length >= 6)
  for (const anel of validos) {
    for (let i = 0; i + 1 < anel.length; i += 2) {
      x0 = Math.min(x0, anel[i])
      y0 = Math.min(y0, anel[i + 1])
      x1 = Math.max(x1, anel[i])
      y1 = Math.max(y1, anel[i + 1])
    }
  }
  return validos.length === 0 || !Number.isFinite(x0) ? null : { aneis: validos, x0, y0, x1, y1 }
}

const plano = (pontos: readonly { x: number; y: number }[]): number[] => pontos.flatMap((p) => [arred(p.x), arred(p.y)])

export interface PecasDoEntorno {
  /** O mapa em px de mundo (largura * grade); 0 = sem tamanho. */
  largura: number
  altura: number
  /** As salas do piso (as escondidas do olho do mestre saem por `ocultas`, como no desenho). */
  regioes: readonly Region[]
  ocultas: FonteDeCamadas
  /** O Chão Liso desenhado (`FloorRenderer.polygons`). */
  chao: readonly FloorPolygon[]
  props: readonly Prop[]
}

interface Guardado {
  ocultas: FonteDeCamadas
  chao: readonly FloorPolygon[]
  props: readonly Prop[]
  largura: number
  altura: number
  entorno: EntornoDaAgua
}
const guardados = new WeakMap<readonly Region[], Guardado>()

/** O entorno das águas; as mesmas peças (pela referência) devolvem o mesmo objeto. */
export function entornoDaAgua(pecas: PecasDoEntorno): EntornoDaAgua {
  const ja = guardados.get(pecas.regioes)
  if (ja !== undefined && ja.ocultas === pecas.ocultas && ja.chao === pecas.chao && ja.props === pecas.props && ja.largura === pecas.largura && ja.altura === pecas.altura) return ja.entorno
  const salas = visibleRegions([...pecas.regioes], pecas.ocultas).filter((r) => r.points.length >= 3 && r.agua !== true)
  const porCima: FormaDoEntorno[] = []
  const semMargem: FormaDoEntorno[] = []
  const partes: unknown[] = [pecas.largura, pecas.altura]
  for (const sala of salas) {
    const anel = plano(sala.points)
    const forma = formaDosAneis([anel])
    if (forma === null) continue
    semMargem.push(forma)
    // A sala sem fundo não tem chão para mostrar: a água segue por baixo dela.
    if (sala.filled !== false) porCima.push(forma)
    partes.push(sala.filled === false ? 0 : 1, anel)
  }
  for (const poligono of pecas.chao) {
    const aneis = [plano(poligono.outer), ...poligono.holes.map(plano)]
    const forma = formaDosAneis(aneis)
    if (forma === null) continue
    porCima.push(forma)
    semMargem.push(forma)
    partes.push(2, aneis)
  }
  for (const prop of pecas.props) {
    if (!ehConstrucao(prop.mobilia)) continue
    const anel = plano(propCorners(prop))
    const forma = formaDosAneis([anel])
    if (forma === null) continue
    semMargem.push(forma)
    partes.push(3, anel)
  }
  const mapa = pecas.largura > 0 && pecas.altura > 0 ? { largura: pecas.largura, altura: pecas.altura } : null
  const entorno: EntornoDaAgua = { mapa, porCima, semMargem, chave: JSON.stringify(partes) }
  guardados.set(pecas.regioes, { ocultas: pecas.ocultas, chao: pecas.chao, props: pecas.props, largura: pecas.largura, altura: pecas.altura, entorno })
  return entorno
}

/** As formas que tocam a caixa (px de mundo). */
export function formasNaCaixa(formas: readonly FormaDoEntorno[], x0: number, y0: number, x1: number, y1: number): FormaDoEntorno[] {
  return formas.filter((f) => f.x1 >= x0 && f.x0 <= x1 && f.y1 >= y0 && f.y0 <= y1)
}

// ---------- perguntas por ponto, com baldes ----------

function distanciaAoSegmento2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax
  const vy = by - ay
  const l2 = vx * vx + vy * vy
  const t = l2 <= 1e-12 ? 0 : Math.min(1, Math.max(0, ((px - ax) * vx + (py - ay) * vy) / l2))
  const dx = px - ax - vx * t
  const dy = py - ay - vy * t
  return dx * dx + dy * dy
}

const chaveDoBalde = (bx: number, by: number): number => (bx + 0x8000) * 0x10000 + (by + 0x8000)

/** Segmentos [ax, ay, bx, by] guardados nos baldes que eles tocam (com a folga `raio`). */
class Baldes {
  private readonly mapa = new Map<number, number[]>()
  readonly segs: number[] = []
  constructor(
    private readonly lado: number,
    private readonly raio: number,
  ) {}
  por(ax: number, ay: number, bx: number, by: number): void {
    const i = this.segs.length
    this.segs.push(ax, ay, bx, by)
    const l = this.lado
    for (let y = Math.floor((Math.min(ay, by) - this.raio) / l); y <= Math.floor((Math.max(ay, by) + this.raio) / l); y += 1) {
      for (let x = Math.floor((Math.min(ax, bx) - this.raio) / l); x <= Math.floor((Math.max(ax, bx) + this.raio) / l); x += 1) {
        const k = chaveDoBalde(x, y)
        const lista = this.mapa.get(k)
        if (lista === undefined) this.mapa.set(k, [i])
        else lista.push(i)
      }
    }
  }
  /** Algum segmento a até `raio` do ponto? */
  perto(px: number, py: number, raio: number): boolean {
    const lista = this.mapa.get(chaveDoBalde(Math.floor(px / this.lado), Math.floor(py / this.lado)))
    if (lista === undefined) return false
    const r2 = raio * raio
    const s = this.segs
    for (const i of lista) if (distanciaAoSegmento2(px, py, s[i], s[i + 1], s[i + 2], s[i + 3]) <= r2) return true
    return false
  }
}

/** Dentro da forma (par ou ímpar), com os segmentos guardados por faixa de altura. */
interface FormaIndexada {
  forma: FormaDoEntorno
  faixa: number
  porFaixa: Map<number, number[]>
}

function indexarForma(forma: FormaDoEntorno, faixa: number): FormaIndexada {
  const porFaixa = new Map<number, number[]>()
  for (const anel of forma.aneis) {
    const m = anel.length / 2
    for (let i = 0; i < m; i += 1) {
      const j = (i + 1) % m
      const ay = anel[i * 2 + 1]
      const by = anel[j * 2 + 1]
      for (let f = Math.floor(Math.min(ay, by) / faixa); f <= Math.floor(Math.max(ay, by) / faixa); f += 1) {
        const lista = porFaixa.get(f)
        const seg = [anel[i * 2], ay, anel[j * 2], by]
        if (lista === undefined) porFaixa.set(f, seg)
        else lista.push(...seg)
      }
    }
  }
  return { forma, faixa, porFaixa }
}

function dentroDaForma(f: FormaIndexada, x: number, y: number): boolean {
  if (x < f.forma.x0 || x > f.forma.x1 || y < f.forma.y0 || y > f.forma.y1) return false
  const s = f.porFaixa.get(Math.floor(y / f.faixa))
  if (s === undefined) return false
  let dentro = false
  for (let i = 0; i + 3 < s.length; i += 4) {
    const ay = s[i + 1]
    const by = s[i + 3]
    if (ay > y !== by > y && x < ((s[i + 2] - s[i]) * (y - ay)) / (by - ay) + s[i]) dentro = !dentro
  }
  return dentro
}

interface IndiceDaEstrutura {
  grid: number
  bordas: Baldes
  formas: FormaIndexada[]
}
const indicesDaEstrutura = new WeakMap<EntornoDaAgua, IndiceDaEstrutura>()

function indiceDaEstrutura(entorno: EntornoDaAgua, grid: number): IndiceDaEstrutura {
  const ja = indicesDaEstrutura.get(entorno)
  if (ja !== undefined && ja.grid === grid) return ja
  const raio = grid * PERTO_DA_ESTRUTURA
  const bordas = new Baldes(Math.max(1, grid), raio)
  const formas: FormaIndexada[] = []
  for (const forma of entorno.semMargem) {
    for (const anel of forma.aneis) {
      const m = anel.length / 2
      for (let i = 0; i < m; i += 1) {
        const j = (i + 1) % m
        bordas.por(anel[i * 2], anel[i * 2 + 1], anel[j * 2], anel[j * 2 + 1])
      }
    }
    formas.push(indexarForma(forma, Math.max(1, grid)))
  }
  const indice = { grid, bordas, formas }
  indicesDaEstrutura.set(entorno, indice)
  return indice
}

/**
 * Por ponto da linha da beira (x, y, ... em px de mundo): 1 = margem (raso,
 * espuma e areia, como antes); 0 = na borda do mapa ou fora dele, ou por baixo
 * / a menos de meia casa de sala, Chão Liso ou construção. `null` = tudo
 * margem (nada muda no campo).
 */
export function margemDaBeira(xy: readonly number[], entorno: EntornoDaAgua | undefined, grid: number): Uint8Array | null {
  if (entorno === undefined || (entorno.mapa === null && entorno.semMargem.length === 0)) return null
  const n = xy.length / 2
  const marca = new Uint8Array(n).fill(1)
  let algum = false
  const folga = grid * NA_BORDA
  const raio = grid * PERTO_DA_ESTRUTURA
  const indice = entorno.semMargem.length > 0 ? indiceDaEstrutura(entorno, grid) : null
  for (let i = 0; i < n; i += 1) {
    const x = xy[i * 2]
    const y = xy[i * 2 + 1]
    const m = entorno.mapa
    const naBorda = m !== null && (x <= folga || y <= folga || x >= m.largura - folga || y >= m.altura - folga)
    const pertoDaEstrutura = !naBorda && indice !== null && (indice.bordas.perto(x, y, raio) || indice.formas.some((f) => dentroDaForma(f, x, y)))
    if (naBorda || pertoDaEstrutura) {
      marca[i] = 0
      algum = true
    }
  }
  return algum ? marca : null
}

// ---------- o pincel de areia ----------

interface TracoIndexado {
  tirar: boolean
  raio: number
  x0: number
  y0: number
  x1: number
  y1: number
  baldes: Baldes
}
const tracosIndexados = new WeakMap<readonly TracoDeAreia[], TracoIndexado[]>()

function indexarTracos(areia: readonly TracoDeAreia[]): TracoIndexado[] {
  const ja = tracosIndexados.get(areia)
  if (ja !== undefined) return ja
  const lista = areia.map((t) => {
    const baldes = new Baldes(Math.max(8, t.raio), t.raio)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (let i = 0; i < t.pontos.length; i += 1) {
      const a = t.pontos[i]
      const b = t.pontos[Math.min(t.pontos.length - 1, i + 1)]
      if (i + 1 < t.pontos.length || t.pontos.length === 1) baldes.por(a.x, a.y, b.x, b.y)
      x0 = Math.min(x0, a.x)
      y0 = Math.min(y0, a.y)
      x1 = Math.max(x1, a.x)
      y1 = Math.max(y1, a.y)
    }
    return { tirar: t.modo === 'tirar', raio: t.raio, x0: x0 - t.raio, y0: y0 - t.raio, x1: x1 + t.raio, y1: y1 + t.raio, baldes }
  })
  tracosIndexados.set(areia, lista)
  return lista
}

/** O último traço que passa no ponto manda: 1 = tirou a areia, 0 = pôs (ou nenhum passou). */
function tirouNoPonto(tracos: readonly TracoIndexado[], x: number, y: number): number {
  for (let i = tracos.length - 1; i >= 0; i -= 1) {
    const t = tracos[i]
    if (x < t.x0 || x > t.x1 || y < t.y0 || y > t.y1) continue
    if (t.baldes.perto(x, y, t.raio)) return t.tirar ? 1 : 0
  }
  return 0
}

/** As provas em volta de cada ponto (frações de `ESMAECER_DA_AREIA`): o meio e dois anéis. */
const PROVAS_DA_AREIA: readonly (readonly [number, number])[] = [
  [0, 0],
  ...Array.from({ length: 6 }, (_, i): [number, number] => [0.5 * Math.cos((i * Math.PI) / 3), 0.5 * Math.sin((i * Math.PI) / 3)]),
  ...Array.from({ length: 8 }, (_, i): [number, number] => [Math.cos(((i + 0.5) * Math.PI) / 4), Math.sin(((i + 0.5) * Math.PI) / 4)]),
]

/**
 * Por ponto da linha da beira: 0 = com areia (como antes) a 1 = sem areia,
 * pelo pincel "Tirar areia / Pôr areia" (o último traço que passa manda). A
 * conta só olha a posição do ponto e os traços (média de provas num disco de
 * meia casa), então dá o mesmo no mestre e no jogador. `null` = sem pincel.
 */
export function semAreiaDaBeira(xy: readonly number[], areia: readonly TracoDeAreia[] | undefined, grid: number): Float32Array | null {
  if (areia === undefined || areia.length === 0) return null
  const tracos = indexarTracos(areia)
  const r = grid * ESMAECER_DA_AREIA
  const n = xy.length / 2
  const saida = new Float32Array(n)
  let algum = false
  for (let i = 0; i < n; i += 1) {
    const x = xy[i * 2]
    const y = xy[i * 2 + 1]
    if (!tracos.some((t) => x >= t.x0 - r && x <= t.x1 + r && y >= t.y0 - r && y <= t.y1 + r)) continue
    let soma = 0
    for (const [fx, fy] of PROVAS_DA_AREIA) soma += tirouNoPonto(tracos, x + fx * r, y + fy * r)
    saida[i] = soma / PROVAS_DA_AREIA.length
    if (saida[i] > 0) algum = true
  }
  return algum ? saida : null
}

/**
 * Os traços de areia que o jogador recebe (a areia tirada não é segredo): só
 * os pedaços que alcançam a beira que ele conhece (`margens`, px de mundo), na
 * mesma ordem. Cada ponto conhecido dá a mesma conta que no mestre: o pedaço
 * que fica fora tem todo segmento longe demais de qualquer prova dele.
 */
export function areiaParaJogador(areia: readonly TracoDeAreia[] | undefined, margens: readonly (readonly number[])[], grid: number): TracoDeAreia[] | undefined {
  if (areia === undefined || areia.length === 0 || margens.length === 0) return undefined
  const saida: TracoDeAreia[] = []
  const alem = grid * ESMAECER_DA_AREIA + 1
  // Os pontos conhecidos, cada um no balde dele.
  const lado = Math.max(8, grid)
  const conhecidos = new Map<number, number[]>()
  for (const m of margens) {
    for (let i = 0; i + 1 < m.length; i += 2) {
      const k = chaveDoBalde(Math.floor(m[i] / lado), Math.floor(m[i + 1] / lado))
      const lista = conhecidos.get(k)
      if (lista === undefined) conhecidos.set(k, [m[i], m[i + 1]])
      else lista.push(m[i], m[i + 1])
    }
  }
  for (const traco of areia) {
    const alcance = traco.raio + alem
    const r2 = alcance * alcance
    /** Algum ponto conhecido a até `alcance` do segmento ab? */
    const alcanca = (ax: number, ay: number, bx: number, by: number): boolean => {
      for (let y = Math.floor((Math.min(ay, by) - alcance) / lado); y <= Math.floor((Math.max(ay, by) + alcance) / lado); y += 1) {
        for (let x = Math.floor((Math.min(ax, bx) - alcance) / lado); x <= Math.floor((Math.max(ax, bx) + alcance) / lado); x += 1) {
          const lista = conhecidos.get(chaveDoBalde(x, y))
          if (lista === undefined) continue
          for (let i = 0; i + 1 < lista.length; i += 2) if (distanciaAoSegmento2(lista[i], lista[i + 1], ax, ay, bx, by) <= r2) return true
        }
      }
      return false
    }
    const p = traco.pontos
    if (p.length === 1) {
      if (alcanca(p[0].x, p[0].y, p[0].x, p[0].y)) saida.push({ modo: traco.modo, raio: traco.raio, pontos: [p[0]] })
      continue
    }
    let atual: TracoDeAreia['pontos'] = []
    for (let i = 0; i + 1 < p.length; i += 1) {
      if (alcanca(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y)) {
        if (atual.length === 0) atual.push(p[i])
        atual.push(p[i + 1])
      } else if (atual.length > 0) {
        saida.push({ modo: traco.modo, raio: traco.raio, pontos: atual })
        atual = []
      }
    }
    if (atual.length > 0) saida.push({ modo: traco.modo, raio: traco.raio, pontos: atual })
  }
  return saida.length === 0 ? undefined : saida
}
