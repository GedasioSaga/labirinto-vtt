import type { AlvoDoBalde, MapData, PinceladaDeTextura, RegionPoint, TexturaImportada } from '../types/map'
import { caminhosParaJogador, passoDoRisco, tracosSeTocam } from './penhasco'

/**
 * TEXTURAS (fatia 4 do plano do relevo de 09/10/2026): a ferramenta em que o
 * mestre pinta uma textura da biblioteca (areia, floresta, neve...) por cima
 * da parte do mapa que quiser — sobre regiões e desenhos, debaixo da luz do
 * relevo. Não é a ferramenta Chão: não cria piso, só pinta por cima.
 *
 * O mapa guarda os PASSOS (`MapData.texturas`), não a imagem: pincelada,
 * balde e borracha, na ordem. Cada tela pinta de novo a partir deles
 * (`pixi/texturasRaster.ts`), com a mesma conta, e o jogador recebe só os
 * passos junto do que conhece (`texturasParaJogador`). Pelo mesmo motivo do
 * penhasco (`lib/penhasco.ts`): um mapa de continente tem dezenas de milhares
 * de px de mundo, e a pintura inteira como imagem não caberia no arquivo nem
 * na rede; o passo é um caminho de poucos pontos.
 *
 * Folha de propósito (só tipos e o penhasco, que também é folha): o
 * `fogFilter` importa daqui. Quem precisa da geometria das formas (o balde)
 * usa `lib/baldeDeTextura.ts`, que conversa com o relevo.
 */

/** O que o PRÓXIMO gesto da ferramenta faz (preferência da ferramenta, fora do map.json). */
export type ModoDaTextura = 'pincel' | 'balde' | 'borracha'

/**
 * Tamanho do pincel: o DIÂMETRO em px do protótipo do relevo
 * (`LADO_DO_PROTOTIPO`), como o pincel de penhasco — cresce com o mapa, e o
 * mesmo número cobre a mesma fração do continente em qualquer mapa.
 */
export const TAMANHO_DO_PINCEL_MIN = 6
export const TAMANHO_DO_PINCEL_MAX = 160
export const TAMANHO_DO_PINCEL_PADRAO = 32

/**
 * Força: o quanto a pincelada cobre o que veio antes. O padrão não é 100% de
 * propósito: um tanto da cor do desenho de baixo ainda tinge a textura, e ela
 * não "estoura" por cima da pintura do mestre.
 */
export const FORCA_MIN = 0.1
export const FORCA_MAX = 1
export const FORCA_PADRAO = 0.8

/** Raio do pincel em px de mundo (`unidade` = px de mundo por px do protótipo, `unidadeDoRelevo`). */
export function raioDoPincelDeTextura(unidade: number, tamanho: number): number {
  return (limitar(tamanho, TAMANHO_DO_PINCEL_MIN, TAMANHO_DO_PINCEL_MAX) * unidade) / 2
}

/** Passo mínimo entre dois pontos da pincelada: o mesmo do penhasco (um quarto do raio). */
export function passoDaPincelada(raio: number): number {
  return passoDoRisco(raio)
}

export function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor))
}

/** O que o soltar do gesto fez, para a tela dizer quando não fez nada. */
export type ResultadoDaTextura =
  | 'pintou'
  /** Borracha onde não há textura nenhuma. */
  | 'nada-a-apagar'
  /** Balde fora de região e de desenho pintado (no mar, fora da terra). */
  | 'fora-de-forma'
  /** Balde com a mesma textura e força do último balde nesta forma: nada muda. */
  | 'igual'
  /** A textura escolhida não existe nesta cena (importada de outra cena ou desfeita, pacote que saiu): nada gravado. */
  | 'textura-ausente'

// ---------------------------------------------------------------------------
// Ids

/** Prefixo do id de textura importada. O dois-pontos não cabe no id do pacote nem da biblioteca. */
export const PREFIXO_IMPORTADA = 'importada:'

const ID_DA_BIBLIOTECA = /^[a-z0-9-]{1,40}$/
const ID_IMPORTADO = /^importada:[a-z0-9-]{1,40}$/

