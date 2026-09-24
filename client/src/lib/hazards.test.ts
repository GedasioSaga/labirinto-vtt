/**
 * ZONA DE PERIGO — a regra pura: o mestre pinta salas com um perigo, o botão
 * "Avançar" leva o perigo um passo pelas portas ABERTAS, a ficha que entra é
 * notada uma vez, e a fumaça encurta a visão de quem está dentro.
 */
import { describe, expect, it } from 'vitest'
import { GRADE, ficha, parede, sala, torre, zona } from './__fixtures__/hazardTower'
import {
  SMOKE_VISION_CELLS,
  advanceHazard,
  hazardOfRoom,
  hazardPresence,
  hazardsOf,
  newHazardEntries,
  readHazards,
  setRoomHazard,
  visionRadiusAt,
} from './hazards'
import { deserializeMap, serializeMap } from './mapFile'

let n = 0
const novoId = () => `z-${(n += 1)}`

describe('advanceHazard — um passo pelas portas abertas', () => {
  it('o fogo da sala A toma a B pela porta aberta e para na porta fechada da C', () => {
    const inicio = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a'])] })
    const umPasso = advanceHazard(inicio, 'fogo-1')
    expect(hazardsOf(umPasso)).toEqual([zona('fogo-1', 'fogo', ['sala-a', 'sala-b'])])
    // Segundo passo: a porta B|C continua fechada — nada muda, e o mapa é o MESMO (sem histórico à toa).
    expect(advanceHazard(umPasso, 'fogo-1')).toBe(umPasso)
  })

  it('com a porta B|C aberta o passo seguinte chega à C — um passo por vez, nunca dois', () => {
    const inicio = torre({ abertaBC: true, hazards: [zona('fogo-1', 'fogo', ['sala-a'])] })
    const umPasso = advanceHazard(inicio, 'fogo-1')
    expect(hazardOfRoom(umPasso, 'sala-c')).toBeNull()
    expect(hazardOfRoom(advanceHazard(umPasso, 'fogo-1'), 'sala-c')?.id).toBe('fogo-1')
  })

  it('parede sem porta segura o perigo', () => {
    const base = torre({ hazards: [zona('agua-1', 'agua', ['sala-a'])] })
    const semPorta = { ...base, walls: base.walls.filter((w) => w.door === null).concat(parede('tapada', 500, 150, 500, 250)) }
    expect(advanceHazard(semPorta, 'agua-1')).toBe(semPorta)
  })

  it('zona que não existe devolve o mesmo mapa', () => {
    const inicio = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a'])] })
    expect(advanceHazard(inicio, 'nao-existe')).toBe(inicio)
  })

  it('avança pelos dois lados: fumaça na B vaza para a A pela porta aberta', () => {
    const inicio = torre({ hazards: [zona('fumo', 'fumaca', ['sala-b'])] })
    expect(hazardsOf(advanceHazard(inicio, 'fumo'))[0]?.roomIds).toEqual(['sala-b', 'sala-a'])
  })
})

describe('setRoomHazard — o mestre pinta a sala', () => {
  it('pinta, troca de perigo e apaga; a última apagada tira o campo do mapa', () => {
    const vazio = torre()
    const pintado = setRoomHazard(vazio, 'sala-a', 'fogo', novoId)
    expect(hazardOfRoom(pintado, 'sala-a')?.kind).toBe('fogo')
    // Mesmo perigo em outra sala: entra na MESMA zona, que avança junta.
    const duas = setRoomHazard(pintado, 'sala-c', 'fogo', novoId)
    expect(hazardsOf(duas)).toHaveLength(1)
    expect(hazardsOf(duas)[0]?.roomIds).toEqual(['sala-a', 'sala-c'])
    // Trocar para fumaça tira a sala do fogo.
    const trocada = setRoomHazard(duas, 'sala-a', 'fumaca', novoId)
    expect(hazardOfRoom(trocada, 'sala-a')?.kind).toBe('fumaca')
    expect(hazardOfRoom(trocada, 'sala-c')?.kind).toBe('fogo')
    const limpo = setRoomHazard(setRoomHazard(trocada, 'sala-a', null, novoId), 'sala-c', null, novoId)
    expect('hazards' in limpo).toBe(false)
  })

  it('região que não é Sala, ou id que não existe, devolve o mesmo mapa', () => {
    const area = sala('area', 0, 100, { room: undefined })
    const map = torre({ regions: [area] })
    expect(setRoomHazard(map, 'area', 'fogo', novoId)).toBe(map)
    expect(setRoomHazard(map, 'fantasma', 'fogo', novoId)).toBe(map)
  })
})

