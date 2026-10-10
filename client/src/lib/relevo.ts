import type { Drawing, MapData, Region, RegionPoint, TracoDePenhasco } from '../types/map'
import type { Exploration } from './exploration'
import { assinaturaDosPenhascos, temRiscoDePenhasco } from './penhasco'
import { isContinente } from './marcadorDeContinente'
import { readRegionSplit, splitSecondPart } from './regionSplit'
import { parseHexColor } from './tokenColor'

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
 *
 * FATIA 1b — DIVISAS PINTADAS: no continente de verdade os biomas não são
 * regiões, são DESENHOS preenchidos (Polígono, balde, Retângulo, Elipse,
 * Círculo) por cima da terra. A borda de um desenho desses também escurece,
 * mas só onde ela separa duas cores que se veem diferentes, com terra dos dois
 * lados (`divisasPintadas`). Desenho nenhum vira terra: a terra continua sendo
 * só a união das regiões, então desenho sobre o mar não ganha sombra no mar,
 * luz nem friso, e rabisco (traço aberto, Pincel, Linha, Curva, Caminho) não
 * conta para nada.
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

/**
 * Quando a borda de um desenho preenchido vira DIVISA (fatia 1b). A sombra é a
 * mesma da fronteira entre regiões (`AJUSTE_DO_RELEVO.oclusao`): o que muda é
 * só quem conta.
 */
export const AJUSTE_DAS_DIVISAS = {
  /**
   * Opacidade mínima do fundo para a BORDA do desenho virar divisa. Abaixo
   * disso é tinta de anotação (o chão de baixo ainda aparece através dela): a
   * cor dela conta para o que a tela mostra, a borda não escurece. 0,5 é o
   * padrão da ferramenta, então a forma desenhada sem mexer em nada conta.
   */
  alfaMinimo: 0.5,
  /**
   * Diferença mínima de cor, em distância RGB (0 a 441), entre os dois lados da
   * borda. Dois tons quase iguais (os marrons de uma montanha, um desenho
   * repetido por cima de si mesmo) não são divisa: escurecer ali desenharia um
   * contorno que o mapa não tem.
   */
  diferencaDeCor: 14,
  /**
   * Espessura mínima do desenho (2 × área ÷ perímetro), em px do protótipo. A
   * faixa da sombra tem 6 px e borra 14: num desenho mais fino que isto ela
   * cobriria a forma inteira e viraria um borrão escuro (ou uma listra, num
   * traço fechado e fino). Na escala do protótipo, 4 px é um pontinho.
   */
  espessuraMinima: 4,
  /**
   * Tamanho mínimo do desenho (o lado maior da caixa dele), em px do protótipo.
   * Menor que isto é DETALHE (o ícone de montanha em dois tons, o oásis, uma
   * pedra), não bioma: a sombra da divisa alcança ~24 px de cada lado (faixa de
   * 6 px borrada 14) e cobriria a forma inteira, borrando o desenho. No mapa
   * real os cones têm 38 a 55 px e o menor bioma 115; a cratera (anel de 83 px)
   * continua bioma. O detalhe ainda PINTA (a cor dele conta para o vizinho), só
   * a borda dele não escurece.
   */
  tamanhoMinimo: 64,
  /**
   * Borda de desenho a menos disto do mar (px do protótipo, olhando para os
   * dois lados) é COSTA, não divisa: a costa já tem friso e sombra próprios.
   * No mapa real o balde não entra nos cantos estreitos da costa, e o pedaço
   * de borda que sobra ali, curto e rente ao mar, borrava numa bolha escura.
   */
  longeDoMar: 4,
} as const

/**
 * A PAREDE DO PENHASCO (fatia 3, `lib/penhasco.ts`): a terra debaixo dos riscos
 * repetida para baixo, uma cor por profundidade abaixo da costa. As faixas são
 * as do protótipo "Diorama vivo" (lábio iluminado, terra, veio escuro, terra
 * clara, terra, base molhada); o pé escurecendo até a água vem do "Relevo
 * sutil". Distâncias em px do protótipo, cores em RGB.
 */
