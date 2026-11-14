import type { AlturaDoPiso, MapData, RegionPoint, Token, TokenContract } from '../types/map'
import {
  fichasNaVisaoDeBaixo,
  OLHAR_PARA_CIMA,
  playerEyeTokens,
  pisoDoJogador,
  vistaDeOutroPiso,
  type PlayerMapView,
  type SoDoJogadorNoOutroPiso,
  type VisionRadius,
  type VistaDeOutroPiso,
} from './fogFilter'
import { pieceBounds, pieceDistance, type Bounds } from './floorSdf'
import { alturaDoPiso, editandoUmPiso, mapaDoPiso, pisoDe } from './pisos'
import { pointInPolygonInclusive } from './roomNesting'
import { visionSegments } from './visibility'

/**
 * TERRENO ALTO (muralha do Reino de Goa, pedido de 14/11/2026) — lógica pura.
 *
 * A muralha é o piso 1 da mesma cena. Quem está nele vê o piso de baixo
 * (chão, construções, telhados e fichas) borrado e escurecido pela "Altura"
 * do piso dele, até onde a visão dele alcança: as paredes do piso DELE seguram
 * o olhar (a torre tem parede, a mureta-janela deixa passar); as do piso de
 * baixo, não. O chão do piso dele cobre o que está embaixo (debaixo da
 * passarela, dentro da torre), então nada de lá sai. Quem está embaixo vê as
 * fichas do piso de cima que a visão dele alcança, sem desfoque, se não
 * houver chão do piso de cima sobre a cabeça dele (dentro da torre não se vê
 * o andar de cima). O chão do piso de cima continua escondido para ele.
 *
 * Tudo sai do recorte de sempre (`vistaDeOutroPiso`, `lib/fogFilter.ts`):
 * névoa, zona oculta, sala secreta, teto fechado, camada e ficha oculta ou
 * secreta seguem as mesmas regras. Cena sem pisos: nada (`null`), e o
 * snapshot sai idêntico ao de antes.
 */

/** O piso de baixo como o jogador de cima o vê, com a altura do piso DELE. */
export interface VistaDoPisoDeBaixo extends VistaDeOutroPiso {
  altura: AlturaDoPiso
}

/** `snapshot.alto`: cada parte só existe quando há algo nela. */
export interface TerrenoAlto {
  abaixo?: VistaDoPisoDeBaixo
  /** As fichas do piso de cima que ele vê daqui de baixo. */
  acima?: Token[]
}

/** Valor que serve como altura de piso. */
export function ehAlturaDoPiso(valor: unknown): valor is AlturaDoPiso {
  return valor === 'baixa' || valor === 'media' || valor === 'alta'
}

/** O desfoque e o escuro da vista do piso de baixo, por altura. Mais alto: mais borrado e mais escuro. */
export interface EfeitoDaAltura {
  /** Raio do desfoque, em px de tela. */
  readonly borraoPx: number
  /** Brilho (1 = igual). */
  readonly brilho: number
  /** Saturação (1 = igual): longe, a cor some um pouco. */
  readonly saturacao: number
}

export const EFEITO_DA_ALTURA: Readonly<Record<AlturaDoPiso, EfeitoDaAltura>> = {
  baixa: { borraoPx: 1.5, brilho: 0.8, saturacao: 0.9 },
  media: { borraoPx: 3, brilho: 0.66, saturacao: 0.8 },
  alta: { borraoPx: 5, brilho: 0.52, saturacao: 0.7 },
}

/** O nome que o painel mostra. */
export const NOME_DA_ALTURA: Readonly<Record<AlturaDoPiso, string>> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

function dentroDaCaixa(b: Bounds, p: RegionPoint): boolean {
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY
}

function caixaDe(points: readonly RegionPoint[]): Bounds {
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) }
}

/**
 * O CHÃO de um piso, como pergunta: o ponto está sobre uma peça de Chão (a
 * última peça que o contém soma) ou dentro de uma Sala dele. É o que cobre o
 * piso de baixo para quem está em cima e o que tapa o céu de quem está
 * embaixo. Piso sem chão nem Sala: `null` (nada cobre).
 */
