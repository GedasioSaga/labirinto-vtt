import type { Matriz } from '../../carimbos/arte'
import { abrirFonteDoDesenhado } from './fonte'

/**
 * OS CARIMBOS DO DESENHADO (plano de 29/10/2026, F2b; CONTRATO.md seção 9):
 * a leitura do `textura.json` de um carimbo do pacote, a conta da forma pelo
 * giro, a silhueta da sombra que o app faz e o carregador das imagens.
 *
 * - **A imagem nunca gira** (9.1, item 2): o giro do mestre escolhe a forma,
 *   k = `varianteDoGiro(giro)`, arquivo = k mod N, espelho diagonal (a imagem
 *   transposta) quando floor(k / N) é ímpar; com `espelho: "nenhum"` (o desenho
 *   em pé, o tronco embaixo) nunca espelha.
 * - **A sombra é do app** (9.1, item 3): a silhueta do mesmo desenho, deitada
 *   no chão a partir do pé (`em-pe`) ou andada (`deslocada`), desfocada e
 *   opaca na cor da sombra; a transparência entra uma vez, na camada inteira
 *   (`pixi/drawCarimbos.ts`), como no Atual.
 * - **Âncora no pé de hoje** (9.1, item 4): o pé (Carimbo.x, y) cai em
 *   `ancoraPx`, e 1 unidade = `Carimbo.tamanho`.
 * - **Carregador:** só o que a cena pede, pela `FonteDoDesenhado`. Enquanto não
 *   chega (ou se falhar, ou não couber no teto), o carimbo sai no Atual; quando
 *   chega, os ouvintes (`assinarCarimbosDesenhados`) repintam. Nada vai para a
 *   placa aqui: cada palco faz as texturas dele das imagens daqui e as solta.
 *
 * O carregador do chão (`carregador.ts`) é outro, de propósito: o chão guarda
 * `ImageData` para a conta em CPU; o carimbo guarda a imagem pronta para a placa.
 */

/** Os 12 carimbos da onda 3 que saem na ferramenta Carimbos (o vaso, a sebe e a jardineira são móveis: F3). */
export const CARIMBOS_DO_DESENHADO = [
  'arvore', 'arvore-redonda', 'pinheiro', 'pinheiro-nevado', 'arbusto', 'palmeira',
  'juncos', 'pedras', 'poca', 'girassol', 'girassois', 'tronco-caido',
] as const

export type IdDoCarimboDesenhado = (typeof CARIMBOS_DO_DESENHADO)[number]

const IDS: ReadonlySet<string> = new Set(CARIMBOS_DO_DESENHADO)

/** O `Carimbo.tipo` tem desenho no Desenhado? (O id do app é o id do pacote nos 12.) */
export function ehCarimboDesenhado(tipo: string): tipo is IdDoCarimboDesenhado {
  return IDS.has(tipo)
}

const MEBIBYTE = 1024 * 1024
/** Teto na placa por carimbo (CONTRATO 9.7): o que o Atual pesa hoje, 8 x 256² RGBA com mipmap. */
export const TETO_POR_CARIMBO = Math.floor((8 * 256 * 256 * 4 * 4) / 3)
/** Teto das imagens decodificadas de UM mapa: os 12 cabem juntos (cada um abaixo do teto dele). */
export const TETO_DOS_CARIMBOS_POR_MAPA = CARIMBOS_DO_DESENHADO.length * TETO_POR_CARIMBO
/** A transparência da camada de sombras do Desenhado (CONTRATO 9.1, item 3: `#0a1c28` a 0,25). */
export const ALFA_DA_SOMBRA_DESENHADA = 0.25
/** Resolução da silhueta, em texels por unidade: a sombra é macia (borrão de 3% do tamanho). */
export const TEXELS_DA_SILHUETA_POR_UNIDADE = 64

export type EspelhoDoCarimbo = 'diagonal' | 'nenhum'

export type SombraDoCarimboDesenhado =
  | { jeito: 'nenhuma' }
  | { jeito: 'deslocada'; direcao: { x: number; y: number }; deslocamento: number; borrao: number; cor: string }
  | { jeito: 'em-pe'; direcao: { x: number; y: number }; comprimento: number; borrao: number; cor: string }

