import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CampoChips, type OpcaoDeChip } from './CampoChips'
import { CampoCor } from './CampoCor'
import { CampoFaixa } from './CampoFaixa'
import { CampoLiga } from './CampoLiga'
import { CampoNum, type CampoNumProps } from './CampoNum'
import { CampoSeg, type OpcaoDoSeg } from './CampoSeg'
import { CampoSel, CampoTexto } from './CampoTexto'

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

const montar = (no: ReactNode) => act(() => root.render(no))
const um = <T extends Element>(seletor: string): T => {
  const achado = container.querySelector<T>(seletor)
  if (!achado) throw new Error(`não achei ${seletor}`)
  return achado
}
const todos = (seletor: string) => Array.from(container.querySelectorAll<HTMLElement>(seletor))
const nomePorId = (el: Element, atributo: string) => document.getElementById(el.getAttribute(atributo) ?? '')?.textContent

function teclar(el: Element, key: string, extra: KeyboardEventInit = {}): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }))
  })
}

/** Troca o valor como o teclado faria: o setter nativo e o evento `input` que o React escuta. */
function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

type Formato = 'quad' | 'hex' | 'tri'
const FORMATOS: OpcaoDoSeg<Formato>[] = [
  { valor: 'quad', rotulo: 'Quadrada' },
  { valor: 'hex', rotulo: 'Hexagonal' },
  { valor: 'tri', rotulo: 'Triangular' },
]

function SegControlado({ aoMudar }: { aoMudar?: (v: string) => void }) {
  const [valor, setValor] = useState<Formato>('quad')
  return (
    <CampoSeg
      rotulo="Formato"
      opcoes={FORMATOS}
      valor={valor}
      onChange={(novo) => {
        setValor(novo)
        aoMudar?.(novo)
      }}
    />
  )
}

