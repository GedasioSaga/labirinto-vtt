import { isTokenPhotoData } from './tokenPhoto'
import type { AbaDoSistema, SistemaDeRpg } from './sistemaDeRpg'

/**
 * PERSONAGEM e a FICHA DE PERSONAGEM dele — não confundir com "ficha", que
 * neste código é o TOKEN no mapa. O personagem mora na AVENTURA
 * (`Adventure.personagens`, lib/adventure.ts), não na cena: ele cruza cenas,
 * e o token que o representa num mapa aponta para ele por `Token.characterId`.
 *
 * A forma é genérica: números e textos guardados pela CHAVE que o sistema de
 * RPG define (`lib/sistemaDeRpg.ts`). Trocar o sistema da aventura não apaga
 * nada — o que o sistema novo não conhece só deixa de aparecer.
 *
 * Só do mestre: a aventura nunca vai pela rede, e o recorte do jogador
 * (`lib/fogFilter.ts`, `tokenForPlayer`) zera o `characterId` do token. A
 * entrega 2 (jogador vê e edita a ficha dele) decide o que sai daqui.
 */

export type TipoDePersonagem = 'jogador' | 'npc'

/** Linha livre "nome: valor" do cartão (os campos extras da técnica). */
export interface CampoExtra {
  nome: string
  valor: string
}

/** Pontos que um cartão soma ou tira de um atributo (a transformação). */
export interface Modificador {
  atributo: string
  delta: number
}

/**
 * Um cartão de uma aba. Todas as partes existem sempre, vazias quando a aba
 * não as usa: a ficha guarda o que vier e o molde da aba (`AbaDoSistema`)
 * decide o que aparece. Assim a tela nunca precisa perguntar "tem o campo?".
 */
export interface CartaoDaFicha {
  id: string
  nome: string
  /** Valor de cada campo da aba, pela chave do campo (`CampoDoCartao.id`). */
  campos: Record<string, string>
  extras: CampoExtra[]
  /** Ids de atributos do sistema (a perícia). */
  atributos: string[]
  /** Imagem pequena embutida (`data:image/...`), como a foto do token. */
  imagem: string | null
  modificadores: Modificador[]
  /** Cartões de outra aba dentro deste (técnicas da transformação). */
  subcartoes: CartaoDaFicha[]
}

export interface Personagem {
  id: string
  tipo: TipoDePersonagem
  nome: string
  /** Uma linha (ou um parágrafo) sob o nome na ficha. */
  descricao: string
  /**
   * Retrato pequeno embutido (`data:image/...;base64,...`), reduzido pelo
   * mesmo caminho da foto do token (`buildTokenPhotoData`: até 256 px e 48 mil
   * caracteres). A entrega 4 troca isto por mídia servida por id.
   */
  retrato: string | null
  /** Valor de cada lista do sistema (Raça, Ofício), pela chave da lista. */
  escolhas: Record<string, string>
  etiquetas: string[]
  recursos: Record<string, number>
  atributos: Record<string, number>
  /** Cartões de cada aba, pela chave da aba. */
  abas: Record<string, CartaoDaFicha[]>
}

export const PERSONAGEM_SEM_NOME = 'Personagem sem nome'
export const CARTAO_SEM_NOME = 'Sem nome'

export function novoIdDePersonagem(): string {
  return `pers_${crypto.randomUUID()}`
}

export function novoIdDeCartao(): string {
  return `cart_${crypto.randomUUID()}`
}