export const AJUSTE_DO_PENHASCO = {
  /** Altura da parede abaixo da costa. */
  altura: 18,
  /** De cima para baixo: [até que profundidade, cor]. A última vai até o pé. */
  faixas: [
    [2.2, [224, 192, 136]],
    [6, [188, 144, 92]],
    [7.6, [146, 104, 64]],
    [11.8, [198, 154, 102]],
    [14.6, [158, 114, 72]],
    [18, [112, 78, 50]],
  ],
  /**
   * Meia largura da passagem de uma faixa para a seguinte. Sem ela a troca é um
   * degrau seco de um texel, e a faixa fina (o veio tem 1,6 px) leria como
   * listra desenhada, o que o estilo do usuário não quer.
   */
  transicao: 0.6,
  /** Quanto a parede escurece do lábio ao pé: o pé está molhado. */
  escurecePe: 0.2,
  /**
   * Borrão da borda dos riscos: onde o risco acaba, a parede some aos poucos
   * em vez de terminar num corte reto.
   */
  pontas: 4,
  /**
   * Quanto, acima do conhecido do jogador, a costa ainda conta como vista
   * para a parede nascer (`relevoRaster`): de dentro do mar ele conhece a água
   * até a beira, e a parede sai da terra logo acima dela.
   */
  alcanceDoConhecido: 2,
} as const

/**
 * A cor da parede do penhasco a `profundidade` px do protótipo abaixo da
 * costa: a faixa daquela altura, misturada com a vizinha perto da divisa, e
 * mais escura quanto mais perto da água.
 */
export function corDaParede(profundidade: number): [number, number, number] {
  const { faixas, transicao, escurecePe, altura } = AJUSTE_DO_PENHASCO
  let indice = faixas.findIndex(([ate]) => profundidade < ate)
  if (indice < 0) indice = faixas.length - 1
  let cor: Rgb = faixas[indice][1]
  const ate = faixas[indice][0]
  const de = indice === 0 ? -Infinity : faixas[indice - 1][0]
  // Perto da divisa de baixo, puxa para a próxima; perto da de cima, para a anterior.
  if (indice < faixas.length - 1 && ate - profundidade < transicao) {
    cor = misturar(cor, faixas[indice + 1][1], suave((transicao - (ate - profundidade)) / (2 * transicao)))
  } else if (indice > 0 && profundidade - de < transicao) {
    cor = misturar(cor, faixas[indice - 1][1], suave((transicao - (profundidade - de)) / (2 * transicao)))
  }
  const luz = 1 - escurecePe * Math.min(1, Math.max(0, profundidade / altura))
  return [Math.round(cor[0] * luz), Math.round(cor[1] * luz), Math.round(cor[2] * luz)]
}

/** Curva suave de 0 a 1 (`smoothstep`). */
function suave(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Lados do polígono que aproxima o Círculo e a Elipse: erro de 0,12% do raio, abaixo de 1 px até 800 px de raio. */
const LADOS_DA_ELIPSE = 64

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
  /**
   * Trechos de borda de desenho preenchido entre duas cores diferentes, com
   * terra dos dois lados (`divisasPintadas`): escurecem como a fronteira, mas
   * NÃO fecham fresta na união (desenho não é terra).
   */
  divisas: Segmento[]
  /**
   * Ids dos desenhos cuja borda deu alguma divisa: o formato deles está na
   * textura. Só a saída de um DESTES tira o relevo do palco na hora
   * (`drawRelevo`); detalhe, tinta fraca e desenho no mar não estão na textura.
   */
  divisores: string[]
  /**
   * Riscos do pincel de penhasco, na ordem (`lib/penhasco.ts`): a parede nasce
   * na costa debaixo deles. Vazio quando nenhum risco põe penhasco (só
   * borracha não desenha nada).
   */
  penhascos: readonly TracoDePenhasco[]
  /** Pedaço do mundo que a textura cobre: a terra mais a folga da sombra (e da parede do penhasco, embaixo). */
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
  return regioes.filter(ehTerra).map((r) => r.points)
}

/**
 * A pergunta "este ponto é terra?" para muitas perguntas seguidas: a união das
 * terras do relevo. O pincel de penhasco a usa para saber se o risco passou
 * pela costa (`lib/penhasco.ts`, que é folha e não importa daqui).
 */
