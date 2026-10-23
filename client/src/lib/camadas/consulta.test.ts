import { describe, expect, it } from 'vitest'
import type { CamadaDef, LayerId, MapData, Region, Token } from '../../types/map'
import { LAYER_IDS } from '../../types/map'
import {
  canInteractInLayer,
  drawingLayer,
  isLayerLocked,
  isLayerVisible,
  lightLayer,
  pinLayer,
  propLayer,
  regionLayer,
  stairLayer,
  tokenLayer,
  visibleDrawings,
  visibleLights,
  visiblePins,
  visibleProps,
  visibleRegions,
  visibleStairs,
  visibleTokens,
  visibleWalls,
  wallLayer,
} from '../layers'
import { caminho, enfeite, escada, ficha, luz, objeto, parede, pino, porta, rabisco, regiao, texto } from '../__fixtures__/itensDeCamada'
import type { Lockable } from '../itemTransform'
import { createEmptyMap } from '../mapFactory'
import { contextoDeCamadas } from './consulta'
import { CAMADAS_PADRAO } from './padrao'

const fichaTravada: Token = { ...ficha, id: 't2', locked: true }

/** Só a trava do item, para `canInteractInLayer` (desenho não tem `locked`). */
function tranca(item: object): Lockable {
  return 'locked' in item && typeof item.locked === 'boolean' ? { locked: item.locked } : {}
}

function mapa(campos: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'Matriz', 10, 10, 64), ...campos }
}

/** As 512 combinações das 9 camadas antigas, pelo bit de cada uma. */
function subconjunto(bits: number): LayerId[] {
  return LAYER_IDS.filter((_, i) => (bits & (1 << i)) !== 0)
}

describe('contextoDeCamadas: mapa de antes (sem versaoDasCamadas) concorda com as funções de hoje', () => {
  it('em toda combinação de hiddenLayers e lockedLayers, para todo tipo de objeto', () => {
    let conferidos = 0
    for (let bits = 0; bits < 512; bits++) {
      const hidden = subconjunto(bits)
      // Cadeado numa combinação diferente do olho, para os dois não andarem juntos.
      const locked = subconjunto((bits * 37 + 11) % 512)
      const ctx = contextoDeCamadas(mapa({ hiddenLayers: hidden, lockedLayers: locked }))
      const casos: [boolean, boolean, boolean, boolean, boolean, boolean][] = [
        conferir(ctx.camadaDe('parede', parede), visibleWalls([parede], hidden).length === 1, wallLayer(parede), parede, ctx.podeMexer('parede', parede)),
        conferir(ctx.camadaDe('parede', porta), visibleWalls([porta], hidden).length === 1, wallLayer(porta), porta, ctx.podeMexer('parede', porta)),
        conferir(ctx.camadaDe('regiao', regiao), visibleRegions([regiao], hidden).length === 1, regionLayer(regiao), regiao, ctx.podeMexer('regiao', regiao)),
        conferir(ctx.camadaDe('escada', escada), visibleStairs([escada], hidden).length === 1, stairLayer(escada), escada, ctx.podeMexer('escada', escada)),
        conferir(ctx.camadaDe('luz', luz), visibleLights([luz], hidden).length === 1, lightLayer(luz), luz, ctx.podeMexer('luz', luz)),
        conferir(ctx.camadaDe('ficha', ficha), visibleTokens([ficha], hidden).length === 1, tokenLayer(ficha), ficha, ctx.podeMexer('ficha', ficha)),
        conferir(ctx.camadaDe('ficha', fichaTravada), visibleTokens([fichaTravada], hidden).length === 1, tokenLayer(fichaTravada), fichaTravada, ctx.podeMexer('ficha', fichaTravada)),
        conferir(ctx.camadaDe('pino', pino), visiblePins([pino], hidden).length === 1, pinLayer(pino), pino, ctx.podeMexer('pino', pino)),
        conferir(ctx.camadaDe('objeto', objeto), visibleProps([objeto], hidden).length === 1, propLayer(objeto), objeto, ctx.podeMexer('objeto', objeto)),
        conferir(ctx.camadaDe('objeto', enfeite), visibleProps([enfeite], hidden).length === 1, propLayer(enfeite), enfeite, ctx.podeMexer('objeto', enfeite)),
        conferir(ctx.camadaDe('desenho', rabisco), visibleDrawings([rabisco], hidden).length === 1, drawingLayer(rabisco), rabisco, ctx.podeMexer('desenho', rabisco)),
        conferir(ctx.camadaDe('desenho', texto), visibleDrawings([texto], hidden).length === 1, drawingLayer(texto), texto, ctx.podeMexer('desenho', texto)),
        conferir(ctx.camadaDe('desenho', caminho), visibleDrawings([caminho], hidden).length === 1, drawingLayer(caminho), caminho, ctx.podeMexer('desenho', caminho)),
      ]
      for (const [mestre, antigoVisivel, jogador, travada, antigoTravado, podeMexerIgual] of casos) {
        expect(mestre).toBe(antigoVisivel)
        expect(jogador).toBe(antigoVisivel)
        expect(travada).toBe(antigoTravado)
        expect(podeMexerIgual).toBe(true)
        conferidos += 1
      }

      function conferir(
        camada: ReturnType<typeof ctx.camadaDe>,
        antigoVisivel: boolean,
        antiga: LayerId,
        item: object,
        podeMexer: boolean,
      ): [boolean, boolean, boolean, boolean, boolean, boolean] {
        expect(isLayerVisible(hidden, antiga)).toBe(antigoVisivel)
        return [
          ctx.mestreVe(camada),
          antigoVisivel,
          ctx.jogadorVe(camada),
          ctx.travada(camada),
          isLayerLocked(locked, antiga),
          podeMexer === canInteractInLayer(tranca(item), antiga, locked),
        ]
      }
    }
    expect(conferidos).toBe(512 * 13)
  })

  it("'salas' oculta (ou travada) de antes leva o chão junto; 'anotacoes' leva os desenhos", () => {
    const ctx = contextoDeCamadas(mapa({ hiddenLayers: ['salas', 'anotacoes'], lockedLayers: ['salas'] }))
    expect(ctx.mestreVe('chao')).toBe(false)
    expect(ctx.jogadorVe('chao')).toBe(false)
    expect(ctx.travada('chao')).toBe(true)
    expect(ctx.mestreVe('desenhos')).toBe(false)
    expect(ctx.travada('desenhos')).toBe(false)
    // Terreno e Telhados não existiam: mapa de antes os mostra sempre.
    expect(ctx.mestreVe('terreno')).toBe(true)
    expect(ctx.mestreVe('telhados')).toBe(true)
  })

  it('com versaoDasCamadas 2, chão e desenhos têm estado próprio', () => {
    const ctx = contextoDeCamadas(mapa({ hiddenLayers: ['salas', 'anotacoes'], lockedLayers: ['salas'], versaoDasCamadas: 2 }))
    expect(ctx.mestreVe('salas')).toBe(false)
    expect(ctx.mestreVe('chao')).toBe(true)
    expect(ctx.travada('chao')).toBe(false)
    expect(ctx.mestreVe('desenhos')).toBe(true)
  })
})

