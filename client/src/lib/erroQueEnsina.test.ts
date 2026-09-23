import { describe, expect, it } from 'vitest'
import { ErroQueEnsina, ensinaOQueFazer } from './erroQueEnsina'

describe('erroQueEnsina (fronteira entre aviso que ensina e aviso que só informa)', () => {
  it('erro marcado é reconhecido como aviso que pede uma ação', () => {
    expect(ensinaOQueFazer(new ErroQueEnsina('escolha uma imagem'))).toBe(true)
  })

  it('Error comum NÃO vira aviso que fica — senão toda falha empilharia na tela', () => {
    expect(ensinaOQueFazer(new Error('EACCES: permission denied'))).toBe(false)
  })

  it('o que nem é Error (string, null, objeto solto) também não ensina', () => {
    expect(ensinaOQueFazer('escolha uma imagem')).toBe(false)
    expect(ensinaOQueFazer(null)).toBe(false)
    expect(ensinaOQueFazer(undefined)).toBe(false)
    expect(ensinaOQueFazer({ message: 'escolha uma imagem' })).toBe(false)
  })

  it('continua sendo um Error de verdade: mensagem preservada e capturável por catch comum', () => {
    const erro = new ErroQueEnsina('este token ainda não tem foto')
    expect(erro).toBeInstanceOf(Error)
    expect(erro.message).toBe('este token ainda não tem foto')
    expect(erro.name).toBe('ErroQueEnsina')
  })
})
