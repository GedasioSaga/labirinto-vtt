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
import { applyGatherPlan, gatherCandidates, gatherGroups, gatherSpots, holdAlongSeats, pinClearance, planGather, vehicleRiderSpots, type GatherPlan } from './gatherParty'
import { createEmptyMap, setTokenPosition } from './mapFactory'
import type { PartyMember } from './party'
import { passengerIdsOf } from './vehicle'

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

  describe('pino apertado: a última casa vai para o bote e o Gui fica sem casa', () => {
    // Um cubículo de duas casas: a do pino e a da direita (a única que serve).
    const cubiculo = [parede('n', 500, 250, 600, 250), parede('l', 600, 250, 600, 300), parede('s', 600, 300, 500, 300), parede('o', 500, 300, 500, 250)]
    // Um cubículo só com a casa do pino: nenhuma casa serve.
    const poco = [parede('n', 500, 250, 550, 250), parede('l', 550, 250, 550, 300), parede('s', 550, 300, 500, 300), parede('o', 500, 300, 500, 250)]
    const mundoApertado = (paredes: Wall[], passageiros: string[]): HostWorld => ({
      ...mundoComBote(passageiros),
      open: { sceneId: 'salao', name: 'Salão', map: mapa({ walls: paredes }) },
    })

    it('a bordo do bote que tem casa: o Gui vem junto e não entra no "sem casa livre"', () => {
      const plano = planGather([dona, gui], mundoApertado(cubiculo, ['remo']), PINO)
      expect(plano.leftOut).toEqual([])
      expect(plano.moves.map((m) => [m.tokenId, m.travels, m.x, m.y])).toEqual([['bote', true, casa(11, 5).x, casa(11, 5).y]])
      expect(plano.ridesAlong).toEqual([{ playerId: 'p2', name: 'Gui', tokenId: 'remo', carriedBy: 'bote' }])
    })

    it('o bote chegou: o Gui chegou com ele, sem falha e sem andar para casa nenhuma', () => {
      const plano = planGather([dona, gui], mundoApertado(cubiculo, ['remo']), PINO)
      const ordem: string[] = []
      const falhou = applyGatherPlan(plano, {
        sceneId: 'salao',
        bringFromOtherScene: (playerId) => {
          ordem.push(`viaja ${playerId}`)
          return true
        },
        placeInScene: (posicoes) => ordem.push(`anda ${posicoes.map((p) => p.id).join(' ')}`),
      })
      expect(falhou).toEqual([])
      expect(ordem).toEqual(['viaja p1'])
    })

    it('o bote não pôde vir: o Gui também não veio, e o mestre fica sabendo dos dois', () => {
      const plano = planGather([dona, gui], mundoApertado(cubiculo, ['remo']), PINO)
      const falhou = applyGatherPlan(plano, { sceneId: 'salao', bringFromOtherScene: () => false, placeInScene: () => undefined })
      expect(falhou).toEqual(['Duda', 'Gui'])
    })

    describe('com mais gente no pino: quem chega a bordo não senta na casa de outro membro', () => {
      /** Corredor que começa na casa do pino (coluna 10) e fecha na linha x = `fim` casas. */
      const corredorAte = (fim: number): Wall[] => {
        const x2 = fim * GRADE
        return [parede('n', 500, 250, x2, 250), parede('l', x2, 250, x2, 300), parede('s', x2, 300, 500, 300), parede('o', 500, 300, 500, 250)]
      }
      const caio = ficha('caio', casa(8, 8))
      const lia = ficha('lia', casa(9, 8))
      const mundoCorredor = (fim: number, noSalao: Token[] = []): HostWorld => ({
        open: { sceneId: 'salao', name: 'Salão', map: mapa({ walls: corredorAte(fim), tokens: noSalao }) },
        background: [{ sceneId: 'cripta', name: 'Cripta', map: mapa({ tokens: [{ ...bote, veiculo: { lugares: 2, passageiros: ['remo'] } }, remo, caio, lia] }) }],
      })
      const doCaio = membro('p3', 'Caio', caio)
      const daLia = membro('p4', 'Lia', lia)
      /** Onde a travessia do bote põe o Gui (`adventureStore.transferToken`), com o que a reunião guardou. */
      const guiNaTravessia = (plano: GatherPlan, salao: MapData): { x: number; y: number } | undefined => {
        const doBote = plano.moves.find((m) => m.tokenId === 'bote')
        if (doBote === undefined) return undefined
        const [casaDoGui] = vehicleRiderSpots(salao, { x: doBote.x, y: doBote.y, size: 1 }, [{ dx: remo.x - bote.x, dy: remo.y - bote.y, size: 1 }], plano.hold.keepClear, plano.hold.seats)
        return casaDoGui
      }

      it('o plano guarda a casa de cada membro e o pino, e cada travessia leva isso junto', () => {
        const plano = planGather([dona, doCaio, gui], mundoCorredor(13), PINO)
        expect(plano.moves.map((m) => [m.tokenId, m.x, m.y])).toEqual([
          ['bote', casa(11, 5).x, casa(11, 5).y],
          ['caio', casa(12, 5).x, casa(12, 5).y],
        ])
        expect(plano.ridesAlong.map((r) => r.tokenId)).toEqual(['remo'])
        expect(plano.hold).toEqual({
          seats: [
            { ...casa(11, 5), size: 1 },
            { ...casa(12, 5), size: 1 },
          ],
          keepClear: pinClearance(PINO),
        })
        const chegadas: unknown[] = []
        applyGatherPlan(plano, {
          sceneId: 'salao',
          bringFromOtherScene: (_playerId, _sceneId, at) => {
            chegadas.push(at.hold)
            return true
          },
          placeInScene: () => undefined,
        })
        expect(chegadas).toEqual([plano.hold, plano.hold])
      })

      it('o Caio viaja depois do bote: o afastamento do Gui cai na casa dele, e o Gui fica dentro do bote', () => {
        // Três casas: a do pino, a do bote e a do Caio. O Gui estava uma casa à direita do bote.
        const mundo = mundoCorredor(13)
        const plano = planGather([dona, doCaio, gui], mundo, PINO)
        expect(guiNaTravessia(plano, mundo.open.map)).toEqual(casa(11, 5))
      })

      it('o Caio já está no salão e só assenta no fim: a casa dele também fica guardada', () => {
        const caioAqui = ficha('caio', casa(12, 5))
        const mundo = mundoCorredor(13, [caioAqui])
        const plano = planGather([dona, { ...membro('p3', 'Caio', caioAqui), sceneId: 'salao' }, gui], mundo, PINO)
        expect(plano.moves.map((m) => [m.tokenId, m.travels, m.x, m.y])).toEqual([
          ['bote', true, casa(11, 5).x, casa(11, 5).y],
          ['caio', false, casa(12, 5).x, casa(12, 5).y],
        ])
        // Sem o Caio no mapa (a travessia vê o salão como ficará): a casa dele continua guardada.
        expect(guiNaTravessia(plano, mapa({ walls: corredorAte(13) }))).toEqual(casa(11, 5))
      })

      it('sobra uma casa livre perto do bote: o Gui senta nela, não na do Caio nem na da Lia', () => {
        // Cinco casas: pino, bote, Caio, Lia — e a da ponta, longe demais do pino, mas a três casas do bote.
        const mundo = mundoCorredor(15)
        const plano = planGather([dona, doCaio, daLia, gui], mundo, PINO)
        expect(plano.leftOut).toEqual([])
        expect(plano.moves.map((m) => [m.tokenId, m.x])).toEqual([
          ['bote', casa(11, 5).x],
          ['caio', casa(12, 5).x],
          ['lia', casa(13, 5).x],
        ])
        expect(guiNaTravessia(plano, mundo.open.map)).toEqual(casa(14, 5))
      })
    })

    it('fora do bote, ou com o bote também sem casa: o Gui fica mesmo de fora', () => {
      const semBordo = planGather([dona, gui], mundoApertado(cubiculo, []), PINO)
      expect(semBordo.leftOut).toEqual(['Gui'])
      expect(semBordo.ridesAlong).toEqual([])
      const semCasa = planGather([dona, gui], mundoApertado(poco, ['remo']), PINO)
      expect(semCasa.leftOut).toEqual(['Duda', 'Gui'])
      expect(semCasa.moves).toEqual([])
      expect(semCasa.ridesAlong).toEqual([])
    })
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

  it('casa já dada a quem ainda não chegou: o passageiro não senta nela', () => {
    const chegada = { ...PINO, size: 1 }
    const aDireita = [{ dx: GRADE, dy: 0, size: 1 }]
    expect(vehicleRiderSpots(mapa(), chegada, aDireita)).toEqual([{ x: PINO.x + GRADE, y: PINO.y }])
    expect(vehicleRiderSpots(mapa(), chegada, aDireita, [], [{ x: PINO.x + GRADE, y: PINO.y, size: 1 }])).toEqual([{ x: PINO.x, y: PINO.y - GRADE }])
  })

  it('sem casa livre nenhuma: fica na casa do próprio veículo, dentro do mapa', () => {
    // Um cubículo de uma casa só em volta do veículo.
    const map = mapa({
      walls: [parede('n', 0, 250, 50, 250), parede('s', 0, 300, 50, 300), parede('l', 50, 250, 50, 300)],
    })
    expect(vehicleRiderSpots(map, veiculo, [{ dx: GRADE, dy: 0, size: 1 }])).toEqual([{ x: veiculo.x, y: veiculo.y }])
  })

  it('o pino de viagem do destino fica livre: quem ia sentar na casa dele assenta na casa livre mais perto do veículo', () => {
    // O veículo chegou na casa de cima do pino; o Gui, logo abaixo dele, cairia em cima do pino.
    const chegada = { ...casa(10, 4), size: 1 }
    const abaixo = [{ dx: 0, dy: GRADE, size: 1 }]
    expect(vehicleRiderSpots(mapa(), chegada, abaixo)).toEqual([PINO])
    expect(vehicleRiderSpots(mapa(), chegada, abaixo, pinClearance(PINO))).toEqual([casa(10, 3)])
    // O afastamento que não encosta no pino continua valendo.
    expect(vehicleRiderSpots(mapa(), chegada, [{ dx: -GRADE, dy: 0, size: 1 }], pinClearance(PINO))).toEqual([casa(9, 4)])
  })
})

