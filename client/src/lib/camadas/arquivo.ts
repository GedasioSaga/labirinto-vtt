/**
 * CAMADAS NO ARQUIVO (`map.json` e `adventure.json`). Todo campo é novo e
 * opcional: ausente continua ausente (o round-trip do mapa de antes não ganha
 * chave) e valor torto é DESCARTADO, nunca recusa o mapa. O modelo de
 * camadas mora na aventura; o mapa só guarda o estado da cena.
 */
import type { CamadaDef, CamadaId, MapData, ModeloDeCamadas, NaCamada } from '../../types/map'
import { ID_LIVRE_DE_ANTES, ehCamadaId, ehCamadaPadrao } from './padrao'

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
 * Lista de ids de camada: o que não é id sai, repetido sai; o que não é lista
 * vira ausente. FALHA FECHADA: lista com itens em que nenhum id sobrou também
 * vira ausente — para `ocultasDoJogador`, ausente segue `hiddenLayers`, e uma
 * lista vazia diria "o jogador vê tudo". Lista vazia no arquivo continua vazia.
 */
export function lerListaDeCamadas(valor: unknown): CamadaId[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista: CamadaId[] = []
  for (const item of valor) {
    const id = idDeCamadaDoArquivo(item)
    if (id !== undefined && !lista.includes(id)) lista.push(id)
  }
  return valor.length > 0 && lista.length === 0 ? undefined : lista
}

/**
 * Controle (C0, DEL, C1), marcas de direção que viram o texto (ALM, LRM/RLM,
 * LRE…RLO, LRI…PDI), separadores de linha e de parágrafo e o BOM, por faixa de
 * código (sem o caractere cru no fonte: ele é invisível e quebra o editor).
 */
const FAIXAS_INVISIVEIS: readonly (readonly [number, number])[] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x61c, 0x61c],
  [0x200e, 0x200f],
  [0x2028, 0x2029],
  [0x202a, 0x202e],
  [0x2066, 0x2069],
  [0xfeff, 0xfeff],
]

function semInvisiveis(texto: string): string {
  let saida = ''
  for (const ch of texto) {
    const c = ch.codePointAt(0) ?? 0
    saida += FAIXAS_INVISIVEIS.some(([de, ate]) => c >= de && c <= ate) ? ' ' : ch
  }
  return saida
}

const segmentador = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('pt-BR', { granularity: 'grapheme' }) : null

/** Os caracteres VISÍVEIS (grafemas): a família de emoji, a letra com acento combinado e o árabe ligado contam um cada. */
function grafemas(texto: string): string[] {
  return segmentador === null ? Array.from(texto) : Array.from(segmentador.segment(texto), (s) => s.segment)
}

/**
 * Nome de camada saneado: sem controles nem marcas de direção (que virariam o
 * texto da linha e dos avisos), espaços em fila viram um, aparado, no teto de
 * 40 caracteres visíveis sem partir emoji ou letra combinada, e no teto de
 * unidades. Outro tipo ou em branco = undefined.
 */
export function lerNomeDeCamada(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined
  const limpo = semInvisiveis(valor).split(/\s+/u).join(' ').trim()
  const nome = grafemas(limpo)
    .slice(0, NOME_DE_CAMADA_MAX)
    .map((g) => Array.from(g).slice(0, PONTOS_POR_CARACTERE_MAX).join(''))
    .join('')
    .trimEnd()
  return nome === '' ? undefined : nome
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
  for (const item of valor.ordem) {
    if (typeof item !== 'object' || item === null || !('id' in item)) continue
    const id = idDeCamadaDoArquivo(item.id)
    if (id === undefined || vistos.has(id)) continue
    const cru: unknown = 'nome' in item ? item.nome : undefined
    const nome = lerNomeDeCamada(cru)
    if (nome === undefined && typeof cru === 'string' && !ehCamadaPadrao(id)) continue
    vistos.add(id)
    ordem.push(nome === undefined ? { id } : { id, nome })
  }
  return valor.ordem.length > 0 && ordem.length === 0 ? undefined : { ordem }
}
