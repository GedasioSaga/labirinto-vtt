/**
 * ITEM NO MAPA (entrega 5) no painel do mestre: a imagem no chão mostra nome,
 * modo de pegar, pilha e "Mostrar como pino"; o pino de item, a mesma pilha e
 * "Mostrar como imagem no chão". Trocar o modo de pegar não perde os dados do
 * item, e a pilha só grava ao sair do campo, dentro da faixa.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinItem } from '../types/map'
import { ITEM_QUANTIDADE_MAX } from '../lib/items'
import { DadosDoItemNoMapa, ItemNoChaoControls } from './ItemNoMapaControls'
import { PinControls, type PinControlsProps } from './PinControls'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const POCAO: PinItem = { nome: 'Poção', itemId: 'item_pocao', imagem: `midia:${'4'.repeat(64)}.webp`, categoria: 'Consumível', preco: 30, empilhavel: true, livre: true }

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function botao(texto: string): HTMLButtonElement | undefined {
  return Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.trim() === texto)
}

function interruptor(rotulo: string): HTMLInputElement {
  const label = Array.from(host.querySelectorAll('label')).find((l) => l.textContent?.includes(rotulo))
  const input = label?.querySelector('input')
  if (input === null || input === undefined) throw new Error(`sem o interruptor ${rotulo}`)
  return input
}

function digitar(campo: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(campo, valor)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('imagem do item no chão', () => {
  it('modo de pegar liga e desliga sem perder os dados; trocar vira pino', () => {
    const onChange = vi.fn()
    const onTrocarForma = vi.fn()
    act(() => root.render(<ItemNoChaoControls item={POCAO} onChange={onChange} onTrocarForma={onTrocarForma} />))
    expect(host.textContent).toContain('Item no chão')
    expect(host.textContent).toContain('Consumível')
    const pega = interruptor('Pega sem pedir ao mestre')
    expect(pega.checked).toBe(true)
    act(() => pega.click())
    const { livre: _livre, ...pede } = POCAO
    expect(onChange).toHaveBeenLastCalledWith(pede)
    act(() => botao('Mostrar como pino')?.click())
    expect(onTrocarForma).toHaveBeenCalledTimes(1)
  })

  it('o nome só grava ao sair do campo, aparado; apagado volta ao de antes', () => {
    const onChange = vi.fn()
    act(() => root.render(<ItemNoChaoControls item={POCAO} onChange={onChange} onTrocarForma={vi.fn()} />))
    const nome = host.querySelector<HTMLInputElement>('input[aria-label="Nome do item"]')
    if (nome === null) throw new Error('sem o campo de nome')
    digitar(nome, '  Poção grande ')
    expect(onChange).not.toHaveBeenCalled()
    act(() => nome.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onChange).toHaveBeenLastCalledWith({ ...POCAO, nome: 'Poção grande' })
    digitar(nome, '   ')
    act(() => nome.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(nome.value).toBe('Poção')
  })

  it('a pilha grava ao sair do campo, dentro de 1 a 9999; 1 tira o campo', () => {
    const onChange = vi.fn()
    act(() => root.render(<DadosDoItemNoMapa item={POCAO} forma="chao" onChange={onChange} onTrocarForma={vi.fn()} />))
    const campo = host.querySelector<HTMLInputElement>('.lb-item-no-mapa__quantidade')
    if (campo === null) throw new Error('sem o campo de quantidade')
    expect(campo.value).toBe('1')
    digitar(campo, '20000')
    act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onChange).toHaveBeenLastCalledWith({ ...POCAO, quantidade: ITEM_QUANTIDADE_MAX })
    act(() => root.render(<DadosDoItemNoMapa item={{ ...POCAO, quantidade: 5 }} forma="chao" onChange={onChange} onTrocarForma={vi.fn()} />))
    digitar(campo, '1')
    act(() => campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(onChange).toHaveBeenLastCalledWith(POCAO)
    digitar(campo, 'abc')
    act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('item que não empilha não tem pilha; pino sem imagem não oferece virar imagem no chão', () => {
    act(() => root.render(<DadosDoItemNoMapa item={{ nome: 'Corda', itemId: 'item_corda' }} forma="pino" onChange={vi.fn()} onTrocarForma={vi.fn()} />))
    expect(host.querySelector('.lb-item-no-mapa__quantidade')).toBeNull()
    expect(botao('Mostrar como imagem no chão')).toBeUndefined()
  })
})

/** O mínimo que o painel do pino pede (o molde de `PinControls.icone.test.tsx`). */
function propsDoPino(): PinControlsProps {
  return {
    kind: 'exclamacao',
    onKindChange: () => {},
    description: '',
    onDescriptionChange: () => {},
    locked: false,
    onLockedChange: () => {},
    marco: false,
    onMarcoChange: () => {},
    lerDePerto: null,
    onLerDePertoChange: () => {},
    image: null,
    onChooseImage: () => {},
    onClearImage: () => {},
    onDelete: () => {},
    iconChoice: { icon: 'item', onIconChange: () => {}, pinSelected: true },
  }
}

describe('pino de item no painel do pino', () => {
  it('"Pega sem pedir ao mestre" guarda os dados; o pino de item mostra a pilha e vira imagem no chão', () => {
    const onChange = vi.fn()
    const onTrocarForma = vi.fn()
    act(() =>
      root.render(
        <PinControls
          {...propsDoPino()}
          item={{ value: POCAO, onChange, onTrocarForma }}
        />,
      ),
    )
    act(() => interruptor('Pega sem pedir ao mestre').click())
    const { livre: _livre, ...pede } = POCAO
    expect(onChange).toHaveBeenLastCalledWith(pede)
    expect(host.querySelector('.lb-item-no-mapa__quantidade')).not.toBeNull()
    act(() => botao('Mostrar como imagem no chão')?.click())
    expect(onTrocarForma).toHaveBeenCalledTimes(1)
  })

  it('o pino "!" de antes, só com o nome, fica como era: sem pilha nem troca', () => {
    act(() =>
      root.render(
        <PinControls
          {...propsDoPino()}
          item={{ value: { nome: 'Chave' }, onChange: vi.fn(), onTrocarForma: vi.fn() }}
        />,
      ),
    )
    expect(host.querySelector('.lb-item-no-mapa')).toBeNull()
  })
})
