import type { MapData, Region, RegionPoint } from '../types/map'
import type { Exploration } from './exploration'
import { isContinente } from './marcadorDeContinente'
import { isPointInPolygon } from './selectionHitTest'

/**
 * RELEVO DO MAPA (fatia 1 do plano de 09/10/2026): três efeitos automáticos,
 * sem nenhum dado novo do mestre, tirados do protótipo "Relevo sutil" que o
 * usuário aprovou:
 * - LUZ de cima à esquerda sobre a terra (degradê suave, friso claro na beira
 *   virada para a luz e sombra fina na oposta);
 * - SOMBRA DA TERRA NO MAR (a silhueta da terra, borrada, para baixo e à direita);
 * - SOMBRA NAS FRONTEIRAS entre regiões de terra (a costa não escurece).
 *
 * A costa não existe como dado: tudo sai da UNIÃO das regiões de terra. A
 * união vira máscara rasterizada (`pixi/relevoRaster.ts`), e a única coisa que
 * precisa de geometria aqui é separar, em cada lado de região, o trecho que é
 * FRONTEIRA (terra dos dois lados) do que é COSTA (mar de um lado).
 *
 * Puro: sem DOM, sem Pixi. Cada tela (mestre e jogador) gera o próprio relevo
 * a partir das regiões que ELA recebeu, então região fora do recorte do
 * jogador não entra em nada daqui.
 */

/** Largura do protótipo aprovado, em px: os números de `AJUSTE_DO_RELEVO` são px dele. */
export const LADO_DO_PROTOTIPO = 1242

/**
 * Teto do lado da textura do relevo, em texels. Os efeitos são de baixa
 * frequência (borrões de 14 a 18 px do protótipo), então aguentam resolução
 * bem menor que a do mapa: 2048² RGBA = 16 MB de GPU, uma textura só.
 */
export const TETO_DA_TEXTURA = 2048

/** Nunca mais de 1 texel por px de mundo: além disso a textura só gasta memória. */
const ESCALA_MAXIMA = 1

/**
 * Todos os números do relevo num lugar só. Distâncias em px do PROTÓTIPO
 * (`LADO_DO_PROTOTIPO`), convertidas pela `unidade` de cada mapa. Cor em RGB
 * e alfa à parte. Ponto de partida: os números do protótipo; o degradê e a
 * sombra da fronteira foram recalculados porque o app compõe em mistura
 * normal (o protótipo usava "luz suave" do canvas, que no Pixi custaria um
 * filtro por quadro) — ver os comentários de cada um.
 */
export const AJUSTE_DO_RELEVO = {
  sombra: { cor: [0, 9, 20], alfa: 0.55, borrao: 18, dx: 7, dy: 11 },
  /**
   * Fronteira: uma faixa de `largura` px sobre a divisa, borrada. No protótipo
   * era a vizinha inteira borrada (meio-plano, 0,34 × 50% = 0,17 na divisa); a
   * faixa de 6 px borrada com 14 px chega a ~33% do alfa no meio, então 0,5
   * dá os mesmos ~0,17 na divisa.
   */
  oclusao: { cor: [10, 16, 12], alfa: 0.5, borrao: 14, largura: 6 },
  luz: {
    /**
     * Degradê em mistura normal. "Luz suave" a 0,55 (branco) e 0,5 (preto)
     * clareia/escurece uns 13% um tom médio; branco a 0,16 e preto a 0,2 em
     * mistura normal dão perto disso sem lavar as cores escuras.
     */
    claro: 0.16,
    escuro: 0.2,
    friso: { cor: [255, 249, 232], alfa: 0.5, borrao: 2 },
    sombraBorda: { cor: [28, 16, 6], alfa: 0.3, borrao: 3 },
    /** Quanto a terra é deslocada para achar a beira virada para a luz (e a oposta). */
    bisel: 2.5,
  },
} as const

/** Ponto em px de mundo. */
export interface Segmento {
  a: RegionPoint
  b: RegionPoint
}

export interface RetanguloDeMundo {
  x: number
  y: number
  largura: number
  altura: number
}

/** Tudo o que o rasterizador precisa. Só sai daqui o que as regiões recebidas desenham. */
export interface PlanoDoRelevo {
  /** Polígonos da terra (preenchidos um a um, viram a união). */
  terras: RegionPoint[][]
  /** Trechos de lado de região com terra dos dois lados: onde a fronteira escurece. */
  fronteiras: Segmento[]
  /** Pedaço do mundo que a textura cobre: a terra mais a folga da sombra. */
  retangulo: RetanguloDeMundo
  /** Texels por px de mundo (≤ 1, e o lado maior da textura ≤ o teto). */
  escala: number
  /** Px de mundo por px do protótipo. */
  unidade: number
  /** Tamanho do mapa em px de mundo: o degradê da luz vai do canto de cima à esquerda ao de baixo à direita dele. */
  mapa: { largura: number; altura: number }
  /**
   * Px de mundo que a classificação de `bordasDaTerra` olha para cada lado: a
   * fresta (ou costura) que ela chamou de fronteira. O rasterizador fecha essa
   * mesma fresta na união, senão a fronteira ganharia friso e sombra de costa.
   */
  folgaDaFronteira: number
  /** O que esta tela já conhece (só o jogador). Ausente: tudo (o mestre). */
  conhecido?: ConhecidoDoRelevo
}

