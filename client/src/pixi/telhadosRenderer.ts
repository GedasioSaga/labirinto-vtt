import { CanvasSource, Container, FillGradient, Graphics, Sprite, Texture, type Ticker } from 'pixi.js'
import type { Region, RegionPoint } from '../types/map'
import { AJUSTE_DO_CHAO_MOLHADO, type ClimaDosTelhados } from '../lib/chaoMolhado'
import { CURVAS } from '../cenario/revelacao/tempo'
import { BEIRAL_PX } from '../lib/telhado/aguas'
import { MODELO_PADRAO_DO_TETO, corDoTetoOuPadrao, type ModeloDoTeto } from '../lib/telhado/paletas'
import { comecarTelhado, pintarTelhado, type ExtrasDoTelhado, type ImagemDoTelhado, type PinturaDoTelhado } from '../texturas/telhado'
import { desenhadoLigado, meioTermoLigado } from '../lib/estiloDoMapa'
import { assinarDesenhado, pedirItemDoTelhado } from '../texturas/desenhado/carregador'
import { comecarTelhadoDesenhado, idDoTelhadoDoModelo, type DesenhoDoTelhado } from '../texturas/desenhado/telhado'
import { rampaGuardada } from '../texturas/desenhado/tingir'

/*
 * TELHADOS DESENHADOS (pedido de 19/10/2026, protótipo aprovado em
 * docs/design/telhado/). Um Sprite por Sala com teto, com a textura de
 * `pintarTelhado` (telha ou madeira, na cor da Sala) e a sombra no chão: a
 * mesma silhueta, escura, deslocada para baixo e à direita.
 *
 * Jogador (`player/PlayerView.tsx`): teto que SAI do pacote (a ficha entrou)
 * desbota em 300 ms subindo 6 px de tela e crescendo 3,5%; teto que VOLTA (a
 * ficha saiu) aparece pelo mesmo caminho, com a "foto da sala" por baixo
 * (`guardarFoto`) para não abrir névoa preta enquanto ele chega. Interromper é
 * retomar, como nas portas (`animadorDePortas.ts`): o caminho vira de onde
 * está. Movimento reduzido: só desbota. O relógio só roda enquanto anima.
 *
 * Editor (`pixi/PixiCanvas.tsx`): sem movimento, tudo na hora.
 *
 * CUSTO: pintar leva ~50 ms por milhão de pixels (madeira é o pior caso), e a
 * regra da casa é nenhuma tarefa de 200 ms ou mais. Então a textura tem no
 * máximo `MAXIMO_DE_PIXELS_DA_TEXTURA` (sala enorme fica com menos pixels por
 * px do mapa) e cada textura é pintada numa tarefa própria, uma por vez, fora
 * do quadro que pediu. Enquanto ela não fica pronta o telhado sai chapado, na
 * cor base. A mesma (pontos, modelo, cor) nunca é pintada duas vezes enquanto
 * está guardada.
 *
 * A PALHA (MT6) custa mais por pixel: a textura de 1 milhão de pixels levava
 * ~55 ms na CPU 1x e passava dos 200 ms na CPU 4x do jogador. Ela é pintada em
 * fatias de `FATIA_DA_PINTURA_MS` (uma tarefa por fatia, linha a linha, com os
 * mesmos bytes de pintar de uma vez: `comecarTelhado`). Telha e madeira
 * continuam numa tarefa só, como antes. Ardósia, metal e tabuinhas (12/11/2026)
 * custam ~2 vezes a telha por pixel na folha de contato: em fatias, como a palha.
 */

export const DURACAO_DO_TELHADO_MS = 300
/** O telhado sobe isto (px de TELA) enquanto some. */
export const SUBIDA_DO_TELHADO_PX = 6
/** E cresce isto, em volta do centro. */
export const CRESCIMENTO_DO_TELHADO = 0.035
export const ALFA_DA_SOMBRA_DO_TELHADO = 0.25
/** Sombra no chão, em px do mapa (a do protótipo); ela se afasta mais um tanto igual enquanto o telhado sobe. */
export const SOMBRA_DO_TELHADO_X = 6
export const SOMBRA_DO_TELHADO_Y = 8
const COR_DA_SOMBRA = 0x0a0c06
/** ~50 ms de pintura no pior caso medido (madeira, 1024 × 1024 a escala 1). */
export const MAXIMO_DE_PIXELS_DA_TEXTURA = 1024 * 1024
/** Tempo de pintura por tarefa na palha em fatias (a mesma fatia do relevo, `drawRelevo.ts`). */
export const FATIA_DA_PINTURA_MS = 8
/**
 * Pixels das texturas sem telhado nenhum usando que ficam guardadas (trocar de cor e voltar, ou sair de uma cena e
 * voltar, não repinta). Teto por PIXELS, não por quantidade (caça 12/11, O4): os 85 telhados do Reino de Goa somam
 * ~5,9 megapixels e voltavam a ser pintados a cada visita com o teto antigo de 12 texturas. 8 megapixels são no pior
 * caso ~32 MB na placa (~43 MB com mipmap).
 */
const PIXELS_GUARDADOS = 8 * 1024 * 1024
/** Freio só para as entradas sem imagem (polígono quebrado, ainda na fila): elas pesam 0 pixel e nunca passariam do teto acima. */
const ENTRADAS_SEM_USO_NO_MAXIMO = 512
/** Margem da imagem de `pintarTelhado` (beiral + 1 px). */
const MARGEM_DA_IMAGEM = BEIRAL_PX + 1

