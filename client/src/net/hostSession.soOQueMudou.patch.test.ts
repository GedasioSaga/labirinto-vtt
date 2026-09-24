/**
 * SÓ O QUE MUDOU, de verdade. Filtrar QUEM recebe não bastava: com os 7
 * jogadores na mesma sala, cada passo ainda reenviava aos 7 o mapa inteiro com
 * a foto de todas as fichas. Agora quem diz no `join` que sabe aplicar recebe
 * o `patch` com a diferença da última tela dele (`net/viewPatch.ts`).
 *
 * E a edição otimista: o jogador aplica a foto nova na hora e conta com o
 * host para desfazê-la se não valer. Foto descartada pelo intervalo mínimo não
 * muda a tela de ninguém para o host — sem resposta, a tela do jogador ficava
 * com a foto que ninguém mais via.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'
import { applyMapPatch, type PlayerViewContent } from './viewPatch'

const CODE = 'AB12CD'
const RAIO = 500
const FOTO = `data:image/webp;base64,${'B'.repeat(40_000)}`
const NOMES = ['ana', 'bia', 'caio', 'duda', 'edu', 'fabi', 'gil']

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>
type Patch = Extract<HostMessage, { type: 'patch' }>

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** 30x30 células de 40 px = 1200x1200 px. */
function mapa(id: string, tokens: Token[], walls: Wall[] = []): MapData {
  return { ...createEmptyMap(id, id, 30, 30, 40), tokens, walls }
}

function mundo(salao: MapData, cripta: MapData): HostWorld {
  return {
    open: { sceneId: 's-salao', name: 'Salao', map: salao },
    background: [{ sceneId: 's-cripta', name: 'Cripta', map: cripta }],
  }
}

function novaSessao(now: () => number = () => 0): HostSession {
  let n = 0
  return createHostSession({ code: CODE, visionRadius: RAIO, now, randomId: () => `id-${(n += 1)}` })
}

function entra(s: HostSession, clientId: string, nome: string, source: MapData | HostWorld, patch: boolean): string {
  const join = patch ? { type: 'join', code: CODE, name: nome, patch: true } : { type: 'join', code: CODE, name: nome }
  const welcome = s.handleMessage(clientId, join, source).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome.playerId
}

