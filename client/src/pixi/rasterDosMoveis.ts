import { BufferImageSource, Texture } from 'pixi.js'
import type { Prop } from '../types/map'
import { cordaDaCerca, formaDoTapete, normalizarCorDeTecido, normalizarCorDoMovel, vistaDoMovel, voltaDaCerca } from '../lib/mobilia'
import { varianteDaLapide } from '../lib/mobilia/pecasNovas'
import { CURVE_EPSILON_PX, curvaForTurnDegrees, turnDegreesForCurva } from '../lib/stairCurve'
import { FATIA_DO_LADRILHO_MS } from '../texturas/ladrilhos'
import { LUGARES_DE_MATERIAL, materialMaisPerto, type OpcaoDeMaterial } from '../texturas/meioTermo/materiais'
import { escalaDoNivel, GRADE_DE_REFERENCIA, montarCena, temTextura, type DesenhoDoMovel } from '../texturas/meioTermo/moveis'
import { G } from '../texturas/meioTermo/moveis/contexto'
import { BYTES_DE_TRABALHO_POR_PIXEL, limitesDaCena, pintarCenaEmPassos, type Cena, type LimitesDaImagem } from '../texturas/meioTermo/moveis/motor'

/**
 * IMAGEM PRONTA DOS MÓVEIS do Meio-Termo (plano
 * `docs/planos/meio-termo-texturas-objetos-2026-10-23.md`, seções 2 e 5, MT2).
 *
 * Cada móvel vira a CHAVE da imagem: {tipo, vista do mapa, Frente/Lado,
 * materiais, forma, curva (de 5 em 5 graus), pegada em casas (de 0,1 em 0,1),
 * nível de resolução 1|2|3}. Móveis com a mesma chave dividem a mesma imagem;
 * a semente do veio é o hash da chave SEM o nível, para o veio não pular ao
 * mudar o zoom. Só a CHAVE arredonda a pegada: o desenho usa o tamanho exato
 * do primeiro móvel que pediu a imagem (o baú de 1 x 0,6 sai 1 x 0,6).
 *
 * Quem desenha abre uma PASSADA por dono (o `Graphics`): o que ele pede e o
 * que ele cola ficam contados por dono. Assim:
 * - a FILA (fatias de 8 ms, o ritmo de `texturas/ladrilhos.ts`) pula a imagem
 *   que nenhum dono pediu na última passada (o zoom que cruza os níveis 1, 2 e
 *   3 não gera os três);
 * - pronta a imagem, o dono que a pediu é chamado para se repintar (sai o
 *   desenho de linhas provisório; a chave de repintura do jogador não muda);
 * - a imagem que sai do cache só é destruída (`destroy(true)`, que solta a
 *   cópia da placa: a fonte de bytes não tem coleta automática no Pixi 8)
 *   quando nenhum dono a cola mais.
 *
 * Cache LRU por bytes, 64 MB no computador e 24 MB com `pointer: coarse`:
 * conta a imagem duas vezes (os bytes na CPU e a cópia na placa) e o buffer
 * de trabalho da imagem que está sendo pintada. A poda não tira a imagem em
 * pintura, nem a da passada aberta, nem a que algum dono pediu na última
 * passada dele.
 */

/** A única vista desta fatia; a 3/4 chega com a MT11. */
export type VistaDoMapa = 'de-cima'

export const NIVEL_MAXIMO = 3
/** Passo da pegada na chave, em casas: 0,5, 0,6, 0,7 e 0,8 caem exatos. */
export const PASSO_DAS_CASAS = 0.1
/** A volta redonda (de 5 em 5 graus) que a cerca curva usa quando ela cabe na tolerância da flecha. */
export const PASSO_DA_CURVA = 5
/**
 * Passo da FLECHA da cerca curva na chave, em casas da grade de referência (1
 * px de mundo na grade de 50): a imagem sai a no máximo meio passo (0,01 casa)
 * da curva que a alça e o contorno mostram, em qualquer comprimento. Com a
 * volta de 5 em 5 graus o erro crescia com a cerca (flecha = c/2 · tan(θ/4):
 * ~0,05 casa em 10 casas, ~0,55 em 100) e volta abaixo de 2,5° saía reta.
 */
