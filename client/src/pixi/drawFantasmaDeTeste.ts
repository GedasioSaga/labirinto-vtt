/**
 * FANTASMA DA FICHA DE TESTE — o desenho (Visão de jogador, entrega 3). No
 * Jogar da janela de teste a ficha anda só no teste; o editor mostra, por cima
 * das fichas, uma cópia translúcida dela onde ela está lá (`FantasmaDeTeste`,
 * net/visaoDeTeste/tipos.ts). Aqui só há geometria pura sobre Graphics; quem
 * monta, anima e carrega a foto é `fantasmaDeTeste.ts`.
 *
 * A LINGUAGEM É A DO SELO "Teste" da barra da janela
 * (`player/visaoDeTeste/BarraDoTeste.css`): tracejado neutro, pergaminho sobre
 * pedra, nunca latão — latão quer dizer "ação para você", e o fantasma não se
 * toca. O disco da ficha sai translúcido (`FANTASMA_CORPO_ALPHA`) e o resto
 * fica nítido por cima: o anel tracejado no lugar da moldura, a etiqueta
 * "Teste" no lugar do nome e os pontos que ligam à ficha de verdade. É a regra
 * do selo do Volto já (`tokensRenderer.ts`): o disco apaga e a marca diz por quê.
 *
 * Por que precisa de etiqueta e não basta o tracejado: o editor já tem duas
 * fichas translúcidas tracejadas — "Oculto no editor" (contorno na borda) e
 * "Oculto para jogadores" (contorno por fora). A palavra é o que separa o
 * fantasma das duas num relance, e é a mesma palavra da janela aberta ao lado.
 */
import type { Graphics } from 'pixi.js'
import { isLayerVisible, tokenLayer } from '../lib/layers'
import type { FantasmaDeTeste } from '../net/visaoDeTeste/tipos'
import { theme } from '../theme'
import type { MapData, Token } from '../types/map'
import { tokenCircleRadius } from './drawTokens'

/** Nome (`Container.label`) da raiz do fantasma no mundo — é por ele que o teste o acha. */
export const FANTASMA_DE_TESTE_LABEL = 'fantasma-de-teste'

/**
 * Opacidade do disco (foto ou cor): o chão aparece através dele e a foto ainda
 * se reconhece a 50% de zoom. Um pouco acima da metade de propósito: a 0,5, a
 * ficha vermelha sobre o chão verde virava um disco oliva que não lembrava a
 * ficha (prints de 08/10/2026). O anel e a etiqueta não apagam.
 */
export const FANTASMA_CORPO_ALPHA = 0.6

/** `#rrggbb` do tema como número do Pixi: o mapa e a janela falam a mesma cor. */
function corDoTema(hex: string): number {
  return Number.parseInt(hex.slice(1), 16)
}

/** As tintas do selo "Teste": o pergaminho do traço, a pedra do fundo e o pergaminho apagado do texto. */
export const TINTA_CLARA_DO_TESTE = corDoTema(theme.color.parchment)
export const TINTA_ESCURA_DO_TESTE = corDoTema(theme.color.stoneSolid)
export const TINTA_APAGADA_DO_TESTE = corDoTema(theme.color.parchmentDim)

// ── Anel ────────────────────────────────────────────────────────────────

/**
 * Traço e vão do anel, em px de TELA: o mesmo ritmo em qualquer zoom, como a
 * parede de passagem (`drawWalls.ts`). Mais curtos que os 16 traços largos do
 * "Oculto no editor", que crescem com a ficha: de perto os dois não se parecem.
 */
export const ANEL_TRACO_SCREEN_PX = 4
export const ANEL_VAO_SCREEN_PX = 3
/** Espessura dos traços claros, em px de tela. */
export const ANEL_LARGURA_SCREEN_PX = 1.5
/**
 * Fio escuro e contínuo por baixo dos traços: no chão escuro some e só o
 * tracejado claro aparece; no chão claro é ele que desenha o anel. É a mesma
 * ideia da faixa escura da alça de canto (`CORNER_HANDLE_KEYLINE_COLOR`).
 */
