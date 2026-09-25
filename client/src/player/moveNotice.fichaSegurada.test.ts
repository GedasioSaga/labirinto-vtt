// @vitest-environment node
/**
 * FICHA SEGURADA PELO MESTRE: o arrasto recusado com `locked` diz por que a
 * ficha não andou, em vez de só voltar calada (a jogadora achava que o app
 * tinha travado).
 */
import { describe, expect, it } from 'vitest'
import { latestActionNotice, moveNoticeText } from './moveNotice'

describe('recusa "locked" do movimento', () => {
  it('diz que o mestre segurou a ficha', () => {
    expect(moveNoticeText('locked')).toBe('O mestre segurou sua ficha')
  })

  it('é o aviso que sai no rodapé quando é o mais novo', () => {
    expect(latestActionNotice({ id: 1, reason: 'far' }, { id: 2, reason: 'locked' })).toEqual({ id: 2, text: 'O mestre segurou sua ficha' })
  })

  it('não se confunde com a porta trancada', () => {
    expect(latestActionNotice({ id: 3, reason: 'locked' }, undefined)).toEqual({ id: 3, text: 'Trancada' })
  })
})
