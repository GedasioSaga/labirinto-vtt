import { describe, expect, it } from 'vitest'
import { deserializeMap, serializeMap } from './mapFile'
import { filterMapForPlayer } from './fogFilter'
import { emOrdemDeDesenho } from './mobilia'
import { IDS_DOS_EMBUTIDOS } from '../carimbos/embutidos'

/**
 * PEÇAS NOVAS do Meio-Termo, lote 2 (fatia MT5), no DISCO e na REDE: sebe,
 * jardineira, arco do portão, placa de seta e tapete longo. Antes da MT5 um
 * tipo fora do catálogo sumia na leitura do arquivo (o objeto ficava, sem o
 * tipo). Aqui cada tipo vai e volta do disco, chega ao jogador pelo recorte
 * (`filterMapForPlayer`, sem editar `fogFilter.ts`), a CURVA da sebe (o campo
 * da cerca, `mobiliaCurva`) atravessa os dois, o tapete longo fica no chão e a
 * árvore redonda (carimbo novo) atravessa o arquivo e o jogador.
 *
 * A lista é escrita à mão, de propósito: não sai do código que ela confere.
 */
const TIPOS_NOVOS = ['sebe', 'jardineira', 'arcoDoPortao', 'placaDeSeta', 'tapeteLongo'] as const

function arquivoCom(tipo: string, extra = ''): string {
  return JSON.stringify({ id: `mapa-${tipo}`, name: 'Vila', width: 20, height: 20, grid: 50, props: [] }).replace(
    '"props":[]',
    `"props":[{"id":"peca-${tipo}","src":"","x":250,"y":200,"width":100,"height":25,"linkedMapPath":null,"mobilia":"${tipo}"${extra}}]`,
  )
}

function paraOJogador(arquivo: string) {
  const mapa = deserializeMap(arquivo)
  const comFicha = { ...mapa, tokens: [{ id: 'ficha-ana', characterId: null, name: 'Ana', x: 300, y: 300, size: 1, image: null }] }
  return filterMapForPlayer(comFicha, 'ana', { ana: ['ficha-ana'] }, 900).map
}

describe('MT5: cada peça nova do lote 2 vai e volta do disco', () => {
  for (const tipo of TIPOS_NOVOS) {
    it(`${tipo}: o tipo e o material sobrevivem à leitura e à gravação`, () => {
      const lido = deserializeMap(arquivoCom(tipo, ',"mobiliaCor":"#8b6b47","mobiliaCorDaLinha":"#a3875f"'))
      expect(lido.props).toHaveLength(1)
      expect(lido.props[0].mobilia).toBe(tipo)
      expect(lido.props[0].mobiliaCor).toBe('#8b6b47')
      expect(lido.props[0].mobiliaCorDaLinha).toBe('#a3875f')
      const deNovo = deserializeMap(serializeMap(lido))
      expect(deNovo.props[0].mobilia).toBe(tipo)
      expect(deNovo.props[0].mobiliaCor).toBe('#8b6b47')
    })
  }

  it('a curva só fica na sebe (e na cerca): nas outras peças novas ela sai na leitura', () => {
    for (const tipo of TIPOS_NOVOS) {
      const lido = deserializeMap(serializeMap(deserializeMap(arquivoCom(tipo, ',"mobiliaCurva":90'))))
      expect(lido.props[0].mobiliaCurva, tipo).toBe(tipo === 'sebe' ? 90 : undefined)
    }
  })
})

describe('MT5: o recorte leva cada peça nova ao jogador', () => {
  for (const tipo of TIPOS_NOVOS) {
    it(`${tipo}: chega ao jogador com o tipo e o material`, () => {
      const out = paraOJogador(arquivoCom(tipo, ',"mobiliaCor":"#7e7b76"'))
      expect(out.props).toHaveLength(1)
      expect(out.props[0].mobilia).toBe(tipo)
      expect(out.props[0].mobiliaCor).toBe('#7e7b76')
      expect(out.props[0].id).toBe(`peca-${tipo}`)
    })
  }

  it('a curva da sebe chega ao jogador como o mestre a deixou (volta limitada a meia volta)', () => {
    expect(paraOJogador(arquivoCom('sebe', ',"mobiliaCurva":120')).props[0].mobiliaCurva).toBe(120)
    expect(paraOJogador(arquivoCom('sebe', ',"mobiliaCurva":-45')).props[0].mobiliaCurva).toBe(-45)
    expect(paraOJogador(arquivoCom('sebe')).props[0].mobiliaCurva).toBeUndefined()
  })
})

describe('MT5: o tapete longo mora no chão', () => {
  it('na ordem de desenho, o tapete longo vem antes de todo móvel, junto do tapete', () => {
    const props = [
      { id: 'mesa', mobilia: 'mesa' as const },
      { id: 'longo', mobilia: 'tapeteLongo' as const },
      { id: 'sebe', mobilia: 'sebe' as const },
      { id: 'tapete', mobilia: 'tapete' as const },
    ]
    expect(emOrdemDeDesenho(props).map((p) => p.id)).toEqual(['longo', 'tapete', 'mesa', 'sebe'])
  })
})

describe('MT5: a árvore redonda (carimbo novo) atravessa o arquivo e o jogador', () => {
  const comArvore = JSON.stringify({
    id: 'mapa-arvore',
    name: 'Vila',
    width: 20,
    height: 20,
    grid: 50,
    props: [],
    carimbos: [
      { id: 'c1', tipo: 'arvore-redonda', x: 300, y: 300, tamanho: 1, giro: 0 },
      { id: 'c2', tipo: 'arvore', x: 320, y: 300, tamanho: 1, giro: 0 },
    ],
  })

  it('o carimbo é da biblioteca embutida e a árvore antiga continua lá', () => {
    expect(IDS_DOS_EMBUTIDOS).toContain('arvore-redonda')
    expect(IDS_DOS_EMBUTIDOS).toContain('arvore')
  })

  it('vai e volta do disco e chega ao jogador com o tipo', () => {
    const lido = deserializeMap(serializeMap(deserializeMap(comArvore)))
    expect(lido.carimbos?.map((c) => c.tipo)).toEqual(['arvore-redonda', 'arvore'])
    const out = paraOJogador(comArvore)
    expect(out.carimbos?.map((c) => c.tipo)).toEqual(['arvore-redonda', 'arvore'])
  })
})
