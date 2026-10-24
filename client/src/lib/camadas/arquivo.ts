/**
 * CAMADAS NO ARQUIVO (`map.json` e `adventure.json`). Todo campo é novo e
 * opcional: ausente continua ausente (o round-trip do mapa de antes não ganha
 * chave) e valor torto é DESCARTADO, nunca recusa o mapa. O modelo de
 * camadas mora na aventura; o mapa só guarda o estado da cena.
 */
import type { CamadaDef, CamadaId, MapData, ModeloDeCamadas, NaCamada } from '../../types/map'
import { CAMADAS_PADRAO, ID_LIVRE_DE_ANTES, ehCamadaId, ehCamadaPadrao } from './padrao'

/** 13 padrão + 51 livres = 64, o teto da lista que o jogador aceita (`MAX_CAMADAS_DO_JOGADOR`). */
export const MAX_CAMADAS_LIVRES = 51

/** Teto do nome de camada livre, em caracteres visíveis (o painel mostra uma linha). */
export const NOME_DE_CAMADA_MAX = 40
/**
 * Teto de pontos de código por caractere visível: um "caractere" com marcas
 * combinadas sem fim (zalgo) não estoura a linha nem o arquivo. A família de
 * emoji tem 5 pontos; a bandeira com etiquetas, 7.
 */
export const PONTOS_POR_CARACTERE_MAX = 10

/**
 * FNV-1a de 32 bits em duas sementes: 16 hexa estáveis para o id de antes. Não
 * é segredo nem criptografia: só dá ao id de antes um id do formato novo,
 * sempre o mesmo para o mesmo texto (os itens continuam na camada deles).
 */
function hexaDe(texto: string): string {
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < texto.length; i += 1) {
    const c = texto.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193) >>> 0
    b = Math.imul(b ^ c, 0x01000193) >>> 0
  }
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0')
}

/**
 * Id de camada lido do arquivo (fatia 7). Id de hoje fica igual. Id de camada
 * livre no formato de ANTES (`livre_Segredo_do_Lich`, arquivo editado à mão)
 * vira `livre_` + 16 hexa do próprio texto, igual em todo lugar do arquivo e da
 * aventura: o item continua na camada dele, a camada escondida continua
 * escondida (falha FECHADA) e o texto (que pode ser um nome) nunca chega ao
 * jogador. O resto é torto: `undefined`.
 */
export function idDeCamadaDoArquivo(valor: unknown): CamadaId | undefined {
  if (ehCamadaId(valor)) return valor
  if (typeof valor !== 'string' || !ID_LIVRE_DE_ANTES.test(valor)) return undefined
  return `livre_${hexaDe(valor)}`
}

/**
 * Teto de ids numa lista de camadas lida do arquivo (escondidas, travadas).
 * NÃO é o teto do jogador (64): a lista de escondidas pode ter, além das 64 do
 * modelo, ids de camada apagada noutra cena, que continuam escondidos (falha
 * FECHADA); cortar em 64 abriria o 65º. 1024 só segura arquivo de terceiros
 * com 100 mil ids (memória e tempo de abrir).
 */
export const MAX_IDS_NA_LISTA_DO_ARQUIVO = 1024

/**
 * Lista de ids de camada: o que não é id sai, repetido sai; o que não é lista
 * vira ausente. FALHA FECHADA: lista com itens em que nenhum id sobrou também
 * vira ausente — para `ocultasDoJogador`, ausente segue `hiddenLayers`, e uma
 * lista vazia diria "o jogador vê tudo". Lista vazia no arquivo continua vazia.
 * Repetido sai por `Set` (100 mil ids não travam a abertura) e o que passa de
 * `MAX_IDS_NA_LISTA_DO_ARQUIVO` não é lido.
 */
export function lerListaDeCamadas(valor: unknown): CamadaId[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista = idsDoArquivo(valor)
  return valor.length > 0 && lista.length === 0 ? undefined : lista
}

