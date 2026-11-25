import type { AlturaDoPiso, FloorPiece, MapData, RegionPoint, Token, TokenContract } from '../types/map'
import { formasDeChao, tintaDoChao } from './chaoPintado'
import {
  fichasNaVisaoDeBaixo,
  playerEyeTokens,
  pisoDoJogador,
  vistaDeOutroPiso,
  type PlayerMapView,
  type SoDoJogadorNoOutroPiso,
  type VisionRadius,
  type VistaDeOutroPiso,
} from './fogFilter'
import { pieceBounds, pieceDistance, type Bounds } from './floorSdf'
import type { LuzDoJogador } from './periodo'
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
 * baixo, não. O chão do piso dele — peça de Chão, Sala, desenho cheio ou textura pintada
 * (`chaoDeQuemOlhaDeCima`) — cobre o que está embaixo (debaixo da
 * passarela, dentro da torre), então nada de lá sai. Quem está embaixo vê as
 * fichas do piso de cima que a visão dele alcança, sem desfoque, se não
 * houver chão do piso de cima sobre a cabeça dele — peça de Chão, Sala,
 * desenho cheio ou textura pintada (`tetoDoPiso`); dentro da torre não se vê
 * o andar de cima.
 * As paredes do piso de cima seguram esse olhar: a sala fechada lá em cima
 * esconde quem está nela; a mureta-janela e a porta aberta deixam passar.
 * O chão do piso de cima continua escondido para ele.
 *
 * Tudo sai do recorte de sempre (`vistaDeOutroPiso`, `lib/fogFilter.ts`):
 * névoa, zona oculta, sala secreta, teto fechado, camada e ficha oculta ou
 * secreta seguem as mesmas regras. Cena sem pisos: nada (`null`), e o
 * snapshot sai idêntico ao de antes.
 */

