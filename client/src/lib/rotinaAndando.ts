import type { PostoDaRotina, RotinaDoNpc, Token } from '../types/map'
import type { Point } from '../pixi/world'
import { andarPeloTrajeto, TENTAR_DE_NOVO_MS, trajetoAte } from './andarPeloCaminho'
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
  /** Parada no posto (ou à espera de caminho): não anda antes deste instante. */
  esperaAte: number
  /** Os cantos que faltam até o posto (o último é ele). Ausente: calcular no próximo passo. */
  trajeto?: readonly Point[]
}

export { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'

/** Fichas com a rotina ligada, por id. */
export type RotinasAndando = ReadonlyMap<string, FichaAndando>

/** Quanto a ficha anda num tique, em px de mundo, num mapa de célula `grid` (a patrulha passa a velocidade dela). */
export function passoEmPx(grid: number, casasPorSegundo: number = CASAS_POR_SEGUNDO): number {
  return (grid * casasPorSegundo * PASSO_DA_ROTINA_MS) / 1000
}

/**
 * Retomar depois da PAUSA GERAL dos NPCs: cada espera anda para a frente o
 * tempo que ficou pausado — quem estava parado no posto termina a parada, em
 * vez de sair correndo porque o relógio de parede seguiu. Mesmo mapa quando
 * não há o que adiar. Serve à rotina e à patrulha.
 */
export function adiarEsperas<T extends { esperaAte: number }>(andando: ReadonlyMap<string, T>, ms: number): ReadonlyMap<string, T> {
  if (ms <= 0 || andando.size === 0) return andando
  return new Map([...andando].map(([id, ficha]): [string, T] => [id, { ...ficha, esperaAte: ficha.esperaAte + ms }]))
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
 * Um tique do relógio: o movimento de cada ficha com a rotina ligada.
 * - posto na mesma cena: um passo rumo a ele pelo caminho em grade
 *   (`lib/andarPeloCaminho.ts`): contorna parede, passa por porta aberta;
 * - sem caminho até ele (porta fechada): fica onde está, sem pular, e procura
 *   de novo em `TENTAR_DE_NOVO_MS`;
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
    const proximo = { destino: (passo + 1) % postos.length, esperaAte: now + ESPERA_NO_POSTO_MS }
    if (posto.sceneId !== cena.sceneId) {
      movimentos.push({ tokenId, de: cena.sceneId, para: posto.sceneId, x: posto.x, y: posto.y })
      next.set(tokenId, proximo)
      continue
    }
    const aqui = { x: token.x, y: token.y }
    const trajeto = trajetoAte(aqui, posto, ficha.trajeto, cena.map)
    if (trajeto === null) {
      // Sem caminho (porta fechada): parada onde está, sem pular, até a próxima tentativa.
      next.set(tokenId, { destino: passo, esperaAte: now + TENTAR_DE_NOVO_MS })
      continue
    }
    const { para, resta } = andarPeloTrajeto(aqui, trajeto, passoEmPx(cena.map.grid))
    if (para.x !== token.x || para.y !== token.y) {
      movimentos.push({ tokenId, de: cena.sceneId, para: cena.sceneId, x: para.x, y: para.y })
    }
    const chegou = resta.length === 0 && para.x === posto.x && para.y === posto.y
    next.set(tokenId, chegou ? proximo : { destino: passo, esperaAte: ficha.esperaAte, trajeto: resta })
  }
  return { movimentos, andando: next }
}