describe('CampoSeg (radiogroup)', () => {
  it('é um radiogroup com o nome do rótulo, e só a opção escolhida entra no Tab', () => {
    montar(<SegControlado />)
    const grupo = um('[role="radiogroup"]')
    expect(nomePorId(grupo, 'aria-labelledby')).toBe('Formato')
    const radios = todos('[role="radio"]')
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false'])
    expect(radios.map((r) => r.tabIndex)).toEqual([0, -1, -1])
    expect(radios.map((r) => r.textContent)).toEqual(['Quadrada', 'Hexagonal', 'Triangular'])
  })

  it('setas levam o foco à vizinha e já a escolhem, dando a volta nas pontas', () => {
    const aoMudar = vi.fn()
    montar(<SegControlado aoMudar={aoMudar} />)
    const radios = () => todos('[role="radio"]')
    act(() => radios()[0].focus())
    teclar(radios()[0], 'ArrowRight')
    expect(radios()[1].getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(radios()[1])
    expect(radios().map((r) => r.tabIndex)).toEqual([-1, 0, -1])
    teclar(radios()[1], 'ArrowDown')
    teclar(radios()[2], 'ArrowRight')
    expect(document.activeElement).toBe(radios()[0])
    teclar(radios()[0], 'ArrowLeft')
    expect(radios()[2].getAttribute('aria-checked')).toBe('true')
    teclar(radios()[2], 'ArrowUp')
    expect(aoMudar.mock.calls.map((c) => c[0])).toEqual(['hex', 'tri', 'quad', 'tri', 'hex'])
  })

  it('opção só de ícone leva o rótulo como nome; sem rótulo visível o grupo usa nomeAcessivel', () => {
    montar(
      <CampoSeg
        nomeAcessivel="Alinhamento"
        opcoes={[
          { valor: 'esq', rotulo: 'À esquerda', icone: <svg />, soIcone: true },
          { valor: 'meio', rotulo: 'No meio', icone: <svg />, soIcone: true },
        ]}
        valor="meio"
        onChange={vi.fn()}
      />,
    )
    expect(um('[role="radiogroup"]').getAttribute('aria-label')).toBe('Alinhamento')
    expect(todos('[role="radio"]').map((r) => r.getAttribute('aria-label'))).toEqual(['À esquerda', 'No meio'])
  })
})

describe('CampoLiga (switch)', () => {
  it('é um switch nativo com nome do rótulo e a ajuda como descrição; clicar alterna', () => {
    const onChange = vi.fn()
    montar(<CampoLiga rotulo="Mostrar grade" ajuda="Só o mestre vê." ligado={false} onChange={onChange} />)
    const liga = um<HTMLButtonElement>('[role="switch"]')
    // <button> nativo: Espaço e Enter acionam o clique no navegador
    expect(liga.tagName).toBe('BUTTON')
    expect(liga.type).toBe('button')
    expect(liga.getAttribute('aria-checked')).toBe('false')
    expect(nomePorId(liga, 'aria-labelledby')).toBe('Mostrar grade')
    expect(nomePorId(liga, 'aria-describedby')).toBe('Só o mestre vê.')
    act(() => liga.click())
    expect(onChange).toHaveBeenCalledWith(true)
    montar(<CampoLiga rotulo="Mostrar grade" ligado onChange={onChange} />)
    expect(liga.getAttribute('aria-checked')).toBe('true')
    expect(liga.hasAttribute('aria-describedby')).toBe(false)
    act(() => liga.click())
    expect(onChange).toHaveBeenLastCalledWith(false)
  })
})

function NumControlado({
  inicial,
  aoMudar,
  ...resto
}: { inicial: number; aoMudar: (v: number) => void } & Pick<CampoNumProps, 'min' | 'max' | 'passo' | 'id' | 'nome' | 'decimais'>) {
  const [valor, setValor] = useState(inicial)
  return (
    <CampoNum
      rotulo="Largura"
      unidade="casas"
      valor={valor}
      onChange={(novo) => {
        setValor(novo)
        aoMudar(novo)
      }}
      {...resto}
    />
  )
}

describe('CampoNum (− / + e digitação)', () => {
  const campo = () => um<HTMLInputElement>('[role="spinbutton"]')

  it('grupo com o nome do rótulo; o miolo é um spinbutton com valor, limites e unidade', () => {
    montar(<NumControlado inicial={60} min={10} max={400} aoMudar={vi.fn()} />)
    expect(nomePorId(um('.gr-num[role="group"]'), 'aria-labelledby')).toBe('Largura')
    expect(campo().labels?.[0]?.textContent).toBe('Largura')
    expect(campo().getAttribute('aria-valuenow')).toBe('60')
    expect(campo().getAttribute('aria-valuemin')).toBe('10')
    expect(campo().getAttribute('aria-valuemax')).toBe('400')
    expect(campo().getAttribute('aria-valuetext')).toBe('60 casas')
    expect(todos('.gr-num__passo').map((b) => b.getAttribute('aria-label'))).toEqual(['Diminuir Largura', 'Aumentar Largura'])
  })

  it('− e + andam um passo e param no limite sem avisar mudança', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={399} max={400} aoMudar={aoMudar} />)
    const [menos, mais] = todos('.gr-num__passo')
    act(() => mais.click())
    act(() => mais.click())
    expect(campo().value).toBe('400')
    act(() => menos.click())
    expect(aoMudar.mock.calls.map((c) => c[0])).toEqual([400, 399])
  })

  it('digitar só vale ao confirmar (Enter ou sair do campo) e passa pelos limites', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={60} min={10} max={400} aoMudar={aoMudar} />)
    act(() => campo().focus())
    digitar(campo(), '12')
    expect(campo().value).toBe('12')
    expect(aoMudar).not.toHaveBeenCalled()
    teclar(campo(), 'Enter')
    expect(aoMudar).toHaveBeenLastCalledWith(12)
    digitar(campo(), '9000')
    act(() => campo().blur())
    expect(aoMudar).toHaveBeenLastCalledWith(400)
    expect(campo().value).toBe('400')
  })

  it('texto que não é número volta ao valor de antes; Esc desiste do que foi digitado', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={60} aoMudar={aoMudar} />)
    act(() => campo().focus())
    digitar(campo(), 'abc')
    teclar(campo(), 'Enter')
    expect(campo().value).toBe('60')
    digitar(campo(), '77')
    teclar(campo(), 'Escape')
    expect(campo().value).toBe('60')
    expect(aoMudar).not.toHaveBeenCalled()
  })

  it('setas, PageUp/PageDown e Home/End andam como num spinbutton', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={50} min={0} max={100} aoMudar={aoMudar} />)
    for (const tecla of ['ArrowUp', 'PageUp', 'ArrowDown', 'PageDown', 'End', 'Home']) teclar(campo(), tecla)
    expect(aoMudar.mock.calls.map((c) => c[0])).toEqual([51, 61, 60, 50, 100, 0])
  })

  it('aceita vírgula decimal e mostra com vírgula, sem resto de conta de ponto flutuante', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={1} passo={0.1} aoMudar={aoMudar} />)
    digitar(campo(), '1,2')
    teclar(campo(), 'Enter')
    teclar(campo(), 'ArrowUp')
    expect(aoMudar.mock.calls.map((c) => c[0])).toEqual([1.2, 1.3])
    expect(campo().value).toBe('1,3')
  })

  it('id e nome dos passos vêm de quem monta; sem eles, um id gerado e o rótulo', () => {
    montar(<NumControlado inicial={4} id="lb-campo-teste" nome="a largura" aoMudar={vi.fn()} />)
    expect(campo().id).toBe('lb-campo-teste')
    expect(campo().labels?.[0]?.textContent).toBe('Largura')
    expect(todos('.gr-num__passo').map((b) => b.getAttribute('aria-label'))).toEqual(['Diminuir a largura', 'Aumentar a largura'])
  })

  it('fora do passo, o primeiro − ou + cai no múltiplo mais perto daquele lado', () => {
    const aoMudar = vi.fn()
    montar(<CampoNum rotulo="Largura" valor={4.37} passo={0.5} decimais={2} onChange={aoMudar} />)
    const [menos, mais] = todos('.gr-num__passo')
    act(() => mais.click())
    act(() => menos.click())
    teclar(campo(), 'ArrowUp')
    expect(aoMudar.mock.calls.map((c) => c[0])).toEqual([4.5, 4, 4.5])
  })

  it('decimais: mostra duas casas e guarda o que se digitou, sem arredondar para as do passo', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={4.371234} passo={0.5} decimais={2} aoMudar={aoMudar} />)
    expect(campo().value).toBe('4,37')
    digitar(campo(), '6,25')
    teclar(campo(), 'Enter')
    expect(aoMudar).toHaveBeenLastCalledWith(6.25)
    digitar(campo(), '6,257')
    teclar(campo(), 'Enter')
    expect(aoMudar).toHaveBeenLastCalledWith(6.257)
    expect(campo().value).toBe('6,26')
  })

  it('no limite, o passo daquele lado fica aria-disabled e não faz nada', () => {
    const aoMudar = vi.fn()
    montar(<NumControlado inicial={0.25} min={0.25} max={20} passo={0.5} decimais={2} aoMudar={aoMudar} />)
    const [menos, mais] = todos('.gr-num__passo')
    expect(menos.getAttribute('aria-disabled')).toBe('true')
    expect(mais.hasAttribute('aria-disabled')).toBe(false)
    act(() => menos.click())
    expect(aoMudar).not.toHaveBeenCalled()
    act(() => mais.click())
    expect(aoMudar).toHaveBeenLastCalledWith(0.5)
    expect(menos.hasAttribute('aria-disabled')).toBe(false)
  })
})

