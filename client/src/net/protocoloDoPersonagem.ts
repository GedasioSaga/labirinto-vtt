import { personagemDoArquivo, type CampoExtra, type CartaoDaFicha, type Modificador, type Personagem } from '../lib/personagem'
import { idValido, lerSistemaDeRpg, type SistemaDeRpg } from '../lib/sistemaDeRpg'
import { fitsTokenPhotoSend } from '../lib/tokenPhoto'

/**
 * FICHA DE PERSONAGEM NA MESA (entrega 2 dos sistemas de RPG): as mensagens com
 * que o JOGADOR lê, cria e edita a ficha DELE, e a validação de fronteira de
 * cada uma. Vocabulário: aqui "personagem" é a ficha de personagem; "ficha",
 * no resto do código, é o TOKEN no mapa (`TokenDoPersonagem.tokenId`).
 *
 * Do jogador para o host (teto de `PLAYER_MESSAGE_MAX_BYTES`, 64 KiB, ou o
 * servidor derruba o jogador):
 *  - `personagem.criar`: personagem novo do sistema da aventura, ligado a uma
 *    ficha dele que ainda não tem personagem;
 *  - `personagem.editar`: só as PARTES que mudaram, e cartão sem imagem — a
 *    ficha inteira com retrato e imagens de cartão não caberia;
 *  - `personagem.imagem`: uma imagem por mensagem (o retrato ou a de um
 *    cartão), no mesmo teto da foto do token (`fitsTokenPhotoSend`).
 *
 * Do host para o jogador (sem teto de tamanho no servidor, mas nada se repete
 * à toa): `rpg.sistema` (a definição do sistema, uma vez por conexão e quando
 * muda), `personagens` (os dele, quando algum muda) e `personagem.resultado`
 * (a resposta a cada pedido, pelo `reqId`).
 *
 * Este módulo não importa `protocol.ts`, que importa daqui: o ciclo entre os
 * dois deixaria um deles meio carregado conforme a ordem de import.
 */

/** Mesmo teto de `REQ_ID_MAX_LENGTH` (protocol.ts): ids de pedido e de ficha (token). */
const REQ_ID_MAX = 64
/** Id de personagem e de cartão: o do app tem 41 caracteres (`pers_<uuid>`); o importado do projeto-rpg-v2 pode ser outro. */
export const PERSONAGEM_ID_MAX = 128
/** Nome do personagem: o que aparece no alto da ficha e na lista do mestre. */
export const PERSONAGEM_NOME_MAX = 80
/** Descrição do personagem e texto de cada campo de cartão. */
export const PERSONAGEM_TEXTO_MAX = 8000
/** Nome de cartão, de campo extra, valor de escolha (Raça) e etiqueta. */
export const PERSONAGEM_ROTULO_MAX = 120
export const PERSONAGEM_ETIQUETAS_MAX = 20
/** Chaves de cada registro (atributos, recursos, escolhas, abas, campos do cartão) e atributos de uma perícia. */
export const PERSONAGEM_CHAVES_MAX = 64
/** Cartões por aba, e subcartões por cartão. */
export const PERSONAGEM_CARTOES_MAX = 100
export const PERSONAGEM_EXTRAS_MAX = 30
export const PERSONAGEM_MODIFICADORES_MAX = 30

/**
 * Cartão como viaja do jogador: sem a imagem, que vai sozinha em
 * `personagem.imagem`. O host devolve a imagem que o cartão de mesmo id já
 * tinha — cartão novo nasce sem.
 */
export interface CartaoSemImagem {
  id: string
  nome: string
  campos: Record<string, string>
  extras: CampoExtra[]
  atributos: string[]
  modificadores: Modificador[]
  subcartoes: CartaoSemImagem[]
}

/**
 * As partes da ficha que a edição troca. Parte ausente = não mexe. Registro
 * (`escolhas`, `recursos`, `atributos`, `abas`) troca CHAVE A CHAVE: a chave
 * que não veio fica como estava — o mestre mudou a Força enquanto o jogador
 * escrevia a descrição, e o Salvar do jogador não desfaz a Força. Sem `tipo`
 * (Jogador/NPC é do mestre) e sem `retrato` (vai em `personagem.imagem`).
 */
