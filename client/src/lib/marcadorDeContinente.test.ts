/**
 * MAPA DE CONTINENTE: quem vira pino, em que cor, e onde o clique do mestre o
 * acerta (a cabeça fica bem acima do ponto da ficha). Mais a ida e volta do
 * campo no arquivo e o "Tipo de mapa" na fábrica.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Region, Token } from '../types/map'
import { findTokenAt } from '../pixi/tokenInteraction'
import { AREA_DE_TOQUE } from '../pixi/drawMarcadorDeContinente'
import { selectEntitiesInArea } from './areaSelection'
import { createEmptyMap, setTipoDeMapa, setWorldMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import { camadaTravadaNoPiso } from './pisoEmEdicao'
import { findConcealZoneForSelect, findErasableAt } from './selectionHitTest'
import { resolveHoverHit } from './hoverHitTest'
import { areaDoPino, coresDosPinos, corDoPino, escalaDoMarcador, isContinente, tocaNoPino } from './marcadorDeContinente'
import { SIGNAL_NEUTRAL_COLOR, signalColor } from './signals'

const GRADE = 50

function ficha(id: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: 500, y: 500, size: 1, image: null, ...extra }
}

function cena(extra: Partial<MapData> = {}, tokens: Token[] = []): MapData {
  return { ...createEmptyMap('m1', 'Mundo', 30, 30, GRADE), tokens, ...extra }
}

describe('isContinente', () => {
  it('Continente marcado, ou mapa-mundi de antes do campo; o resto é Normal', () => {
    expect(isContinente({ continente: true })).toBe(true)
    expect(isContinente({ worldMap: true })).toBe(true)
    expect(isContinente({})).toBe(false)
  })
})

describe('corDoPino', () => {
  it('a "Cor" da ficha manda, em #rrggbb minúsculo', () => {
    expect(corDoPino({ color: '#35B24A' }, 'p1')).toBe('#35b24a')
  })

  it('sem cor escolhida (ou com lixo no campo), a cor automática do dono', () => {
    expect(corDoPino({}, 'p1')).toBe(signalColor('p1'))
    expect(corDoPino({ color: 'azul' }, 'p2')).toBe(signalColor('p2'))
  })

  it('sem poder dizer o dono (tela da mesa): a cor neutra da mesa', () => {
    expect(corDoPino({}, null)).toBe(SIGNAL_NEUTRAL_COLOR)
    expect(corDoPino({ color: '#d6452f' }, null)).toBe('#d6452f')
  })
})

describe('coresDosPinos', () => {
  const ana = ficha('ana')
  const bia = ficha('bia', { color: '#9a5fd0' })
  const npc = ficha('npc')
  const posse = { p1: ['ana'], p2: ['bia'] }

  it('cena Normal: ninguém é pino', () => {
    expect(coresDosPinos(cena({}, [ana, bia, npc]), posse).size).toBe(0)
  })

  it('Continente: só a ficha que tem dono na sala vira pino; NPC continua ficha', () => {
    const cores = coresDosPinos(cena({ continente: true }, [ana, bia, npc]), posse)
    expect([...cores.keys()].sort()).toEqual(['ana', 'bia'])
    expect(cores.get('ana')).toBe(signalColor('p1'))
    expect(cores.get('bia')).toBe('#9a5fd0')
    expect(cores.has('npc')).toBe(false)
  })

  it('sala vazia (sem posse nenhuma): ninguém é pino', () => {
    expect(coresDosPinos(cena({ continente: true }, [ana]), {}).size).toBe(0)
  })

  it('`corDoDono: false` troca a cor automática pela neutra; a cor escolhida fica', () => {
    const cores = coresDosPinos(cena({ continente: true }, [ana, bia]), posse, { corDoDono: false })
    expect(cores.get('ana')).toBe(SIGNAL_NEUTRAL_COLOR)
    expect(cores.get('bia')).toBe('#9a5fd0')
  })
})

describe('tamanho fixo na tela e área de toque', () => {
  it('a escala é o inverso do zoom; zoom inválido não estoura', () => {
    expect(escalaDoMarcador(0.5)).toBe(2)
    expect(escalaDoMarcador(2)).toBe(0.5)
    expect(escalaDoMarcador(0)).toBe(1)
    expect(escalaDoMarcador(Number.NaN)).toBe(1)
  })

  it('a área em px de mundo encolhe com o zoom: na tela é sempre a mesma', () => {
    const t = { x: 100, y: 100 }
    for (const zoom of [0.5, 1, 2]) {
      const a = areaDoPino(t, zoom)
      expect((a.maxX - a.minX) * zoom).toBeCloseTo(AREA_DE_TOQUE.largura)
      expect((a.maxY - a.minY) * zoom).toBeCloseTo(AREA_DE_TOQUE.altura)
    }
  })

  it('a cabeça do pino (40 px de tela acima do ponto) responde; o lado vazio, não', () => {
    const t = { x: 100, y: 100 }
    expect(tocaNoPino(t, { x: 100, y: 100 - 40 / 0.5 }, 0.5)).toBe(true)
    expect(tocaNoPino(t, { x: 100, y: 100 - 40 / 2 }, 2)).toBe(true)
    expect(tocaNoPino(t, { x: 100 + 40 / 2, y: 100 }, 2)).toBe(false)
  })

  it('findTokenAt: a ficha que é pino responde pela cabeça; o NPC continua só no disco', () => {
    const ana = ficha('ana', { x: 500, y: 500 })
    const npc = ficha('npc', { x: 800, y: 500 })
    const pinos = { ids: new Set(['ana']), cameraScale: 1 }
    // 40 px acima: fora do disco de 25 px, dentro do pino.
    expect(findTokenAt([ana, npc], { x: 500, y: 460 }, GRADE)).toBeNull()
    expect(findTokenAt([ana, npc], { x: 500, y: 460 }, GRADE, pinos)?.id).toBe('ana')
    expect(findTokenAt([ana, npc], { x: 800, y: 460 }, GRADE, pinos)).toBeNull()
    expect(findTokenAt([ana, npc], { x: 800, y: 500 }, GRADE, pinos)?.id).toBe('npc')
  })

  it('laço do mestre: o retângulo que só cruza a cabeça do pino (da direita para a esquerda) seleciona a ficha', () => {
    const map = cena({ continente: true }, [ficha('ana', { x: 500, y: 500 })])
    const soCabeca = { x1: 510, y1: 450, x2: 490, y2: 470 }
    expect(selectEntitiesInArea(map, soCabeca).tokens).toEqual([])
    expect(selectEntitiesInArea(map, soCabeca, { ids: new Set(['ana']), cameraScale: 1 }).tokens).toEqual(['ana'])
  })

  // Sala e zona oculta cobrindo a ficha: o que fica embaixo da cabeça do pino.
  const quadrado = [{ x: 300, y: 300 }, { x: 700, y: 300 }, { x: 700, y: 700 }, { x: 300, y: 700 }]
  const sala: Region = { id: 'sala', points: quadrado, tag: '', fillColor: '#3a7ad0', fillPattern: 'solid', data: {} }
  const cabeca = { x: 500, y: 460 }

  it('camada Fichas travada: a cabeça do pino barra o gesto (e a sala de baixo não é pega); o disco vazio ao lado em zoom 200%, não', () => {
    const map = cena({ continente: true, regions: [sala], lockedLayers: ['tokens'] }, [ficha('ana', { x: 500, y: 500 })])
    expect(camadaTravadaNoPiso(map, 0, cabeca)).toBeNull()
    expect(camadaTravadaNoPiso(map, 0, cabeca, { ids: new Set(['ana']), cameraScale: 1 })).toBe('tokens')
    // Zoom 200%: o pino encolhe no mundo; 22 px ao lado do ponto ainda é disco (raio 25), mas não é pino.
    const aoLado = { x: 522, y: 500 }
    expect(camadaTravadaNoPiso(map, 0, aoLado)).toBe('tokens')
    expect(camadaTravadaNoPiso(map, 0, aoLado, { ids: new Set(['ana']), cameraScale: 2 })).toBeNull()
  })

  it('hover e borracha: a cabeça do pino (40 px acima) acerta a ficha, sobre a sala de baixo', () => {
    const map = cena({ continente: true, regions: [sala] }, [ficha('ana', { x: 500, y: 500 })])
    const pinos = { ids: new Set(['ana']), cameraScale: 1 }
    const hover = (comPinos: boolean) =>
      resolveHoverHit({ map, selection: null, areaSelection: null, activeTool: 'select', worldPoint: cabeca, cameraScale: 1, pinos: comPinos ? pinos : undefined }).target
    expect(hover(false)).toEqual({ kind: 'region', id: 'sala' })
    expect(hover(true)).toEqual({ kind: 'token', id: 'ana' })
    expect(findErasableAt(map, cabeca)?.kind).toBe('region')
    expect(findErasableAt(map, cabeca, pinos)).toMatchObject({ kind: 'token', id: 'ana' })
  })

  it('pino dentro de zona oculta: a cabeça pega a ficha, não a zona', () => {
    const zona: ConcealZone = { id: 'z', points: quadrado, name: 'Zona', revealed: false }
    const map = cena({ continente: true, regions: [sala], concealZones: [zona] }, [ficha('ana', { x: 500, y: 500 })])
    expect(findConcealZoneForSelect(map, cabeca)?.id).toBe('z')
    expect(findConcealZoneForSelect(map, cabeca, { ids: new Set(['ana']), cameraScale: 1 })).toBeNull()
  })
})

describe('arquivo e fábrica', () => {
  it('Continente vai e volta pelo arquivo; mapa Normal volta sem o campo', () => {
    expect(deserializeMap(serializeMap(cena({ continente: true }))).continente).toBe(true)
    expect('continente' in deserializeMap(serializeMap(cena()))).toBe(false)
  })

  it('mapa-mundi salvo antes do Continente abre Continente com a caravana ligada', () => {
    const antigo = deserializeMap(serializeMap(cena({ worldMap: true })))
    expect(antigo.continente).toBe(true)
    expect(antigo.worldMap).toBe(true)
  })

  it('a cor do pino é campo de fio: arquivo que a traga a perde', () => {
    const lido = deserializeMap(serializeMap(cena({ continente: true }, [ficha('ana', { pino: '#ffffff' })])))
    expect('pino' in lido.tokens[0]).toBe(false)
  })

  it('"Tipo de mapa": Continente põe o campo; Normal tira o Continente e a caravana; igual devolve o mesmo mapa', () => {
    const normal = cena()
    expect(setTipoDeMapa(normal, 'normal')).toBe(normal)
    const continente = setTipoDeMapa(normal, 'continente')
    expect(continente.continente).toBe(true)
    expect(setTipoDeMapa(continente, 'continente')).toBe(continente)
    const comCaravana = setWorldMap(continente, true)
    const volta = setTipoDeMapa(comCaravana, 'normal')
    expect('continente' in volta).toBe(false)
    expect('worldMap' in volta).toBe(false)
  })

  it('caravana só existe no Continente: ligar marca a cena como Continente; desligar tira só a caravana', () => {
    const ligada = setWorldMap(cena(), true)
    expect(ligada.continente).toBe(true)
    expect(ligada.worldMap).toBe(true)
    const desligada = setWorldMap(ligada, false)
    expect(desligada.continente).toBe(true)
    expect('worldMap' in desligada).toBe(false)
  })
})