export interface TexturaDoCarimbo {
  id: IdDoCarimboDesenhado
  variacoes: number
  espelho: EspelhoDoCarimbo
  /** `carimbo-1.png` .. `carimbo-N.png`, na ordem das formas. */
  arquivos: readonly string[]
  ladoPx: number
  /** Px da imagem numa unidade (`Carimbo.tamanho`). */
  unidadePx: number
  /** O pé, em px da imagem. */
  ancoraPx: readonly [number, number]
  sombra: SombraDoCarimboDesenhado
  corMedia: string
}

// ---------- leitura do textura.json (dado de fora: confere cada campo) ----------
// As mesmas quatro leituras de `chao.ts` (privadas lá; aquele arquivo é do chão).

function campo(o: unknown, k: string): unknown {
  return typeof o === 'object' && o !== null && k in o ? Reflect.get(o, k) : undefined
}

function numero(o: unknown, k: string): number | null {
  const v = campo(o, k)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function texto(o: unknown, k: string): string | null {
  const v = campo(o, k)
  return typeof v === 'string' ? v : null
}

function numeros(o: unknown, k: string): number[] | null {
  const v = campo(o, k)
  if (!Array.isArray(v)) return null
  const lista: number[] = []
  for (const x of v) {
    if (typeof x !== 'number' || !Number.isFinite(x)) return null
    lista.push(x)
  }
  return lista
}

function textos(o: unknown, k: string): string[] | null {
  const v = campo(o, k)
  if (!Array.isArray(v)) return null
  const lista: string[] = []
  for (const x of v) {
    if (typeof x !== 'string') return null
    lista.push(x)
  }
  return lista
}

const COR_HEX = /^#[0-9a-f]{6}$/i

function dentro(v: number | null, min: number, max: number): v is number {
  return v !== null && v >= min && v <= max
}

function lerSombra(bruto: unknown): SombraDoCarimboDesenhado | null {
  const jeito = texto(bruto, 'jeito')
  if (jeito === 'nenhuma') return { jeito }
  const direcao = numeros(bruto, 'direcao')
  const borrao = numero(bruto, 'borrao')
  const cor = texto(bruto, 'cor')
  if (direcao === null || direcao.length !== 2 || !dentro(borrao, 0, 0.2) || cor === null || !COR_HEX.test(cor)) return null
  const n = Math.hypot(direcao[0], direcao[1])
  if (!(n > 0)) return null
  const dir = { x: direcao[0] / n, y: direcao[1] / n }
  if (jeito === 'deslocada') {
    const deslocamento = numero(bruto, 'deslocamento')
    return dentro(deslocamento, 0, 0.5) ? { jeito, direcao: dir, deslocamento, borrao, cor } : null
  }
  if (jeito === 'em-pe') {
    const comprimento = numero(bruto, 'comprimento')
    return dentro(comprimento, 0.2, 1.2) ? { jeito, direcao: dir, comprimento, borrao, cor } : null
  }
  return null
}

/** Bytes na placa das N imagens com mipmap (CONTRATO 9.7: `variacoes x ladoPx² x 4 x 4/3`). */
export function bytesNaPlaca(t: Pick<TexturaDoCarimbo, 'variacoes' | 'ladoPx'>): number {
  return Math.ceil((t.variacoes * t.ladoPx * t.ladoPx * 4 * 4) / 3)
}

/** O `textura.json` de um carimbo do pacote, conferido; `null` = não serve (o carimbo fica no Atual). */
export function lerTexturaDoCarimbo(bruto: unknown): TexturaDoCarimbo | null {
  const id = texto(bruto, 'idDoApp')
  const corMedia = texto(bruto, 'corMedia')
  if (id === null || !ehCarimboDesenhado(id) || corMedia === null) return null
  if (numero(bruto, 'contrato') !== 1 || texto(bruto, 'tipo') !== 'carimbo' || texto(bruto, 'destino') !== 'carimbo') return null
  const formas = campo(bruto, 'formas')
  const variacoes = numero(formas, 'variacoes')
  const espelhoBruto = campo(formas, 'espelho')
  // Sem o campo, o padrão do contrato (9.2): diagonal.
  const espelho: EspelhoDoCarimbo | null = espelhoBruto === undefined || espelhoBruto === 'diagonal' ? 'diagonal' : espelhoBruto === 'nenhum' ? 'nenhum' : null
  const sprite = campo(bruto, 'sprite')
  const arquivos = textos(sprite, 'arquivos')
  const ladoPx = numero(sprite, 'ladoPx')
  const unidadePx = numero(sprite, 'unidadePx')
  const ancora = numeros(sprite, 'ancoraPx')
  const sombra = lerSombra(campo(bruto, 'sombra'))
  if (variacoes === null || !Number.isInteger(variacoes) || variacoes < 1 || variacoes > 4 || espelho === null) return null
  if (arquivos === null || arquivos.length !== variacoes || !dentro(ladoPx, 32, 512) || !dentro(unidadePx, 16, 512)) return null
  if (ancora === null || ancora.length !== 2 || sombra === null) return null
  if (bytesNaPlaca({ variacoes, ladoPx }) > TETO_POR_CARIMBO) return null
  return { id, variacoes, espelho, arquivos, ladoPx, unidadePx, ancoraPx: [ancora[0], ancora[1]], sombra, corMedia }
}

// ---------- a conta (CONTRATO 9.4) ----------

export interface FormaDoCarimbo {
  /** Índice do arquivo (0 = `carimbo-1.png`). */
  arquivo: number
  /** A imagem transposta, (u, v) -> (v, u): o meio dela fica onde está. */
  espelho: boolean
}

/** A forma k (0..7, `varianteDoGiro`): o arquivo e o espelho diagonal (com `nenhum`, só o arquivo). */
export function formaDoGiro(k: number, variacoes: number, espelho: EspelhoDoCarimbo): FormaDoCarimbo {
  return { arquivo: k % variacoes, espelho: espelho === 'diagonal' && Math.floor(k / variacoes) % 2 === 1 }
}

/** O quadro do corpo em unidades a partir do pé (o molde `QuadroDaArte` do Atual): a imagem inteira, o pé na âncora. */
export function quadroDoCorpo(t: TexturaDoCarimbo): { esquerda: number; topo: number; lado: number } {
  return { esquerda: -t.ancoraPx[0] / t.unidadePx, topo: -t.ancoraPx[1] / t.unidadePx, lado: t.ladoPx / t.unidadePx }
}

/**
 * Para onde vai o px (u, v) da imagem, em unidades a partir do pé (matriz do
 * Canvas: x' = a·u + c·v + e). Sem espelho (u - ancora.x, v - ancora.y) /
 * unidadePx; com espelho (v - ancora.x, u - ancora.y) / unidadePx.
 */
export function matrizDoCorpo(t: Pick<TexturaDoCarimbo, 'unidadePx' | 'ancoraPx'>, espelho: boolean): Matriz {
  const s = 1 / t.unidadePx
  const [ax, ay] = t.ancoraPx
  return espelho ? [0, s, s, 0, -s * ax, -s * ay] : [s, 0, 0, s, -s * ax, -s * ay]
}

/**
 * A silhueta no chão, na mesma transformação do corpo (CONTRATO 9.4):
 * `deslocada` anda `deslocamento` unidades na direção; `em-pe` deita o
 * desenho a partir do pé (o ponto a altura h acima do pé cai h·comprimento na
 * direção), a `matrizDaSombra('em-pe')` de hoje. `null` = objeto do chão.
 */
export function matrizDaSombraDesenhada(t: TexturaDoCarimbo, espelho: boolean): Matriz | null {
  const r = matrizDoCorpo(t, espelho)
  const sombra = t.sombra
  if (sombra.jeito === 'nenhuma') return null
  const { x: dx, y: dy } = sombra.direcao
  if (sombra.jeito === 'deslocada') return [r[0], r[1], r[2], r[3], r[4] + dx * sombra.deslocamento, r[5] + dy * sombra.deslocamento]
  const l = sombra.comprimento
  const [a, b, c, d, e, f] = r
  return [a - l * dx * b, -l * dy * b, c - l * dx * d, -l * dy * d, e - l * dx * f, -l * dy * f]
}

/** A silhueta pronta: opaca na cor da sombra, e o quadro dela em unidades a partir do pé. */
export interface SilhuetaDesenhada {
  tela: HTMLCanvasElement
  quadro: { esquerda: number; topo: number; largura: number; altura: number }
}

/**
 * Assa a silhueta de uma forma: a imagem na matriz da sombra, desfocada
 * `borrao` unidades (o desvio do `blur()` do Canvas), pintada na cor. O quadro
 * é a caixa da imagem transformada mais o alcance do borrão.
 */
export function assarSilhueta(imagem: CanvasImageSource, t: TexturaDoCarimbo, espelho: boolean, texelsPorUnidade: number = TEXELS_DA_SILHUETA_POR_UNIDADE): SilhuetaDesenhada | null {
  const m = matrizDaSombraDesenhada(t, espelho)
  const sombra = t.sombra
  if (m === null || sombra.jeito === 'nenhuma' || typeof document === 'undefined') return null
  const L = t.ladoPx
  const xs: number[] = []
  const ys: number[] = []
  for (const [u, v] of [[0, 0], [L, 0], [0, L], [L, L]]) {
    xs.push(m[0] * u + m[2] * v + m[4])
    ys.push(m[1] * u + m[3] * v + m[5])
  }
  // 3 desvios do borrão de cada lado: o que o blur espalha fica dentro.
  const folga = 3 * sombra.borrao + 1 / texelsPorUnidade
  const x0 = Math.min(...xs) - folga
  const y0 = Math.min(...ys) - folga
  const k = texelsPorUnidade
  const largura = Math.max(1, Math.ceil((Math.max(...xs) + folga - x0) * k))
  const altura = Math.max(1, Math.ceil((Math.max(...ys) + folga - y0) * k))
  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura
  const g = tela.getContext('2d')
  if (g === null) return null
  g.imageSmoothingEnabled = true
  g.imageSmoothingQuality = 'high'
  // Sem `filter` (Safari antigo) a sombra sai com a borda firme, e só (como no Atual).
  if ('filter' in g && sombra.borrao > 0) g.filter = `blur(${(sombra.borrao * k).toFixed(2)}px)`
  g.setTransform(k * m[0], k * m[1], k * m[2], k * m[3], k * (m[4] - x0), k * (m[5] - y0))
  g.drawImage(imagem, 0, 0)
  g.setTransform(1, 0, 0, 1, 0, 0)
  if ('filter' in g) g.filter = 'none'
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = sombra.cor
  g.fillRect(0, 0, largura, altura)
  return { tela, quadro: { esquerda: x0, topo: y0, largura: largura / k, altura: altura / k } }
}

// ---------- o carregador ----------

/** Um carimbo do pacote, com as imagens decodificadas (prontas para virar textura em cada palco). */
export interface CarimboCarregado {
  readonly id: IdDoCarimboDesenhado
  readonly textura: TexturaDoCarimbo
  /** Uma por arquivo, na ordem de `textura.arquivos`. */
  readonly imagens: readonly HTMLImageElement[]
  /** Memória comum das imagens decodificadas (RGBA). */
  readonly bytes: number
}

type Estado =
  | { readonly tipo: 'carregando'; readonly bytes: number }
  | { readonly tipo: 'pronto'; readonly carimbo: CarimboCarregado }
  | { readonly tipo: 'falhou' }
  | { readonly tipo: 'recusado' }

interface Entrada {
  estado: Estado
  /** A última cena que pediu este id (as de outra cena saem para dar lugar). */
  cena: string
}

const entradas = new Map<IdDoCarimboDesenhado, Entrada>()
const ouvintes = new Set<() => void>()
/** As silhuetas já assadas de cada carimbo carregado, por forma (`arquivo` e `t` do espelho). */
const silhuetas = new WeakMap<CarimboCarregado, Map<string, SilhuetaDesenhada | null>>()
let cenaAtual = ''

function bytesDe(e: Entrada): number {
  if (e.estado.tipo === 'pronto') {
    const c = e.estado.carimbo
    let soma = c.bytes
    for (const s of silhuetas.get(c)?.values() ?? []) if (s !== null) soma += s.tela.width * s.tela.height * 4
    return soma
  }
  return e.estado.tipo === 'carregando' ? e.estado.bytes : 0
}

/** Memória comum dos carimbos do Desenhado agora (imagens + silhuetas; o portão da integração mede este número). */
export function bytesDosCarimbosDesenhados(): number {
  let soma = 0
  for (const e of entradas.values()) soma += bytesDe(e)
  return soma
}

/** Avisado quando um carimbo fica pronto (quem pintou o Atual no lugar dele repinta). */
export function assinarCarimbosDesenhados(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

function avisar(): void {
  for (const o of [...ouvintes]) o()
}

/** Abre espaço para `bytes` soltando os carimbos de outras cenas; `false` = nem assim cabe neste mapa. */
function abrirEspaco(bytes: number): boolean {
  let total = bytesDosCarimbosDesenhados()
  if (total + bytes <= TETO_DOS_CARIMBOS_POR_MAPA) return true
  for (const [id, e] of [...entradas]) {
    if (total + bytes <= TETO_DOS_CARIMBOS_POR_MAPA) break
    if (e.cena === cenaAtual || e.estado.tipo === 'carregando') continue
    total -= bytesDe(e)
    entradas.delete(id)
  }
  return total + bytes <= TETO_DOS_CARIMBOS_POR_MAPA
}

/** Um PNG da fonte, decodificado e no tamanho que o `textura.json` diz; `null` = não serve. */
async function abrirImagem(url: string, lado: number): Promise<HTMLImageElement | null> {
  const imagem = new Image()
  imagem.decoding = 'async'
  imagem.src = url
  try {
    await imagem.decode()
  } catch {
    return null
  }
  return imagem.naturalWidth === lado && imagem.naturalHeight === lado ? imagem : null
}

async function carregar(id: IdDoCarimboDesenhado, entrada: Entrada): Promise<void> {
  try {
    const fonte = await abrirFonteDoDesenhado()
    const textura = lerTexturaDoCarimbo(await fonte.textura(id))
    if (textura === null) {
      entrada.estado = { tipo: 'falhou' }
      console.warn(`[desenhado] o textura.json de '${id}' não serve; fica o Atual`)
      return
    }
    if (entradas.get(id) !== entrada) return
    const bytes = textura.variacoes * textura.ladoPx * textura.ladoPx * 4
    // Reserva antes de baixar: dois pedidos ao mesmo tempo não passam juntos do teto.
    if (!abrirEspaco(bytes)) {
      entrada.estado = { tipo: 'recusado' }
      console.warn(`[desenhado] '${id}' não cabe no teto de ${Math.round(TETO_DOS_CARIMBOS_POR_MAPA / MEBIBYTE)} MiB dos carimbos deste mapa; fica o Atual`)
      return
    }
    entrada.estado = { tipo: 'carregando', bytes }
    const urls = textura.arquivos.map((arquivo) => fonte.urlDe(id, arquivo))
    const imagens = await Promise.all(urls.map((u) => (u === undefined ? Promise.resolve(null) : abrirImagem(u, textura.ladoPx))))
    const prontas: HTMLImageElement[] = []
    for (const img of imagens) if (img !== null) prontas.push(img)
    if (prontas.length !== textura.variacoes) {
      entrada.estado = { tipo: 'falhou' }
      console.warn(`[desenhado] as imagens de '${id}' não abriram; fica o Atual`)
      return
    }
    // Saiu do mapa enquanto baixava (outra cena precisou do espaço): não volta.
    if (entradas.get(id) !== entrada) return
    entrada.estado = { tipo: 'pronto', carimbo: { id, textura, imagens: prontas, bytes } }
    avisar()
  } catch (erro: unknown) {
    entrada.estado = { tipo: 'falhou' }
    console.warn(`[desenhado] '${id}' não carregou; fica o Atual`, erro)
  }
}

/**
 * O carimbo `id` para a cena `cena` (o `MapData.id`), se já está pronto; senão
 * começa a carregar (se couber no teto deste mapa) e devolve `null`: quem
 * pediu pinta o Atual e repinta no aviso de `assinarCarimbosDesenhados`.
 */
export function pedirCarimboDesenhado(id: IdDoCarimboDesenhado, cena: string): CarimboCarregado | null {
  cenaAtual = cena
  const existente = entradas.get(id)
  if (existente !== undefined) {
    const mudouDeCena = existente.cena !== cena
    existente.cena = cena
    if (existente.estado.tipo === 'pronto') return existente.estado.carimbo
    // Falhou ou não coube noutra cena: este mapa tenta de novo.
    if (!mudouDeCena || existente.estado.tipo === 'carregando') return null
  }
  const entrada: Entrada = { estado: { tipo: 'carregando', bytes: 0 }, cena }
  entradas.set(id, entrada)
  void carregar(id, entrada)
  return null
}

/** A silhueta da forma (assada uma vez por carimbo carregado); `null` = objeto do chão, ou a tela não abriu. */
export function silhuetaDaForma(c: CarimboCarregado, forma: FormaDoCarimbo): SilhuetaDesenhada | null {
  let porForma = silhuetas.get(c)
  if (porForma === undefined) {
    porForma = new Map()
    silhuetas.set(c, porForma)
  }
  const chave = `${forma.arquivo}${forma.espelho ? 't' : ''}`
  const pronta = porForma.get(chave)
  if (pronta !== undefined) return pronta
  const imagem = c.imagens.at(forma.arquivo)
  const feita = imagem === undefined ? null : assarSilhueta(imagem, c.textura, forma.espelho)
  porForma.set(chave, feita)
  return feita
}