export interface PartesDoPersonagem {
  nome?: string
  descricao?: string
  etiquetas?: string[]
  escolhas?: Record<string, string>
  recursos?: Record<string, number>
  atributos?: Record<string, number>
  abas?: Record<string, CartaoSemImagem[]>
}

export interface PersonagemCriarMessage {
  type: 'personagem.criar'
  reqId: string
  /** A ficha (token) dele que ganha o personagem. */
  tokenId: string
}

export interface PersonagemEditarMessage {
  type: 'personagem.editar'
  reqId: string
  personagemId: string
  partes: PartesDoPersonagem
}

export interface PersonagemImagemMessage {
  type: 'personagem.imagem'
  reqId: string
  personagemId: string
  /** Ausente = o retrato; presente = a imagem do cartão com esse id (em qualquer aba, subcartão incluso). */
  cartaoId?: string
  /** `null` tira a imagem. */
  imagem: string | null
}

export type PersonagemPlayerMessage = PersonagemCriarMessage | PersonagemEditarMessage | PersonagemImagemMessage

/** Uma ficha (token) do jogador e o personagem dela; `null` = ainda sem personagem (o "Criar minha ficha" a oferece). */
export interface TokenDoPersonagem {
  tokenId: string
  nome: string
  personagemId: string | null
}

/**
 * Os personagens DESTE jogador e as fichas dele. Substitui tudo o que a tela
 * tinha. Só sai quando algo mudou para ele: o retrato não viaja a cada recorte.
 */
export interface PersonagensMessage {
  type: 'personagens'
  personagens: Personagem[]
  tokens: TokenDoPersonagem[]
}

/** O sistema de RPG da aventura, por valor (o embutido também): `null` = sem sistema escolhido, ou ele não está na biblioteca do mestre. */
export interface SistemaDeRpgMessage {
  type: 'rpg.sistema'
  sistema: SistemaDeRpg | null
}

/** A resposta a `personagem.criar`/`editar`/`imagem`. `personagemId`: o personagem que nasceu (só no criar aceito). */
export interface PersonagemResultadoMessage {
  type: 'personagem.resultado'
  reqId: string
  ok: boolean
  personagemId?: string
}

export type PersonagemHostMessage = PersonagensMessage | SistemaDeRpgMessage | PersonagemResultadoMessage

// ───────────────────────────────────────────────────────────────────────────
// Validação do que o jogador manda: toda forma torta recusa a mensagem inteira
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function textoEntre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.length >= min && value.length <= max
}