export function coberturaDoPiso(map: Pick<MapData, 'floor' | 'regions'>): ((p: RegionPoint) => boolean) | null {
  const pecas = map.floor.map((f) => ({ f, b: pieceBounds(f) }))
  const salas = map.regions.filter((r) => r.points.length >= 3).map((r) => ({ points: r.points, b: caixaDe(r.points) }))
  if (pecas.length === 0 && salas.length === 0) return null
  return (p) => {
    if (salas.some((s) => dentroDaCaixa(s.b, p) && pointInPolygonInclusive(p, s.points))) return true
    let chao = false
    for (const { f, b } of pecas) if (dentroDaCaixa(b, p) && pieceDistance(f, p.x, p.y) <= 0) chao = f.op === 'add'
    return chao
  }
}

/** Entrada de `terrenoAltoDoJogador`: o mapa INTEIRO do mestre e o recorte que o jogador já recebe do piso dele. */
export interface EntradaDoTerrenoAlto {
  mapaInteiro: MapData
  playerId: string
  ownership: Record<string, string[]>
  raio: VisionRadius
  loans?: ReadonlyMap<string, TokenContract>
  /** O recorte do piso DELE (`filterMapForPlayer`): as paredes que seguram o olhar e o chão que cobre saem daqui. */
  recorte: PlayerMapView
  only?: SoDoJogadorNoOutroPiso
}

/**
 * TERRENO ALTO — o que o jogador recebe de outros pisos neste recorte. Cena
 * sem pisos, jogador sem olho ou nada a mostrar: `null`, e o snapshot não
 * ganha campo.
 */
export function terrenoAltoDoJogador({ mapaInteiro, playerId, ownership, raio, loans, recorte, only = {} }: EntradaDoTerrenoAlto): TerrenoAlto | null {
  // `mapaDoPiso` em cache: cena sem pisos volta ELA MESMA, sem varrer nada.
  if (!editandoUmPiso(mapaInteiro, 0)) return null
  const piso = pisoDoJogador(mapaInteiro, playerId, ownership, loans)
  const olhos = playerEyeTokens(mapaInteiro, playerId, ownership, loans).filter((t) => pisoDe(t) === piso)
  if (olhos.length === 0) return null
  const abaixo = piso > 0 ? vistaDoPisoDeBaixo(mapaInteiro, piso, olhos, raio, recorte, only) : null
  const acima = fichasDoPisoDeCima(mapaInteiro, piso, olhos, raio, recorte.vision, only)
  if (abaixo === null && acima.length === 0) return null
  return { ...(abaixo === null ? {} : { abaixo }), ...(acima.length === 0 ? {} : { acima }) }
}

/**
 * De cima: o piso de baixo pela visão dos olhos dele, com as paredes que ELE
 * recebe do piso dele segurando o olhar (sem a borda do chão: da beira da
 * muralha se olha para baixo) e o chão que ele conhece do piso dele cobrindo.
 */
function vistaDoPisoDeBaixo(
  mapaInteiro: MapData,
  piso: number,
  olhos: readonly Token[],
  raio: VisionRadius,
  recorte: PlayerMapView,
  only: SoDoJogadorNoOutroPiso,
): VistaDoPisoDeBaixo | null {
  const obstaculos = visionSegments({ ...recorte.map, offFloor: 'free' })
  const vista = vistaDeOutroPiso(mapaInteiro, piso - 1, olhos, raio, { obstaculos, cobre: coberturaDoPiso(recorte.map) }, only)
  return vista === null ? null : { ...vista, altura: alturaDoPiso(mapaInteiro, piso) }
}

/** De baixo: as fichas do piso de cima que a visão dele alcança, só dos olhos que têm o céu aberto em cima. */
function fichasDoPisoDeCima(
  mapaInteiro: MapData,
  piso: number,
  olhos: readonly Token[],
  raio: VisionRadius,
  visao: readonly RegionPoint[][],
  only: SoDoJogadorNoOutroPiso,
): Token[] {
  const deCima = mapaDoPiso(mapaInteiro, piso + 1)
  if (deCima.tokens.length === 0 || visao.length === 0) return []
  const teto = coberturaDoPiso(deCima)
  const aCeuAberto = teto === null ? olhos : olhos.filter((o) => !teto({ x: o.x, y: o.y }))
  const vista = vistaDeOutroPiso(mapaInteiro, piso + 1, aCeuAberto, raio, OLHAR_PARA_CIMA, only)
  return vista === null ? [] : fichasNaVisaoDeBaixo(vista.map.tokens, visao, mapaInteiro.grid)
}