/** Os ids de camada de uma lista crua, sem repetir, na ordem, até o teto. */
export function idsDoArquivo(valor: readonly unknown[]): CamadaId[] {
  const vistos = new Set<CamadaId>()
  for (const item of valor) {
    const id = idDeCamadaDoArquivo(item)
    if (id !== undefined) vistos.add(id)
    if (vistos.size >= MAX_IDS_NA_LISTA_DO_ARQUIVO) break
  }
  return [...vistos]
}

/**
 * Controle (C0, DEL, C1), marcas de direção que viram o texto (ALM, LRM/RLM,
 * LRE…RLO, LRI…PDI), separadores de linha e de parágrafo, o BOM, e o que
 * desenha vazio: espaço de largura zero, word joiner e operadores invisíveis
 * (U+2060…2064), o preenchimento hangul (U+115F, U+1160, U+3164, U+FFA0), o
 * braille em branco (U+2800) e as etiquetas (U+E0000…E007F). Por faixa de
 * código: sem o caractere cru no fonte (ele é invisível e quebra o editor).
 */
const FAIXAS_INVISIVEIS: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x61c, 0x61c],
  [0x115f, 0x1160],
  [0x200b, 0x200b],
  [0x200d, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2060, 0x2064],
  [0x2066, 0x2069],
  [0x2800, 0x2800],
  [0x3164, 0x3164],
  [0xfeff, 0xfeff],
  [0xffa0, 0xffa0],
  [0xe0000, 0xe007f],
]

/** O ZWJ e as etiquetas FICAM dentro de uma sequência de emoji (família, bandeira da Escócia); fora dela, saem. */
const ehDaSequenciaDeEmoji = (c: number): boolean => c === 0x200d || (c >= 0xe0020 && c <= 0xe007f)
const EMOJI = /\p{Extended_Pictographic}/u
/** Algo que se vê: nem espaço, nem marca combinada sozinha, nem formato ou controle. */
const VISIVEL = /[^\p{White_Space}\p{M}\p{Cf}\p{Cc}]/u

function ehInvisivel(c: number): boolean {
  return FAIXAS_INVISIVEIS.some(([de, ate]) => c >= de && c <= ate)
}

/** Cada invisível vira espaço (que depois se junta), grafema a grafema: o ZWJ da família de emoji fica. */
function semInvisiveis(texto: string): string {
  let saida = ''
  for (const g of grafemas(texto)) {
    const emoji = EMOJI.test(g)
    for (const ch of g) {
      const c = ch.codePointAt(0) ?? 0
      saida += ehInvisivel(c) && !(emoji && ehDaSequenciaDeEmoji(c)) ? ' ' : ch
    }
  }
  return saida
}

const segmentador = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null

/** Os caracteres VISÍVEIS (grafemas): a família de emoji, a letra com acento combinado e o árabe ligado contam um cada. */
export function grafemas(texto: string): string[] {
  return segmentador === null ? Array.from(texto) : Array.from(segmentador.segment(texto), (s) => s.segment)
}

/**
 * Nome de camada saneado: sem controles, marcas de direção nem invisíveis (que
 * virariam o texto da linha e dos avisos), espaços em fila viram um, aparado,
 * no teto de 40 caracteres visíveis. O caractere com mais de
 * `PONTOS_POR_CARACTERE_MAX` pontos de código sai INTEIRO (cortar no meio
 * deixaria o nome terminando em ZWJ ou em tom de pele). Outro tipo, em branco
 * ou sem nenhum caractere que se veja = undefined (o painel recusa).
 */
export function lerNomeDeCamada(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const limpo = semInvisiveis(valor).split(/\s+/u).join(' ').trim()
  const nome = grafemas(limpo)
    .filter((g) => Array.from(g).length <= PONTOS_POR_CARACTERE_MAX)
    .slice(0, NOME_DE_CAMADA_MAX)
    .join('')
    .split(/\s+/u)
    .join(' ')
    .trim()
  return VISIVEL.test(nome) ? nome : undefined
}

