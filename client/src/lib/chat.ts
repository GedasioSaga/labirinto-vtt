/**
 * CHAT DOS JOGADORES (fatia A: texto e @). Dois canais: a cena em que está a
 * ficha do jogador e o Global da mesa inteira. Tetos e regras valendo para o
 * host (`net/hostSession.ts`), o protocolo (`net/protocol.ts`) e a tela do
 * jogador (`player/PlayerChat.tsx`). Plano: `docs/plano-chat.md`.
 */

/** Onde a mensagem é dita. O jogador nunca sabe qual cena é: só "a cena". */
export type ChatChannel = 'cena' | 'global'

/** Na ordem em que a tela oferece. */
export const CHAT_CHANNELS: readonly ChatChannel[] = ['cena', 'global']

/** Maior mensagem, em unidades UTF-16 (o `maxLength` do campo conta igual). */
export const CHAT_TEXT_MAX_LENGTH = 1000

/** Ritmo sustentado de um jogador: uma mensagem a cada 700 ms. */
export const CHAT_SEND_MIN_INTERVAL_MS = 700

/** Quantas mensagens seguidas passam antes de o ritmo começar a valer. */
export const CHAT_SEND_BURST = 5

/** Quantas mensagens cada canal guarda e manda a quem chega. */
export const CHAT_HISTORY_MAX = 200

/** `@mestre` menciona o mestre, que não é jogador nem aparece no Grupo. */
export const CHAT_MASTER_MENTION = 'mestre'

/** Quebra de linha do Windows e do Mac antigo. */
const CARRIAGE_RETURNS = /\r\n?/g

/**
 * Controles C0 (menos a quebra de linha), DEL, C1 e os marcadores bidi que
 * viram o texto do avesso na tela dos outros (U+202A-202E e U+2066-2069).
 */
const UNSAFE_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g

/** `@` que começa uma menção: no início ou depois de algo que não continua um nome. */
const MENTION_AT = /(?<![\p{L}\p{N}\p{M}])@/gu

/** Letra, número ou marca (acento combinante) logo depois do nome: o nome continua. */
const NAME_CONTINUES = /^[\p{L}\p{N}\p{M}]/u

export function isChatChannel(value: unknown): value is ChatChannel {
  return CHAT_CHANNELS.some((channel) => channel === value)
}

/**
 * O texto como os outros vão ler: quebras de linha viram `\n`, tabulação vira
 * espaço, controles e bidi somem, e as pontas perdem o espaço. Vazio aqui é
 * mensagem que não vai.
 */
export function cleanChatText(raw: string): string {
  return raw.replace(CARRIAGE_RETURNS, '\n').replace(/\t/g, ' ').replace(UNSAFE_CHARS, '').trim()
}

/**
 * Ritmo de envio (GCRA): `paceAt` é o relógio teórico do jogador, que cada
 * mensagem empurra `CHAT_SEND_MIN_INTERVAL_MS` à frente. A mensagem passa
 * enquanto ele estiver no máximo `CHAT_SEND_BURST - 1` intervalos à frente de
 * `at`. Devolve o relógio novo, ou `null` para recusar (e o relógio não anda).
 */
export function takeChatTurn(paceAt: number | undefined, at: number): number | null {
  let start = at
  // Mais de uma rajada inteira à frente só acontece se o relógio da máquina voltou: recomeça.
  if (paceAt !== undefined && paceAt > at && paceAt - at <= CHAT_SEND_BURST * CHAT_SEND_MIN_INTERVAL_MS) {
    start = paceAt
  }
  if (start - at > (CHAT_SEND_BURST - 1) * CHAT_SEND_MIN_INTERVAL_MS) return null
  return start + CHAT_SEND_MIN_INTERVAL_MS
}

/**
 * Quem de `candidates` o texto menciona com `@Nome`, sem diferenciar
 * maiúsculas, na ordem do texto e sem repetir. Devolve o nome como está em
 * `candidates`. "ana@bruno.com" não menciona ninguém e "@Brunoca" não
 * menciona Bruno. Nome mais longo ganha ("@Ana Maria" é Ana Maria, não Ana)
 * e, no empate, o mestre: um jogador chamado "Mestre" não tira o `@mestre`.
 */
export function findMentions(text: string, candidates: readonly string[]): string[] {
  const longestFirst = candidates
    .filter((name) => name !== '')
    .sort((a, b) => b.length - a.length || Number(b === CHAT_MASTER_MENTION) - Number(a === CHAT_MASTER_MENTION))
  const found: string[] = []
  for (const match of text.matchAll(MENTION_AT)) {
    const start = match.index + 1
    const name = longestFirst.find((candidate) => isMentionAt(text, start, candidate))
    if (name !== undefined && !found.includes(name)) found.push(name)
  }
  return found
}

function isMentionAt(text: string, start: number, name: string): boolean {
  const end = start + name.length
  if (text.slice(start, end).toLowerCase() !== name.toLowerCase()) return false
  return !NAME_CONTINUES.test(text.slice(end))
}
