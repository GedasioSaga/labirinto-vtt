/**
 * CORTE DA TORRE: os andares empilhados (um andar = uma cena de primeiro nível
 * da lista, com as de dentro dela), as fichas como pontos com a sala onde
 * estão, e os poços que os pinos de viagem abrem entre andares diferentes.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import type { MapData, Pin, Region, Token } from '../types/map'
import { corteDaTorre, jogadoresDoCorte, rotuloDoPonto, type CorteCena, type CorteJogador } from './corteDaTorre'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x, y, size: 1, image: null, ...extra }
}

function sala(id: string, nome: string, x0: number, y0: number, x1: number, y1: number): Region {
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
    room: { shape: 'rect', name: nome },
  }
}

function pinoDeViagem(id: string, descricao: string, sceneId: string, pinId: string): Pin {
  return { id, x: 10, y: 10, kind: 'viagem', description: descricao, image: null, destino: { sceneId, pinId } }
}

function mapa(id: string, partes: { tokens?: Token[]; regions?: Region[]; pins?: Pin[] } = {}): MapData {
  const base = createEmptyMap(id, id, 20, 16, 50)
  return { ...base, tokens: partes.tokens ?? [], regions: partes.regions ?? [], pins: partes.pins ?? [] }
}

const CENAS: CorteCena[] = [
  { id: 'terreo', name: 'Térreo', available: true, active: true },
  { id: 'cozinha', name: 'Cozinha', parentId: 'terreo', available: true, active: false },
  { id: 'andar1', name: 'Primeiro andar', available: true, active: false },
  { id: 'cume', name: 'Cume', available: true, active: false },
]

describe('corteDaTorre', () => {
  it('empilha um andar por cena de primeiro nível, o último da lista no alto, com as de dentro no mesmo andar', () => {
    const mapas = new Map([
      ['terreo', mapa('terreo')],
      ['cozinha', mapa('cozinha')],
      ['andar1', mapa('andar1')],
      ['cume', mapa('cume')],
    ])
    const corte = corteDaTorre(CENAS, mapas, [])
    expect(corte.andares.map((andar) => andar.nome)).toEqual(['Cume', 'Primeiro andar', 'Térreo'])
    expect(corte.andares.map((andar) => andar.numero)).toEqual([3, 2, 1])
    const terreo = corte.andares[2]
    expect(terreo.cenas.map((cena) => cena.nome)).toEqual(['Térreo', 'Cozinha'])
    expect(terreo.cenas[0].ativa).toBe(true)
  })

  it('ficha de jogador vira ponto na cor dele, com o nome do jogador e a sala onde está; a sem dono vira NPC cinza', () => {
    const mapas = new Map([
      [
        'andar1',
        mapa('andar1', {
          tokens: [ficha('t-ana', 100, 100, { color: '#3cff00' }), ficha('t-guarda', 400, 400, { name: 'Guarda', npc: true })],
          regions: [sala('r-bib', 'Biblioteca', 50, 50, 200, 200)],
        }),
      ],
      ['terreo', mapa('terreo')],
    ])
    const jogadores: CorteJogador[] = [{ playerId: 'p-ana', name: 'Ana', connected: true, tokenIds: ['t-ana'], sceneId: 'andar1', travelPending: true }]
    const corte = corteDaTorre(CENAS, mapas, jogadores)
    const andar1 = corte.andares.find((andar) => andar.id === 'andar1')
    const pontos = andar1?.cenas[0].pontos ?? []
    expect(pontos).toHaveLength(2)
    expect(pontos[0]).toMatchObject({ tipo: 'jogador', nome: 'Ana', cor: '#3cff00', sala: 'Biblioteca', sceneId: 'andar1', x: 100, y: 100, pedido: true, conectado: true })
    expect(pontos[1]).toMatchObject({ tipo: 'npc', nome: 'Guarda', cor: null, sala: null, pedido: false })
  })

  it('pinos de viagem ligados entre andares diferentes viram um poço com o nome do pino, do andar mais baixo ao mais alto', () => {
    const mapas = new Map([
      ['terreo', mapa('terreo', { pins: [pinoDeViagem('pa', 'Espinha', 'cume', 'pc'), pinoDeViagem('px', 'Porta da cozinha', 'cozinha', 'pk')] })],
      ['cume', mapa('cume', { pins: [pinoDeViagem('pc', 'Espinha', 'terreo', 'pa')] })],
      // Ligação de mão dupla, mas no MESMO andar (a cozinha é de dentro do térreo): não é poço.
      ['cozinha', mapa('cozinha', { pins: [pinoDeViagem('pk', 'Porta da cozinha', 'terreo', 'px')] })],
      ['andar1', mapa('andar1')],
    ])
    const corte = corteDaTorre(CENAS, mapas, [])
    expect(corte.pocos).toEqual([{ chave: 'espinha@1-3', nome: 'Espinha', de: 1, ate: 3 }])
  })

  it('mesmo nome em alturas separadas vira um poço por trecho; trechos que dividem um andar viram um poço só', () => {
    // Cinco andares, do 1 (a) ao 5 (e).
    const cenas: CorteCena[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), available: true, active: false }))
    const mapas = new Map([
      // 'Escada' 1-2 e outra 'Escada' 4-5: nada liga o andar 3.
      ['a', mapa('a', { pins: [pinoDeViagem('a-esc', 'Escada', 'b', 'b-esc'), pinoDeViagem('a-cor', 'Corda', 'b', 'b-cor')] })],
      // 'Corda' 1-2 e 2-3 dividem o andar 2: uma corda só, do 1 ao 3.
      ['b', mapa('b', { pins: [pinoDeViagem('b-esc', 'Escada', 'a', 'a-esc'), pinoDeViagem('b-cor', 'Corda', 'a', 'a-cor'), pinoDeViagem('b-cor2', 'corda', 'c', 'c-cor')] })],
      // A outra ponta da 'Corda' 2-3 (o nome muda só na caixa: é a mesma corda).
      ['c', mapa('c', { pins: [pinoDeViagem('c-cor', 'Corda', 'b', 'b-cor2')] })],
      ['d', mapa('d', { pins: [pinoDeViagem('d-esc', 'Escada', 'e', 'e-esc')] })],
      ['e', mapa('e', { pins: [pinoDeViagem('e-esc', 'Escada', 'd', 'd-esc')] })],
    ])
    const pocos = corteDaTorre(cenas, mapas, []).pocos
    expect(pocos.map(({ nome, de, ate }) => ({ nome, de, ate }))).toEqual([
      { nome: 'Corda', de: 1, ate: 3 },
      { nome: 'Escada', de: 1, ate: 2 },
      { nome: 'Escada', de: 4, ate: 5 },
    ])
    expect(new Set(pocos.map((poco) => poco.chave)).size).toBe(pocos.length)
  })

  it('trechos de mesmo nome em andares vizinhos que não dividem andar nenhum não viram um fio só', () => {
    const cenas: CorteCena[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), available: true, active: false }))
    const mapas = new Map([
      ['a', mapa('a', { pins: [pinoDeViagem('a1', 'Escada', 'b', 'b1')] })],
      ['b', mapa('b', { pins: [pinoDeViagem('b1', 'Escada', 'a', 'a1')] })],
      ['c', mapa('c', { pins: [pinoDeViagem('c1', 'Escada', 'd', 'd1')] })],
      ['d', mapa('d', { pins: [pinoDeViagem('d1', 'Escada', 'c', 'c1')] })],
    ])
    const pocos = corteDaTorre(cenas, mapas, []).pocos
    expect(pocos.map(({ de, ate }) => [de, ate])).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it('pinos de viagem sem descrição: cada ligação é um poço dela, nunca um fio do andar mais baixo ao mais alto', () => {
    const cenas: CorteCena[] = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase(), available: true, active: false }))
    const mapas = new Map([
      // Sem nome: 1-2 e 4-5 (buraco no 3), e 2-3 (divide o andar 2 com o 1-2, mas é outra passagem).
      ['a', mapa('a', { pins: [pinoDeViagem('a1', '', 'b', 'b1')] })],
      ['b', mapa('b', { pins: [pinoDeViagem('b1', '  ', 'a', 'a1'), pinoDeViagem('b2', '', 'c', 'c2')] })],
      ['c', mapa('c', { pins: [pinoDeViagem('c2', '', 'b', 'b2')] })],
      ['d', mapa('d', { pins: [pinoDeViagem('d1', '', 'e', 'e1')] })],
      ['e', mapa('e', { pins: [pinoDeViagem('e1', '', 'd', 'd1')] })],
    ])
    const pocos = corteDaTorre(cenas, mapas, []).pocos
    expect(pocos.map(({ nome, de, ate }) => ({ nome, de, ate }))).toEqual([
      { nome: 'Pino de viagem', de: 1, ate: 2 },
      { nome: 'Pino de viagem', de: 2, ate: 3 },
      { nome: 'Pino de viagem', de: 4, ate: 5 },
    ])
    expect(new Set(pocos.map((poco) => poco.chave)).size).toBe(3)
  })

  it('ligação com descrição num lado só vira um poço, com o nome do lado que tem descrição', () => {
    const mapas = new Map([
      ['terreo', mapa('terreo', { pins: [pinoDeViagem('pa', '', 'cume', 'pc')] })],
      ['cume', mapa('cume', { pins: [pinoDeViagem('pc', 'Alçapão', 'terreo', 'pa')] })],
      ['andar1', mapa('andar1')],
    ])
    expect(corteDaTorre(CENAS, mapas, []).pocos).toEqual([{ chave: 'alçapão@1-3', nome: 'Alçapão', de: 1, ate: 3 }])
  })

  it('meia ligação (o par não aponta de volta) não abre poço', () => {
    const mapas = new Map([
      ['terreo', mapa('terreo', { pins: [pinoDeViagem('pa', 'Eixo', 'andar1', 'pb')] })],
      ['andar1', mapa('andar1', { pins: [pinoDeViagem('pb', 'Eixo', 'cume', 'zz')] })],
      ['cume', mapa('cume')],
    ])
    expect(corteDaTorre(CENAS, mapas, []).pocos).toEqual([])
  })

  it('cena que não abriu fica no andar sem pontos; sem jogador nenhum só aparecem as fichas sem dono', () => {
    const cenas: CorteCena[] = [
      { id: 'a', name: 'A', available: false, active: false },
      { id: 'b', name: 'B', available: true, active: true },
    ]
    const mapas = new Map([['b', mapa('b', { tokens: [ficha('t1', 5, 5)] })]])
    const corte = corteDaTorre(cenas, mapas, [])
    const a = corte.andares.find((andar) => andar.id === 'a')
    expect(a?.cenas[0]).toMatchObject({ disponivel: false, pontos: [] })
    const b = corte.andares.find((andar) => andar.id === 'b')
    expect(b?.cenas[0].pontos.map((ponto) => ponto.tipo)).toEqual(['npc'])
    expect(b?.cenas[0].pontos[0].nome).toBe('t1')
  })

  it('da sala só entra quem está jogando; sem cena e sem pedido (campos ausentes) viram null e false', () => {
    const jogadores = jogadoresDoCorte([
      { clientId: 'c1', playerId: 'p1', name: 'Ana', status: 'playing', connected: true, tokenIds: ['t1'], visionRadius: 300 },
      { clientId: 'c2', playerId: 'p2', name: 'Bia', status: 'waiting', connected: true, tokenIds: [], visionRadius: 300 },
      { clientId: null, playerId: 'p3', name: 'Caio', status: 'playing', connected: false, tokenIds: ['t3'], visionRadius: 300, sceneId: 's', travelPending: true },
    ])
    expect(jogadores).toEqual([
      { playerId: 'p1', name: 'Ana', connected: true, tokenIds: ['t1'], sceneId: null, travelPending: false },
      { playerId: 'p3', name: 'Caio', connected: false, tokenIds: ['t3'], sceneId: 's', travelPending: true },
    ])
  })

  it('o rótulo do ponto diz quem, a sala e a cena, e avisa pedido e jogador fora', () => {
    const base = { chave: 'k', tokenId: 't', sceneId: 's', x: 0, y: 0, cor: '#ffffff', tipo: 'jogador' as const }
    expect(rotuloDoPonto({ ...base, nome: 'Ana', sala: 'Biblioteca', pedido: false, conectado: true }, 'Cume')).toBe('Ana, Biblioteca, Cume')
    expect(rotuloDoPonto({ ...base, nome: 'Bruno', sala: null, pedido: true, conectado: false }, 'Cume')).toBe('Bruno, fora de sala, Cume, pedido de passagem, fora')
  })
})