export const PASSO_DA_FLECHA = 0.02
/**
 * Tipos de comprimento livre (a cerca): a imagem é cortada em LADRILHOS de até
 * `LADO_MAXIMO_DA_IMAGEM` de lado e a escala do nível só cai quando a soma dos
 * pixels passa de `PIXELS_MAXIMOS_EM_LADRILHOS`. Numa imagem só, cortada no
 * lado máximo, a cerca de 20 casas no nível 3 saía com 0,91 pixel por px em
 * vez de 2,68 (mourão e fio viravam borrão) e a de 100 no nível 1, com 0,18.
 * A sebe e o tapete longo (MT5) também têm comprimento livre e saem do mesmo jeito.
 */
const TIPOS_EM_LADRILHOS: ReadonlySet<string> = new Set(['cerca', 'sebe', 'tapeteLongo'])
const MEGABYTE = 1024 * 1024
export const TETO_NO_COMPUTADOR = 64 * MEGABYTE
export const TETO_NO_TOQUE = 24 * MEGABYTE
/**
 * Lado máximo da imagem em pixels: móvel enorme ganha menos pixels por px, não
 * uma textura que a placa recusa. 1024 e não 2048: o buffer de trabalho tem 24
 * bytes por pixel (24 MB a 1024 x 1024; seriam 96 MB a 2048).
 */
export const LADO_MAXIMO_DA_IMAGEM = 1024
/**
 * Teto de pixels de um móvel em ladrilhos, todos somados: o de uma imagem do
 * lado máximo (4 MB de RGBA, 8 MB com as duas cópias), então a cerca longa
 * nunca pesa mais que um móvel enorme pesava. Medido (a escala que sobra, da
 * do nível; antes, numa imagem só): cerca reta de até 40 casas nos níveis 1 a
 * 3 e de 100 no nível 1, 1,00; de 100 casas no nível 3, 0,79 (antes 0,07).
 * LIMITE: a curva conta a caixa inteira, com o miolo vazio do arco: 40 casas
 * com 90° no nível 3 saem com 0,35 (antes 0,17); 100 casas com 180°, 0,10.
 */
export const PIXELS_MAXIMOS_EM_LADRILHOS = LADO_MAXIMO_DA_IMAGEM * LADO_MAXIMO_DA_IMAGEM
const BYTES_POR_PIXEL = 4
/** A imagem pronta mora duas vezes: os bytes na CPU e a cópia na placa. */
const COPIAS_DA_IMAGEM = 2

export interface ChaveDoMovel {
  readonly desenho: DesenhoDoMovel
  readonly vistaDoMapa: VistaDoMapa
  readonly forma: string
  /** A volta que a imagem desenha, em graus (0 = reta). */
  readonly curva: number
  /** A curva no texto da chave: 'r' (reta), 'g<graus>' (volta redonda) ou 'f<passos da flecha>'. */
  readonly chaveDaCurva: string
  readonly nivel: number
}

/** O que a silhueta passa para cá: o tamanho e a aparência do móvel. */
export type MovelParaImagem = Pick<
  Prop,
  'width' | 'height' | 'mobilia' | 'mobiliaCor' | 'mobiliaCorDaLinha' | 'mobiliaVista' | 'mobiliaCurva' | 'mobiliaForma' | 'mobiliaCorDoTravesseiro' | 'mobiliaCorDoCobertor'
> &
  // Só a lápide lê o id: a variação do desenho sai dele (`varianteDaLapide`).
  Partial<Pick<Prop, 'id'>>

/** Pixels da imagem por px de mundo: 1, 2 ou 3 (a 4x a cama passava de 50 ms). */
export function nivelDeResolucao(cameraScale: number, rendererResolution: number): number {
  const pedido = Math.ceil(cameraScale * rendererResolution)
  return Number.isFinite(pedido) ? Math.min(NIVEL_MAXIMO, Math.max(1, pedido)) : 1
}

function arredondar(valor: number, passo: number): number {
  return Math.round(valor / passo) * passo
}

/** Pegada EXATA em casas na grade de referência (o desenho), nunca menos de um passo. */
function casasDe(px: number): number {
  return Math.max(PASSO_DAS_CASAS, px / GRADE_DE_REFERENCIA)
}

/** A pegada na chave: um número inteiro de passos (sem a sujeira de 0,1 x 7 = 0,7000000000000001). */
function passosNaChave(casas: number): number {
  return Math.round(casas / PASSO_DAS_CASAS)
}

/**
 * Material no lugar da cor: cada campo de cor que o móvel já tem vira o
 * material mais perto da lista do lugar (`materialMaisPerto`). A cama usa os
 * 3 campos de hoje (madeira, cobertor, travesseiro); o resto, a "Cor" (o
 * material principal) e a "Cor da linha" (o segundo).
 */