export function consultaDaTerra(regioes: readonly Region[]): (p: RegionPoint) => boolean {
  const consultas = terrasDoRelevo(regioes).map(prepararConsulta)
  return (p) => consultas.some((c) => contem(c, p))
}

function ehTerra(r: Region): boolean {
  return r.filled !== false && r.points.length >= 3 && r.points.every(pontoFinito)
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
  const consultas = terras.map(prepararConsulta)
  const naTerra = (p: RegionPoint): boolean => consultas.some((c) => contem(c, p))
  const fronteiras: Segmento[] = []
  const costa: Segmento[] = []
  for (const poligono of terras) {
    percorrerContorno(
      poligono,
      passo,
      (meio, nx, ny) =>
        naTerra({ x: meio.x + nx * folga, y: meio.y + ny * folga }) && naTerra({ x: meio.x - nx * folga, y: meio.y - ny * folga }),
      (segmento, ehFronteira) => (ehFronteira ? fronteiras : costa).push(segmento),
    )
  }
  return { fronteiras, costa }
}

/**
 * Corta cada lado do polígono em pedaços de até `passo` px de mundo, pergunta
 * a `classificar` o tipo de cada pedaço (pelo meio dele e pela normal do lado)
 * e entrega a `entregar` cada trecho contínuo do mesmo tipo, já emendado.
 * `de` e `ate` limitam os lados percorridos (de `poligono[de]` a
 * `poligono[ate]`): cada lado se emenda sozinho, então o contorno pode ser
 * percorrido em pedaços (`divisasPintadas` dá a vez entre eles).
 */
function percorrerContorno(
  poligono: readonly RegionPoint[],
  passo: number,
  classificar: (meio: RegionPoint, nx: number, ny: number) => boolean,
  entregar: (segmento: Segmento, tipo: boolean) => void,
  de = 0,
  ate = poligono.length,
): void {
  for (let i = de; i < ate; i += 1) {
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
      entregar({ a: interpolar(a, b, inicio / pedacos), b: interpolar(a, b, fim / pedacos) }, tipoAtual)
    }
    for (let k = 0; k < pedacos; k += 1) {
      const tipo = classificar(interpolar(a, b, (k + 0.5) / pedacos), nx, ny)
      if (tipoAtual !== tipo) {
        fechar(k)
        inicio = k
        tipoAtual = tipo
      }
    }
    fechar(pedacos)
  }
}

/**
 * Polígono pronto para MUITAS perguntas "o ponto está dentro?". Os lados ficam
 * separados em faixas horizontais, e o raio do teste (para a direita, na
 * altura do ponto) só pode cruzar lados da faixa do ponto. O balde gera
 * polígonos de mais de mil vértices e a classificação das divisas faz milhares
 * de perguntas: sem as faixas, o mapa real de teste levava ~40 ms só nisto.
 */
interface PoligonoDeConsulta {
  pontos: readonly RegionPoint[]
  caixa: Caixa
  alturaDaFaixa: number
  /** Para cada faixa, o índice `i` dos lados (de `pontos[i]` a `pontos[i + 1]`) que passam por ela. */
  faixas: number[][]
}

/** Lados por faixa, em média: poucos o bastante para o teste ser barato, sem faixa demais em polígono pequeno. */
const LADOS_POR_FAIXA = 8
const TETO_DE_FAIXAS = 512

function prepararConsulta(pontos: readonly RegionPoint[]): PoligonoDeConsulta {
  const caixa = caixaDe(pontos)
  const total = Math.min(TETO_DE_FAIXAS, Math.max(1, Math.ceil(pontos.length / LADOS_POR_FAIXA)))
  const alturaDaFaixa = (caixa.maxY - caixa.minY) / total
  const consulta: PoligonoDeConsulta = { pontos, caixa, alturaDaFaixa, faixas: Array.from({ length: total }, () => []) }
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    // Lado deitado nunca cruza o raio horizontal (o teste exige um ponta de cada lado).
    if (a.y === b.y) continue
    const ate = faixaDe(consulta, Math.max(a.y, b.y))
    for (let f = faixaDe(consulta, Math.min(a.y, b.y)); f <= ate; f += 1) consulta.faixas[f].push(i)
  }
  return consulta
}

