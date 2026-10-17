import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CENARIO_PADRAO, cenarioComEstilo, type CenarioDoPino } from '../../cenario/catalogo'
import { esquecerEstilosDeCenarioDeFora, registrarEstiloDeCenario } from '../../cenario/estilosDeCenario'
import { FichaDoPino, type FichaDoPinoProps } from './FichaDoPino'

/**
 * A "Animação do cenário" na ficha do "!" (fatia 13): o cabeçalho da ficha do
 * recurso leva o resumo (o nome da câmera, ou o do estilo do pacote), e entrar
 * pelo "+ Adicionar ao pino" abre a ficha SEM ligar a animação: quem liga é o
 * "Quando o jogador vê", por dentro.
 */

const IMAGEM = 'data:image/png;base64,iVBORw0KGgo='
const estiloFalso = { id: 'neve', nome: 'Neve caindo', duracaoNaturalS: 6, criar: () => ({ atualizar: () => {}, descartar: () => {} }) }

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
  esquecerEstilosDeCenarioDeFora()
  window.localStorage.clear()
})

function render(valor: CenarioDoPino | undefined, onChange: (cenario: CenarioDoPino | undefined) => void = () => {}): void {
  const props: FichaDoPinoProps = {
    pinId: 'pino-c',
    kind: 'exclamacao',
    onKindChange: () => {},
    description: 'Caixas empilhadas até o teto.',
    onDescriptionChange: () => {},
    locked: false,
    onLockedChange: () => {},
    marco: false,
    onMarcoChange: () => {},
    lerDePerto: null,
    onLerDePertoChange: () => {},
    image: IMAGEM,
    onChooseImage: () => {},
    onClearImage: () => {},
    iconChoice: null,
    quemVe: null,
    cenario: { valor, onChange },
  }
  act(() => root.render(<FichaDoPino {...props} />))
}

function cabecalhoDoCenario(): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Animação do cenário') === true)
  if (achado === undefined) throw new Error('sem a ficha "Animação do cenário"')
  return achado
}

function seletor(rotulo: string): HTMLSelectElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo)
  const campo = label === undefined ? null : document.getElementById(label.htmlFor)
  if (!(campo instanceof HTMLSelectElement)) throw new Error(`sem o seletor "${rotulo}"`)
  return campo
}

describe('FichaDoPino: animação do cenário', () => {
  it('o resumo da ficha do recurso é o nome da câmera', () => {
    render({ ...CENARIO_PADRAO, movimento: 'aproxima' })
    expect(cabecalhoDoCenario().textContent).toContain('Aproximar')
  })

  it('com estilo do pacote o resumo é o nome do estilo; estilo que não chegou mostra a câmera que toca no lugar', () => {
    act(() => registrarEstiloDeCenario(estiloFalso))
    render(cenarioComEstilo(CENARIO_PADRAO, 'neve'))
    expect(cabecalhoDoCenario().textContent).toContain('Neve caindo')
    render({ ...CENARIO_PADRAO, estilo: 'chuva' })
    expect(cabecalhoDoCenario().textContent).toContain('De baixo para cima')
  })

  it('pelo "+ Adicionar ao pino" a ficha entra sem ligar a animação; o "Quando o jogador vê" liga com o padrão', () => {
    const onChange = vi.fn()
    render(undefined, onChange)
    const mais = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Adicionar ao pino')
    if (mais === undefined) throw new Error('sem o "+ Adicionar ao pino"')
    act(() => mais.click())
    const item = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((i) => i.textContent?.includes('Animação do cenário') === true)
    if (item === undefined) throw new Error('sem "Animação do cenário" no menu')
    act(() => item.click())
    expect(onChange).not.toHaveBeenCalled()
    const quando = seletor('Quando o jogador vê')
    expect(quando.value).toBe('nao')
    act(() => {
      quando.value = 'primeira'
      quando.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, quando: 'primeira' })
  })
})
