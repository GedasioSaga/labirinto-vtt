/**
 * `lib/gatherParty.ts` — onde cada ficha assenta no "Reunir o grupo aqui", sem
 * store nem rede.
 *
 * O que se cobra: as casas saem em anéis em volta do pino, do mais perto ao
 * mais longe, e nunca na casa do próprio pino; parede entre a casa e o pino
 * tira a casa (a ficha não aparece do outro lado); casa fora do chão sai;
 * ficha que já está lá ocupa a casa (menos a que vai sair dela); e quem não
 * coube volta como `null`, para o mestre ser avisado.
 */
import { describe, expect, it } from 'vitest'
import type { HostWorld } from '../net/hostSession'
import type { MapData, Token, Wall } from '../types/map'
import { applyGatherPlan, gatherCandidates, gatherGroups, gatherSpots, planGather, vehicleRiderSpots, type GatherPlan } from './gatherParty'
import { createEmptyMap } from './mapFactory'
import type { PartyMember } from './party'

const GRADE = 50
/** Centro de uma casa. */
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PINO = casa(10, 5)

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('map_teste', 'Teste', 20, 12, GRADE), ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

function ficha(id: string, p: { x: number; y: number }, size = 1): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size, image: null }
}

/** Quantas casas (Chebyshev) separam o ponto do pino. */
const anel = (p: { x: number; y: number }) => Math.max(Math.abs(p.x - PINO.x), Math.abs(p.y - PINO.y)) / GRADE

function semNulo<T>(lista: (T | null)[]): T[] {
  return lista.filter((item): item is T => item !== null)
}

describe('gatherSpots', () => {
  it('anel sem obstáculo: os 8 vizinhos, os de lado antes das diagonais, nunca a casa do pino', () => {
    const casas = semNulo(gatherSpots(mapa(), PINO, Array(8).fill(1)))
    expect(casas).toHaveLength(8)
    expect(casas.every((p) => anel(p) === 1)).toBe(true)
    expect(casas.slice(0, 4).every((p) => Math.hypot(p.x - PINO.x, p.y - PINO.y) === GRADE)).toBe(true)
    expect(new Set(casas.map((p) => `${p.x}|${p.y}`)).size).toBe(8)
    // A nona já é do segundo anel.
    const nove = semNulo(gatherSpots(mapa(), PINO, Array(9).fill(1)))
    expect(anel(nove[8])).toBe(2)
  })

  it('parede entre a casa e o pino: nenhuma ficha do outro lado', () => {
    // Parede de cima a baixo na linha x = 550, colada à direita do pino.
    const map = mapa({ walls: [parede('muro', 550, 0, 550, 600)] })
    const casas = semNulo(gatherSpots(map, PINO, Array(12).fill(1)))
    expect(casas).toHaveLength(12)
    expect(casas.filter((p) => p.x > 550)).toEqual([])
  })

  it('coluna de pedra ao lado do pino: a casa dentro dela fica de fora', () => {
    const esq = casa(9, 5)
    const x1 = esq.x - GRADE / 2
    const y1 = esq.y - GRADE / 2
    const x2 = x1 + GRADE
    const y2 = y1 + GRADE
    const coluna = [parede('n', x1, y1, x2, y1), parede('l', x2, y1, x2, y2), parede('s', x2, y2, x1, y2), parede('o', x1, y2, x1, y1)]
    const casas = semNulo(gatherSpots(mapa({ walls: coluna }), PINO, Array(8).fill(1)))
    expect(casas).not.toContainEqual(esq)
  })

  it('porta aberta deixa a casa do outro lado valer; fechada, não', () => {
    const porta = (open: boolean): Wall => ({ ...parede('porta', 550, 250, 550, 300), door: { open, locked: false, kind: 'normal' } })
    const direita = casa(11, 5)
    const muro = [parede('muro-n', 550, 0, 550, 250), parede('muro-s', 550, 300, 550, 600)]
    expect(gatherSpots(mapa({ walls: [...muro, porta(true)] }), PINO, Array(8).fill(1))).toContainEqual(direita)
    expect(gatherSpots(mapa({ walls: [...muro, porta(false)] }), PINO, Array(8).fill(1))).not.toContainEqual(direita)
  })

  it('fora do chão: com chão no mapa, nenhuma ficha onde ele acaba', () => {
    // O chão acaba em y = 300: a linha de baixo do pino (y 300-350) é vazio.
    const map = mapa({ floor: [{ id: 'chao', shape: { kind: 'rect', cx: 500, cy: 150, w: 1000, h: 300 }, op: 'add', modifiers: {} }] })
    const casas = semNulo(gatherSpots(map, PINO, Array(10).fill(1)))
    expect(casas).toHaveLength(10)
    expect(casas.filter((p) => p.y > 300)).toEqual([])
  })

  it('ficha ocupando a casa: fica de fora, menos se for uma das que vão andar', () => {
    const direita = casa(11, 5)
    const map = mapa({ tokens: [ficha('estatua', direita)] })
    expect(gatherSpots(map, PINO, Array(8).fill(1))).not.toContainEqual(direita)
    expect(semNulo(gatherSpots(map, PINO, Array(8).fill(1)))).toHaveLength(8)
    expect(gatherSpots(map, PINO, Array(8).fill(1), new Set(['estatua']))).toContainEqual(direita)
  })

  it('ficha grande ocupa as vizinhas: a de 2 casas assenta na linha da grade e ninguém cai em cima dela', () => {
    const [grande, ...resto] = gatherSpots(mapa(), PINO, [2, 1, 1, 1, 1])
    expect(grande).not.toBeNull()
    if (grande === null) return
    expect(grande.x % GRADE).toBe(0)
    expect(grande.y % GRADE).toBe(0)
    // Raio da grande (1 casa) + raio da pequena (meia casa), com a folga de 0,9.
    for (const p of semNulo(resto)) expect(Math.hypot(p.x - grande.x, p.y - grande.y)).toBeGreaterThanOrEqual(1.5 * GRADE * 0.9)
  })

  it('espaço insuficiente: quem não coube volta null, na ordem pedida', () => {
    // Um cubículo de duas casas: a do pino e a da direita.
    const cubiculo = [parede('n', 500, 250, 600, 250), parede('l', 600, 250, 600, 300), parede('s', 600, 300, 500, 300), parede('o', 500, 300, 500, 250)]
    const casas = gatherSpots(mapa({ walls: cubiculo }), PINO, [1, 1, 1])
    expect(casas).toEqual([casa(11, 5), null, null])
  })
})

