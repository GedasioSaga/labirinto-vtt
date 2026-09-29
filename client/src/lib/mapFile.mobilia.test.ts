import { describe, expect, it } from 'vitest'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import type { Prop } from '../types/map'

/**
 * `Prop.mobilia` no disco: o tipo do móvel (catre, mesa, baú) vai e volta;
 * mapa salvo antes do campo abre igual e grava sem ele; tipo fora do catálogo
 * (arquivo editado à mão, versão futura) some e o objeto continua no mapa.
 */

const objeto = (extra: string): string => `{"id": "p", "src": "", "x": 1, "y": 2, "width": 40, "height": 80, "linkedMapPath": null${extra}}`

function comMovel(extra: Partial<Prop>) {
  const prop: Prop = { id: 'p', src: '', x: 1, y: 2, width: 40, height: 80, linkedMapPath: null, ...extra }
  return { ...createEmptyMap('map_m', 'M', 5, 5, 40), props: [prop] }
}

describe('mapFile: mobília desenhada', () => {
  it('o catre vai e volta do disco', () => {
    expect(deserializeMap(serializeMap(comMovel({ mobilia: 'catre' }))).props[0].mobilia).toBe('catre')
  })

  it('mapa antigo abre com o objeto, sem o campo, e grava sem ele', () => {
    const antigo = deserializeMap(`{"id": "antigo", "props": [${objeto('')}]}`)
    expect(antigo.props).toHaveLength(1)
    expect('mobilia' in antigo.props[0]).toBe(false)
    expect(serializeMap(antigo)).not.toContain('mobilia')
  })

  it('tipo fora do catálogo some, e o objeto fica no mapa', () => {
    for (const valor of ['"trono"', '1', 'null', '{}']) {
      const lido = deserializeMap(`{"id": "torto", "props": [${objeto(`, "mobilia": ${valor}`)}]}`)
      expect(lido.props, `mobilia: ${valor}`).toHaveLength(1)
      expect(lido.props[0].mobilia, `mobilia: ${valor}`).toBeUndefined()
      expect(serializeMap(lido), `mobilia: ${valor}`).not.toContain('mobilia')
    }
  })
})

describe('mapFile: preencher e cores do móvel', () => {
  it('cor, cor da linha e "Preencher" desligado vão e voltam do disco', () => {
    const salvo = serializeMap(comMovel({ mobilia: 'mesa', mobiliaPreenchido: false, mobiliaCor: '#8b4513', mobiliaCorDaLinha: '#c0392b' }))
    const [mesa] = deserializeMap(salvo).props
    expect(mesa.mobiliaPreenchido).toBe(false)
    expect(mesa.mobiliaCor).toBe('#8b4513')
    expect(mesa.mobiliaCorDaLinha).toBe('#c0392b')
  })

  it('móvel salvo antes das cores abre com a aparência de sempre, sem ganhar campo', () => {
    const [mesa] = deserializeMap(`{"id": "antigo", "props": [${objeto(', "mobilia": "mesa"')}]}`).props
    expect(mesa.mobilia).toBe('mesa')
    for (const campo of ['mobiliaPreenchido', 'mobiliaCor', 'mobiliaCorDaLinha']) expect(mesa, campo).not.toHaveProperty(campo)
  })

  it('cor inválida no arquivo vira ausente, e o móvel fica', () => {
    for (const valor of ['"vermelho"', '"#12345"', '"#1234567"', '"#ggg"', '"url(javascript:x)"', '12', 'null', '{}', '[]']) {
      const [mesa] = deserializeMap(`{"id": "torto", "props": [${objeto(`, "mobilia": "mesa", "mobiliaCor": ${valor}, "mobiliaCorDaLinha": ${valor}`)}]}`).props
      expect(mesa.mobilia, valor).toBe('mesa')
      expect(mesa, valor).not.toHaveProperty('mobiliaCor')
      expect(mesa, valor).not.toHaveProperty('mobiliaCorDaLinha')
    }
  })

  it('cor #rgb curta ou em maiúsculas abre normalizada em #rrggbb minúsculo', () => {
    const [mesa] = deserializeMap(`{"id": "m", "props": [${objeto(', "mobilia": "mesa", "mobiliaCor": "#A50", "mobiliaCorDaLinha": "#C0392B"')}]}`).props
    expect(mesa.mobiliaCor).toBe('#aa5500')
    expect(mesa.mobiliaCorDaLinha).toBe('#c0392b')
  })

  it('"Preencher" que não é o desligado vira ausente (preenchido, o padrão)', () => {
    // `true` é o próprio padrão: só o desligado ocupa lugar no arquivo.
    for (const valor of ['true', '"false"', '0', 'null', '"sim"']) {
      const [mesa] = deserializeMap(`{"id": "torto", "props": [${objeto(`, "mobilia": "mesa", "mobiliaPreenchido": ${valor}`)}]}`).props
      expect(mesa, valor).not.toHaveProperty('mobiliaPreenchido')
    }
  })

  it('objeto comum não guarda aparência de móvel: os campos somem junto com o tipo inválido', () => {
    const [objetoComum] = deserializeMap(
      `{"id": "torto", "props": [${objeto(', "mobilia": "trono", "mobiliaPreenchido": false, "mobiliaCor": "#8b4513", "mobiliaCorDaLinha": "#c0392b"')}]}`,
    ).props
    expect(objetoComum).not.toHaveProperty('mobilia')
    for (const campo of ['mobiliaPreenchido', 'mobiliaCor', 'mobiliaCorDaLinha']) expect(objetoComum, campo).not.toHaveProperty(campo)
  })
})

describe('mapFile: vista do móvel (frente ou lado)', () => {
  it('a cadeira de lado vai e volta do disco; de frente grava sem o campo', () => {
    const [cadeira] = deserializeMap(serializeMap(comMovel({ mobilia: 'cadeira', mobiliaVista: 'lado' }))).props
    expect(cadeira.mobiliaVista).toBe('lado')
    expect(serializeMap(comMovel({ mobilia: 'cadeira' }))).not.toContain('mobiliaVista')
  })

  it('vista inválida no arquivo vira ausente, e a cadeira fica', () => {
    for (const valor of ['"frente"', '"LADO"', '"diagonal"', '1', 'null', '{}', '[]']) {
      const [cadeira] = deserializeMap(`{"id": "torto", "props": [${objeto(`, "mobilia": "cadeira", "mobiliaVista": ${valor}`)}]}`).props
      expect(cadeira.mobilia, valor).toBe('cadeira')
      expect(cadeira, valor).not.toHaveProperty('mobiliaVista')
    }
  })

  it('vista num tipo que não aceita vista some; sem tipo válido, some junto', () => {
    for (const tipo of ['mesa', 'catre']) {
      const [movel] = deserializeMap(`{"id": "torto", "props": [${objeto(`, "mobilia": "${tipo}", "mobiliaVista": "lado"`)}]}`).props
      expect(movel.mobilia, tipo).toBe(tipo)
      expect(movel, tipo).not.toHaveProperty('mobiliaVista')
    }
    const [objetoComum] = deserializeMap(`{"id": "torto", "props": [${objeto(', "mobilia": "trono", "mobiliaVista": "lado"')}]}`).props
    expect(objetoComum).not.toHaveProperty('mobilia')
    expect(objetoComum).not.toHaveProperty('mobiliaVista')
  })
})
