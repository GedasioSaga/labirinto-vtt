/**
 * REVELAR PLANTA POR CENA, PARA VÁRIOS, E O QUE O GRUPO VIU.
 *
 * - "Planta conhecida por todos" (flag da cena): quem chega já vê a planta,
 *   sem interior de teto, sem zona oculta.
 * - "Revelar planta para…": vale para a cena escolhida, mesmo que o jogador
 *   não esteja nela; nada muda até ele chegar.
 * - "Dar o que o grupo viu": une só o que os colegas VIRAM naquela cena —
 *   nunca a planta que o mestre revelou a um deles, nunca o que a zona oculta
 *   ou o teto escondem agora.
 */
import { describe, expect, it } from 'vitest'
import { decodeExploration, isPointExplored, type Exploration } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { ConcealZone, MapData, Region, Token } from '../types/map'
import type { HostMessage } from './protocol'
import { createHostSession, type HostResult, type HostScene, type HostSession, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
/** Raio pequeno: cada ficha vê só a vizinhança, o resto do mapa fica de fora. */
const RAIO = 100

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

/** 20 x 10 casas de 50 px: 1000 x 500 px de mundo. */
function mapa(id: string, extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, `nome-${id}`, 20, 10, 50), ...extra }
}

const PREDIO = [
  { x: 700, y: 300 },
  { x: 900, y: 300 },
  { x: 900, y: 450 },
  { x: 700, y: 450 },
]

function predioComTeto(): Region {
  return { id: 'predio', points: PREDIO, tag: '', fillColor: '#654', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Casa do Prefeito', roof: true } }
}

function zona(id: string, x0: number, y0: number, x1: number, y1: number): ConcealZone {
  return {
    id,
    name: `segredo-${id}`,
    revealed: false,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ],
  }
}

function cena(sceneId: string, map: MapData, planKnownByAll?: boolean): HostScene {
  const scene: HostScene = { sceneId, name: `Cena ${sceneId}`, map }
  if (planKnownByAll !== undefined) scene.planKnownByAll = planKnownByAll
  return scene
}

interface Mesa {
  s: HostSession
  ids: Record<string, string>
}

/** Cada nome entra, e a ficha `nome.toLowerCase()` passa a ser dele. */
function mesa(nomes: string[], mundo: HostWorld): Mesa {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  for (const nome of nomes) {
    const r = s.handleMessage(`c-${nome}`, { type: 'join', code: CODE, name: nome }, mundo)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    ids[nome] = welcome.playerId
    s.assignToken(welcome.playerId, nome.toLowerCase())
  }
  return { s, ids }
}

