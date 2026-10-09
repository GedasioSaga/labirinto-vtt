/**
 * ITEM NO MAPA (entrega 5): o item solto do acervo como IMAGEM NO CHÃO (objeto)
 * ou PINO DE ITEM. Pegar leva os dados inteiros à mochila e empilha; largar
 * devolve com imagem e dados; o arquivo e o recorte do jogador só aceitam a
 * forma limpa (imagem por referência de mídia, nunca embutida); o pino "!" de
 * antes, só com o nome, continua igual.
 */
import { describe, expect, it } from 'vitest'
import type { CarriedItem, MapData, Pin, PinItem, Prop, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import {
  acharItemNoMapa,
  distanciaAoObjeto,
  dropItemChange,
  fichaAlcancaItem,
  itemDoAcervoNoMapa,
  itemNoChaoNoPonto,
  itemParaJogador,
  objetoDeItem,
  pegarItemChange,
  pinoDeItem,
  trocarFormaDoItem,
} from './itemNoMapa'
import { applyItemChange, ITEM_QUANTIDADE_MAX, readPinItem } from './items'
import { buildPin, createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { idsDaMidiaUsada } from './midiaDaPasta'

const GRADE = 50
const ID_DA_IMAGEM = `${'a'.repeat(64)}.webp`
const IMAGEM = `midia:${ID_DA_IMAGEM}`
const POCAO: PinItem = { nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 30, empilhavel: true, livre: true }

function ficha(extra: Partial<Token> = {}): Token {
  return { id: 'arco', characterId: null, name: 'Arco', x: 100, y: 100, size: 1, image: null, ...extra }
}

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'Porto', 20, 20, GRADE), ...extra }
}

