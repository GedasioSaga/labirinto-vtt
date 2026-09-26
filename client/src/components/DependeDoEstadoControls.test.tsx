import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import type { EfeitoNaPorta, RegraDeEstado } from '../types/map'
import { DependeDoEstadoControls, OPCOES_DA_PORTA } from './DependeDoEstadoControls'

const MARE: EstadoDoMundo = { id: 'mare', nome: 'Maré', valores: ['alta', 'baixa'], atual: 'alta' }
const GIRO: EstadoDoMundo = { id: 'giro', nome: 'Giro', valores: ['1', '2', '3'], atual: '2' }

describe('DependeDoEstadoControls: "Depende do estado" de uma porta', () => {
  let container: HTMLDivElement
  let root: Root
  let recebidas: (RegraDeEstado<EfeitoNaPorta> | undefined)[]

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    recebidas = []
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(estados: readonly EstadoDoMundo[], regra: RegraDeEstado<EfeitoNaPorta> | undefined, efeitoAgora: EfeitoNaPorta = 'fechada'): void {
    act(() =>
      root.render(
        <DependeDoEstadoControls
          elemento="a porta"
          estados={estados}
          regra={regra}
          opcoes={OPCOES_DA_PORTA}
          efeitoAgora={efeitoAgora}
          onChange={(nova) => recebidas.push(nova)}
        />,
      ),
    )
  }

  /** A lista suspensa achada pelo rótulo visível, como o mestre acha. */
  function lista(rotulo: string): HTMLSelectElement {
    const label = Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').trim().startsWith(rotulo))
    const alvo = label === undefined ? null : document.getElementById(label.htmlFor)
    if (!(alvo instanceof HTMLSelectElement)) throw new Error(`sem lista "${rotulo}"`)
    return alvo
  }

  function escolher(select: HTMLSelectElement, valor: string): void {
    act(() => {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('sem estado na aventura: explica onde criar e não oferece lista', () => {
    render([], undefined)
    expect(container.textContent).toContain('Estado do mundo')
    expect(container.querySelector('select')).toBe(null)
  })

  it('escolher "Maré" amarra a porta com o efeito de AGORA em cada valor (nada muda até o mestre dizer)', () => {
    render([MARE, GIRO], undefined, 'trancada')
    const estado = lista('Depende do estado')
    expect(estado.value).toBe('')
    expect(Array.from(estado.options).map((o) => o.textContent)).toEqual(['Nenhum', 'Maré', 'Giro'])
    escolher(estado, 'mare')
    expect(recebidas).toEqual([
      {
        estadoId: 'mare',
        efeitos: [
          { valor: 'alta', efeito: 'trancada' },
          { valor: 'baixa', efeito: 'trancada' },
        ],
      },
    ])
  })

  it('porta amarrada: uma lista por valor, com o valor atual marcado; trocar "baixa" para Aberta muda só ela', () => {
    const regra: RegraDeEstado<EfeitoNaPorta> = {
      estadoId: 'mare',
      efeitos: [
        { valor: 'alta', efeito: 'trancada' },
        { valor: 'baixa', efeito: 'trancada' },
      ],
    }
    render([MARE], regra)
    expect(lista('Depende do estado').value).toBe('mare')
    expect(lista('alta').value).toBe('trancada')
    expect(container.textContent).toContain('agora')
    const baixa = lista('baixa')
    expect(Array.from(baixa.options).map((o) => o.textContent)).toEqual(['Não muda', 'Aberta', 'Fechada', 'Trancada'])
    escolher(baixa, 'aberta')
    expect(recebidas).toEqual([
      {
        estadoId: 'mare',
        efeitos: [
          { valor: 'alta', efeito: 'trancada' },
          { valor: 'baixa', efeito: 'aberta' },
        ],
      },
    ])
  })

  it('"Não muda" tira o valor da regra; sem nenhum valor, a porta desamarra', () => {
    const regra: RegraDeEstado<EfeitoNaPorta> = { estadoId: 'mare', efeitos: [{ valor: 'baixa', efeito: 'aberta' }] }
    render([MARE], regra)
    expect(lista('alta').value).toBe('')
    escolher(lista('baixa'), '')
    expect(recebidas).toEqual([undefined])
  })

  it('"Nenhum" desamarra', () => {
    render([MARE], { estadoId: 'mare', efeitos: [{ valor: 'baixa', efeito: 'aberta' }] })
    escolher(lista('Depende do estado'), '')
    expect(recebidas).toEqual([undefined])
  })

  it('regra de um estado que não existe mais: aparece como tal e pode ser desamarrada', () => {
    render([MARE], { estadoId: 'sumiu', efeitos: [{ valor: 'x', efeito: 'aberta' }] })
    const estado = lista('Depende do estado')
    expect(estado.value).toBe('sumiu')
    expect(estado.selectedOptions[0]?.textContent).toBe('Estado que não existe mais')
    escolher(estado, '')
    expect(recebidas).toEqual([undefined])
  })
})
