import type { PostoDaRotina, RotinaDoNpc, Token } from '../types/map'
import type { Point } from '../pixi/world'
import { findTokenPath } from './collision'
import type { EstadoDoMundo } from './estadoDoMundo'
import type { CenaDaRotina, MovimentoDaRotina } from './rotinaDoNpc'

/**
 * ROTINA ANDANDO — a rotina do NPC vira macro: ligada, a ficha anda sozinha
 * de posto em posto, um passo curto a cada tique, espera um pouco no posto e
 * segue para o próximo; depois do último, volta ao primeiro. Até o mestre
 * desligar. Não depende do apito: o apito continua levando todo mundo de uma
 * vez (`useAdventureStore.trocarEstadoDoMundo`).
 *
 * Aqui só o agendador puro: quem anda, para onde e quando. Aplicar o passo é
 * do editor (`useRotinaAndandoStore`), com a mesma mecânica do apito: mudança
 * de mesa dentro da cena, `transferToken` entre cenas. O estado de quem está
 * andando vive só na memória do editor — não vai para o arquivo nem para o
 * jogador, que recebe apenas a ficha no lugar novo.
 */

/** Um tique a cada 200 ms: menor que o deslize do jogador (240 ms), que emenda um passo no outro. */
export const PASSO_DA_ROTINA_MS = 200
/** Duas casas por segundo: gente andando pelo mapa, sem correr. */
const CASAS_POR_SEGUNDO = 2
/** Parada em cada posto antes de seguir para o próximo. */
export const ESPERA_NO_POSTO_MS = 2000

/** A ficha com a rotina ligada. */
export interface FichaAndando {
  /** Índice, em `postosEmOrdem`, do posto para onde ela anda agora. */
  destino: number
  /** Parada no posto: não anda antes deste instante. */
  esperaAte: number
}

/** Fichas com a rotina ligada, por id. */
export type RotinasAndando = ReadonlyMap<string, FichaAndando>

/** Quanto a ficha anda num tique, em px de mundo, num mapa de célula `grid`. */
export function passoEmPx(grid: number): number {
  return (grid * CASAS_POR_SEGUNDO * PASSO_DA_ROTINA_MS) / 1000
}

/**
 * Os postos na ordem do loop: a ordem dos valores do estado (Aurora, Meio,
 * Brasa), não a ordem em que foram gravados. Estado que sumiu da aventura:
 * a ordem gravada.
 */
export function postosEmOrdem(rotina: RotinaDoNpc, estados: readonly EstadoDoMundo[]): PostoDaRotina[] {
  const valores = estados.find((estado) => estado.id === rotina.estadoId)?.valores
  if (valores === undefined) return rotina.postos
  const ordem = (posto: PostoDaRotina) => {
    const i = valores.indexOf(posto.valor)
    return i === -1 ? valores.length : i
  }
  return [...rotina.postos].sort((a, b) => ordem(a) - ordem(b))
}

function acharFicha(cenas: readonly CenaDaRotina[], tokenId: string): { cena: CenaDaRotina; token: Token } | null {
  for (const cena of cenas) {
    const token = cena.map.tokens.find((t) => t.id === tokenId)
    if (token !== undefined) return { cena, token }
  }
  return null
}

function estaNoPosto(sceneId: string, token: Token, posto: PostoDaRotina): boolean {
  return posto.sceneId === sceneId && posto.x === token.x && posto.y === token.y
}

/**
 * Liga a rotina de `tokenId`: a ficha sai rumo ao posto seguinte ao que ela
 * ocupa (ou ao primeiro, se não está em nenhum). Ficha que não está em cena
 * carregada, ou sem posto, não liga.
 */
export function ligarRotina(andando: RotinasAndando, cenas: readonly CenaDaRotina[], tokenId: string, estados: readonly EstadoDoMundo[], now: number): RotinasAndando {
  const achada = acharFicha(cenas, tokenId)
  const rotina = achada?.token.rotina
  if (achada === null || rotina === undefined || rotina.postos.length === 0) return andando
  const postos = postosEmOrdem(rotina, estados)
  const aqui = postos.findIndex((posto) => estaNoPosto(achada.cena.sceneId, achada.token, posto))
  const next = new Map(andando)
  next.set(tokenId, { destino: (aqui + 1) % postos.length, esperaAte: now })
  return next
}

