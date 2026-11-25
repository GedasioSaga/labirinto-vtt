import type { MapData, TokenContract } from '../types/map'
import { fichasCegasDoMapa } from './cegueira/fichasCegas'
import { playerEyeTokens, raioDaFichaParaOMestre } from './fogFilter'
import { corDoPino } from './marcadorDeContinente'

/**
 * VISÃO DOS JOGADORES (pedido do mestre de 25/11/2026): qual anel cada ficha de
 * jogador ganha no editor do mestre. Puro: sem Pixi, sem store.
 *
 * Só ficha que é OLHO de um jogador (`playerEyeTokens`: dele na posse da sala,
 * na camada que os jogadores veem, não guardada pelo mestre e sem acordo "sem
 * visão"), do piso em edição. NPC sem dono fica de fora; o NPC que o mestre deu
 * a um jogador entra, porque dá visão a ele. O raio é o que o jogador enxerga
 * agora (`raioDaFichaParaOMestre` sobre o raio que a sessão aplica), sem
 * recorte de parede.
 */

export interface AnelDaVisao {
  tokenId: string
  /** Centro da ficha, em px de mundo. */
  x: number
  y: number
  /** Raio efetivo, em px de mundo (sempre > 0). */
  raio: number
  /** Cor do pino do dono (`corDoPino`), `#rrggbb`. */
  cor: string
  /** Ficha cega: o raio já é a metade, e o rótulo avisa. */
  cega: boolean
}

export interface EntradaDosAneis {
  /** O mapa INTEIRO da cena: é nele que a sessão mede o raio e acha quem é cego. */
  mapa: MapData
  /** O mapa do piso em edição (`mapaDoPiso`): só as fichas dele ganham anel. */
  mapaDoPiso: MapData
  /** Id do jogador → fichas (`donosDasFichasStore`). */
  posse: Readonly<Record<string, readonly string[]>>
  /** Acordo de cada ficha emprestada (`visaoDosJogadoresStore`). */
  acordos: ReadonlyMap<string, TokenContract>
  /** Raio que a sessão aplica a cada ficha com dono (`HostSession.tokenVisionRadii`). Sem raio, sem anel. */
  raios: ReadonlyMap<string, number>
  /** Ids dos personagens com Cegueira (`personagensCegos`). */
  cegos: ReadonlySet<string>
}

export function aneisDaVisao({ mapa, mapaDoPiso, posse, acordos, raios, cegos }: EntradaDosAneis): AnelDaVisao[] {
  const jogadores = Object.keys(posse)
  if (jogadores.length === 0 || raios.size === 0) return []
  // `playerEyeTokens` pede listas mutáveis; a posse da store é só leitura.
  const ownership: Record<string, string[]> = {}
  for (const playerId of jogadores) ownership[playerId] = [...(posse[playerId] ?? [])]
  const cegas = fichasCegasDoMapa(mapa, cegos)
  const aneis: AnelDaVisao[] = []
  const vistas = new Set<string>()
  for (const playerId of jogadores) {
    for (const token of playerEyeTokens(mapaDoPiso, playerId, ownership, acordos)) {
      // Posse é exclusiva; se viesse repetida, vale o primeiro dono, como no recorte.
      if (vistas.has(token.id)) continue
      vistas.add(token.id)
      const raioDoDono = raios.get(token.id)
      if (raioDoDono === undefined || !Number.isFinite(raioDoDono) || raioDoDono <= 0) continue
      const cega = cegas.has(token.id)
      const raio = raioDaFichaParaOMestre(mapaDoPiso, token, raioDoDono, cega)
      if (!Number.isFinite(raio) || raio <= 0) continue
      aneis.push({ tokenId: token.id, x: token.x, y: token.y, raio, cor: corDoPino(token, playerId), cega })
    }
  }
  return aneis
}