/** Id que uma textura pode ter: da biblioteca/pacote (`a-z0-9-`) ou importada (`importada:...`). */
export function ehIdDeTextura(valor: unknown): valor is string {
  return typeof valor === 'string' && (ID_DA_BIBLIOTECA.test(valor) || ID_IMPORTADO.test(valor))
}

export function ehIdImportado(id: string): boolean {
  return id.startsWith(PREFIXO_IMPORTADA)
}

// ---------------------------------------------------------------------------
// Leitura do disco (o arquivo não é confiável: map.json editado à mão, versão futura)

function lerPonto(valor: unknown): RegionPoint | null {
  if (typeof valor !== 'object' || valor === null || !('x' in valor) || !('y' in valor)) return null
  const { x, y } = valor
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null
  return { x, y }
}

function lerPontos(valor: unknown): RegionPoint[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null
  const lidos: RegionPoint[] = []
  for (const item of valor) {
    const ponto = lerPonto(item)
    // Um ponto quebrado mudaria o desenho da pincelada inteira: ela sai toda.
    if (ponto === null) return null
    lidos.push(ponto)
  }
  return lidos
}

function lerForca(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor > 0 ? Math.min(FORCA_MAX, valor) : null
}

function lerAlvo(valor: unknown): AlvoDoBalde | null {
  if (typeof valor !== 'object' || valor === null || !('tipo' in valor) || !('id' in valor)) return null
  const { tipo, id } = valor
  if ((tipo !== 'regiao' && tipo !== 'desenho') || typeof id !== 'string' || id === '') return null
  return { tipo, id }
}

function lerPincelada(valor: unknown): PinceladaDeTextura | null {
  if (typeof valor !== 'object' || valor === null || !('id' in valor) || !('tipo' in valor)) return null
  const { id, tipo } = valor
  if (typeof id !== 'string' || id === '') return null
  const forca = lerForca('forca' in valor ? valor.forca : undefined)
  if (forca === null) return null
  if (tipo === 'balde') {
    const textura = 'textura' in valor ? valor.textura : undefined
    const alvo = lerAlvo('alvo' in valor ? valor.alvo : undefined)
    if (!ehIdDeTextura(textura) || alvo === null) return null
    return { id, tipo, textura, forca, alvo }
  }
  if (tipo !== 'pincel' && tipo !== 'borracha') return null
  const raio = 'raio' in valor ? valor.raio : undefined
  const pontos = lerPontos('pontos' in valor ? valor.pontos : undefined)
  if (typeof raio !== 'number' || !Number.isFinite(raio) || raio <= 0 || pontos === null) return null
  if (tipo === 'borracha') return { id, tipo, forca, raio, pontos }
  const textura = 'textura' in valor ? valor.textura : undefined
  if (!ehIdDeTextura(textura)) return null
  return { id, tipo, textura, forca, raio, pontos }
}

/** Os passos do arquivo, ou `undefined` (sem o campo). Passo quebrado sai; o resto fica na ordem. */
export function lerTexturas(valor: unknown): PinceladaDeTextura[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: PinceladaDeTextura[] = []
  for (const item of valor) {
    const pincelada = lerPincelada(item)
    if (pincelada !== null) lista.push(pincelada)
  }
  return lista.length > 0 ? lista : undefined
}

/** Nome de textura: o que aparece debaixo da miniatura. */
export const NOME_DE_TEXTURA_MAX = 40

/** Ladrilho importado embutido: só imagem em base64, nunca caminho de disco nem endereço de fora. */
const IMAGEM_EMBUTIDA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/

/**
 * Teto do ladrilho importado, em caracteres. O ladrilho sai com no máximo
 * `LADO_DA_IMPORTADA` px em WebP (~30 a 90 KB); o teto só barra o que veio
 * editado à mão, e o mapa salvo não cresce sem limite.
 */
export const IMAGEM_IMPORTADA_MAX_CHARS = 400_000

export function ehImagemDeTexturaImportada(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length <= IMAGEM_IMPORTADA_MAX_CHARS && IMAGEM_EMBUTIDA.test(valor)
}

