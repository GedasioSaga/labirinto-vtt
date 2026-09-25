import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PinControls, type PinControlsProps } from './PinControls'

/**
 * NOTA DO MESTRE NO PINO, lado do painel: o pino tem dois textos, "o jogador
 * lê" (a descrição de sempre, que vai para o cartão) e "só eu leio" (a nota,
 * que nunca sai). O rótulo do primeiro continua começando por "Descrição",
 * que é o nome que a mesa e as jornadas já procuram; o da nota não tem
 * "descri" em lugar nenhum, para ninguém confundir os dois.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(overrides: Partial<PinControlsProps> = {}) {
  const props: PinControlsProps = {
    kind: 'exclamacao',
    onKindChange: vi.fn(),
    description: '',
    onDescriptionChange: vi.fn(),
    notaDoMestre: '',
    onNotaDoMestreChange: vi.fn(),
    locked: false,
    onLockedChange: vi.fn(),
    image: null,
    onChooseImage: vi.fn(),
    onClearImage: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  }
  act(() => root.render(<PinControls {...props} />))
  return props
}

/** O campo cujo rótulo, lido inteiro, casa com `rotulo`. */
function campo(rotulo: RegExp): HTMLTextAreaElement {
  const labels = [...container.querySelectorAll('label')].filter((l) => rotulo.test(l.textContent ?? ''))
  if (labels.length !== 1) throw new Error(`esperava 1 rótulo casando ${rotulo}, achei ${labels.length}`)
  const alvo = document.getElementById(labels[0].htmlFor)
  if (!(alvo instanceof HTMLTextAreaElement)) throw new Error(`o painel do pino não tem o campo ${rotulo}`)
  return alvo
}

function digitar(alvo: HTMLTextAreaElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, valor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('PinControls: o que o jogador lê e o que só o mestre lê', () => {
  it('mostra os dois campos com o que está gravado, cada um com o seu rótulo', () => {
    render({ description: 'Um baú de ferro.', notaDoMestre: 'A combinação é 6-12-18.' })
    const doJogador = campo(/o jogador lê/i)
    const doMestre = campo(/só eu leio/i)
    expect(doJogador.value).toBe('Um baú de ferro.')
    expect(doMestre.value).toBe('A combinação é 6-12-18.')
    expect(doJogador).not.toBe(doMestre)
  })

  it('o rótulo do jogador segue começando por "Descrição"; o da nota não diz "descri"', () => {
    render()
    const rotulos = [...container.querySelectorAll('label')].map((l) => l.textContent ?? '')
    expect(rotulos.filter((t) => /descri/i.test(t))).toHaveLength(1)
    expect(rotulos.find((t) => /descri/i.test(t))).toMatch(/^Descrição/)
    expect(rotulos.find((t) => /só eu leio/i.test(t))).toMatch(/^Nota do mestre/)
  })

  it('digitar em cada campo avisa o callback dele, e só o dele', () => {
    const props = render()
    digitar(campo(/só eu leio/i), 'Mímico.')
    expect(props.onNotaDoMestreChange).toHaveBeenLastCalledWith('Mímico.')
    expect(props.onDescriptionChange).not.toHaveBeenCalled()
    digitar(campo(/o jogador lê/i), 'Um baú.')
    expect(props.onDescriptionChange).toHaveBeenLastCalledWith('Um baú.')
    expect(props.onNotaDoMestreChange).toHaveBeenCalledTimes(1)
  })

  it('a nota diz, ligada ao campo, que nunca vai para os jogadores', () => {
    render()
    const nota = campo(/só eu leio/i)
    const dica = document.getElementById(nota.getAttribute('aria-describedby') ?? '')
    expect(dica?.textContent).toMatch(/nunca/i)
  })

  it('sem pino selecionado (só o tipo do próximo), nenhum dos dois campos aparece', () => {
    render({ description: null, notaDoMestre: null })
    expect(container.querySelector('textarea')).toBeNull()
  })
})
