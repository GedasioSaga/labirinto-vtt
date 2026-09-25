import type { PinPass, Token } from '../types/map'
import { carriedItemsOf, cleanItemName } from './items'

/**
 * PASSAGEM POR PASSE (crachá, catraca) — regras puras, compartilhadas pelo
 * host (quem passa sem pedir), pelo disco (o que vale do arquivo) e pelo
 * painel do mestre. Sem DOM, sem store.
 */

/** Teto de fichas marcadas num pino: a mesa tem de 4 a 7 jogadores; arquivo editado à mão não incha o mapa. */
export const PIN_PASS_FICHAS_MAX = 64

/** Teto do id de ficha lido do disco: id do app é curto; texto enorme é lixo. */
const FICHA_ID_MAX_LENGTH = 128

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Chave de comparação do nome do item: "Crachá", "cracha" e " CRACHÁ " são o
 * mesmo passe. O mestre escreve o nome no pino e o item chega à mochila por
 * outro caminho ("Dar a…", pino pegável) — exigir a mesma grafia faria a
 * catraca recusar quem tem o crachá por causa de um acento.
 */
function itemKey(nome: string): string {
  return cleanItemName(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('pt-BR')
}

/** O item do passe, aparado; vazio = o passe não pede item. */
export function passItemOf(pass: PinPass | undefined): string {
  return pass?.item === undefined ? '' : cleanItemName(pass.item)
}

/** As fichas marcadas pelo mestre; ausente = nenhuma. */
export function passTokensOf(pass: PinPass | undefined): readonly string[] {
  return pass?.fichas ?? []
}

/**
 * A ficha tem o passe? Marcada pelo mestre (por id), ou com o item do passe
 * na mochila. Pino sem passe configurado não deixa ninguém passar sozinho: na
 * dúvida, o pedido vai ao mestre.
 */
export function tokenHasPass(pass: PinPass | undefined, token: Token): boolean {
  if (passTokensOf(pass).includes(token.id)) return true
  const item = passItemOf(pass)
  if (item === '') return false
  const alvo = itemKey(item)
  return carriedItemsOf(token).some((carregado) => itemKey(carregado.nome) === alvo)
}

/**
 * O passe montado a partir das duas partes, já limpo: item aparado, fichas
 * sem repetição nem vazio. Nada sobrando = `undefined` (sem gravar `{}`).
 */
export function buildPinPass(item: string, fichas: readonly string[]): PinPass | undefined {
  const nome = cleanItemName(item)
  const ids = [...new Set(fichas.filter((id) => id !== ''))].slice(0, PIN_PASS_FICHAS_MAX)
  if (nome === '' && ids.length === 0) return undefined
  const pass: PinPass = {}
  if (nome !== '') pass.item = nome
  if (ids.length > 0) pass.fichas = ids
  return pass
}

/** O passe com outro item, mantidas as fichas marcadas. */
export function withPassItem(pass: PinPass | undefined, item: string): PinPass | undefined {
  return buildPinPass(item, passTokensOf(pass))
}

/** O passe com a ficha `tokenId` marcada (`on`) ou desmarcada, mantido o item. */
export function withPassToken(pass: PinPass | undefined, tokenId: string, on: boolean): PinPass | undefined {
  const fichas = passTokensOf(pass).filter((id) => id !== tokenId)
  return buildPinPass(passItemOf(pass), on ? [...fichas, tokenId] : fichas)
}

/** Uma ficha que o mestre pode marcar como "tem passe", como o painel a mostra. */
export interface PassTokenOption {
  id: string
  nome: string
  marcada: boolean
}

/** Nome da ficha marcada que não está nesta cena (viajou): o mestre ainda pode desmarcá-la. */
export const PASS_TOKEN_ELSEWHERE_LABEL = 'Ficha em outra cena'

/**
 * As fichas do painel do passe: as desta cena menos os NPCs (não pedem
 * passagem), na ordem do mapa, e depois as marcadas que já saíram dela — sem
 * isso, a marca de quem viajou ficaria gravada sem ter onde tirar.
 */
export function passTokenOptions(tokens: readonly Token[], pass: PinPass | undefined): PassTokenOption[] {
  const marcadas = passTokensOf(pass)
  // NPC já marcado fica na lista: sem isso, a marca dele não teria onde sair.
  const daCena = tokens.filter((token) => token.npc !== true || marcadas.includes(token.id))
  const aqui = new Set(daCena.map((token) => token.id))
  return [
    ...daCena.map((token) => ({ id: token.id, nome: token.name.trim() === '' ? 'Ficha sem nome' : token.name, marcada: marcadas.includes(token.id) })),
    ...marcadas.filter((id) => !aqui.has(id)).map((id) => ({ id, nome: PASS_TOKEN_ELSEWHERE_LABEL, marcada: true })),
  ]
}

/**
 * `Pin.passe` como vem do disco. Forma errada (arquivo editado à mão, versão
 * futura) volta AUSENTE — ninguém tem passe, e o pedido vai ao mestre. Na
 * lista de fichas, só texto curto e não vazio fica.
 */
export function readPinPass(value: unknown): PinPass | undefined {
  if (!isRecord(value)) return undefined
  if (value.item !== undefined && typeof value.item !== 'string') return undefined
  if (value.fichas !== undefined && !Array.isArray(value.fichas)) return undefined
  const item = typeof value.item === 'string' ? value.item : ''
  const fichas = Array.isArray(value.fichas)
    ? value.fichas.filter((id): id is string => typeof id === 'string' && id.length <= FICHA_ID_MAX_LENGTH)
    : []
  return buildPinPass(item, fichas)
}

/** Mesmo passe? Ausente e vazio são o mesmo; a ordem das fichas não conta. */
export function samePinPass(a: PinPass | undefined, b: PinPass | undefined): boolean {
  if (passItemOf(a) !== passItemOf(b)) return false
  const deA = new Set(passTokensOf(a))
  const deB = new Set(passTokensOf(b))
  return deA.size === deB.size && [...deA].every((id) => deB.has(id))
}
