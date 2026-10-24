// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { midiasDaMensagem } from './liberacaoDosSons'

/** O que cada mensagem libera para a conexão que a recebe (contrato da F5, seção 2). */

const GRITO = `${'a'.repeat(64)}.mp3`
const CHUVA = `${'b'.repeat(64)}.ogg`

describe('midiasDaMensagem', () => {
  it('som.tocar libera a fonte', () => {
    expect(midiasDaMensagem({ type: 'som.tocar', instancia: 'som-1', fonte: { tipo: 'arquivo', midia: GRITO }, volume: 0.5, loop: false })).toEqual([GRITO])
  })

  it('som.precarregar libera os ids da pré-carga (repetido conta uma vez)', () => {
    expect(midiasDaMensagem({ type: 'som.precarregar', midias: [GRITO, CHUVA, GRITO] })).toEqual([GRITO, CHUVA])
  })

  it('parar, parar tudo, volume, outras mensagens e o envelope comprimido não liberam nada', () => {
    for (const carga of [
      { type: 'som.parar', instancia: 'som-1' },
      { type: 'som.pararTudo' },
      { type: 'som.volume', instancia: 'som-1', volume: 0.2 },
      { type: 'snapshot', rev: 1 },
      { gz: 'H4sIAAAAAAAA' },
      {},
    ]) {
      expect(midiasDaMensagem(carga)).toEqual([])
    }
  })

  it('id torto ou forma errada não vira liberação', () => {
    expect(midiasDaMensagem({ type: 'som.tocar', instancia: 'som-1', fonte: { tipo: 'arquivo', midia: '../adventure.json' }, volume: 0.5, loop: false })).toEqual([])
    expect(midiasDaMensagem({ type: 'som.precarregar', midias: [GRITO, 'C:/x.mp3'] })).toEqual([])
    expect(midiasDaMensagem({ type: 'som.tocar', instancia: 'som-1', fonte: { tipo: 'arquivo', midia: GRITO }, volume: 7, loop: false })).toEqual([])
  })
})
