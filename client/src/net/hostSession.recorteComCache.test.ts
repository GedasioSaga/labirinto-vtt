/**
 * F3 da otimização 200x200 (docs/planos/otimizacao-200x200-2026-10-27.md):
 * o recorte do jogador ganhou cache — os pontos de amostra dos desenhos e
 * salas por referência (`fogFilter.ts`) e o MESMO array de volta quando os
 * itens de um campo do mapa não mudaram (`hostSession.ts`), com o patch
 * resolvendo por identidade. Cache não pode mudar o que o jogador vê.
 *
 * A prova: o mestre arrasta um NPC por 30 posições no sintético 200x200, em
 * 3 estados de explorado (recém-chegado, depois de andar, planta conhecida).
 * Uma mesa COM cache manda patches; outra SEM cache manda o snapshot inteiro
 * a cada passo. A tela montada com os patches é igual ao snapshot, passo a passo.
 */
import { describe, expect, it } from 'vitest'
import { mapaSintetico } from '../../desempenho/mapaSintetico'
import { cacheDoRecorte } from '../lib/cacheDoRecorte'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'
import { applyViewPatch, type PlayerViewContent } from './viewPatch'

const CODE = 'MEDE01'
const RAIO = 500
const POSICOES = 30

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>
type Patch = Extract<HostMessage, { type: 'patch' }>
type Estado = 'recem-chegado' | 'depois-de-andar' | 'planta-conhecida'

const BASE = mapaSintetico({ lado: 200 })
const GRADE = BASE.grid
const NPC = BASE.tokens[0] as Token
const FICHA: Token = { id: 'ficha-do-jogador', characterId: null, name: 'Guarda', x: NPC.x + 3 * GRADE, y: NPC.y, size: 1, image: null }

/** O mapa como o mestre o tem: só a ficha que mexeu é objeto novo, o resto é a MESMA referência (como a store). */
function comFichas(map: MapData, mexer: Record<string, { x: number; y: number }>): MapData {
  return { ...map, tokens: map.tokens.map((t) => (mexer[t.id] === undefined ? t : { ...t, ...mexer[t.id] })) }
}

function mundo(map: MapData, estado: Estado): HostWorld {
  return { open: { sceneId: 's', name: 'Cena', map, ...(estado === 'planta-conhecida' ? { planKnownByAll: true } : {}) }, background: [] }
}

function mesa(map: MapData, estado: Estado, comPatch: boolean): HostSession {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}`, patchMinSnapshotLength: 0 })
  const fonte = mundo(map, estado)
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, fonte).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  if (comPatch) s.handleMessage('c1', { type: 'view.patches' }, fonte)
  s.assignToken(welcome.playerId, FICHA.id)
  return s
}

/** A tela que saiu para o jogador; `null` = nada saiu (a tela dele não mudou). */
function so(r: HostResult): HostMessage | null {
  const msgs = r.outbound.filter((o) => o.clientId === 'c1' && (o.msg.type === 'snapshot' || o.msg.type === 'patch')).map((o) => o.msg)
  if (msgs.length > 1) throw new Error(`esperava no máximo uma tela, vieram ${msgs.length}`)
  return msgs[0] ?? null
}

function telaDe(snap: Snapshot): PlayerViewContent {
  return { map: snap.map, vision: snap.vision, explored: snap.explored, ownTokens: snap.ownTokens, concealed: snap.concealed }
}

function aplica(tela: PlayerViewContent, patch: Patch): PlayerViewContent {
  const depois = applyViewPatch(tela, patch)
  if (depois === null) throw new Error('patch não encaixou na tela')
  return depois
}

const peloFio = (v: unknown): unknown => JSON.parse(JSON.stringify(v))

/** Roda `f` com o cache ligado ou desligado e devolve o resultado (o cache é do módulo). */
function com<T>(ligado: boolean, f: () => T): T {
  const antes = cacheDoRecorte.ligado
  cacheDoRecorte.ligado = ligado
  try {
    return f()
  } finally {
    cacheDoRecorte.ligado = antes
  }
}

describe('recorte com cache = recorte sem cache (sintético 200, 30 posições do NPC)', () => {
  for (const estado of ['recem-chegado', 'depois-de-andar', 'planta-conhecida'] as const) {
    it(`explorado ${estado}`, { timeout: 120_000 }, () => {
      let map: MapData = { ...BASE, tokens: [...BASE.tokens, FICHA] }
      const comCache = com(true, () => mesa(map, estado, true))
      const semCache = com(false, () => mesa(map, estado, false))
      let tela: PlayerViewContent | null = null
      let inteira: PlayerViewContent | null = null
      let patches = 0
      /** Um broadcast nas duas mesas; a tela montada com patches tem de ser a do snapshot inteiro. */
      const passo = (m: MapData): void => {
        const saiu = com(true, () => so(comCache.broadcast(mundo(m, estado))))
        const cheia = com(false, () => so(semCache.broadcast(mundo(m, estado))))
        if (cheia !== null) {
          if (cheia.type !== 'snapshot') throw new Error('sem cache deveria mandar snapshot')
          inteira = telaDe(cheia)
        }
        if (saiu !== null) {
          if (saiu.type === 'patch') {
            if (tela === null) throw new Error('patch sem tela anterior')
            patches += 1
            tela = aplica(tela, saiu)
          } else if (saiu.type === 'snapshot') tela = telaDe(saiu)
        }
        expect(tela).not.toBeNull()
        expect(peloFio(tela)).toEqual(peloFio(inteira))
      }
      passo(map)
      // DEPOIS DE ANDAR: a ficha do jogador passeia antes (o explorado cresce e a memória da planta entra).
      if (estado === 'depois-de-andar') {
        for (let i = 1; i <= 8; i += 1) {
          map = comFichas(map, { [FICHA.id]: { x: FICHA.x + (i % 4) * 2 * GRADE, y: FICHA.y + Math.floor(i / 2) * GRADE } })
          passo(map)
        }
      }
      for (let i = 1; i <= POSICOES; i += 1) {
        // Ida e volta em zigue-zague: o NPC entra e sai da visão do jogador.
        map = comFichas(map, { [NPC.id]: { x: NPC.x + ((i % 15) - 3) * GRADE, y: NPC.y + (Math.floor(i / 15) * 2 - 1) * GRADE } })
        passo(map)
      }
      // O cenário precisa de patch de verdade: sem ele a igualdade não testou o caminho do cache.
      expect(patches).toBeGreaterThan(0)
    })
  }
})