/** As texturas importadas do arquivo, ou `undefined`. A quebrada (sem imagem embutida válida) sai. */
export function lerTexturasImportadas(valor: unknown): TexturaImportada[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: TexturaImportada[] = []
  const vistos = new Set<string>()
  for (const item of valor) {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('nome' in item) || !('imagem' in item)) continue
    const { id, nome, imagem } = item
    if (typeof id !== 'string' || !ID_IMPORTADO.test(id) || vistos.has(id)) continue
    if (typeof nome !== 'string' || !ehImagemDeTexturaImportada(imagem)) continue
    vistos.add(id)
    lista.push({ id, nome: nomeDaTextura(nome), imagem })
  }
  return lista.length > 0 ? lista : undefined
}

/** O nome limpo: espaços nas pontas fora, até `NOME_DE_TEXTURA_MAX`; vazio vira "Textura". */
export function nomeDaTextura(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DE_TEXTURA_MAX)
  return limpo === '' ? 'Textura' : limpo
}

// ---------------------------------------------------------------------------
// O mapa

/** O mapa com estes passos. Lista vazia tira o campo (o mapa volta a ser o de antes das texturas). */
export function comTexturas(map: MapData, lista: readonly PinceladaDeTextura[]): MapData {
  if (lista.length > 0) return { ...map, texturas: [...lista] }
  if (map.texturas === undefined) return map
  const { texturas: _semTexturas, ...resto } = map
  return resto
}

/** O mapa com estas texturas importadas. Lista vazia tira o campo. */
export function comTexturasImportadas(map: MapData, lista: readonly TexturaImportada[]): MapData {
  if (lista.length > 0) return { ...map, texturasImportadas: [...lista] }
  if (map.texturasImportadas === undefined) return map
  const { texturasImportadas: _semImportadas, ...resto } = map
  return resto
}

/** Retângulo de mundo. */
export interface Caixa {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function caixaDoCaminho(pontos: readonly RegionPoint[], raio: number): Caixa {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { minX: minX - raio, minY: minY - raio, maxX: maxX + raio, maxY: maxY + raio }
}

export function caixasSeTocam(a: Caixa, b: Caixa): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY
}

/**
 * Soma um passo à lista. A borracha que não passa por textura nenhuma pintada
 * antes dela não vira passo (nem passo vazio no desfazer) e devolve o motivo.
 * `caixaDoAlvo` diz onde fica a forma de um balde (`lib/baldeDeTextura.ts`);
 * sem ela, todo balde conta como debaixo da borracha.
 */
export function somarPincelada(
  lista: readonly PinceladaDeTextura[],
  pincelada: PinceladaDeTextura,
  caixaDoAlvo?: (alvo: AlvoDoBalde) => Caixa | null,
): { lista: readonly PinceladaDeTextura[]; resultado: ResultadoDaTextura } {
  if (pincelada.tipo === 'borracha') {
    const caixa = caixaDoCaminho(pincelada.pontos, pincelada.raio)
    const temDebaixo = lista.some((item) => {
      if (item.tipo === 'pincel') return tracosSeTocam(item, pincelada)
      if (item.tipo === 'balde') {
        const caixaDoBalde = caixaDoAlvo === undefined ? undefined : caixaDoAlvo(item.alvo)
        return caixaDoBalde === undefined || (caixaDoBalde !== null && caixasSeTocam(caixaDoBalde, caixa))
      }
      return false
    })
    if (!temDebaixo) return { lista, resultado: 'nada-a-apagar' }
  }
  if (pincelada.tipo === 'balde') {
    // O mesmo balde de novo na mesma forma não muda nada (o último já cobriu igual).
    const ultimoNaForma = [...lista].reverse().find((item) => item.tipo === 'balde' && item.alvo.tipo === pincelada.alvo.tipo && item.alvo.id === pincelada.alvo.id)
    const ultimo = lista[lista.length - 1]
    if (ultimoNaForma !== undefined && ultimoNaForma === ultimo && ultimo.tipo === 'balde' && ultimo.textura === pincelada.textura && ultimo.forca === pincelada.forca) {
      return { lista, resultado: 'igual' }
    }
  }
  return { lista: [...lista, pincelada], resultado: 'pintou' }
}