describe('contextoDeCamadas: campos novos', () => {
  it('ocultasDoJogador separa o olho dos jogadores do olho do mestre', () => {
    const ctx = contextoDeCamadas(mapa({ hiddenLayers: ['portas'], ocultasDoJogador: ['tokens', 'livre_16bcc5fe'] }))
    expect(ctx.mestreVe('tokens')).toBe(true)
    expect(ctx.jogadorVe('tokens')).toBe(false)
    expect(ctx.mestreVe('portas')).toBe(false)
    expect(ctx.jogadorVe('portas')).toBe(true)
    expect(ctx.jogadorVe('livre_16bcc5fe')).toBe(false)
  })

  it('opacidade ausente é 1; presente vale para a camada, presa entre 0 e 1', () => {
    expect(contextoDeCamadas(mapa()).alfa('tokens')).toBe(1)
    const ctx = contextoDeCamadas(mapa({ opacidadeDasCamadas: { tokens: 0.4, salas: 3, paredes: -1 } }))
    expect(ctx.alfa('tokens')).toBe(0.4)
    expect(ctx.alfa('salas')).toBe(1)
    expect(ctx.alfa('paredes')).toBe(0)
    expect(ctx.alfa('portas')).toBe(1)
  })

  it('camadaDe: escolha válida manda; camada livre que não existe no modelo cai na padrão do tipo', () => {
    const livre: CamadaDef = { id: 'livre_405a3564', nome: 'Armadilhas' }
    const modeloCamadas = { ordem: [...CAMADAS_PADRAO.map((id) => ({ id })), livre] }
    const ctx = contextoDeCamadas(mapa({ modeloCamadas }))
    expect(ctx.camadaDe('parede', { ...parede, camada: 'tokens' })).toBe('tokens')
    expect(ctx.camadaDe('parede', { ...parede, camada: 'livre_405a3564' })).toBe('livre_405a3564')
    expect(ctx.camadaDe('parede', { ...parede, camada: 'livre_f75c687b' })).toBe('paredes')
    expect(ctx.camadaDe('objeto', { ...enfeite, camada: 'livre_f75c687b' })).toBe('decoracao')
    const sala: Region = { ...regiao, room: { shape: 'rect', name: 'Casa', roof: true, camadaDoTelhado: 'livre_405a3564' } }
    expect(ctx.camadaDe('telhado', sala)).toBe('livre_405a3564')
    expect(ctx.camadaDe('telhado', regiao)).toBe('telhados')
    // Sem modelo no mapa vale o padrão: só as 13 existem.
    expect(contextoDeCamadas(mapa()).camadaDe('parede', { ...parede, camada: 'livre_405a3564' })).toBe('paredes')
  })

  it('podeMexer: item travado ou camada travada não mexe', () => {
    const ctx = contextoDeCamadas(mapa({ lockedLayers: ['tokens'] }))
    expect(ctx.podeMexer('ficha', ficha)).toBe(false)
    expect(ctx.podeMexer('ficha', { ...ficha, camada: 'iluminacao' })).toBe(true)
    expect(ctx.podeMexer('luz', { ...luz, locked: true })).toBe(false)
    expect(ctx.podeMexer('luz', luz)).toBe(true)
  })

  it('ordem: as 13 padrão sem modelo; o modelo do mapa quando houver', () => {
    expect(contextoDeCamadas(mapa()).ordem).toEqual(CAMADAS_PADRAO)
    const ctx = contextoDeCamadas(mapa({ modeloCamadas: { ordem: [{ id: 'tokens' }, { id: 'chao' }] } }))
    expect(ctx.ordem).toEqual(['tokens', 'chao'])
  })

  it('é memorizado pela referência do mapa', () => {
    const m = mapa()
    expect(contextoDeCamadas(m)).toBe(contextoDeCamadas(m))
    expect(contextoDeCamadas({ ...m })).not.toBe(contextoDeCamadas(m))
  })
})