describe('holdAlongSeats: as casas de quem atravessa junto com a ficha principal', () => {
  const partida = mapa({ tokens: [ficha('ponei', casa(1, 1)), ficha('urso', casa(2, 1), 2)] })

  it('soma ao que a reunião já guardava, com o tamanho de cada um no mapa de partida', () => {
    const reuniao = { seats: [{ x: 10, y: 10, size: 1 }], keepClear: pinClearance(PINO) }
    const along = [
      { tokenId: 'ponei', x: 100, y: 100 },
      { tokenId: 'urso', x: 200, y: 200 },
    ]
    expect(holdAlongSeats(reuniao, along, partida)).toEqual({
      seats: [
        { x: 10, y: 10, size: 1 },
        { x: 100, y: 100, size: 1 },
        { x: 200, y: 200, size: 2 },
      ],
      keepClear: pinClearance(PINO),
    })
  })

  it('sem reunião, guarda só as de quem vai junto; quem não está na partida não guarda casa', () => {
    expect(holdAlongSeats(undefined, [{ tokenId: 'ponei', x: 100, y: 100 }, { tokenId: 'sumiu', x: 7, y: 7 }], partida)).toEqual({
      seats: [{ x: 100, y: 100, size: 1 }],
      keepClear: [],
    })
  })

  it('ninguém junto: o que veio, pela mesma referência', () => {
    const reuniao = { seats: [], keepClear: [] }
    expect(holdAlongSeats(reuniao, [], partida)).toBe(reuniao)
    expect(holdAlongSeats(undefined, [{ tokenId: 'sumiu', x: 7, y: 7 }], partida)).toBeUndefined()
  })
})

