import { describe, expect, it } from 'vitest'
import type { Prop } from '../../types/map'
import { createEmptyMap, trocarFormaDaCova } from '../mapFactory'
import { criarMovel, mobiliaParaJogador, propMobiliaFromFile } from '../mobilia'
import { chaveDoMovel } from '../../pixi/rasterDosMoveis'
import { montarCena } from '../../texturas/meioTermo/moveis'

/**
 * As TRÊS VERSÕES da cova no estilo Atual (07/11/2026): Fresca (o padrão, sem
 * campo), Antiga e Com pedras, trocadas no painel e lidas pela imagem como a
 * `variante`.
 */
const GRADE = 50

describe('cova em três versões', () => {
  it('mapa salvo sem o campo abre na fresca; só a antiga e a com pedras gravam e atravessam', () => {
    const salva = criarMovel('cova', { x: 100, y: 100 }, GRADE, 'cova-1')
    expect(salva.mobiliaForma).toBeUndefined()
    // A cova de antes deste campo volta do disco idêntica (a mesma referência: nada a consertar).
    expect(propMobiliaFromFile(salva)).toBe(salva)
    // Valor torto, ou o da ponte, some na leitura; a antiga fica.
    const torta: Prop = { ...salva, mobiliaForma: 'corda' }
    expect(propMobiliaFromFile(torta).mobiliaForma).toBeUndefined()
    expect(propMobiliaFromFile({ ...salva, mobiliaForma: 'antiga' }).mobiliaForma).toBe('antiga')
    // A versão é da cova: no caixão some.
    const caixao = criarMovel('caixao', { x: 100, y: 100 }, GRADE, 'caixao-1')
    expect(propMobiliaFromFile({ ...caixao, mobiliaForma: 'pedras' }).mobiliaForma).toBeUndefined()
    // O jogador recebe a versão junto do tipo; a fresca não vira campo.
    expect(mobiliaParaJogador({ ...salva, mobiliaForma: 'pedras' }).mobiliaForma).toBe('pedras')
    expect('mobiliaForma' in mobiliaParaJogador(salva)).toBe(false)
  })

  it('trocar a versão muda o desenho no lugar, sem mexer no tamanho, e a fresca volta sem campo', () => {
    const cova = criarMovel('cova', { x: 200, y: 200 }, GRADE, 'cova-1')
    const esticada = { ...cova, height: cova.height * 1.5 }
    const mapa = { ...createEmptyMap('m-cemiterio', 'Cemitério', 1000, 1000, GRADE), props: [esticada] }
    // A mesma versão não é passo (a store não empilha passo vazio).
    expect(trocarFormaDaCova(mapa, 'cova-1', 'fresca')).toBe(mapa)

    const partesPorVersao: number[] = []
    for (const [versao, variante] of [['fresca', 0], ['antiga', 1], ['pedras', 2]] as const) {
      const trocado = trocarFormaDaCova(mapa, 'cova-1', versao).props[0]
      expect([trocado.x, trocado.y, trocado.width, trocado.height]).toEqual([esticada.x, esticada.y, esticada.width, esticada.height])
      expect(trocado.mobiliaForma).toBe(versao === 'fresca' ? undefined : versao)
      const chave = chaveDoMovel(trocado, 1, 1)
      expect(chave?.desenho.variante).toBe(variante)
      if (chave === null) throw new Error('a cova perdeu o desenho com textura')
      partesPorVersao.push(montarCena(chave.desenho).partes.length)
    }
    // Fresca: o monte e 6 torrões caídos; Antiga: a crosta, o miolo e 3 tufos; Com pedras: a terra e 11 pedras.
    expect(partesPorVersao).toEqual([7, 5, 12])

    // Voltar para a fresca apaga o campo (o mapa salvo fica igual ao de antes).
    const comPedras = trocarFormaDaCova(mapa, 'cova-1', 'pedras')
    expect('mobiliaForma' in trocarFormaDaCova(comPedras, 'cova-1', 'fresca').props[0]).toBe(false)
  })
})
