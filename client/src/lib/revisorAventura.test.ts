/**
 * REVISOR DA AVENTURA: as regras que acham o que vaza ao jogador, o que quebra
 * o jogo e o que ficou feio, e o conserto de cada uma, sobre as cenas na memória.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { PIN_HEAD_RADIUS } from './pins'
import { aplicarConserto, revisarAventura, rotuloDoConserto, type CenaParaRevisar, type ProblemaRevisao } from './revisorAventura'
import type { MapData, Pin, Region, Token } from '../types/map'

function mapa(id: string, extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap(id, id, 30, 20, 64), ...extra }
}

function pino(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 100, y: 100, kind: 'exclamacao', description: 'Um baú velho', image: null, ...extra }
}

function ficha(id: string, name: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 300, y: 300, size: 1, image: null, ...extra }
}

function sala(id: string, name: string, extra: Partial<Region> = {}, room: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id,
    points: [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 0, y: 100 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name, ...room },
    ...extra,
  }
}

function cena(id: string, name: string, map: MapData | null): CenaParaRevisar {
  return { id, name, map }
}

function regras(problemas: readonly ProblemaRevisao[]): string[] {
  return problemas.map((p) => p.regra)
}

describe('revisarAventura: o que vaza ao jogador', () => {
  it('pino público cujo texto começa com MESTRE: vaza; o conserto o torna oculto e a revisão seguinte fica limpa', () => {
    const m = mapa('salao', { pins: [pino('p1', { description: 'MESTRE: o baú é um mímico' }), pino('p2', { description: 'mestre : nota', secret: true })] })
    const { problemas } = revisarAventura([cena('s1', 'Salão', m)])
    expect(problemas).toHaveLength(1)
    const [vaza] = problemas
    expect(vaza.grupo).toBe('vaza')
    expect(vaza.regra).toBe('texto-do-mestre')
    expect(vaza.sceneId).toBe('s1')
    expect(vaza.ponto).toEqual({ x: 100, y: 100 })
    expect(vaza.conserto).toEqual({ tipo: 'ocultar-pino', pinId: 'p1' })
    if (vaza.conserto === null) throw new Error('sem conserto')
    expect(rotuloDoConserto(vaza.conserto)).toBe('Ocultar dos jogadores')

    const consertado = aplicarConserto(m, vaza.conserto)
    expect(consertado.pins.find((p) => p.id === 'p1')?.secret).toBe(true)
    expect(revisarAventura([cena('s1', 'Salão', consertado)]).problemas).toEqual([])
  })

  it('texto ao entrar da sala que começa com MESTRE: vai para a nota do mestre, sem apagar a nota que já havia', () => {
    const m = mapa('salao', { regions: [sala('r1', 'Cela', {}, { textoAoEntrar: 'MESTRE: o carcereiro é o traidor', notaDoMestre: 'Nota antiga' })] })
    const [vaza] = revisarAventura([cena('s1', 'Salão', m)]).problemas
    expect(vaza.regra).toBe('texto-do-mestre')
    expect(vaza.conserto).toEqual({ tipo: 'texto-para-nota', regionId: 'r1' })
    expect(vaza.ponto).toEqual({ x: 100, y: 50 })
    if (vaza.conserto === null) throw new Error('sem conserto')
    const room = aplicarConserto(m, vaza.conserto).regions[0].room
    expect(room?.textoAoEntrar).toBeUndefined()
    expect(room?.notaDoMestre).toBe('Nota antiga\n\nMESTRE: o carcereiro é o traidor')
  })

  it('ficha com parênteses no nome e sem nome para os jogadores vaza; o conserto mostra só o nome de fora dos parênteses', () => {
    const m = mapa('salao', {
      tokens: [ficha('t1', 'Irmão Bóia (traidor)'), ficha('t2', 'Capataz (espião)', { publicName: 'Capataz' }), ficha('t3', 'Vulto (dono)', { secret: true })],
    })
    const problemas = revisarAventura([cena('s1', 'Salão', m)]).problemas
    expect(regras(problemas)).toEqual(['nome-com-parenteses'])
    const conserto = problemas[0].conserto
    expect(conserto).toEqual({ tipo: 'nome-publico', tokenId: 't1', publicName: 'Irmão Bóia' })
    if (conserto === null) throw new Error('sem conserto')
    expect(rotuloDoConserto(conserto)).toBe('Jogadores leem "Irmão Bóia"')
    expect(aplicarConserto(m, conserto).tokens[0].publicName).toBe('Irmão Bóia')
  })

  it('pino, sala ou ficha que cita o nome de OUTRA cena vaza; o nome da própria cena e o item oculto não contam', () => {
    const salao = mapa('salao', {
      pins: [pino('p1', { description: 'A escada desce para a Cripta Velha.' }), pino('p2', { description: 'Aqui é o Salão Nobre' }), pino('p3', { description: 'cripta velha', secret: true })],
      regions: [sala('r1', 'Antessala da cripta velha')],
    })
    const cripta = mapa('cripta')
    const problemas = revisarAventura([cena('s1', 'Salão Nobre', salao), cena('s2', 'Cripta Velha', cripta)]).problemas
    const citacoes = problemas.filter((p) => p.regra === 'cita-outra-cena')
    expect(citacoes.map((p) => p.itemId)).toEqual(['p1', 'r1'])
    expect(citacoes[0].texto).toContain('Cripta Velha')
    expect(citacoes[0].conserto).toBeNull()
  })
})

describe('revisarAventura: o que quebra o jogo', () => {
  it('pino de viagem cujo par não aponta de volta é "sem par" com conserto de desligar; depois do conserto vira "sem destino"', () => {
    const a = mapa('a', { pins: [pino('va', { kind: 'viagem', description: 'Alçapão', destino: { sceneId: 's2', pinId: 'vb' } })] })
    const b = mapa('b', { pins: [pino('vb', { kind: 'viagem', description: 'Saída', destino: { sceneId: 's3', pinId: 'x' } })] })
    const cenas = [cena('s1', 'Vale', a), cena('s2', 'Poço', b)]
    const semPar = revisarAventura(cenas).problemas.filter((p) => p.itemId === 'va')
    expect(regras(semPar)).toEqual(['viagem-sem-par'])
    expect(semPar[0].grupo).toBe('quebra')
    expect(semPar[0].conserto).toEqual({ tipo: 'desligar-saida', pinId: 'va', exitId: 'principal' })
    if (semPar[0].conserto === null) throw new Error('sem conserto')

    const desligado = aplicarConserto(a, semPar[0].conserto)
    expect(desligado.pins[0].destino).toBeNull()
    const depois = revisarAventura([cena('s1', 'Vale', desligado), cena('s2', 'Poço', b)]).problemas.filter((p) => p.itemId === 'va')
    expect(regras(depois)).toEqual(['viagem-sem-destino'])
    expect(depois[0].conserto).toBeNull()
  })

  it('par ligado nos dois lados não é problema', () => {
    const a = mapa('a', { pins: [pino('va', { kind: 'viagem', description: 'Alçapão', destino: { sceneId: 's2', pinId: 'vb' } })] })
    const b = mapa('b', { pins: [pino('vb', { kind: 'viagem', description: 'Escada', destino: { sceneId: 's1', pinId: 'va' } })] })
    expect(revisarAventura([cena('s1', 'Vale', a), cena('s2', 'Poço', b)]).problemas).toEqual([])
  })

  it('a mesma ficha (mesmo id) em duas cenas quebra: a segunda aparição é apontada', () => {
    const a = mapa('a', { tokens: [ficha('t1', 'Lia')] })
    const b = mapa('b', { tokens: [ficha('t1', 'Lia', { x: 50, y: 60 })] })
    const problemas = revisarAventura([cena('s1', 'Vale', a), cena('s2', 'Poço', b)]).problemas
    expect(regras(problemas)).toEqual(['ficha-repetida'])
    expect(problemas[0].sceneId).toBe('s2')
    expect(problemas[0].ponto).toEqual({ x: 50, y: 60 })
    expect(problemas[0].texto).toContain('Vale')
  })

  it('pino debaixo de outro não abre para o jogador; o conserto o afasta para um lugar livre', () => {
    const m = mapa('a', { pins: [pino('baixo', { x: 100, y: 100 }), pino('cima', { x: 104, y: 102 }), pino('longe', { x: 400, y: 400 })] })
    const problemas = revisarAventura([cena('s1', 'Vale', m)]).problemas
    expect(regras(problemas)).toEqual(['pino-sob-pino'])
    expect(problemas[0].itemId).toBe('baixo')
    const conserto = problemas[0].conserto
    if (conserto === null || conserto.tipo !== 'afastar-pino') throw new Error('sem conserto de afastar')
    const afastado = aplicarConserto(m, conserto)
    const novo = afastado.pins.find((p) => p.id === 'baixo')
    if (novo === undefined) throw new Error('o pino sumiu')
    for (const outro of afastado.pins.filter((p) => p.id !== 'baixo')) {
      expect(Math.hypot(novo.x - outro.x, novo.y - outro.y)).toBeGreaterThanOrEqual(2 * PIN_HEAD_RADIUS)
    }
    expect(revisarAventura([cena('s1', 'Vale', afastado)]).problemas).toEqual([])
  })
})

describe('revisarAventura: o que ficou feio e o que ficou de fora', () => {
  it('pino ! ou ? público sem texto nem imagem abre um cartão vazio', () => {
    const m = mapa('a', { pins: [pino('p1', { description: '  ' }), pino('p2', { description: '', secret: true, x: 500 }), pino('p3', { description: '', kind: 'viagem', x: 800, destino: null })] })
    const problemas = revisarAventura([cena('s1', 'Vale', m)]).problemas
    const feios = problemas.filter((p) => p.grupo === 'feio')
    expect(feios.map((p) => [p.regra, p.itemId])).toEqual([['pino-vazio', 'p1']])
  })

  it('cena que não abriu fica fora da revisão e é listada pelo nome', () => {
    const revisao = revisarAventura([cena('s1', 'Vale', mapa('a')), cena('s2', 'Torre', null)])
    expect(revisao.problemas).toEqual([])
    expect(revisao.cenasFora).toEqual(['Torre'])
  })

  it('os problemas saem na ordem dos grupos: vaza, quebra, feio', () => {
    const m = mapa('a', {
      pins: [pino('vazio', { description: '', x: 700 }), pino('va', { kind: 'viagem', description: 'Porta', x: 900 }), pino('m', { description: 'MESTRE: x', x: 50 })],
    })
    const grupos = revisarAventura([cena('s1', 'Vale', m)]).problemas.map((p) => p.grupo)
    expect(grupos).toEqual(['vaza', 'quebra', 'feio'])
  })
})
