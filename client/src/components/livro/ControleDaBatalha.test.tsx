import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { esquecerAberturasDeBatalhaDeFora, registrarAberturaDeBatalha } from '../../transicoes/aberturasDeBatalha'
import type { ArmazemDaAbertura } from '../../lib/batalha/aberturaLembrada'
import type { GridShape } from '../../types/map'
import { ControleDaBatalha } from './ControleDaBatalha'

/**
 * MODO BATALHA (B5): o "Iniciar batalha" do livro da mesa liga e desliga a
 * batalha da cena na store, abre a escolha da abertura e do nome (lembrados
 * por aventura), o Shift+B faz o mesmo de qualquer ponto, e mapa triangular
 * fica sem batalha. A abertura toca no mestre pelo motor (aqui, falso).
 */

const tocadas = vi.hoisted(() => [] as { id: string; nome?: string }[])
vi.mock('../../transicoes/motor', () => ({
  tocarAberturaDeBatalha: (opcoes: { id: string; nome?: string }) => {
    tocadas.push({ id: opcoes.id, ...(opcoes.nome === undefined ? {} : { nome: opcoes.nome }) })
    return Promise.resolve({ parar: () => undefined, definirVolume: () => undefined })
  },
}))

const CENA = 'cena-1'
let container: HTMLDivElement
let root: Root

function armazemFalso(): ArmazemDaAbertura & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return { dados, getItem: (chave) => dados.get(chave) ?? null, setItem: (chave, valor) => void dados.set(chave, valor) }
}

function montar(props: { gridShape?: GridShape; aventuraId?: string | null; armazem?: ArmazemDaAbertura } = {}): void {
  act(() => {
    root.render(<ControleDaBatalha sceneKey={CENA} gridShape={props.gridShape ?? 'square'} aventuraId={props.aventuraId ?? 'av-1'} armazem={props.armazem ?? armazemFalso()} />)
  })
}

function botao(): HTMLButtonElement {
  const achado = container.querySelector<HTMLButtonElement>('.gr-batalha button')
  if (achado === null) throw new Error('sem o botão da batalha')
  return achado
}

function clicar(alvo: HTMLElement): void {
  act(() => alvo.click())
}

function dialogo(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.gr-batalha-dlg')
}

function confirmar(): void {
  const iniciar = Array.from(document.querySelectorAll<HTMLButtonElement>('.gr-batalha-dlg button')).find((b) => b.textContent === 'Iniciar')
  if (iniciar === undefined) throw new Error('sem o "Iniciar" da escolha')
  clicar(iniciar)
}

function escolher(select: HTMLSelectElement, valor: string): void {
  act(() => {
    select.value = valor
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function shiftB(alvo: EventTarget = window): void {
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', shiftKey: true, bubbles: true }))
  })
}

beforeAll(() => {
  registrarAberturaDeBatalha({ id: 'espadas-cruzadas', nome: 'Espadas cruzadas', duracaoNaturalS: 2.8, quadroDaMiniaturaS: 1, criar: () => ({}) })
})

afterAll(() => {
  esquecerAberturasDeBatalhaDeFora()
})

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useBatalhaStore.getState().reset()
  tocadas.length = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('ControleDaBatalha (B5)', () => {
  it('o botão liga a batalha na store pela escolha e desliga no segundo clique', () => {
    montar()
    expect(botao().textContent).toBe('Iniciar batalha')
    clicar(botao())
    expect(dialogo()).not.toBeNull()
    confirmar()
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(true)
    expect(botao().textContent).toBe('Encerrar batalha')
    expect(botao().getAttribute('aria-pressed')).toBe('true')
    clicar(botao())
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(false)
    expect(botao().textContent).toBe('Iniciar batalha')
  })

  it('confirmar leva a abertura e o nome ao anúncio (o App manda `batalha.iniciada` com eles) e a abertura toca no mestre', () => {
    montar()
    clicar(botao())
    confirmar()
    expect(useBatalhaStore.getState().anuncio).toMatchObject({ sceneKey: CENA, transicao: 'espadas-cruzadas', texto: 'Royals' })
    expect(tocadas).toEqual([{ id: 'espadas-cruzadas', nome: 'Royals' }])
  })

  it('"Nenhuma" liga sem transição: o anúncio não leva `transicao` e nada toca', () => {
    montar()
    clicar(botao())
    const select = document.querySelector<HTMLSelectElement>('.gr-batalha-dlg select')
    if (select === null) throw new Error('sem a lista de aberturas')
    escolher(select, '')
    confirmar()
    expect(useBatalhaStore.getState().anuncio?.transicao).toBeUndefined()
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(true)
    expect(tocadas).toEqual([])
  })

  it('Shift+B abre a escolha com a batalha desligada e encerra com ela ligada; num campo de texto não', () => {
    montar()
    shiftB()
    expect(dialogo()).not.toBeNull()
    confirmar()
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(true)
    const campo = document.createElement('input')
    document.body.appendChild(campo)
    shiftB(campo)
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(true)
    campo.remove()
    shiftB()
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(false)
  })

  it('mapa triangular: botão desligado, sem escolha e sem atalho', () => {
    montar({ gridShape: 'triangle' })
    expect(botao().getAttribute('aria-disabled')).toBe('true')
    expect(botao().getAttribute('aria-keyshortcuts')).toBeNull()
    clicar(botao())
    shiftB()
    expect(dialogo()).toBeNull()
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(false)
  })

  it('a escolha fica lembrada por aventura para a próxima vez', () => {
    const armazem = armazemFalso()
    montar({ armazem, aventuraId: 'av-1' })
    clicar(botao())
    const select = document.querySelector<HTMLSelectElement>('.gr-batalha-dlg select')
    const nome = document.querySelector<HTMLInputElement>('.gr-batalha-dlg input')
    if (select === null || nome === null) throw new Error('sem os campos da escolha')
    escolher(select, '')
    digitar(nome, 'Corvos')
    confirmar()
    expect(useBatalhaStore.getState().anuncio?.texto).toBe('Corvos')
    clicar(botao())
    // Mesma aventura: abre com "Nenhuma" e "Corvos".
    clicar(botao())
    expect(document.querySelector<HTMLSelectElement>('.gr-batalha-dlg select')?.value).toBe('')
    expect(document.querySelector<HTMLInputElement>('.gr-batalha-dlg input')?.value).toBe('Corvos')
    act(() => root.unmount())
    root = createRoot(container)
    // Outra aventura: o padrão (as espadas e "Royals").
    montar({ armazem, aventuraId: 'av-2' })
    clicar(botao())
    expect(document.querySelector<HTMLSelectElement>('.gr-batalha-dlg select')?.value).toBe('espadas-cruzadas')
    expect(document.querySelector<HTMLInputElement>('.gr-batalha-dlg input')?.value).toBe('Royals')
  })
})
