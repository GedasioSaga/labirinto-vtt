import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classificarDicas } from '../lib/dicaDoPainel'
import {
  AvisoParedePresa,
  PAREDES_DO_DESENHO_PADRAO,
  ParedesAoRedorControls,
  type ParedesAoRedorControlsProps,
  type ParedesDoDesenho,
} from './ParedesAoRedorControls'

/**
 * "Paredes ao redor" no painel do desenho. Pedido literal: "nas propriedades
 * do pincel eu quero que tenha a opção criar paredes ao redor e ter a opção de
 * criar parede invisivel (que não da para passar), e as paredes quero que der
 * para trocar de cor e que de para colocar opção de ver e não passar, e de
 * poder não ver." Aqui só a parte visual: o que cada controle mostra e o patch
 * que ele manda. Gerar, sincronizar e soltar as paredes é de quem plugar.
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
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const LIGADO: ParedesDoDesenho = { ativo: true, invisivel: false, passagem: 'bloqueia' }

function montar(props: Partial<ParedesAoRedorControlsProps> = {}) {
  const completas = {
    valor: undefined,
    quantidade: 0,
    onChange: vi.fn<(patch: Partial<ParedesDoDesenho>) => void>(),
    onSoltar: vi.fn<() => void>(),
    ...props,
  }
  act(() => root.render(<ParedesAoRedorControls {...completas} />))
  return completas
}

/** O valor de verdade, como o painel vai ligar: cada patch mescla no desenho. */
function Controlado({ inicial, quantidade = 3 }: { inicial?: ParedesDoDesenho; quantidade?: number }) {
  const [valor, setValor] = useState(inicial)
  return (
    <ParedesAoRedorControls
      valor={valor}
      quantidade={valor?.ativo ? quantidade : 0}
      onChange={(patch) => setValor((antes) => ({ ...PAREDES_DO_DESENHO_PADRAO, ...antes, ...patch }))}
      onSoltar={() => setValor((antes) => (antes ? { ...antes, ativo: false } : antes))}
    />
  )
}

function interruptor(): HTMLInputElement {
  const caixa = container.querySelector<HTMLInputElement>('label.lb-switch input[type="checkbox"]')
  if (!caixa) throw new Error('interruptor "Paredes ao redor" ausente')
  return caixa
}

const radios = () => [...container.querySelectorAll<HTMLButtonElement>('[role="radio"]')]

function radio(nome: string): HTMLButtonElement {
  const achado = radios().find((botao) => botao.textContent?.trim() === nome)
  if (!achado) throw new Error(`rádio "${nome}" ausente`)
  return achado
}

const botoes = (nome: string) =>
  [...container.querySelectorAll<HTMLButtonElement>('button')].filter((botao) => botao.textContent?.trim() === nome)

function botao(nome: string): HTMLButtonElement {
  const [achado] = botoes(nome)
  if (!achado) throw new Error(`botão "${nome}" ausente`)
  return achado
}

const amostraDeCor = () => container.querySelector<HTMLInputElement>('input[type="color"]')
const bloco = () => container.querySelector<HTMLElement>('.lb-paredes__revela')