function faixaDe(c: PoligonoDeConsulta, y: number): number {
  if (!(c.alturaDaFaixa > 0)) return 0
  return Math.min(c.faixas.length - 1, Math.max(0, Math.floor((y - c.caixa.minY) / c.alturaDaFaixa)))
}

/** O mesmo teste de paridade de `isPointInPolygon`, só com os lados da faixa do ponto. */
function contem(c: PoligonoDeConsulta, p: RegionPoint): boolean {
  const { caixa, pontos } = c
  if (p.x < caixa.minX || p.x > caixa.maxX || p.y < caixa.minY || p.y > caixa.maxY) return false
  let dentro = false
  for (const i of c.faixas[faixaDe(c, p.y)]) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro
  }
  return dentro
}

function interpolar(a: RegionPoint, b: RegionPoint, t: number): RegionPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// ---------------------------------------------------------------------------
// DIVISAS PINTADAS (fatia 1b)

type Rgb = readonly [number, number, number]

function rgbDe(cor: unknown): Rgb | null {
  const n = parseHexColor(cor)
  return n === null ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Os desenhos que têm área (o resto é traço: Pincel, Linha, Curva, Caminho, Texto). */
type DesenhoFechado = Extract<Drawing, { kind: 'polygon' | 'rect' | 'ellipse' | 'circle' }>

/** Desenho fechado com fundo: pinta o chão (muda a cor que a tela mostra). Ainda sem olhar geometria. */
function temFundo(d: Drawing): d is DesenhoFechado {
  if (d.kind !== 'polygon' && d.kind !== 'rect' && d.kind !== 'ellipse' && d.kind !== 'circle') return false
  return d.filled === true && Number.isFinite(d.fillAlpha) && d.fillAlpha > 0
}

/** Um desenho que pinta o chão, já como polígono em px de mundo. */
export interface AreaPintada {
  id: string
  pontos: RegionPoint[]
  consulta: PoligonoDeConsulta
  cor: Rgb
  /** Opacidade do fundo (até 1): o chão de baixo ainda tinge o que está por cima. */
  alfa: number
  /**
   * A borda deste desenho pode virar divisa: fundo opaco o bastante
   * (`alfaMinimo`), nem fino (`espessuraMinima`) nem pequeno (`tamanhoMinimo`)
   * demais. Os outros só pintam: a cor deles conta para a dos vizinhos.
   */
  geraDivisa: boolean
}

/** Mínimos de `areasPintadas`, já em px de mundo. */
export interface MinimosDaDivisa {
  espessura: number
  tamanho: number
}

/**
 * Os desenhos que pintam o chão, NA ORDEM em que são pintados (o de cima por
 * último). Fica de fora só o que não pinta nada: traço aberto (rabisco não é
 * área), fundo desligado ou transparente, cor que não se lê, geometria quebrada.
 */
export function areasPintadas(desenhos: readonly Drawing[], minimos: MinimosDaDivisa): AreaPintada[] {
  const areas: AreaPintada[] = []
  for (const d of desenhos) {
    if (!temFundo(d)) continue
    const cor = rgbDe(d.color)
    const pontos = contornoDoDesenho(d)
    if (cor === null || pontos === null) continue
    const consulta = prepararConsulta(pontos)
    const { caixa } = consulta
    const tamanho = Math.max(caixa.maxX - caixa.minX, caixa.maxY - caixa.minY)
    const geraDivisa = d.fillAlpha >= AJUSTE_DAS_DIVISAS.alfaMinimo && tamanho >= minimos.tamanho && espessura(pontos) >= minimos.espessura
    areas.push({ id: d.id, pontos, consulta, cor, alfa: Math.min(1, d.fillAlpha), geraDivisa })
  }
  return areas
}

function contornoDoDesenho(d: DesenhoFechado): RegionPoint[] | null {
  switch (d.kind) {
    case 'polygon':
      return d.points.length >= 3 && d.points.every(pontoFinito) ? d.points.map((p) => ({ x: p.x, y: p.y })) : null
    case 'rect': {
      if (![d.x, d.y, d.w, d.h].every(Number.isFinite) || d.w === 0 || d.h === 0) return null
      // Retângulo puxado para cima ou para a esquerda chega com largura negativa.
      const x0 = Math.min(d.x, d.x + d.w)
      const y0 = Math.min(d.y, d.y + d.h)
      const x1 = Math.max(d.x, d.x + d.w)
      const y1 = Math.max(d.y, d.y + d.h)
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ]
    }
    case 'circle':
      return elipse(d.cx, d.cy, d.radius, d.radius)
    case 'ellipse':
      return elipse(d.cx, d.cy, d.rx, d.ry)
  }
}

