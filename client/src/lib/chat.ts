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

/** Como a fala do mestre aparece (o mesmo nome das rolagens dele, `MASTER_ROLLER_NAME`). */
export const CHAT_MASTER_NAME = 'Mestre'

/** A mensagem menciona o mestre (`@mestre`, confirmado pelo host)? */
export function mentionsMaster(mentions: readonly string[]): boolean {
  return mentions.includes(CHAT_MASTER_MENTION)
}

/** Quebra de linha do Windows e do Mac antigo. */
const CARRIAGE_RETURNS = /\r\n?/g

/**
 * Controles C0 (menos a quebra de linha), DEL e C1; as marcas bidi que viram
 * o texto do avesso na tela dos outros (U+061C, U+200E-200F, U+202A-202E e
 * U+2066-2069); e os invisíveis que escondem ou colam letras: largura zero
 * (U+200B-200D), U+2060-2064, BOM (U+FEFF) e os separadores de linha e de
 * parágrafo (U+2028, U+2029), que quebram a linha por fora do `\n`.
 */
const UNSAFE_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u061C\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g

/**
 * Tabulação, quebra de linha e o branco do Braille (U+2800, cela sem pontos:
 * parece espaço, mas para o Unicode não é espaço nem invisível), em qualquer
 * sequência: no nome, viram um espaço só.
 */
const NAME_BLANKS = /[\r\n\t\u{2800}]+/gu

/**
 * O que o Unicode manda não desenhar (Default_Ignorable_Code_Point): hífen
 * suave, junção de grafemas, preenchimentos do hangul, seletores de variação,
 * separador de vogal do mongol, as tags (U+E0000-E007F) e os invisíveis do
 * `UNSAFE_CHARS`. Num nome, só servem para fazer um nome passar por outro.
 */
const DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/gu

/** Acento e as demais marcas combinantes que a normalização não juntou à letra. */
const COMBINING_MARKS = /\p{M}/gu

/** Espaço de qualquer tipo e o branco do Braille: o esqueleto do nome não tem nenhum. */
const SKELETON_BLANKS = /[\s\u{2800}]/gu

/**
 * Letras cirílicas e gregas que se desenham como uma latina, já em minúscula
 * (o esqueleto passa por `toLowerCase` antes). Cada uma vira a latina que a
 * maiúscula dela imita, porque o nome começa com maiúscula: o en cirílico
 * (U+043D) vira "h", e o mi grego (U+03BC), "m". O ge cirílico (U+0433) e o
 * gama grego (U+03B3), cuja maiúscula não imita nenhuma latina, viram a que a
 * minúscula imita ("r" e "y"). Lista curta de propósito: a tabela inteira
 * do Unicode, as trocas dentro do próprio latim (I e l, rn e m) e o palochka
 * (U+04CF, que imita I e l ao mesmo tempo) ficam de fora.
 */
const CONFUSABLE_LATIN: ReadonlyMap<string, string> = new Map([
  // Cirílico
  ['\u{0430}', 'a'],
  ['\u{0432}', 'b'],
  ['\u{0433}', 'r'],
  ['\u{0435}', 'e'],
  ['\u{043A}', 'k'],
  ['\u{043C}', 'm'],
  ['\u{043D}', 'h'],
  ['\u{043E}', 'o'],
  ['\u{0440}', 'p'],
  ['\u{0441}', 'c'],
  ['\u{0442}', 't'],
  ['\u{0443}', 'y'],
  ['\u{0445}', 'x'],
  ['\u{0455}', 's'],
  ['\u{0456}', 'i'],
  ['\u{0458}', 'j'],
  ['\u{04AF}', 'y'],
  ['\u{04BB}', 'h'],
  ['\u{0501}', 'd'],
  ['\u{051B}', 'q'],
  ['\u{051D}', 'w'],
  // Grego
  ['\u{03B1}', 'a'],
  ['\u{03B2}', 'b'],
  ['\u{03B3}', 'y'],
  ['\u{03B5}', 'e'],
  ['\u{03B6}', 'z'],
  ['\u{03B7}', 'h'],
  ['\u{03B9}', 'i'],
  ['\u{03BA}', 'k'],
  ['\u{03BC}', 'm'],
  ['\u{03BD}', 'n'],
  ['\u{03BF}', 'o'],
  ['\u{03C1}', 'p'],
  ['\u{03C4}', 't'],
  ['\u{03C5}', 'y'],
  ['\u{03C7}', 'x'],
])

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
 * O nome de quem entra na sala. Controles, bidi e tudo o que o Unicode manda
 * não desenhar (`DEFAULT_IGNORABLE`) somem; quebra de linha, tabulação e o
 * branco do Braille viram espaço, porque nome é uma linha só. Depois vem a
 * normalização NFKC: a letra larga (U+FF21) vira a comum e o acento escrito à
 * parte volta para a letra. Os invisíveis saem antes dela: um que estivesse
 * entre a letra e o acento impediria a junção. A normalização pode esticar o
 * nome (uma ligadura vira várias letras), então o teto de tamanho vale para o
 * que sai daqui. Vazio aqui é nome que não entra.
 */
