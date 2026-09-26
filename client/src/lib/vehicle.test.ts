/**
 * VEÍCULO COM LUGARES — as regras puras (`lib/vehicle.ts`).
 *
 * Aceite do pedido: o cesto (2 lugares) leva o Gui e mais 1, recusa o 3º; quem
 * está a bordo anda junto com o cesto dentro da cena. A travessia do pino é
 * cobrada de ponta a ponta em `stores/veiculo.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import type { Light, MapData, Token, Wall } from '../types/map'
import { createEmptyMap, removeToken, setTokenPosition } from './mapFactory'
import { cloneToken } from './entityClone'
import {
  boardVehicle,
  leaveVehicle,
  moveTokenWithVehicle,
  moveTokensWithVehicles,
  passengerIdsOf,
  readTokenVehicle,
  setVehicleSeats,
  vehicleCarrying,
  vehicleOf,
  vehicleSeatOptions,
  VEHICLE_SEATS_MAX,
} from './vehicle'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id === 'gui' ? 'Gui' : id, x, y, size: 1, image: null, ...extra }
}

const CESTO = ficha('cesto', 300, 300, { name: 'Cesto', npc: true, veiculo: { lugares: 2 } })

function cena(extra: Token[] = []): MapData {
  return { ...createEmptyMap('a06', 'Poço', 20, 20, 64), tokens: [CESTO, ficha('gui', 280, 300), ficha('bia', 320, 300), ficha('caio', 360, 300), ...extra] }
}

/** Embarca e falha o teste se recusar: o resto do cenário depende do embarque. */
function embarcar(map: MapData, tokenId: string): MapData {
  const result = boardVehicle(map, 'cesto', tokenId)
  if (!result.ok) throw new Error(`${tokenId} não embarcou: ${result.motivo}`)
  return result.map
}

function posicao(map: MapData, id: string): [number, number] | null {
  const token = map.tokens.find((t) => t.id === id)
  return token === undefined ? null : [token.x, token.y]
}

describe('embarcar: o cesto leva o Gui e mais 1 e recusa o 3º', () => {
  it('Gui e Bia embarcam, na ordem; Caio é recusado com "cheio" e o mapa não muda', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    expect(passengerIdsOf(cheio, 'cesto')).toEqual(['gui', 'bia'])

    const terceiro = boardVehicle(cheio, 'cesto', 'caio')
    expect(terceiro).toEqual({ ok: false, motivo: 'cheio' })
    expect(passengerIdsOf(cheio, 'cesto')).toEqual(['gui', 'bia'])
    expect(vehicleCarrying(cheio, 'caio')).toBeNull()
  })

  it('embarcar de novo quem já está a bordo não gasta lugar nem muda o mapa', () => {
    const comGui = embarcar(cena(), 'gui')
    const denovo = boardVehicle(comGui, 'cesto', 'gui')
    expect(denovo.ok && denovo.map).toBe(comGui)
    expect(passengerIdsOf(comGui, 'cesto')).toEqual(['gui'])
  })

  it('recusa a própria ficha, outro veículo, ficha que não está na cena e ficha comum como veículo', () => {
    const bote = ficha('bote', 500, 500, { veiculo: { lugares: 4 } })
    const map = cena([bote])
    expect(boardVehicle(map, 'cesto', 'cesto')).toEqual({ ok: false, motivo: 'propria' })
    expect(boardVehicle(map, 'cesto', 'bote')).toEqual({ ok: false, motivo: 'e-veiculo' })
    expect(boardVehicle(map, 'cesto', 'fantasma')).toEqual({ ok: false, motivo: 'sem-ficha' })
    expect(boardVehicle(map, 'gui', 'bia')).toEqual({ ok: false, motivo: 'sem-veiculo' })
  })

  it('embarcar noutro veículo desce do primeiro: ninguém ocupa dois lugares', () => {
    // O bote encostado no Gui, do outro lado do cesto: embarcar exige estar perto.
    const bote = ficha('bote', 216, 300, { veiculo: { lugares: 4 } })
    const noCesto = embarcar(cena([bote]), 'gui')
    const result = boardVehicle(noCesto, 'bote', 'gui')
    expect(result.ok).toBe(true)
    const noBote = result.ok ? result.map : noCesto
    expect(passengerIdsOf(noBote, 'cesto')).toEqual([])
    expect(passengerIdsOf(noBote, 'bote')).toEqual(['gui'])
    expect(vehicleCarrying(noBote, 'gui')?.id).toBe('bote')
  })

  it('descer libera o lugar: com o Gui fora, o Caio cabe', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const semGui = leaveVehicle(cheio, 'gui')
    expect(passengerIdsOf(semGui, 'cesto')).toEqual(['bia'])
    expect(boardVehicle(semGui, 'cesto', 'caio').ok).toBe(true)
    // Quem não está a bordo de nada: o mesmo mapa, sem cópia.
    expect(leaveVehicle(cheio, 'caio')).toBe(cheio)
  })

  it('último a descer apaga a lista em vez de gravar []', () => {
    const vazio = leaveVehicle(embarcar(cena(), 'gui'), 'gui')
    expect(vazio.tokens.find((t) => t.id === 'cesto')?.veiculo).toEqual({ lugares: 2 })
  })
})