export interface TelhadoParaDesenhar {
  id: string
  points: readonly RegionPoint[]
  modelo: ModeloDoTeto
  /** `#rrggbb` já resolvido (`corDoTetoOuPadrao`). */
  cor: string
  /** Onde o telhado mora (no jogador: `roofs` ou `peekedRoofs`, que leva a máscara do espiar). */
  camada: Container
  /**
   * CHAMINÉ (`RoomMeta.chamine`, Meio-Termo): só `true`. Desenhada (MT10) só
   * com a chave de obra ligada (`extrasDoTelhado`); desligada, é ignorada e a
   * chave do cache é a de antes.
   */
  chamine?: true
}

/**
 * O telhado de uma Sala do jeito que o renderer recebe: o MESMO caminho no
 * editor (`pixi/PixiCanvas.tsx`) e no jogador (`player/PlayerView.tsx`), para
 * modelo, cor e chaminé nunca divergirem entre as duas telas. `camada` é o nó
 * onde ele mora (a camada do telhado no editor; `roofs`/`peekedRoofs` no jogador).
 */
export function telhadoParaDesenhar(regiao: Pick<Region, 'id' | 'points' | 'room'>, camada: Container): TelhadoParaDesenhar {
  const modelo = regiao.room?.modeloDoTeto ?? MODELO_PADRAO_DO_TETO
  const telhado: TelhadoParaDesenhar = { id: regiao.id, points: regiao.points, modelo, cor: corDoTetoOuPadrao(modelo, regiao.room?.corDoTeto), camada }
  if (regiao.room?.chamine === true) telhado.chamine = true
  return telhado
}

export interface MovimentoDosTelhados {
  ticker: Pick<Ticker, 'add' | 'remove'>
  /** `prefers-reduced-motion`, lido a cada quadro: a pessoa pode mudar com o app aberto. */
  reducedMotion: () => boolean
  /** Agora, em ms. Padrão `performance.now()`. */
  now?: () => number
  /** px de tela por px do mapa (a câmera): a subida é de tela. Padrão 1. */
  escalaDaTela?: () => number
}

/** A textura pronta e onde ela cai no mapa. */
export interface TexturaDoTelhado {
  texture: Texture
  origemX: number
  origemY: number
  /** Pixels da textura por px do mapa. */
  escala: number
}

export interface OpcoesDosTelhados {
  /** Sem isto (editor, testes de desenho) nada anima. */
  movimento?: MovimentoDosTelhados
  /** Pinta e sobe para a GPU. Padrão: `pintarTelhado` num canvas. `null` = telhado vazio (polígono quebrado). */
  gerarTextura?: (points: readonly RegionPoint[], modelo: ModeloDoTeto, cor: string, extras?: ExtrasDoTelhado) => TexturaDoTelhado | null
  /** Roda a pintura fora do quadro atual. Padrão: `setTimeout(…, 0)`, uma tarefa por textura (por fatia, na palha). */
  agendar?: (tarefa: () => void) => void
  /** Tempo de pintura por tarefa na palha. Padrão `FATIA_DA_PINTURA_MS`. */
  fatiaMs?: number
  /** O relógio da fatia, em ms. Padrão `performance.now()`. */
  agoraDaPintura?: () => number
  /** Sobe a imagem pintada para a GPU (sem `gerarTextura`). Padrão: um canvas 2D com mipmap. */
  subirTextura?: (imagem: ImagemDoTelhado) => TexturaDoTelhado | null
}

export interface TelhadosRenderer {
  /**
   * Quais destes ids vão APARECER animando no próximo `desenhar` (o teto que
   * fecha porque a ficha saiu). Quem chama tira a foto da sala ANTES de mexer
   * nas outras camadas e entrega em `guardarFoto`.
   */
  vaoAparecer: (ids: readonly string[], mapaId: string) => string[]
  /** A foto do interior, posta debaixo do telhado até ele terminar de aparecer (e então destruída). */
  guardarFoto: (id: string, foto: Container) => void
  /** Desenha os telhados. Trocar de `mapaId` limpa tudo na hora, sem animar. `grid` (px do mapa por casa, padrão 64) é a escala da arte do Desenhado. */
  desenhar: (telhados: readonly TelhadoParaDesenhar[], mapaId: string, grid?: number) => void
  /** Telhados em transição agora (para o e2e e os testes). */
  animando: () => number
  /**
   * Ids dos telhados com algo à vista (progresso > 0), INCLUSIVE o que está
   * sumindo: a porta de fora desenhada por cima (`lib/telhado/portasDeFora.ts`)
   * não pisca debaixo do telhado durante os 300 ms do fade.
   */
  idsVisiveis: () => ReadonlySet<string>
  /** Texturas pintadas desde a criação (para o teste do cache). */
  pintadas: () => number
  /**
   * A CHUVA BATE NO TELHADO (Ambiente, decisão do mestre de 12/11/2026): molha
   * (escurece e brilha um pouco) e junta neve, devagar, onde a chuva e a neve
   * caem (`lib/chaoMolhado.ts`). `null` = telhados secos.
   */
  setClima: (clima: ClimaDosTelhados | null) => void
  destruir: () => void
}

interface Caminho {
  de: number
  para: 0 | 1
  inicio: number
  duracao: number
}