/** Opacidade por camada: só número de 0 a 1 em chave de camada; o que não é objeto vira ausente. */
export function lerOpacidades(valor: unknown): Partial<Record<CamadaId, number>> | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return undefined
  const entradas: [string, unknown][] = Object.entries(valor)
  const opacidades: Partial<Record<CamadaId, number>> = {}
  for (const [chave, bruto] of entradas) {
    const id = idDeCamadaDoArquivo(chave)
    if (id !== undefined && typeof bruto === 'number' && Number.isFinite(bruto) && bruto >= 0 && bruto <= 1) opacidades[id] = bruto
  }
  return opacidades
}

/** Só a versão 2 existe; o resto é mapa de antes. */
export function lerVersaoDasCamadas(valor: unknown): 2 | undefined {
  return valor === 2 ? 2 : undefined
}

export function ocultasDoJogadorDoArquivo(valor: unknown): Pick<MapData, 'ocultasDoJogador'> {
  const ocultasDoJogador = lerListaDeCamadas(valor)
  return ocultasDoJogador === undefined ? {} : { ocultasDoJogador }
}

export function opacidadesDoArquivo(valor: unknown): Pick<MapData, 'opacidadeDasCamadas'> {
  const opacidadeDasCamadas = lerOpacidades(valor)
  return opacidadeDasCamadas === undefined ? {} : { opacidadeDasCamadas }
}

export function versaoDasCamadasDoArquivo(valor: unknown): Pick<MapData, 'versaoDasCamadas'> {
  const versaoDasCamadas = lerVersaoDasCamadas(valor)
  return versaoDasCamadas === undefined ? {} : { versaoDasCamadas }
}

/**
 * Entidade lida do disco: `camada` que não é id de camada perde a CHAVE (o
 * item volta à camada padrão do tipo e o valor cru não volta ao disco nem vai
 * ao jogador). Ausente ou id válido devolve o MESMO objeto: mapa de antes não
 * ganha chave nem muda a ordem das chaves.
 */
export function semCamadaTorta<T extends NaCamada>(item: T): T {
  if (!('camada' in item) || ehCamadaId(item.camada)) return item
  const copia = { ...item }
  const id = idDeCamadaDoArquivo(item.camada)
  if (id === undefined) delete copia.camada
  else copia.camada = id
  return copia
}

/** O campo `camada` de um objeto cru do arquivo: só id de camada entra (o de antes, trocado). */
export function camadaLida(valor: object): NaCamada {
  const camada = idDeCamadaDoArquivo('camada' in valor ? valor.camada : undefined)
  return camada === undefined ? {} : { camada }
}

/**
 * O modelo da aventura: entrada sem id válido ou repetida sai; `nome` só
 * texto, aparado e no teto. Camada livre com nome em branco (depois de
 * aparar) sai inteira; camada padrão fica, só sem o nome. Forma errada vira
 * ausente, e `ordem` com itens em que nenhuma entrada sobrou também.
 */
export function lerModeloDeCamadas(valor: unknown): ModeloDeCamadas | undefined {
  if (typeof valor !== 'object' || valor === null || !('ordem' in valor) || !Array.isArray(valor.ordem)) return undefined
  const ordem: CamadaDef[] = []
  const vistos = new Set<string>()
  let livres = 0
  let padrao = 0
  for (const item of valor.ordem) {
    // Teto do modelo (13 + 51 = 64, o que o jogador aceita): arquivo de terceiros com 100 mil entradas não trava a abertura.
    if (livres >= MAX_CAMADAS_LIVRES && padrao >= CAMADAS_PADRAO.length) break
    if (typeof item !== 'object' || item === null || !('id' in item)) continue
    const id = idDeCamadaDoArquivo(item.id)
    if (id === undefined || vistos.has(id) || (!ehCamadaPadrao(id) && livres >= MAX_CAMADAS_LIVRES)) continue
    const cru: unknown = 'nome' in item ? item.nome : undefined
    const nome = lerNomeDeCamada(cru)
    if (nome === undefined && typeof cru === 'string' && !ehCamadaPadrao(id)) continue
    vistos.add(id)
    if (ehCamadaPadrao(id)) padrao += 1
    else livres += 1
    ordem.push(nome === undefined ? { id } : { id, nome })
  }
  return valor.ordem.length > 0 && ordem.length === 0 ? undefined : { ordem }
}