function materiaisDoMovel(prop: MovelParaImagem, tipo: DesenhoDoMovel['tipo']): OpcaoDeMaterial[] {
  const cores =
    tipo === 'catre'
      ? [normalizarCorDoMovel(prop.mobiliaCor), normalizarCorDeTecido(tipo, prop.mobiliaCorDoCobertor), normalizarCorDeTecido(tipo, prop.mobiliaCorDoTravesseiro)]
      : [normalizarCorDoMovel(prop.mobiliaCor), normalizarCorDoMovel(prop.mobiliaCorDaLinha)]
  return LUGARES_DE_MATERIAL[tipo].map((lugar, i) => materialMaisPerto(cores[i], lugar))
}

/** Texto do desenho, sem o nível e com a pegada arredondada: dele sai a semente. */
function textoDoDesenho(chave: Omit<ChaveDoMovel, 'nivel'>): string {
  const d = chave.desenho
  const partes = [d.tipo, chave.vistaDoMapa, d.lado, d.materiais.join(','), chave.forma, chave.chaveDaCurva, passosNaChave(d.casasW), passosNaChave(d.casasH)]
  // A variação (só a lápide) entra no fim e só quando existe: a chave dos outros tipos fica a mesma de antes.
  return (d.variante === undefined ? partes : [...partes, `v${d.variante}`]).join('|')
}

/** A flecha (px de mundo) que a volta `graus` dá na corda da cerca, a mesma conta do desenho de linhas. */
function flechaDaVolta(graus: number, corda: number): number {
  return curvaForTurnDegrees(graus, corda)
}

/**
 * A curva da cerca na chave e no desenho, quantizada pela FLECHA. A volta
 * redonda de 5 em 5 graus fica quando cabe na tolerância (meio passo de
 * flecha, invisível): as cercas curtas de 88° e 92° continuam dividindo a
 * imagem de 90°. Fora disso, a flecha vai para o passo mais perto (nunca zero
 * se o app mostra a curva). Reta (ou flecha que o app não desenha) = 'r'.
 */
function curvaDaCerca(prop: MovelParaImagem): { curva: number; chaveDaCurva: string } {
  const volta = voltaDaCerca({ mobilia: prop.mobilia, mobiliaCurva: prop.mobiliaCurva })
  const corda = cordaDaCerca(prop.width, prop.height)
  if (volta === 0 || corda === null) return { curva: 0, chaveDaCurva: 'r' }
  const flecha = flechaDaVolta(volta, corda.comprimento)
  if (Math.abs(flecha) < CURVE_EPSILON_PX) return { curva: 0, chaveDaCurva: 'r' }
  const tolerancia = (PASSO_DA_FLECHA / 2) * GRADE_DE_REFERENCIA
  const redonda = arredondar(volta, PASSO_DA_CURVA)
  if (redonda !== 0 && Math.abs(flechaDaVolta(redonda, corda.comprimento) - flecha) <= tolerancia) return { curva: redonda, chaveDaCurva: `g${redonda}` }
  const passo = PASSO_DA_FLECHA * GRADE_DE_REFERENCIA
  const passos = Math.round(flecha / passo) || Math.sign(flecha)
  return { curva: turnDegreesForCurva(passos * passo, corda.comprimento), chaveDaCurva: `f${passos}` }
}

/** O texto da chave inteira, o que o cache guarda. */
export function textoDaChave(chave: ChaveDoMovel): string {
  return `${textoDoDesenho(chave)}|${chave.nivel}`
}

const FNV_BASE = 2166136261
const FNV_PRIMO = 16777619
/** A semente fica pequena: entra multiplicada nas coordenadas do ruído, e número grande perde a fração. */
export const SEMENTES = 1000

function sementeDoTexto(texto: string): number {
  let h = FNV_BASE
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), FNV_PRIMO)
  return (h >>> 0) % SEMENTES
}

