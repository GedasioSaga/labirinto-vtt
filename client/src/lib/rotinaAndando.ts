import type { PostoDaRotina, RotinaDoNpc, Token } from '../types/map'
import { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'
import type { Andarilho } from './caminhamento/andarilho'
import { type AvisoDoNpc, avisoDepoisDeChegar, avisoDoFim, type MotorDosNpcs, motorImediato, type PortaDoNpc, TiqueDosNpcs } from './caminhamento/tiqueDosNpcs'
import { estaCongelada } from './congelar'
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
  /** Parada no posto (ou depois de desistir de um): não anda antes deste instante. */
  esperaAte: number
  /**
   * O trecho rumo ao posto, no motor (`lib/caminhamento/andarilho.ts`); o do
   * posto anterior enquanto ela espera, com as portas que ficou de fechar.
   * Ausente: começar no próximo passo.
   */
  andarilho?: Andarilho
  /** Desistiu de um posto e por quê (porta trancada, ficha no caminho): para o mestre ver. */
  aviso?: AvisoDoNpc
}

export { TENTAR_DE_NOVO_MS } from './andarPeloCaminho'

/** Fichas com a rotina ligada, por id. */
export type RotinasAndando = ReadonlyMap<string, FichaAndando>

/** Quanto a ficha anda num tique, em px de mundo, num mapa de célula `grid` (a patrulha passa a velocidade dela). */
export function passoEmPx(grid: number, casasPorSegundo: number = CASAS_POR_SEGUNDO): number {
  return (grid * casasPorSegundo * PASSO_DA_ROTINA_MS) / 1000
}

/** O nome do pedido de caminho da rotina de `tokenId` na agenda do motor (a patrulha usa outro). */
export function chaveDaRotina(tokenId: string): string {
  return `rotina:${tokenId}`
}

/** O motor de quem não passa um: cada caminho sai no mesmo tique. */
const MOTOR_IMEDIATO = motorImediato()

/**
 * Retomar depois da PAUSA GERAL dos NPCs: cada espera anda para a frente o
 * tempo que ficou pausado — quem estava parado no posto termina a parada, em
 * vez de sair correndo porque o relógio de parede seguiu; a espera do trecho
 * (porta trancada, ficha no caminho) também. Mesmo mapa quando não há o que
 * adiar. Serve à rotina e à patrulha.
 */
export function adiarEsperas<T extends { esperaAte: number; andarilho?: Andarilho }>(andando: ReadonlyMap<string, T>, ms: number): ReadonlyMap<string, T> {
  if (ms <= 0 || andando.size === 0) return andando
  return new Map(
    [...andando].map(([id, ficha]): [string, T] => {
      const { andarilho } = ficha
      const trecho = andarilho === undefined ? {} : { andarilho: { ...andarilho, esperaAte: andarilho.esperaAte + ms } }
      return [id, { ...ficha, esperaAte: ficha.esperaAte + ms, ...trecho }]
    }),
  )
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

/** O resultado de um tique da rotina: o que aplicar no mapa e o estado novo de quem anda. */
export interface TiqueDaRotina {
  movimentos: MovimentoDaRotina[]
  /** Portas que os NPCs abriram e fecharam, cena a cena (`comPortaDoNpc`), fora do Ctrl+Z como o passo. */
  portas: PortaDoNpc[]
  andando: RotinasAndando
}

/** A ficha mirando o posto seguinte, depois de chegar a este ou de desistir dele. */
function rumoAoSeguinte(destino: number, total: number, esperaAte: number, andarilho: Andarilho | undefined, aviso: AvisoDoNpc | undefined): FichaAndando {
  return { destino: (destino + 1) % total, esperaAte, ...(andarilho === undefined ? {} : { andarilho }), ...(aviso === undefined ? {} : { aviso }) }
}

/**
 * Um tique do relógio: o movimento de cada ficha com a rotina ligada.
 * - posto na mesma cena: um passo rumo a ele pelo motor de caminhos
 *   (`lib/caminhamento/`): contorna parede e as outras fichas (o jogador
 *   inclusive, que nunca é empurrado), abre a porta destrancada diante de si
 *   e a fecha atrás; nunca pula;
 * - sem caminho (porta trancada, ficha tapando, sala sem saída): espera e
 *   tenta de novo; sem jeito, DESISTE do posto com o motivo (`aviso`), espera
 *   `TENTAR_DE_NOVO_MS` e segue para o próximo — no loop seguinte tenta de novo;
 * - posto noutra cena carregada: vai de uma vez para lá (`transferToken`);
 * - posto em cena fora do ar: fica de fora do loop, a ficha não some;
 * - ficha em `fixas` (um jogador segura), congelada pelo mestre ou esperando
 *   no posto: não anda;
 * - ficha que sumiu ou perdeu a rotina: desliga.
 * Ao chegar ao posto, espera `ESPERA_NO_POSTO_MS` e mira o próximo.
 * `motor`: a agenda de caminhos do editor; sem ele, cada caminho sai no mesmo tique.
 */
export function darPassoDaRotina(
  cenas: readonly CenaDaRotina[],
  andando: RotinasAndando,
  estados: readonly EstadoDoMundo[],
  now: number,
  fixas: ReadonlySet<string> = new Set(),
  motor: MotorDosNpcs = MOTOR_IMEDIATO,
): TiqueDaRotina {
  const movimentos: MovimentoDaRotina[] = []
  const next = new Map<string, FichaAndando>()
  const carregadas = new Set(cenas.map((cena) => cena.sceneId))
  const mundo = new TiqueDosNpcs(motor, now)
  for (const [tokenId, ficha] of andando) {
    const achada = acharFicha(cenas, tokenId)
    const rotina = achada?.token.rotina
    if (achada === null || rotina === undefined || rotina.postos.length === 0) {
      motor.agenda.cancelar(chaveDaRotina(tokenId))
      continue
    }
    if (fixas.has(tokenId) || estaCongelada(achada.token) || now < ficha.esperaAte) {
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
    if (posto.sceneId !== cena.sceneId) {
      movimentos.push({ tokenId, de: cena.sceneId, para: posto.sceneId, x: posto.x, y: posto.y })
      next.set(tokenId, rumoAoSeguinte(passo, postos.length, now + ESPERA_NO_POSTO_MS, undefined, avisoDepoisDeChegar(ficha.aviso, posto)))
      continue
    }
    const tique = mundo.andar(chaveDaRotina(tokenId), cena.sceneId, cena.map, tokenId, posto, ficha.andarilho, passoEmPx(cena.map.grid))
    if (tique === null) {
      next.set(tokenId, ficha)
      continue
    }
    const { para, andarilho } = tique
    if (para.x !== token.x || para.y !== token.y) movimentos.push({ tokenId, de: cena.sceneId, para: cena.sceneId, x: para.x, y: para.y })
    if (tique.situacao === 'chegou') next.set(tokenId, rumoAoSeguinte(passo, postos.length, now + ESPERA_NO_POSTO_MS, andarilho, avisoDepoisDeChegar(ficha.aviso, posto)))
    else if (tique.situacao === 'desistiu') next.set(tokenId, rumoAoSeguinte(passo, postos.length, now + TENTAR_DE_NOVO_MS, andarilho, avisoDoFim(andarilho.fim, posto, now) ?? ficha.aviso))
    else next.set(tokenId, { ...ficha, destino: passo, andarilho })
  }
  return { movimentos, portas: mundo.portas, andando: next }
}