/** Cartão vazio, já com o nome da aba ("Habilidade"), pronto para editar. */
export function novoCartao(nome: string): CartaoDaFicha {
  return { id: novoIdDeCartao(), nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/**
 * Personagem novo do sistema: todo recurso e atributo em 0 (a ficha mostra o
 * número, nunca um buraco), toda aba vazia.
 */
export function novoPersonagem(sistema: SistemaDeRpg, tipo: TipoDePersonagem, nome: string): Personagem {
  return {
    id: novoIdDePersonagem(),
    tipo,
    nome: nome.trim() || PERSONAGEM_SEM_NOME,
    descricao: '',
    retrato: null,
    escolhas: {},
    etiquetas: [],
    recursos: Object.fromEntries(sistema.recursos.map((recurso) => [recurso.id, 0])),
    atributos: Object.fromEntries(sistema.atributos.map((atributo) => [atributo.id, 0])),
    abas: Object.fromEntries(sistema.abas.map((aba) => [aba.id, []])),
  }
}

/** Os cartões da aba no personagem; aba que ele ainda não tem é lista vazia. */
export function cartoesDaAba(personagem: Personagem, abaId: string): CartaoDaFicha[] {
  return personagem.abas[abaId] ?? []
}

/** Valor do número na ficha; chave que o personagem não tem (sistema trocado, ficha antiga) vale 0. */
export function numeroDaFicha(valores: Record<string, number>, id: string): number {
  return valores[id] ?? 0
}

/**
 * Os campos do cartão que aparecem, na ordem da aba: os fixos com valor e
 * depois os extras com valor. Campo sem valor não entra — é a regra do
 * projeto-rpg-v2 (CamposTecnica.tsx): a lista mostra o que foi escrito.
 */
export function camposVisiveis(aba: AbaDoSistema, cartao: CartaoDaFicha, forma: 'linha' | 'destaque'): { rotulo: string; valor: string }[] {
  const fixos = aba.campos
    .filter((campo) => campo.forma === forma)
    .map((campo) => ({ rotulo: campo.rotulo, valor: (cartao.campos[campo.id] ?? '').trim() }))
  const extras = forma === 'linha' && aba.extras === true ? cartao.extras.map((extra) => ({ rotulo: extra.nome.trim(), valor: extra.valor.trim() })) : []
  return [...fixos, ...extras].filter((campo) => campo.valor.length > 0)
}

/** Texto corrido do cartão: os campos `paragrafo` com valor, na ordem da aba. */
export function paragrafosDoCartao(aba: AbaDoSistema, cartao: CartaoDaFicha): string[] {
  return aba.campos
    .filter((campo) => campo.forma === 'paragrafo')
    .map((campo) => (cartao.campos[campo.id] ?? '').trim())
    .filter((valor) => valor.length > 0)
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura tolerante (adventure.json)
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function textoDe(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function textos(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((par): par is [string, string] => typeof par[1] === 'string'))
}

function numeros(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((par): par is [string, number] => typeof par[1] === 'number' && Number.isFinite(par[1])))
}

function listaDeTextos(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function extraDoArquivo(value: unknown): CampoExtra | null {
  if (!isRecord(value)) return null
  return { nome: textoDe(value.nome), valor: textoDe(value.valor) }
}

function modificadorDoArquivo(value: unknown): Modificador | null {
  if (!isRecord(value) || typeof value.atributo !== 'string') return null
  if (typeof value.delta !== 'number' || !Number.isFinite(value.delta)) return null
  return { atributo: value.atributo, delta: value.delta }
}

/** Imagem só na forma auto-contida da foto do token: caminho de disco ou URL cai para `null`. */
function imagemDoArquivo(value: unknown): string | null {
  return isTokenPhotoData(value) ? value : null
}

function semNulos<T>(itens: (T | null)[]): T[] {
  return itens.filter((item): item is T => item !== null)
}

function cartaoDoArquivo(value: unknown): CartaoDaFicha | null {
  if (!isRecord(value)) return null
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : novoIdDeCartao(),
    nome: textoDe(value.nome) || CARTAO_SEM_NOME,
    campos: textos(value.campos),
    extras: semNulos((Array.isArray(value.extras) ? value.extras : []).map(extraDoArquivo)),
    atributos: listaDeTextos(value.atributos),
    imagem: imagemDoArquivo(value.imagem),
    modificadores: semNulos((Array.isArray(value.modificadores) ? value.modificadores : []).map(modificadorDoArquivo)),
    subcartoes: semNulos((Array.isArray(value.subcartoes) ? value.subcartoes : []).map(cartaoDoArquivo)),
  }
}

function abasDoArquivo(value: unknown): Record<string, CartaoDaFicha[]> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((par): par is [string, unknown[]] => Array.isArray(par[1]))
      .map(([abaId, cartoes]) => [abaId, semNulos(cartoes.map(cartaoDoArquivo))]),
  )
}

/**
 * Um personagem do `adventure.json`. Sem `id` ele sai (o token que apontava
 * para ele não teria como achar a cópia de id novo); o resto é tolerante:
 * nome vazio vira "Personagem sem nome", tipo desconhecido vira NPC (não
 * promove ninguém a jogador por engano), retrato que não é imagem embutida sai.
 */
export function personagemDoArquivo(value: unknown): Personagem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null
  return {
    id: value.id,
    tipo: value.tipo === 'jogador' ? 'jogador' : 'npc',
    nome: textoDe(value.nome).trim() || PERSONAGEM_SEM_NOME,
    descricao: textoDe(value.descricao),
    retrato: imagemDoArquivo(value.retrato),
    escolhas: textos(value.escolhas),
    etiquetas: listaDeTextos(value.etiquetas),
    recursos: numeros(value.recursos),
    atributos: numeros(value.atributos),
    abas: abasDoArquivo(value.abas),
  }
}

/**
 * `Adventure.personagens` como veio do disco. Ausente (aventura antiga) ou
 * que não é lista = `undefined`: a aventura abre sem a chave e grava sem ela.
 * Id repetido (arquivo editado à mão): o primeiro vence.
 */
export function personagensDoArquivo(value: unknown): Personagem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const vistos = new Set<string>()
  const lidos: Personagem[] = []
  for (const bruto of value) {
    const personagem = personagemDoArquivo(bruto)
    if (personagem === null || vistos.has(personagem.id)) continue
    vistos.add(personagem.id)
    lidos.push(personagem)
  }
  return lidos
}

/** `Adventure.sistemaDeRpg`: só texto não vazio; o resto é "aventura sem sistema". */
export function sistemaDaAventuraDoArquivo(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}
