import { describe, expect, it } from 'vitest'
import { DOOR_NOTICE_TEXT } from './doorNotice'

describe('doorNotice: a recusa da porta em uma linha', () => {
  it("do lado errado da porta de um lado: 'Não abre deste lado'", () => {
    expect(DOOR_NOTICE_TEXT.wrong_side).toBe('Não abre deste lado')
  })

  it('as recusas de antes continuam com o mesmo texto', () => {
    expect(DOOR_NOTICE_TEXT).toEqual({
      locked: 'Trancada',
      far: 'Chegue mais perto da porta',
      not_visible: 'Você não vê essa porta daqui',
      wrong_side: 'Não abre deste lado',
      // porta-nao-fecha-em-cima: fechar com alguém no vão.
      blocked: 'Tem alguém no vão da porta',
    })
  })
})