/** A chave da imagem do móvel, ou `null` se o tipo ainda não tem desenho com textura. */
export function chaveDoMovel(prop: MovelParaImagem, cameraScale: number, rendererResolution: number): ChaveDoMovel | null {
  const tipo = prop.mobilia
  if (!temTextura(tipo)) return null
  const semSemente = {
    tipo,
    lado: vistaDoMovel(prop),
    materiais: materiaisDoMovel(prop, tipo),
    casasW: casasDe(prop.width),
    casasH: casasDe(prop.height),
    semente: 0,
    ...(prop.mobilia === 'lapide' ? { variante: varianteDaLapide(prop.id) } : {}),
  }
  const parcial = { vistaDoMapa: 'de-cima' as const, forma: formaDoTapete(prop), ...curvaDaCerca(prop) }
  const semente = sementeDoTexto(textoDoDesenho({ ...parcial, desenho: semSemente }))
  // O desenho leva a forma do tapete e a volta da cerca (já quantizada pela flecha): é o que a cena da imagem lê.
  const desenho = { ...semSemente, semente, forma: parcial.forma, curva: parcial.curva }
  return { ...parcial, desenho, nivel: nivelDeResolucao(cameraScale, rendererResolution) }
}

/** O teto de bytes do aparelho: menor com dedo (celular, tablet). */
export function tetoDeBytesDoAparelho(): number {
  const toque = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return toque ? TETO_NO_TOQUE : TETO_NO_COMPUTADOR
}

/** Um pedaço da imagem com textura própria: onde ele fica (px do protótipo) e o tamanho dele em pixels. */
export interface LadrilhoDaImagem {
  readonly textura: Texture
  readonly limites: LimitesDaImagem
}

/** A imagem de um móvel, pronta ou ainda na fila, e onde ela fica em px do protótipo. */
export interface ImagemDoMovel {
  /** A textura do primeiro ladrilho: a imagem inteira, no móvel que não é cortado. */
  readonly textura: Texture
  /** A imagem inteira (todos os ladrilhos juntos). */
  readonly limites: LimitesDaImagem
  /** Os pedaços a colar: um só (a imagem inteira) ou, na cerca longa, os ladrilhos que têm alguma coisa. */
  readonly ladrilhos: readonly LadrilhoDaImagem[]
  /** Pixels da imagem por px do protótipo. */
  readonly S: number
  /** A pegada (exata) em que a imagem foi desenhada. */
  readonly casasW: number
  readonly casasH: number
  readonly nivel: number
  readonly pronta: boolean
}

/**
 * Onde colar a imagem (ou um ladrilho dela, `parte`), em px de mundo em volta
 * do centro do objeto: a pegada desenhada esticada até o tamanho dele.
 */
export function retanguloNoMundo(imagem: ImagemDoMovel, largura: number, altura: number, parte: LimitesDaImagem = imagem.limites): { x: number; y: number; w: number; h: number } {
  const kx = largura / (imagem.casasW * G)
  const ky = altura / (imagem.casasH * G)
  const { x0, y0, W, H } = parte
  return { x: x0 * kx, y: y0 * ky, w: (W / imagem.S) * kx, h: (H / imagem.S) * ky }
}

/** Um ladrilho em pixels da imagem inteira: o canto (múltiplo do lado máximo) e o tamanho. */
export interface CorteDaImagem {
  readonly i0: number
  readonly j0: number
  readonly W: number
  readonly H: number
}

/** O ladrilho em px do protótipo: os mesmos pontos de amostra da imagem inteira, a partir do canto dele. */
function limitesDoCorte(limites: LimitesDaImagem, corte: CorteDaImagem, S: number): LimitesDaImagem {
  if (corte.i0 === 0 && corte.j0 === 0 && corte.W === limites.W && corte.H === limites.H) return limites
  return { x0: limites.x0 + corte.i0 / S, y0: limites.y0 + corte.j0 / S, W: corte.W, H: corte.H }
}

/**
 * Corta a imagem em ladrilhos de até `LADO_MAXIMO_DA_IMAGEM`, com o canto em
 * múltiplo dele: o ruído de arredondamento (de 64 em 64 pixels) e os pontos
 * de amostra continuam os da imagem inteira, sem emenda.
 */
function cortarEmLadrilhos(limites: LimitesDaImagem): CorteDaImagem[] {
  const L = LADO_MAXIMO_DA_IMAGEM
  const cortes: CorteDaImagem[] = []
  for (let j0 = 0; j0 < limites.H; j0 += L) {
    for (let i0 = 0; i0 < limites.W; i0 += L) cortes.push({ i0, j0, W: Math.min(L, limites.W - i0), H: Math.min(L, limites.H - j0) })
  }
  return cortes
}

/** O passo extra quando o arredondamento dos limites ainda deixa a imagem acima do teto. */
const AJUSTE_DA_ESCALA = 0.99

