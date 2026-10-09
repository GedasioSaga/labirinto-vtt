import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContaDeJogador } from '../lib/contasDosJogadores'
import { novoPersonagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { ContasDosJogadores, type ContasDosJogadoresProps } from './ContasDosJogadores'

/**
 * "Contas dos jogadores" na aba Jogo: criar (nome + PIN só com números),
 * apagar com confirmação, esquecer aparelho, dar personagem à conta e o
 * "Só com conta", que não liga sem conta nenhuma.
 */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const PIN_GUARDADO = { algoritmo: 'PBKDF2-SHA256' as const, iteracoes: 600_000, sal: 'c2Fs', hash: 'aGFzaA==' }
const ANA: ContaDeJogador = {
  id: 'conta_ana',
  nome: 'Ana',
  pin: PIN_GUARDADO,
  aparelhos: [{ id: 'ap_1', hash: 'aGFzaA==', rotulo: 'Chrome no Android', criado: 1, vistoEm: 0 }],
  criada: 1,
}
const BIA: ContaDeJogador = { id: 'conta_bia', nome: 'Bia', pin: PIN_GUARDADO, aparelhos: [], criada: 1 }
const LIRIO = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Lírio'), id: 'pers_lirio', dono: 'conta_ana' }
const GROG = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Grog'), id: 'pers_grog', dono: 'conta_bia' }

function botao(raiz: ParentNode, nome: string): HTMLButtonElement {
  const achado = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => candidato.textContent?.trim() === nome || candidato.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

function campo(raiz: ParentNode, rotulo: string): HTMLInputElement {
  const label = Array.from(raiz.querySelectorAll('label')).find((candidato) => candidato.textContent?.trim().startsWith(rotulo))
  // `htmlFor` (id do useId) ou o campo dentro do próprio rótulo.
  const alvo = label === undefined ? null : label.htmlFor !== '' ? document.getElementById(label.htmlFor) : label.querySelector('input')
  if (!(alvo instanceof HTMLInputElement)) throw new Error(`campo "${rotulo}" não está na tela`)
  return alvo
}

function digitar(alvo: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, valor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('ContasDosJogadores', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function montar(props: Partial<ContasDosJogadoresProps> = {}) {
    const chamadas = {
      onCriar: vi.fn(async () => undefined),
      onTrocarPin: vi.fn(async () => undefined),
      onApagar: vi.fn(async () => undefined),
      onEsquecerAparelho: vi.fn(async () => undefined),
      onSoComConta: vi.fn(async () => undefined),
      onDarPersonagem: vi.fn(),
    }
    act(() =>
      root.render(<ContasDosJogadores contas={[ANA, BIA]} soComConta={false} podeGravar aviso={null} personagens={[LIRIO, GROG]} {...chamadas} {...props} />),
    )
    // A seção nasce fechada: abre para ver a lista.
    act(() => Array.from(container.querySelectorAll('button')).find((candidato) => candidato.textContent?.startsWith('Contas dos jogadores'))?.click())
    return chamadas
  }

  it('cria a conta com nome e PIN; o PIN só aceita números e o botão espera 4 deles', async () => {
    const { onCriar } = montar()
    digitar(campo(container, 'Nome do jogador'), 'Caio')
    digitar(campo(container, 'PIN'), '12a')
    expect(campo(container, 'PIN').value).toBe('12')
    expect(botao(container, '+ Conta').disabled).toBe(true)
    digitar(campo(container, 'PIN'), '1234')
    await act(async () => botao(container, '+ Conta').click())
    expect(onCriar).toHaveBeenCalledWith('Caio', '1234')
    // Criou: o formulário limpa, e o PIN não fica na tela.
    expect(campo(container, 'PIN').value).toBe('')
  })

  it('o erro da criação aparece no formulário (a frase vem pronta da store)', async () => {
    montar({ onCriar: vi.fn(async () => Promise.reject(new Error('Já existe uma conta com esse nome.'))) })
    digitar(campo(container, 'Nome do jogador'), 'ana')
    digitar(campo(container, 'PIN'), '1234')
    await act(async () => botao(container, '+ Conta').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Já existe uma conta com esse nome.')
  })

  it('a conta aberta mostra os personagens (marca os dela, diz de quem é o outro) e dá ou tira o personagem', () => {
    const { onDarPersonagem } = montar()
    act(() => botao(container, 'Ana1 personagem · 1 aparelho').click())
    const lirio = campo(container, 'Lírio')
    const grog = campo(container, 'Grog')
    expect(lirio.checked).toBe(true)
    expect(grog.checked).toBe(false)
    expect(container.textContent).toContain('de Bia')
    act(() => grog.click())
    expect(onDarPersonagem).toHaveBeenCalledWith('pers_grog', 'conta_ana')
    act(() => lirio.click())
    expect(onDarPersonagem).toHaveBeenCalledWith('pers_lirio', null)
  })

  it('esquecer aparelho e apagar a conta (com confirmação)', async () => {
    const { onEsquecerAparelho, onApagar } = montar()
    act(() => botao(container, 'Ana1 personagem · 1 aparelho').click())
    await act(async () => botao(container, 'Esquecer Chrome no Android de Ana').click())
    expect(onEsquecerAparelho).toHaveBeenCalledWith('conta_ana', 'ap_1')
    act(() => botao(container, 'Apagar a conta de Ana').click())
    expect(onApagar).not.toHaveBeenCalled()
    await act(async () => botao(container, 'Apagar').click())
    expect(onApagar).toHaveBeenCalledWith('conta_ana')
  })

  it('"Só com conta" liga pela caixa, e não liga sem conta nenhuma', async () => {
    const { onSoComConta } = montar()
    await act(async () => campo(container, 'Só com conta').click())
    expect(onSoComConta).toHaveBeenCalledWith(true)
    act(() => root.unmount())
    root = createRoot(container)
    montar({ contas: [] })
    expect(campo(container, 'Só com conta').disabled).toBe(true)
  })
})
