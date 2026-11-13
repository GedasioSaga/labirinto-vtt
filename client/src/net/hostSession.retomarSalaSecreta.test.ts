/**
 * MESA RETOMADA COM SALA SECRETA (caça de 12/11/2026, `2eb4dd61`): a mesa
 * gravada guarda, por cena de cada jogador, as salas secretas que estavam
 * FECHADAS para ele (`SavedSceneMemory.secretasFechadas`, só no arquivo do
 * mestre). Fechada, a sala é o chão vazio que a visão atravessou, e a memória o
 * marca. Na retomada (`restoredMemoryOf`), a sala que deixou de estar fechada
 * nesse meio-tempo (o mestre a desmarcou) tem o lugar apagado no primeiro
 * recorte: o interior nasce PRETO, não "lembrado". A mesa gravada por uma
 * versão sem o campo abre igual e trata toda sala aberta como recém-aberta.
 *
 * O caminho inteiro do disco: `savedExploration` do host, gravar e ler pelo
 * `savedTable` (o JSON do arquivo do mestre), `restoreExploration` no dia 2.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import { loadSavedExploration, storeSavedExploration, type SavedSeatExploration, type TableStorage } from '../lib/savedTable'
import type { MapData, Region, Token, Wall } from '../types/map'
import { createHostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const MESA = 'adv_cripta'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function sala(id: string, name: string, x0: number, y0: number, x1: number, y1: number, extra: Partial<Region> = {}): Region {
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name },
    ...extra,
  }
}

/** As quatro paredes de uma sala retangular, com o `regionId` dela. */
function paredesDe(r: Region): Wall[] {
  return r.points.map((a, i) => {
    const b = r.points[(i + 1) % r.points.length]
    return { id: `${r.id}-${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null, regionId: r.id }
  })
}

function mundo(map: MapData): HostWorld {
  return { open: { sceneId: 's-cripta', name: 'Cripta', map }, background: [] }
}

function snapshotDe(outbound: readonly { clientId: string; msg: HostMessage }[], clientId: string) {
  const msg = outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
  return msg
}

function explorado(wire: unknown) {
  const exp = decodeExploration(wire)
  if (exp === null) throw new Error('explorado inválido')
  return exp
}

/** O arquivo do mestre: a mesa gravada vira texto e volta lida pelo `savedTable`. */
function peloDisco(seats: SavedSeatExploration[]): SavedSeatExploration[] {
  const dados = new Map<string, string>()
  const storage: TableStorage = { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => void dados.set(k, v) }
  storeSavedExploration(storage, MESA, { version: 1, seats })
  return loadSavedExploration(storage, MESA)?.seats ?? []
}

/** A mesa como uma versão de antes do campo a gravaria: sem `secretasFechadas` em cena nenhuma. */
function semOCampo(seats: SavedSeatExploration[]): SavedSeatExploration[] {
  return seats.map((seat) => ({ ...seat, scenes: seat.scenes.map(({ secretasFechadas: _fora, ...cena }) => cena) }))
}

/**
 * Dia 1: Carla joga com o raio `raio`, passando pelos `caminho`; a mesa é gravada no fim.
 * Devolve o que o host grava (pelo disco) e as sessões do dia 2.
 */
function dia1(map: (carla: { x: number; y: number }) => MapData, caminho: readonly { x: number; y: number }[], raio: number) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000 + n, randomId: () => `d1-${(n += 1)}` })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, mundo(map(caminho[0]))).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'carla-f')
  s.setVisionRadius(welcome.playerId, raio)
  for (const p of caminho) s.broadcast(mundo(map(p)))
  return { seats: s.savedSeats(), exploration: peloDisco(s.savedExploration()) }
}

/** Dia 2: Retomar a mesa; Carla entra e recebe o primeiro recorte. */
function dia2(ontem: ReturnType<typeof dia1>, exploration: readonly SavedSeatExploration[], hoje: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 5_000 + n, randomId: () => `d2-${(n += 1)}`, restoreSeats: ontem.seats, restoreExploration: exploration })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Carla' }, mundo(hoje))
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return { s, r, snap: snapshotDe(r.outbound, 'c1') }
}

describe('hostSession: a mesa retomada lembra quais salas secretas estavam fechadas', () => {
  it('mesa gravada com o cofre FECHADO e o mestre o desmarca à noite: na retomada o lugar do cofre nasce preto, não lembrado', () => {
    // O cofre (sala secreta com paredes) fica a 200 px de Carla: fechado, a visão dela o atravessa como chão vazio.
    const CARLA = { x: 250, y: 250 }
    const CENTRO_DO_COFRE = { x: 550, y: 250 }
    const cofre = sala('cofre', 'Cofre do Barão', 450, 150, 650, 350, { secret: true })
    const cripta = (secreto: boolean) => (carla: { x: number; y: number }): MapData => {
      const r = { ...cofre, secret: secreto }
      return { ...createEmptyMap('m-cripta', 'Cripta', 30, 10, 50), tokens: [ficha('carla-f', carla.x, carla.y)], regions: [r], walls: paredesDe(r) }
    }
    const ontem = dia1(cripta(true), [CARLA], 500)
    // A mesa gravada (já relida do disco) lembra o chão do cofre e sabe que ele estava fechado.
    const cenaGravada = ontem.exploration.find((seat) => seat.name === 'Carla')?.scenes.find((cena) => cena.mapId === 'm-cripta')
    expect(cenaGravada?.secretasFechadas?.map((sala) => sala.id)).toEqual(['cofre'])
    expect(cenaGravada?.secretasFechadas?.[0]?.points).toEqual(cofre.points)
    expect(isPointExplored(explorado(cenaGravada?.explored), CENTRO_DO_COFRE)).toBe(true)

    // Dia 2: o mestre desmarcou "secreta". Carla volta ao mesmo lugar; as paredes do cofre agora tapam a visão.
    const { snap, r } = dia2(ontem, ontem.exploration, cripta(false)(CARLA))
    expect(r.reclaimed?.tokenIds).toEqual(['carla-f'])
    const exp = explorado(snap.explored)
    expect(isPointExplored(exp, CENTRO_DO_COFRE)).toBe(false)
    // O cofre não chega como lembrado: nem a sala, nem o nome dela.
    expect(snap.map.regions.map((sala) => sala.id)).not.toContain('cofre')
    expect(JSON.stringify(snap)).not.toContain('Cofre do Barão')
    // O resto do que ela viu ontem continua lembrado.
    expect(isPointExplored(exp, CARLA)).toBe(true)
  })

  it('mesa gravada por versão antiga (sem o campo) abre sem quebrar e trata a sala secreta aberta como recém-aberta: o lado que ela não vê agora nasce preto', () => {
    // Carla está DENTRO do salão secreto (aberto para ela) e o percorre de oeste a leste com raio curto.
    const OESTE_DO_SALAO = { x: 200, y: 250 }
    const LESTE_DO_SALAO = { x: 1000, y: 250 }
    /** Fora do salão, perto do oeste: visto ontem do lado de dentro. */
    const FORA_A_OESTE = { x: 70, y: 250 }
    const salao = sala('salao', 'Salão Escondido', 100, 100, 1100, 400, { secret: true })
    const cripta = (carla: { x: number; y: number }): MapData => ({ ...createEmptyMap('m-cripta', 'Cripta', 30, 10, 50), tokens: [ficha('carla-f', carla.x, carla.y)], regions: [salao] })
    const ontem = dia1(cripta, [OESTE_DO_SALAO, LESTE_DO_SALAO], 150)
    const cenaGravada = ontem.exploration.find((seat) => seat.name === 'Carla')?.scenes.find((cena) => cena.mapId === 'm-cripta')
    // Aberta no último recorte: a mesa de hoje grava a lista vazia (nenhuma fechada).
    expect(cenaGravada?.secretasFechadas).toEqual([])
    expect(isPointExplored(explorado(cenaGravada?.explored), OESTE_DO_SALAO)).toBe(true)

    // Mesa de hoje: o oeste do salão, que ela viu ontem por dentro, continua lembrado.
    const hoje = dia2(ontem, ontem.exploration, cripta(LESTE_DO_SALAO))
    expect(isPointExplored(explorado(hoje.snap.explored), OESTE_DO_SALAO)).toBe(true)

    // Mesa de antes do campo, lida do disco: abre, Carla volta com a ficha, no raio de ontem, e recebe a tela.
    const antiga = peloDisco(semOCampo(ontem.exploration))
    expect(antiga.flatMap((seat) => seat.scenes).some((cena) => 'secretasFechadas' in cena)).toBe(false)
    const { s, r, snap } = dia2(ontem, antiga, cripta(LESTE_DO_SALAO))
    expect(r.reclaimed?.tokenIds).toEqual(['carla-f'])
    expect(s.listPlayers(mundo(cripta(LESTE_DO_SALAO)))[0]).toMatchObject({ status: 'playing', visionRadius: 150 })
    expect(snap.map.tokens.map((t) => t.id)).toContain('carla-f')
    const exp = explorado(snap.explored)
    // Sem saber se o salão estava fechado ontem, o host o trata como recém-aberto: o lugar dele sai da memória...
    expect(isPointExplored(exp, OESTE_DO_SALAO)).toBe(false)
    // ...e só volta o que ela vê agora, do leste.
    expect(isPointExplored(exp, LESTE_DO_SALAO)).toBe(true)
    // O que ela viu fora do salão continua lembrado.
    expect(isPointExplored(exp, FORA_A_OESTE)).toBe(true)
  })
})