function paraCliente(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function snapshotPara(r: HostResult, clientId: string): Snapshot {
  const msgs = paraCliente(r, clientId)
  const msg = msgs[0]
  if (msgs.length !== 1 || msg?.type !== 'snapshot') throw new Error(`esperava um snapshot para ${clientId}, veio ${JSON.stringify(msgs.map((m) => m.type))}`)
  return msg
}

function patchPara(r: HostResult, clientId: string): Patch {
  const msgs = paraCliente(r, clientId)
  const msg = msgs[0]
  if (msgs.length !== 1 || msg?.type !== 'patch') throw new Error(`esperava um patch para ${clientId}, veio ${JSON.stringify(msgs.map((m) => m.type))}`)
  return msg
}

function telaDe(snap: Snapshot): PlayerViewContent {
  return { map: snap.map, vision: snap.vision, explored: snap.explored, ownTokens: snap.ownTokens, concealed: snap.concealed }
}

/** O que o jogador faz com o patch: aplica na última tela. Campo ausente = não mudou. */
function aplicaTela(tela: PlayerViewContent, patch: Patch): PlayerViewContent {
  const map = patch.map === undefined ? tela.map : applyMapPatch(tela.map, patch.map)
  if (map === null) throw new Error('patch não encaixou na tela')
  return {
    map,
    vision: patch.vision ?? tela.vision,
    explored: patch.explored ?? tela.explored,
    ownTokens: patch.ownTokens ?? tela.ownTokens,
    concealed: patch.concealed ?? tela.concealed,
  }
}

const peloFio = (valor: unknown): unknown => JSON.parse(JSON.stringify(valor))

describe('só o que mudou: quem sabe aplicar recebe patch', () => {
  /** 7 fichas com foto na mesma sala, todas à vista umas das outras; a da Ana andou `passo` px. */
  function sala(passo: number): MapData {
    return mapa(
      'm',
      NOMES.map((n, i) => ({ ...ficha(n, n === 'ana' ? 100 + passo : 100 + i * 60, n === 'ana' ? 300 : 100), imageData: FOTO })),
    )
  }

  function mesa(comPatch: boolean): HostSession {
    const s = novaSessao()
    for (const nome of NOMES) s.assignToken(entra(s, `c-${nome}`, nome, sala(0), comPatch), nome)
    return s
  }

  it('passo da Ana com os 7 na mesma sala: os 7 recebem patch sem foto nenhuma, e a tela montada é a do snapshot inteiro', () => {
    const comPatch = mesa(true)
    const semPatch = mesa(false)
    const primeiro = comPatch.broadcast(sala(0))
    semPatch.broadcast(sala(0))
    const telas = new Map(NOMES.map((n) => [n, telaDe(snapshotPara(primeiro, `c-${n}`))]))

    for (const passo of [40, 80, 120]) {
      const r = comPatch.broadcast(sala(passo))
      const inteiro = semPatch.broadcast(sala(passo))
      expect(r.outbound).toHaveLength(NOMES.length)
      for (const nome of NOMES) {
        const patch = patchPara(r, `c-${nome}`)
        const snap = snapshotPara(inteiro, `c-${nome}`)
        const antes = telas.get(nome)
        if (antes === undefined) throw new Error('sem tela')
        // Nenhuma foto viaja: só a ficha que andou mudou, e a foto dela é a mesma.
        expect(JSON.stringify(patch)).not.toContain('data:image')
        expect(JSON.stringify(patch).length).toBeLessThan(JSON.stringify(snap).length / 20)
        expect(patch.map?.tokens?.change).toEqual([{ id: 'ana', set: { x: 100 + passo } }])
        const depois = aplicaTela(antes, patch)
        expect(peloFio(depois)).toEqual(peloFio(telaDe(snap)))
        telas.set(nome, depois)
      }
    }
  })

  it('NPC arrastado na Cripta: a Bia recebe só o x do NPC; a Ana, no Salão, nada', () => {
    const s = novaSessao()
    const salao = mapa('m-salao', [ficha('ana', 100, 100)])
    const cripta = (npcX: number) => mapa('m-cripta', [{ ...ficha('bia', 100, 100), imageData: FOTO }, { ...ficha('npc', npcX, 200), imageData: FOTO }])
    s.assignToken(entra(s, 'c-ana', 'Ana', mundo(salao, cripta(300)), true), 'ana')
    s.assignToken(entra(s, 'c-bia', 'Bia', mundo(salao, cripta(300)), true), 'bia')
    let base = snapshotPara(s.broadcast(mundo(salao, cripta(300))), 'c-bia').rev

    for (const x of [340, 380]) {
      const r = s.broadcast(mundo(salao, cripta(x)))
      expect(paraCliente(r, 'c-ana')).toEqual([])
      const patch = patchPara(r, 'c-bia')
      expect(patch).toEqual({ type: 'patch', rev: s.rev, base, map: { set: {}, tokens: { change: [{ id: 'npc', set: { x } }], remove: [] } } })
      base = patch.rev
    }
  })

  it('SEGREDO: NPC no escuro não gera patch; entra na visão inteiro, sai como remoção, e nada dele viaja enquanto está escondido', () => {
    const s = novaSessao()
    const muro = [parede('muro', 600, 0, 600, 1200)]
    const salao = (npcX: number, npcY: number) => mapa('m', [ficha('ana', 100, 100), ficha('npc', npcX, npcY)], muro)
    s.assignToken(entra(s, 'c-ana', 'Ana', salao(900, 300), true), 'ana')
    expect(snapshotPara(s.broadcast(salao(900, 300)), 'c-ana').map.tokens.map((t) => t.id)).toEqual(['ana'])

    expect([s.broadcast(salao(900, 340)).outbound, s.broadcast(salao(900, 380)).outbound]).toEqual([[], []])

    const entrou = patchPara(s.broadcast(salao(300, 100)), 'c-ana')
    expect(entrou.map?.tokens?.change).toEqual([{ id: 'npc', token: expect.objectContaining({ id: 'npc', x: 300, y: 100 }) }])
    const saiu = patchPara(s.broadcast(salao(900, 500)), 'c-ana')
    expect(saiu.map?.tokens?.remove).toEqual(['npc'])
    expect(saiu.map?.tokens?.change).toEqual([])
    expect(s.broadcast(salao(900, 540)).outbound).toEqual([])
  })

  it('jogador que não disse patch no join continua recebendo o snapshot inteiro', () => {
    const s = novaSessao()
    const m = (x: number) => mapa('m', [ficha('ana', x, 100), ficha('bia', 300, 100)])
    s.assignToken(entra(s, 'c-ana', 'Ana', m(100), true), 'ana')
    s.assignToken(entra(s, 'c-bia', 'Bia', m(100), false), 'bia')
    s.broadcast(m(100))
    const r = s.broadcast(m(140))
    expect(patchPara(r, 'c-ana').map?.tokens?.change).toEqual([{ id: 'ana', set: { x: 140 } }])
    expect(snapshotPara(r, 'c-bia').map.tokens.find((t) => t.id === 'ana')?.x).toBe(140)
  })

  it('cena de fundo que chega depois de abrir a aventura: a espera vira snapshot inteiro, e só depois vêm os patches', () => {
    const s = novaSessao()
    const salao = mapa('m-salao', [ficha('ana', 100, 100)])
    const cripta = (npcX: number) => mapa('m-cripta', [ficha('bia', 100, 100), ficha('npc', npcX, 200)])
    // A Cripta ainda não chegou do disco: o host só serve o Salão.
    const semCripta: HostWorld = { open: { sceneId: 's-salao', name: 'Salao', map: salao }, background: [] }
    s.assignToken(entra(s, 'c-ana', 'Ana', semCripta, true), 'ana')
    s.assignToken(entra(s, 'c-bia', 'Bia', semCripta, true), 'bia')

    expect(paraCliente(s.broadcast(semCripta), 'c-bia')).toEqual([{ type: 'lobby.waiting' }])
    expect(s.broadcast(semCripta).outbound).toEqual([])

    // subscribeToServedScenes -> notifyMapChanged -> broadcast com a cena nova.
    const chegou = s.broadcast(mundo(salao, cripta(300)))
    expect(paraCliente(chegou, 'c-ana')).toEqual([])
    expect(snapshotPara(chegou, 'c-bia').map.id).toBe('m-cripta')
    expect(patchPara(s.broadcast(mundo(salao, cripta(340))), 'c-bia').map?.tokens?.change).toEqual([{ id: 'npc', set: { x: 340 } }])
  })

  it('view.resync: a tela inteira volta com rev novo; o segundo pedido dentro do intervalo morre calado', () => {
    const s = novaSessao()
    const m = (x: number) => mapa('m', [ficha('ana', x, 100)])
    s.assignToken(entra(s, 'c-ana', 'Ana', m(100), true), 'ana')
    const antes = snapshotPara(s.broadcast(m(100)), 'c-ana').rev

    const inteira = snapshotPara(s.handleMessage('c-ana', { type: 'view.resync' }, m(100)), 'c-ana')
    expect(inteira.rev).toBeGreaterThan(antes)
    expect(inteira.map.tokens.map((t) => t.x)).toEqual([100])
    expect(s.handleMessage('c-ana', { type: 'view.resync' }, m(100)).outbound).toEqual([])
    // O patch seguinte parte da tela que o resync mandou.
    expect(patchPara(s.broadcast(m(140)), 'c-ana').base).toBe(inteira.rev)
  })

  it('envio que falhou (forgetView): o broadcast seguinte manda a tela inteira, mesmo sem mudança', () => {
    const s = novaSessao()
    const m = mapa('m', [ficha('ana', 100, 100)])
    s.assignToken(entra(s, 'c-ana', 'Ana', m, true), 'ana')
    s.broadcast(m)
    expect(s.broadcast(m).outbound).toEqual([])
    s.forgetView('c-ana')
    expect(snapshotPara(s.broadcast(m), 'c-ana').map.tokens.map((t) => t.id)).toEqual(['ana'])
  })
})

describe('edição otimista que o host recusa calado', () => {
  const FOTO_A = 'data:image/png;base64,QUFB'
  const FOTO_B = 'data:image/png;base64,QkJC'

  function mesaComRelogio(comPatch: boolean) {
    let agora = 0
    const s = novaSessao(() => agora)
    let m = mapa('m', [ficha('ana', 100, 100), ficha('bia', 300, 100)])
    s.assignToken(entra(s, 'c-ana', 'Ana', m, comPatch), 'ana')
    s.assignToken(entra(s, 'c-bia', 'Bia', m, false), 'bia')
    s.broadcast(m)
    /** A Ana manda a foto; aceita, o mestre grava (como o applyTokenEdit) e faz o broadcast. */
    const mandaFoto = (image: string): HostResult => {
      const r = s.handleMessage('c-ana', { type: 'token.edit', tokenId: 'ana', image }, m)
      if (r.applyTokenEdit === undefined) return r
      m = { ...m, tokens: m.tokens.map((t) => (t.id === 'ana' ? { ...t, image: null, imageData: image } : t)) }
      return s.broadcast(m)
    }
    return { s, mandaFoto, avanca: (ms: number) => (agora += ms) }
  }

  it('foto A aceita, foto B 300 ms depois descartada: a Ana recebe de volta a tela com a A (patch vazio, rev novo)', () => {
    const { s, mandaFoto, avanca } = mesaComRelogio(true)
    const aceita = patchPara(mandaFoto(FOTO_A), 'c-ana')
    expect(aceita.map?.tokens?.change).toEqual([{ id: 'ana', set: { imageData: FOTO_A } }])

    avanca(300)
    const recusada = mandaFoto(FOTO_B)
    expect(recusada.applyTokenEdit).toBeUndefined()
    // Só a Ana: a tela dela é a única com a foto B, e só por otimismo.
    expect(recusada.outbound.map((o) => o.clientId)).toEqual(['c-ana'])
    const volta = patchPara(recusada, 'c-ana')
    expect(volta).toEqual({ type: 'patch', rev: s.rev, base: aceita.rev })
    expect(volta.rev).toBeGreaterThan(aceita.rev)
  })

  it('mesmo caso para quem só entende snapshot: volta a tela inteira com a foto A', () => {
    const { mandaFoto, avanca } = mesaComRelogio(false)
    mandaFoto(FOTO_A)
    avanca(300)
    const volta = snapshotPara(mandaFoto(FOTO_B), 'c-ana')
    expect(volta.map.tokens.find((t) => t.id === 'ana')?.imageData).toBe(FOTO_A)
  })
})