describe('readHazards — o que vem do disco chega cru', () => {
  it('fica só a forma certa, sem sala repetida; lista vazia ou lixo é ausência', () => {
    expect(
      readHazards([
        { id: 'z1', kind: 'fogo', roomIds: ['a', 'a', 'b', 3] },
        { id: 'z2', kind: 'lava', roomIds: ['a'] },
        { id: '', kind: 'fogo', roomIds: ['a'] },
        { id: 'z3', kind: 'agua', roomIds: [] },
        null,
      ]),
    ).toEqual([{ id: 'z1', kind: 'fogo', roomIds: ['a', 'b'] }])
    expect(readHazards([])).toBeUndefined()
    expect(readHazards('fogo')).toBeUndefined()
    expect(readHazards(undefined)).toBeUndefined()
  })
})

describe('salvar e abrir o mapa', () => {
  it('a zona volta do disco; mapa sem zona continua sem o campo', () => {
    const comFogo = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a', 'sala-b'])] })
    expect(hazardsOf(deserializeMap(serializeMap(comFogo)))).toEqual([zona('fogo-1', 'fogo', ['sala-a', 'sala-b'])])
    expect('hazards' in deserializeMap(serializeMap(torre()))).toBe(false)
  })
})

describe('visionRadiusAt — fumaça encurta a visão', () => {
  const map = torre({ hazards: [zona('fumo', 'fumaca', ['sala-a']), zona('fogo', 'fogo', ['sala-b'])] })

  it('dentro da fumaça o raio cai para o teto da fumaça; fora, e no fogo, fica o de sempre', () => {
    expect(visionRadiusAt(map, { x: 250, y: 200 }, 700)).toBe(SMOKE_VISION_CELLS * GRADE)
    expect(visionRadiusAt(map, { x: 750, y: 200 }, 700)).toBe(700)
    expect(visionRadiusAt(map, { x: 1250, y: 200 }, 700)).toBe(700)
  })

  it('raio já menor que o da fumaça não cresce', () => {
    expect(visionRadiusAt(map, { x: 250, y: 200 }, 30)).toBe(30)
  })
})

describe('hazardPresence + newHazardEntries — quem entrou agora', () => {
  it('a ficha que entra é notada uma vez; sair e voltar nota de novo; ficha fora da lista nunca', () => {
    const fogo = [zona('fogo-1', 'fogo', ['sala-b'])]
    const fora = hazardPresence(torre({ hazards: fogo, tokens: [ficha('ana', 250, 200), ficha('ogro', 750, 200)] }), ['ana'])
    expect(newHazardEntries(undefined, fora)).toEqual([])

    const dentro = hazardPresence(torre({ hazards: fogo, tokens: [ficha('ana', 750, 200), ficha('ogro', 750, 200)] }), ['ana'])
    expect(newHazardEntries(fora, dentro)).toEqual([{ tokenId: 'ana', hazardId: 'fogo-1', kind: 'fogo' }])
    expect(newHazardEntries(dentro, dentro)).toEqual([])

    const saiu = hazardPresence(torre({ hazards: fogo, tokens: [ficha('ana', 250, 200)] }), ['ana'])
    expect(newHazardEntries(dentro, saiu)).toEqual([])
    expect(newHazardEntries(saiu, dentro)).toHaveLength(1)
  })

  it('o perigo que avança sobre a ficha parada também conta como entrar', () => {
    const antes = torre({ hazards: [zona('fogo-1', 'fogo', ['sala-a'])], tokens: [ficha('ana', 750, 200)] })
    const depois = advanceHazard(antes, 'fogo-1')
    expect(newHazardEntries(hazardPresence(antes, ['ana']), hazardPresence(depois, ['ana']))).toEqual([
      { tokenId: 'ana', hazardId: 'fogo-1', kind: 'fogo' },
    ])
  })
})
