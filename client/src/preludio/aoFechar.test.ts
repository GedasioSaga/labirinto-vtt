/**
 * PRELÚDIO, F2b: fechar a janela grava o que o Prelúdio ainda segura e só
 * pergunta quando algo não gravou. Dados inventados (repositório público).
 */
import { expect, it, vi } from 'vitest'
import { preludioDeixaFechar, registrarSalvarAoFechar } from './aoFechar'

it('fecha direto quando tudo gravou; quando não gravou, pergunta com o motivo e obedece a resposta', async () => {
  const perguntar = vi.fn(async () => false)
  expect(await preludioDeixaFechar({ esperaMaximaMs: 1000, perguntar })).toBe(true)

  registrarSalvarAoFechar(async () => null)
  expect(await preludioDeixaFechar({ esperaMaximaMs: 1000, perguntar })).toBe(true)
  expect(perguntar).not.toHaveBeenCalled()

  registrarSalvarAoFechar(async () => 'Não deu para gravar o verbete de teste: disco de mentira cheio.')
  expect(await preludioDeixaFechar({ esperaMaximaMs: 1000, perguntar })).toBe(false)
  expect(perguntar).toHaveBeenCalledWith(
    'Não deu para gravar o verbete de teste: disco de mentira cheio. Se fechar o Labirinto agora, o que o Prelúdio não salvou se perde. Fechar mesmo assim?',
  )
  perguntar.mockResolvedValueOnce(true)
  expect(await preludioDeixaFechar({ esperaMaximaMs: 1000, perguntar })).toBe(true)
})
