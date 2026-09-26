/**
 * LEVAR FICHA JUNTO + ALARME PARA VÁRIAS CENAS (a união das duas features):
 * a Ana leva a ficha da Bia (ferida) pelo pino. A Bia não pediu a viagem — o
 * mestre a levou junto (`scene.changed` com `by: 'master'`) —, mas a tela dela
 * precisa seguir a cena da ficha: chegar numa cena com alarme soando mostra o
 * alarme, e sair da única cena do alarme o encerra. Quem ficou para trás não
 * recebe nada.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import type { AppliedTransfer, HostResult, HostWorld } from './hostSession'
import { createHostSession } from './hostSession'

const CODE = 'AB12CD'
const GRID = 50
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function viagem(id: string, x: number, y: number, destino: Pin['destino']): Pin {
  return { id, x, y, kind: 'viagem', description: '', image: null, destino, passagem: 'livre' }
}

function salao(tokens: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-salao', 'Salão Nobre', 40, 10, GRID),
    tokens,
    // A escada encostada na Ana (50 px): o pino de viagem só atravessa de perto.
    pins: [viagem('escada', 175, 225, { sceneId: CRIPTA, pinId: 'escada-b' })],
  }
}

function cripta(tokens: Token[]): MapData {
  return {
    ...createEmptyMap('mapa-cripta', 'Cripta Rubra', 40, 10, GRID),
    tokens,
    pins: [viagem('escada-b', 1025, 275, { sceneId: SALAO, pinId: 'escada' })],
  }
}

/** Antes da viagem: Ana, a ferida (da Bia, levada pela Ana) e o Caio no Salão. */
function antes(): HostWorld {
  const tokens = [ficha('ana', 225, 225), ficha('ferida', 275, 225, { levadoPor: 'ana' }), ficha('caio', 225, 325)]
  return {
    open: { sceneId: SALAO, name: 'Salão Nobre', map: salao(tokens) },
    background: [{ sceneId: CRIPTA, name: 'Cripta Rubra', map: cripta([]) }],
  }
}

/**
 * O que o integrador faz com a transferência (`hostBridge.applyTransferAlong`):
 * a ficha de quem leva e cada levada saem do Salão e assentam na Cripta.
 */
function depois(w: HostWorld, transfer: AppliedTransfer): HostWorld {
  const destinos = new Map<string, { x: number; y: number }>([[transfer.tokenId, { x: transfer.x, y: transfer.y }]])
  for (const levada of transfer.junto ?? []) destinos.set(levada.tokenId, { x: levada.x, y: levada.y })
  const ficam = w.open.map.tokens.filter((t) => !destinos.has(t.id))
  const vao = w.open.map.tokens.flatMap((t) => {
    const destino = destinos.get(t.id)
    return destino === undefined ? [] : [{ ...t, ...destino }]
  })
  const [fundo] = w.background
  return {
    open: { ...w.open, map: { ...w.open.map, tokens: ficam } },
    background: [{ ...fundo, map: { ...fundo.map, tokens: vao } }],
  }
}

function playerIdOf(r: HostResult): string {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

/** Ana (c1) leva a ferida, que é a ficha da Bia (c2); Caio (c3) fica no Salão. */
function mesa(w: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ana = playerIdOf(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, w))
  const bia = playerIdOf(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bia' }, w))
  const caio = playerIdOf(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Caio' }, w))
  s.assignToken(ana, 'ana')
  s.assignToken(bia, 'ferida')
  s.assignToken(caio, 'caio')
  s.broadcast(w)
  return s
}

/** A Ana atravessa a escada levando a ferida; devolve o mundo já com a transferência aplicada. */
function atravessa(s: ReturnType<typeof createHostSession>, w: HostWorld): HostWorld {
  const r = s.handleMessage('c1', { type: 'pin.travel.request', pinId: 'escada' }, w)
  const transfer = r.applyTransfer
  if (transfer === undefined) throw new Error('a passagem livre deveria valer')
  expect(transfer.junto?.map((j) => j.tokenId)).toEqual(['ferida'])
  expect(r.outbound).toContainEqual({ clientId: 'c2', msg: { type: 'scene.changed', by: 'master' } })
  return depois(w, transfer)
}

function alarmesPara(r: HostResult, clientId: string) {
  return r.outbound.filter((o) => o.clientId === clientId && (o.msg.type === 'scene.alarm' || o.msg.type === 'scene.alarm.end')).map((o) => o.msg)
}

describe('levar ficha junto + alarme para várias cenas', () => {
  it('a Bia, levada pela Ana para a Cripta, passa a ver o alarme que soa lá — e o Caio, que ficou, não', () => {
    const w = antes()
    const s = mesa(w)
    // O alarme soa só na Cripta: ninguém está lá ainda, ninguém recebe.
    const soou = s.sceneAlarm([CRIPTA], 'Os mortos acordaram!', w)
    expect(soou.outbound).toEqual([])
    const id = s.activeAlarm()?.id
    if (id === undefined) throw new Error('o alarme deveria estar soando')

    const chegada = s.broadcast(atravessa(s, w))
    expect(alarmesPara(chegada, 'c2')).toEqual([{ type: 'scene.alarm', id, text: 'Os mortos acordaram!' }])
    expect(alarmesPara(chegada, 'c1')).toEqual([{ type: 'scene.alarm', id, text: 'Os mortos acordaram!' }])
    expect(alarmesPara(chegada, 'c3')).toEqual([])
    // O aviso sai DEPOIS do snapshot da Bia: a tela já desenha a Cripta quando o texto aparece.
    const daBia = chegada.outbound.filter((o) => o.clientId === 'c2').map((o) => o.msg.type)
    expect(daBia.indexOf('snapshot')).toBeGreaterThanOrEqual(0)
    expect(daBia.indexOf('scene.alarm')).toBeGreaterThan(daBia.indexOf('snapshot'))
  })

  it('alarme só no Salão: levada para a Cripta, a Bia recebe o fim; o Caio, que ficou, continua com ele', () => {
    const w = antes()
    const s = mesa(w)
    const soou = s.sceneAlarm([SALAO], 'Fogo no salão!', w)
    const id = s.activeAlarm()?.id
    if (id === undefined) throw new Error('o alarme deveria estar soando')
    expect(alarmesPara(soou, 'c2')).toEqual([{ type: 'scene.alarm', id, text: 'Fogo no salão!' }])

    const chegada = s.broadcast(atravessa(s, w))
    expect(alarmesPara(chegada, 'c2')).toEqual([{ type: 'scene.alarm.end', id }])
    expect(alarmesPara(chegada, 'c1')).toEqual([{ type: 'scene.alarm.end', id }])
    // O Caio já mostra o alarme e continua no Salão: nada novo viaja para ele.
    expect(alarmesPara(chegada, 'c3')).toEqual([])
    expect(s.activeAlarm()).toEqual({ id, text: 'Fogo no salão!', sceneIds: [SALAO] })
  })
})