export function desligarRotina(andando: RotinasAndando, tokenId: string): RotinasAndando {
  if (!andando.has(tokenId)) return andando
  const next = new Map(andando)
  next.delete(tokenId)
  return next
}

/**
 * Um passo de `from` rumo a `to` seguindo o trajeto; `null`: sem caminho.
 * O passo para NO vão da porta em vez de dobrar a quina dentro do mesmo tique:
 * o jogador desliza em linha reta de um ponto ao outro, e um passo que
 * dobrasse a quina o faria ver a ficha atravessar a ponta da parede.
 * Sem arredondar: o posto guarda o x/y cru da ficha (22,5 no centro de uma casa
 * de 45 px, irracional na grade hexagonal), e a chegada é por igualdade exata.
 */
function andarUmPasso(from: Point, to: Point, cena: CenaDaRotina): Point | null {
  const trajeto = findTokenPath(from, to, cena.map.walls, cena.map.grid)
  if (trajeto === null) return null
  const alvo = trajeto[1] ?? to
  const dist = Math.hypot(alvo.x - from.x, alvo.y - from.y)
  const passo = passoEmPx(cena.map.grid)
  if (dist <= passo) return { x: alvo.x, y: alvo.y }
  const k = passo / dist
  return { x: from.x + (alvo.x - from.x) * k, y: from.y + (alvo.y - from.y) * k }
}

/**
 * Um tique do relógio: o movimento de cada ficha com a rotina ligada.
 * - posto na mesma cena: um passo rumo a ele (sem caminho livre: vai de uma vez);
 * - posto noutra cena carregada: vai de uma vez para lá (`transferToken`);
 * - posto em cena fora do ar: fica de fora do loop, a ficha não some;
 * - ficha em `fixas` (um jogador segura) ou esperando no posto: não anda;
 * - ficha que sumiu ou perdeu a rotina: desliga.
 * Ao chegar ao posto, espera `ESPERA_NO_POSTO_MS` e mira o próximo.
 */
export function darPassoDaRotina(
  cenas: readonly CenaDaRotina[],
  andando: RotinasAndando,
  estados: readonly EstadoDoMundo[],
  now: number,
  fixas: ReadonlySet<string> = new Set(),
): { movimentos: MovimentoDaRotina[]; andando: RotinasAndando } {
  const movimentos: MovimentoDaRotina[] = []
  const next = new Map<string, FichaAndando>()
  const carregadas = new Set(cenas.map((cena) => cena.sceneId))
  for (const [tokenId, ficha] of andando) {
    const achada = acharFicha(cenas, tokenId)
    const rotina = achada?.token.rotina
    if (achada === null || rotina === undefined || rotina.postos.length === 0) continue
    if (fixas.has(tokenId) || now < ficha.esperaAte) {
      next.set(tokenId, ficha)
      continue
    }
    const postos = postosEmOrdem(rotina, estados)
    // O primeiro posto a partir do destino que está numa cena carregada.
    const passo = postos.map((_, i) => (ficha.destino + i) % postos.length).find((i) => carregadas.has(postos[i].sceneId))
    if (passo === undefined) {
      next.set(tokenId, ficha)
      continue
    }
    const posto = postos[passo]
    const { cena, token } = achada
    const para = posto.sceneId !== cena.sceneId ? posto : (andarUmPasso(token, posto, cena) ?? posto)
    if (para.x !== token.x || para.y !== token.y || posto.sceneId !== cena.sceneId) {
      movimentos.push({ tokenId, de: cena.sceneId, para: posto.sceneId, x: para.x, y: para.y })
    }
    const chegou = posto.sceneId !== cena.sceneId || (para.x === posto.x && para.y === posto.y)
    next.set(tokenId, chegou ? { destino: (passo + 1) % postos.length, esperaAte: now + ESPERA_NO_POSTO_MS } : { destino: passo, esperaAte: ficha.esperaAte })
  }
  return { movimentos, andando: next }
}
