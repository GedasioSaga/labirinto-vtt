/**
 * INVENTÁRIO ESTILO RE com itens do acervo (`player/inventario.ts`): a pilha
 * conta inteira, o item do acervo junta pelo item (não pelo nome) e leva a
 * imagem e o texto dele ao visor.
 */
import { describe, expect, it } from 'vitest'
import { inventorySlots, slotDescription } from './inventario'

const IMAGEM = `midia:${'9'.repeat(64)}.webp`

describe('inventorySlots com itens do acervo', () => {
  it('a pilha soma, o mesmo item junta, homônimos de itens diferentes não', () => {
    const slots = inventorySlots({
      mochila: [
        { id: 'a', nome: 'Anel', itemId: 'item_anel_ouro', imagem: IMAGEM, quantidade: 2, descricao: 'De ouro.' },
        { id: 'b', nome: 'Anel', itemId: 'item_anel_ferro' },
        { id: 'c', nome: 'Anel', itemId: 'item_anel_ouro' },
        { id: 'd', nome: 'Chave' },
        { id: 'e', nome: 'Chave' },
      ],
    })
    expect(slots.map((slot) => [slot.key, slot.quantidade, slot.itemIds])).toEqual([
      ['acervo:item_anel_ouro', 3, ['a', 'c']],
      ['acervo:item_anel_ferro', 1, ['b']],
      ['item:Chave', 2, ['d', 'e']],
    ])
    expect(slots[0]?.imagem).toBe(IMAGEM)
    expect(slots[2]?.imagem).toBeUndefined()
  })

  it('o texto do acervo vai ao visor; o do pino continua vindo da memória da tela', () => {
    const [anel, chave] = inventorySlots({ mochila: [{ id: 'a', nome: 'Anel', itemId: 'item_anel', descricao: 'De ouro.' }, { id: 'd', nome: 'Chave' }] })
    const memoria = new Map([['d', 'Abre o porão.']])
    expect(anel === undefined ? null : slotDescription(anel, memoria)).toBe('De ouro.')
    expect(chave === undefined ? null : slotDescription(chave, memoria)).toBe('Abre o porão.')
  })
})