function elipse(cx: number, cy: number, rx: number, ry: number): RegionPoint[] | null {
  if (![cx, cy, rx, ry].every(Number.isFinite) || rx <= 0 || ry <= 0) return null
  const pontos: RegionPoint[] = []
  for (let i = 0; i < LADOS_DA_ELIPSE; i += 1) {
    const t = (i / LADOS_DA_ELIPSE) * Math.PI * 2
    pontos.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry })
  }
  return pontos
}

/**
 * 2 × área ÷ perímetro: a grossura de uma faixa, o raio de um círculo. Mede
 * "quanto cabe de sombra dentro da forma" sem depender do formato.
 */
function espessura(pontos: readonly RegionPoint[]): number {
  let area = 0
  let perimetro = 0
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    area += a.x * b.y - b.x * a.y
    perimetro += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return perimetro > 0 ? Math.abs(area) / perimetro : 0
}

/** O chão que uma região pinta: a cor dela e, na sala de duas cores, o lado da segunda. */
interface ChaoDaRegiao {
  consulta: PoligonoDeConsulta
  cor: Rgb
  segunda: { consulta: PoligonoDeConsulta; cor: Rgb } | null
}

/** Cor de região que não se lê: conta como diferente de qualquer desenho, como um chão de cor desconhecida. */
const COR_ILEGIVEL: Rgb = [0, 0, 0]

function chaosDasRegioes(regioes: readonly Region[]): ChaoDaRegiao[] {
  return regioes.filter(ehTerra).map((r) => {
    const split = readRegionSplit(r.split)
    const parte = split === undefined ? [] : splitSecondPart(r.points, split)
    const corDaParte = split === undefined ? null : rgbDe(split.color)
    return {
      consulta: prepararConsulta(r.points),
      cor: rgbDe(r.fillColor) ?? COR_ILEGIVEL,
      segunda: parte.length >= 3 && corDaParte !== null ? { consulta: prepararConsulta(parte), cor: corDaParte } : null,
    }
  })
}

/**
 * A cor que a tela mostra neste ponto do chão, ou `null` no mar. A região de
 * cima (a última da lista) dá o chão; os desenhos que pintam o chão vêm por
 * cima, na ordem, cada um misturado pela própria opacidade. Desenho sobre o
 * mar não muda nada: sem região embaixo, é mar.
 */
function corDoChao(p: RegionPoint, chaos: readonly ChaoDaRegiao[], areas: readonly AreaPintada[]): Rgb | null {
  let cor: Rgb | null = null
  for (let i = chaos.length - 1; i >= 0; i -= 1) {
    const chao = chaos[i]
    if (!contem(chao.consulta, p)) continue
    const segunda = chao.segunda
    cor = segunda !== null && contem(segunda.consulta, p) ? segunda.cor : chao.cor
    break
  }
  if (cor === null) return null
  for (const area of areas) {
    if (contem(area.consulta, p)) cor = misturar(cor, area.cor, area.alfa)
  }
  return cor
}

/**
 * A cor que a tela mostra em cada ponto (a mesma conta de `corDoChao`), em
 * `0xRRGGBB`, ou `null` no mar. NOMES DOS LUGARES (`lib/nomesDosLugares.ts`):
 * a pílula sai da cor do bioma debaixo do lugar — a região e os desenhos que
 * a pintam, os mesmos que esta tela desenha. Aqui todo desenho com fundo
 * conta, sem os mínimos da divisa: um bioma pequeno também é a cor do lugar.
 */
