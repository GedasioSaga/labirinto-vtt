import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PinIcon } from '../../types/map'
import { PinControls } from '../PinControls'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

/**
 * O ÍCONE do marcador "!"/"?" é o que aparece NO LUGAR do símbolo do tipo, no
 * mapa e no cartão do jogador. Na ficha do pino (fatia 12) ele mora na ficha
 * Aparência, depois do Tipo, com a linha de apoio que diz isso; o Excluir foi
 * para a cabeça. Sem pino aberto, a ferramenta Pino armada mostra a grade para
 * o próximo marcador.
 */

function props(extra: Partial<FichaDoPinoProps> = {}): FichaDoPinoProps {
  return {
    pinId: 'bau',
    kind: 'exclamacao',
    onKindChange: () => {},
    description: 'Baú no canto',
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
    iconChoice: { icon: null, onIconChange: () => {}, pinSelected: true },
    quemVe: null,
    ...extra,
  }
}

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
  window.localStorage.clear()
})

function grupo(nome: string): HTMLElement {
  const achado = Array.from(container.querySelectorAll<HTMLElement>('[role="radiogroup"]')).find((el) => {
    const rotulo = el.getAttribute('aria-label') ?? document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent
    return rotulo === nome
  })
  if (achado === undefined) throw new Error(`sem grupo "${nome}"`)
  return achado
}

/** A ficha recolhível com este título: o cabeçalho e o que ele abre. */
function ficha(titulo: string): HTMLElement {
  const cabecalho = [...container.querySelectorAll<HTMLElement>('.gr-ficha__cab')].find((cab) => cab.querySelector('.gr-ficha__tit')?.textContent === titulo)
  const achada = cabecalho?.closest<HTMLElement>('.gr-ficha')
  if (achada === null || achada === undefined) throw new Error(`sem a ficha "${titulo}"`)
  return achada
}

describe('FichaDoPino: o ícone do marcador', () => {
  it('um título só; o ícone mora na Aparência, depois do Tipo, que fica no essencial', () => {
    act(() => root.render(<FichaDoPino {...props()} />))
    expect(Array.from(container.querySelectorAll('h2')).map((h) => h.textContent)).toEqual(['Ponto de interesse'])
    const tipo = grupo('Tipo do pino')
    const icone = grupo('Ícone no mapa')
    const aparencia = ficha('Aparência')
    expect(aparencia.contains(icone)).toBe(true)
    expect(aparencia.contains(tipo)).toBe(false)
    expect(tipo.compareDocumentPosition(icone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a linha de apoio diz que o ícone troca o "!" do tipo; o Excluir não mora mais na ficha', () => {
    act(() => root.render(<FichaDoPino {...props()} />))
    expect(container.textContent).toContain('O ícone aparece no lugar do "!" — no mapa e no cartão do jogador.')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent?.startsWith('Excluir'))).toBe(false)
  })

  it('escolher um ícone chama onIconChange com ele; "Sem ícone" devolve null', () => {
    const onIconChange = vi.fn<(icon: PinIcon | null) => void>()
    act(() => root.render(<FichaDoPino {...props({ iconChoice: { icon: 'bau', onIconChange, pinSelected: true } })} />))
    const armadilha = Array.from(grupo('Ícone no mapa').querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((b) => b.textContent === 'Armadilha')
    if (armadilha === undefined) throw new Error('sem a opção "Armadilha"')
    act(() => armadilha.click())
    expect(onIconChange).toHaveBeenLastCalledWith('armadilha')
    const semIcone = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Sem ícone')
    if (semIcone === undefined) throw new Error('sem a opção "Sem ícone"')
    act(() => semIcone.click())
    expect(onIconChange).toHaveBeenLastCalledWith(null)
  })

  it('pino de viagem não mostra a grade de ícones, mesmo recebendo a escolha', () => {
    act(() => root.render(<FichaDoPino {...props({ kind: 'viagem' })} />))
    expect(grupo('Tipo do pino')).not.toBeNull()
    expect(() => grupo('Ícone no mapa')).toThrow()
  })
})

describe('PinControls: a ferramenta Pino armada, sem pino aberto', () => {
  it('a grade vale para o próximo marcador e o texto diz isso', () => {
    act(() =>
      root.render(<PinControls {...props()} description={null} onDelete={() => {}} iconChoice={{ icon: null, onIconChange: () => {}, pinSelected: false }} />),
    )
    expect(grupo('Ícone no mapa')).not.toBeNull()
    expect(container.textContent).toContain('Vale para o próximo ponto de interesse que você cravar.')
  })
})