/** O texto que o controle aponta em `aria-describedby` (o que o leitor de tela lê junto). */
function descricao(controle: Element): string {
  return (controle.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
}

/** O mouse: o navegador manda `pointerdown` antes do clique. */
function clicarComPonteiro(alvo: HTMLElement) {
  act(() => {
    alvo.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    alvo.click()
  })
}

/** O teclado: a tecla desce no controle focado e o navegador gera o clique. */
function acionarPeloTeclado(alvo: HTMLElement, key = ' ') {
  act(() => {
    alvo.focus()
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    alvo.click()
  })
}

describe('ParedesAoRedorControls — o que aparece e o que cada controle manda', () => {
  it('desligado mostra só o interruptor "Paredes ao redor", desmarcado', () => {
    montar({ valor: undefined })
    expect(interruptor().closest('label')?.textContent).toBe('Paredes ao redor')
    expect(interruptor().checked).toBe(false)
    expect(radios()).toHaveLength(0)
    expect(amostraDeCor()).toBeNull()
    expect(botoes('Soltar paredes')).toHaveLength(0)

    // Desligado depois de já ter sido configurado: idem, nada do bloco fica.
    montar({ valor: { ...LIGADO, ativo: false, invisivel: true, passagem: 'janela' } })
    expect(interruptor().checked).toBe(false)
    expect(radios()).toHaveLength(0)
    expect(botoes('Soltar paredes')).toHaveLength(0)
  })

  it('ligar um desenho que nunca teve paredes manda os padrões: visível e "não vê nem passa"', () => {
    const props = montar({ valor: undefined })
    act(() => interruptor().click())
    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith({ ativo: true, invisivel: false, passagem: 'bloqueia' })
    expect(PAREDES_DO_DESENHO_PADRAO).toEqual({ ativo: true, invisivel: false, passagem: 'bloqueia' })
  })

  it('religar devolve o que o mestre já tinha escolhido; desligar manda só ativo: false', () => {
    const religar = montar({ valor: { ativo: false, invisivel: true, passagem: 'janela', cor: '#ff0000' } })
    act(() => interruptor().click())
    expect(religar.onChange).toHaveBeenCalledWith({ ativo: true })

    const desligar = montar({ valor: LIGADO, quantidade: 3 })
    act(() => interruptor().click())
    expect(desligar.onChange).toHaveBeenCalledWith({ ativo: false })
  })

  it('ligado mostra aparência, cor, passagem, quantas paredes estão presas e o Soltar', () => {
    montar({ valor: LIGADO, quantidade: 3 })
    expect(interruptor().checked).toBe(true)
    expect(container.querySelector('[role="radiogroup"][aria-label="Aparência das paredes"]')).not.toBeNull()
    expect(container.querySelector('[role="radiogroup"][aria-label="Passagem pelas paredes"]')).not.toBeNull()
    expect(radio('Visível').getAttribute('aria-checked')).toBe('true')
    expect(radio('Invisível').getAttribute('aria-checked')).toBe('false')
    expect(radio('Não vê nem passa').getAttribute('aria-checked')).toBe('true')
    expect(radio('Vê mas não passa').getAttribute('aria-checked')).toBe('false')
    // Sem cor própria, a amostra mostra a cor padrão da parede (WALL_COLOR).
    expect(amostraDeCor()?.value).toBe('#d8d2c4')
    expect(container.textContent).toContain('3 paredes presas a este desenho')
    expect(botao('Soltar paredes').disabled).toBe(false)
  })

  it('"Invisível" tira a Cor da tela; "Visível" a devolve; repetir a escolha não manda nada', () => {
    const invisivel = montar({ valor: { ...LIGADO, invisivel: true } })
    expect(radio('Invisível').getAttribute('aria-checked')).toBe('true')
    expect(amostraDeCor()).toBeNull()
    expect(botoes('Padrão')).toHaveLength(0)
    act(() => radio('Invisível').click())
    expect(invisivel.onChange).not.toHaveBeenCalled()
    act(() => radio('Visível').click())
    expect(invisivel.onChange).toHaveBeenCalledWith({ invisivel: false })

    const visivel = montar({ valor: LIGADO })
    expect(amostraDeCor()).not.toBeNull()
    act(() => radio('Invisível').click())
    expect(visivel.onChange).toHaveBeenCalledWith({ invisivel: true })
  })

  it('"Invisível" explica o que o jogador e o mestre veem, na descrição do próprio botão', () => {
    montar({ valor: LIGADO })
    expect(descricao(radio('Invisível'))).toMatch(/jogador não vê a parede, mas não passa/)
    expect(descricao(radio('Invisível'))).toMatch(/tracejada/)
  })

  it('trocar a passagem manda só a passagem', () => {
    const props = montar({ valor: LIGADO, quantidade: 2 })
    act(() => radio('Vê mas não passa').click())
    expect(props.onChange).toHaveBeenCalledTimes(1)
    expect(props.onChange).toHaveBeenCalledWith({ passagem: 'janela' })
    act(() => radio('Não vê nem passa').click())
    expect(props.onChange, 'a escolha já marcada não manda patch').toHaveBeenCalledTimes(1)

    montar({ valor: { ...LIGADO, passagem: 'janela' } })
    expect(radio('Vê mas não passa').getAttribute('aria-checked')).toBe('true')
    expect(radio('Não vê nem passa').getAttribute('aria-checked')).toBe('false')
  })

  it('escolher a cor manda o hex; "Padrão" só aparece com cor própria e manda cor: undefined', () => {
    const semCor = montar({ valor: LIGADO })
    expect(botoes('Padrão')).toHaveLength(0)
    const definirValor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      const amostra = amostraDeCor()
      if (!amostra) throw new Error('amostra de cor ausente')
      definirValor?.call(amostra, '#ff0000')
      amostra.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(semCor.onChange).toHaveBeenCalledWith({ cor: '#ff0000' })

    const comCor = montar({ valor: { ...LIGADO, cor: '#336699' } })
    expect(amostraDeCor()?.value).toBe('#336699')
    act(() => botao('Padrão').click())
    expect(comCor.onChange).toHaveBeenCalledWith({ cor: undefined })
  })

  it('a contagem fala português: uma parede, várias com milhar, e Soltar chama onSoltar', () => {
    montar({ valor: LIGADO, quantidade: 1 })
    expect(container.textContent).toContain('1 parede presa a este desenho')
    montar({ valor: LIGADO, quantidade: 1200 })
    expect(container.textContent).toContain('1.200 paredes presas a este desenho')

    const props = montar({ valor: LIGADO, quantidade: 3 })
    act(() => botao('Soltar paredes').click())
    expect(props.onSoltar).toHaveBeenCalledTimes(1)
    expect(props.onChange).not.toHaveBeenCalled()
    expect(descricao(botao('Soltar paredes'))).toMatch(/Viram paredes comuns/)
  })

  it('sem parede presa, o Soltar fica apagado e a linha de cima diz por quê', () => {
    const props = montar({ valor: LIGADO, quantidade: 0 })
    expect(container.textContent).toContain('Nenhuma parede presa a este desenho')
    expect(botao('Soltar paredes').disabled).toBe(true)
    expect(descricao(botao('Soltar paredes'))).toBe('Nenhuma parede presa a este desenho')
    act(() => botao('Soltar paredes').click())
    expect(props.onSoltar).not.toHaveBeenCalled()
  })

  it('disabled apaga todos os controles e escreve o motivo sob o interruptor', () => {
    const props = montar({
      valor: { ...LIGADO, cor: '#ff0000' },
      quantidade: 3,
      disabled: true,
      motivoDesabilitado: 'O desenho está travado.',
    })
    expect(interruptor().disabled).toBe(true)
    expect(descricao(interruptor())).toBe('O desenho está travado.')
    expect(radios().every((opcao) => opcao.disabled)).toBe(true)
    expect(amostraDeCor()?.disabled).toBe(true)
    expect(botoes('Padrão')).toHaveLength(0)
    expect(botao('Soltar paredes').disabled).toBe(true)
    act(() => radio('Vê mas não passa').click())
    act(() => interruptor().click())
    expect(props.onChange).not.toHaveBeenCalled()
  })
})

describe('ParedesAoRedorControls dentro do painel (dicas sob demanda)', () => {
  it('as três explicações viram o "?" da linha certa, como as das outras seções', () => {
    container.classList.add('lb-inspector__body')
    montar({ valor: LIGADO, quantidade: 3 })
    const { sobDemanda, linhas } = classificarDicas(container)
    expect(sobDemanda).toHaveLength(3)
    const linhaDa = (frase: RegExp) => [...linhas].find(([, dicas]) => dicas.some((dica) => frase.test(dica.textContent ?? '')))?.[0]
    expect(linhaDa(/presas ao desenho/)).toBe(interruptor().closest('label.lb-switch'))
    expect(linhaDa(/jogador não vê a parede/)?.querySelector(':scope > .lb-label')?.textContent).toBe('Aparência')
    expect(linhaDa(/Viram paredes comuns/)).toBe(botao('Soltar paredes').closest('.lb-field'))
  })
})

describe('ParedesAoRedorControls — abrir e fechar', () => {
  it('pelo teclado o bloco aparece e some de uma vez, sem movimento', () => {
    act(() => root.render(<Controlado />))
    acionarPeloTeclado(interruptor())
    expect(radios()).toHaveLength(4)
    expect(bloco()?.hasAttribute('data-movimento')).toBe(false)
    acionarPeloTeclado(interruptor())
    expect(radios()).toHaveLength(0)
    expect(bloco()).toBeNull()
  })

  it('pelo ponteiro abre com movimento; fechando, fica na árvore sem responder até a transição acabar', () => {
    vi.useFakeTimers()
    act(() => root.render(<Controlado />))
    clicarComPonteiro(interruptor())
    expect(bloco()?.getAttribute('data-movimento')).toBe('abrindo')
    act(() => vi.advanceTimersByTime(400))
    expect(bloco()?.hasAttribute('data-movimento')).toBe(false)

    clicarComPonteiro(interruptor())
    expect(bloco()?.getAttribute('data-movimento')).toBe('fechando')
    expect(bloco()?.hasAttribute('inert')).toBe(true)
    act(() => vi.advanceTimersByTime(400))
    expect(bloco()).toBeNull()
  })

  it('a linha da Cor some e volta com o mesmo movimento quando a aparência troca', () => {
    vi.useFakeTimers()
    act(() => root.render(<Controlado inicial={LIGADO} />))
    const linhaDaCor = () => amostraDeCor()?.closest<HTMLElement>('.lb-paredes__revela') ?? null
    expect(linhaDaCor()?.hasAttribute('data-movimento')).toBe(false)
    clicarComPonteiro(radio('Invisível'))
    expect(linhaDaCor()?.getAttribute('data-movimento')).toBe('fechando')
    act(() => vi.advanceTimersByTime(400))
    expect(amostraDeCor()).toBeNull()
    clicarComPonteiro(radio('Visível'))
    expect(linhaDaCor()?.getAttribute('data-movimento')).toBe('abrindo')
  })

  it('com movimento reduzido no sistema, nem o ponteiro anima', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    act(() => root.render(<Controlado />))
    clicarComPonteiro(interruptor())
    expect(bloco()?.hasAttribute('data-movimento')).toBe(false)
    clicarComPonteiro(interruptor())
    expect(bloco()).toBeNull()
  })

  it('o painel abrir com as paredes já ligadas não anima (só o gesto do mestre anima)', () => {
    montar({ valor: LIGADO, quantidade: 3 })
    expect(bloco()?.hasAttribute('data-movimento')).toBe(false)
  })

  it('Soltar pelo teclado fecha o bloco e o foco volta ao interruptor, não ao <body>', () => {
    act(() => root.render(<Controlado inicial={LIGADO} />))
    acionarPeloTeclado(botao('Soltar paredes'), 'Enter')
    expect(bloco()).toBeNull()
    expect(document.activeElement).toBe(interruptor())
  })
})

