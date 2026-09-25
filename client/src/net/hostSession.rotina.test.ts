/**
 * ROTINA DO NPC pela rede. A Gabi está na Capela ao lado do Irmão Tobias. O
 * mestre toca o apito do Meio e o Tobias vai para o Confessionário, que é OUTRA
 * cena. A Gabi vê o Tobias antes e deixa de receber a ficha dele depois; nenhum
 * snapshot leva a rotina, o estado, o turno, a cena do posto nem a posição do
 * Tobias lá longe.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { moverNaCena, planejarRotina } from '../lib/rotinaDoNpc'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'APITO1'
const APITO = 'estado_apito_secreto'

const tobias: Token = {
  id: 'tobias',
  characterId: null,
  name: 'Irmão Tobias',
  x: 200,
  y: 100,
  size: 1,
  image: null,
  npc: true,
  rotina: {
    estadoId: APITO,
    postos: [
      { valor: 'AuroraSecreta', sceneId: 's-capela', x: 200, y: 100 },
      { valor: 'MeioSecreto', sceneId: 's-conf', x: 777, y: 333 },
      { valor: 'BrasaSecreta', sceneId: 's-capela', x: 250, y: 150 },
    ],
  },
}
const gabi: Token = { id: 'gabi', characterId: null, name: 'Gabi', x: 100, y: 100, size: 1, image: null }

function mapa(id: string, nome: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens }
}

function mundo(capela: MapData, conf: MapData): HostWorld {
  return { open: { sceneId: 's-capela', name: 'Capela', map: capela }, background: [{ sceneId: 's-conf', name: 'Confessionário 77', map: conf }] }
}

/** O apito no mundo do host: o mesmo plano que o editor aplica (`useAdventureStore.trocarEstadoDoMundo`). */
function tocar(world: HostWorld, valor: string): HostWorld {
  const cenas = [world.open, ...world.background].map((s) => ({ sceneId: s.sceneId ?? '', map: s.map }))
  const movimentos = planejarRotina(cenas, APITO, valor)
  const mover = (scene: HostWorld['open']): HostWorld['open'] => {
    const id = scene.sceneId ?? ''
    const saem = new Set(movimentos.filter((m) => m.de === id && m.para !== id).map((m) => m.tokenId))
    const chegam = movimentos.filter((m) => m.para === id && m.de !== id)
    const origem = new Map(cenas.flatMap((c) => c.map.tokens.map((t): [string, Token] => [t.id, t])))
    const ficam = moverNaCena(scene.map, movimentos).tokens.filter((t) => !saem.has(t.id))
    const novos = chegam.flatMap((m) => {
      const t = origem.get(m.tokenId)
      return t === undefined ? [] : [{ ...t, x: m.x, y: m.y }]
    })
    return { ...scene, map: { ...scene.map, tokens: [...ficam, ...novos] } }
  }
  return { open: mover(world.open), background: world.background.map(mover) }
}

function mesaCom(world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Gabi' }, world).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'gabi')
  return s
}

function snapshotDa(r: HostResult) {
  const msg = r.outbound.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para a Gabi')
  return msg
}

function semNadaDaRotina(r: HostResult) {
  const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
  expect(texto).not.toContain('rotina')
  expect(texto).not.toContain(APITO)
  expect(texto).not.toContain('AuroraSecreta')
  expect(texto).not.toContain('MeioSecreto')
  expect(texto).not.toContain('BrasaSecreta')
  expect(texto).not.toContain('s-conf')
  expect(texto).not.toContain('Confessionário 77')
  // O ponto do posto do Meio (777, 333) não chega em ficha nenhuma. Número solto
  // não serve de prova: o polígono da visão tem coordenadas quebradas quaisquer.
  expect(snapshotDa(r).map.tokens.some((t) => t.x === 777 && t.y === 333)).toBe(false)
}

describe('hostSession: o apito move o NPC e o jogador recebe só o efeito', () => {
  it('antes do apito: a Gabi vê o Tobias ao lado, sem a rotina', () => {
    const w = mundo(mapa('m-capela', 'Capela', [gabi, tobias]), mapa('m-conf', 'Confessionário 77', []))
    const s = mesaCom(w)
    const r = s.broadcast(w)
    expect(snapshotDa(r).map.tokens.map((t) => t.id)).toEqual(['gabi', 'tobias'])
    semNadaDaRotina(r)
  })

  it('apito da Brasa (mesma cena): o Tobias chega no novo lugar, ainda sem a rotina', () => {
    const w = mundo(mapa('m-capela', 'Capela', [gabi, tobias]), mapa('m-conf', 'Confessionário 77', []))
    const s = mesaCom(w)
    s.broadcast(w)
    const r = s.broadcast(tocar(w, 'BrasaSecreta'))
    expect(snapshotDa(r).map.tokens.find((t) => t.id === 'tobias')).toEqual(expect.objectContaining({ x: 250, y: 150 }))
    semNadaDaRotina(r)
  })

  it('apito do Meio (outra cena): o Tobias sai da Capela e a Gabi não recebe onde ele foi parar', () => {
    const w = mundo(mapa('m-capela', 'Capela', [gabi, tobias]), mapa('m-conf', 'Confessionário 77', []))
    const s = mesaCom(w)
    s.broadcast(w)
    const depois = tocar(w, 'MeioSecreto')
    // O mundo do mestre mudou de verdade: o Tobias está no Confessionário.
    expect(depois.background[0].map.tokens.map((t) => t.id)).toEqual(['tobias'])
    const r = s.broadcast(depois)
    expect(snapshotDa(r).map.tokens.map((t) => t.id)).toEqual(['gabi'])
    semNadaDaRotina(r)
  })
})