describe('planGather e applyGatherPlan', () => {
  const lanterna = ficha('lanterna', casa(2, 2))
  const rocha = ficha('rocha', casa(4, 4))
  const mundo: HostWorld = {
    open: { sceneId: 'salao', name: 'Salão', map: mapa({ tokens: [lanterna] }) },
    background: [{ sceneId: 'cripta', name: 'Cripta', map: mapa({ tokens: [rocha] }) }],
  }
  const membro = (playerId: string, name: string, sceneId: string, token: Token): PartyMember => ({
    playerId,
    name,
    connected: true,
    sceneId,
    sceneName: null,
    travelPending: false,
    mochila: [],
    token: { id: token.id, color: '#3cff00', x: token.x, y: token.y },
  })
  const ana = membro('p1', 'Ana', 'salao', lanterna)
  const carla = membro('p3', 'Carla', 'cripta', rocha)

  it('quem está na cena do pino só anda; quem está em outra viaja; casas diferentes', () => {
    const plano = planGather([ana, carla], mundo, PINO)
    expect(plano.leftOut).toEqual([])
    expect(plano.moves.map((m) => [m.name, m.tokenId, m.travels])).toEqual([
      ['Ana', 'lanterna', false],
      ['Carla', 'rocha', true],
    ])
    const [a, c] = plano.moves
    expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeGreaterThanOrEqual(GRADE)
    expect(plano.moves.every((m) => anel(m) === 1)).toBe(true)
  })

  it('jogador sem ficha não entra na lista nem no plano', () => {
    const semFicha: PartyMember = { ...ana, playerId: 'p9', name: 'Zé', token: null }
    expect(gatherCandidates([ana, semFicha], mundo, PINO).map((c) => c.name)).toEqual(['Ana'])
    expect(planGather([semFicha], mundo, PINO).moves).toEqual([])
  })

  it('aplica as travessias ANTES do passo local, e devolve quem não pôde vir', () => {
    const plano: GatherPlan = planGather([ana, carla], mundo, PINO)
    const ordem: string[] = []
    const falhou = applyGatherPlan(plano, {
      sceneId: 'salao',
      bringFromOtherScene: (playerId, sceneId) => {
        ordem.push(`viaja ${playerId} -> ${sceneId}`)
        return false
      },
      placeInScene: (posicoes) => ordem.push(`anda ${posicoes.map((p) => p.id).join(',')}`),
    })
    expect(ordem).toEqual(['viaja p3 -> salao', 'anda lanterna'])
    expect(falhou).toEqual(['Carla'])
  })
})