interface Telhado {
  id: string
  chave: string
  points: readonly RegionPoint[]
  cor: string
  camada: Container
  raiz: Container
  /**
   * Sombra e corpo trocam de Graphics chapado para Sprite quando a textura fica pronta. A sombra com textura é
   * o embrulho do sprite (`sombraDa`): a posição dela é só o deslocamento, nos dois casos.
   */
  sombra: Container
  topo: Container
  corpo: Container
  foto: Container | null
  cx: number
  cy: number
  /** 1 = inteiro, 0 = sumiu. */
  progresso: number
  caminho: Caminho | null
  saindo: boolean
  /** O que cai neste telhado (contado pelos pontos dele) e as duas camadas do clima, por cima do corpo. */
  clima: ClimaDoTelhado | null
}

interface ClimaDoTelhado {
  de: ClimaDosTelhados['cobertura']
  pontos: readonly RegionPoint[]
  chuva: number
  neve: number
  /** A faixa de luz da telha molhada (em add). */
  brilho: Graphics | null
  /** A neve juntada (em normal). */
  manta: Graphics | null
}

let gradienteDoBrilho: FillGradient | null = null
let gradienteDaNeve: FillGradient | null = null

/** A faixa de luz na diagonal (a telha molhada pega o céu), no espaço da forma (0 a 1). */
function brilhoDoTelhado(): FillGradient {
  const { brilho } = AJUSTE_DO_CHAO_MOLHADO.telhado
  gradienteDoBrilho ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: 'rgba(214,228,255,0)' },
      { offset: 0.34, color: 'rgba(214,228,255,0)' },
      { offset: 0.46, color: `rgba(214,228,255,${brilho})` },
      { offset: 0.58, color: 'rgba(214,228,255,0)' },
      { offset: 0.72, color: `rgba(214,228,255,${brilho * 0.4})` },
      { offset: 0.8, color: 'rgba(214,228,255,0)' },
      { offset: 1, color: 'rgba(214,228,255,0)' },
    ],
  })
  return gradienteDoBrilho
}

/** A neve no telhado: mais clara no alto (o lado do sol), sem ser um branco chapado. */
function neveDoTelhado(): FillGradient {
  gradienteDaNeve ??= new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0.35, y: 1 },
    textureSpace: 'local',
    colorStops: [
      { offset: 0, color: 'rgba(246,248,252,0.95)' },
      { offset: 0.5, color: 'rgba(236,241,248,0.82)' },
      { offset: 1, color: 'rgba(222,229,240,0.7)' },
    ],
  })
  return gradienteDaNeve
}

/** A tinta da telha molhada no nível `molhado` (0 = sem tinta). */
function tintaMolhada(molhado: number): number {
  const [r, g, b] = AJUSTE_DO_CHAO_MOLHADO.telhado.tintaMolhada
  const canal = (alvo: number) => Math.round(255 * (1 - (1 - alvo) * Math.min(1, Math.max(0, molhado))))
  return (canal(r) << 16) | (canal(g) << 8) | canal(b)
}

interface Entrada {
  /** `undefined` = na fila; `null` = vazia (nada a desenhar além do chapado). */
  textura: TexturaDoTelhado | null | undefined
  usos: number
  /** Pixels da textura na placa (0 sem textura): é o que conta no teto das guardadas. */
  pixels: number
}

function pixelsDaTextura(textura: TexturaDoTelhado | null): number {
  if (textura === null) return 0
  const { pixelWidth, pixelHeight } = textura.texture.source
  const pixels = pixelWidth * pixelHeight
  return Number.isFinite(pixels) && pixels > 0 ? pixels : 0
}

/** Pixels por px do mapa para a sala caber em `MAXIMO_DE_PIXELS_DA_TEXTURA`. */
export function escalaDaTexturaDoTelhado(points: readonly RegionPoint[]): number {
  const caixa = caixaDe(points)
  if (caixa === null) return 1
  const area = (caixa.maxX - caixa.minX + 2 * MARGEM_DA_IMAGEM) * (caixa.maxY - caixa.minY + 2 * MARGEM_DA_IMAGEM)
  return area <= MAXIMO_DE_PIXELS_DA_TEXTURA ? 1 : Math.sqrt(MAXIMO_DE_PIXELS_DA_TEXTURA / area)
}

