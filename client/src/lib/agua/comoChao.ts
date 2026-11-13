import type { Agua, FloorPiece } from '../../types/map'
import { larguraDoRio, pontosMinimos } from './dados'
import { curvaGuardada } from './forma'

/**
 * ÁGUA CONTA COMO CHÃO (decisão do mestre de 12/11/2026, a recomendada): com
 * "Fora do Chão: Bloqueado", o jogador vê e anda na água como no Chão. Cada
 * água vira uma peça de Chão de mentira (só para o limite, nunca desenhada):
 * o lago e o mar pelo contorno suave, o rio pelo traço com a largura dele.
 * "Barra a passagem" tira só o andar (`moveValidation.ts`), a visão continua.
 *
 * A água do recorte do jogador (`Agua.recorte`, sem pontos) não vira peça: o
 * limite é do host, que tem o mapa inteiro.
 */

/** Prefixo do id das peças de mentira (nunca colide com peça de verdade, que é uuid). */
export const PREFIXO_DA_PECA_DE_AGUA = 'agua:'

function pecaDaAgua(agua: Agua, grid: number): FloorPiece | null {
  if (agua.recorte !== undefined || agua.pontos.length < pontosMinimos(agua.tipo)) return null
  const xy = curvaGuardada(agua, grid)
  const pontos: { x: number; y: number }[] = []
  for (let i = 0; i + 1 < xy.length; i += 2) pontos.push({ x: xy[i], y: xy[i + 1] })
  if (pontos.length < 2) return null
  const base = { id: `${PREFIXO_DA_PECA_DE_AGUA}${agua.id}`, op: 'add' as const, modifiers: {}, ...(agua.piso === undefined ? {} : { piso: agua.piso }) }
  if (agua.tipo === 'rio') {
    const largura = larguraDoRio(agua) * grid
    return { ...base, shape: { kind: 'corridor', points: pontos.map((p) => ({ ...p, width: largura })) } }
  }
  return pontos.length < 3 ? null : { ...base, shape: { kind: 'poly', points: pontos } }
}

const semAsSecretas = new WeakMap<readonly Agua[], Agua[]>()

/**
 * As águas que limitam a VISÃO ENVIADA ao jogador (F-N13 da 0.5.62): nenhuma
 * com a camada Chão escondida dele (a água mora no Chão; as peças dela já saem
 * da visão dele, `pecasForaDaCamada` no recorte), e nunca a secreta. Contadas
 * como Chão, a visão dele saía recortada no formato da água que ele não recebe.
 * A mesma lista quando nada sai: o contorno do chão é guardado pela referência.
 */
export function aguasDaVisaoDoJogador(aguas: Agua[] | undefined, chaoAVista: boolean): Agua[] | undefined {
  if (!chaoAVista) return undefined
  if (aguas === undefined || !aguas.some((a) => a.secret === true)) return aguas
  const guardada = semAsSecretas.get(aguas)
  if (guardada !== undefined) return guardada
  const sem = aguas.filter((a) => a.secret !== true)
  semAsSecretas.set(aguas, sem)
  return sem
}

const guardadas = new WeakMap<readonly FloorPiece[], WeakMap<readonly Agua[], { grid: number; pecas: FloorPiece[] }>>()

/**
 * As peças que limitam com as águas do mapa no fim. Sem água, a MESMA lista
 * (quem guarda conta pela referência continua guardando); a mesma lista e as
 * mesmas águas devolvem a mesma lista de volta.
 */
export function comAguasComoChao(floor: FloorPiece[], aguas: readonly Agua[] | undefined, grid: number | undefined): FloorPiece[] {
  if (aguas === undefined || aguas.length === 0 || grid === undefined || grid <= 0) return floor
  let porAguas = guardadas.get(floor)
  const guardada = porAguas?.get(aguas)
  if (guardada !== undefined && guardada.grid === grid) return guardada.pecas
  const dasAguas = aguas.map((a) => pecaDaAgua(a, grid)).filter((p): p is FloorPiece => p !== null)
  const pecas = dasAguas.length === 0 ? floor : [...floor, ...dasAguas]
  if (porAguas === undefined) {
    porAguas = new WeakMap()
    guardadas.set(floor, porAguas)
  }
  porAguas.set(aguas, { grid, pecas })
  return pecas
}
