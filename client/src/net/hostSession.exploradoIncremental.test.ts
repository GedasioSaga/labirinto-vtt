/**
 * F9 da otimização 200x200: quando a ficha do jogador anda, o `patch` levava o
 * explorado INTEIRO (~107 KB no mapa real) e a lista inteira de cada campo do
 * mapa que ganhou um item (paredes, desenhos...). Agora vão só os trechos do
 * explorado que mudaram (`exploredEdits`) e as listas item a item (`items`).
 *
 * A prova: a ficha do jogador anda 30 passos no sintético 200x200. Uma mesa
 * manda patches; outra, o snapshot inteiro a cada passo. A tela que o jogador
 * monta com os patches é igual ao snapshot, e o explorado no fio também.
 */
import { describe, expect, it } from 'vitest'
import { mapaSintetico } from '../../desempenho/mapaSintetico'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession } from './hostSession'
import type { HostMessage } from './protocol'
import { applyExploredEdits, applyMapPatch, applyStringEdits, stringEdits, type PlayerViewContent } from './viewPatch'

const CODE = 'MEDE01'
const RAIO = 500
const PASSOS = 30
/**
 * Cada patch fica abaixo de 1/10 do snapshot inteiro. A meta de 5 KB por passo
 * é do harness (`desempenho/metas-f9.ts`) e ainda não passa: a visão e os
 * pedaços de penhasco vão com o número inteiro (ver o relatório da F9).
 */
const FRACAO_DO_SNAPSHOT = 10

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>
type Patch = Extract<HostMessage, { type: 'patch' }>

const BASE = mapaSintetico({ lado: 200 })
const GRADE = BASE.grid
const NPC = BASE.tokens[0] as Token
const FICHA: Token = { id: 'ficha-do-jogador', characterId: null, name: 'Guarda', x: NPC.x + 3 * GRADE, y: NPC.y, size: 1, image: null }

function mesa(map: MapData, comPatch: boolean): HostSession {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  if (comPatch) s.handleMessage('c1', { type: 'view.patches' }, map)
  s.assignToken(welcome.playerId, FICHA.id)
  return s
}

function so(r: HostResult): HostMessage | null {
  const msgs = r.outbound.filter((o) => o.clientId === 'c1' && (o.msg.type === 'snapshot' || o.msg.type === 'patch')).map((o) => o.msg)
  if (msgs.length > 1) throw new Error(`esperava no máximo uma tela, vieram ${msgs.length}`)
  return msgs[0] ?? null
}

const telaDe = (snap: Snapshot): PlayerViewContent => ({ map: snap.map, vision: snap.vision, explored: snap.explored, ownTokens: snap.ownTokens, concealed: snap.concealed })

/** O que o jogador faz (`playerConnection.applyPatch`), passando pelo fio (JSON) como na rede. */
function aplica(tela: PlayerViewContent, bruto: Patch): PlayerViewContent {
  const patch = JSON.parse(JSON.stringify(bruto)) as Patch
  const map = patch.map === undefined ? tela.map : applyMapPatch(tela.map, patch.map)
  if (map === null) throw new Error('patch do mapa não encaixou')
  let explored = patch.explored ?? tela.explored
  if (patch.exploredEdits !== undefined) {
    const aplicado = applyExploredEdits(tela.explored, patch.exploredEdits)
    if (aplicado === null) throw new Error('trechos do explorado não encaixaram')
    explored = aplicado
  }
  return { map, vision: patch.vision ?? tela.vision, explored, ownTokens: patch.ownTokens ?? tela.ownTokens, concealed: patch.concealed ?? tela.concealed }
}

const peloFio = (v: unknown): unknown => JSON.parse(JSON.stringify(v))