describe('camada livre que o mapa não conhece, escondida dos jogadores: falha fechada', () => {
  // Ninguém copia ainda o modelo da aventura para o mapa: sem `modeloCamadas`, `camadaDe` cai na padrão do tipo.
  const casaNaLivre: Region = { ...regiao, id: 'casa', room: { shape: 'rect', name: 'Casa', roof: true, camadaDoTelhado: 'livre_16bcc5fe' } }

  it('sem modelo no mapa, item em livre escondida dos jogadores: o jogador não vê; o mestre vê como antes', () => {
    for (const versao of [2, undefined] as const) {
      const ctx = contextoDeCamadas(mapa({ ocultasDoJogador: ['livre_16bcc5fe'], versaoDasCamadas: versao }))
      expect(ctx.jogadorVeItem('objeto', { ...objeto, camada: 'livre_16bcc5fe' }), `versão ${versao}`).toBe(false)
      expect(ctx.jogadorVeItem('parede', { ...parede, camada: 'livre_16bcc5fe' }), `versão ${versao}`).toBe(false)
      expect(ctx.jogadorVeItem('ficha', { ...ficha, camada: 'livre_16bcc5fe' }), `versão ${versao}`).toBe(false)
      expect(ctx.jogadorVeItem('telhado', casaNaLivre), `versão ${versao}`).toBe(false)
      expect(ctx.mestreVe(ctx.camadaDe('objeto', { ...objeto, camada: 'livre_16bcc5fe' })), `versão ${versao}`).toBe(true)
    }
  })

  it('livre desconhecida que NÃO está escondida dos jogadores cai na padrão do tipo, como sempre', () => {
    const ctx = contextoDeCamadas(mapa({ ocultasDoJogador: ['livre_16bcc5fe'], versaoDasCamadas: 2 }))
    expect(ctx.camadaDe('objeto', { ...objeto, camada: 'livre_17bcc791' })).toBe('objetos')
    expect(ctx.jogadorVeItem('objeto', { ...objeto, camada: 'livre_17bcc791' })).toBe(true)
    const padraoOculta = contextoDeCamadas(mapa({ ocultasDoJogador: ['objetos'], versaoDasCamadas: 2 }))
    expect(padraoOculta.jogadorVeItem('objeto', { ...objeto, camada: 'livre_17bcc791' })).toBe(false)
  })

  it('com o modelo, jogadorVeItem é o olho da camada do item', () => {
    const ctx = contextoDeCamadas(mapa({ ocultasDoJogador: ['livre_16bcc5fe'], versaoDasCamadas: 2, modeloCamadas: { ordem: [{ id: 'objetos' }, { id: 'livre_16bcc5fe' }, { id: 'livre_17bcc791' }] } }))
    expect(ctx.jogadorVeItem('objeto', { ...objeto, camada: 'livre_16bcc5fe' })).toBe(false)
    expect(ctx.jogadorVeItem('objeto', { ...objeto, camada: 'livre_17bcc791' })).toBe(true)
    expect(ctx.jogadorVeItem('objeto', objeto)).toBe(true)
  })
})

describe('layers.ts aceita o mapa inteiro no lugar da lista', () => {
  it('com mapa de antes dá o mesmo que a lista hiddenLayers, e devolve a mesma referência sem nada oculto', () => {
    const walls = [parede, porta]
    const m = mapa({ walls, hiddenLayers: ['portas'] })
    expect(visibleWalls(walls, m)).toEqual(visibleWalls(walls, m.hiddenLayers))
    expect(visibleDrawings([rabisco, texto], mapa({ hiddenLayers: ['anotacoes'] }))).toEqual([])
    const limpo = mapa({ walls })
    expect(visibleWalls(walls, limpo)).toBe(walls)
  })

  it('com o mapa, a camada escolhida do item vale', () => {
    const m = mapa({ hiddenLayers: ['tokens'], versaoDasCamadas: 2 })
    expect(visibleWalls([{ ...parede, camada: 'tokens' }, porta], m).map((w) => w.id)).toEqual(['w2'])
  })
})
