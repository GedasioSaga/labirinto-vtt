/**
 * TEXTO DA SALA AO ENTRAR: o mestre escreve "Ao entrar, o jogador lê" e a
 * "Nota do mestre" numa Sala. Na PRIMEIRA entrada, só aquele jogador recebe o
 * cartão (`room.text`); sair e voltar não repete. A nota nunca sai, e o texto
 * não entra no pacote de quem está fora.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Region, RoomMeta, Token } from '../types/map'
import { createHostSession, type HostResult } from './hostSession'

const CODE = 'AB12CD'
const TEXTO = 'Cheiro de pão queimado. Uma panela ainda borbulha no fogão.'
const NOTA = 'SEGREDO-DO-MESTRE: a panela é um mímico.'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, x: number, y: number, w: number, h: number, room: Partial<RoomMeta> = {}, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
    ],
    tag: '',
    fillColor: '#3a7ad0',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Cozinha', ...room },
    ...extra,
  }
}

/** Cozinha (100..400) com texto e nota; corredor à direita, sem sala. */
function mapa(tokens: Token[], regions: Region[] = [sala('cozinha', 100, 100, 300, 300, { textoAoEntrar: TEXTO, notaDoMestre: NOTA })]): MapData {
  return { ...createEmptyMap('m-casa', 'Casa', 30, 10, 50), tokens, regions }
}

function entra(s: ReturnType<typeof createHostSession>, clientId: string, name: string, map: MapData): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function para(r: HostResult, clientId: string) {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function cartoes(r: HostResult, clientId: string) {
  return para(r, clientId).filter((m) => m.type === 'room.text')
}

/** Carla na Cozinha, Enzo no corredor (vê a sala de fora), Bruno longe. */
function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const carla = entra(s, 'c-carla', 'Carla', map)
  const enzo = entra(s, 'c-enzo', 'Enzo', map)
  const bruno = entra(s, 'c-bruno', 'Bruno', map)
  s.assignToken(carla, 'carla')
  s.assignToken(enzo, 'enzo')
  s.assignToken(bruno, 'bruno')
  return s
}

const LA_FORA = [ficha('carla', 250, 250), ficha('enzo', 700, 250), ficha('bruno', 1400, 250)]