describe('CampoFaixa (deslizante)', () => {
  it('range nativo com rótulo, o número e a unidade ao lado, e muda durante o arrasto', () => {
    const onChange = vi.fn()
    montar(<CampoFaixa rotulo="Opacidade" valor={4} min={0} max={100} unidade="%" onChange={onChange} />)
    const faixa = um<HTMLInputElement>('input[type="range"]')
    expect(faixa.labels?.[0]?.textContent).toBe('Opacidade')
    expect([faixa.min, faixa.max, faixa.step, faixa.value]).toEqual(['0', '100', '1', '4'])
    expect(faixa.getAttribute('aria-valuetext')).toBe('4 %')
    expect(um('output').textContent).toBe('4 %')
    digitar(faixa, '40')
    expect(onChange).toHaveBeenCalledWith(40)
  })
})

describe('CampoFaixa com formatar', () => {
  it('o texto formatado manda no output e no aria-valuetext', () => {
    montar(<CampoFaixa rotulo="Tamanho" valor={1.5} min={0.5} max={3} passo={0.25} unidade="x" formatar={(v) => `${String(v).replace('.', ',')}x`} onChange={() => {}} />)
    expect(um('output').textContent).toBe('1,5x')
    expect(um<HTMLInputElement>('input[type="range"]').getAttribute('aria-valuetext')).toBe('1,5x')
  })

  it('falar troca só o que o leitor de tela ouve; id e desativado vêm de quem monta', () => {
    montar(<CampoFaixa rotulo="Curva" id="lb-faixa-teste" valor={-60} min={-90} max={90} desativado formatar={(v) => `${Math.abs(v)}°`} falar={(v) => `${Math.abs(v)} graus`} onChange={() => {}} />)
    const faixa = um<HTMLInputElement>('#lb-faixa-teste')
    expect(faixa.labels?.[0]?.textContent).toBe('Curva')
    expect(um('output').textContent).toBe('60°')
    expect(faixa.getAttribute('aria-valuetext')).toBe('60 graus')
    expect(faixa.disabled).toBe(true)
  })
})

