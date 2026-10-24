import type { DoorKind, MapData, Wall } from '../types/map'
import type { Andarilho } from './caminhamento/andarilho'
import type { AvisoDoNpc } from './caminhamento/tiqueDosNpcs'
import { isPointInPolygon } from './selectionHitTest'

/**
 * AVISO AO MESTRE — a porta trancada que parou um NPC andando sozinho (rotina
 * ou patrulha), dito em português simples para a tela do mestre
 * (`components/AvisoDaRotina.tsx`): "Porta da sala Cozinha trancada: Guarda
 * parou". Puro: os stores passam o estado de quem anda e o mapa de cada ficha.
 *
 * O aviso aparece já no PRIMEIRO pedido de caminho que volta com a porta
 * trancada (o andarilho ainda vai tentar de novo antes de desistir), e não só
 * na desistência: no mapa grande a desistência leva 3 tentativas de 1 s.
 * Some quando a porta deixa de estar trancada ou quando ele passa (o trecho
 * acha caminho, ou ele chega aonde tinha desistido de ir).
 *
 * Estado da sessão, como o `aviso` de onde nasce: nunca vai à ficha, ao
 * arquivo nem ao jogador.
 */

/** Teto de avisos guardados: a tela mostra 3 e "e mais N"; um mapa com 30 NPCs presos não cresce sem fim. */
export const TETO_DE_AVISOS = 24

export type OrigemDoAviso = 'rotina' | 'patrulha'

export interface AvisoDePortaTrancada {
  /** `origem:tokenId:portaId` — um aviso por NPC e porta, estável entre tiques. */
  chave: string
  origem: OrigemDoAviso
  motivo: 'porta-trancada'
  tokenId: string
  portaId: string
  /** O nome da ficha, como o mestre o vê. */
  npc: string
  /** A porta dita para gente ("Porta da sala Cozinha"), nunca o id. */
  porta: string
}

/** O que conta, do estado de quem anda: o trecho de agora e o aviso de quando desistiu. */
export interface EstadoQueAvisa {
  readonly andarilho?: Andarilho
  readonly aviso?: AvisoDoNpc
}

/** As portas trancadas que param este NPC: a do pedido que acabou de voltar sem caminho e a da desistência. */
export function portasQueParam(estado: EstadoQueAvisa): readonly string[] {
  const portas = new Set<string>()
  const trecho = estado.andarilho
  // Trecho que já achou caminho zera `falhas`: a falha velha não segura o aviso.
  if (trecho !== undefined && trecho.fim === null && trecho.falhas > 0 && trecho.ultimaFalha?.motivo === 'porta-trancada') {
    for (const id of trecho.ultimaFalha.portas) portas.add(id)
  }
  if (estado.aviso?.motivo === 'porta-trancada') for (const id of estado.aviso.portas) portas.add(id)
  return [...portas]
}

const NOME_DO_TIPO: Readonly<Record<DoorKind, string>> = { normal: 'Porta', double: 'Porta dupla', gate: 'Grade' }

/** O nome da sala da porta: a da borda dela; senão a que tem o meio dela dentro. `null` sem sala com nome. */
function salaDaPorta(map: MapData, porta: Wall): string | null {
  const daBorda = porta.regionId === undefined ? undefined : map.regions.find((r) => r.id === porta.regionId)
  const nomeDaBorda = daBorda?.room?.name.trim() ?? ''
  if (nomeDaBorda !== '') return nomeDaBorda
  const meio = { x: (porta.x1 + porta.x2) / 2, y: (porta.y1 + porta.y2) / 2 }
  for (const regiao of map.regions) {
    const nome = regiao.room?.name.trim() ?? ''
    if (nome !== '' && isPointInPolygon(meio, regiao.points)) return nome
  }
  return null
}

/** "Porta da sala Cozinha", "Grade", "Porta dupla da sala Salão": como o mestre acha a porta no mapa. */
export function rotuloDaPorta(map: MapData, porta: Wall): string {
  const tipo = NOME_DO_TIPO[porta.door?.kind ?? 'normal']
  const sala = salaDaPorta(map, porta)
  return sala === null ? tipo : `${tipo} da sala ${sala}`
}

/** A frase da tela do mestre. */
export function textoDoAviso(aviso: Pick<AvisoDePortaTrancada, 'porta' | 'npc'>): string {
  return `${aviso.porta} trancada: ${aviso.npc} parou`
}

/**
 * Os avisos de quem anda (`andando`, na ordem dele), um por NPC e porta que
 * ainda está trancada no mapa onde a ficha está (`mapaDaFicha`), até o
 * `TETO_DE_AVISOS`. Ficha fora de qualquer mapa ou porta que sumiu: sem aviso.
 */
export function avisosDePortaTrancada(
  origem: OrigemDoAviso,
  andando: ReadonlyMap<string, EstadoQueAvisa>,
  mapaDaFicha: (tokenId: string) => MapData | undefined,
): AvisoDePortaTrancada[] {
  const avisos: AvisoDePortaTrancada[] = []
  for (const [tokenId, estado] of andando) {
    const portas = portasQueParam(estado)
    if (portas.length === 0) continue
    const map = mapaDaFicha(tokenId)
    const ficha = map?.tokens.find((t) => t.id === tokenId)
    if (map === undefined || ficha === undefined) continue
    for (const portaId of portas) {
      const porta = map.walls.find((w) => w.id === portaId)
      if (porta?.door?.locked !== true) continue
      const npc = ficha.name.trim() === '' ? 'NPC sem nome' : ficha.name.trim()
      avisos.push({ chave: `${origem}:${tokenId}:${portaId}`, origem, motivo: 'porta-trancada', tokenId, portaId, npc, porta: rotuloDaPorta(map, porta) })
      if (avisos.length >= TETO_DE_AVISOS) return avisos
    }
  }
  return avisos
}

/** Mesmos avisos, na mesma ordem e com o mesmo texto: o store não troca a lista e a tela não redesenha a cada tique. */
export function mesmosAvisos(a: readonly AvisoDePortaTrancada[], b: readonly AvisoDePortaTrancada[]): boolean {
  if (a.length !== b.length) return false
  return a.every((x, i) => {
    const y = b[i]
    return y !== undefined && x.chave === y.chave && x.npc === y.npc && x.porta === y.porta
  })
}