describe('texto da sala ao entrar', () => {
  it('Carla entra na Cozinha: cartão "Cozinha" só para ela; Enzo no corredor não recebe nada', () => {
    const map = mapa(LA_FORA)
    const r = mesa(map).broadcast(map)
    expect(cartoes(r, 'c-carla')).toEqual([{ type: 'room.text', id: 'cozinha', title: 'Cozinha', text: TEXTO }])
    expect(cartoes(r, 'c-enzo')).toEqual([])
    expect(cartoes(r, 'c-bruno')).toEqual([])
  })

  it('o cartão chega DEPOIS do snapshot (o mapa já tem a sala quando o cartão abre); a pista dele vem logo atrás', () => {
    const map = mapa(LA_FORA)
    const tipos = para(mesa(map).broadcast(map), 'c-carla').map((m) => m.type)
    expect(tipos).toEqual(['snapshot', 'room.text', 'clue.added'])
  })

  it('sai e volta: não repete', () => {
    const s = mesa(mapa(LA_FORA))
    const dentro = mapa(LA_FORA)
    expect(cartoes(s.broadcast(dentro), 'c-carla')).toHaveLength(1)
    // Parada lá dentro: o broadcast seguinte não repete.
    expect(cartoes(s.broadcast(dentro), 'c-carla')).toEqual([])
    const fora = mapa([ficha('carla', 600, 250), ficha('enzo', 700, 250), ficha('bruno', 1400, 250)])
    expect(cartoes(s.broadcast(fora), 'c-carla')).toEqual([])
    expect(cartoes(s.broadcast(dentro), 'c-carla')).toEqual([])
  })

  it('Bruno entra depois: recebe o dele', () => {
    const s = mesa(mapa(LA_FORA))
    s.broadcast(mapa(LA_FORA))
    const brunoDentro = mapa([ficha('carla', 250, 250), ficha('enzo', 700, 250), ficha('bruno', 300, 300)])
    const r = s.broadcast(brunoDentro)
    expect(cartoes(r, 'c-bruno')).toEqual([{ type: 'room.text', id: 'cozinha', title: 'Cozinha', text: TEXTO }])
    expect(cartoes(r, 'c-carla')).toEqual([])
  })

  it('recorte: nota nunca sai; texto não está no pacote de quem está fora, e está no de quem entrou', () => {
    const map = mapa(LA_FORA)
    const r = mesa(map).broadcast(map)
    for (const cliente of ['c-carla', 'c-enzo', 'c-bruno']) {
      expect(JSON.stringify(para(r, cliente))).not.toContain('SEGREDO-DO-MESTRE')
      expect(JSON.stringify(para(r, cliente))).not.toContain('notaDoMestre')
    }
    const snapEnzo = para(r, 'c-enzo').find((m) => m.type === 'snapshot')
    // Enzo VÊ a sala (a planta sai), mas não o texto dela.
    expect(snapEnzo?.type === 'snapshot' ? snapEnzo.map.regions.map((reg) => reg.id) : []).toEqual(['cozinha'])
    expect(JSON.stringify(snapEnzo)).not.toContain('pão queimado')
    expect(JSON.stringify(para(r, 'c-bruno'))).not.toContain('pão queimado')
    // Quem entrou leva o texto no snapshot: é o que deixa tocar o rótulo e reabrir.
    const snapCarla = para(r, 'c-carla').find((m) => m.type === 'snapshot')
    expect(snapCarla?.type === 'snapshot' ? snapCarla.map.regions[0]?.room?.textoAoEntrar : undefined).toBe(TEXTO)
  })

  it('quem já entrou continua com o texto no snapshot depois de sair (tocar o rótulo reabre)', () => {
    const s = mesa(mapa(LA_FORA))
    s.broadcast(mapa(LA_FORA))
    const fora = mapa([ficha('carla', 600, 250), ficha('enzo', 700, 250), ficha('bruno', 1400, 250)])
    const snap = para(s.broadcast(fora), 'c-carla').find((m) => m.type === 'snapshot')
    expect(snap?.type === 'snapshot' ? snap.map.regions[0]?.room?.textoAoEntrar : undefined).toBe(TEXTO)
  })

  it('reconectar dentro da sala já visitada não repete o cartão', () => {
    const map = mapa(LA_FORA)
    const s = mesa(map)
    const primeiro = s.broadcast(map)
    const welcome = para(primeiro, 'c-carla')
    expect(welcome.some((m) => m.type === 'room.text')).toBe(true)
    s.disconnect('c-carla')
    // Mesmo playerId pelo resumeToken: id-2 é o resume da Carla (id-1 é o playerId).
    const volta = s.handleMessage('c-carla-2', { type: 'join', code: CODE, name: 'Carla', resume: 'id-2' }, map)
    expect(volta.outbound.some((o) => o.msg.type === 'room.text')).toBe(false)
  })

  it('sala secreta não dispara nem manda o texto', () => {
    const map = mapa(LA_FORA, [sala('cozinha', 100, 100, 300, 300, { textoAoEntrar: TEXTO, notaDoMestre: NOTA }, { secret: true })])
    const r = mesa(map).broadcast(map)
    expect(cartoes(r, 'c-carla')).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('pão queimado')
  })

  it('sala dentro de zona oculta ativa não dispara nem manda o texto', () => {
    const base = mapa(LA_FORA)
    const map: MapData = {
      ...base,
      concealZones: [
        {
          id: 'z1',
          name: 'escuro',
          revealed: false,
          points: [
            { x: 50, y: 50 },
            { x: 450, y: 50 },
            { x: 450, y: 450 },
            { x: 50, y: 450 },
          ],
        },
      ],
    }
    const r = mesa(map).broadcast(map)
    expect(cartoes(r, 'c-carla')).toEqual([])
    expect(JSON.stringify(r.outbound)).not.toContain('pão queimado')
  })

  it('sala sem texto não manda cartão, e escrever o texto depois dispara para quem já está lá', () => {
    const semTexto = mapa(LA_FORA, [sala('cozinha', 100, 100, 300, 300)])
    const s = mesa(semTexto)
    expect(cartoes(s.broadcast(semTexto), 'c-carla')).toEqual([])
    expect(cartoes(s.broadcast(mapa(LA_FORA)), 'c-carla')).toHaveLength(1)
  })

  it('texto só de espaços não dispara; nome oculto vira título vazio', () => {
    const branco = mapa(LA_FORA, [sala('cozinha', 100, 100, 300, 300, { textoAoEntrar: '   ' })])
    expect(cartoes(mesa(branco).broadcast(branco), 'c-carla')).toEqual([])
    const semNome = mapa(LA_FORA, [sala('cozinha', 100, 100, 300, 300, { textoAoEntrar: TEXTO, nameHiddenFromPlayers: true })])
    expect(cartoes(mesa(semNome).broadcast(semNome), 'c-carla')).toEqual([{ type: 'room.text', id: 'cozinha', title: '', text: TEXTO }])
  })
})
