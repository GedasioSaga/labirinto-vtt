import { describe, expect, it } from 'vitest'
import { tableScreenText } from './tableScreenText'

describe('tableScreenText (tela da mesa fora do mapa)', () => {
  it('espera diz onde o mestre escolhe a cena, sem nome de cena nenhum', () => {
    const t = tableScreenText({ status: 'waiting' }, 'AB12CD')
    expect(t.text).toContain('aba Jogo')
    expect(t.tone).toBe('info')
    expect(t.action).toBeNull()
  })

  it('conexão caída tenta de novo sozinha (TV não tem teclado) e oferece o botão', () => {
    const t = tableScreenText({ status: 'error', error: 'connection_lost' }, 'AB12CD')
    expect(t.retry).toBe(true)
    expect(t.action).toBe('reconnect')
  })

  it('código errado leva de volta ao código; telas demais explica', () => {
    expect(tableScreenText({ status: 'error', error: 'bad_code' }, 'AB12CD')).toMatchObject({ tone: 'error', action: 'change_code', retry: false })
    expect(tableScreenText({ status: 'error', error: 'table_full' }, 'AB12CD').text).toContain('telas')
  })

  it('link sem a chave da tela (ou de outra sala): manda abrir o link da aba Jogo, sem insistir nem pedir código', () => {
    const t = tableScreenText({ status: 'error', error: 'bad_table_key' }, 'AB12CD')
    expect(t).toMatchObject({ tone: 'error', action: null, retry: false })
    expect(t.text).toContain('aba Jogo')
    expect(t.text).not.toContain('bad_table_key')
  })

  it('sala encerrada não tenta de novo', () => {
    expect(tableScreenText({ status: 'closed' }, 'AB12CD')).toMatchObject({ retry: false, action: 'change_code' })
  })

  it('erro desconhecido não some calado', () => {
    expect(tableScreenText({ status: 'error' }, 'AB12CD').text).toContain('unknown')
  })
})
