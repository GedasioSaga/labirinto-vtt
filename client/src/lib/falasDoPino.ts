import type { FonteNoPreludio, Pin } from '../types/map'
import type { EtiquetaDaFala, FalaDoPino, FalaParaJogador, LeiturasDoJogador } from '../types/cenarioEFalas'
import { CLUE_TEXT_MAX_LENGTH } from './clues'
import { readFonteNoPreludio } from './fonteNoPreludio'

/**
 * "?" FALAS E PISTAS (P5 do estudo de 15/11): uma lista curta de coisas para
 * DIZER, cada uma oculta até o mestre dizer ("Dizer agora", a todos da cena
 * ou a um) ou marcar "Livre". Puro: a névoa (`lib/fogFilter.ts`) chama
 * `falasParaJogador` na lista do que vai; a ficha do pino edita as entradas.
 *
 * Mapa antigo: o "?" sem `falas` continua o "?" de sempre — o `description`
 * é uma entrada livre, e o recorte manda o pino como sempre mandou. A lista só
 * nasce quando o mestre mexe nas entradas (`comFalas`), sem ele notar nada.
 */

export const ETIQUETAS_DA_FALA: readonly EtiquetaDaFala[] = ['Fala', 'Pista', 'Boato', 'Pergunta']
/** Teto de entradas num "?" e de letras em quem diz. */
export const FALAS_MAX = 40
export const QUEM_DIZ_MAX = 60
/** O id da entrada que nasce do `description` de um "?" antigo. */
export const ID_DA_FALA_ANTIGA = 'antiga'

export function ehEtiquetaDaFala(valor: unknown): valor is EtiquetaDaFala {
  return typeof valor === 'string' && (ETIQUETAS_DA_FALA as readonly string[]).includes(valor)
}

/** A chave de uma entrada dita a um jogador (`LeiturasDoJogador.falas`). */
export function chaveDaFala(pinoId: string, falaId: string): string {
  return `${pinoId}\n${falaId}`
}

/** O pino tem algo ligado ao Prelúdio: ele mesmo (P3) ou uma entrada do "?" (o texto ou quem diz, P5). */
export function temLigacaoAoPreludio(pin: Pick<Pin, 'fonte' | 'falas'>): boolean {
  return pin.fonte !== undefined || (pin.falas ?? []).some((fala) => fala.fonte !== undefined || fala.quemVerbeteId !== undefined)
}

/** O "?" já tem a lista própria (não é o "?" de sempre). */
export function temFalas(pin: Pick<Pin, 'kind' | 'falas'>): boolean {
  return pin.kind === 'interrogacao' && Array.isArray(pin.falas)
}

/**
 * As entradas do "?" como a ficha as mostra. O "?" antigo vira UMA entrada
 * livre com o texto (e a ligação ao Prelúdio, se tinha); sem texto, nenhuma.
 */
export function falasDoPino(pin: Pick<Pin, 'kind' | 'falas' | 'description' | 'fonte'>): readonly FalaDoPino[] {
  if (Array.isArray(pin.falas)) return pin.falas
  if (pin.description.trim() === '' && pin.fonte === undefined) return []
  const antiga: FalaDoPino = { id: ID_DA_FALA_ANTIGA, etiqueta: 'Pista', texto: pin.description, livre: true }
  return pin.fonte === undefined ? [antiga] : [{ ...antiga, fonte: pin.fonte }]
}

/**
 * O pino com a lista própria. O "?" antigo passa o texto (e a ligação) para a
 * primeira entrada: o `description` e o `fonte` do pino saem, para o texto
 * morar num lugar só.
 */
export function comFalas(pin: Pin, falas: readonly FalaDoPino[]): Pin {
  const novo: Pin = { ...pin, falas: [...falas], description: '' }
  delete novo.fonte
  return novo
}