/**
 * A escala e os ladrilhos de um tipo de comprimento livre (a cerca): a escala
 * do nível inteira enquanto a imagem couber em `PIXELS_MAXIMOS_EM_LADRILHOS`;
 * acima disso, cai o necessário.
 */
export function escalaEmLadrilhos(nivel: number, cena: Cena): { S: number; limites: LimitesDaImagem; cortes: CorteDaImagem[] } {
  let S = escalaDoNivel(nivel)
  let limites = limitesDaCena(cena, S)
  if (limites.W * limites.H > PIXELS_MAXIMOS_EM_LADRILHOS) {
    S *= Math.sqrt(PIXELS_MAXIMOS_EM_LADRILHOS / (limites.W * limites.H))
    limites = limitesDaCena(cena, S)
    while (limites.W * limites.H > PIXELS_MAXIMOS_EM_LADRILHOS) {
      S *= AJUSTE_DA_ESCALA
      limites = limitesDaCena(cena, S)
    }
  }
  return { S, limites, cortes: cortarEmLadrilhos(limites) }
}

/** A escala, a imagem inteira e os cortes de qualquer móvel: um corte só, fora a cerca. */
export function escalaECortes(tipo: string, nivel: number, cena: Cena): { S: number; limites: LimitesDaImagem; cortes: CorteDaImagem[] } {
  if (TIPOS_EM_LADRILHOS.has(tipo)) return escalaEmLadrilhos(nivel, cena)
  const { S, limites } = escalaELimites(nivel, cena)
  return { S, limites, cortes: [{ i0: 0, j0: 0, W: limites.W, H: limites.H }] }
}

interface Entrada extends ImagemDoMovel {
  readonly chave: string
  /** Bytes da imagem pronta (as duas cópias). */
  readonly bytes: number
  /** Bytes do buffer de trabalho enquanto ela é pintada. */
  readonly bytesDeTrabalho: number
  readonly passos: Generator<void, void, void>
  pronta: boolean
  /** Começou a pintar: o buffer de trabalho existe. */
  emPintura: boolean
  /** Saiu do cache; a fila pula, e a textura é destruída quando nenhum dono a cola. */
  retirada: boolean
  destruida: boolean
  /** Quantos donos pediram esta imagem na última passada deles. */
  pedidos: number
  /** Quantos donos a colam agora (na última passada deles). */
  colagens: number
  /** Pedida fora de passada (teste, pré-carga): a fila não pula por falta de dono. */
  avulsa: boolean
}

/** O que um dono pediu e colou na última passada, e como chamá-lo para se repintar. */
interface Dono {
  readonly pedidas: ReadonlySet<Entrada>
  readonly coladas: ReadonlySet<Entrada>
  readonly repintar: () => void
}

interface PassadaAberta {
  readonly dono: object
  readonly pedidas: Set<Entrada>
  readonly coladas: Set<Entrada>
  readonly repintar: () => void
}

/** O que a silhueta precisa numa passada: a imagem pedida e a que dá para colar já (ela, pronta, ou a de outro nível). */
export interface ImagemParaDesenhar {
  readonly pedida: ImagemDoMovel
  readonly mostrar: ImagemDoMovel | null
}

export interface OpcoesDoRaster {
  readonly tetoDeBytes?: number
  /** Agenda a próxima fatia (padrão: `setTimeout(…, 0)`, que dá a vez ao navegador). */
  readonly agendar?: (fatia: () => void) => void
  readonly agora?: () => number
  readonly fatiaMs?: number
}

/** A escala da imagem no nível, menor se o móvel for tão grande que passaria do lado máximo. */
export function escalaELimites(nivel: number, cena: Cena): { S: number; limites: LimitesDaImagem } {
  let S = escalaDoNivel(nivel)
  let limites = limitesDaCena(cena, S)
  const maior = Math.max(limites.W, limites.H)
  if (maior > LADO_MAXIMO_DA_IMAGEM) {
    // A conta dos limites arredonda para cima: um pixel de folga garante o lado máximo.
    S *= (LADO_MAXIMO_DA_IMAGEM - 1) / maior
    limites = limitesDaCena(cena, S)
  }
  return { S, limites }
}