export const ANEL_FIO_SCREEN_PX = 3.5
export const ANEL_FIO_ALPHA = 0.5
/** Ficha minúscula no zoom mais afastado ainda tem um anel que se lê como tracejado. */
const ANEL_MINIMO_DE_TRACOS = 8

// ── Ligação ─────────────────────────────────────────────────────────────

/**
 * Pontos, não traços: a ligação diz "andou daqui até ali" (rastro), e o
 * tracejado fino já quer dizer parede invisível no editor (`drawWalls.ts`).
 * No pergaminho apagado, um degrau abaixo do anel: é a última coisa que o olho
 * lê no fantasma. Tudo em px de tela.
 */
export const LIGACAO_PASSO_SCREEN_PX = 8
export const LIGACAO_PONTO_SCREEN_PX = 1.25
/**
 * Halo escuro de cada ponto, pelo mesmo motivo do fio do anel: no chão claro é
 * ele que aparece. Com o miolo meio-tom, o ponto se lê cheio nos dois chãos (miolo
 * claro sobre chão claro virava uma fileira de argolas).
 */
export const LIGACAO_HALO_SCREEN_PX = 2
export const LIGACAO_ALPHA = 0.95
export const LIGACAO_HALO_ALPHA = 0.3
/** Respiro entre a borda de cada disco e o primeiro ponto. */
export const LIGACAO_FOLGA_SCREEN_PX = 5

// ── Etiqueta ────────────────────────────────────────────────────────────

export const ETIQUETA_TEXTO = 'Teste'
/**
 * A pílula é desenhada em px de mundo e escala como o nome das fichas
 * (`screenLabel.ts`): nunca abaixo de 11 px de tela, some abaixo de 30% de
 * zoom e cresce com o zoom junto com os nomes em volta.
 */
export const ETIQUETA_FONTE_PX = 11
/** Meio-negrito, como o número do vão (`drawGuideLabels.ts`): a medida da fonte já vem em cache da montagem. */
export const ETIQUETA_PESO = '600'
/** O texto do selo da janela: pergaminho apagado, quieto ao lado do nome branco das fichas. */
export const ETIQUETA_COR_DO_TEXTO = TINTA_APAGADA_DO_TESTE
/** Altura da pílula: a linha de 11 px e 3 px de respiro em cima e embaixo. */
const ETIQUETA_ALTURA = 17
const ETIQUETA_RESPIRO_X = 7
/** Pedra quase opaca: a pílula se lê sobre chão claro, escuro e sobre a foto de outra ficha. */
const ETIQUETA_FUNDO_ALPHA = 0.9
/** A borda tracejada do selo da janela (`--lb-color-line-divider`: branco a 26%). */
const ETIQUETA_BORDA_COR = 0xffffff
const ETIQUETA_BORDA_ALPHA = 0.26
const ETIQUETA_BORDA_LARGURA = 1
const ETIQUETA_TRACO = 3
const ETIQUETA_VAO = 2
/** Passo com que a borda da pílula é amostrada ao longo das pontas redondas. */
const ETIQUETA_AMOSTRA = 0.75

/** Escala de câmera usável: zero, negativa ou não-finita vira 1. */
export function escalaUtil(cameraScale: number): number {
  return Number.isFinite(cameraScale) && cameraScale > 0 ? cameraScale : 1
}

// ── Onde ────────────────────────────────────────────────────────────────

/** O fantasma pronto para desenhar nesta cena. */
export interface FantasmaNaCena {
  /** A ficha de verdade: a cara do fantasma e, nesta cena, a ponta de onde a ligação sai. */
  ficha: Token
  /** Onde ela está no teste, na convenção de `Token.x/y`. */
  x: number
  y: number
  /**
   * A ficha de verdade ficou em OUTRA cena: o teste a levou por uma passagem
   * até esta. A cara vem de lá; ligação não há (a ponta não está aqui), e o
   * fantasma não sai de dentro de ficha nenhuma. Ausente = ela está nesta cena
   * — o campo só entra quando é verdade, como o `planKnownByAll` do mundo.
   */
  deOutraCena?: true
}