/** Os ids de textura que os passos usam (pincel e balde). */
export function texturasUsadas(lista: readonly PinceladaDeTextura[] | undefined): Set<string> {
  const usadas = new Set<string>()
  for (const item of lista ?? []) if (item.tipo !== 'borracha') usadas.add(item.textura)
  return usadas
}

/** Tira uma textura importada e os passos que a pintavam (o que ela cobria volta a aparecer). */
export function semTexturaImportada(map: MapData, id: string): MapData {
  const importadas = map.texturasImportadas ?? []
  if (!importadas.some((t) => t.id === id)) return map
  const passos = (map.texturas ?? []).filter((item) => item.tipo === 'borracha' || item.textura !== id)
  return comTexturas(comTexturasImportadas(map, importadas.filter((t) => t.id !== id)), soComTinta(passos))
}

/** Borracha no começo da lista não tira nada de ninguém: sai. */
function soComTinta<T extends PinceladaDeTextura>(lista: readonly T[]): T[] {
  const primeira = lista.findIndex((item) => item.tipo !== 'borracha')
  return primeira < 0 ? [] : lista.slice(primeira)
}

// ---------------------------------------------------------------------------
// Jogador

/**
 * Os passos que vão ao jogador:
 * - pincel e borracha: só os pedaços cujo disco encosta no que ele conhece
 *   (`caminhosParaJogador`, o mesmo corte do penhasco). O resto do caminho do
 *   mestre não sai: diria onde ele pintou floresta na névoa;
 * - balde: só se a forma que ele enche chegou no recorte (`formaNoRecorte`).
 *   A forma já está com ele; o balde não diz nada que ela não diga.
 * A tela dele ainda guarda a textura sob a máscara do conhecido. Borracha no
 * começo (sem tinta antes dela no que sobrou) sai.
 */
export function texturasParaJogador(
  lista: readonly PinceladaDeTextura[] | undefined,
  conhece: (p: RegionPoint) => boolean,
  escondido: (p: RegionPoint) => boolean,
  formaNoRecorte: (alvo: AlvoDoBalde) => boolean,
): PinceladaDeTextura[] | undefined {
  if (lista === undefined || lista.length === 0) return undefined
  const saida: PinceladaDeTextura[] = []
  for (const item of lista) {
    if (item.tipo === 'balde') {
      if (formaNoRecorte(item.alvo)) saida.push(item)
      continue
    }
    saida.push(...caminhosParaJogador([item], conhece, escondido))
  }
  const comTinta = soComTinta(saida)
  return comTinta.length > 0 ? comTinta : undefined
}

/** O nome que a importada leva para fora do editor (recorte do jogador, imagem exportada). */
const NOME_DA_IMPORTADA_NO_RECORTE = 'Textura'

/** As texturas importadas que os passos do jogador usam, sem o nome do mestre; as outras ficam com ele. */
export function importadasParaJogador(
  importadas: readonly TexturaImportada[] | undefined,
  passos: readonly PinceladaDeTextura[] | undefined,
): TexturaImportada[] | undefined {
  if (importadas === undefined || passos === undefined) return undefined
  const usadas = texturasUsadas(passos)
  // O nome sai do nome do arquivo do mestre ("lava-covil-do-dragao.png"): o
  // jogador só precisa do id e da imagem para pintar, então vai um nome neutro.
  const vao = importadas.filter((t) => usadas.has(t.id)).map((t) => ({ id: t.id, nome: NOME_DA_IMPORTADA_NO_RECORTE, imagem: t.imagem }))
  return vao.length > 0 ? vao : undefined
}

/** Assinatura do que os passos pintam: a pintura só é refeita quando ela muda. */
export function assinaturaDasTexturas(lista: readonly PinceladaDeTextura[] | undefined): string {
  if (lista === undefined) return ''
  return lista
    .map((item) =>
      item.tipo === 'balde'
        ? `${item.id}:b:${item.textura}:${item.forca}:${item.alvo.tipo}:${item.alvo.id}`
        : `${item.id}:${item.tipo === 'pincel' ? `p:${item.textura}` : 'e'}:${item.forca}:${item.raio}:${item.pontos.map((p) => `${p.x},${p.y}`).join(' ')}`,
    )
    .join('|')
}