/**
 * O que o jogador já conhece: a mesma geometria da máscara do conhecido da
 * névoa (`redrawFog` em PlayerView): o que ele vê agora e o explorado.
 *
 * Por que o relevo precisa disto além da máscara: o recorte manda a região
 * INTEIRA assim que um pedaço dela é visto, e os efeitos se espalham (a sombra
 * no mar anda e borra centenas de px de mundo). A máscara só esconde o PIXEL
 * fora do conhecido; a sombra de uma costa ainda na névoa cairia no mar já
 * visto e desenharia o formato dela. Então a ORIGEM de cada efeito também é
 * cortada pelo conhecido.
 */
export interface ConhecidoDoRelevo {
  visao: readonly (readonly RegionPoint[])[]
  explorado?: Exploration
}

/**
 * O relevo está ligado nesta cena? A chave do mestre, quando ele escolheu; sem
 * ela, o padrão do tipo de mapa: ligado no Continente, desligado no Normal (os
 * mapas de masmorra seguem no estilo minimapa simples).
 */
export function relevoLigado(map: Pick<MapData, 'relevo' | 'continente' | 'worldMap'>): boolean {
  return map.relevo ?? isContinente(map)
}

/**
 * Px de mundo por px do protótipo. Sai do tamanho do MAPA, não da terra: o
 * jogador recebe só parte das regiões, e o efeito precisa ter o mesmo tamanho
 * na tela dele e na do mestre (e não mudar enquanto ele explora).
 */
export function unidadeDoRelevo(map: Pick<MapData, 'width' | 'height' | 'grid'>): number {
  const lado = Math.max(map.width, map.height) * map.grid
  return lado > 0 ? lado / LADO_DO_PROTOTIPO : 1
}

/**
 * Regiões que contam como terra: polígono de verdade e com fundo. Região "só
 * contorno" (`filled === false`, rua, construção artesanal) não é chão.
 */
export function terrasDoRelevo(regioes: readonly Region[]): RegionPoint[][] {
  return regioes.filter((r) => r.filled !== false && r.points.length >= 3 && r.points.every(pontoFinito)).map((r) => r.points)
}

function pontoFinito(p: RegionPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y)
}

interface Caixa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function caixaDe(pontos: readonly RegionPoint[]): Caixa {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}

export interface BordasDaTerra {
  /** Terra dos dois lados. */
  fronteiras: Segmento[]
  /** Mar de um lado: a beira da união. */
  costa: Segmento[]
}

/**
 * Separa cada lado de região em FRONTEIRA (terra dos dois lados) e COSTA (mar
 * de um lado). O lado é cortado em pedaços de até `passo` px de mundo, e cada
 * pedaço olha `folga` px para cada lado, a partir do meio dele: duas regiões
 * vizinhas desenhadas à mão quase nunca dividem o vértice exato, e a folga
 * absorve a fresta. Pedaços seguidos do mesmo tipo voltam a ser um segmento só.
 */
export function bordasDaTerra(terras: readonly RegionPoint[][], passo: number, folga: number): BordasDaTerra {
  const caixas = terras.map(caixaDe)
  const naTerra = (p: RegionPoint): boolean =>
    terras.some((poligono, i) => {
      const c = caixas[i]
      return p.x >= c.minX && p.x <= c.maxX && p.y >= c.minY && p.y <= c.maxY && isPointInPolygon(p, poligono)
    })
  const fronteiras: Segmento[] = []
  const costa: Segmento[] = []
  for (const poligono of terras) {
    for (let i = 0; i < poligono.length; i += 1) {
      const a = poligono[i]
      const b = poligono[(i + 1) % poligono.length]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const comprimento = Math.hypot(dx, dy)
      if (comprimento === 0) continue
      const nx = -dy / comprimento
      const ny = dx / comprimento
      const pedacos = Math.max(1, Math.ceil(comprimento / passo))
      let inicio = 0
      let tipoAtual: boolean | null = null
      const fechar = (fim: number) => {
        if (tipoAtual === null) return
        const segmento = { a: interpolar(a, b, inicio / pedacos), b: interpolar(a, b, fim / pedacos) }
        ;(tipoAtual ? fronteiras : costa).push(segmento)
      }
      for (let k = 0; k < pedacos; k += 1) {
        const meio = interpolar(a, b, (k + 0.5) / pedacos)
        const ehFronteira =
          naTerra({ x: meio.x + nx * folga, y: meio.y + ny * folga }) && naTerra({ x: meio.x - nx * folga, y: meio.y - ny * folga })
        if (tipoAtual !== ehFronteira) {
          fechar(k)
          inicio = k
          tipoAtual = ehFronteira
        }
      }
      fechar(pedacos)
    }
  }
  return { fronteiras, costa }
}