describe('do acervo ao mapa', () => {
  it('nasce "Pega direto", uma unidade, com os dados do acervo', () => {
    const noMapa = itemDoAcervoNoMapa({ nome: '  Poção ', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura', categoria: 'Consumível', preco: 30, empilhavel: true, quantidade: 5 })
    expect(noMapa).toEqual({ nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura', categoria: 'Consumível', preco: 30, empilhavel: true, livre: true })
    expect(itemDoAcervoNoMapa({ nome: '   ' })).toBeNull()
  })

  it('o pino de item é "!" com o símbolo do saco; a imagem no chão é um objeto sem caminho de disco', () => {
    expect(pinoDeItem('p', { x: 10, y: 20 }, POCAO)).toEqual({ id: 'p', x: 10, y: 20, kind: 'exclamacao', icon: 'item', description: '', image: null, item: POCAO })
    expect(objetoDeItem('o', { x: 10, y: 20 }, 50, POCAO)).toEqual({ id: 'o', src: '', x: 10, y: 20, width: 50, height: 50, linkedMapPath: null, item: POCAO })
  })
})

describe('achar e tocar', () => {
  const chao = objetoDeItem('chao', { x: 300, y: 300 }, 100, POCAO)
  const comum: Prop = { id: 'mesa', src: 'C:/m/mesa.png', x: 500, y: 500, width: 80, height: 80, linkedMapPath: null }
  const antigo: Pin = { ...buildPin('chave', { x: 200, y: 200 }, 'exclamacao'), item: { nome: 'Chave' } }
  const viagem: Pin = { ...buildPin('porta', { x: 50, y: 50 }, 'viagem'), item: { nome: 'Truque' } }

  it('acha o pino de item e o item no chão pelo id; objeto comum e passagem não são itens', () => {
    const m = mapa({ props: [chao, comum], pins: [antigo, viagem] })
    expect(acharItemNoMapa(m, 'chao')).toMatchObject({ forma: 'chao', id: 'chao', item: POCAO })
    expect(acharItemNoMapa(m, 'chave')).toMatchObject({ forma: 'pino', item: { nome: 'Chave' } })
    expect(acharItemNoMapa(m, 'mesa')).toBeNull()
    expect(acharItemNoMapa(m, 'porta')).toBeNull()
    expect(acharItemNoMapa(m, 'inventado')).toBeNull()
  })

  it('o toque acha a imagem girada pelo retângulo dela, a de cima primeiro', () => {
    const espada = objetoDeItem('espada', { x: 300, y: 300 }, 0, POCAO)
    const comprida: Prop = { ...espada, width: 200, height: 20, rotation: 90 }
    // Girada 90°, ela vai de y=200 a y=400 em x=300.
    expect(distanciaAoObjeto(comprida, { x: 300, y: 395 })).toBe(0)
    expect(distanciaAoObjeto(comprida, { x: 395, y: 300 })).toBeCloseTo(85)
    const deCima = { ...chao, id: 'de-cima' }
    expect(itemNoChaoNoPonto([chao, deCima, comum], { x: 300, y: 300 }, 4)?.id).toBe('de-cima')
    expect(itemNoChaoNoPonto([comum], { x: 500, y: 500 }, 4)).toBeNull()
  })

  it('alcance: a ficha pega a espada comprida pela ponta, não do outro lado da sala', () => {
    const comprida: Prop = { ...objetoDeItem('espada', { x: 300, y: 300 }, 0, POCAO), width: 400, height: 20 }
    const alvo = acharItemNoMapa(mapa({ props: [comprida] }), 'espada')
    if (alvo === null) throw new Error('sem item')
    // A ponta direita está em x=500; a borda da ficha (raio 25) + 1 casa (50) alcança 75 px.
    expect(fichaAlcancaItem(ficha({ x: 560, y: 300 }), alvo, GRADE)).toBe(true)
    expect(fichaAlcancaItem(ficha({ x: 600, y: 300 }), alvo, GRADE)).toBe(false)
  })
})

describe('trocar a forma', () => {
  it('chão → pino no mesmo lugar, mesmo id, mesmo piso, oculto e travado; e volta', () => {
    const chao: Prop = { ...objetoDeItem('i', { x: 300, y: 300 }, 80, POCAO), piso: 1, secret: true, locked: true }
    const comoPino = trocarFormaDoItem(mapa({ props: [chao] }), 'i')
    expect(comoPino.props).toEqual([])
    expect(comoPino.pins).toEqual([{ ...pinoDeItem('i', { x: 300, y: 300 }, POCAO), piso: 1, secret: true, locked: true }])
    const deVolta = trocarFormaDoItem(comoPino, 'i')
    expect(deVolta.pins).toEqual([])
    expect(deVolta.props).toEqual([{ ...objetoDeItem('i', { x: 300, y: 300 }, GRADE, POCAO), piso: 1, secret: true, locked: true }])
  })

  it('pino sem imagem não vira imagem no chão: o mesmo mapa volta', () => {
    const m = mapa({ pins: [pinoDeItem('i', { x: 0, y: 0 }, { nome: 'Corda' })] })
    expect(trocarFormaDoItem(m, 'i')).toBe(m)
    expect(trocarFormaDoItem(m, 'nada')).toBe(m)
  })
})

describe('pegar: a mochila guarda tudo e empilha', () => {
  it('a imagem no chão vai inteira à mochila e sai do mapa', () => {
    const m = mapa({ props: [objetoDeItem('chao', { x: 120, y: 100 }, 50, { ...POCAO, quantidade: 3 })], tokens: [ficha()] })
    const alvo = acharItemNoMapa(m, 'chao')
    if (alvo === null) throw new Error('sem item')
    const change = pegarItemChange(ficha(), alvo, 'novo')
    expect(change?.removePropId).toBe('chao')
    const depois = applyItemChange(m, change ?? { mochilas: [] })
    expect(depois.props).toEqual([])
    const { livre: _livre, ...semModo } = POCAO
    expect(depois.tokens[0]?.mochila).toEqual([{ id: 'chao', ...semModo, quantidade: 3 }])
  })

  it('empilhável com o mesmo item do acervo soma na vaga que existe, até o teto', () => {
    const naMochila: CarriedItem = { id: 'v1', nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, quantidade: 2, empilhavel: true }
    const m = mapa({ pins: [pinoDeItem('p', { x: 120, y: 100 }, { ...POCAO, quantidade: 4 })] })
    const alvo = acharItemNoMapa(m, 'p')
    if (alvo === null) throw new Error('sem item')
    const change = pegarItemChange(ficha({ mochila: [naMochila] }), alvo, 'novo')
    expect(change?.removePinId).toBe('p')
    expect(change?.mochilas[0]?.mochila).toHaveLength(1)
    expect(change?.mochilas[0]?.mochila[0]).toMatchObject({ id: 'v1', quantidade: 6, descricao: 'Cura 50 HP.' })
    const cheia = pegarItemChange(ficha({ mochila: [{ ...naMochila, quantidade: ITEM_QUANTIDADE_MAX - 1 }] }), alvo, 'novo')
    expect(cheia?.mochilas[0]?.mochila[0]?.quantidade).toBe(ITEM_QUANTIDADE_MAX)
  })

  it('o pino "!" de antes, só com o nome, vira a vaga de sempre: id do pino e nome', () => {
    const antigo: Pin = { ...buildPin('chave', { x: 120, y: 100 }, 'exclamacao'), item: { nome: 'Chave do Escudo' } }
    const alvo = acharItemNoMapa(mapa({ pins: [antigo] }), 'chave')
    if (alvo === null) throw new Error('sem item')
    expect(pegarItemChange(ficha(), alvo, 'novo')).toEqual({ removePinId: 'chave', mochilas: [{ tokenId: 'arco', mochila: [{ id: 'chave', nome: 'Chave do Escudo' }] }] })
  })

  it('a mochila já tem uma vaga com o id do item: a vaga nova usa o id novo', () => {
    const alvo = acharItemNoMapa(mapa({ pins: [pinoDeItem('p', { x: 0, y: 0 }, { nome: 'Corda' })] }), 'p')
    if (alvo === null) throw new Error('sem item')
    const change = pegarItemChange(ficha({ mochila: [{ id: 'p', nome: 'Outra' }] }), alvo, 'novo')
    expect(change?.mochilas[0]?.mochila.map((item) => item.id)).toEqual(['p', 'novo'])
  })
})

describe('largar no chão: volta com imagem e dados', () => {
  const pocao: CarriedItem = { id: 'v1', nome: 'Poção', itemId: 'item_pocao', imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', preco: 30, quantidade: 3, empilhavel: true }

  it('com imagem: a IMAGEM NO CHÃO onde a ficha está, no piso dela, pedindo ao mestre', () => {
    const arco = ficha({ x: 140, y: 160, piso: 2, mochila: [pocao] })
    const m = mapa({ tokens: [arco] })
    const change = dropItemChange(m, arco, 'v1', 'novo')
    const { id: _id, ...dados } = pocao
    expect(change?.addProp).toEqual({ id: 'v1', src: '', x: 140, y: 160, width: GRADE, height: GRADE, linkedMapPath: null, piso: 2, item: dados })
    expect(change?.addPin).toBeUndefined()
    const depois = applyItemChange(m, change ?? { mochilas: [] })
    expect(depois.tokens[0]?.mochila).toBeUndefined()
    expect(acharItemNoMapa(depois, 'v1')?.item).toEqual(dados)
  })

  it('sem imagem: o PINO DE ITEM, com os dados que houver', () => {
    const corda: CarriedItem = { id: 'c', nome: 'Corda', descricao: '10 m' }
    const arco = ficha({ mochila: [corda] })
    const change = dropItemChange(mapa({ tokens: [arco] }), arco, 'c', 'novo')
    expect(change?.addPin).toEqual({ ...pinoDeItem('c', { x: 100, y: 100 }, { nome: 'Corda', descricao: '10 m' }) })
    expect(change?.addProp).toBeUndefined()
  })

  it('id já usado por pino ou objeto do mapa: usa o id novo, nunca sobrescreve', () => {
    const arco = ficha({ mochila: [pocao] })
    const ocupado = mapa({ props: [{ id: 'v1', src: 'x.png', x: 0, y: 0, width: 1, height: 1, linkedMapPath: null }], tokens: [arco] })
    expect(dropItemChange(ocupado, arco, 'v1', 'novo')?.addProp?.id).toBe('novo')
    expect(dropItemChange(ocupado, arco, 'nao-tem', 'novo')).toBeNull()
  })
})

describe('forma limpa: arquivo, mídia e recorte do jogador', () => {
  it('o arquivo lê o pino "!" de antes igual e só aceita a imagem por referência de mídia', () => {
    expect(readPinItem({ nome: 'Chave', livre: true })).toEqual({ nome: 'Chave', livre: true })
    expect(readPinItem({ nome: 'Chave', livre: 'sim' })).toEqual({ nome: 'Chave' })
    expect(readPinItem({ nome: 'Poção', imagem: 'data:image/png;base64,AAAA', quantidade: 0, preco: -1, itemId: '../x' })).toEqual({ nome: 'Poção' })
    expect(readPinItem({ nome: 'Poção', imagem: 'C:/Users/mestre/pocao.png' })).toEqual({ nome: 'Poção' })
    expect(readPinItem({ nome: 'Poção', quantidade: ITEM_QUANTIDADE_MAX + 1 })).toEqual({ nome: 'Poção' })
  })

  it('ida e volta do mapa guarda o item no chão; item torto no objeto sai e o objeto fica', () => {
    const chao = objetoDeItem('chao', { x: 100, y: 100 }, 50, POCAO)
    const lido = deserializeMap(serializeMap(mapa({ props: [chao] })))
    expect(lido.props).toEqual([chao])
    const cru: Record<string, unknown> = JSON.parse(serializeMap(mapa()))
    const torto = deserializeMap(JSON.stringify({ ...cru, props: [{ ...chao, item: { nome: 42, imagem: 'data:image/png;base64,AAAA' } }] }))
    expect(torto.props).toHaveLength(1)
    expect(torto.props[0]).not.toHaveProperty('item')
  })

  it('a imagem do item no chão e a do pino de item viajam com a pasta da aventura', () => {
    const outra = `${'b'.repeat(64)}.png`
    const m = mapa({ props: [objetoDeItem('chao', { x: 0, y: 0 }, 50, POCAO)], pins: [pinoDeItem('p', { x: 0, y: 0 }, { nome: 'Mapa', imagem: `midia:${outra}` })] })
    expect(idsDaMidiaUsada({ mapas: [m] })).toEqual([ID_DA_IMAGEM, outra].sort())
  })

  it('o jogador recebe só o que o cartão usa: sem id do acervo, preço nem "empilha"', () => {
    expect(itemParaJogador({ ...POCAO, quantidade: 3 })).toEqual({ nome: 'Poção', livre: true, imagem: IMAGEM, descricao: 'Cura 50 HP.', categoria: 'Consumível', quantidade: 3 })
  })

  it('recorte: o item no chão à vista chega com a imagem por referência; o oculto e o fora da visão não chegam', () => {
    const m = mapa({
      tokens: [ficha()],
      props: [
        objetoDeItem('perto', { x: 160, y: 100 }, 50, POCAO),
        { ...objetoDeItem('oculto', { x: 180, y: 100 }, 50, { nome: 'Segredo do mestre' }), secret: true },
        objetoDeItem('longe', { x: 900, y: 900 }, 50, { nome: 'Longe demais' }),
      ],
      pins: [pinoDeItem('pino', { x: 140, y: 140 }, POCAO)],
    })
    const recorte = filterMapForPlayer(m, 'duda', { duda: ['arco'] }, 300).map
    expect(recorte.props.map((p) => p.id)).toEqual(['perto'])
    expect(recorte.props[0]).toEqual({ id: 'perto', x: 160, y: 100, width: 50, height: 50, src: '', linkedMapPath: null, item: itemParaJogador(POCAO) })
    expect(recorte.pins.find((p) => p.id === 'pino')?.item).toEqual(itemParaJogador(POCAO))
    const pacote = JSON.stringify(recorte)
    expect(pacote).not.toContain('item_pocao')
    expect(pacote).not.toContain('Segredo do mestre')
    expect(pacote).not.toContain('data:image')
  })
})