function snapshotDe(r: HostResult, nome: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === `c-${nome}`)?.msg
  if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${nome}`)
  return msg
}

function exploradoDe(r: HostResult, nome: string): Exploration {
  const exp = decodeExploration(snapshotDe(r, nome).explored)
  if (exp === null) throw new Error('explored inválido')
  return exp
}

describe('Planta conhecida por todos (flag da cena)', () => {
  it('quem chega vê a rua longe; sem a flag, só o raio', () => {
    const capital = mapa('m-capital', { tokens: [ficha('felipe', 100, 100)] })
    const comFlag = mesa(['Felipe'], { open: cena('s-capital', capital, true), background: [] })
    const exp = exploradoDe(comFlag.s.broadcast({ open: cena('s-capital', capital, true), background: [] }), 'Felipe')
    expect(isPointExplored(exp, { x: 500, y: 250 })).toBe(true)
    expect(isPointExplored(exp, { x: 100, y: 100 })).toBe(true)

    const semFlag = mesa(['Felipe'], { open: cena('s-capital', capital), background: [] })
    const exp2 = exploradoDe(semFlag.s.broadcast({ open: cena('s-capital', capital), background: [] }), 'Felipe')
    expect(isPointExplored(exp2, { x: 500, y: 250 })).toBe(false)
    expect(isPointExplored(exp2, { x: 100, y: 100 })).toBe(true)
  })

  it('SEGURANÇA: não abre interior de teto nem zona oculta, e a flag não vai no pacote', () => {
    const capital = mapa('m-capital', {
      tokens: [ficha('felipe', 100, 100)],
      regions: [predioComTeto()],
      concealZones: [zona('cofre', 300, 350, 500, 480)],
    })
    const mundo: HostWorld = { open: cena('s-capital', capital, true), background: [] }
    const { s } = mesa(['Felipe'], mundo)
    const r = s.broadcast(mundo)
    const exp = exploradoDe(r, 'Felipe')
    // Rua longe, sim; dentro do prédio de teto fechado e dentro da zona, não.
    expect(isPointExplored(exp, { x: 550, y: 150 })).toBe(true)
    expect(isPointExplored(exp, { x: 800, y: 375 })).toBe(false)
    expect(isPointExplored(exp, { x: 400, y: 420 })).toBe(false)
    const json = JSON.stringify(snapshotDe(r, 'Felipe'))
    expect(json).not.toContain('segredo-cofre')
    expect(json).not.toContain('planKnownByAll')
    expect(json).not.toContain('Cena s-capital')
  })
})

describe('Revelar planta para… (por cena, para vários)', () => {
  const capital = (fichas: Token[]) => mapa('m-capital', { tokens: fichas })
  const abadia = (fichas: Token[]) => mapa('m-abadia', { tokens: fichas, regions: [{ id: 'nave', points: [{ x: 600, y: 50 }, { x: 950, y: 50 }, { x: 950, y: 200 }, { x: 600, y: 200 }], tag: '', fillColor: '#444', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: 'Nave da Abadia' } }] })

  it('Abadia só para Oto: nada muda até ele chegar, aí aparece; Eva vê só o raio', () => {
    const antes: HostWorld = { open: cena('s-capital', capital([ficha('oto', 100, 100)])), background: [cena('s-abadia', abadia([ficha('eva', 100, 400)]))] }
    const { s, ids } = mesa(['Oto', 'Eva'], antes)
    expect(s.revealPlanFor('s-abadia', [ids.Oto], antes)).toBe(1)

    // Oto ainda na Capital: nada da Abadia chega, e a Capital segue no raio.
    const r1 = s.broadcast(antes)
    const oto1 = snapshotDe(r1, 'Oto')
    expect(JSON.stringify(oto1)).not.toContain('Nave da Abadia')
    expect(JSON.stringify(oto1)).not.toContain('m-abadia')
    expect(isPointExplored(exploradoDe(r1, 'Oto'), { x: 800, y: 125 })).toBe(false)
    expect(isPointExplored(exploradoDe(r1, 'Eva'), { x: 800, y: 125 })).toBe(false)

    // Oto chega à Abadia: a planta aparece para ele; Eva continua só no raio.
    const depois: HostWorld = { open: cena('s-capital', capital([])), background: [cena('s-abadia', abadia([ficha('eva', 100, 400), ficha('oto', 150, 400)]))] }
    const r2 = s.broadcast(depois)
    expect(isPointExplored(exploradoDe(r2, 'Oto'), { x: 800, y: 125 })).toBe(true)
    expect(JSON.stringify(snapshotDe(r2, 'Oto'))).toContain('Nave da Abadia')
    expect(isPointExplored(exploradoDe(r2, 'Eva'), { x: 800, y: 125 })).toBe(false)
    expect(isPointExplored(exploradoDe(r2, 'Eva'), { x: 100, y: 400 })).toBe(true)
  })

  it('vale em cena vazia, ignora id que não é da sala e cena que não existe', () => {
    const mundo: HostWorld = { open: cena('s-capital', capital([ficha('oto', 100, 100), ficha('eva', 200, 100)])), background: [cena('s-abadia', abadia([]))] }
    const { s, ids } = mesa(['Oto', 'Eva'], mundo)
    expect(s.revealPlanFor('s-abadia', [ids.Oto, ids.Eva, 'fantasma'], mundo)).toBe(2)
    expect(s.revealPlanFor('s-nao-existe', [ids.Oto], mundo)).toBe(0)
    expect(s.revealPlanFor('s-abadia', [], mundo)).toBe(0)
  })

  it('Esconder de novo tira a revelação guardada: chegando depois, só o raio', () => {
    const antes: HostWorld = { open: cena('s-capital', capital([ficha('oto', 100, 100)])), background: [cena('s-abadia', abadia([]))] }
    const { s, ids } = mesa(['Oto'], antes)
    expect(s.revealPlanFor('s-abadia', [ids.Oto], antes)).toBe(1)
    s.hidePlan(ids.Oto)
    const depois: HostWorld = { open: cena('s-capital', capital([])), background: [cena('s-abadia', abadia([ficha('oto', 100, 400)]))] }
    const exp = exploradoDe(s.broadcast(depois), 'Oto')
    expect(isPointExplored(exp, { x: 800, y: 125 })).toBe(false)
    expect(isPointExplored(exp, { x: 100, y: 400 })).toBe(true)
  })
})

describe('Dar o que o grupo viu', () => {
  /** Ana, Bruno e Caio na metade de cima da Capital; Duda chega embaixo à direita. Eva está na Abadia. */
  function grupo(extraCapital: Partial<MapData> = {}) {
    const fichasCapital = [ficha('ana', 100, 100), ficha('bruno', 300, 100), ficha('caio', 500, 100), ficha('duda', 900, 150)]
    const mundo: HostWorld = {
      open: cena('s-capital', mapa('m-capital', { tokens: fichasCapital, ...extraCapital })),
      background: [cena('s-abadia', mapa('m-abadia', { tokens: [ficha('eva', 300, 400)] }))],
    }
    const t = mesa(['Ana', 'Bruno', 'Caio', 'Duda', 'Eva'], mundo)
    return { ...t, mundo }
  }

  it('Duda atrasada recebe só o que os três viram, naquela cena', () => {
    const { s, ids, mundo } = grupo()
    const inicial = s.broadcast(mundo)
    // A mesa parada: o envio seguinte não muda a tela de ninguém; a de antes é a da entrada.
    expect(s.broadcast(mundo).outbound).toEqual([])
    const antes = exploradoDe(inicial, 'Duda')
    expect(isPointExplored(antes, { x: 100, y: 100 })).toBe(false)

    // Eva está em outra cena: não conta como colega da Capital.
    expect(s.giveGroupView(ids.Duda, mundo)).toBe(3)
    const r = s.broadcast(mundo)
    const duda = exploradoDe(r, 'Duda')
    expect(isPointExplored(duda, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(duda, { x: 300, y: 100 })).toBe(true)
    expect(isPointExplored(duda, { x: 500, y: 100 })).toBe(true)
    expect(isPointExplored(duda, { x: 900, y: 150 })).toBe(true)
    // Ninguém viu a metade de baixo à esquerda: continua escura.
    expect(isPointExplored(duda, { x: 300, y: 420 })).toBe(false)
    // E o que Eva viu na Abadia (300, 400) não vira Capital de ninguém.
    expect(isPointExplored(duda, { x: 300, y: 400 })).toBe(false)
    // Só a Duda recebe: Ana não ganha o canto da Duda (a tela dela não muda, nada sai).
    expect(r.outbound.filter((o) => o.clientId === 'c-Ana')).toEqual([])
    expect(isPointExplored(exploradoDe(inicial, 'Ana'), { x: 900, y: 150 })).toBe(false)
  })

  it('ninguém mais explorou a cena: devolve 0 e nada muda', () => {
    const mundo: HostWorld = { open: cena('s-capital', mapa('m-capital', { tokens: [ficha('duda', 900, 150)] })), background: [cena('s-abadia', mapa('m-abadia', { tokens: [ficha('eva', 300, 400)] }))] }
    const { s, ids } = mesa(['Duda', 'Eva'], mundo)
    const inicial = s.broadcast(mundo)
    expect(s.giveGroupView(ids.Duda, mundo)).toBe(0)
    expect(s.giveGroupView('fantasma', mundo)).toBe(0)
    // Nada muda: nenhuma tela nova sai, e a da Duda é a da entrada.
    expect(s.broadcast(mundo).outbound).toEqual([])
    const exp = exploradoDe(inicial, 'Duda')
    expect(isPointExplored(exp, { x: 100, y: 100 })).toBe(false)
    expect(isPointExplored(exp, { x: 900, y: 150 })).toBe(true)
  })

  it('SEGURANÇA: zona oculta ligada depois que o colega viu não passa para a Duda', () => {
    const { s, ids, mundo } = grupo()
    s.broadcast(mundo)
    const comZona: HostWorld = { ...mundo, open: { ...mundo.open, map: { ...mundo.open.map, concealZones: [zona('porao', 50, 50, 150, 150)] } } }
    expect(s.giveGroupView(ids.Duda, comZona)).toBe(3)
    const r = s.broadcast(comZona)
    const duda = exploradoDe(r, 'Duda')
    expect(isPointExplored(duda, { x: 100, y: 100 })).toBe(false)
    expect(isPointExplored(duda, { x: 500, y: 100 })).toBe(true)
    expect(JSON.stringify(snapshotDe(r, 'Duda'))).not.toContain('segredo-porao')
  })

  it('SEGURANÇA: o interior que a Ana viu com o teto aberto não passa para quem está fora', () => {
    const fichas = [ficha('ana', 800, 375), ficha('duda', 100, 100)]
    const mundo: HostWorld = { open: cena('s-capital', mapa('m-capital', { tokens: fichas, regions: [predioComTeto()] })), background: [] }
    const { s, ids } = mesa(['Ana', 'Duda'], mundo)
    const r0 = s.broadcast(mundo)
    // A Ana está dentro: o teto abriu para ela e ela lembra o interior.
    expect(isPointExplored(exploradoDe(r0, 'Ana'), { x: 800, y: 375 })).toBe(true)
    expect(s.giveGroupView(ids.Duda, mundo)).toBe(1)
    // O que a Ana tinha para dar era o interior: nada disso entra, a tela da Duda não muda (nada sai)…
    const r1 = s.broadcast(mundo)
    expect(r1.outbound.filter((o) => o.clientId === 'c-Duda')).toEqual([])
    // …e a que ela tem não conhece o interior.
    expect(isPointExplored(exploradoDe(r0, 'Duda'), { x: 800, y: 375 })).toBe(false)
  })

  it('SEGURANÇA: a planta que o mestre revelou só ao Oto não vaza pelo grupo', () => {
    const mundo: HostWorld = { open: cena('s-abadia', mapa('m-abadia', { tokens: [ficha('oto', 100, 100), ficha('duda', 900, 400)] })), background: [] }
    const { s, ids } = mesa(['Oto', 'Duda'], mundo)
    expect(s.revealPlanFor('s-abadia', [ids.Oto], mundo)).toBe(1)
    const r0 = s.broadcast(mundo)
    expect(isPointExplored(exploradoDe(r0, 'Oto'), { x: 500, y: 250 })).toBe(true)
    expect(s.giveGroupView(ids.Duda, mundo)).toBe(1)
    const duda = exploradoDe(s.broadcast(mundo), 'Duda')
    // O que o Oto VIU (o raio dele) passa; a planta que só ele ganhou, não.
    expect(isPointExplored(duda, { x: 100, y: 100 })).toBe(true)
    expect(isPointExplored(duda, { x: 500, y: 250 })).toBe(false)
  })
})