export function coresDoChao(regioes: readonly Region[], desenhos: readonly Drawing[], pontos: readonly RegionPoint[]): (number | null)[] {
  if (pontos.length === 0) return []
  const chaos = chaosDasRegioes(regioes)
  const areas = areasPintadas(desenhos, { espessura: 0, tamanho: 0 })
  return pontos.map((p) => {
    const cor = corDoChao(p, chaos, areas)
    return cor === null ? null : (Math.round(cor[0]) << 16) | (Math.round(cor[1]) << 8) | Math.round(cor[2])
  })
}

/** Oito direções (de 45 em 45 graus), em vetor unitário: a volta que a checagem do mar olha. */
const DIRECOES_EM_VOLTA: readonly (readonly [number, number])[] = Array.from({ length: 8 }, (_, i): readonly [number, number] => {
  const t = (i / 8) * Math.PI * 2
  return [Math.cos(t), Math.sin(t)]
})

/** Tinta `por` sobre `base` com opacidade `alfa` (mistura normal, como o Pixi pinta). */
function misturar(base: Rgb, por: Rgb, alfa: number): Rgb {
  return [base[0] + (por[0] - base[0]) * alfa, base[1] + (por[1] - base[1]) * alfa, base[2] + (por[2] - base[2]) * alfa]
}