/** Pinta os ladrilhos um depois do outro, uma linha por passo (a textura sobe só no fim de todos). */
function* pintarLadrilhosEmPassos(cena: Cena, S: number, pedacos: readonly { limites: LimitesDaImagem; pixels: Uint8ClampedArray }[]): Generator<void, void, void> {
  for (const p of pedacos) yield* pintarCenaEmPassos(cena, S, p.limites, p.pixels, true)
}

/** Os outros níveis, do mais perto para o mais longe (o de cima primeiro no empate: mais nítido). */
function niveisVizinhos(nivel: number): number[] {
  const vizinhos: number[] = []
  for (let d = 1; d < NIVEL_MAXIMO; d += 1) {
    if (nivel + d <= NIVEL_MAXIMO) vizinhos.push(nivel + d)
    if (nivel - d >= 1) vizinhos.push(nivel - d)
  }
  return vizinhos
}

export class RasterDosMoveis {
  /** Imagens começadas (cada uma é gerada uma vez só enquanto estiver no cache). */
  geradas = 0
  /** Imagens que terminaram de gerar. */
  prontas = 0
  /** Texturas destruídas (saíram do cache e ninguém mais as cola). */
  destruidas = 0
  /** Imagens que a fila pulou porque nenhum dono as pediu na última passada. */
  puladas = 0
  private bytesNoCache = 0
  private readonly cache = new Map<string, Entrada>()
  private readonly fila: Entrada[] = []
  private readonly donos = new Map<object, Dono>()
  /** A entrada de cada imagem devolvida (a imagem É a entrada, vista só pelo lado público). */
  private readonly entradas = new WeakMap<ImagemDoMovel, Entrada>()
  private aberta: PassadaAberta | null = null
  private bombaAgendada = false
  private readonly tetoDeBytes: number
  private readonly agendar: (fatia: () => void) => void
  private readonly agora: () => number
  private readonly fatiaMs: number

  constructor(opcoes: OpcoesDoRaster = {}) {
    this.tetoDeBytes = opcoes.tetoDeBytes ?? tetoDeBytesDoAparelho()
    this.agendar = opcoes.agendar ?? ((fatia) => setTimeout(fatia, 0))
    this.agora = opcoes.agora ?? (() => performance.now())
    this.fatiaMs = opcoes.fatiaMs ?? FATIA_DO_LADRILHO_MS
  }

  get bytes(): number {
    return this.bytesNoCache
  }

  get teto(): number {
    return this.tetoDeBytes
  }

  /** Tem a imagem desta chave guardada? (Não mexe na ordem do LRU.) */
  guardada(chave: string): boolean {
    return this.cache.has(chave)
  }

  /** Quantas imagens esperam na fila (a que está sendo pintada conta). */
  get naFila(): number {
    return this.fila.length
  }

  /**
   * Abre a passada de um dono (o `Graphics` que vai se pintar). Tudo o que ele
   * pedir e colar até `fecharPassada` substitui o da passada anterior dele.
   * `repintar` é chamado quando uma imagem que ele pediu fica pronta.
   */
  abrirPassada(dono: object, repintar: () => void): void {
    if (this.aberta !== null) this.fecharPassada()
    this.aberta = { dono, pedidas: new Set(), coladas: new Set(), repintar }
  }

  /** Fecha a passada aberta: acerta as contagens e destrói o que saiu do cache e ninguém mais cola. */
  fecharPassada(): void {
    const aberta = this.aberta
    if (aberta === null) return
    this.aberta = null
    const antes = this.donos.get(aberta.dono)
    this.trocarContagens(antes?.pedidas, aberta.pedidas, 'pedidos')
    this.trocarContagens(antes?.coladas, aberta.coladas, 'colagens')
    if (aberta.pedidas.size === 0 && aberta.coladas.size === 0) this.donos.delete(aberta.dono)
    else this.donos.set(aberta.dono, { pedidas: aberta.pedidas, coladas: aberta.coladas, repintar: aberta.repintar })
  }

  /** O dono sumiu (o `Graphics` foi destruído): o que ele pedia e colava deixa de contar. */
  soltarDono(dono: object): void {
    if (this.aberta?.dono === dono) this.aberta = null
    const antes = this.donos.get(dono)
    if (antes === undefined) return
    this.donos.delete(dono)
    this.trocarContagens(antes.pedidas, new Set(), 'pedidos')
    this.trocarContagens(antes.coladas, new Set(), 'colagens')
  }