describe('embarcar exige proximidade: sobe quem está perto do veículo', () => {
  // Grade de 64 px; o cesto (1 casa) em 300,300. "Perto" = no máximo uma casa
  // livre entre a borda do veículo e a da ficha.
  it('encostada (do lado ou na diagonal) e com uma casa de folga embarca; com duas casas de folga é recusada com "longe" e o mapa não muda', () => {
    const map = cena([ficha('diag', 364, 364), ficha('folga', 300, 428), ficha('longe', 300, 492)])
    expect(boardVehicle(map, 'cesto', 'diag').ok).toBe(true)
    expect(boardVehicle(map, 'cesto', 'folga').ok).toBe(true)
    expect(boardVehicle(map, 'cesto', 'longe')).toEqual({ ok: false, motivo: 'longe' })
    expect(vehicleCarrying(map, 'longe')).toBeNull()
  })

  it('a ficha do outro lado da cena não embarca, mesmo com lugar sobrando', () => {
    const map = cena([ficha('longe', 1200, 1200)])
    expect(boardVehicle(map, 'cesto', 'longe')).toEqual({ ok: false, motivo: 'longe' })
    expect(passengerIdsOf(map, 'cesto')).toEqual([])
  })

  it('no outro piso, mesmo em cima do cesto, não embarca', () => {
    const map = cena([ficha('alto', 300, 300, { piso: 1 })])
    expect(boardVehicle(map, 'cesto', 'alto')).toEqual({ ok: false, motivo: 'longe' })
    expect(boardVehicle(map, 'cesto', 'gui').ok).toBe(true)
  })

  it('veículo de 2 casas: a folga conta da borda dele, não do centro', () => {
    // O bote ocupa 2x2 casas com o centro em 640,640 (bordas em 576 e 704).
    const bote = ficha('bote', 640, 640, { size: 2, veiculo: { lugares: 4 } })
    const map = cena([bote, ficha('remo', 800, 640), ficha('ancora', 864, 640)])
    expect(boardVehicle(map, 'bote', 'remo').ok).toBe(true)
    expect(boardVehicle(map, 'bote', 'ancora')).toEqual({ ok: false, motivo: 'longe' })
  })

  it('quem já está a bordo e ficou longe (mapa de arquivo) continua a bordo: embarcar de novo devolve o mesmo mapa', () => {
    const map = cena([ficha('longe', 1200, 1200)])
    const comLonge: MapData = { ...map, tokens: map.tokens.map((t) => (t.id === 'cesto' ? { ...t, veiculo: { lugares: 2, passageiros: ['longe'] } } : t)) }
    const denovo = boardVehicle(comLonge, 'cesto', 'longe')
    expect(denovo.ok && denovo.map).toBe(comLonge)
  })
})