describe('explorado e listas por trecho no patch (F9)', () => {
  it('30 passos da ficha do jogador: a tela com patches é a do snapshot, e cada patch fica abaixo de 1/10 do snapshot', { timeout: 120_000 }, () => {
    let map: MapData = { ...BASE, tokens: [...BASE.tokens, FICHA] }
    const comPatch = mesa(map, true)
    const inteira = mesa(map, false)
    const primeira = so(comPatch.broadcast(map))
    const cheia0 = so(inteira.broadcast(map))
    if (primeira?.type !== 'snapshot' || cheia0?.type !== 'snapshot') throw new Error('a primeira tela é o snapshot')
    let tela = telaDe(primeira)
    let ultima = telaDe(cheia0)
    const teto = JSON.stringify(primeira).length / FRACAO_DO_SNAPSHOT
    let comTrechos = 0
    const tamanhos: number[] = []
    /** Composição de cada patch acima do teto, para a falha dizer o que pesou. */
    const grandes: string[] = []
    for (let i = 1; i <= PASSOS; i += 1) {
      // Anda uma casa por passo, em zigue-zague para a direita e para baixo.
      map = { ...map, tokens: map.tokens.map((t) => (t.id === FICHA.id ? { ...t, x: FICHA.x + i * GRADE, y: FICHA.y + (i % 6) * GRADE } : t)) }
      const saiu = so(comPatch.broadcast(map))
      const cheia = so(inteira.broadcast(map))
      if (cheia !== null) {
        if (cheia.type !== 'snapshot') throw new Error('sem patch deveria mandar snapshot')
        ultima = telaDe(cheia)
      }
      if (saiu !== null) {
        if (saiu.type !== 'patch') throw new Error(`esperava patch, veio ${saiu.type}`)
        tamanhos.push(JSON.stringify(saiu).length)
        if (JSON.stringify(saiu).length > teto) {
          const partes = Object.entries(saiu).map(([k, v]) => `${k}=${JSON.stringify(v)?.length}`)
          const doMapa = saiu.map === undefined ? [] : [...Object.entries(saiu.map.set).map(([k, v]) => `set.${k}=${JSON.stringify(v).length}`), ...Object.entries(saiu.map.items ?? {}).map(([k, v]) => `items.${k}=${JSON.stringify(v).length}(${v.change.length}+${v.remove.length})`)]
          grandes.push(`passo ${i}: ${partes.join(' ')} | ${doMapa.join(' ')}`)
        }
        if (saiu.exploredEdits !== undefined) comTrechos += 1
        expect(saiu.explored !== undefined && saiu.exploredEdits !== undefined).toBe(false)
        tela = aplica(tela, saiu)
      }
      expect(peloFio(tela)).toEqual(peloFio(ultima))
    }
    // O caminho novo foi exercitado de verdade, e nenhum patch chega perto do snapshot inteiro.
    expect(comTrechos).toBeGreaterThan(PASSOS / 2)
    expect(grandes, `patches acima de ${Math.round(teto)} B`).toEqual([])
    expect(tamanhos.length).toBeGreaterThan(PASSOS / 2)
  })
})

describe('stringEdits / applyStringEdits', () => {
  const casos: Array<[string, string]> = [
    ['', ''],
    ['AAAA', 'AAAA'],
    ['AAAABBBBCCCC', 'AAAAXXXXCCCC'],
    ['AAAABBBBCCCC', 'ZAAABBBBCCCY'],
    ['AAAABBBB', 'AAAABBBBCCCC'],
    ['AAAABBBBCCCC', 'AAAABBBB'],
    ['AAAABBBB', 'QQQQ'],
    ['', 'AAAA'],
    ['A'.repeat(400), `${'A'.repeat(100)}B${'A'.repeat(200)}C${'A'.repeat(98)}`],
  ]
  for (const [antes, depois] of casos) {
    it(`"${antes.slice(0, 12)}" -> "${depois.slice(0, 12)}" (${antes.length} -> ${depois.length})`, () => {
      expect(applyStringEdits(antes, stringEdits(antes, depois))).toBe(depois)
    })
  }
  it('trecho fora do texto ou fora de ordem não encaixa', () => {
    expect(applyStringEdits('AAAA', [[2, 9, 'x']])).toBeNull()
    expect(applyStringEdits('AAAABBBB', [[4, 6, 'x'], [1, 2, 'y']])).toBeNull()
  })
})
