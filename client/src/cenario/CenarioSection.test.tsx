import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CenarioSection } from './CenarioSection'
import { CENARIO_DURACAO_NATURAL_S, CENARIO_PADRAO, MOVIMENTOS, cenarioComEstilo, type CenarioDoPino } from './catalogo'
import { esquecerEstilosDeCenarioDeFora, registrarEstiloDeCenario } from './estilosDeCenario'

/**
 * A SEÇÃO DO CENÁRIO na gramática do grimório: a prévia viva no topo (Assistir,
 * Ver grande, duração), Estilo com o "Procurar", a câmera só de ícone, os
 * efeitos que ligam e desligam, a duração e "Quando o jogador vê".
 */

let container: HTMLDivElement
let root: Root
const IMAGEM = 'data:image/png;base64,AAAA'

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // Movimento reduzido: o diálogo sai na hora e a prévia não abre áudio.
  vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta.includes('reduce'), addEventListener: () => undefined, removeEventListener: () => undefined }))
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  esquecerEstilosDeCenarioDeFora()
  vi.unstubAllGlobals()
})

const estiloFalso = { id: 'neve', nome: 'Neve caindo', duracaoNaturalS: 6, criar: () => ({ atualizar: () => {}, descartar: () => {} }) }

function campo(rotulo: string): HTMLElement {
  const label = Array.from(container.querySelectorAll('label')).find((l) => l.textContent === rotulo)
  const alvo = label?.htmlFor ? document.getElementById(label.htmlFor) : null
  if (alvo === null) throw new Error(`sem o campo "${rotulo}"`)
  return alvo
}

function seletor(rotulo: string): HTMLSelectElement {
  const alvo = campo(rotulo)
  if (!(alvo instanceof HTMLSelectElement)) throw new Error(`"${rotulo}" não é seletor`)
  return alvo
}

const opcoes = (rotulo: string) => Array.from(seletor(rotulo).options).map((o) => o.textContent)