describe('andar com o veículo dentro da cena', () => {
  it('o cesto anda e leva quem está a bordo pelo mesmo deslocamento; quem ficou fora fica', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const andou = moveTokenWithVehicle(cheio, 'cesto', 700, 400)
    expect(posicao(andou, 'cesto')).toEqual([700, 400])
    expect(posicao(andou, 'gui')).toEqual([680, 400])
    expect(posicao(andou, 'bia')).toEqual([720, 400])
    expect(posicao(andou, 'caio')).toEqual([360, 300])
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['gui', 'bia'])
  })

  it('a tocha presa no passageiro anda com ele', () => {
    const tocha: Light = { id: 'tocha', x: 280, y: 300, radius: 200, color: '#ffcc66', intensity: 1, attachedTokenId: 'gui' }
    const map = { ...embarcar(cena(), 'gui'), lights: [tocha] }
    const andou = setTokenPosition(map, 'cesto', 400, 300)
    expect(andou.lights.map((l) => [l.x, l.y])).toEqual([[380, 300]])
  })

  it('o editor (setTokenPosition) usa a mesma regra', () => {
    const andou = setTokenPosition(embarcar(cena(), 'gui'), 'cesto', 300, 500)
    expect(posicao(andou, 'gui')).toEqual([280, 500])
  })

  it('o passageiro que anda sozinho desce do cesto', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const desceu = moveTokenWithVehicle(cheio, 'gui', 100, 100)
    expect(posicao(desceu, 'gui')).toEqual([100, 100])
    expect(passengerIdsOf(desceu, 'cesto')).toEqual(['bia'])
    // Parado no mesmo lugar não é descer.
    expect(passengerIdsOf(moveTokenWithVehicle(cheio, 'gui', 280, 300), 'cesto')).toEqual(['gui', 'bia'])
  })

  it('ficha que não existe: o mesmo mapa', () => {
    const map = cena()
    expect(moveTokenWithVehicle(map, 'fantasma', 1, 1)).toBe(map)
  })
})

describe('andar o grupo da seleção (setas, arrasto em área) com o veículo', () => {
  it('o cesto no grupo leva quem está a bordo e a tocha dele; a luz que a seleção já moveu não anda de novo', () => {
    const tocha: Light = { id: 'tocha', x: 280, y: 300, radius: 200, color: '#ffcc66', intensity: 1, attachedTokenId: 'gui' }
    const lampiao: Light = { id: 'lampiao', x: 320, y: 300, radius: 200, color: '#ffcc66', intensity: 1, attachedTokenId: 'bia' }
    const map = { ...embarcar(embarcar(cena(), 'gui'), 'bia'), lights: [tocha, lampiao] }
    const andou = moveTokensWithVehicles(map, new Set(['cesto']), 10, 20, new Set(['lampiao']))
    expect(posicao(andou, 'cesto')).toEqual([310, 320])
    expect(posicao(andou, 'gui')).toEqual([290, 320])
    expect(posicao(andou, 'bia')).toEqual([330, 320])
    expect(posicao(andou, 'caio')).toEqual([360, 300])
    expect(andou.lights.map((l) => [l.id, l.x, l.y])).toEqual([
      ['tocha', 290, 320],
      ['lampiao', 320, 300],
    ])
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['gui', 'bia'])
  })

  it('cesto e passageiro no mesmo grupo andam uma vez só e o passageiro segue a bordo', () => {
    const cheio = embarcar(cena(), 'gui')
    const andou = moveTokensWithVehicles(cheio, new Set(['cesto', 'gui']), 0, 64)
    expect(posicao(andou, 'gui')).toEqual([280, 364])
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['gui'])
  })

  it('o passageiro no grupo sem o cesto desce; o cesto e quem ficou a bordo não andam', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const andou = moveTokensWithVehicles(cheio, new Set(['gui', 'caio']), -64, 0)
    expect(posicao(andou, 'gui')).toEqual([216, 300])
    expect(posicao(andou, 'caio')).toEqual([296, 300])
    expect(posicao(andou, 'cesto')).toEqual([300, 300])
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['bia'])
  })

  it('deslocamento zero ou grupo sem ficha da cena: o mesmo mapa', () => {
    const map = embarcar(cena(), 'gui')
    expect(moveTokensWithVehicles(map, new Set(['gui']), 0, 0)).toBe(map)
    expect(moveTokensWithVehicles(map, new Set(['fantasma']), 5, 5)).toBe(map)
  })
})

