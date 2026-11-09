/**
 * PRELÚDIO, F2b: o salvar automático não perde texto. Sair do Prelúdio com a
 * gravação falhando guarda o texto na memória, e a restauração do Drive grava o
 * pendente antes, trava a edição e não regrava a memória de antes por cima do
 * que voltou. O disco é de mentira e os verbetes, inventados (repositório público).
 */
import { afterEach, expect, it, vi } from 'vitest'
import { verbeteNovo } from '../../lib/preparo/enciclopedia'
import type { Verbete } from '../../lib/preparo/tipos'

const disco = new Map<string, Verbete>()
let recusaDoDisco: string | null = null

vi.mock('../../lib/preparo/disco', () => ({
  lerIndiceDoPreparo: vi.fn(async () => ({ estado: 'novo' })),
  listarNoPreparo: vi.fn(async () => [...disco.keys()].sort()),
  lerVerbete: vi.fn(async (id: string) => {
    const verbete = disco.get(id)
    return verbete === undefined ? { estado: 'novo' } : { estado: 'ok', valor: structuredClone(verbete), aviso: null }
  }),
  gravarVerbete: vi.fn(async (verbete: Verbete) => {
    if (recusaDoDisco !== null) throw new Error(recusaDoDisco)
    disco.set(verbete.id, structuredClone(verbete))
  }),
}))

vi.mock('../midia', () => ({ prepararMidia: vi.fn(async () => null) }))

const { usePreludio } = await import('./preludio')
const { gravarVerbete } = await import('../../lib/preparo/disco')

function verbeteDeTeste(titulo: string): Verbete {
  return verbeteNovo('personagem', titulo, { campanhas: [] }, () => 'vb-marujo-inventado')
}

function tituloNaMemoria(): string | undefined {
  return usePreludio.getState().verbetes.get('vb-marujo-inventado')?.titulo
}

afterEach(async () => {
  recusaDoDisco = null
  await usePreludio.getState().fechar()
  disco.clear()
})

it('sair com a gravação falhando guarda o texto na memória; ao abrir de novo ele vale mais que o do disco e grava quando o disco volta', async () => {
  disco.set('vb-marujo-inventado', verbeteDeTeste('Nome antigo'))
  await usePreludio.getState().carregar()
  recusaDoDisco = 'O disco de mentira recusou.'
  usePreludio.getState().mudarVerbete('vb-marujo-inventado', (atual) => ({ ...atual, titulo: 'Nome novo' }))
  expect(await usePreludio.getState().salvarPendentes()).toBe(false)
  expect(usePreludio.getState().salvamento).toEqual({ t: 'falhou', motivo: 'O disco de mentira recusou.' })

  // Voltar ao menu e abrir o Prelúdio de novo, com o disco ainda recusando.
  await usePreludio.getState().fechar()
  await usePreludio.getState().carregar()
  expect(tituloNaMemoria()).toBe('Nome novo')
  expect(disco.get('vb-marujo-inventado')?.titulo).toBe('Nome antigo')
  expect(usePreludio.getState().salvamento.t).toBe('falhou')

  recusaDoDisco = null
  expect(await usePreludio.getState().salvarPendentes()).toBe(true)
  expect(disco.get('vb-marujo-inventado')?.titulo).toBe('Nome novo')
  expect(usePreludio.getState().salvamento).toEqual({ t: 'em-dia' })
})

it('a restauração grava o pendente antes, trava a edição e depois vale o que voltou, sem a memória de antes por cima', async () => {
  disco.set('vb-marujo-inventado', verbeteDeTeste('Antes da cópia'))
  await usePreludio.getState().carregar()
  usePreludio.getState().mudarVerbete('vb-marujo-inventado', (atual) => ({ ...atual, titulo: 'Editado antes de restaurar' }))

  expect(await usePreludio.getState().antesDeRestaurar()).toBeNull()
  // O pendente foi ao disco antes da troca: vai junto para antes-de-restaurar.
  expect(disco.get('vb-marujo-inventado')?.titulo).toBe('Editado antes de restaurar')
  expect(usePreludio.getState().travado).toBe(true)
  usePreludio.getState().mudarVerbete('vb-marujo-inventado', (atual) => ({ ...atual, titulo: 'Digitado durante o download' }))
  expect(tituloNaMemoria()).toBe('Editado antes de restaurar')

  // A troca da pasta.
  disco.set('vb-marujo-inventado', verbeteDeTeste('Restaurado do Drive'))
  const gravacoesAntes = vi.mocked(gravarVerbete).mock.calls.length
  await usePreludio.getState().depoisDeRestaurar(true)
  expect(tituloNaMemoria()).toBe('Restaurado do Drive')
  expect(disco.get('vb-marujo-inventado')?.titulo).toBe('Restaurado do Drive')
  expect(vi.mocked(gravarVerbete).mock.calls.length).toBe(gravacoesAntes)
  expect(usePreludio.getState().travado).toBe(false)
})
