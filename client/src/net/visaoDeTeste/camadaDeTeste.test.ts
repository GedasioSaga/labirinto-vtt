import { describe, expect, it } from 'vitest'
import { buildPin, createEmptyMap } from '../../lib/mapFactory'
import type { MapData, Pin, Token, Wall } from '../../types/map'
import type { HostScene, HostWorld } from '../hostSession'
import { criarCamadaDeTeste, fantasmaDaFicha, mapaDaCena, type CamadaDeTeste } from './camadaDeTeste'
import { criarEscritoresDeTeste, type EscritoresDeTeste } from './escritoresDeTeste'

/**
 * VISÃO DE JOGADOR — a camada de teste, sem ponte nem janela: as mudanças do
 * jogador de teste reaplicadas sobre o mundo vivo do editor, que muda por
 * baixo delas sem saber de nada.
 */

const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 125, y: 125, size: 1, image: null }
const SEVERA: Token = { id: 'severa', characterId: null, name: 'Severa', x: 225, y: 125, size: 1, image: null }
const PORTA: Wall = { id: 'porta', x1: 100, y1: 200, x2: 150, y2: 200, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal' } }
const CHAVE: Pin = { ...buildPin('pino-chave', { x: 150, y: 125 }, 'exclamacao'), item: { nome: 'Chave', livre: true } }

function salao(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m-salao', 'Salão', 10, 10, 50), tokens: [ANA, SEVERA], walls: [PORTA], pins: [CHAVE], ...extra }
}

function cripta(): MapData {
  return { ...createEmptyMap('m-cripta', 'Cripta', 10, 10, 50), tokens: [{ ...SEVERA, id: 'esqueleto', name: 'Esqueleto' }] }
}

function cena(sceneId: string, map: MapData): HostScene {
  return { sceneId, name: map.name, map }
}

/** O editor com o Salão aberto e a Cripta de fundo, ou o contrário. */
function mundo(salaoAberto: boolean, mapas: { salao: MapData; cripta: MapData }): HostWorld {
  const s = cena('s-salao', mapas.salao)
  const c = cena('s-cripta', mapas.cripta)
  return salaoAberto ? { open: s, background: [c] } : { open: c, background: [s] }
}

function fichaEm(map: MapData, tokenId: string): Token {
  const ficha = map.tokens.find((t) => t.id === tokenId)
  if (ficha === undefined) throw new Error(`${tokenId} sumiu do mapa`)
  return ficha
}

function portaAberta(map: MapData): boolean | undefined {
  return map.walls.find((w) => w.id === PORTA.id)?.door?.open
}

/** A camada com os escritores da ponte de teste por cima do mundo `base()`. */
function teste(base: () => HostWorld): { camada: CamadaDeTeste; escritores: EscritoresDeTeste } {
  const camada = criarCamadaDeTeste()
  return { camada, escritores: criarEscritoresDeTeste(camada, base) }
}

describe('camada de teste: as mudanças do teste por cima do mundo vivo', () => {
  it('reaplica sobre a base nova: o mestre moveu outra ficha e as duas mudanças aparecem', () => {
    let mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(true, mapas))
    escritores.applyMove(ANA.id, 175, 125)

    // O mestre arrasta a Severa no editor: a base é outra.
    mapas = { ...mapas, salao: { ...mapas.salao, tokens: [ANA, { ...SEVERA, x: 275 }] } }
    const visto = camada.aplicarNoMundo(mundo(true, mapas)).open.map

    expect(fichaEm(visto, ANA.id).x).toBe(175)
    expect(fichaEm(visto, SEVERA.id).x).toBe(275)
    // O mapa do mestre não ganhou o passo do teste.
    expect(fichaEm(mapas.salao, ANA.id).x).toBe(125)
  })

  it('mudança sobre ficha ou porta que o mestre apagou não faz nada: a cena volta como veio', () => {
    const mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(true, mapas))
    escritores.applyMove(ANA.id, 175, 125)
    escritores.applyDoor(PORTA.id, true)

    const semElas = salao({ tokens: [SEVERA], walls: [] })
    expect(camada.aplicarNoMapa(semElas)).toBe(semElas)
  })

  it('memo: a mesma base devolve o mesmo resultado, e o que o teste não tocou volta como veio', () => {
    const mapas = { salao: salao(), cripta: cripta() }
    const base = mundo(true, mapas)
    const { camada, escritores } = teste(() => base)

    // Sem nada no teste, o mundo é o mesmo objeto (o recorte da névoa guarda por referência).
    expect(camada.aplicarNoMundo(base)).toBe(base)

    escritores.applyMove(ANA.id, 175, 125)
    const primeiro = camada.aplicarNoMundo(base)
    const segundo = camada.aplicarNoMundo(base)
    expect(segundo.open.map).toBe(primeiro.open.map)
    expect(primeiro.open.map).not.toBe(mapas.salao)
    expect(primeiro.background[0]).toBe(base.background[0])

    // Mudança na Cripta não refaz o Salão: a versão é por cena.
    escritores.applyMove('esqueleto', 275, 125, 's-cripta')
    const terceiro = camada.aplicarNoMundo(base)
    expect(terceiro.open.map).toBe(primeiro.open.map)
    expect(terceiro.background[0]?.map).not.toBe(mapas.cripta)

    // Base nova (o mestre editou): o resultado é refeito sobre ela.
    const outraBase = { ...base, open: cena('s-salao', { ...mapas.salao, name: 'Salão Novo' }) }
    expect(camada.aplicarNoMundo(outraBase).open.map.name).toBe('Salão Novo')
  })

  it('a chave é o MapData.id: o mestre trocar a cena aberta não perde nem muda de lugar o que o teste fez', () => {
    let salaoAberto = true
    const mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(salaoAberto, mapas))
    // "Cena aberta" (sem `sceneId`) é o Salão AGORA.
    escritores.applyDoor(PORTA.id, true)

    salaoAberto = false
    const depois = camada.aplicarNoMundo(mundo(salaoAberto, mapas))
    const salaoNoTeste = depois.background.find((c) => c.sceneId === 's-salao')
    expect(salaoNoTeste === undefined ? undefined : portaAberta(salaoNoTeste.map)).toBe(true)
    // A Cripta, aberta agora, não recebeu a porta do Salão.
    expect(depois.open.map).toBe(mapas.cripta)

    // Com o Salão de fundo, a mudança nele chega pelo `sceneId` da cena.
    escritores.applyMove(ANA.id, 175, 125, 's-salao')
    const salaoDeNovo = camada.aplicarNoMundo(mundo(true, mapas)).open.map
    expect(fichaEm(salaoDeNovo, ANA.id).x).toBe(175)
    expect(portaAberta(salaoDeNovo)).toBe(true)
  })

  it('passos seguidos da mesma ficha na mesma cena viram uma entrada só', () => {
    const mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(true, mapas))
    escritores.applyMove(ANA.id, 175, 125)
    escritores.applyMove(ANA.id, 225, 175)
    escritores.applyMove(ANA.id, 275, 175)
    expect(camada.tamanho()).toBe(1)
    expect(fichaEm(camada.aplicarNoMapa(mapas.salao), ANA.id)).toMatchObject({ x: 275, y: 175 })

    // Outra ficha ou outra mudança no meio: a ordem importa, e as entradas ficam.
    escritores.applyMove(SEVERA.id, 325, 125)
    escritores.applyMove(ANA.id, 325, 175)
    escritores.applyDoor(PORTA.id, true)
    escritores.applyMove(ANA.id, 375, 175)
    expect(camada.tamanho()).toBe(5)

    // Passo de outra cena não se funde com o desta.
    escritores.applyMove('esqueleto', 275, 125, 's-cripta')
    escritores.applyMove('esqueleto', 325, 125, 's-cripta')
    expect(camada.tamanho()).toBe(6)
  })

  it('cena fora do mundo servido: a mudança não tem onde ficar e não entra', () => {
    const mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(true, mapas))
    expect(mapaDaCena(mundo(true, mapas), 's-sumiu')).toBeNull()
    escritores.applyMove(ANA.id, 175, 125, 's-sumiu')
    expect(camada.tamanho()).toBe(0)
  })

  it('caravana, item e marca do teste também ficam só na camada', () => {
    const mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(true, mapas))
    escritores.applyCaravanMoves([
      { tokenId: SEVERA.id, x: 175, y: 175 },
      { tokenId: 'esqueleto', x: 275, y: 175, sceneId: 's-cripta' },
    ])
    escritores.applyItems({ removePinId: CHAVE.id, mochilas: [{ tokenId: ANA.id, mochila: [{ id: CHAVE.id, nome: 'Chave' }] }] })
    escritores.applyMark({ marca: { id: 'bilhete-1', tipo: 'bilhete', x: 125, y: 175, texto: 'Volto já' }, playerName: 'Bia', sceneName: 'Salão' })

    const visto = camada.aplicarNoMundo(mundo(true, mapas))
    expect(fichaEm(visto.open.map, SEVERA.id)).toMatchObject({ x: 175, y: 175 })
    expect(visto.background[0]?.map.tokens[0]).toMatchObject({ id: 'esqueleto', x: 275, y: 175 })
    expect(visto.open.map.pins.map((p) => p.id)).not.toContain(CHAVE.id)
    expect(fichaEm(visto.open.map, ANA.id).mochila).toEqual([{ id: CHAVE.id, nome: 'Chave' }])
    expect(visto.open.map.marcas?.map((m) => m.id)).toEqual(['bilhete-1'])

    // "Apagar" acha a marca no mundo do TESTE (o mestre nunca a teve) e a tira de lá.
    expect(escritores.removeMark('bilhete-1')).toBe(true)
    expect(camada.aplicarNoMundo(mundo(true, mapas)).open.map.marcas ?? []).toEqual([])
    expect(escritores.removeMark('bilhete-1')).toBe(false)

    // Nada disto chegou aos mapas do mestre.
    expect(mapas).toEqual({ salao: salao(), cripta: cripta() })
  })

  it('limpar esquece tudo: o mundo volta a ser o de verdade', () => {
    const mapas = { salao: salao(), cripta: cripta() }
    const base = mundo(true, mapas)
    const { camada, escritores } = teste(() => base)
    escritores.applyMove(ANA.id, 175, 125)
    camada.limpar()
    expect(camada.tamanho()).toBe(0)
    expect(camada.aplicarNoMundo(base)).toBe(base)
  })
})