describe('CampoCor com onPadrao e extra', () => {
  it('"Cor padrão" chama onPadrao (não onChange) e o extra mora dentro da paleta', () => {
    const onChange = vi.fn()
    const onPadrao = vi.fn()
    montar(<CampoCor rotulo="Cor" opcoes={[{ valor: '#ffffff' }]} valor="" onChange={onChange} onPadrao={onPadrao} extra={<input type="color" aria-label="Outra" />} />)
    expect(um('.gr-cores').querySelector('input[type="color"]')).not.toBeNull()
    act(() => um<HTMLButtonElement>('.gr-bt').click())
    expect(onPadrao).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('CampoCor, CampoChips, CampoTexto e CampoSel', () => {
  it('cores: radiogroup com nome falado, escolha sem diferença de maiúscula, setas e "Cor padrão"', () => {
    const onChange = vi.fn()
    montar(
      <CampoCor
        rotulo="Cor"
        opcoes={[{ valor: '#ffffff', nome: 'Branco' }, { valor: '#d6d0c2' }]}
        valor="#FFFFFF"
        padrao="#ffffff"
        onChange={onChange}
      />,
    )
    const cores = todos('[role="radio"]')
    expect(cores.map((c) => c.getAttribute('aria-label'))).toEqual(['Branco', 'Cor #d6d0c2'])
    expect(cores.map((c) => c.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    teclar(cores[0], 'ArrowRight')
    expect(onChange).toHaveBeenLastCalledWith('#d6d0c2')
    act(() => um<HTMLButtonElement>('.gr-bt').click())
    expect(onChange).toHaveBeenLastCalledWith('#ffffff')
  })

  it('chips: grupo de botões que ligam e desligam (aria-pressed)', () => {
    const onChange = vi.fn()
    const opcoes: OpcaoDeChip<'luz' | 'som'>[] = [
      { valor: 'luz', rotulo: 'Luz' },
      { valor: 'som', rotulo: 'Som' },
    ]
    montar(<CampoChips rotulo="Efeitos" opcoes={opcoes} valores={['luz']} onChange={onChange} />)
    expect(nomePorId(um('[role="group"]'), 'aria-labelledby')).toBe('Efeitos')
    const [luz, som] = todos('.gr-chip')
    expect([luz.getAttribute('aria-pressed'), som.getAttribute('aria-pressed')]).toEqual(['true', 'false'])
    act(() => som.click())
    expect(onChange).toHaveBeenLastCalledWith(['luz', 'som'])
    act(() => luz.click())
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('texto e lista: o rótulo é <label> do campo; a lista devolve o valor da opção', () => {
    const aoDigitar = vi.fn()
    const aoEscolher = vi.fn()
    montar(
      <>
        <CampoTexto rotulo="Nome do local" valor="" placeholder="ex.: Porto" onChange={aoDigitar} />
        <CampoSel
          rotulo="Unidade"
          opcoes={[
            { valor: 'm', rotulo: 'metros' },
            { valor: 'ft', rotulo: 'pés' },
          ]}
          valor="m"
          onChange={aoEscolher}
        />
      </>,
    )
    const texto = um<HTMLInputElement>('input.gr-entrada')
    expect(texto.labels?.[0]?.textContent).toBe('Nome do local')
    digitar(texto, 'Porto')
    expect(aoDigitar).toHaveBeenCalledWith('Porto')
    const lista = um<HTMLSelectElement>('select.gr-entrada')
    expect(lista.labels?.[0]?.textContent).toBe('Unidade')
    act(() => {
      lista.value = 'ft'
      lista.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(aoEscolher).toHaveBeenCalledWith('ft')
  })
})