function distanciaDeCor(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/**
 * Os trechos de borda de desenho que separam duas cores diferentes, com terra
 * dos dois lados. Cada pedaço olha `folga` px para cada lado e compara a cor
 * que a tela mostra ali (`corDoChao`). O traço do desenho não entra: ele tem
 * a cor do fundo, e a faixa da sombra (borrada 14 px do protótipo) não sente
 * o meio traço de alguns px que a desloca. Assim:
 * - borda sobre o mar (desenho que passa da costa, ou solto no mar): nada;
 * - borda que encosta na costa, ou corre a menos de `longeDoMar` px dela: é
 *   costa, já tem o friso; nada;
 * - borda escondida por outro desenho por cima: a mesma cor dos dois lados; nada;
 * - desenho repetido sobre si mesmo, ou tons quase iguais: nada;
 * - borda de detalhe (`geraDivisa` falso): nada, mas a cor dele conta.
 *
 * Em PASSOS (gerador): pausa a cada `LADOS_POR_PASSO` lados, para quem roda
 * na tela dar a vez ao navegador (`planoDoRelevoEmPassos`). No mapa real são
 * milhares de perguntas de cor, ~100 ms num celular lento.
 */
export function* divisasPintadas(
  regioes: readonly Region[],
  areas: readonly AreaPintada[],
  passo: number,
  folga: number,
  longeDoMar: number,
): Generator<void, DivisasPintadas, void> {
  const divisas: Segmento[] = []
  const divisores: string[] = []
  if (!areas.some((area) => area.geraDivisa)) return { divisas, divisores }
  const chaos = chaosDasRegioes(regioes)
  const naTerra = (x: number, y: number): boolean => chaos.some((chao) => contem(chao.consulta, { x, y }))
  // Em VOLTA do pedaço, não só pela normal: o degrau do balde (6,4 px) fica
  // na diagonal da costa, e a normal dele (deitada ou em pé) passa ao lado do mar.
  const raios = [longeDoMar / 2, longeDoMar]
  const longeDoMarEmVolta = (meio: RegionPoint): boolean =>
    raios.every((r) => DIRECOES_EM_VOLTA.every(([dx, dy]) => naTerra(meio.x + dx * r, meio.y + dy * r)))
  const classificar = (meio: RegionPoint, nx: number, ny: number): boolean => {
    const deUmLado = corDoChao({ x: meio.x + nx * folga, y: meio.y + ny * folga }, chaos, areas)
    if (deUmLado === null) return false
    const doOutro = corDoChao({ x: meio.x - nx * folga, y: meio.y - ny * folga }, chaos, areas)
    if (doOutro === null || distanciaDeCor(deUmLado, doOutro) < AJUSTE_DAS_DIVISAS.diferencaDeCor) return false
    return longeDoMarEmVolta(meio)
  }
  const entregar = (segmento: Segmento, ehDivisa: boolean): void => {
    if (ehDivisa) divisas.push(segmento)
  }
  for (const area of areas) {
    if (!area.geraDivisa) continue
    const antes = divisas.length
    for (let de = 0; de < area.pontos.length; de += LADOS_POR_PASSO) {
      yield
      percorrerContorno(area.pontos, passo, classificar, entregar, de, Math.min(area.pontos.length, de + LADOS_POR_PASSO))
    }
    if (divisas.length > antes) divisores.push(area.id)
  }
  return { divisas, divisores }
}

/** As divisas pintadas e os ids dos desenhos que deram alguma delas. */
export interface DivisasPintadas {
  divisas: Segmento[]
  divisores: string[]
}

/**
 * Lados de contorno classificados entre uma pausa e outra: cada lado custa até
 * algumas dezenas de perguntas de cor; 64 lados ficam bem abaixo de um quadro
 * mesmo no celular lento, e polígono de balde (mais de mil lados) não vira um
 * pedaço só.
 */
const LADOS_POR_PASSO = 64

/** Roda um gerador em passos até o fim, sem pausa nenhuma (quem não está numa tela). */
function concluir<T>(passos: Generator<void, T, void>): T {
  for (;;) {
    const passo = passos.next()
    if (passo.done === true) return passo.value
  }
}

/** Pedaço máximo de lado que a classificação olha, em px do protótipo: bem menor que o borrão da fronteira. */
const PASSO_DA_BORDA = 4
/** Quanto cada pedaço olha para cada lado, em px do protótipo: absorve a fresta entre regiões vizinhas. */
const FOLGA_DA_BORDA = 1.5

/**
 * O plano do relevo para estas regiões e os desenhos desta tela, ou `null` sem
 * terra nenhuma (nada a gerar, e a textura anterior pode ser liberada).
 * Desenho só entra nas divisas (`divisasPintadas`): sem região, nada a gerar.
 * `teto` limita o lado maior da textura; a escala é proporcional e nunca
 * passa de 1 texel por px.
 */
export function planoDoRelevo(
  map: Pick<MapData, 'width' | 'height' | 'grid'>,
  regioes: readonly Region[],
  desenhos: readonly Drawing[] = [],
  teto: number = TETO_DA_TEXTURA,
  penhascos: readonly TracoDePenhasco[] = [],
): PlanoDoRelevo | null {
  const plano = concluir(planoDoRelevoEmPassos(map, regioes, desenhos, teto))
  return plano === null ? null : planoComPenhascos(plano, penhascos, teto)
}

/**
 * O plano com os riscos do penhasco (`lib/penhasco.ts`). Fica FORA do plano da
 * terra de propósito, como o conhecido do jogador: o plano (as divisas, ~100 ms
 * no celular lento) é guardado por terra (`drawRelevo`), e os riscos que o
 * jogador recebe crescem a cada pedaço de costa explorado — sem isto, cada
 * passo junto de um penhasco refaria o plano inteiro. Aqui só muda o que os
 * riscos mudam: a parede desce abaixo da costa e a sombra no mar sai do pé
 * dela, então a textura ganha embaixo a altura da parede.
 */
export function planoComPenhascos(
  plano: PlanoDoRelevo,
  penhascos: readonly TracoDePenhasco[] | undefined,
  teto: number = TETO_DA_TEXTURA,
): PlanoDoRelevo {
  if (penhascos === undefined || !temRiscoDePenhasco(penhascos)) return plano.penhascos.length === 0 ? plano : { ...plano, penhascos: [] }
  const retangulo = { ...plano.retangulo, altura: plano.retangulo.altura + AJUSTE_DO_PENHASCO.altura * plano.unidade }
  const escala = Math.min(ESCALA_MAXIMA, teto / Math.max(retangulo.largura, retangulo.altura))
  return { ...plano, penhascos: [...penhascos], retangulo, escala }
}

/**
 * O mesmo `planoDoRelevo`, em PASSOS (gerador): pausa entre as fronteiras e as
 * divisas, e entre pedaços da classificação das divisas. A tela roda os passos
 * em fatias e dá a vez ao navegador entre elas (`drawRelevo`), para o plano do
 * mapa real não virar uma tarefa longa no celular a cada pedaço explorado.
 */
export function* planoDoRelevoEmPassos(
  map: Pick<MapData, 'width' | 'height' | 'grid'>,
  regioes: readonly Region[],
  desenhos: readonly Drawing[] = [],
  teto: number = TETO_DA_TEXTURA,
): Generator<void, PlanoDoRelevo | null, void> {
  const terras = terrasDoRelevo(regioes)
  if (terras.length === 0) return null
  const unidade = unidadeDoRelevo(map)
  const passo = PASSO_DA_BORDA * unidade
  const folgaDaBorda = FOLGA_DA_BORDA * unidade
  const { fronteiras } = bordasDaTerra(terras, passo, folgaDaBorda)
  yield
  const areas = areasPintadas(desenhos, {
    espessura: AJUSTE_DAS_DIVISAS.espessuraMinima * unidade,
    tamanho: AJUSTE_DAS_DIVISAS.tamanhoMinimo * unidade,
  })
  const { divisas, divisores } = yield* divisasPintadas(regioes, areas, passo, folgaDaBorda, AJUSTE_DAS_DIVISAS.longeDoMar * unidade)

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
    divisas,
    divisores,
    // Os riscos entram depois, por `planoComPenhascos`.
    penhascos: [],
    retangulo,
    escala,
    unidade,
    mapa: { largura: map.width * map.grid, altura: map.height * map.grid },
    folgaDaFronteira: folgaDaBorda,
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
export function assinaturaDaTerra(regioes: readonly Region[], desenhos: readonly Drawing[] = []): string {
  const terra = regioes
    .map((r) => `${r.id}${r.filled === false ? '-' : ''}:${r.fillColor}:${r.split === undefined ? '' : JSON.stringify(r.split)}:${pontosEmTexto(r.points)}`)
    .join('|')
  return `${terra}#${assinaturaDosDesenhos(desenhos)}`
}

/**
 * Os mesmos riscos de penhasco? Por referência primeiro; referência nova (o
 * pacote do jogador) compara o conteúdo, para um pacote que só trouxe os
 * mesmos riscos não refazer a textura. Ausente e vazio são iguais.
 */
export function mesmosPenhascos(a: readonly TracoDePenhasco[] | undefined, b: readonly TracoDePenhasco[] | undefined): boolean {
  if (a === b) return true
  return assinaturaDosPenhascos(a) === assinaturaDosPenhascos(b)
}

function pontosEmTexto(pontos: readonly RegionPoint[]): string {
  return pontos.map((p) => `${p.x},${p.y}`).join(' ')
}

/**
 * Só o que muda as divisas: os desenhos que pintam o chão, com cor, opacidade,
 * traço e forma. Rabisco novo, texto e caminho não mexem na assinatura, então
 * desenhar à mão por cima do mapa não refaz o relevo.
 */
function assinaturaDosDesenhos(desenhos: readonly Drawing[]): string {
  return desenhos
    .filter(temFundo)
    .map((d) => `${d.id}:${d.kind}:${d.color}:${d.fillAlpha}:${d.width}:${formaEmTexto(d)}`)
    .join('|')
}

function formaEmTexto(d: DesenhoFechado): string {
  switch (d.kind) {
    case 'polygon':
      return pontosEmTexto(d.points)
    case 'rect':
      return `${d.x},${d.y},${d.w},${d.h}`
    case 'circle':
      return `${d.cx},${d.cy},${d.radius}`
    case 'ellipse':
      return `${d.cx},${d.cy},${d.rx},${d.ry}`
  }
}

/**
 * Ids dos desenhos que pintam o chão (com fundo, mesmo transparente). O palco
 * confere aqui se os divisores da textura (`PlanoDoRelevo.divisores`) ainda
 * pintam: desenho que o mestre torna secreto deixa o recorte do jogador, e a
 * sombra da borda dele não pode ficar no palco à espera da textura nova.
 */
export function idsDasAreasPintadas(desenhos: readonly Drawing[]): Set<string> {
  const ids = new Set<string>()
  for (const d of desenhos) if (temFundo(d)) ids.add(d.id)
  return ids
}

/**
 * Ids das regiões que contam como terra. Some algum de uma vez para a outra,
 * a terra encolheu (o mestre ocultou a região, ou a tirou do recorte): o
 * relevo dela não pode ficar no palco à espera da textura nova.
 */
export function idsDaTerra(regioes: readonly Region[]): Set<string> {
  const ids = new Set<string>()
  for (const r of regioes) if (ehTerra(r)) ids.add(r.id)
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