describe('fantasma da ficha de teste', () => {
  it('só existe enquanto o teste tirou a ficha do lugar de verdade', () => {
    let mapas = { salao: salao(), cripta: cripta() }
    const { camada, escritores } = teste(() => mundo(true, mapas))
    const fantasma = () => {
      const real = mundo(true, mapas)
      return fantasmaDaFicha(real, camada.aplicarNoMundo(real), ANA.id)
    }
    expect(fantasma()).toBeNull()

    escritores.applyMove(ANA.id, 175, 125)
    expect(fantasma()).toEqual({ tokenId: ANA.id, mapId: 'm-salao', x: 175, y: 125 })

    // O mestre leva a Ana de verdade ao mesmo ponto: ela não está mais fora do lugar.
    mapas = { ...mapas, salao: { ...mapas.salao, tokens: [{ ...ANA, x: 175 }, SEVERA] } }
    expect(fantasma()).toBeNull()

    // A porta do teste não é a ficha: sem fantasma enquanto a Ana está no lugar.
    escritores.applyDoor(PORTA.id, true)
    expect(fantasma()).toBeNull()

    // O mestre apaga a Ana: no teste ela também não existe mais.
    mapas = { ...mapas, salao: { ...mapas.salao, tokens: [SEVERA] } }
    expect(fantasma()).toBeNull()
  })
})
