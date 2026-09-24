/**
 * LUGARES (painel do jogador): o snapshot leva `place`, um id que o HOST
 * inventa para a memória DESTE jogador naquela cena, e `places`, os ids das
 * memórias que ele ainda tem. É o que deixa a tela dele guardar a miniatura de
 * cada lugar por onde passou — só com o que ele mesmo explorou — sem nunca
 * receber o nome nem o id da cena. O pino que a névoa esconde continua fora do
 * recorte, e portanto fora da lista de pontos conhecidos.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function pino(id: string, x: number, y: number, description: string): Pin {
  return { id, x, y, kind: 'exclamacao', description, image: null }
}

function mapa(id: string, nome: string, tokens: Token[], pins: Pin[] = []): MapData {
  return { ...createEmptyMap(id, nome, 30, 10, 50), tokens, pins }
}

function mesa() {
  let n = 0
  return createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
}

function entra(s: ReturnType<typeof mesa>, clientId: string, nome: string, token: string, source: MapData | HostWorld): string {
  const r = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, source)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, token)
  return welcome.playerId
}

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

function snapshotDe(r: HostResult, clientId: string): Snapshot {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

const salao = mapa('m-salao', 'Salao Norte', [ficha('heroi', 100, 100), ficha('outra', 150, 100)])
const cripta = mapa('m-cripta', 'Cripta Rubra', [])
const mundo: HostWorld = {
  open: { sceneId: 's-a', name: 'Salao Norte', publicName: 'Corredor', map: salao },
  background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: cripta }],
}
const naCripta: HostWorld = {
  open: { sceneId: 's-a', name: 'Salao Norte', publicName: 'Corredor', map: { ...salao, tokens: [ficha('outra', 150, 100)] } },
  background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: { ...cripta, tokens: [ficha('heroi', 750, 250)] } }],
}

describe('Lugares: o id de lugar que vai no snapshot', () => {
  it('é um id do host, que não diz o nome nem o id da cena, e já vem na lista de lugares lembrados', () => {
    const s = mesa()
    entra(s, 'c1', 'Eva', 'heroi', mundo)
    const snap = snapshotDe(s.broadcast(mundo), 'c1')
    expect(typeof snap.place).toBe('string')
    expect(snap.place?.length).toBeGreaterThan(0)
    for (const segredo of ['s-a', 's-b', 'm-salao', 'm-cripta', 'Salao Norte', 'Cripta Rubra', 'Corredor']) {
      expect(snap.place).not.toContain(segredo)
    }
    expect(snap.places).toEqual([snap.place])
  })

  it('viajar dá outro lugar, voltar devolve o MESMO, e a lista guarda os dois na ordem da visita', () => {
    const s = mesa()
    const eva = entra(s, 'c1', 'Eva', 'heroi', mundo)
    const noSalao = snapshotDe(s.broadcast(mundo), 'c1').place
    s.sendPlayer(eva, 's-b', null, mundo)
    const snapCripta = snapshotDe(s.broadcast(naCripta), 'c1')
    expect(snapCripta.place).not.toBe(noSalao)
    expect(snapCripta.places).toEqual([noSalao, snapCripta.place])
    // Nada da cena de antes vai junto: nem nome, nem o id dela.
    expect(JSON.stringify(snapCripta)).not.toContain('Salao Norte')
    expect(JSON.stringify(snapCripta)).not.toContain('m-salao')

    s.sendPlayer(eva, 's-a', null, naCripta)
    const devolta = snapshotDe(s.broadcast(mundo), 'c1')
    expect(devolta.place).toBe(noSalao)
    expect(devolta.places).toEqual([snapCripta.place, noSalao])
  })

  it('o id é um contador de cada jogador: o mesmo id em dois jogadores não diz que estão no mesmo lugar', () => {
    const s = mesa()
    entra(s, 'c1', 'Eva', 'heroi', mundo)
    // Bruno começa na Cripta, Eva no Salão: cenas diferentes, e o primeiro lugar de cada um tem o mesmo id.
    const separados: HostWorld = {
      open: { sceneId: 's-a', name: 'Salao Norte', map: salao },
      background: [{ sceneId: 's-b', name: 'Cripta Rubra', map: { ...cripta, tokens: [ficha('bruno', 750, 250)] } }],
    }
    entra(s, 'c2', 'Bruno', 'bruno', separados)
    const r = s.broadcast(separados)
    const eva = snapshotDe(r, 'c1')
    const bruno = snapshotDe(r, 'c2')
    expect(eva.map.id).toBe('m-salao')
    expect(bruno.map.id).toBe('m-cripta')
    expect(eva.place).toBe(bruno.place)
    // A lista de cada um só tem os lugares DELE.
    expect(eva.places).toEqual([eva.place])
    expect(bruno.places).toEqual([bruno.place])
  })

  it('"Esconder planta" esquece o lugar: a volta tem id novo e o antigo sai da lista', () => {
    const s = mesa()
    const eva = entra(s, 'c1', 'Eva', 'heroi', mundo)
    const antes = snapshotDe(s.broadcast(mundo), 'c1').place
    s.hidePlan(eva)
    const depois = snapshotDe(s.broadcast(mundo), 'c1')
    expect(depois.place).toBeDefined()
    expect(depois.place).not.toBe(antes)
    expect(depois.places).toEqual([depois.place])
  })
})

describe('Lugares: pontos conhecidos são os pinos do recorte', () => {
  it('"Portas do Templo" à vista chega; o pino na névoa não chega, nem o texto dele', () => {
    const templo = pino('pt', 300, 150, 'Portas do Templo\nGrandes, de bronze.')
    const escondido = pino('pn', 1450, 450, 'Cofre do Barao')
    const comPinos: MapData = { ...salao, pins: [templo, escondido] }
    const s = mesa()
    entra(s, 'c1', 'Eva', 'heroi', comPinos)
    const r = s.broadcast(comPinos)
    const snap = snapshotDe(r, 'c1')
    expect(snap.map.pins.map((p) => p.id)).toEqual(['pt'])
    expect(snap.map.pins[0]?.description).toBe('Portas do Templo\nGrandes, de bronze.')
    const tudo = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
    expect(tudo).not.toContain('Cofre do Barao')
    expect(tudo).not.toContain('"pn"')
  })
})