/**
 * A ficha de verdade do fantasma quando ela pode não estar na cena aberta: o
 * teste a levou por uma passagem para esta cena, e é de onde ela ficou que vem
 * a cara (o App a acha no mundo, `acharFichaDoFantasma`).
 */
export interface FichaDeOutraCena {
  /** A ficha de verdade, de qualquer cena do mundo; null = em nenhuma. */
  ficha: Token | null
  /**
   * A cena aberta INTEIRA, de todos os pisos (o `map` de `fantasmaNaCena` é só
   * o piso em edição): a ficha que está nesta cena, noutro piso, segue a regra
   * do piso — nada —, e não vira fantasma de outra cena.
   */
  cena: Pick<MapData, 'tokens'>
}

/**
 * O fantasma só existe na cena aberta igual à do teste. Com a ficha de verdade
 * à vista nela (piso em edição, camada Fichas mostrada), é dela que sai o
 * tamanho, a foto e a cor, e dela sai a ligação; no mesmo ponto dela não há o
 * que mostrar. Sem a ficha nesta cena — o teste a levou para cá por uma
 * passagem —, a cara vem de onde ela ficou (`deOutraCena`). Fora disso, nada.
 */
export function fantasmaNaCena(
  fantasma: FantasmaDeTeste | null,
  map: Pick<MapData, 'id' | 'tokens' | 'hiddenLayers'>,
  deOutraCena: FichaDeOutraCena | null = null,
): FantasmaNaCena | null {
  if (fantasma === null || fantasma.mapId !== map.id) return null
  if (!Number.isFinite(fantasma.x) || !Number.isFinite(fantasma.y)) return null
  const ficha = map.tokens.find((token) => token.id === fantasma.tokenId)
  if (ficha === undefined) return deOutraCena === null ? null : vindoDeOutraCena(fantasma, map, deOutraCena)
  if (!isLayerVisible(map.hiddenLayers, tokenLayer(ficha))) return null
  if (fantasma.x === ficha.x && fantasma.y === ficha.y) return null
  return { ficha, x: fantasma.x, y: fantasma.y }
}

/**
 * O fantasma com a cara da ficha que ficou em outra cena: só com ela fora da
 * cena aberta inteira e com a camada Fichas à vista aqui. O "mesmo ponto da
 * ficha" não vale — o ponto dela é de outra cena.
 */
function vindoDeOutraCena(
  fantasma: FantasmaDeTeste,
  map: Pick<MapData, 'hiddenLayers'>,
  { ficha, cena }: FichaDeOutraCena,
): FantasmaNaCena | null {
  if (ficha === null || ficha.id !== fantasma.tokenId) return null
  if (cena.tokens.some((token) => token.id === fantasma.tokenId)) return null
  if (!isLayerVisible(map.hiddenLayers, tokenLayer(ficha))) return null
  return { ficha, x: fantasma.x, y: fantasma.y, deOutraCena: true }
}

/** As cenas onde a ficha de verdade pode estar: a aberta e as de fundo (o `HostWorld` de net/hostSession.ts serve). */
export interface CenasDoMundo {
  open: { map: Pick<MapData, 'tokens'> }
  background: readonly { map: Pick<MapData, 'tokens'> }[]
}

/**
 * A ficha de verdade `tokenId`, em qualquer cena do mundo: a aberta primeiro,
 * depois as de fundo — a ordem em que o teste a acha (`camadaDeTeste.ts`).
 * É a cara do fantasma quando o teste a levou para outra cena. `null` = em
 * cena nenhuma.
 */
export function acharFichaDoFantasma(tokenId: string, mundo: CenasDoMundo): Token | null {
  for (const cena of [mundo.open, ...mundo.background]) {
    const ficha = cena.map.tokens.find((token) => token.id === tokenId)
    if (ficha !== undefined) return ficha
  }
  return null
}

