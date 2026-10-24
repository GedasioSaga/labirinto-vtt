import { describe, expect, it } from 'vitest'
import type { Drawing, Region } from '../../types/map'
import { carimbo, escada, ficha, linha, luz, marcador, objeto, parede, peca, pino, porta, regiao } from '../__fixtures__/itensDeCamada'
import { CAMADAS_PADRAO, MODELO_PADRAO, ROTULOS_DAS_CAMADAS, camadaEscolhidaDe, camadaPadraoDe, ehCamadaId, ehCamadaPadrao, indicePadrao } from './padrao'

/** Um desenho mínimo de cada `kind`, para conferir a tabela inteira. */
function desenho(kind: Drawing['kind']): Drawing {
  switch (kind) {
    case 'freehand':
      return { id: 'd', kind, points: [], color: '#000', width: 2 }
    case 'curve':
      return { id: 'd', kind, points: [], color: '#000', width: 2 }
    case 'path':
      return { id: 'd', kind, points: [], color: '#000', width: 2 }
    case 'line':
      return { id: 'd', kind, x1: 0, y1: 0, x2: 1, y2: 1, color: '#000', width: 2 }
    case 'circle':
      return { id: 'd', kind, cx: 0, cy: 0, radius: 4, color: '#000', width: 2, filled: false, fillAlpha: 0 }
    case 'text':
      return { id: 'd', kind, x: 0, y: 0, text: 'oi', color: '#000', fontSize: 12 }
    case 'rect':
      return { id: 'd', kind, x: 0, y: 0, w: 4, h: 4, color: '#000', width: 2, filled: false, fillAlpha: 0 }
    case 'ellipse':
      return { id: 'd', kind, cx: 0, cy: 0, rx: 4, ry: 2, color: '#000', width: 2, filled: false, fillAlpha: 0 }
    case 'polygon':
      return { id: 'd', kind, points: [], color: '#000', width: 2, filled: false, fillAlpha: 0 }
  }
}

describe('as 13 camadas padrão', () => {
  it('ficam de baixo para cima na ordem em que a tela já desenha hoje, com rótulo em PT-BR', () => {
    expect(CAMADAS_PADRAO).toEqual([
      'chao', 'salas', 'desenhos', 'terreno', 'paredes', 'portas', 'escadas',
      'objetos', 'decoracao', 'iluminacao', 'tokens', 'anotacoes', 'telhados',
    ])
    expect(CAMADAS_PADRAO.map((id) => ROTULOS_DAS_CAMADAS[id])).toEqual([
      'Chão', 'Salas', 'Desenhos', 'Terreno', 'Paredes', 'Portas', 'Escadas',
      'Objetos', 'Decoração', 'Iluminação', 'Tokens', 'Anotações', 'Telhados',
    ])
    expect(MODELO_PADRAO.ordem.map((c) => c.id)).toEqual(CAMADAS_PADRAO)
    expect(indicePadrao('chao')).toBe(0)
    expect(indicePadrao('telhados')).toBe(12)
    expect(indicePadrao('livre_2d356976')).toBe(-1)
  })

  it('reconhece id de camada: as 13 e livre_ com id curto; o resto não', () => {
    for (const id of CAMADAS_PADRAO) expect(ehCamadaId(id)).toBe(true)
    expect(ehCamadaId('livre_e644c9bd')).toBe(true)
    expect(ehCamadaId('livre_')).toBe(false)
    expect(ehCamadaId('livre_3e17fc4b espaço')).toBe(false)
    expect(ehCamadaId('grid')).toBe(false)
    expect(ehCamadaId(7)).toBe(false)
    expect(ehCamadaId(undefined)).toBe(false)
    expect(ehCamadaPadrao('salas')).toBe(true)
    expect(ehCamadaPadrao('livre_16bcc5fe')).toBe(false)
  })
})

describe('camada padrão de cada tipo (tabela do plano)', () => {
  it('cada tipo cai na camada da tabela', () => {
    expect(camadaPadraoDe('parede', parede)).toBe('paredes')
    expect(camadaPadraoDe('parede', porta)).toBe('portas')
    expect(camadaPadraoDe('regiao', regiao)).toBe('salas')
    expect(camadaPadraoDe('peca', peca)).toBe('chao')
    expect(camadaPadraoDe('linha', linha)).toBe('paredes')
    expect(camadaPadraoDe('marcador', marcador)).toBe('portas')
    expect(camadaPadraoDe('escada', escada)).toBe('escadas')
    expect(camadaPadraoDe('ficha', ficha)).toBe('tokens')
    expect(camadaPadraoDe('pino', pino)).toBe('anotacoes')
    expect(camadaPadraoDe('luz', luz)).toBe('iluminacao')
    expect(camadaPadraoDe('carimbo', carimbo)).toBe('terreno')
    expect(camadaPadraoDe('telhado', regiao)).toBe('telhados')
  })

  it('objeto: camada ?? layer ?? objetos (o padrão segue Prop.layer; a escolha vem de camada)', () => {
    expect(camadaPadraoDe('objeto', objeto)).toBe('objetos')
    expect(camadaPadraoDe('objeto', { ...objeto, layer: 'decoracao' })).toBe('decoracao')
    expect(camadaEscolhidaDe('objeto', { ...objeto, layer: 'decoracao' })).toBeUndefined()
    expect(camadaEscolhidaDe('objeto', { ...objeto, layer: 'decoracao', camada: 'livre_1fbcd429' })).toBe('livre_1fbcd429')
  })

  it('desenho: texto e caminho são Anotações; todo o resto é Desenhos', () => {
    const kinds: Drawing['kind'][] = ['freehand', 'line', 'circle', 'curve', 'text', 'rect', 'ellipse', 'polygon', 'path']
    expect(kinds.map((k) => [k, camadaPadraoDe('desenho', desenho(k))])).toEqual([
      ['freehand', 'desenhos'], ['line', 'desenhos'], ['circle', 'desenhos'], ['curve', 'desenhos'],
      ['text', 'anotacoes'], ['rect', 'desenhos'], ['ellipse', 'desenhos'], ['polygon', 'desenhos'], ['path', 'anotacoes'],
    ])
  })

  it('a camada escolhida do telhado mora em RoomMeta.camadaDoTelhado, não no campo da região', () => {
    const sala: Region = { ...regiao, camada: 'livre_0cbcb640', room: { shape: 'rect', name: 'Sala', roof: true, camadaDoTelhado: 'livre_12bcbfb2' } }
    expect(camadaEscolhidaDe('regiao', sala)).toBe('livre_0cbcb640')
    expect(camadaEscolhidaDe('telhado', sala)).toBe('livre_12bcbfb2')
    expect(camadaEscolhidaDe('telhado', regiao)).toBeUndefined()
  })
})