function escolher(rotulo: string, valor: string) {
  const select = seletor(rotulo)
  act(() => {
    select.value = valor
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const nomeDe = (el: Element) => el.getAttribute('aria-label') ?? el.getAttribute('title') ?? (el.textContent ?? '').trim()
const achar = (nome: string) => Array.from(document.querySelectorAll('button')).find((b) => nomeDe(b) === nome || (b.textContent ?? '').trim() === nome)
const temBotao = (nome: string) => achar(nome) !== undefined

function botao(nome: string): HTMLButtonElement {
  const achado = achar(nome)
  if (!achado) throw new Error(`sem o botão "${nome}"`)
  return achado
}

const clicar = (nome: string) => act(() => botao(nome).click())
const radios = () => Array.from(container.querySelectorAll<HTMLElement>('[role="radio"]'))

function digitar(entrada: HTMLInputElement, texto: string) {
  const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    definir?.call(entrada, texto)
    entrada.dispatchEvent(new Event('input', { bubbles: true }))
  })
  act(() => {
    entrada.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  })
}

function outroMovimento() {
  const outro = MOVIMENTOS.find((m) => m.id !== CENARIO_PADRAO.movimento)
  if (outro === undefined) throw new Error('sem outro movimento')
  return outro
}

function render(cenario: CenarioDoPino | undefined, imagem: string | null = IMAGEM, onChange = vi.fn(), nome = '') {
  act(() => root.render(<CenarioSection cenario={cenario} imagem={imagem} nome={nome} onChange={onChange} />))
  return onChange
}

describe('CenarioSection', () => {
  it('pino sem imagem: só a nota, sem opções', () => {
    render(undefined, null)
    expect(container.textContent).toContain('Coloque uma imagem no pino para animar o cenário.')
    expect(container.querySelector('select')).toBeNull()
    expect(temBotao('Assistir')).toBe(false)
  })

  it('"Só da primeira vez" liga com o padrão; "Não, só o cartão" desliga', () => {
    const onChange = render(undefined)
    expect(seletor('Quando o jogador vê').value).toBe('nao')
    expect(temBotao('Assistir')).toBe(false)
    escolher('Quando o jogador vê', 'primeira')
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, quando: 'primeira' })
    render({ ...CENARIO_PADRAO, quando: 'sempre' }, IMAGEM, onChange)
    escolher('Quando o jogador vê', 'nao')
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('a câmera, só de ícone, e os efeitos gravam no pino', () => {
    const onChange = render(CENARIO_PADRAO)
    const outro = outroMovimento()
    expect(radios().map(nomeDe)).toEqual(MOVIMENTOS.map((m) => m.nome))
    act(() => radios().find((r) => nomeDe(r) === outro.nome)?.click())
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, movimento: outro.id })
    clicar('Névoa')
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, nevoa: !CENARIO_PADRAO.nevoa })
    expect(botao('Som do vento').getAttribute('aria-pressed')).toBe(String(CENARIO_PADRAO.som))
  })

  it('Estilo: Panorâmica e os estilos registrados, inclusive os que chegam com a ficha aberta', () => {
    render(CENARIO_PADRAO)
    expect(opcoes('Estilo')).toEqual(['Panorâmica'])
    act(() => registrarEstiloDeCenario(estiloFalso))
    expect(opcoes('Estilo')).toEqual(['Panorâmica', 'Neve caindo'])
  })

  it('estilo do pacote grava o id e esconde a câmera e os efeitos; duração e "quando" ficam; Panorâmica volta', () => {
    act(() => registrarEstiloDeCenario(estiloFalso))
    const onChange = render(CENARIO_PADRAO)
    escolher('Estilo', 'neve')
    expect(onChange).toHaveBeenLastCalledWith(cenarioComEstilo(CENARIO_PADRAO, 'neve'))
    const comEstilo = cenarioComEstilo(CENARIO_PADRAO, 'neve')
    render(comEstilo, IMAGEM, onChange)
    expect(radios()).toHaveLength(0)
    expect(temBotao('Névoa')).toBe(false)
    expect(campo('Duração (segundos)').getAttribute('placeholder')).toBe('6')
    expect(seletor('Quando o jogador vê').value).toBe(CENARIO_PADRAO.quando)
    escolher('Estilo', '')
    expect(onChange).toHaveBeenLastCalledWith(cenarioComEstilo(comEstilo, null))
  })

  it('id gravado que este app não tem: "Não instalado (id)", com a câmera da panorâmica que toca até chegar', () => {
    render({ ...CENARIO_PADRAO, estilo: 'chuva' })
    expect(opcoes('Estilo')).toEqual(['Panorâmica', 'Não instalado (chuva)'])
    expect(seletor('Estilo').value).toBe('chuva')
    expect(radios()).toHaveLength(MOVIMENTOS.length)
    expect(container.textContent).toContain('Este estilo ainda não chegou neste app.')
  })

  it('prévia: Assistir vira Parar e volta; mostra a duração; trocar a câmera toca', () => {
    render(CENARIO_PADRAO)
    expect(container.textContent).toContain('4,6 s')
    clicar('Assistir')
    expect(temBotao('Parar')).toBe(true)
    clicar('Parar')
    expect(temBotao('Assistir')).toBe(true)
    render({ ...CENARIO_PADRAO, movimento: outroMovimento().id })
    expect(temBotao('Parar')).toBe(true)
  })

  it('"Ver grande" abre a janela com o nome do local, tocando; Esc fecha e o foco volta', () => {
    render(CENARIO_PADRAO, IMAGEM, vi.fn(), 'Base da Marinha')
    const ver = botao('Ver grande')
    ver.focus()
    act(() => ver.click())
    const dialogo = document.querySelector('[role="dialog"]')
    if (dialogo === null) throw new Error('sem a janela')
    expect(dialogo.querySelector('h2')?.textContent).toBe('Animação do cenário · Base da Marinha')
    expect(Array.from(dialogo.querySelectorAll('button')).some((b) => (b.textContent ?? '').trim() === 'Parar')).toBe(true)
    expect(botao('Som').getAttribute('aria-pressed')).toBe('true')
    act(() => {
      dialogo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(ver)
  })

  it('duração: grava o número digitado mesmo quando é igual ao padrão; vazio volta a ser o padrão', () => {
    const onChange = render(CENARIO_PADRAO)
    const entrada = campo('Duração (segundos)')
    if (!(entrada instanceof HTMLInputElement)) throw new Error('duração não é campo de texto')
    digitar(entrada, String(CENARIO_DURACAO_NATURAL_S))
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, duracaoS: CENARIO_DURACAO_NATURAL_S })
    digitar(entrada, '')
    expect(onChange).toHaveBeenLastCalledWith({ ...CENARIO_PADRAO, duracaoS: undefined })
  })
})
