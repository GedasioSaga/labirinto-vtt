import { act, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Acoes, Botao } from './Botao'
import { Cabeca, CabecaRetrato } from './Cabeca'
import { Ficha, Fichas } from './Ficha'
import { Marcadores, type PaginaDoMarcador } from './Marcador'
import { GrupoAvancado, Nota } from './Nota'

/* A estrutura da página: botões, cabeça, fichas recolhíveis e os marcadores da lombada. */

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
const todos = (seletor: string) => Array.from(container.querySelectorAll<HTMLElement>(seletor))
function teclar(el: Element, key: string): void {
  act(() => {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('Botao, Acoes, Cabeca e Nota', () => {
  it('as variantes viram classes gr-; só ícone usa o nome de aria-label; o tipo padrão não envia formulário', () => {
    montar(
      <Acoes coluna>
        <Botao variante="latao" tamanho="p">
          Token
        </Botao>
        <Botao soIcone aria-label="Desfazer" aria-pressed>
          <svg />
        </Botao>
      </Acoes>,
    )
    const [token, desfazer] = todos('button')
    expect(token.className).toBe('gr-bt gr-bt--latao gr-bt--p')
    expect(token.getAttribute('type')).toBe('button')
    expect(desfazer.className).toBe('gr-bt gr-bt--ic')
    expect(desfazer.getAttribute('aria-label')).toBe('Desfazer')
    expect(desfazer.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('.gr-acoes.gr-acoes--col')).not.toBeNull()
  })

  it('cabeça mostra nome, tipo · onde e as ações; o retrato é decorativo', () => {
    montar(<Cabeca marca={<CabecaRetrato cor="#79a9cc" iniciais="VA" />} nome="Vagn" tipo="Token" onde="Armazém 3" acoes={<Botao>Apagar</Botao>} />)
    expect(container.querySelector('.gr-cabeca__nome')?.textContent).toBe('Vagn')
    expect(container.querySelector('.gr-cabeca__tipo')?.textContent).toBe('Token · Armazém 3')
    expect(container.querySelector('.gr-cabeca__retrato')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.gr-cabeca__acoes button')?.textContent).toBe('Apagar')
  })

  it('nota com o link "ir" chama a ação; o grupo Avançado nasce fechado', () => {
    const ir = vi.fn()
    montar(
      <>
        <Nota ir={{ rotulo: 'Ir para Cena', onClick: ir }}>O pincel do chão mora na página Cena.</Nota>
        <GrupoAvancado>
          <p>raro</p>
        </GrupoAvancado>
      </>,
    )
    act(() => todos('.gr-link')[0].click())
    expect(ir).toHaveBeenCalledTimes(1)
    const avancado = container.querySelector('details')
    expect(avancado?.open).toBe(false)
    expect(avancado?.querySelector('summary')?.textContent).toBe('Avançado')
  })
})

describe('Ficha e Fichas (acordeão)', () => {
  it('cabeçalho é um botão dentro do título com aria-expanded; fechada, o miolo fica inert', () => {
    montar(
      <Fichas>
        <Ficha titulo="Aparência" resumo="Padrão">
          <button type="button">Cor</button>
        </Ficha>
      </Fichas>,
    )
    const cabecalho = todos('.gr-ficha__cab')[0]
    expect(cabecalho.parentElement?.tagName).toBe('H3')
    expect(cabecalho.getAttribute('aria-expanded')).toBe('false')
    const corpo = document.getElementById(cabecalho.getAttribute('aria-controls') ?? '')
    expect(corpo?.hasAttribute('inert')).toBe(true)
    act(() => cabecalho.click())
    expect(cabecalho.getAttribute('aria-expanded')).toBe('true')
    expect(corpo?.hasAttribute('inert')).toBe(false)
    expect(container.querySelector('.gr-ficha')?.classList.contains('gr-e-aberta')).toBe(true)
  })

  it('controlada: quem monta decide, e o clique só avisa', () => {
    const onAlternar = vi.fn()
    montar(
      <Ficha titulo="Quem abre" aberta onAlternar={onAlternar}>
        <p>miolo</p>
      </Ficha>,
    )
    act(() => todos('.gr-ficha__cab')[0].click())
    expect(onAlternar).toHaveBeenCalledWith(false)
    expect(todos('.gr-ficha__cab')[0].getAttribute('aria-expanded')).toBe('true')
  })

  it('setas passam de cabeçalho em cabeçalho sem abrir nada; Home e End vão às pontas', () => {
    montar(
      <Fichas>
        <Ficha titulo="Nome">a</Ficha>
        <Ficha titulo="Condições">b</Ficha>
        <Ficha titulo="No mapa">c</Ficha>
      </Fichas>,
    )
    const cabecalhos = todos('.gr-ficha__cab')
    act(() => cabecalhos[0].focus())
    teclar(cabecalhos[0], 'ArrowDown')
    expect(document.activeElement).toBe(cabecalhos[1])
    teclar(cabecalhos[1], 'End')
    expect(document.activeElement).toBe(cabecalhos[2])
    teclar(cabecalhos[2], 'ArrowDown')
    expect(document.activeElement).toBe(cabecalhos[2])
    teclar(cabecalhos[2], 'Home')
    expect(document.activeElement).toBe(cabecalhos[0])
    expect(cabecalhos.map((c) => c.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false'])
  })
})

type Pagina = 'ficha' | 'cena' | 'aventura' | 'acervo'
const PAGINAS: PaginaDoMarcador<Pagina>[] = [
  { id: 'ficha', rotulo: 'Ficha', icone: <svg />, ponto: false },
  { id: 'cena', rotulo: 'Cena', icone: <svg /> },
  { id: 'aventura', rotulo: 'Aventura', icone: <svg />, conta: 2, rotuloDaConta: '2 pedidos' },
  { id: 'acervo', rotulo: 'Acervo', icone: <svg /> },
]

function LombadaDeTeste({ aoTrocar }: { aoTrocar: (p: Pagina) => void }) {
  const [atual, setAtual] = useState<Pagina>('ficha')
  return (
    <Marcadores
      rotulo="Páginas do livro do mestre"
      paginas={PAGINAS}
      atual={atual}
      controla="esq-corpo"
      onTrocar={(p) => {
        setAtual(p)
        aoTrocar(p)
      }}
    />
  )
}

describe('Marcadores (abas da lombada)', () => {
  it('tablist em pé; só o marcador aberto entra no Tab; o contador entra no nome', () => {
    montar(<LombadaDeTeste aoTrocar={vi.fn()} />)
    const lista = container.querySelector('[role="tablist"]')
    expect(lista?.getAttribute('aria-label')).toBe('Páginas do livro do mestre')
    expect(lista?.getAttribute('aria-orientation')).toBe('vertical')
    const abas = todos('[role="tab"]')
    expect(abas.map((a) => a.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false'])
    expect(abas.map((a) => a.tabIndex)).toEqual([0, -1, -1, -1])
    expect(abas.every((a) => a.getAttribute('aria-controls') === 'esq-corpo')).toBe(true)
    expect(abas[2].textContent).toBe('Aventura2, 2 pedidos')
    // o ponto existe apagado no Ficha (para acender com transição) e não existe nos outros
    expect(abas[0].querySelector('.gr-marcador__ponto')?.classList.contains('gr-vis')).toBe(false)
    expect(abas[1].querySelector('.gr-marcador__ponto')).toBeNull()
  })

  it('setas para cima e para baixo trocam de página na hora e dão a volta; Home e End', () => {
    const aoTrocar = vi.fn()
    montar(<LombadaDeTeste aoTrocar={aoTrocar} />)
    const abas = () => todos('[role="tab"]')
    act(() => abas()[0].focus())
    teclar(abas()[0], 'ArrowDown')
    expect(document.activeElement).toBe(abas()[1])
    expect(abas()[1].getAttribute('aria-selected')).toBe('true')
    teclar(abas()[1], 'ArrowUp')
    teclar(abas()[0], 'ArrowUp')
    expect(document.activeElement).toBe(abas()[3])
    teclar(abas()[3], 'Home')
    teclar(abas()[0], 'End')
    expect(aoTrocar.mock.calls.map((c) => c[0])).toEqual(['cena', 'ficha', 'acervo', 'ficha', 'acervo'])
  })

  it('a fita vai até o marcador aberto sem animar na primeira vez', () => {
    montar(<LombadaDeTeste aoTrocar={vi.fn()} />)
    const fita = container.querySelector<HTMLElement>('.gr-fita')
    expect(fita?.getAttribute('aria-hidden')).toBe('true')
    expect(fita?.style.transform).toBe('translateY(0px)')
    expect(fita?.classList.contains('gr-sem-anim')).toBe(false)
  })
})