describe('veículo que já está na cena do pino: quem vai a bordo sem estar marcado chega em casa livre', () => {
  // A Duda leva o bote no salão, com um NPC a bordo que o mestre não marcou; a Bia e o Caio andam a pé.
  const bote = (npcEm: { x: number; y: number }): Token[] => [
    { ...ficha('bote', casa(4, 4)), veiculo: { lugares: 2, passageiros: ['npc'] } },
    ficha('npc', npcEm),
    ficha('bia', casa(2, 9)),
    ficha('caio', casa(15, 9)),
  ]
  const noSalao = (tokens: Token[], walls: Wall[] = []): HostWorld => ({ open: { sceneId: 'salao', name: 'Salão', map: mapa({ tokens, walls }) }, background: [] })
  const membro = (playerId: string, name: string, token: Token): PartyMember => ({
    playerId,
    name,
    connected: true,
    sceneId: 'salao',
    sceneName: null,
    travelPending: false,
    mochila: [],
    token: { id: token.id, color: '#3cff00', x: token.x, y: token.y },
  })
  /** Reúne Duda, Bia e Caio no pino e aplica o passo local como o editor (`setTokenPositions`: uma ficha por vez). */
  const reunir = (mundo: HostWorld) => {
    const porId = (id: string): Token => {
      const token = mundo.open.map.tokens.find((t) => t.id === id)
      if (token === undefined) throw new Error(`ficha ${id} fora do salão`)
      return token
    }
    const plano = planGather([membro('p1', 'Duda', porId('bote')), membro('p2', 'Bia', porId('bia')), membro('p3', 'Caio', porId('caio'))], mundo, PINO)
    let depois = mundo.open.map
    const falhou = applyGatherPlan(plano, {
      sceneId: 'salao',
      bringFromOtherScene: () => false,
      placeInScene: (posicoes) => {
        depois = posicoes.reduce((acc, p) => setTokenPosition(acc, p.id, p.x, p.y), depois)
      },
    })
    const onde = (id: string): { x: number; y: number } => {
      const token = depois.tokens.find((t) => t.id === id)
      if (token === undefined) throw new Error(`ficha ${id} sumiu`)
      return { x: token.x, y: token.y }
    }
    return { plano, falhou, depois, onde }
  }
  const empilhadas = (map: MapData): string[] => {
    const porCasa = new Map<string, string[]>()
    for (const t of map.tokens) porCasa.set(`${t.x}|${t.y}`, [...(porCasa.get(`${t.x}|${t.y}`) ?? []), t.id])
    return [...porCasa.values()].filter((ids) => ids.length > 1).map((ids) => ids.join('+'))
  }

  it.each([
    ['à esquerda, embaixo (cairia em cima da Bia)', casa(3, 5)],
    ['à direita, embaixo (cairia em cima do Caio)', casa(5, 5)],
    ['logo embaixo (cairia na casa do pino)', casa(4, 5)],
  ])('NPC %s: ninguém empilhado, nada na casa do pino, e ele continua a bordo ao lado do bote', (_caso, npcEm) => {
    const { plano, falhou, depois, onde } = reunir(noSalao(bote(npcEm)))
    expect(falhou).toEqual([])
    expect(plano.leftOut).toEqual([])
    expect(plano.moves.map((m) => m.tokenId)).toEqual(['bote', 'bia', 'caio'])
    expect(empilhadas(depois)).toEqual([])
    expect(depois.tokens.filter((t) => t.x === PINO.x && t.y === PINO.y).map((t) => t.id)).toEqual([])
    // Arrastado pelo bote: o mesmo afastamento de antes, e ainda a bordo.
    const doBote = onde('bote')
    expect(onde('npc')).toEqual({ x: doBote.x + npcEm.x - casa(4, 4).x, y: doBote.y + npcEm.y - casa(4, 4).y })
    expect(passengerIdsOf(depois, 'bote')).toEqual(['npc'])
    // A casa onde o NPC chega fica guardada para quem atravessa antes do passo local.
    expect(plano.hold.seats).toContainEqual({ ...onde('npc'), size: 1 })
  })

  it('o Gui, marcado e a bordo, tem casa própria em volta do pino: o NPC não marcado não cai nela', () => {
    const gui = ficha('gui', casa(5, 4))
    const tokens: Token[] = [{ ...ficha('bote', casa(4, 4)), veiculo: { lugares: 2, passageiros: ['gui', 'npc'] } }, gui, ficha('npc', casa(4, 5)), ficha('bia', casa(2, 9)), ficha('caio', casa(15, 9))]
    const mundo = noSalao(tokens)
    const plano = planGather([membro('p1', 'Duda', tokens[0]), membro('p4', 'Gui', gui)], mundo, PINO)
    const depois = [...plano.moves].reduce((acc, m) => setTokenPosition(acc, m.tokenId, m.x, m.y), mundo.open.map)
    expect(plano.leftOut).toEqual([])
    expect(empilhadas(depois)).toEqual([])
    expect(depois.tokens.filter((t) => t.x === PINO.x && t.y === PINO.y).map((t) => t.id)).toEqual([])
  })
})
