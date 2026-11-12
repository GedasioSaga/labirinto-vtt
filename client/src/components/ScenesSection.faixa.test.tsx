import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

/**
 * A faixa de botões que aparece no hover da linha da cena (lista de cenas,
 * ideia 5) pousava sobre o fim da primeira linha do nome. Na coluna de 262 px
 * ela cobria o meio do nome, e o clique em "Cripta Rubra" caía no "Pausar"
 * (e2e/task-jornada-pausa-por-cena, testes 1 e 2): o mestre clicava no nome e
 * a cena pausava em vez de abrir.
 *
 * O jsdom não desenha: a prova da geometria é a regra do main.css (a faixa se
 * ancora pelo pé no alto da linha, acima do nome); a do clique é o DOM.
 */

/** O main.css como está no disco (ver `Toggle.test.tsx`: `?raw` e `new URL` não leem o arquivo). */
async function lerMainCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'main.css'), 'utf8')
}

/** As declarações da PRIMEIRA regra cujo seletor é exatamente `seletor`: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (seletores.trim() !== seletor) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
    )
  }
  return new Map()
}

const CENAS: SceneListItem[] = [
  { id: 's-salao', name: 'Salao Norte', active: true, available: true, renamable: true, tokenCount: 1 },
  { id: 's-cripta', name: 'Cripta Rubra', active: false, available: true, renamable: true, tokenCount: 1 },
]

describe('ScenesSection: a faixa do hover não cobre o nome', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** Sala aberta e aventura: todas as ações da linha existem. */
  function render(onSelect: (sceneId: string) => void, onTogglePause: (sceneId: string, paused: boolean) => void): void {
    act(() =>
      root.render(
        <ScenesSection
          scenes={CENAS}
          onSelect={onSelect}
          onCreate={() => {}}
          onRename={() => {}}
          onDuplicate={() => {}}
          onNote={() => 1}
          onQuake={() => null}
          onConfigure={() => {}}
          onTogglePause={onTogglePause}
          paused={new Set()}
          onTogglePlanKnown={() => {}}
          onTogglePin={() => 'fixou'}
          pinned={[]}
        />,
      ),
    )
  }

  function linha(nome: string): HTMLLIElement {
    const li = Array.from(container.querySelectorAll('li')).find((item) => item.querySelector('.lb-cenas__nome')?.textContent === nome)
    if (li === undefined) throw new Error(`sem linha para ${nome}`)
    return li
  }

  it('clique no nome abre a cena e não aciona a pausa; a faixa se ancora acima da linha do nome', async () => {
    const onSelect = vi.fn()
    const onTogglePause = vi.fn()
    render(onSelect, onTogglePause)
    for (const [nome, id] of [
      ['Salao Norte', 's-salao'],
      ['Cripta Rubra', 's-cripta'],
    ] as const) {
      act(() => linha(nome).querySelector<HTMLButtonElement>('.lb-cenas__nome')?.click())
      expect(onSelect).toHaveBeenLastCalledWith(id)
    }
    expect(onTogglePause).not.toHaveBeenCalled()

    // Geometria: a faixa não pode pousar pelo topo sobre a primeira linha do
    // nome. Ela se ancora pelo pé no alto da linha e entra nela no máximo o
    // respiro de cima do nome, onde não há letra.
    const css = await lerMainCss()
    const faixa = regra(css, '.lb-cenas__item > .lb-cenas__linha > .lb-cenas__controles')
    expect(faixa.get('position')).toBe('absolute')
    expect(faixa.get('top') ?? 'auto', 'a faixa não pode se ancorar pelo topo da linha').toBe('auto')
    const pe = /^calc\(100% - (\d+)px\)$/.exec(faixa.get('bottom') ?? '')
    expect(pe, `pé da faixa: ${faixa.get('bottom')}`).not.toBeNull()
    const respiroDoNome = Number.parseInt((regra(css, '.lb-cenas__linha > .lb-cenas__nome').get('padding') ?? '').split(' ')[0] ?? '', 10)
    expect(Number(pe?.[1])).toBeLessThanOrEqual(respiroDoNome)
  })

  it('a faixa da primeira linha nunca passa do topo da lista: desce para o pé do cartão; a da segunda fica em cima', () => {
    // Acima da lista mora o interruptor "Miniaturas" (ou o cabeçalho "Cenas"):
    // a faixa da primeira linha subia 14 px acima dela e tapava o pé dele.
    const estilo = document.createElement('style')
    estilo.textContent = '.lb-cenas__controles { position: absolute } .lb-cenas__item { padding-bottom: 8px; border-bottom-width: 1px }'
    document.head.appendChild(estilo)
    // O jsdom não desenha: a lista começa em y 100, cada cartão tem 42 px e o vão é de 8.
    const caixa = (top: number, height: number) => ({ top, bottom: top + height, left: 0, right: 222, width: 222, height, x: 0, y: top, toJSON: () => ({}) })
    const medida = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.matches('ul.lb-cenas')) return caixa(100, 92)
      const li = this.closest('li')
      const topo = li === null ? 0 : 100 + Array.from(li.parentElement?.children ?? []).indexOf(li) * 50
      if (this.matches('li')) return caixa(topo, 42)
      if (this.matches('.lb-cenas__linha')) return caixa(topo + 9, 24)
      if (this.matches('.lb-cenas__controles')) return caixa(topo - 14, 26)
      return caixa(0, 0)
    })
    try {
      render(() => {}, () => {})
      const focar = (nome: string) => act(() => linha(nome).querySelector<HTMLButtonElement>('.lb-cenas__nome')?.focus())
      focar('Salao Norte')
      expect(linha('Salao Norte').dataset.faixa, 'a primeira linha: o topo da faixa (86) passa do topo da lista (100)').toBe('embaixo')
      focar('Cripta Rubra')
      expect(linha('Cripta Rubra').dataset.faixa, 'a segunda linha: a faixa (136) cabe abaixo do topo da lista').toBeUndefined()
    } finally {
      medida.mockRestore()
      estilo.remove()
    }
  })

  it('a faixa tem no máximo 4 botões (Recado, Pausar, Configurar e "…"); Abalo, Mostrar a planta e Fixar moram no menu', () => {
    render(() => {}, () => {})
    for (const nome of ['Salao Norte', 'Cripta Rubra']) {
      const faixa = linha(nome).querySelector('.lb-cenas__controles')
      const rotulos = Array.from(faixa?.querySelectorAll('button') ?? []).map((botao) => botao.getAttribute('aria-label'))
      expect(rotulos, nome).toEqual([`Recado para ${nome}`, `Pausar ${nome}`, `Configurar ${nome}`, `Mais ações de ${nome}`])
    }

    // O "…" da Cripta traz o que saiu da faixa.
    act(() => linha('Cripta Rubra').querySelector<HTMLButtonElement>('button[aria-label="Mais ações de Cripta Rubra"]')?.click())
    const itens = Array.from(container.querySelectorAll('[role="menuitem"]')).map((item) => item.textContent)
    expect(itens).toEqual(expect.arrayContaining(['Abalo…', 'Mostrar a planta aos jogadores…', 'Fixar no topo']))
  })
})
