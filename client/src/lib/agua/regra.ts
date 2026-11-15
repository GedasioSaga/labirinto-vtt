import type { Agua, MapData, RegionPoint } from '../../types/map'
import { pisoDe } from '../pisos'
import { larguraDoRio } from './dados'
import { distanciaAoTraco, pontoNaAgua } from './forma'

/**
 * ÁGUA QUE BARRA (decisão do mestre de 12/11/2026): com "Barra a passagem"
 * ligada, a ficha do JOGADOR não entra naquela água; a visão passa por cima.
 * Quem já está dentro sai (não fica preso). A água secreta não barra: a
 * recusa contaria que ela existe. Nem a que o recorte nunca entrega a ele
 * (`escondida`: camada Chão escondida, zona oculta, a que mora na sala
 * secreta; `aguaEscondidaDosJogadores` em `lib/fogFilter.ts`).
 */

/** Entre duas amostras do trecho andado, em casas. */
const PASSO_DA_PROVA = 0.2

/**
 * A primeira água que barra o trecho de `de` a `ate` no piso `piso`, ou
 * `null`. A água em que a ficha já está não conta, nem o ponto `escondida` dela.
 */
export function aguaQueBarra(
  map: Pick<MapData, 'aguas' | 'grid'>,
  piso: number,
  de: RegionPoint,
  ate: RegionPoint,
  escondida: (agua: Agua, p: RegionPoint) => boolean = () => false,
): Agua | null {
  const aguas = (map.aguas ?? []).filter((a) => a.barra === true && a.secret !== true && a.recorte === undefined && pisoDe(a) === piso)
  if (aguas.length === 0) return null
  const grid = map.grid
  const comprimento = Math.hypot(ate.x - de.x, ate.y - de.y)
  const passos = Math.max(1, Math.ceil(comprimento / (grid * PASSO_DA_PROVA)))
  for (const agua of aguas) {
    if (pontoNaAgua(agua, grid, de.x, de.y)) continue
    for (let i = 1; i <= passos; i += 1) {
      const t = i / passos
      const p = { x: de.x + (ate.x - de.x) * t, y: de.y + (ate.y - de.y) * t }
      if (pontoNaAgua(agua, grid, p.x, p.y) && !escondida(agua, p)) return agua
    }
  }
  return null
}

/**
 * O ponto (px de mundo) está na água que o JOGADOR recebeu cortada
 * (`Agua.recorte`, sem os pontos)? O rio pelos trechos e a largura; o lago e
 * o mar pelas células conhecidas com água (uma casa: grosso, mas só escolhe a
 * frase da recusa).
 */
export function pontoNoRecorte(agua: Agua, grid: number, x: number, y: number): boolean {
  const r = agua.recorte
  if (r === undefined) return false
  if (agua.tipo === 'rio') {
    const meia = (larguraDoRio(agua) * grid) / 2
    return (r.trechos ?? []).some((t) => distanciaAoTraco(t.pontos, x, y) <= meia)
  }
  if (!(r.celula > 0) || r.celulas === undefined) return false
  return r.celulas.includes(`${Math.floor(x / r.celula)},${Math.floor(y / r.celula)}`)
}

/**
 * LAVA (15/11/2026): a primeira água que barra o trecho, entre as que o
 * jogador recebeu (o recorte). O host só diz `agua` na recusa (o protocolo não
 * mudou); a tela dele acha qual foi para dizer "A lava barra a passagem". A
 * água em que a ficha já está não conta, como em `aguaQueBarra`.
 */
export function aguaDoRecorteQueBarra(aguas: readonly Agua[] | undefined, grid: number, piso: number, de: RegionPoint, ate: RegionPoint): Agua | null {
  if (aguas === undefined || grid <= 0) return null
  const lista = aguas.filter((a) => a.barra === true && a.recorte !== undefined && pisoDe(a) === piso && !pontoNoRecorte(a, grid, de.x, de.y))
  if (lista.length === 0) return null
  const passos = Math.max(1, Math.ceil(Math.hypot(ate.x - de.x, ate.y - de.y) / (grid * PASSO_DA_PROVA)))
  // Amostra por amostra (a de fora), a primeira água que o trecho alcança.
  for (let i = 1; i <= passos; i += 1) {
    const t = i / passos
    const x = de.x + (ate.x - de.x) * t
    const y = de.y + (ate.y - de.y) * t
    const agua = lista.find((a) => pontoNoRecorte(a, grid, x, y))
    if (agua !== undefined) return agua
  }
  return null
}