/** O piso de baixo como o jogador de cima o vê, com a altura do piso DELE. */
export interface VistaDoPisoDeBaixo extends VistaDeOutroPiso {
  altura: AlturaDoPiso
  /**
   * TEMA DO AMBIENTE: a tinta do piso de baixo, só quando ela é OUTRA que a do
   * piso dele (`luzDoPisoDeBaixo`, o host põe). Ausente = a mesma do snapshot.
   */
  luz?: LuzDoJogador
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

/** A peça conta como chão: não está escondida e "Conta como Chão" está ligado (`chaoQueLimita` exclui a mesma). */
function pecaContaComoChao(f: FloorPiece): boolean {
  return f.hidden !== true && f.soPintura !== true
}

/**
 * O CHÃO de um piso, como pergunta: o ponto está sobre uma peça de Chão que
 * conta (a última peça que o contém soma) ou dentro de uma forma cheia que é
 * chão — Sala, região com fundo ou desenho cheio (`formasDeChao`,
 * `lib/chaoPintado.ts`). É o que cobre o piso de baixo para quem está em cima
 * e o que tapa o céu de quem está embaixo. Sem o desenho cheio, o andar de
 * cima feito a Pincel ou Balde era céu aberto (levantamento de 25/11/2026, Nº
 * 6). Piso sem nada disso: `null` (nada cobre).
 */
export function coberturaDoPiso(map: Pick<MapData, 'floor' | 'regions' | 'drawings'>): ((p: RegionPoint) => boolean) | null {
  const pecas = map.floor.filter(pecaContaComoChao).map((f) => ({ f, b: pieceBounds(f) }))
  const formas = formasDeChao(map.regions, map.drawings).map(({ pontos }) => ({ pontos, b: caixaDe(pontos) }))
  if (pecas.length === 0 && formas.length === 0) return null
  return (p) => {
    if (formas.some((s) => dentroDaCaixa(s.b, p) && pointInPolygonInclusive(p, s.pontos))) return true
    let chao = false
    for (const { f, b } of pecas) if (dentroDaCaixa(b, p) && pieceDistance(f, p.x, p.y) <= 0) chao = f.op === 'add'
    return chao
  }
}

/**
 * O CHÃO PINTADO de um piso, como pergunta: a regra de `lib/chaoPintado.ts`
 * (o último passo que cobre o ponto vale, a força não conta, os recortes do
 * Balde ficam de fora). Mapa feito só com paredes e Balde não tem peça de
 * Chão: é a textura que diz onde o piso tem chão. Piso sem textura: `null`.
 */
function chaoPintadoDoPiso(map: Pick<MapData, 'texturas' | 'regions' | 'drawings'>): ((p: RegionPoint) => boolean) | null {
  return tintaDoChao(map.texturas, map.regions, map.drawings)?.tem ?? null
}

/**
 * O CHÃO PINTADO como pergunta de custo fixo, para o olhar PARA BAIXO: o
 * recorte pergunta o `cobre` ponto a ponto, dezenas de milhares de vezes
 * (`cobertoDeCima`, `lib/fogFilter.ts`), e a regra anda cada passo e cada
 * trecho de cada traço. Aqui cada meia casa responde pela regra no CENTRO
 * dela, contada na primeira pergunta e guardada. A meia casa segue a grade do
 * mapa: a borda pintada rente à grade cai entre duas, não no meio de uma.
 * Fora da caixa de toda a tinta posta não há tinta. Grade sem tamanho: a regra
 * ponto a ponto.
 */
function chaoPintadoPorMeiaCasa(map: Pick<MapData, 'texturas' | 'regions' | 'drawings' | 'grid' | 'gridOffset'>): ((p: RegionPoint) => boolean) | null {
  const tinta = tintaDoChao(map.texturas, map.regions, map.drawings)
  if (tinta === null) return null
  const lado = map.grid / 2
  if (!(Number.isFinite(lado) && lado > 0)) return tinta.tem
  const { caixa } = tinta
  const origem = map.gridOffset ?? { x: 0, y: 0 }
  const primeiraColuna = Math.floor((caixa.minX - origem.x) / lado)
  const primeiraLinha = Math.floor((caixa.minY - origem.y) / lado)
  const colunas = Math.floor((caixa.maxX - origem.x) / lado) - primeiraColuna + 1
  const respostas = new Map<number, boolean>()
  return (p) => {
    if (!dentroDaCaixa(caixa, p)) return false
    const coluna = Math.floor((p.x - origem.x) / lado)
    const linha = Math.floor((p.y - origem.y) / lado)
    const chave = (linha - primeiraLinha) * colunas + (coluna - primeiraColuna)
    let resposta = respostas.get(chave)
    if (resposta === undefined) {
      resposta = tinta.tem({ x: origem.x + (coluna + 0.5) * lado, y: origem.y + (linha + 0.5) * lado })
      respostas.set(chave, resposta)
    }
    return resposta
  }
}

/** Uma das duas perguntas diz que cobre; `null` quando nenhuma existe. */
function cobreUmaOuOutra(
  a: ((p: RegionPoint) => boolean) | null,
  b: ((p: RegionPoint) => boolean) | null,
): ((p: RegionPoint) => boolean) | null {
  if (a === null) return b
  if (b === null) return a
  return (p) => a(p) || b(p)
}

/**
 * O TETO de quem está embaixo: o chão do piso de cima — peça de Chão, Sala,
 * região com fundo, desenho cheio (`coberturaDoPiso`) ou textura pintada
 * (`chaoPintadoDoPiso`). Sem a textura, quem estava no 1º andar de um
 * castelo pintado a Balde via as fichas do 2º andar através do teto e da
 * parede (bug de 25/11/2026). Pergunta só pelo ponto de cada olho: a regra
 * exata, sem meia casa. Também é o teto que tira a chuva de baixo
 * (`cobertasDoPisoDeCima`, `lib/abrigoDoAmbiente.ts`).
 */
export function tetoDoPiso(map: Pick<MapData, 'floor' | 'regions' | 'texturas' | 'drawings'>): ((p: RegionPoint) => boolean) | null {
  return cobreUmaOuOutra(coberturaDoPiso(map), chaoPintadoDoPiso(map))
}

/**
 * O CHÃO de quem olha de cima, que cobre o piso de baixo: o mesmo do teto,
 * com a textura por meia casa (`chaoPintadoPorMeiaCasa`), porque o recorte
 * pergunta ponto a ponto. Sem a textura, quem estava sobre um piso feito de
 * paredes e Balde via o de baixo através do próprio chão (bug de 25/11/2026).
 */
function chaoDeQuemOlhaDeCima(map: Pick<MapData, 'floor' | 'regions' | 'texturas' | 'drawings' | 'grid' | 'gridOffset'>): ((p: RegionPoint) => boolean) | null {
  return cobreUmaOuOutra(chaoPintadoPorMeiaCasa(map), coberturaDoPiso(map))
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
 * muralha se olha para baixo) e o chão que ele conhece do piso dele — Chão,
 * Sala, desenho cheio ou textura pintada (`chaoDeQuemOlhaDeCima`) — cobrindo.
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
  const vista = vistaDeOutroPiso(mapaInteiro, piso - 1, olhos, raio, { obstaculos, cobre: chaoDeQuemOlhaDeCima(recorte.map) }, only)
  return vista === null ? null : { ...vista, altura: alturaDoPiso(mapaInteiro, piso) }
}

/**
 * De baixo: as fichas do piso de cima que a visão dele alcança, só dos olhos
 * que têm o céu aberto em cima. As paredes do PISO DE CIMA seguram o olhar
 * (sem a borda do chão de lá): sem elas, a ficha numa sala fechada do andar de
 * cima, logo além da parede, aparecia para quem está na rua (bug de
 * 25/11/2026). Mureta-janela e porta aberta deixam passar, como no olhar para
 * baixo, e nada cobre.
 */
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
  const teto = tetoDoPiso(deCima)
  const aCeuAberto = teto === null ? olhos : olhos.filter((o) => !teto({ x: o.x, y: o.y }))
  const obstaculos = visionSegments({ ...deCima, offFloor: 'free' })
  const vista = vistaDeOutroPiso(mapaInteiro, piso + 1, aCeuAberto, raio, { obstaculos, cobre: null }, only)
  return vista === null ? [] : fichasNaVisaoDeBaixo(vista.map.tokens, visao, mapaInteiro.grid)
}