export function cleanPlayerName(raw: string): string {
  return raw.replace(NAME_BLANKS, ' ').replace(UNSAFE_CHARS, '').replace(DEFAULT_IGNORABLE, '').normalize('NFKC').trim()
}

/**
 * A chave que diz se dois nomes são o mesmo para quem lê: sem invisíveis, sem
 * maiúsculas, sem espaço de tipo nenhum, sem marca combinante solta e com a
 * letra cirílica ou grega trocada pela latina que ela imita. A normalização é
 * NFKC, não NFKD: "José" e "Jose" continuam nomes diferentes. Serve só para
 * comparar; o nome que aparece é sempre o que foi digitado.
 */
export function nameSkeleton(name: string): string {
  // O minúsculo vem antes de tirar as marcas: o I turco com ponto (U+0130) vira "i" mais um ponto combinante.
  const folded = name.replace(DEFAULT_IGNORABLE, '').normalize('NFKC').toLowerCase().replace(COMBINING_MARKS, '')
  // Fora do mapa é o caso comum: a letra fica como está.
  return Array.from(folded, (char) => CONFUSABLE_LATIN.get(char) ?? char).join('').replace(SKELETON_BLANKS, '')
}

/**
 * Quem falou, como a linha mostra. O jogador que entrou com um nome que se lê
 * "Mestre" ganha " (jogador)": a fala dele não se passa pela do mestre. A
 * comparação é pelo esqueleto (`nameSkeleton`), para que um invisível, a letra
 * larga ou a letra cirílica ou grega não tirem a marca. É a regra do
 * `rollerLabel` (`lib/dice.ts`). A fala do mestre (fatia D) vem com a marca
 * do host (`fromMaster`), não pelo nome: só ela vira "Mestre".
 */
export function chatSpeakerLabel(from: string, fromMaster = false): string {
  if (fromMaster) return CHAT_MASTER_NAME
  return nameSkeleton(from) === nameSkeleton(CHAT_MASTER_MENTION) ? `${from} (jogador)` : from
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

/** Quem fala no chat e as fichas dele, para achar a foto (`chatFacesByName`). */
export interface ChatSpeakerTokens {
  name: string
  tokenIds: readonly string[]
}

/**
 * A FOTO DE QUEM FALOU, por nome na sala: a da primeira ficha dele, na ordem
 * da posse, que tem foto entre as fichas que ESTA tela já tem. Nada viaja na
 * mensagem — o mestre lê das cenas dele; o jogador, do próprio recorte (a
 * ficha do colega só conta se ele a vê agora). Sem foto, o nome não entra, e
 * a linha mostra as iniciais.
 */
export function chatFacesByName(
  speakers: readonly ChatSpeakerTokens[],
  tokens: readonly { id: string; imageData?: string | null }[],
): ReadonlyMap<string, string> {
  const photoOf = new Map<string, string>()
  for (const token of tokens) {
    if (typeof token.imageData === 'string' && token.imageData !== '' && !photoOf.has(token.id)) photoOf.set(token.id, token.imageData)
  }
  const faces = new Map<string, string>()
  for (const speaker of speakers) {
    if (faces.has(speaker.name)) continue
    const photo = speaker.tokenIds.map((id) => photoOf.get(id)).find((found) => found !== undefined)
    if (photo !== undefined) faces.set(speaker.name, photo)
  }
  return faces
}