describe('gatherCandidates e gatherGroups: a lista agrupada por cena', () => {
  const PORTO = 'porto'
  const mundo: HostWorld = {
    open: { sceneId: PORTO, name: 'Porto Cinza', map: mapa() },
    background: [
      { sceneId: 'cais', name: 'PC - Cais', map: mapa() },
      { sceneId: 'sobrado', name: 'Sobrado', map: mapa() },
    ],
  }
  const membro = (name: string, sceneId: string, p: { x: number; y: number }): PartyMember => ({
    playerId: `p-${name}`,
    name,
    connected: true,
    sceneId,
    sceneName: null,
    travelPending: false,
    mochila: [],
    token: { id: `t-${name}`, color: '#3cff00', x: p.x, y: p.y },
  })
  // Ordem de chegada embaralhada de propósito: Hugo, colado no pino, chega primeiro.
  const SETE = [
    membro('Hugo', PORTO, casa(11, 5)),
    membro('Bruno', 'cais', casa(1, 1)),
    membro('Elisa', 'sobrado', casa(2, 1)),
    membro('Carla', 'cais', casa(3, 1)),
    membro('Fabio', 'sobrado', casa(4, 1)),
    membro('Duda', 'cais', casa(5, 1)),
    membro('Gabi', 'sobrado', casa(6, 1)),
  ]

  it('7 jogadores: um grupo por cena com a contagem, na ordem de chegada, e quem já está no pino por último', () => {
    const grupos = gatherGroups(gatherCandidates(SETE, mundo, PINO))
    expect(grupos.map((g) => [g.label, g.alreadyHere, g.candidates.map((c) => c.name)])).toEqual([
      ['PC - Cais (3)', false, ['Bruno', 'Carla', 'Duda']],
      ['Sobrado (3)', false, ['Elisa', 'Fabio', 'Gabi']],
      ['Já aqui (1)', true, ['Hugo']],
    ])
  })

  it('"já aqui" = na cena do pino a até 3 casas dele; mais longe, na mesma cena, é um grupo com o nome da cena', () => {
    const tresCasas = membro('Ivo', PORTO, casa(13, 5))
    const quatroCasas = membro('Joana', PORTO, casa(14, 5))
    const candidatos = gatherCandidates([quatroCasas, tresCasas], mundo, PINO)
    expect(candidatos.map((c) => [c.name, c.alreadyHere])).toEqual([
      ['Joana', false],
      ['Ivo', true],
    ])
    expect(gatherGroups(candidatos).map((g) => g.label)).toEqual(['Porto Cinza (1)', 'Já aqui (1)'])
  })

  it('mesma casa do pino, mas em OUTRA cena: não está aqui', () => {
    const [candidato] = gatherCandidates([membro('Lia', 'cais', casa(11, 5))], mundo, PINO)
    expect(candidato).toMatchObject({ name: 'Lia', alreadyHere: false, sceneLabel: 'PC - Cais' })
  })

  it('cena que o host não abriu e sem nome na ponte: aparece em "Outra cena", marcada, fora do "Já aqui"', () => {
    const [candidato] = gatherCandidates([membro('Mia', 'porao', casa(11, 5))], mundo, PINO)
    expect(candidato).toMatchObject({ name: 'Mia', sceneId: 'porao', sceneLabel: 'Outra cena', alreadyHere: false })
  })
})