describe('o passageiro não atravessa parede quando o veículo anda dentro da cena', () => {
  // Grade de 64. O cesto na casa (4,4); o Gui a bordo na de cima, (4,3); a Bia
  // a bordo na de baixo, (4,5). Um muro de uma casa em x = 320, só na linha do
  // Gui: o cesto e a Bia passam para a direita, o Gui não.
  const MURO: Wall = { id: 'muro', x1: 320, y1: 192, x2: 320, y2: 256, blocksLight: true, blocksMove: true, door: null }

  function corredor(): MapData {
    const cesto = ficha('cesto', 288, 288, { name: 'Cesto', veiculo: { lugares: 2, passageiros: ['gui', 'bia'] } })
    return { ...createEmptyMap('a06', 'Poço', 20, 20, 64), walls: [MURO], tokens: [cesto, ficha('gui', 288, 224), ficha('bia', 288, 352)] }
  }

  it('o cesto anda para a direita: o Gui, barrado pelo muro, fica onde estava e desce; a Bia vai junto e segue a bordo', () => {
    const andou = moveTokenWithVehicle(corredor(), 'cesto', 352, 288)
    expect(posicao(andou, 'cesto')).toEqual([352, 288])
    expect(posicao(andou, 'gui')).toEqual([288, 224])
    expect(posicao(andou, 'bia')).toEqual([352, 352])
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['bia'])
  })

  it('pelo setTokenPosition (arrasto do mestre e passo do jogador dono do cesto): a tocha do Gui fica com ele', () => {
    const tocha: Light = { id: 'tocha', x: 288, y: 224, radius: 200, color: '#ffcc66', intensity: 1, attachedTokenId: 'gui' }
    const map = { ...corredor(), lights: [tocha] }
    const andou = setTokenPosition(map, 'cesto', 352, 288)
    expect(posicao(andou, 'gui')).toEqual([288, 224])
    expect(andou.lights.map((l) => [l.x, l.y])).toEqual([[288, 224]])
    expect(passengerIdsOf(andou, 'cesto')).toEqual(['bia'])
  })

  it('as setas com o cesto selecionado: a mesma regra; o Gui mandado junto pelo mestre anda', () => {
    const soCesto = moveTokensWithVehicles(corredor(), new Set(['cesto']), 64, 0)
    expect(posicao(soCesto, 'gui')).toEqual([288, 224])
    expect(posicao(soCesto, 'bia')).toEqual([352, 352])
    expect(passengerIdsOf(soCesto, 'cesto')).toEqual(['bia'])
    // Selecionado junto, quem o mandou foi o mestre: anda, e segue a bordo.
    const comGui = moveTokensWithVehicles(corredor(), new Set(['cesto', 'gui']), 64, 0)
    expect(posicao(comGui, 'gui')).toEqual([352, 224])
    expect(passengerIdsOf(comGui, 'cesto')).toEqual(['gui', 'bia'])
  })

  it('sem muro no caminho, todos andam e ninguém desce', () => {
    const livre = moveTokenWithVehicle({ ...corredor(), walls: [] }, 'cesto', 352, 288)
    expect(posicao(livre, 'gui')).toEqual([352, 224])
    expect(passengerIdsOf(livre, 'cesto')).toEqual(['gui', 'bia'])
  })
})

describe('lugares do veículo', () => {
  it('liga com N lugares, corta quem sobra ao baixar, e desliga sem mexer em quem estava a bordo', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const umLugar = setVehicleSeats(cheio, 'cesto', 1)
    expect(passengerIdsOf(umLugar, 'cesto')).toEqual(['gui'])
    const semVeiculo = setVehicleSeats(cheio, 'cesto', null)
    expect(semVeiculo.tokens.find((t) => t.id === 'cesto')).not.toHaveProperty('veiculo')
    expect(posicao(semVeiculo, 'gui')).toEqual([280, 300])
    const vagonete = setVehicleSeats(cena(), 'caio', 3)
    expect(vehicleOf(vagonete.tokens.find((t) => t.id === 'caio') ?? CESTO)).toEqual({ lugares: 3 })
  })

  it('lugares fora da faixa vão para a borda dela', () => {
    expect(vehicleOf(setVehicleSeats(cena(), 'caio', 0).tokens[3])?.lugares).toBe(1)
    expect(vehicleOf(setVehicleSeats(cena(), 'caio', 99).tokens[3])?.lugares).toBe(VEHICLE_SEATS_MAX)
  })

  it('passageiro que vira veículo desce antes: sem veículo dentro de veículo', () => {
    const comGui = embarcar(cena(), 'gui')
    const guiVeiculo = setVehicleSeats(comGui, 'gui', 2)
    expect(passengerIdsOf(guiVeiculo, 'cesto')).toEqual([])
    expect(vehicleOf(guiVeiculo.tokens[1])).toEqual({ lugares: 2 })
  })

  it('copiar o cesto cheio dá um cesto VAZIO com os mesmos lugares: ninguém fica a bordo de dois', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const original = cheio.tokens[0]
    const copia = cloneToken(original, { dx: 64, dy: 0 })
    expect(copia.veiculo).toEqual({ lugares: 2 })
    expect(original.veiculo).toEqual({ lugares: 2, passageiros: ['gui', 'bia'] })
    const comCopia = { ...cheio, tokens: [...cheio.tokens, copia] }
    expect(passengerIdsOf(comCopia, copia.id)).toEqual([])
    // Ficha comum copiada continua sem o campo.
    expect(cloneToken(cheio.tokens[3], { dx: 0, dy: 0 })).not.toHaveProperty('veiculo')
  })

  it('apagar a ficha a bordo tira ela da lista do cesto', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    const semBia = removeToken(cheio, 'bia')
    expect(semBia.tokens.find((t) => t.id === 'cesto')?.veiculo).toEqual({ lugares: 2, passageiros: ['gui'] })
  })
})