  private trocarContagens(antes: ReadonlySet<Entrada> | undefined, depois: ReadonlySet<Entrada>, campo: 'pedidos' | 'colagens'): void {
    for (const e of depois) if (antes === undefined || !antes.has(e)) e[campo] += 1
    if (antes === undefined) return
    for (const e of antes) {
      if (depois.has(e)) continue
      e[campo] -= 1
      if (campo === 'colagens' && e.colagens === 0 && e.retirada) this.destruir(e)
    }
  }

  /**
   * A imagem do móvel nesta câmera: a guardada, ou uma nova, transparente,
   * que entra na fila. `null` = o tipo ainda não tem desenho com textura.
   */
  imagemDoMovel(prop: MovelParaImagem, cameraScale: number, rendererResolution: number): ImagemDoMovel | null {
    const chave = chaveDoMovel(prop, cameraScale, rendererResolution)
    if (chave === null) return null
    return this.pedir(chave)
  }

  /**
   * A imagem pedida e a que dá para colar já: ela mesma se pronta; senão a
   * pronta de outro nível do mesmo desenho (a troca de zoom não volta ao
   * desenho de linhas); senão nenhuma.
   */
  imagemParaDesenhar(prop: MovelParaImagem, cameraScale: number, rendererResolution: number): ImagemParaDesenhar | null {
    const chave = chaveDoMovel(prop, cameraScale, rendererResolution)
    if (chave === null) return null
    const pedida = this.pedir(chave)
    if (pedida.pronta) return { pedida, mostrar: pedida }
    for (const nivel of niveisVizinhos(chave.nivel)) {
      const vizinha = this.cache.get(textoDaChave({ ...chave, nivel }))
      if (vizinha !== undefined && vizinha.pronta) {
        this.tocar(vizinha)
        return { pedida, mostrar: vizinha }
      }
    }
    return { pedida, mostrar: null }
  }

  /** O dono da passada aberta colou esta imagem: ela não é destruída enquanto ele a colar. */
  marcarColada(imagem: ImagemDoMovel): void {
    const entrada = this.entradas.get(imagem)
    if (entrada !== undefined && !entrada.destruida) this.aberta?.coladas.add(entrada)
  }

  private pedir(chave: ChaveDoMovel): Entrada {
    const texto = textoDaChave(chave)
    const entrada = this.cache.get(texto) ?? this.comecar(texto, chave)
    this.tocar(entrada)
    if (this.aberta !== null) this.aberta.pedidas.add(entrada)
    else entrada.avulsa = true
    return entrada
  }

  /** Usada agora: vai para o fim da fila do LRU. */
  private tocar(entrada: Entrada): void {
    this.cache.delete(entrada.chave)
    this.cache.set(entrada.chave, entrada)
  }

  private comecar(texto: string, chave: ChaveDoMovel): Entrada {
    const cena = montarCena(chave.desenho)
    const { S, limites, cortes } = escalaECortes(chave.desenho.tipo, chave.nivel, cena)
    const pedacos = cortes.map((corte) => {
      const parte = limitesDoCorte(limites, corte, S)
      const pixels = new Uint8ClampedArray(parte.W * parte.H * BYTES_POR_PIXEL)
      // Bytes já multiplicados pelo alfa (a pintura compõe assim): a placa não multiplica de novo.
      const source = new BufferImageSource({ resource: pixels, width: parte.W, height: parte.H, format: 'rgba8unorm', alphaMode: 'premultiplied-alpha', scaleMode: 'linear' })
      return { textura: new Texture({ source }), limites: parte, pixels }
    })
    const ladrilhos: LadrilhoDaImagem[] = pedacos.map(({ textura, limites: parte }) => ({ textura, limites: parte }))
    const entrada: Entrada = {
      chave: texto,
      textura: ladrilhos[0].textura,
      ladrilhos,
      limites,
      S,
      casasW: chave.desenho.casasW,
      casasH: chave.desenho.casasH,
      nivel: chave.nivel,
      bytes: pedacos.reduce((soma, p) => soma + p.pixels.byteLength, 0) * COPIAS_DA_IMAGEM,
      // Um ladrilho por vez: o buffer de trabalho é o do maior.
      bytesDeTrabalho: Math.max(...pedacos.map((p) => p.limites.W * p.limites.H)) * BYTES_DE_TRABALHO_POR_PIXEL,
      passos: pintarLadrilhosEmPassos(cena, S, pedacos),
      pronta: false,
      emPintura: false,
      retirada: false,
      destruida: false,
      pedidos: 0,
      colagens: 0,
      avulsa: false,
    }
    this.geradas += 1
    this.entradas.set(entrada, entrada)
    this.cache.set(texto, entrada)
    this.bytesNoCache += entrada.bytes
    this.podar(entrada)
    this.fila.push(entrada)
    this.agendarBomba()
    return entrada
  }

