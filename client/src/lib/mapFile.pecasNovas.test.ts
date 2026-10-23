import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'

/**
 * PEÇAS NOVAS do Meio-Termo, lote 1 (fatia MT4), no DISCO e na REDE. Antes da
 * MT4 um tipo fora do catálogo sumia na leitura do arquivo (o objeto ficava,
 * sem o tipo). Aqui cada tipo novo vai e volta do disco e chega ao jogador
 * pelo recorte (`filterMapForPlayer`) como é, junto do material gravado nos
 * campos de cor que já existem.
 *
 * A lista é escrita à mão, de propósito: não sai do código que ela confere.
 * O mapa é montado em JSON, como um arquivo salvo.
 */
const TIPOS_NOVOS = ['mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca'] as const

function arquivoCom(tipo: string, extra = ''): string {
  return JSON.stringify({ id: `mapa-${tipo}`, name: 'Vila', width: 20, height: 20, grid: 50, props: [] }).replace(
    '"props":[]',
    `"props":[{"id":"peca-${tipo}","src":"","x":250,"y":200,"width":50,"height":50,"linkedMapPath":null,"mobilia":"${tipo}"${extra}}]`,
  )
}

describe('MT4: cada peça nova vai e volta do disco', () => {
  for (const tipo of TIPOS_NOVOS) {
    it(`${tipo}: o tipo sobrevive à leitura e à gravação`, () => {
      const lido = deserializeMap(arquivoCom(tipo, ',"mobiliaCor":"#8b6b47","mobiliaCorDaLinha":"#4c4e51"'))
      expect(lido.props).toHaveLength(1)
      expect(lido.props[0].mobilia).toBe(tipo)
      // O material mora nos campos de cor de sempre (hex oficial), sem campo novo no arquivo.
      expect(lido.props[0].mobiliaCor).toBe('#8b6b47')
      expect(lido.props[0].mobiliaCorDaLinha).toBe('#4c4e51')
      const deNovo = deserializeMap(serializeMap(lido))
      expect(deNovo.props[0].mobilia).toBe(tipo)
      expect(deNovo.props[0].mobiliaCor).toBe('#8b6b47')
    })
  }

  it('a vista de lado só fica na barraca e na carroça (as peças novas com vista)', () => {
    for (const tipo of TIPOS_NOVOS) {
      const lido = deserializeMap(serializeMap(deserializeMap(arquivoCom(tipo, ',"mobiliaVista":"lado"'))))
      expect(lido.props[0].mobiliaVista, tipo).toBe(tipo === 'barraca' || tipo === 'carroca' ? 'lado' : undefined)
    }
  })
})

describe('MT4: o recorte leva cada peça nova ao jogador', () => {
  for (const tipo of TIPOS_NOVOS) {
    it(`${tipo}: chega ao jogador com o tipo e o material`, () => {
      const mapa = deserializeMap(arquivoCom(tipo, ',"mobiliaCor":"#7e7b76"'))
      const comFicha = { ...mapa, tokens: [{ id: 'ficha-ana', characterId: null, name: 'Ana', x: 300, y: 300, size: 1, image: null }] }
      const { map: out } = filterMapForPlayer(comFicha, 'ana', { ana: ['ficha-ana'] }, 900)
      expect(out.props).toHaveLength(1)
      expect(out.props[0].mobilia).toBe(tipo)
      expect(out.props[0].mobiliaCor).toBe('#7e7b76')
      expect(out.props[0].id).toBe(`peca-${tipo}`)
    })
  }
})