function interpolar(a: RegionPoint, b: RegionPoint, t: number): RegionPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Pedaço máximo de lado que a classificação olha, em px do protótipo: bem menor que o borrão da fronteira. */
const PASSO_DA_BORDA = 4
/** Quanto cada pedaço olha para cada lado, em px do protótipo: absorve a fresta entre regiões vizinhas. */
const FOLGA_DA_BORDA = 1.5

/**
 * O plano do relevo para estas regiões, ou `null` sem terra nenhuma (nada a
 * gerar, e a textura anterior pode ser liberada). `teto` limita o lado maior
 * da textura; a escala é proporcional e nunca passa de 1 texel por px.
 */
export function planoDoRelevo(
  map: Pick<MapData, 'width' | 'height' | 'grid'>,
  regioes: readonly Region[],
  teto: number = TETO_DA_TEXTURA,
): PlanoDoRelevo | null {
  const terras = terrasDoRelevo(regioes)
  if (terras.length === 0) return null
  const unidade = unidadeDoRelevo(map)
  const { fronteiras } = bordasDaTerra(terras, PASSO_DA_BORDA * unidade, FOLGA_DA_BORDA * unidade)

  const caixa = caixaDe(terras.flat())
  const s = AJUSTE_DO_RELEVO.sombra
  // O borrão do canvas (`shadowBlur` b) é uma gaussiana de desvio b/2: 3 desvios = 1,5 b.
  const folga = (Math.max(Math.abs(s.dx), Math.abs(s.dy)) + s.borrao * 1.5) * unidade
  const retangulo = {
    x: caixa.minX - folga,
    y: caixa.minY - folga,
    largura: caixa.maxX - caixa.minX + folga * 2,
    altura: caixa.maxY - caixa.minY + folga * 2,
  }
  const escala = Math.min(ESCALA_MAXIMA, teto / Math.max(retangulo.largura, retangulo.altura))
  return {
    terras,
    fronteiras,
    retangulo,
    escala,
    unidade,
    mapa: { largura: map.width * map.grid, altura: map.height * map.grid },
    folgaDaFronteira: FOLGA_DA_BORDA * unidade,
  }
}

/** Tamanho da textura do plano, em texels: o que vai para a GPU. */
export function tamanhoDaTextura(plano: Pick<PlanoDoRelevo, 'retangulo' | 'escala'>): { largura: number; altura: number } {
  return {
    largura: Math.max(1, Math.ceil(plano.retangulo.largura * plano.escala)),
    altura: Math.max(1, Math.ceil(plano.retangulo.altura * plano.escala)),
  }
}

/**
 * Assinatura do que o relevo desenha destas regiões: muda só quando a terra
 * muda. A tela do jogador recebe as regiões de novo a cada pacote (objetos
 * novos, mesmo conteúdo); sem isto, todo passo de ficha regeraria o relevo.
 */
export function assinaturaDaTerra(regioes: readonly Region[]): string {
  return regioes
    .map((r) => `${r.id}${r.filled === false ? '-' : ''}:${r.points.map((p) => `${p.x},${p.y}`).join(' ')}`)
    .join('|')
}

/**
 * Ids das regiões que contam como terra. Some algum de uma vez para a outra,
 * a terra encolheu (o mestre ocultou a região, ou a tirou do recorte): o
 * relevo dela não pode ficar no palco à espera da textura nova.
 */
export function idsDaTerra(regioes: readonly Region[]): Set<string> {
  const ids = new Set<string>()
  for (const r of regioes) {
    if (r.filled !== false && r.points.length >= 3 && r.points.every(pontoFinito)) ids.add(r.id)
  }
  return ids
}

/**
 * O conhecido é o mesmo? Por referência primeiro; referência nova (pacote
 * novo do host) compara o conteúdo, para um pacote que só trouxe o mesmo
 * explorado não refazer o relevo. Ausente dos dois lados (o mestre) é igual.
 */
export function mesmoConhecido(a: ConhecidoDoRelevo | undefined, b: ConhecidoDoRelevo | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  return mesmosPoligonos(a.visao, b.visao) && mesmoExplorado(a.explorado, b.explorado)
}

function mesmosPoligonos(a: readonly (readonly RegionPoint[])[], b: readonly (readonly RegionPoint[])[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  return a.every((poligono, i) => {
    const outro = b[i]
    return poligono.length === outro.length && poligono.every((p, k) => p.x === outro[k].x && p.y === outro[k].y)
  })
}

function mesmoExplorado(a: Exploration | undefined, b: Exploration | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (a.cell !== b.cell || a.cols !== b.cols || a.rows !== b.rows || a.bits.length !== b.bits.length) return false
  if (a.ringVertices !== b.ringVertices || !mesmosPoligonos(a.rings.map((r) => r.points), b.rings.map((r) => r.points))) return false
  for (let i = 0; i < a.bits.length; i += 1) if (a.bits[i] !== b.bits[i]) return false
  return true
}