describe('ParedesAoRedorControls — CSS do movimento', () => {
  /** O CSS como está no disco: o Vitest troca `.css` importado por string vazia. */
  async function lerCss(): Promise<string> {
    const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
    const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
    const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
    return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ParedesAoRedorControls.css'), 'utf8')
  }

  it('usa os tempos do tema, fecha mais rápido que abre e desliga a transição com movimento reduzido', async () => {
    const css = await lerCss()
    expect(css).toMatch(/grid-template-rows var\(--lb-motion-base\) var\(--lb-motion-ease\)/)
    expect(css).toMatch(/\[data-movimento='fechando'\][^}]*transition-duration: var\(--lb-motion-fast\)/)
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.lb-paredes__revela\[data-movimento\]\s*\{\s*transition: none;/)
    expect(css, 'nenhuma duração solta: só os tokens do tema').not.toMatch(/\d+ms/)
  })

  it('o item da grade (o recorte) não tem padding: fechado, o bloco ocupa zero e não pula ao sair', async () => {
    const css = await lerCss()
    const recorte = /\.lb-paredes__recorte\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(recorte).toMatch(/min-height: 0/)
    expect(recorte).not.toMatch(/padding/)
    expect(/\.lb-paredes__miolo\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/padding-top: var\(--lb-space-3\)/)
  })
})

describe('AvisoParedePresa', () => {
  it('diz de qual desenho é a parede, e os dois botões chamam o que dizem', () => {
    const onSelecionarDesenho = vi.fn<() => void>()
    const onSoltar = vi.fn<() => void>()
    act(() => root.render(<AvisoParedePresa nomeDoDesenho="Retângulo 2" onSelecionarDesenho={onSelecionarDesenho} onSoltar={onSoltar} />))
    expect(container.textContent).toContain('Esta parede é do desenho Retângulo 2 e muda junto com ele.')
    act(() => botao('Selecionar desenho').click())
    expect(onSelecionarDesenho).toHaveBeenCalledTimes(1)
    expect(onSoltar).not.toHaveBeenCalled()
    act(() => botao('Soltar paredes').click())
    expect(onSoltar).toHaveBeenCalledTimes(1)
  })

  it('sem nome, a frase não fica com buraco', () => {
    act(() => root.render(<AvisoParedePresa nomeDoDesenho="   " onSelecionarDesenho={vi.fn()} onSoltar={vi.fn()} />))
    expect(container.textContent).toContain('Esta parede é de um desenho e muda junto com ele.')
  })
})
