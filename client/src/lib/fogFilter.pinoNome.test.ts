import { describe, expect, it } from 'vitest'
import type { MapData, Pin } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

/**
 * NOME DO LOCAL no recorte do jogador (09/10/2026): o nome é o título do
 * painel da revelação e atravessa SÓ junto com a descrição. O Diego, ao lado
 * do "?", recebe "Faca"; com o pino "só de perto" e a ficha longe, não recebe
 * nem a descrição nem o nome.
 */

const RAIO = 300
const POSSE = { diego: ['ficha-diego'] }
const DESCRICAO = 'Uma lâmina suja de sangue, embaixo do tapete.'

function mapaCom(pins: Pin[]): MapData {
  return {
    ...createEmptyMap('m', 'M', 1000, 1000, 40),
    tokens: [{ id: 'ficha-diego', characterId: null, name: 'Diego', x: 200, y: 200, size: 1, image: null }],
    pins,
  }
}

const FACA: Pin = { id: 'pino-7', x: 240, y: 200, kind: 'interrogacao', description: DESCRICAO, image: null, nome: 'Faca' }

describe('fogFilter: nome do local atravessa só com a descrição', () => {
  it('pino perto: chega com a descrição e com o nome', () => {
    const view = filterMapForPlayer(mapaCom([FACA]), 'diego', POSSE, RAIO)
    expect(view.map.pins).toHaveLength(1)
    expect(view.map.pins[0].description).toBe(DESCRICAO)
    expect(view.map.pins[0].nome).toBe('Faca')
  })

  it('pino "só de perto" com a ficha longe: sem descrição e sem nome, em lugar nenhum do recorte', () => {
    const longe: Pin = { ...FACA, x: 700, y: 200, lerDePerto: 1, marco: true }
    const view = filterMapForPlayer(mapaCom([longe]), 'diego', POSSE, RAIO)
    const pino = view.map.pins.find((p) => p.id === 'pino-7')
    expect(pino?.longe).toBe(true)
    expect(pino?.description).toBe('')
    expect(pino !== undefined && 'nome' in pino).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Faca')
  })

  it('nome em branco não atravessa', () => {
    const view = filterMapForPlayer(mapaCom([{ ...FACA, nome: '   ' }]), 'diego', POSSE, RAIO)
    expect('nome' in view.map.pins[0]).toBe(false)
  })

  it('controle: o mapa do mestre continua com o nome (o recorte é cópia)', () => {
    const mapa = mapaCom([FACA])
    filterMapForPlayer(mapa, 'diego', POSSE, RAIO)
    expect(mapa.pins[0].nome).toBe('Faca')
  })
})

describe('fogFilter: transição especial do pino de viagem', () => {
  it('o pino de viagem leva a transição; outro tipo de pino não', () => {
    const viagem: Pin = { id: 'porta', x: 240, y: 200, kind: 'viagem', description: '', image: null, transicao: { id: 'porta', duracaoS: 5 } }
    const nota = { ...FACA, transicao: { id: 'porta' } } as Pin
    const view = filterMapForPlayer(mapaCom([viagem, nota]), 'diego', POSSE, RAIO)
    expect(view.map.pins.find((p) => p.id === 'porta')?.transicao).toEqual({ id: 'porta', duracaoS: 5 })
    expect(view.map.pins.find((p) => p.id === 'pino-7')?.transicao).toBeUndefined()
  })

  it('transição do pacote (id que o app do mestre talvez nem tenha) chega ao jogador; id fora da forma não', () => {
    const doPacote: Pin = { id: 'porta', x: 240, y: 200, kind: 'viagem', description: '', image: null, transicao: { id: 'tunel-de-pedra' } }
    const torto: Pin = { id: 'torto', x: 240, y: 220, kind: 'viagem', description: '', image: null, transicao: { id: 'Tunel de pedra' } }
    const view = filterMapForPlayer(mapaCom([doPacote, torto]), 'diego', POSSE, RAIO)
    expect(view.map.pins.find((p) => p.id === 'porta')?.transicao).toEqual({ id: 'tunel-de-pedra' })
    expect(view.map.pins.find((p) => p.id === 'torto')?.transicao).toBeUndefined()
  })
})

describe('fogFilter: transição especial da escada', () => {
  it('a escada que leva a outro piso chega ao jogador com a transição', () => {
    const escada = { id: 'escada', shape: 'straight', direction: 'up', segments: [{ x1: 220, y1: 180, x2: 220, y2: 240 }], stepWidth: 40, levaAoPiso: 1, transicao: { id: 'escada-pedra' } } as MapData['stairs'][number]
    const view = filterMapForPlayer({ ...mapaCom([]), stairs: [escada] }, 'diego', POSSE, RAIO)
    expect(view.map.stairs.find((s) => s.id === 'escada')?.transicao).toEqual({ id: 'escada-pedra' })
  })
})

describe('fogFilter: animação do cenário do pino "!"', () => {
  const CENARIO = { quando: 'primeira', movimento: 'sobe', nevoa: true, raios: false, particulas: true, som: false } as const
  const IMAGEM = 'data:image/png;base64,AAAA'

  it('o "!" com imagem leva a animação; sem imagem ou de outro tipo, não', () => {
    const comImagem: Pin = { id: 'forte', x: 240, y: 200, kind: 'exclamacao', description: 'Forte', image: IMAGEM, cenario: CENARIO }
    const semImagem: Pin = { id: 'vazio', x: 250, y: 200, kind: 'exclamacao', description: 'Nada', image: null, cenario: CENARIO }
    const outro = { ...FACA, image: IMAGEM, cenario: CENARIO } as Pin
    const view = filterMapForPlayer(mapaCom([comImagem, semImagem, outro]), 'diego', POSSE, RAIO)
    expect(view.map.pins.find((p) => p.id === 'forte')?.cenario).toEqual(CENARIO)
    expect(view.map.pins.find((p) => p.id === 'vazio')?.cenario).toBeUndefined()
    expect(view.map.pins.find((p) => p.id === 'pino-7')?.cenario).toBeUndefined()
  })

  it('o estilo do pacote vai junto ao jogador; id torto de arquivo editado à mão fica no host', () => {
    const comEstilo: Pin = { id: 'forte', x: 240, y: 200, kind: 'exclamacao', description: 'Forte', image: IMAGEM, cenario: { ...CENARIO, estilo: 'neve-caindo' } }
    const torto: Pin = { id: 'torto', x: 245, y: 200, kind: 'exclamacao', description: 'Torto', image: IMAGEM, cenario: { ...CENARIO, estilo: 'Neve <b>' } }
    const view = filterMapForPlayer(mapaCom([comEstilo, torto]), 'diego', POSSE, RAIO)
    expect(view.map.pins.find((p) => p.id === 'forte')?.cenario).toEqual({ ...CENARIO, estilo: 'neve-caindo' })
    const lidoTorto = view.map.pins.find((p) => p.id === 'torto')?.cenario
    expect(lidoTorto).toEqual(CENARIO)
    expect(lidoTorto).not.toHaveProperty('estilo')
  })
})