describe('as opções do painel', () => {
  it('lista as fichas da cena menos o próprio veículo; cheio, quem está fora fica indisponível', () => {
    const cheio = embarcar(embarcar(cena(), 'gui'), 'bia')
    expect(vehicleSeatOptions(cheio, 'cesto')).toEqual([
      { id: 'gui', nome: 'Gui', aBordo: true, disponivel: true, longe: false },
      { id: 'bia', nome: 'bia', aBordo: true, disponivel: true, longe: false },
      { id: 'caio', nome: 'caio', aBordo: false, disponivel: false, longe: false },
    ])
    expect(vehicleSeatOptions(embarcar(cena(), 'gui'), 'cesto').map((o) => o.disponivel)).toEqual([true, true, true])
  })

  it('a ficha longe do veículo aparece indisponível e marcada "longe", mesmo com lugar sobrando', () => {
    const opcoes = vehicleSeatOptions(cena([ficha('longe', 1200, 1200)]), 'cesto')
    expect(opcoes.find((o) => o.id === 'longe')).toEqual({ id: 'longe', nome: 'longe', aBordo: false, disponivel: false, longe: true })
    expect(opcoes.find((o) => o.id === 'gui')).toEqual({ id: 'gui', nome: 'Gui', aBordo: false, disponivel: true, longe: false })
  })
})

describe('readTokenVehicle — o campo como vem do disco', () => {
  it('forma certa fica; passageiro repetido, vazio, não-texto e excesso saem', () => {
    expect(readTokenVehicle({ lugares: 2, passageiros: ['gui', 'gui', '', 7, 'bia', 'caio'] })).toEqual({ lugares: 2, passageiros: ['gui', 'bia'] })
    expect(readTokenVehicle({ lugares: 3 })).toEqual({ lugares: 3 })
    expect(readTokenVehicle({ lugares: 3, passageiros: [] })).toEqual({ lugares: 3 })
    expect(readTokenVehicle({ lugares: 3, passageiros: 'gui' })).toEqual({ lugares: 3 })
  })

  it('lixo vira ausente: a ficha volta a ser comum', () => {
    expect(readTokenVehicle(undefined)).toBeUndefined()
    expect(readTokenVehicle(null)).toBeUndefined()
    expect(readTokenVehicle([2])).toBeUndefined()
    expect(readTokenVehicle({ lugares: 'dois' })).toBeUndefined()
    expect(readTokenVehicle({ lugares: 0 })).toBeUndefined()
    expect(readTokenVehicle({ lugares: 2.5 })).toBeUndefined()
    expect(readTokenVehicle({ lugares: VEHICLE_SEATS_MAX + 1 })).toBeUndefined()
  })

  it('a própria ficha na lista dela não conta como passageiro', () => {
    expect(vehicleOf(ficha('cesto', 0, 0, { veiculo: { lugares: 2, passageiros: ['cesto', 'gui'] } }))).toEqual({ lugares: 2, passageiros: ['gui'] })
  })
})
