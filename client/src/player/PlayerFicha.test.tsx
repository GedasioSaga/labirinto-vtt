/**
 * FICHA DE PERSONAGEM do jogador em tela cheia: o vazio (sem sistema, sem
 * ficha), "Criar minha ficha" que abre a ficha nova em edição, e o "Salvar"
 * que só sai da edição quando a mesa confirma — recusado, o rascunho fica.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { TokenDoPersonagem } from '../net/protocoloDoPersonagem'
import { PlayerFicha, type PlayerFichaProps } from './PlayerFicha'
import type { EnvioDePersonagem } from './playerConnection'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy' }
const ZORO: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Zoro'), id: 'pers_zoro' }
const COM_LUFFY: TokenDoPersonagem[] = [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: LUFFY.id }]

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function props(extra: Partial<PlayerFichaProps> = {}): PlayerFichaProps {
  return {
    sistema: SISTEMA_ONE_PIECE,
    personagens: [LUFFY],
    tokens: COM_LUFFY,
    envio: undefined,
    onCriar: vi.fn(() => true),
    onSalvar: vi.fn(() => ({ ok: true as const, nada: false })),
    onClose: vi.fn(),
    escolherImagem: vi.fn(async () => null),
    ...extra,
  }
}

function render(p: PlayerFichaProps): void {
  act(() => root.render(<PlayerFicha {...p} />))
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === nome || b.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

const temBotao = (nome: string): boolean => Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.trim() === nome)

function clicar(nome: string): void {
  act(() => botao(nome).click())
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function campoNome(): HTMLInputElement {
  const rotulo = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.startsWith('Nome'))
  const input = rotulo?.querySelector('input')
  if (input === null || input === undefined) throw new Error('campo Nome não está na tela')
  return input
}

const envio = (extra: Partial<EnvioDePersonagem>): EnvioDePersonagem => ({ id: 1, tipo: 'salvar', personagemId: LUFFY.id, pendentes: [], falhou: false, ...extra })

describe('PlayerFicha: vazios', () => {
  it('aventura sem sistema: diz isso, sem ficha e sem Editar', () => {
    render(props({ sistema: null }))
    expect(container.textContent).toContain('O mestre ainda não escolheu um sistema de RPG')
    expect(temBotao('Editar')).toBe(false)
    expect(container.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('true')
  })

  it('sem ficha (token) nenhuma: explica que a ficha vem do mestre', () => {
    render(props({ personagens: [], tokens: [] }))
    expect(container.textContent).toContain('Você ainda não tem personagem nesta mesa')
  })
})

describe('PlayerFicha: criar', () => {
  it('"Criar minha ficha" pede ao host; a ficha nova chega e abre em edição, sem o campo Tipo', () => {
    const onCriar = vi.fn(() => true)
    const semFicha: TokenDoPersonagem[] = [{ tokenId: 'tok-nami', nome: 'Nami', personagemId: null }]
    render(props({ personagens: [], tokens: semFicha, onCriar }))
    clicar('Criar minha ficha')
    expect(onCriar).toHaveBeenCalledWith('tok-nami')
    render(props({ personagens: [], tokens: semFicha, onCriar, envio: envio({ tipo: 'criar', personagemId: null, pendentes: ['p1'] }) }))
    expect(botao('Criando…').disabled).toBe(true)

    const nami: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Nami'), id: 'pers_nami' }
    render(props({ personagens: [nami], tokens: [{ tokenId: 'tok-nami', nome: 'Nami', personagemId: nami.id }], onCriar, envio: envio({ tipo: 'criar', personagemId: nami.id }) }))
    expect(temBotao('Salvar')).toBe(true)
    expect(campoNome().value).toBe('Nami')
    expect(Array.from(container.querySelectorAll('.lb-label')).map((l) => l.textContent)).not.toContain('Tipo')
  })

  it('com várias fichas sem personagem, um "Criar" por ficha', () => {
    render(props({ personagens: [], tokens: [{ tokenId: 't1', nome: 'Nami', personagemId: null }, { tokenId: 't2', nome: 'Usopp', personagemId: null }] }))
    expect(temBotao('Criar ficha de Nami')).toBe(true)
    expect(temBotao('Criar ficha de Usopp')).toBe(true)
  })
})

describe('PlayerFicha: editar e salvar', () => {
  it('Salvar manda base e rascunho; a mesa confirma e a ficha sai da edição com o nome novo', () => {
    const onSalvar = vi.fn(() => ({ ok: true as const, nada: false }))
    render(props({ onSalvar }))
    expect(container.querySelector('h2')?.textContent).toBe('Luffy')
    clicar('Editar')
    digitar(campoNome(), 'Monkey D. Luffy')
    clicar('Salvar')
    expect(onSalvar).toHaveBeenCalledWith(LUFFY, { ...LUFFY, nome: 'Monkey D. Luffy' })

    render(props({ onSalvar, envio: envio({ pendentes: ['p1'] }) }))
    expect(botao('Salvando…').disabled).toBe(true)
    const salvo = { ...LUFFY, nome: 'Monkey D. Luffy' }
    render(props({ onSalvar, personagens: [salvo], envio: envio({}) }))
    expect(temBotao('Salvar')).toBe(false)
    expect(container.querySelector('h2')?.textContent).toBe('Monkey D. Luffy')
  })

  it('a mesa recusou: o aviso diz, e a ficha continua em edição com o rascunho', () => {
    render(props())
    clicar('Editar')
    digitar(campoNome(), 'Luffy do Gear 5')
    clicar('Salvar')
    render(props({ envio: envio({ falhou: true }) }))
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('A mesa não confirmou')
    expect(campoNome().value).toBe('Luffy do Gear 5')
  })

  it('o "Salvar" recusado antes de sair (texto longo) mostra o motivo e não espera a mesa', () => {
    const onSalvar = vi.fn(() => ({ ok: false as const, erro: 'Algum texto da ficha passou do tamanho.' }))
    render(props({ onSalvar }))
    clicar('Editar')
    clicar('Salvar')
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Algum texto da ficha passou do tamanho.')
    expect(botao('Salvar').disabled).toBe(false)
  })

  it('Esc com rascunho mudado pergunta antes; "Descartar e fechar" fecha', () => {
    const onClose = vi.fn()
    render(props({ onClose }))
    clicar('Editar')
    digitar(campoNome(), 'Outro')
    const dialogo = container.querySelector('[role="dialog"]')
    act(() => dialogo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(onClose).not.toHaveBeenCalled()
    clicar('Descartar e fechar')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o mestre mudou a ficha durante a edição: o aviso conta, e o rascunho fica', () => {
    render(props())
    clicar('Editar')
    digitar(campoNome(), 'Rascunho')
    render(props({ personagens: [{ ...LUFFY, descricao: 'do mestre' }] }))
    expect(container.textContent).toContain('Esta ficha mudou na mesa enquanto você editava')
    expect(campoNome().value).toBe('Rascunho')
  })

  it('dois personagens: um botão por personagem, e trocar mostra o outro', () => {
    render(props({ personagens: [LUFFY, ZORO], tokens: [...COM_LUFFY, { tokenId: 'tok-z', nome: 'Z', personagemId: ZORO.id }] }))
    clicar('Zoro')
    expect(container.querySelector('h2')?.textContent).toBe('Zoro')
    expect(botao('Zoro').getAttribute('aria-pressed')).toBe('true')
  })
})