describe('veículo no "Reunir o grupo": quem vai a bordo de um veículo que também viaja chega com ele', () => {
  const bote = ficha('bote', casa(4, 4))
  const remo = ficha('remo', casa(5, 4))
  const mundoComBote = (passageiros: string[]): HostWorld => ({
    open: { sceneId: 'salao', name: 'Salão', map: mapa() },
    background: [{ sceneId: 'cripta', name: 'Cripta', map: mapa({ tokens: [{ ...bote, veiculo: { lugares: 2, passageiros } }, remo] }) }],
  })
  const membro = (playerId: string, name: string, token: Token): PartyMember => ({
    playerId,
    name,
    connected: true,
    sceneId: 'cripta',
    sceneName: null,
    travelPending: false,
    mochila: [],
    token: { id: token.id, color: '#3cff00', x: token.x, y: token.y },
  })
  const dona = membro('p1', 'Duda', bote)
  const gui = membro('p2', 'Gui', remo)

  it('o plano marca o Gui como levado pelo bote; fora do bote, ele viaja sozinho', () => {
    expect(planGather([dona, gui], mundoComBote(['remo']), PINO).moves.map((m) => [m.tokenId, m.carriedBy])).toEqual([
      ['bote', undefined],
      ['remo', 'bote'],
    ])
    expect(planGather([dona, gui], mundoComBote([]), PINO).moves.map((m) => m.carriedBy)).toEqual([undefined, undefined])
    // O bote fora do plano não leva ninguém "junto": o Gui viaja por conta própria.
    expect(planGather([gui], mundoComBote(['remo']), PINO).moves.map((m) => [m.tokenId, m.carriedBy])).toEqual([['remo', undefined]])
  })

  it('o bote chegou: o Gui não atravessa de novo (não conta como falha) e só anda até a casa reservada', () => {
    const plano = planGather([dona, gui], mundoComBote(['remo']), PINO)
    const ordem: string[] = []
    const falhou = applyGatherPlan(plano, {
      sceneId: 'salao',
      // O Gui já foi junto com o bote: a travessia dele, se fosse pedida, acharia a ficha no salão e falharia.
      bringFromOtherScene: (playerId) => {
        ordem.push(`viaja ${playerId}`)
        return playerId === 'p1'
      },
      placeInScene: (posicoes) => ordem.push(`anda ${posicoes.map((p) => `${p.id}@${p.x},${p.y}`).join(' ')}`),
    })
    const casaDoGui = plano.moves[1]
    expect(falhou).toEqual([])
    expect(ordem).toEqual(['viaja p1', `anda remo@${casaDoGui.x},${casaDoGui.y}`])
  })

  it('o bote não pôde vir: o Gui tenta a travessia sozinho, e a falha dele é dele', () => {
    const plano = planGather([gui, dona], mundoComBote(['remo']), PINO)
    const ordem: string[] = []
    const falhou = applyGatherPlan(plano, {
      sceneId: 'salao',
      bringFromOtherScene: (playerId) => {
        ordem.push(`viaja ${playerId}`)
        return false
      },
      placeInScene: () => ordem.push('anda'),
    })
    // O bote vai primeiro mesmo com o Gui antes na lista: é ele que leva o Gui.
    expect(ordem).toEqual(['viaja p1', 'viaja p2'])
    expect(falhou).toEqual(['Duda', 'Gui'])
  })
})

describe('vehicleRiderSpots: onde quem vai a bordo assenta quando o veículo chega', () => {
  const veiculo = { ...casa(0, 5), size: 1 }

  it('afastamento que serve: o grupo chega como saiu', () => {
    const chegada = { ...PINO, size: 1 }
    expect(vehicleRiderSpots(mapa(), chegada, [{ dx: GRADE, dy: 0, size: 1 }, { dx: 0, dy: -GRADE, size: 1 }])).toEqual([
      { x: PINO.x + GRADE, y: PINO.y },
      { x: PINO.x, y: PINO.y - GRADE },
    ])
  })

  it('veículo na borda: quem estava à esquerda não sai do mapa; quem embarcou longe chega ao lado', () => {
    const casas = vehicleRiderSpots(mapa(), veiculo, [
      { dx: -GRADE, dy: 0, size: 1 },
      { dx: 15 * GRADE, dy: 6 * GRADE, size: 1 },
    ])
    // A de cima (primeira do anel) e a da direita.
    expect(casas).toEqual([casa(0, 4), casa(1, 5)])
  })

  it('parede entre o veículo e o afastamento: a casa do outro lado não vale', () => {
    // Parede colada à direita do veículo, de cima a baixo.
    const map = mapa({ walls: [parede('muro', GRADE, 0, GRADE, 600)] })
    expect(vehicleRiderSpots(map, veiculo, [{ dx: GRADE, dy: 0, size: 1 }])).toEqual([casa(0, 4)])
  })

  it('ficha já na casa do afastamento: o passageiro assenta na mais perto livre', () => {
    const map = mapa({ tokens: [ficha('rocha', { x: PINO.x + GRADE, y: PINO.y })] })
    expect(vehicleRiderSpots(map, { ...PINO, size: 1 }, [{ dx: GRADE, dy: 0, size: 1 }])).toEqual([{ x: PINO.x, y: PINO.y - GRADE }])
  })

  it('sem casa livre nenhuma: fica na casa do próprio veículo, dentro do mapa', () => {
    // Um cubículo de uma casa só em volta do veículo.
    const map = mapa({
      walls: [parede('n', 0, 250, 50, 250), parede('s', 0, 300, 50, 300), parede('l', 50, 250, 50, 300)],
    })
    expect(vehicleRiderSpots(map, veiculo, [{ dx: GRADE, dy: 0, size: 1 }])).toEqual([{ x: veiculo.x, y: veiculo.y }])
  })
})
