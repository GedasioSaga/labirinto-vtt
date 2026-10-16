import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Cartao, Cartoes, Essencial, SubFicha } from './Cartoes'

/*
 * A gramática da ficha (fatia 8 do design consolidado): o bloco essencial, os
 * cartões que abrem uma sub-ficha e a sub-ficha com o "voltar". As fichas de
 * cada tipo (fatias 9 a 16) montam nestas peças.
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

const montar = (elemento: ReactElement) => act(() => root.render(elemento))
const ICONE = <svg data-icone="" />

describe('Essencial e Cartoes', () => {
  it('o essencial é um cartão plano, sem cabeçalho, com os campos dentro', () => {
    montar(
      <Essencial>
        <label>
          Nome <input />
        </label>
      </Essencial>,
    )
    const bloco = container.querySelector('.gr-essencial')
    expect(bloco?.classList.contains('gr-ficha--plana')).toBe(true)
    expect(bloco?.querySelector('button')).toBeNull()
    expect(bloco?.querySelector('.gr-ficha__dentro input')).not.toBeNull()
  })

  it('a grade diz no título que cada cartão abre em ficha própria', () => {
    montar(
      <Cartoes titulo="Comportamento">
        <Cartao icone={ICONE} rotulo="Patrulha" resumo="Desligada" onAbrir={() => {}} />
      </Cartoes>,
    )
    expect(container.querySelector('h3.gr-titulo-secao')?.textContent).toBe('Comportamentoabre em ficha própria')
    expect(container.querySelectorAll('.gr-cartoes > .gr-cartao')).toHaveLength(1)
  })

  it('cartão: nome e resumo; ligado acende o latão; desligado fica apagado, diz por quê e não abre', () => {
    const onAbrir = vi.fn()
    montar(
      <>
        <Cartao icone={ICONE} rotulo="Luzes" resumo="Lampião aceso" ligado onAbrir={onAbrir} />
        <Cartao icone={ICONE} rotulo="Piso" resumo="Sem pisos" desligado="Esta cena não tem pisos." onAbrir={onAbrir} />
      </>,
    )
    const [luzes, piso] = Array.from(container.querySelectorAll<HTMLButtonElement>('.gr-cartao'))
    expect(luzes?.textContent).toBe('LuzesLampião aceso')
    expect(luzes?.classList.contains('gr-e-ligado')).toBe(true)
    expect(piso?.disabled).toBe(true)
    expect(piso?.querySelector('.gr-cartao__resumo')?.textContent).toBe('Esta cena não tem pisos.')
    act(() => piso?.click())
    expect(onAbrir).not.toHaveBeenCalled()
  })

  it('o clique do ponteiro abre animado; Enter ou Espaço (clique sem `detail`) abre parado', () => {
    const onAbrir = vi.fn()
    montar(<Cartao icone={ICONE} rotulo="Patrulha" resumo="Desligada" onAbrir={onAbrir} />)
    const cartao = container.querySelector('.gr-cartao')
    act(() => void cartao?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 })))
    act(() => void cartao?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 })))
    expect(onAbrir.mock.calls).toEqual([[false], [true]])
  })

  it('de volta da sub-ficha, o cartão dela recebe o foco', () => {
    montar(<Cartao icone={ICONE} rotulo="Patrulha" resumo="Desligada" onAbrir={() => {}} focar />)
    expect(document.activeElement).toBe(container.querySelector('.gr-cartao'))
  })
})

describe('SubFicha', () => {
  it('abre com o foco no voltar, que diz para onde volta; a cabeça do recurso é o título da folha', () => {
    const onVoltar = vi.fn()
    montar(
      <SubFicha voltarPara="Saga" onVoltar={onVoltar} icone={ICONE} titulo="Patrulha" tipo="Comportamento de Saga" instantanea>
        <button type="button">Marcar ponto aqui</button>
      </SubFicha>,
    )
    const voltar = container.querySelector<HTMLButtonElement>('.gr-voltar-sub')
    expect(document.activeElement).toBe(voltar)
    expect(voltar?.getAttribute('aria-label')).toBe('Voltar para Saga')
    expect(voltar?.textContent).toBe('Saga')
    expect(container.querySelector('h2.gr-cabeca__nome')?.textContent).toBe('Patrulha')
    expect(container.querySelector('.gr-cabeca__tipo')?.textContent).toBe('Comportamento de Saga')
    expect(container.querySelector('.gr-ficha--plana button')?.textContent).toBe('Marcar ponto aqui')
    act(() => voltar?.click())
    expect(onVoltar).toHaveBeenCalledTimes(1)
  })
})
