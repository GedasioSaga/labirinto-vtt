import type { Confronto, MapData } from '../types/map'
import type { Point } from '../pixi/world'
import { measureCells } from './measurement'

/**
 * CONFRONTO POR CENA — lógica pura. O estado mora no mapa da cena
 * (`MapData.confronto`); o gasto da vez mora na sessão do host
 * (`net/hostSession.ts`); o jogador recebe só `PlayerConfronto`.
 * Plano: `docs/planos/confronto-por-cena.md`.
 */

/** Passo por vez quando o mestre não escolhe outro: 6 casas (30 ft no D&D). */
export const PASSO_PADRAO = 6
/** Teto do passo: número digitado sem querer (600) não vira "sem limite" disfarçado. */
export const PASSO_MAXIMO = 99
/** Folga de arredondamento na soma do trajeto: 6 casas medidas em px nunca viram 6,0000001. */
const FOLGA_CASAS = 1e-6

/**
 * O que o JOGADOR recebe do confronto da cena onde ele está.
 * `fila`: só fichas que já saíram no recorte dele, na ordem da vez.
 * `vez`: a ficha da vez, se ele a recebeu; `null` = vez de alguém que ele não vê.
 * `restam`: casas que ainda faltam — só na vez de ficha DELE.
 */
export interface PlayerConfronto {
  fila: string[]
  vez: string | null
  suaVez: boolean
  passo: number
  restam: number | null
}

function passoValido(passo: number): number {
  if (!Number.isFinite(passo)) return PASSO_PADRAO
  return Math.min(PASSO_MAXIMO, Math.max(1, Math.floor(passo)))
}

/** Começa o confronto com a fila na ordem dada (sem repetir ficha). Fila vazia: `null`. */
export function iniciarConfronto(fila: readonly string[], passo: number): Confronto | null {
  const unica = [...new Set(fila)]
  if (unica.length === 0) return null
  return { fila: unica, vez: 0, passo: passoValido(passo), turno: 0 }
}

/**
 * O mapa com este confronto (`undefined` = encerrado, e a chave SAI do mapa:
 * a cena volta a ser salva como antes do confronto). Devolve o próprio mapa
 * quando nada muda — é o contrato de `applyPlayerChange`, por onde o painel
 * grava (mudança de mesa, fora do Ctrl+Z do editor).
 */
export function comConfronto(map: MapData, confronto: Confronto | undefined): MapData {
  if (confronto === undefined) {
    if (map.confronto === undefined) return map
    const { confronto: _encerrado, ...semConfronto } = map
    return semConfronto
  }
  return { ...map, confronto }
}

/** O id da ficha da vez. */
export function fichaDaVez(confronto: Confronto): string | null {
  return confronto.fila[confronto.vez] ?? null
}

/**
 * Passa a vez para a próxima ficha da fila que ainda está na cena. Ficha que
 * saiu (morreu, viajou) fica na fila — pode voltar — mas é pulada. O `turno`
 * sempre anda: é outra vez, mesmo que a fila volte à mesma ficha.
 */
export function proximaVez(confronto: Confronto, fichasNaCena: ReadonlySet<string>): Confronto {
  const total = confronto.fila.length
  for (let passo = 1; passo <= total; passo += 1) {
    const indice = (confronto.vez + passo) % total
    const id = confronto.fila[indice]
    if (id !== undefined && fichasNaCena.has(id)) return { ...confronto, vez: indice, turno: confronto.turno + 1 }
  }
  // Ninguém da fila está na cena: a vez fica onde está, mas é uma vez nova.
  return { ...confronto, turno: confronto.turno + 1 }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isInteiroNaoNegativo(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/**
 * Confronto lido do disco. Arquivo editado à mão ou de versão futura chega
 * cru: forma torta volta `undefined` (sem confronto), e o resto do mapa abre.
 */
export function confrontoFromFile(raw: unknown): Confronto | undefined {
  if (!isRecord(raw)) return undefined
  const { fila, vez, passo, turno } = raw
  if (!Array.isArray(fila) || fila.length === 0) return undefined
  const ids = fila.filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (ids.length !== fila.length) return undefined
  if (!isInteiroNaoNegativo(vez) || vez >= ids.length) return undefined
  if (typeof passo !== 'number' || !Number.isInteger(passo) || passo < 1 || passo > PASSO_MAXIMO) return undefined
  if (!isInteiroNaoNegativo(turno)) return undefined
  return { fila: ids, vez, passo, turno }
}

/** Casas do trajeto (os trechos de `findTokenPath`), na régua do mapa. */
export function casasDoTrajeto(map: Pick<MapData, 'grid' | 'gridShape' | 'measurementMode'>, trajeto: readonly Point[]): number {
  let casas = 0
  for (let i = 1; i < trajeto.length; i += 1) {
    const de = trajeto[i - 1]
    const ate = trajeto[i]
    if (de === undefined || ate === undefined) continue
    casas += measureCells(de, ate, map.grid, map.gridShape, map.measurementMode)
  }
  return casas
}

/** O trajeto cabe no que resta do passo? */
export function cabeNoPasso(passo: number, gasto: number, casas: number): boolean {
  return gasto + casas <= passo + FOLGA_CASAS
}

/**
 * O RECORTE do confronto para um jogador. `recebidas`: ids das fichas que já
 * saíram no recorte do mapa dele (`filterMapForPlayer`) — ficha que a névoa,
 * a zona oculta, o segredo ou a camada escondem não entra na fila, e a vez
 * dela sai como `null`. `minhas`: as fichas dele. `gasto`: casas já andadas
 * nesta vez (só conta se a vez é dele). O `turno` nunca sai.
 */
export function confrontoParaJogador(
  confronto: Confronto | undefined,
  recebidas: readonly string[],
  minhas: readonly string[],
  gasto: number,
): PlayerConfronto | undefined {
  if (confronto === undefined) return undefined
  const vistas = new Set(recebidas)
  const daVez = fichaDaVez(confronto)
  const vez = daVez !== null && vistas.has(daVez) ? daVez : null
  const suaVez = vez !== null && minhas.includes(vez)
  return {
    fila: confronto.fila.filter((id) => vistas.has(id)),
    vez,
    suaVez,
    passo: confronto.passo,
    restam: suaVez ? Math.max(0, Math.floor(confronto.passo - gasto + FOLGA_CASAS)) : null,
  }
}

/**
 * A faixa como chega da rede, no jogador. Forma torta: `null` (quem chama
 * descarta a mensagem inteira, como todo campo aditivo malformado). Devolve
 * só os campos conhecidos.
 */
export function parsePlayerConfronto(raw: unknown): PlayerConfronto | null {
  if (!isRecord(raw)) return null
  const { fila, vez, suaVez, passo, restam } = raw
  if (!Array.isArray(fila)) return null
  const ids = fila.filter((id): id is string => typeof id === 'string')
  if (ids.length !== fila.length) return null
  if (vez !== null && typeof vez !== 'string') return null
  if (typeof suaVez !== 'boolean') return null
  if (typeof passo !== 'number' || !Number.isInteger(passo) || passo < 1) return null
  if (restam !== null && !isInteiroNaoNegativo(restam)) return null
  return { fila: ids, vez, suaVez, passo, restam }
}
