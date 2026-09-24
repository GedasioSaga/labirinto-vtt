import { isEditableTarget, type ShortcutEvent } from './keymap'
import type { PartyMember } from './party'

/**
 * atencao-do-mestre — a cena que espera o mestre.
 *
 * Uma cena "espera" enquanto tem alguém nela e o mestre está com OUTRA aberta
 * no editor. O relógio dela começa quando essas duas coisas passam a valer
 * juntas — alguém chegou numa cena que o mestre não vê, ou o mestre saiu de
 * uma cena com gente — e zera quando o mestre a abre ou ela esvazia.
 *
 * PURO: sem relógio (quem chama passa `agora`), sem store, sem DOM. Só do
 * mestre; nada disto vai pela rede.
 */

/** Um minuto, em ms. */
export const MINUTO_MS = 60_000

/** A partir de quantos minutos o 'há N min' fica âmbar. */
export const ESPERA_LONGA_MIN = 10

/** `sceneId` -> desde quando a cena espera (ms, relógio do mestre). */
export type EsperaPorCena = ReadonlyMap<string, number>

/** Cenas com alguém à mesa: conectado, com ficha, numa cena da aventura. */
export function cenasOcupadas(members: readonly PartyMember[]): Set<string> {
  const ocupadas = new Set<string>()
  for (const member of members) {
    if (member.connected && member.sceneId !== null && member.token !== null) ocupadas.add(member.sceneId)
  }
  return ocupadas
}

/**
 * O relógio de cada cena depois de uma mudança de ocupação ou de cena aberta.
 * Cena que já esperava guarda o início; cena nova na espera começa em `agora`;
 * a aberta e a vazia saem. Sem mudança, devolve o PRÓPRIO `anterior`: o estado
 * do React não troca e ninguém re-renderiza à toa.
 */
export function atualizarEspera(anterior: EsperaPorCena, ocupadas: ReadonlySet<string>, cenaAberta: string | null, agora: number): EsperaPorCena {
  const proxima = new Map<string, number>()
  for (const sceneId of ocupadas) {
    if (sceneId === cenaAberta) continue
    proxima.set(sceneId, anterior.get(sceneId) ?? agora)
  }
  const igual = proxima.size === anterior.size && [...proxima].every(([sceneId, desde]) => anterior.get(sceneId) === desde)
  return igual ? anterior : proxima
}

/** Minutos inteiros de espera por cena; menos de 1 min fica de fora (não existe 'há 0 min'). */
export function minutosDeEspera(espera: EsperaPorCena, agora: number): Map<string, number> {
  const minutos = new Map<string, number>()
  for (const [sceneId, desde] of espera) {
    const inteiros = Math.floor((agora - desde) / MINUTO_MS)
    if (inteiros >= 1) minutos.set(sceneId, inteiros)
  }
  return minutos
}

/** 'há 11 min': o que a linha da cena mostra. */
export function rotuloDeEspera(minutos: number): string {
  return `há ${minutos} min`
}

/** A espera já é longa o bastante para pedir o olho do mestre (âmbar). */
export function esperaLonga(minutos: number): boolean {
  return minutos >= ESPERA_LONGA_MIN
}

/** Para onde o Ctrl+J leva: a cena e a ficha de quem está lá. */
export interface DestinoDaEspera {
  sceneId: string
  playerName: string
  x: number
  y: number
}

/**
 * A cena que espera há mais tempo, centrada na ficha do primeiro de quem está
 * lá (a ordem do Grupo). Cena que ainda consta na espera mas já não tem
 * ninguém com ficha (a atualização vem no próximo render) é pulada.
 */
export function cenaQueEsperaMais(espera: EsperaPorCena, members: readonly PartyMember[]): DestinoDaEspera | null {
  const porAntiguidade = [...espera].sort((a, b) => a[1] - b[1])
  for (const [sceneId] of porAntiguidade) {
    const quem = members.find((member) => member.connected && member.sceneId === sceneId && member.token !== null)
    if (quem === undefined || quem.token === null) continue
    return { sceneId, playerName: quem.name, x: quem.token.x, y: quem.token.y }
  }
  return null
}

/**
 * Ctrl+J (Cmd+J no Mac): abrir a cena que espera há mais tempo. J sozinho é a
 * Sala Circular (`TOOL_SHORTCUTS`); com Shift ou Alt, ou digitando num campo,
 * a tecla não é nossa.
 */
export function ehAtalhoDaCenaQueEspera(evt: ShortcutEvent): boolean {
  if (!(evt.ctrlKey || evt.metaKey) || evt.shiftKey || evt.altKey) return false
  if (isEditableTarget(evt.targetTagName, evt.targetInputType, evt.targetContentEditable)) return false
  return evt.key.toLowerCase() === 'j'
}