function inteiro(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

/**
 * Registro chave → valor: chave no formato dos ids do sistema (`idValido`:
 * sem `__proto__`, sem `..`), no máximo `PERSONAGEM_CHAVES_MAX` chaves, cada
 * valor aceito por `ler`. Qualquer chave ou valor torto recusa o registro.
 */
function registro<T>(value: unknown, ler: (valor: unknown) => T | null): Record<string, T> | null {
  if (!isRecord(value)) return null
  const pares = Object.entries(value)
  if (pares.length > PERSONAGEM_CHAVES_MAX) return null
  const lido: Record<string, T> = {}
  for (const [chave, bruto] of pares) {
    if (!idValido(chave)) return null
    const valor = ler(bruto)
    if (valor === null) return null
    lido[chave] = valor
  }
  return lido
}

/** Lista de no máximo `max` itens, cada um aceito por `ler`. */
function lista<T>(value: unknown, max: number, ler: (valor: unknown) => T | null): T[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  const lidos: T[] = []
  for (const bruto of value) {
    const item = ler(bruto)
    if (item === null) return null
    lidos.push(item)
  }
  return lidos
}

const textoDeCampo = (value: unknown): string | null => (textoEntre(value, 0, PERSONAGEM_TEXTO_MAX) ? value : null)
const rotulo = (value: unknown): string | null => (textoEntre(value, 0, PERSONAGEM_ROTULO_MAX) ? value : null)
const etiqueta = (value: unknown): string | null => (textoEntre(value, 1, PERSONAGEM_ROTULO_MAX) ? value : null)
const idDeAtributo = (value: unknown): string | null => (idValido(value) ? value : null)

function extra(value: unknown): CampoExtra | null {
  if (!isRecord(value)) return null
  const nome = rotulo(value.nome)
  const valor = textoDeCampo(value.valor)
  return nome === null || valor === null ? null : { nome, valor }
}

function modificador(value: unknown): Modificador | null {
  if (!isRecord(value) || !idValido(value.atributo)) return null
  const delta = inteiro(value.delta)
  return delta === null ? null : { atributo: value.atributo, delta }
}

/**
 * Um cartão. `nivel` 1 é o cartão da aba; 2, o subcartão (a técnica dentro da
 * transformação), que não tem subcartão próprio — a tela não desenha um
 * terceiro nível, e a recursão sem fundo seria a porta de uma mensagem que
 * explode a pilha do host. Cartão com `imagem` é recusado: ela vai sozinha.
 */
function cartao(value: unknown, nivel: 1 | 2): CartaoSemImagem | null {
  if (!isRecord(value) || value.imagem !== undefined) return null
  if (!textoEntre(value.id, 1, PERSONAGEM_ID_MAX)) return null
  const nome = rotulo(value.nome)
  const campos = registro(value.campos, textoDeCampo)
  const extras = lista(value.extras, PERSONAGEM_EXTRAS_MAX, extra)
  const atributos = lista(value.atributos, PERSONAGEM_CHAVES_MAX, idDeAtributo)
  const modificadores = lista(value.modificadores, PERSONAGEM_MODIFICADORES_MAX, modificador)
  const subcartoes = lista<CartaoSemImagem>(value.subcartoes, nivel === 1 ? PERSONAGEM_CARTOES_MAX : 0, (sub) => cartao(sub, 2))
  if (nome === null || campos === null || extras === null || atributos === null || modificadores === null || subcartoes === null) return null
  return { id: value.id, nome, campos, extras, atributos, modificadores, subcartoes }
}

/** Os ids de cartão de uma lista, subcartões juntos. */
function idsDosCartoes(cartoes: readonly CartaoSemImagem[]): string[] {
  return cartoes.flatMap((c) => [c.id, ...idsDosCartoes(c.subcartoes)])
}

/** Os cartões de uma aba, sem id repetido: a imagem do cartão é achada pelo id, e dois iguais trocariam de imagem. */
function cartoesDaAba(value: unknown): CartaoSemImagem[] | null {
  const cartoes = lista(value, PERSONAGEM_CARTOES_MAX, (bruto) => cartao(bruto, 1))
  if (cartoes === null) return null
  const ids = idsDosCartoes(cartoes)
  return new Set(ids).size === ids.length ? cartoes : null
}

/** As partes da edição. Nenhuma parte = nada a fazer: recusada, como o `token.edit` que não muda nada. */
export function parsePartesDoPersonagem(value: unknown): PartesDoPersonagem | null {
  if (!isRecord(value)) return null
  const partes: PartesDoPersonagem = {}
  const { nome, descricao, etiquetas, escolhas, recursos, atributos, abas } = value
  if (nome !== undefined) {
    if (!textoEntre(nome, 0, PERSONAGEM_NOME_MAX)) return null
    partes.nome = nome
  }
  if (descricao !== undefined) {
    if (!textoEntre(descricao, 0, PERSONAGEM_TEXTO_MAX)) return null
    partes.descricao = descricao
  }
  if (etiquetas !== undefined) {
    const lidas = lista(etiquetas, PERSONAGEM_ETIQUETAS_MAX, etiqueta)
    if (lidas === null) return null
    partes.etiquetas = lidas
  }
  if (escolhas !== undefined) {
    const lidas = registro(escolhas, rotulo)
    if (lidas === null) return null
    partes.escolhas = lidas
  }
  if (recursos !== undefined) {
    const lidos = registro(recursos, inteiro)
    if (lidos === null) return null
    partes.recursos = lidos
  }
  if (atributos !== undefined) {
    const lidos = registro(atributos, inteiro)
    if (lidos === null) return null
    partes.atributos = lidos
  }
  if (abas !== undefined) {
    const lidas = registro(abas, cartoesDaAba)
    if (lidas === null) return null
    partes.abas = lidas
  }
  return Object.keys(partes).length === 0 ? null : partes
}

export function parsePersonagemCriar(obj: Record<string, unknown>): PersonagemCriarMessage | null {
  const { reqId, tokenId } = obj
  if (!textoEntre(reqId, 1, REQ_ID_MAX) || !textoEntre(tokenId, 1, REQ_ID_MAX)) return null
  return { type: 'personagem.criar', reqId, tokenId }
}

export function parsePersonagemEditar(obj: Record<string, unknown>): PersonagemEditarMessage | null {
  const { reqId, personagemId } = obj
  if (!textoEntre(reqId, 1, REQ_ID_MAX) || !textoEntre(personagemId, 1, PERSONAGEM_ID_MAX)) return null
  const partes = parsePartesDoPersonagem(obj.partes)
  return partes === null ? null : { type: 'personagem.editar', reqId, personagemId, partes }
}

/**
 * Fronteira de segurança da imagem: só a referência auto-contida E no teto de
 * envio (`fitsTokenPhotoSend`, 48 mil caracteres) — caminho de disco,
 * `http://` e `javascript:` não casam com o padrão, e a mensagem inteira cai.
 */
export function parsePersonagemImagem(obj: Record<string, unknown>): PersonagemImagemMessage | null {
  const { reqId, personagemId, cartaoId, imagem } = obj
  if (!textoEntre(reqId, 1, REQ_ID_MAX) || !textoEntre(personagemId, 1, PERSONAGEM_ID_MAX)) return null
  if (imagem !== null && !fitsTokenPhotoSend(imagem)) return null
  if (cartaoId === undefined) return { type: 'personagem.imagem', reqId, personagemId, imagem }
  if (!textoEntre(cartaoId, 1, PERSONAGEM_ID_MAX)) return null
  return { type: 'personagem.imagem', reqId, personagemId, cartaoId, imagem }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura do que o host manda (no jogador): tolerante como a do disco
// ───────────────────────────────────────────────────────────────────────────

function tokenDoPersonagem(value: unknown): TokenDoPersonagem | null {
  if (!isRecord(value) || typeof value.tokenId !== 'string' || typeof value.nome !== 'string') return null
  const { personagemId } = value
  if (personagemId !== null && typeof personagemId !== 'string') return null
  return { tokenId: value.tokenId, nome: value.nome, personagemId }
}

/** `personagens`: o personagem torto sai (o leitor do `adventure.json`); a lista que não é lista recusa a mensagem. */
export function parsePersonagensMessage(value: unknown): PersonagensMessage | null {
  if (!isRecord(value) || value.type !== 'personagens') return null
  if (!Array.isArray(value.personagens) || !Array.isArray(value.tokens)) return null
  const personagens = value.personagens.map(personagemDoArquivo).filter((p): p is Personagem => p !== null)
  const tokens = value.tokens.map(tokenDoPersonagem).filter((t): t is TokenDoPersonagem => t !== null)
  return { type: 'personagens', personagens, tokens }
}

/** `rpg.sistema`: o sistema passa pelo mesmo leitor do arquivo importado; o que ele recusa vira "sem sistema". */
export function parseSistemaDeRpgMessage(value: unknown): SistemaDeRpgMessage | null {
  if (!isRecord(value) || value.type !== 'rpg.sistema') return null
  if (value.sistema === null) return { type: 'rpg.sistema', sistema: null }
  const lido = lerSistemaDeRpg(value.sistema)
  return { type: 'rpg.sistema', sistema: lido.ok ? lido.sistema : null }
}

export function parsePersonagemResultado(value: unknown): PersonagemResultadoMessage | null {
  if (!isRecord(value) || value.type !== 'personagem.resultado') return null
  const { reqId, ok, personagemId } = value
  if (typeof reqId !== 'string' || typeof ok !== 'boolean') return null
  return typeof personagemId === 'string' ? { type: 'personagem.resultado', reqId, ok, personagemId } : { type: 'personagem.resultado', reqId, ok }
}

/** O cartão como o jogador o manda: sem a imagem, com os subcartões também sem. */
export function cartaoSemImagem(cartao: CartaoDaFicha): CartaoSemImagem {
  return {
    id: cartao.id,
    nome: cartao.nome,
    campos: cartao.campos,
    extras: cartao.extras,
    atributos: cartao.atributos,
    modificadores: cartao.modificadores,
    subcartoes: cartao.subcartoes.map(cartaoSemImagem),
  }
}
