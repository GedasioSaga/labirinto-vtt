import { describe, expect, it } from 'vitest'
import { lerArrasto, refDaEntrada, refsDoArrasto, temArrastoDeItem, TIPO_DO_ARRASTO } from './arrastoDeItem'

/** O pedaço do DataTransfer que o arrasto usa (o jsdom não tem o de verdade). */
function pacote(dados: Record<string, string>): DataTransfer {
  return { types: Object.keys(dados), getData: (tipo: string) => dados[tipo] ?? '' } as unknown as DataTransfer // as: dublê do DataTransfer só com o que se lê
}

describe('arrasto da linha do item para a camada (fatia 8)', () => {
  it('lê o pacote nosso e reconhece o tipo durante o arrasto', () => {
    const dados = pacote({ [TIPO_DO_ARRASTO]: JSON.stringify(refDaEntrada({ kind: 'door', id: 'w1' })) })
    expect(temArrastoDeItem(dados)).toBe(true)
    expect(lerArrasto(dados)).toEqual({ tipo: 'parede', id: 'w1' })
  })

  it('o que vem de fora é lido com desconfiança: torto não move nada', () => {
    expect(temArrastoDeItem(pacote({ 'text/plain': 'oi' }))).toBe(false)
    for (const bruto of ['', 'não é json', '{}', '{"tipo":"__proto__","id":"x"}', '{"tipo":"ficha","id":""}', '{"tipo":"ficha","id":7}', `{"tipo":"ficha","id":"${'x'.repeat(201)}"}`, '{"tipo":"camada","id":"x"}']) {
      expect(lerArrasto(pacote({ [TIPO_DO_ARRASTO]: bruto })), bruto.slice(0, 40)).toBeNull()
    }
  })

  it('item da seleção leva a seleção inteira; item de fora vai sozinho', () => {
    const selecao = [{ kind: 'token' as const, id: 'ana' }, { kind: 'wall' as const, id: 'w1' }]
    expect(refsDoArrasto({ tipo: 'ficha', id: 'ana' }, selecao, null)).toEqual([{ tipo: 'ficha', id: 'ana' }, { tipo: 'parede', id: 'w1' }])
    expect(refsDoArrasto({ tipo: 'ficha', id: 'bia' }, selecao, null)).toEqual([{ tipo: 'ficha', id: 'bia' }])
  })
})