/** O id de uma entrada nova: único dentro do pino (a hora mais um sorteio curto). */
export function idDeFalaNova(): string {
  return `fala-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Uma entrada nova, oculta. */
export function novaFala(id: string, etiqueta: EtiquetaDaFala, texto: string, extra: Partial<Pick<FalaDoPino, 'quem' | 'quemVerbeteId' | 'fonte'>> = {}): FalaDoPino {
  const fala: FalaDoPino = { id, etiqueta, texto }
  if (extra.quem !== undefined && extra.quem.trim() !== '') fala.quem = extra.quem.trim().slice(0, QUEM_DIZ_MAX)
  if (extra.quemVerbeteId !== undefined) fala.quemVerbeteId = extra.quemVerbeteId
  if (extra.fonte !== undefined) fala.fonte = extra.fonte
  return fala
}

/** O "?" com as entradas e a regra de sempre (o legível de agora), para o jogador. */
function paraJogador(fala: FalaDoPino): FalaParaJogador {
  const limpa: FalaParaJogador = { id: fala.id, etiqueta: fala.etiqueta, texto: fala.texto.slice(0, CLUE_TEXT_MAX_LENGTH) }
  const quem = (fala.quem ?? '').trim()
  if (quem !== '') limpa.quem = quem.slice(0, QUEM_DIZ_MAX)
  return limpa
}

/**
 * A regra das falas no pino que JÁ saiu pela lista do que vai
 * (`pinForPlayer`). Só no "?" com lista própria:
 * - vão só as entradas ditas a ESTE jogador e as livres (a livre, só quando
 *   ele lê o pino: "só de perto" com a ficha longe não a leva), em ordem, e
 *   de cada uma só etiqueta, quem diz e texto — nunca a ligação, o verbete,
 *   a quem mais foi dita nem quantas estão ocultas;
 * - o `description` sai vazio (o texto mora nas entradas);
 * - sem nenhuma entrada para ele, o pino sai VAZIO (`falasVisiveis: []`): o
 *   marcador está no mapa e o mestre o vê ali, então sumir com ele parecia
 *   defeito (pedido de 16/11/2026, "pino não ta aparecendo no 2 piso"). O
 *   toque mostra "nada escrito ainda"; nenhuma entrada nem contagem vai.
 * O "?" de sempre e os outros tipos passam iguais.
 */
export function falasParaJogador(recortado: Pin, pin: Pin, leituras?: LeiturasDoJogador): Pin {
  if (!temFalas(pin) || !Array.isArray(pin.falas)) return recortado
  const legivel = recortado.longe !== true
  const ditas = leituras?.falas
  const visiveis = pin.falas.filter((fala) => {
    if (fala.texto.trim() === '') return false
    if (ditas !== undefined && ditas.has(chaveDaFala(pin.id, fala.id))) return true
    return fala.livre === true && legivel
  })
  return { ...recortado, description: '', falasVisiveis: visiveis.map(paraJogador) }
}

/** As entradas do disco, campo a campo; forma errada some (e lista torta volta AUSENTE: o "?" de sempre). */
export function lerFalasDoArquivo(valor: unknown): FalaDoPino[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const falas: FalaDoPino[] = []
  const ids = new Set<string>()
  for (const bruta of valor.slice(0, FALAS_MAX)) {
    if (typeof bruta !== 'object' || bruta === null) continue
    // `bruta` é objeto não nulo (conferido acima); cada campo é lido como `unknown` e conferido.
    const { id, etiqueta, quem, quemVerbeteId, texto, fonte, livre } = bruta as Record<string, unknown>
    if (typeof id !== 'string' || id === '' || ids.has(id) || typeof texto !== 'string') continue
    ids.add(id)
    const fala: FalaDoPino = { id, etiqueta: ehEtiquetaDaFala(etiqueta) ? etiqueta : 'Pista', texto: texto.slice(0, CLUE_TEXT_MAX_LENGTH) }
    if (typeof quem === 'string' && quem.trim() !== '') fala.quem = quem.trim().slice(0, QUEM_DIZ_MAX)
    if (typeof quemVerbeteId === 'string' && quemVerbeteId !== '') fala.quemVerbeteId = quemVerbeteId
    const ligada: FonteNoPreludio | undefined = readFonteNoPreludio(fonte)
    if (ligada !== undefined) fala.fonte = ligada
    if (livre === true) fala.livre = true
    falas.push(fala)
  }
  return falas
}
