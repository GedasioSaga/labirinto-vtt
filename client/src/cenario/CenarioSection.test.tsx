import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CenarioSection } from './CenarioSection'
import { CENARIO_DURACAO_NATURAL_S, CENARIO_PADRAO, type CenarioDoPino } from './catalogo'
import { esquecerEstilosDeCenarioDeFora, registrarEstiloDeCenario } from './estilosDeCenario'

let container: HTMLDivElement
let root: Root
const IMAGEM = 'data:image/png;base64,AAAA'

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
})

const estiloFalso = { id: 'neve', nome: 'Neve caindo', duracaoNaturalS: 6, criar: () => ({ atualizar: () => {}, descartar: () => {} }) }

function seletorDeEstilo(): HTMLSelectElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === 'Estilo')
  const select = label?.htmlFor ? document.getElementById(label.htmlFor) : null
  if (!(select instanceof HTMLSelectElement)) throw new Error('sem o seletor "Estilo"')
  return select
}

const opcoesDoEstilo = () => Array.from(seletorDeEstilo().options).map((o) => o.textContent)

const botao = (texto: string) => {
  const achado = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === texto || (b.textContent ?? '').trim() === texto)
  if (!achado) throw new Error(`sem o botão "${texto}"`)
  return achado
}

function render(cenario: CenarioDoPino | undefined, imagem: string | null = IMAGEM, onChange = vi.fn()) {
  act(() => root.render(<CenarioSection cenario={cenario} imagem={imagem} onChange={onChange} />))
  return onChange
}

describe('CenarioSection', () => {
  it('pino sem imagem: só o aviso, sem opções', () => {
    render(undefined, null)
    expect(container.textContent).toContain('Coloque uma imagem no pino')
    expect(container.querySelector('[role="radio"]')).toBeNull()
  })

  it('"Só da primeira vez" liga com o padrão; "Não, só o cartão" desliga', () => {
    const onChange = render(undefined)
    expect(botao('Não, só o cartão').getAttribute('aria-checked')).toBe('true')
    act(() => botao('Só da primeira vez').click())
    expect(onChange).toHaveBeenLastCalledWith(CENARIO_PADRAO)
    render(CENARIO_PADRAO, IMAGEM, onChange)
    act(() => botao('Sempre').click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, quando: 'sempre' })
    act(() => botao('Não, só o cartão').click())
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('escolher movimento e desligar um efeito gravam no pino', () => {
    const onChange = render(CENARIO_PADRAO)
    act(() => botao('De cima para baixo').click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, movimento: 'desce' })
    const nevoa = Array.from(container.querySelectorAll('label')).find((l) => l.textContent?.startsWith('Névoa'))?.querySelector('input') as HTMLInputElement
    act(() => nevoa.click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, nevoa: false })
  })

  it('seletor "Estilo": Panorâmica e os estilos registrados, inclusive os que chegam com o painel aberto', () => {
    render(CENARIO_PADRAO)
    expect(opcoesDoEstilo()).toEqual(['Panorâmica'])
    expect(seletorDeEstilo().value).toBe('')
    act(() => {
      registrarEstiloDeCenario(estiloFalso)
    })
    expect(opcoesDoEstilo()).toEqual(['Panorâmica', 'Neve caindo'])
  })

  it('escolher um estilo grava o id e esconde o que é só da panorâmica; duração e "quando" ficam', () => {
    registrarEstiloDeCenario(estiloFalso)
    const onChange = render(CENARIO_PADRAO)
    act(() => {
      seletorDeEstilo().value = 'neve'
      seletorDeEstilo().dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, estilo: 'neve' })
    render({ ...CENARIO_PADRAO, estilo: 'neve' }, IMAGEM, onChange)
    for (const some of ['Névoa', 'Raios de sol', 'Partículas (pólen e folhas)', 'Som do vento']) expect(container.textContent).not.toContain(some)
    expect(container.querySelector('.lb-cenario-secao__movimentos')).toBeNull()
    expect(container.textContent).toContain('Duração (segundos)')
    expect(container.querySelector<HTMLInputElement>('.lb-cenario-secao__duracao input')?.placeholder).toBe('6')
    expect(botao('Sempre')).toBeDefined()
    act(() => botao('Assistir Neve caindo').click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Neve caindo')
  })

  it('voltar para "Panorâmica" tira o campo e devolve os controles', () => {
    registrarEstiloDeCenario(estiloFalso)
    const onChange = render({ ...CENARIO_PADRAO, estilo: 'neve' })
    act(() => {
      seletorDeEstilo().value = ''
      seletorDeEstilo().dispatchEvent(new Event('change', { bubbles: true }))
    })
    const gravado: unknown = onChange.mock.lastCall?.[0]
    expect(gravado).toEqual(CENARIO_PADRAO)
    expect(gravado).not.toHaveProperty('estilo')
  })

  it('id gravado que este app não tem: "Não instalado (id)", com os controles da panorâmica que toca até chegar', () => {
    render({ ...CENARIO_PADRAO, estilo: 'chuva-acida' })
    expect(opcoesDoEstilo()).toEqual(['Panorâmica', 'Não instalado (chuva-acida)'])
    expect(seletorDeEstilo().value).toBe('chuva-acida')
    expect(container.textContent).toContain('ainda não chegou')
    expect(container.textContent).toContain('Névoa')
  })

  it('o botão de assistir abre a janela da animação', () => {
    render(CENARIO_PADRAO)
    act(() => botao('Assistir Aproximar').click())
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Aproximar')
    act(() => botao('Fechar').click())
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  // Antes, digitar o próprio padrão gravava "ausente": quando o padrão mudou de 12 para 5 s, quem escolheu 12 s de propósito passou a tocar 5.
  it('duração: grava o número digitado mesmo quando é igual ao padrão; vazio volta a ser o padrão', () => {
    const onChange = render(CENARIO_PADRAO)
    const campo = container.querySelector<HTMLInputElement>('.lb-cenario-secao__duracao input')
    if (!campo) throw new Error('sem o campo de duração')
    const digitar = (valor: string) => {
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(campo, valor)
        campo.dispatchEvent(new Event('input', { bubbles: true }))
      })
      act(() => campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    }
    digitar(String(CENARIO_DURACAO_NATURAL_S))
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, duracaoS: CENARIO_DURACAO_NATURAL_S })
    expect(campo.value).toBe(String(CENARIO_DURACAO_NATURAL_S))
    digitar('12')
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, duracaoS: 12 })
    digitar('')
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, duracaoS: undefined })
  })
})
