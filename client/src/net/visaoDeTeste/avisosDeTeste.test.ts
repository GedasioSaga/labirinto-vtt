import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore } from '../../stores/toastStore'
import { PILHA_DO_EDITOR } from '../avisosDaPonte'
import { criarAvisosDeTeste, GRUPO_DO_TESTE } from './avisosDeTeste'

/** Os avisos da ponte de teste, por cima da pilha de verdade do editor. */

beforeEach(() => {
  vi.useFakeTimers()
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  useToastStore.setState({ toasts: [] })
  vi.useRealTimers()
})

describe('avisosDeTeste', () => {
  it('o relato (info) fica mudo: nada entra na pilha', () => {
    const avisos = criarAvisosDeTeste(PILHA_DO_EDITOR)
    const id = avisos.push('info', 'Ana entrou')
    expect(useToastStore.getState().toasts).toEqual([])
    // Dispensar o id mudo não tira nada de ninguém.
    useToastStore.getState().push('info', 'Aviso da mesa')
    avisos.dismiss(id)
    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Aviso da mesa'])
  })

  it('o pedido entra marcado "Teste ·", na caixa própria, e a chave não se funde com a da mesa', () => {
    const avisos = criarAvisosDeTeste(PILHA_DO_EDITOR)
    const deixar = vi.fn()
    avisos.push('instrucao', 'Ana quer passar', null, { grupo: 'Pedidos', chave: 'viagem:1', actions: [{ label: 'Deixar ir', run: deixar }] })

    const [aviso] = useToastStore.getState().toasts
    expect(aviso?.text).toBe('Teste · Ana quer passar')
    expect(aviso?.grupo).toBe(GRUPO_DO_TESTE)
    expect(aviso?.sempreEmCaixa).toBe(true)
    expect(aviso?.chave).toBe('teste:viagem:1')
    aviso?.actions?.[0]?.run()
    expect(deixar).toHaveBeenCalledTimes(1)
  })

  it('o erro entra marcado, sem virar pedido', () => {
    const avisos = criarAvisosDeTeste(PILHA_DO_EDITOR)
    avisos.push('error', 'Falha ao enviar para jogador: caiu')

    const [aviso] = useToastStore.getState().toasts
    expect(aviso?.kind).toBe('error')
    expect(aviso?.text).toBe('Teste · Falha ao enviar para jogador: caiu')
    expect(aviso?.grupo).toBeUndefined()
  })

  it('dispensarTodos tira da tela só o que o teste pôs', () => {
    const avisos = criarAvisosDeTeste(PILHA_DO_EDITOR)
    useToastStore.getState().push('instrucao', 'Pedido da mesa de verdade')
    avisos.push('instrucao', 'Ana quer passar')
    avisos.push('error', 'Algo falhou')

    avisos.dispensarTodos()

    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Pedido da mesa de verdade'])
  })

  it('dismiss de um aviso do teste tira só ele; o da mesa com o mesmo id nunca é tocado', () => {
    const avisos = criarAvisosDeTeste(PILHA_DO_EDITOR)
    const real = useToastStore.getState().push('instrucao', 'Pedido real')
    const doTeste = avisos.push('instrucao', 'Pedido do teste')

    avisos.dismiss(real)
    avisos.dismiss(doTeste)

    expect(useToastStore.getState().toasts.map((t) => t.text)).toEqual(['Pedido real'])
  })
})