/**
 * Raio do disco do fantasma: onde a ficha de verdade traça o contorno. O fio
 * do círculo genérico (`tokenCircleRadius`) e o meio da moldura da foto
 * (`TOKEN_FRAME_WIDTH` = 4) caem no mesmo raio; o anel do teste ocupa esse
 * traço e a foto ou a cor enchem até ele.
 */
export function raioDoFantasma(gridSize: number, size: number): number {
  return Math.max(1, tokenCircleRadius(gridSize, size))
}

// ── Anel ────────────────────────────────────────────────────────────────

/**
 * O anel do teste em volta do disco: fio escuro contínuo e, por cima, traços
 * claros distribuídos por igual (nenhum traço partido na emenda). Limpa sempre.
 * Devolve quantos traços desenhou.
 */
export function drawAnelDoTeste(graphics: Graphics, raio: number, cameraScale: number): number {
  graphics.clear()
  if (!(raio > 0) || !Number.isFinite(raio)) return 0
  const escala = escalaUtil(cameraScale)
  graphics.circle(0, 0, raio).stroke({ width: ANEL_FIO_SCREEN_PX / escala, color: TINTA_ESCURA_DO_TESTE, alpha: ANEL_FIO_ALPHA })

  const periodo = ANEL_TRACO_SCREEN_PX + ANEL_VAO_SCREEN_PX
  const tracos = Math.max(ANEL_MINIMO_DE_TRACOS, Math.round((2 * Math.PI * raio * escala) / periodo))
  const fatia = (2 * Math.PI) / tracos
  const arco = fatia * (ANEL_TRACO_SCREEN_PX / periodo)
  for (let i = 0; i < tracos; i++) {
    // Começa no alto: o primeiro traço fica centrado no topo, simétrico dos dois lados.
    const inicio = -Math.PI / 2 - arco / 2 + i * fatia
    graphics.moveTo(Math.cos(inicio) * raio, Math.sin(inicio) * raio).arc(0, 0, raio, inicio, inicio + arco)
  }
  graphics.stroke({ width: ANEL_LARGURA_SCREEN_PX / escala, color: TINTA_CLARA_DO_TESTE, cap: 'butt' })
  return tracos
}

// ── Ligação ─────────────────────────────────────────────────────────────

/** Uma ponta da ligação: centro do disco e o raio até a borda dele, em px de mundo. */
export interface PontaDaLigacao {
  x: number
  y: number
  raio: number
}

/**
 * Pontos da borda da ficha de verdade até a borda do fantasma, centrados no
 * vão entre os dois. Discos perto demais (casas vizinhas) não têm vão que caiba
 * dois pontos: nada é desenhado. Limpa sempre e devolve quantos pontos saíram.
 */
export function drawLigacaoDoTeste(graphics: Graphics, de: PontaDaLigacao, ate: PontaDaLigacao, cameraScale: number): number {
  graphics.clear()
  const dx = ate.x - de.x
  const dy = ate.y - de.y
  const distancia = Math.hypot(dx, dy)
  if (!(distancia > 0) || !Number.isFinite(distancia)) return 0
  const escala = escalaUtil(cameraScale)
  const folga = LIGACAO_FOLGA_SCREEN_PX / escala
  const passo = LIGACAO_PASSO_SCREEN_PX / escala
  const inicio = de.raio + folga
  const vao = distancia - ate.raio - folga - inicio
  if (vao < passo) return 0

  const pontos = Math.floor(vao / passo) + 1
  // O que sobra do vão vai metade para cada ponta: a fileira fica no meio.
  const primeiro = inicio + (vao - (pontos - 1) * passo) / 2
  const ux = dx / distancia
  const uy = dy / distancia
  const centros: { x: number; y: number }[] = []
  for (let i = 0; i < pontos; i++) {
    const s = primeiro + i * passo
    centros.push({ x: de.x + ux * s, y: de.y + uy * s })
  }
  for (const c of centros) graphics.circle(c.x, c.y, LIGACAO_HALO_SCREEN_PX / escala)
  graphics.fill({ color: TINTA_ESCURA_DO_TESTE, alpha: LIGACAO_HALO_ALPHA })
  for (const c of centros) graphics.circle(c.x, c.y, LIGACAO_PONTO_SCREEN_PX / escala)
  graphics.fill({ color: TINTA_APAGADA_DO_TESTE, alpha: LIGACAO_ALPHA })
  return pontos
}