  /**
   * Em uso agora: algum dono a pediu na última passada, ou a passada aberta já
   * a pediu ou colou. Só colada (a imagem de outro nível no lugar da pedida,
   * enquanto ela não fica pronta) pode sair do cache; a textura espera o dono
   * se repintar sem ela para ser destruída.
   */
  private emUso(e: Entrada): boolean {
    if (e.pedidos > 0) return true
    return this.aberta !== null && (this.aberta.pedidas.has(e) || this.aberta.coladas.has(e))
  }

  /**
   * Tira as mais antigas até caber no teto. Fica a que acabou de entrar
   * (`poupar`, mesmo sozinha acima dele), a que está sendo pintada e a que
   * está em uso; sai a pronta (ou a que nem começou e ninguém pede).
   */
  private podar(poupar: Entrada): void {
    if (this.bytesNoCache <= this.tetoDeBytes) return
    for (const e of [...this.cache.values()]) {
      if (this.bytesNoCache <= this.tetoDeBytes) return
      if (e === poupar || e.emPintura || this.emUso(e)) continue
      this.retirar(e)
    }
  }

  private retirar(e: Entrada): void {
    if (e.retirada) return
    e.retirada = true
    this.cache.delete(e.chave)
    this.bytesNoCache -= e.bytes
    if (e.emPintura) {
      e.emPintura = false
      this.bytesNoCache -= e.bytesDeTrabalho
    }
    if (e.colagens === 0) this.destruir(e)
  }

  private destruir(e: Entrada): void {
    if (e.destruida) return
    e.destruida = true
    this.destruidas += 1
    for (const l of e.ladrilhos) l.textura.destroy(true)
  }

  private agendarBomba(): void {
    if (this.bombaAgendada) return
    this.bombaAgendada = true
    this.agendar(() => this.bombear())
  }

  /** Ninguém quer mais: nenhum dono a pediu na última passada (e não foi pedida avulsa). */
  private abandonada(e: Entrada): boolean {
    return !e.avulsa && !this.emUso(e)
  }

  /**
   * Uma fatia: anda as imagens da fila, uma linha por vez, até passar de
   * `fatiaMs` (ao menos uma linha por fatia, para a fila sempre andar). Pula a
   * que saiu do cache e a que nenhum dono pediu na última passada; no fim
   * chama para se repintar os donos que pediram as que ficaram prontas.
   */
  private bombear(): void {
    this.bombaAgendada = false
    const inicio = this.agora()
    let primeira = true
    const aRepintar = new Set<Dono>()
    while (this.fila.length > 0) {
      if (!primeira && this.agora() - inicio >= this.fatiaMs) break
      primeira = false
      const entrada = this.fila[0]
      if (entrada.retirada || this.abandonada(entrada)) {
        this.fila.shift()
        if (!entrada.retirada) {
          this.puladas += 1
          this.retirar(entrada)
        }
        continue
      }
      if (!entrada.emPintura) {
        entrada.emPintura = true
        this.bytesNoCache += entrada.bytesDeTrabalho
      }
      let passo = entrada.passos.next()
      while (passo.done !== true && this.agora() - inicio < this.fatiaMs) passo = entrada.passos.next()
      if (passo.done !== true) break
      this.fila.shift()
      entrada.emPintura = false
      this.bytesNoCache -= entrada.bytesDeTrabalho
      entrada.pronta = true
      this.prontas += 1
      for (const l of entrada.ladrilhos) l.textura.source.update()
      for (const dono of this.donos.values()) if (dono.pedidas.has(entrada)) aRepintar.add(dono)
    }
    if (this.fila.length > 0) this.agendarBomba()
    for (const dono of aRepintar) dono.repintar()
  }
}

let padrao: RasterDosMoveis | null = null

/** O raster da sessão (criado na primeira imagem pedida). */
export function rasterDosMoveis(): RasterDosMoveis {
  padrao ??= new RasterDosMoveis()
  return padrao
}

/** Troca o raster da sessão num teste (fila controlada, teto pequeno); `null` volta ao padrão. */
export function trocarRasterNoTeste(raster: RasterDosMoveis | null): void {
  padrao = raster
}