function caixaDe(points: readonly RegionPoint[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return minX <= maxX && minY <= maxY ? { minX, minY, maxX, maxY } : null
}

/** O telhado Desenhado pronto para pintar: os itens do pacote, a rampa da cor e a grade do mapa. */
interface PedidoDesenhado {
  readonly desenho: DesenhoDoTelhado
  readonly rampa: Uint8Array
  readonly grid: number
}

/** O que pintar para uma chave na fila: o telhado e os extras do Meio-Termo (ausente = nenhum), ou o Desenhado. */
type PedidoDeTelhado = Pick<TelhadoParaDesenhar, 'points' | 'modelo' | 'cor'> & { extras?: ExtrasDoTelhado; desenhado?: PedidoDesenhado }

/** Px do mapa por casa quando quem desenha não diz (a grade do Desenhado). */
const GRADE_PADRAO = 64

/**
 * DESENHADO (F2a, CONTRATO.md seção 8): o telhado do pacote para este modelo,
 * a faixa das emendas (a do telhado ou a avulsa, `faixa.de`) e a chaminé quando
 * a sala pede. Pede todos de uma vez ao carregador; enquanto falta algum (ou
 * um falhou), `undefined`: o telhado sai no Atual, e repinta quando chega.
 */
function desenhadoDoTelhado(t: Pick<TelhadoParaDesenhar, 'modelo' | 'chamine'>, cor: string, mapaId: string, grid: number): PedidoDesenhado | undefined {
  if (!desenhadoLigado()) return undefined
  // Modelo sem arte no pacote (ardósia, metal, tabuinhas): o desenho por código, sempre.
  const id = idDoTelhadoDoModelo(t.modelo)
  if (id === null) return undefined
  const telhado = pedirItemDoTelhado(id, mapaId)
  const objeto = t.chamine === true ? pedirItemDoTelhado('chamine', mapaId) : null
  if (telhado === null || telhado.tipo !== 'telhado') return undefined
  let faixa = telhado.faixa
  if (telhado.faixaDe !== null) {
    const avulsa = pedirItemDoTelhado(telhado.faixaDe, mapaId)
    if (avulsa === null || avulsa.tipo !== 'faixa') return undefined
    faixa = avulsa.faixa
  }
  if (t.chamine === true && (objeto === null || objeto.tipo !== 'objeto')) return undefined
  const rampa = rampaGuardada(cor, telhado.tingir)
  if (rampa === null) return undefined
  return { desenho: { telhado, faixa, objeto: objeto !== null && objeto.tipo === 'objeto' ? objeto : null }, rampa, grid }
}

/**
 * Os extras do Meio-Termo (MT10) para este telhado, lendo a chave de obra:
 * com ela DESLIGADA, `undefined` (o telhado e a chave do cache são os de
 * antes, com ou sem chaminé). Ligada: a chaminé quando a Sala pede e a
 * cumeeira amarrada em toda palha.
 */
function extrasDoTelhado(t: Pick<TelhadoParaDesenhar, 'modelo' | 'chamine'>): ExtrasDoTelhado | undefined {
  if (!meioTermoLigado()) return undefined
  const chamine = t.chamine === true
  const cumeeiraAmarrada = t.modelo === 'palha'
  return chamine || cumeeiraAmarrada ? { chamine, cumeeiraAmarrada } : undefined
}

function chaveDe(t: PedidoDeTelhado): string {
  const base = `${t.modelo}|${t.cor}|${t.points.map((p) => `${p.x},${p.y}`).join(';')}`
  if (t.desenhado !== undefined) return `${base}|desenhado|${t.desenhado.grid}|${t.desenhado.desenho.objeto === null ? '' : 'chamine'}`
  if (t.extras === undefined) return base
  return `${base}|${t.extras.chamine === true ? 'chamine' : ''}|${t.extras.cumeeiraAmarrada === true ? 'amarrada' : ''}`
}

/** `pintarTelhado` num canvas 2D, como as texturas do chão (`drawTexturas.ts`): mipmap para o zoom longe não serrilhar a fresta. */
export function gerarTexturaDoTelhado(points: readonly RegionPoint[], modelo: ModeloDoTeto, cor: string, extras?: ExtrasDoTelhado): TexturaDoTelhado | null {
  // O 2D antes da pintura: sem ele (jsdom) não adianta pintar.
  const tela = document.createElement('canvas')
  const g = typeof ImageData === 'undefined' ? null : tela.getContext('2d')
  if (g === null) return null
  return texturaNoCanvas(tela, g, pintarTelhado(points, modelo, cor, escalaDaTexturaDoTelhado(points), extras))
}

/** Um canvas 2D para subir a imagem, ou `null` sem 2D (o jsdom dos testes): aí nem adianta pintar. */
function canvas2D(): { tela: HTMLCanvasElement; g: CanvasRenderingContext2D } | null {
  const tela = document.createElement('canvas')
  const g = typeof ImageData === 'undefined' ? null : tela.getContext('2d')
  return g === null ? null : { tela, g }
}

/** A imagem pintada no canvas e numa textura com mipmap. Imagem vazia: `null`. */
function texturaNoCanvas(tela: HTMLCanvasElement, g: CanvasRenderingContext2D, imagem: ImagemDoTelhado): TexturaDoTelhado | null {
  if (imagem.largura === 0 || imagem.altura === 0) return null
  tela.width = imagem.largura
  tela.height = imagem.altura
  g.putImageData(new ImageData(new Uint8ClampedArray(imagem.pixels), imagem.largura, imagem.altura), 0, 0)
  const texture = new Texture({ source: new CanvasSource({ resource: tela, autoGenerateMipmaps: true, scaleMode: 'linear' }) })
  return { texture, origemX: imagem.origemX, origemY: imagem.origemY, escala: imagem.escala }
}

/** Imagem vazia (polígono quebrado) não sobe: o telhado fica no chapado. */
function subirSeTiver(subir: (imagem: ImagemDoTelhado) => TexturaDoTelhado | null, imagem: ImagemDoTelhado): TexturaDoTelhado | null {
  return imagem.largura === 0 || imagem.altura === 0 ? null : subir(imagem)
}

/** Pinta linha a linha até a fatia de `fatiaMs` acabar. Devolve `true` quando a imagem ficou pronta. */
export function pintarUmaFatia(pintura: PinturaDoTelhado, fatiaMs: number, agora: () => number): boolean {
  const inicio = agora()
  for (;;) {
    if (pintura.pintarLinhas(1)) return true
    if (agora() - inicio >= fatiaMs) return false
  }
}

function corNumerica(hex: string): number {
  return Number.parseInt(hex.slice(1), 16)
}

function semEvento<T extends Container>(c: T): T {
  c.eventMode = 'none'
  c.interactiveChildren = false
  return c
}

/** O telhado chapado (sem textura ainda): o polígono na cor base. */
function chapado(points: readonly RegionPoint[], cor: number): Graphics {
  const g = semEvento(new Graphics())
  g.poly(points.map((p) => ({ x: p.x, y: p.y })), true).fill({ color: cor, alpha: 1 })
  return g
}

function spriteDa(textura: TexturaDoTelhado): Sprite {
  const sprite = semEvento(new Sprite(textura.texture))
  sprite.position.set(textura.origemX, textura.origemY)
  sprite.scale.set(1 / textura.escala)
  return sprite
}

/**
 * A sombra com textura: o sprite (na origem da imagem, com a tinta escura) dentro de um embrulho. `aplicar`
 * move o EMBRULHO pelo deslocamento da sombra; mover o sprite apagava a origem e mandava a sombra de todo
 * telhado para o canto do mapa (print 17 do mestre, achados N2 e V1 de 12/11/2026).
 */
function sombraDa(textura: TexturaDoTelhado): Container {
  const sprite = spriteDa(textura)
  sprite.tint = COR_DA_SOMBRA
  const embrulho = semEvento(new Container())
  embrulho.addChild(sprite)
  return embrulho
}

export function createTelhadosRenderer(opcoes: OpcoesDosTelhados = {}): TelhadosRenderer {
  const { movimento } = opcoes
  const gerar = opcoes.gerarTextura ?? gerarTexturaDoTelhado
  /** Sem `gerarTextura` injetado, telha e madeira saem numa tarefa e a palha em fatias. */
  const pintarDeVerdade = opcoes.gerarTextura === undefined
  const fatiaMs = opcoes.fatiaMs ?? FATIA_DA_PINTURA_MS
  const agoraDaPintura = opcoes.agoraDaPintura ?? (() => performance.now())
  const agendar = opcoes.agendar ?? ((tarefa: () => void) => void setTimeout(tarefa, 0))
  const relogio = movimento?.now ?? (() => performance.now())
  const telhados = new Map<string, Telhado>()
  /** Ids já desenhados neste mapa: só quem já esteve na tela aparece animando (o mapa abrindo não anima). */
  const conhecidos = new Set<string>()
  const fotos = new Map<string, Container>()
  const cache = new Map<string, Entrada>()
  /** O que pintar para cada chave na fila. */
  const pedidos = new Map<string, PedidoDeTelhado>()
  /** Texturas sem uso, da mais velha para a mais nova. */
  const semUso = new Set<string>()
  /** Soma dos `pixels` das entradas em `semUso`. */
  let pixelsSemUso = 0
  const fila: string[] = []
  /** A palha que está sendo pintada em fatias (a chave volta para a frente da fila entre uma fatia e outra). */
  let emFatias: { chave: string; pintura: PinturaDoTelhado; subir: (imagem: ImagemDoTelhado) => TexturaDoTelhado | null } | null = null
  let agendado = false
  let mapaAtual: string | null = null
  let ligado = false
  let destruido = false
  let pintadas = 0
  /** O clima de agora (`setClima`): cada telhado novo já nasce molhado ou com neve. */
  let clima: ClimaDosTelhados | null = null
  /** O último `desenhar`: quando um item do Desenhado chega, os telhados que estavam no Atual pintam de novo. */
  let ultimoDesenho: { lista: readonly TelhadoParaDesenhar[]; mapaId: string; grid: number } | null = null
  const pararDeOuvirDesenhado = assinarDesenhado(() => {
    if (destruido || ultimoDesenho === null || !desenhadoLigado()) return
    const { lista, mapaId, grid } = ultimoDesenho
    // A camada de um telhado pode ter saído da pilha desde então: esse fica para o próximo `desenhar` de quem chama.
    desenhar(
      lista.filter((t) => !t.camada.destroyed),
      mapaId,
      grid,
    )
  })

  // ---------- texturas ----------

  function pegarTextura(t: PedidoDeTelhado, chave: string): Entrada {
    let entrada = cache.get(chave)
    if (entrada === undefined) {
      entrada = { textura: undefined, usos: 0, pixels: 0 }
      cache.set(chave, entrada)
      fila.push(chave)
      const pedido: PedidoDeTelhado = { points: t.points, modelo: t.modelo, cor: t.cor }
      if (t.extras !== undefined) pedido.extras = t.extras
      if (t.desenhado !== undefined) pedido.desenhado = t.desenhado
      pedidos.set(chave, pedido)
      agendarPintura()
    }
    entrada.usos += 1
    tirarDeSemUso(chave, entrada)
    return entrada
  }

  function tirarDeSemUso(chave: string, entrada: Entrada | undefined): void {
    if (!semUso.delete(chave)) return
    pixelsSemUso = Math.max(0, pixelsSemUso - (entrada?.pixels ?? 0))
  }

  function largarTextura(chave: string): void {
    const entrada = cache.get(chave)
    if (entrada === undefined) return
    entrada.usos = Math.max(0, entrada.usos - 1)
    if (entrada.usos > 0 || semUso.has(chave)) return
    semUso.add(chave)
    pixelsSemUso += entrada.pixels
    while (pixelsSemUso > PIXELS_GUARDADOS || semUso.size > ENTRADAS_SEM_USO_NO_MAXIMO) {
      const velha = semUso.values().next().value
      if (velha === undefined) break
      esquecerTextura(velha)
    }
  }

  function esquecerTextura(chave: string): void {
    const entrada = cache.get(chave)
    tirarDeSemUso(chave, entrada)
    cache.delete(chave)
    pedidos.delete(chave)
    if (emFatias?.chave === chave) emFatias = null
    if (entrada?.textura) entrada.textura.texture.destroy(true)
  }

  function agendarPintura(): void {
    if (agendado || destruido || fila.length === 0) return
    agendado = true
    agendar(pintarUma)
  }

  /** Uma textura por tarefa: muitas salas de teto não somam no mesmo quadro. */
  function pintarUma(): void {
    agendado = false
    if (destruido) return
    let chave = fila.shift()
    // Pedido que ninguém usa mais (a cor mudou de novo antes da vez dele): pula sem pintar.
    while (chave !== undefined && (cache.get(chave)?.usos ?? 0) === 0) {
      esquecerTextura(chave)
      chave = fila.shift()
    }
    if (chave !== undefined) {
      const entrada = cache.get(chave)
      const pedido = pedidos.get(chave)
      if (entrada !== undefined && pedido !== undefined && entrada.textura === undefined) {
        const textura = pintarDeVerdade ? pintarDoPedido(chave, pedido) : gerar(pedido.points, pedido.modelo, pedido.cor, pedido.extras)
        if (textura === undefined) {
          // Falta pintar: a mesma palha continua na próxima tarefa, antes das outras.
          fila.unshift(chave)
          agendarPintura()
          return
        }
        entrada.textura = textura
        // A entrada está em uso aqui (a sem uso foi pulada acima): os pixels só contam quando ela for largada.
        entrada.pixels = pixelsDaTextura(textura)
        pintadas += 1
        pedidos.delete(chave)
        for (const t of telhados.values()) if (t.chave === chave) vestir(t, entrada.textura)
      }
    }
    agendarPintura()
  }

  /** Telha e madeira de uma vez (o caminho de antes); os outros uma fatia por chamada (`undefined` = ainda falta). */
  function pintarDoPedido(chave: string, pedido: PedidoDeTelhado): TexturaDoTelhado | null | undefined {
    // O Desenhado lê a arte por pixel (2 bases, 2 ruídos, a faixa): sempre em fatias, como a palha.
    if ((pedido.modelo === 'telhas' || pedido.modelo === 'madeira') && pedido.desenhado === undefined) {
      const subir = opcoes.subirTextura
      if (subir === undefined) return gerarTexturaDoTelhado(pedido.points, pedido.modelo, pedido.cor, pedido.extras)
      return subirSeTiver(subir, pintarTelhado(pedido.points, pedido.modelo, pedido.cor, escalaDaTexturaDoTelhado(pedido.points), pedido.extras))
    }
    if (emFatias === null || emFatias.chave !== chave) {
      let subir = opcoes.subirTextura
      if (subir === undefined) {
        const canvas = canvas2D()
        if (canvas === null) return null
        subir = (imagem) => texturaNoCanvas(canvas.tela, canvas.g, imagem)
      }
      const escala = escalaDaTexturaDoTelhado(pedido.points)
      const { desenhado } = pedido
      const pintura =
        desenhado === undefined
          ? comecarTelhado(pedido.points, pedido.modelo, pedido.cor, escala, pedido.extras)
          : comecarTelhadoDesenhado(pedido.points, desenhado.desenho, desenhado.rampa, escala, desenhado.grid)
      emFatias = { chave, pintura, subir }
    }
    if (!pintarUmaFatia(emFatias.pintura, fatiaMs, agoraDaPintura)) return undefined
    const { pintura, subir } = emFatias
    emFatias = null
    return subirSeTiver(subir, pintura.imagem)
  }

  /** Troca o chapado pela textura (ou fica no chapado, se a pintura deu vazio). */
  function vestir(t: Telhado, textura: TexturaDoTelhado | null | undefined): void {
    const corpo = textura ? spriteDa(textura) : chapado(t.points, corNumerica(t.cor))
    // O chapado é desenhado em coordenadas do mundo; o sprite vai embrulhado (`sombraDa`): os dois andam só o deslocamento.
    const sombra = textura ? sombraDa(textura) : chapado(t.points, COR_DA_SOMBRA)
    // O clima sai junto (os pontos podem ter mudado) e volta por cima do corpo novo.
    tirarClima(t)
    t.topo.removeChild(t.corpo)
    t.corpo.destroy({ children: true })
    t.topo.addChild(corpo)
    t.corpo = corpo
    t.raiz.removeChild(t.sombra)
    t.sombra.destroy({ children: true })
    t.raiz.addChildAt(sombra, t.foto === null ? 0 : 1)
    t.sombra = sombra
    vestirClima(t)
    aplicar(t)
  }

  // ---------- o clima (a chuva bate no telhado) ----------

  function tirarClima(t: Telhado): void {
    const c = t.clima
    if (c === null) return
    for (const g of [c.brilho, c.manta]) if (g !== null) g.destroy()
    t.clima = null
    t.corpo.tint = 0xffffff
  }

  /** Uma camada do clima sobre o corpo, na forma da sala: andam juntas na subida e no desbotar do telhado. */
  function camadaDoClima(t: Telhado, preenchimento: FillGradient, modo: 'add' | 'normal'): Graphics {
    const g = semEvento(new Graphics())
    g.poly(
      t.points.map((p) => ({ x: p.x, y: p.y })),
      true,
    ).fill(preenchimento)
    g.blendMode = modo
    t.topo.addChild(g)
    return g
  }

  /**
   * Molha e cobre de neve um telhado no nível de agora. O que cai nele é
   * contado uma vez por `cobertura` (o meio do telhado); o nível de cada
   * quadro só muda a tinta e a transparência das duas camadas.
   */
  function vestirClima(t: Telhado): void {
    const c = clima
    if (c === null || t.points.length < 3) {
      tirarClima(t)
      return
    }
    let cobre = t.clima
    if (cobre === null || cobre.de !== c.cobertura || cobre.pontos !== t.points) {
      const cai = c.cobertura(t.points)
      cobre = { de: c.cobertura, pontos: t.points, chuva: cai.chuva, neve: cai.neve, brilho: cobre?.brilho ?? null, manta: cobre?.manta ?? null }
      t.clima = cobre
    }
    const molhado = cobre.chuva * c.niveis.molhado
    const neve = cobre.neve * c.niveis.neve
    t.corpo.tint = molhado > 0 ? tintaMolhada(molhado) : 0xffffff
    if (molhado > 0 && cobre.brilho === null) cobre.brilho = camadaDoClima(t, brilhoDoTelhado(), 'add')
    if (cobre.brilho !== null) {
      cobre.brilho.visible = molhado > 0
      cobre.brilho.alpha = molhado
    }
    if (neve > 0 && cobre.manta === null) cobre.manta = camadaDoClima(t, neveDoTelhado(), 'normal')
    if (cobre.manta !== null) {
      cobre.manta.visible = neve > 0
      cobre.manta.alpha = neve * AJUSTE_DO_CHAO_MOLHADO.telhado.neve
    }
  }

  function setClima(novo: ClimaDosTelhados | null): void {
    if (destruido) return
    clima = novo
    for (const t of telhados.values()) if (!t.raiz.destroyed) vestirClima(t)
  }

  // ---------- telhados ----------

  function criar(t: TelhadoParaDesenhar & PedidoDeTelhado, chave: string, progresso: number): Telhado {
    const caixa = caixaDe(t.points)
    const cx = caixa === null ? 0 : (caixa.minX + caixa.maxX) / 2
    const cy = caixa === null ? 0 : (caixa.minY + caixa.maxY) / 2
    const raiz = semEvento(new Container())
    raiz.label = `telhado:${t.id}`
    const topo = semEvento(new Container())
    topo.pivot.set(cx, cy)
    const placeholderCorpo = new Container()
    const placeholderSombra = new Container()
    topo.addChild(placeholderCorpo)
    raiz.addChild(placeholderSombra, topo)
    t.camada.addChild(raiz)
    const novo: Telhado = {
      id: t.id,
      chave,
      points: t.points,
      cor: t.cor,
      camada: t.camada,
      raiz,
      sombra: placeholderSombra,
      topo,
      corpo: placeholderCorpo,
      foto: null,
      cx,
      cy,
      progresso,
      caminho: null,
      saindo: false,
      clima: null,
    }
    vestir(novo, pegarTextura(t, chave).textura)
    return novo
  }

  function destruirTelhado(t: Telhado): void {
    telhados.delete(t.id)
    largarTextura(t.chave)
    tirarFoto(t)
    t.raiz.parent?.removeChild(t.raiz)
    t.raiz.destroy({ children: true })
  }

  function tirarFoto(t: Telhado): void {
    if (t.foto === null) return
    t.raiz.removeChild(t.foto)
    t.foto.destroy({ children: true, texture: true, textureSource: true })
    t.foto = null
  }

  /** Posição, escala e transparência no `progresso` de agora. */
  function aplicar(t: Telhado): void {
    const p = t.progresso
    const reduzido = movimento?.reducedMotion() ?? true
    const subida = reduzido ? 0 : 1 - p
    const escalaDaTela = movimento?.escalaDaTela?.() ?? 1
    const porTela = escalaDaTela > 0 && Number.isFinite(escalaDaTela) ? 1 / escalaDaTela : 1
    t.topo.position.set(t.cx, t.cy - SUBIDA_DO_TELHADO_PX * porTela * subida)
    t.topo.scale.set(1 + CRESCIMENTO_DO_TELHADO * subida)
    t.topo.alpha = p
    t.sombra.position.set(SOMBRA_DO_TELHADO_X * (1 + subida), SOMBRA_DO_TELHADO_Y * (1 + subida))
    t.sombra.alpha = p * ALFA_DA_SOMBRA_DO_TELHADO
    t.raiz.visible = p > 0 || t.foto !== null
  }

  function iniciarCaminho(t: Telhado, para: 0 | 1, agora: number): void {
    t.caminho = { de: t.progresso, para, inicio: agora, duracao: DURACAO_DO_TELHADO_MS * Math.abs(para - t.progresso) }
    ligarRelogio()
  }

  /** Avança um telhado até `agora`; devolve `false` quando ele terminou de sumir (e foi destruído). */
  function andar(t: Telhado, agora: number): boolean {
    const c = t.caminho
    if (c === null) return true
    const k = c.duracao <= 0 ? 1 : Math.min(1, Math.max(0, (agora - c.inicio) / c.duracao))
    t.progresso = c.de + (c.para - c.de) * CURVAS.saida.f(k)
    if (k >= 1) {
      t.progresso = c.para
      t.caminho = null
      if (c.para === 0 && t.saindo) {
        destruirTelhado(t)
        return false
      }
      tirarFoto(t)
    }
    aplicar(t)
    return true
  }

  function quadro(): void {
    const agora = relogio()
    let algum = false
    for (const t of [...telhados.values()]) {
      if (t.raiz.destroyed) {
        telhados.delete(t.id)
        continue
      }
      if (andar(t, agora) && t.caminho !== null) algum = true
    }
    if (!algum) desligarRelogio()
  }

  function ligarRelogio(): void {
    if (ligado || movimento === undefined) return
    ligado = true
    movimento.ticker.add(quadro)
  }

  function desligarRelogio(): void {
    if (!ligado || movimento === undefined) return
    ligado = false
    movimento.ticker.remove(quadro)
  }

  function limpar(): void {
    for (const t of [...telhados.values()]) destruirTelhado(t)
    for (const foto of fotos.values()) foto.destroy({ children: true, texture: true, textureSource: true })
    fotos.clear()
    conhecidos.clear()
    desligarRelogio()
  }

  function vaoAparecer(ids: readonly string[], mapaId: string): string[] {
    if (movimento === undefined || mapaId !== mapaAtual) return []
    return ids.filter((id) => {
      const t = telhados.get(id)
      return t === undefined ? conhecidos.has(id) : t.saindo
    })
  }

  function guardarFoto(id: string, foto: Container): void {
    fotos.get(id)?.destroy({ children: true, texture: true, textureSource: true })
    fotos.set(id, semEvento(foto))
  }

  function desenhar(lista: readonly TelhadoParaDesenhar[], mapaId: string, grid: number = GRADE_PADRAO): void {
    if (destruido) return
    if (mapaId !== mapaAtual) {
      limpar()
      mapaAtual = mapaId
    }
    ultimoDesenho = { lista, mapaId, grid }
    const agora = relogio()
    const anima = movimento !== undefined
    const presentes = new Set<string>()
    for (const item of lista) {
      const cor = corDoTetoOuPadrao(item.modelo, item.cor)
      // Desenhado pronto: a chaminé é o objeto e a cumeeira é a faixa do pacote (sem os extras do Meio-Termo).
      const desenhado = desenhadoDoTelhado(item, cor, mapaId, grid)
      const extras = desenhado === undefined ? extrasDoTelhado(item) : undefined
      const pedido: TelhadoParaDesenhar & PedidoDeTelhado = { ...item, cor }
      if (extras !== undefined) pedido.extras = extras
      if (desenhado !== undefined) pedido.desenhado = desenhado
      const chave = chaveDe(pedido)
      presentes.add(item.id)
      let t = telhados.get(item.id)
      if (t === undefined) {
        const entra = anima && conhecidos.has(item.id)
        t = criar(pedido, chave, entra ? 0 : 1)
        telhados.set(item.id, t)
        if (entra) iniciarCaminho(t, 1, agora)
      } else {
        if (t.camada !== item.camada) {
          item.camada.addChild(t.raiz)
          t.camada = item.camada
        }
        if (t.chave !== chave) {
          const antiga = t.chave
          t.chave = chave
          t.points = item.points
          t.cor = cor
          const caixa = caixaDe(item.points)
          t.cx = caixa === null ? 0 : (caixa.minX + caixa.maxX) / 2
          t.cy = caixa === null ? 0 : (caixa.minY + caixa.maxY) / 2
          t.topo.pivot.set(t.cx, t.cy)
          vestir(t, pegarTextura(pedido, chave).textura)
          largarTextura(antiga)
        }
        if (t.saindo) {
          // Entrou e saiu na hora: o caminho vira de onde está, sem pular.
          t.saindo = false
          iniciarCaminho(t, 1, agora)
        }
      }
      conhecidos.add(item.id)
      const foto = fotos.get(item.id)
      if (foto !== undefined) {
        fotos.delete(item.id)
        if (t.caminho !== null && t.caminho.para === 1) {
          tirarFoto(t)
          t.foto = foto
          t.raiz.addChildAt(foto, 0)
        } else {
          foto.destroy({ children: true, texture: true, textureSource: true })
        }
      }
      aplicar(t)
    }
    for (const t of [...telhados.values()]) {
      if (presentes.has(t.id) || t.saindo) continue
      if (anima && t.progresso > 0) {
        t.saindo = true
        tirarFoto(t)
        iniciarCaminho(t, 0, agora)
      } else {
        destruirTelhado(t)
      }
    }
    for (const foto of fotos.values()) foto.destroy({ children: true, texture: true, textureSource: true })
    fotos.clear()
  }

  return {
    vaoAparecer,
    guardarFoto,
    desenhar,
    animando: () => [...telhados.values()].filter((t) => t.caminho !== null).length,
    idsVisiveis: () => new Set([...telhados.values()].filter((t) => t.progresso > 0 && !t.raiz.destroyed).map((t) => t.id)),
    pintadas: () => pintadas,
    setClima,
    destruir: () => {
      pararDeOuvirDesenhado()
      ultimoDesenho = null
      limpar()
      destruido = true
      fila.length = 0
      emFatias = null
      for (const chave of [...cache.keys()]) esquecerTextura(chave)
    },
  }
}