// ── Etiqueta ────────────────────────────────────────────────────────────

export interface MedidaDaEtiqueta {
  largura: number
  altura: number
}

/**
 * Um ponto da borda da pílula, a `s` px do começo, andando no sentido do
 * relógio a partir da ponta esquerda da reta de cima. `meia` é a metade da
 * largura, `r` o raio das pontas e `topo` a altura da reta de cima.
 */
function pontoDaPilula(s: number, meia: number, r: number, topo: number): { x: number; y: number } {
  const reta = Math.max(0, 2 * meia - 2 * r)
  const curva = Math.PI * r
  const esquerda = -meia + r
  const direita = meia - r
  const meio = topo + r
  if (s < reta) return { x: esquerda + s, y: topo }
  s -= reta
  if (s < curva) {
    const angulo = -Math.PI / 2 + s / r
    return { x: direita + Math.cos(angulo) * r, y: meio + Math.sin(angulo) * r }
  }
  s -= curva
  if (s < reta) return { x: direita - s, y: topo + 2 * r }
  s -= reta
  const angulo = Math.PI / 2 + Math.min(s, curva) / r
  return { x: esquerda + Math.cos(angulo) * r, y: meio + Math.sin(angulo) * r }
}

/**
 * A pílula da etiqueta, com o topo em y = 0 e centrada em x = 0: pedra quase
 * opaca e a borda tracejada do selo da janela. `larguraDoTexto` em px de
 * mundo. Limpa sempre e devolve a medida, para quem põe o texto no meio dela.
 */
export function drawEtiquetaDoTeste(placa: Graphics, larguraDoTexto: number): MedidaDaEtiqueta {
  const largura = Math.max(ETIQUETA_ALTURA, larguraDoTexto + 2 * ETIQUETA_RESPIRO_X)
  const altura = ETIQUETA_ALTURA
  placa.clear()
  placa.roundRect(-largura / 2, 0, largura, altura, altura / 2).fill({ color: TINTA_ESCURA_DO_TESTE, alpha: ETIQUETA_FUNDO_ALPHA })

  // A borda corre por DENTRO da pílula: o traço inteiro cabe no fundo escuro.
  const recuo = ETIQUETA_BORDA_LARGURA / 2
  const meia = largura / 2 - recuo
  const r = altura / 2 - recuo
  const perimetro = 2 * Math.max(0, 2 * meia - 2 * r) + 2 * Math.PI * r
  const tracos = Math.max(1, Math.round(perimetro / (ETIQUETA_TRACO + ETIQUETA_VAO)))
  const periodo = perimetro / tracos
  const traco = periodo * (ETIQUETA_TRACO / (ETIQUETA_TRACO + ETIQUETA_VAO))
  for (let i = 0; i < tracos; i++) {
    const inicio = i * periodo
    const comeco = pontoDaPilula(inicio, meia, r, recuo)
    placa.moveTo(comeco.x, comeco.y)
    for (let s = inicio + ETIQUETA_AMOSTRA; s < inicio + traco; s += ETIQUETA_AMOSTRA) {
      const p = pontoDaPilula(s, meia, r, recuo)
      placa.lineTo(p.x, p.y)
    }
    const fim = pontoDaPilula(inicio + traco, meia, r, recuo)
    placa.lineTo(fim.x, fim.y)
  }
  placa.stroke({ width: ETIQUETA_BORDA_LARGURA, color: ETIQUETA_BORDA_COR, alpha: ETIQUETA_BORDA_ALPHA, cap: 'butt' })
  return { largura, altura }
}
