import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classificarDicas } from '../lib/dicaDoPainel'
import { DEFAULT_FLOOR_STYLE } from '../lib/mapFile'
import { FloorStyleControls, type FloorStyleControlsProps } from './FloorStyleControls'

/**
 * "Chão do mapa" (estilo do chão do MAPA inteiro), peça mapa-inteiro-enxuto do
 * laudo do painel:
 * - "Cor do chão" com a amostra na linha do rótulo (o "Fill" do painel Design
 *   do Figma UI3), lida como os interruptores de baixo, e com o
 *   `#lb-floor-fill-color` que as jornadas usam;
 * - a frase de por que a cor não aparece (mapa ainda sem chão) deixa de ocupar
 *   quatro linhas no alto da seção: vira a dica sob demanda de "Cor do chão" e
 *   de "Contorno", os controles que ela explica.
 * O jsdom não desenha: a linha é provada pela estrutura e pela regra do CSS
 * da peça; a medida de verdade é a sonda no app.
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

const FRASE_SEM_CHAO = 'Este mapa ainda não tem nenhum'

function renderChao(overrides: Partial<FloorStyleControlsProps> = {}): FloorStyleControlsProps {
  const props: FloorStyleControlsProps = {
    style: { ...DEFAULT_FLOOR_STYLE },
    onStyleChange: vi.fn(),
    frame: null,
    onFrameChange: vi.fn(),
    defaultFrameRect: { x: 0, y: 0, w: 1920, h: 1280 },
    hasFloorContent: false,
    ...overrides,
  }
  act(() => root.render(<FloorStyleControls {...props} />))
  return props
}

function amostra(id: string): HTMLInputElement {
  const alvo = container.querySelector(`#${id}`)
  if (!(alvo instanceof HTMLInputElement)) throw new Error(`sem a amostra #${id}`)
  return alvo
}

function interruptor(rotulo: string): HTMLInputElement {
  const linha = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.trim() === rotulo)
  const caixa = linha?.querySelector('input[type="checkbox"]')
  if (!(caixa instanceof HTMLInputElement)) throw new Error(`sem o interruptor "${rotulo}"`)
  return caixa
}

/** As frases que o controle aponta em `aria-describedby`, na ordem. */
function descricoes(controle: Element): HTMLElement[] {
  return (controle.getAttribute('aria-describedby') ?? '')
    .split(/\s+/)
    .filter((id) => id !== '')
    .map((id) => document.getElementById(id))
    .filter((frase): frase is HTMLElement => frase !== null)
}

/** O input de cor avisa pelo evento `input`, com o valor já trocado pelo seletor do navegador. */
function escolherCor(alvo: HTMLInputElement, cor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(alvo, cor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

/** A folha da peça como está no disco (o mesmo jeito de `PropertiesPanel.borda.test.ts`). */
async function lerCssDaPeca(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'FloorStyleControls.css'), 'utf8')
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

describe('FloorStyleControls — "Chão do mapa" enxuto', () => {
  it('"Cor do chão" mora na linha do rótulo: rótulo e amostra no mesmo campo, o rótulo antes, com o id das jornadas', () => {
    renderChao()
    const cor = amostra('lb-floor-fill-color')
    expect(cor.type).toBe('color')
    const rotulo = container.querySelector('label[for="lb-floor-fill-color"]')
    expect(rotulo?.textContent?.trim()).toBe('Cor do chão')
    // A amostra vem com a pipeta do conta-gotas ao lado (CampoDeCorComPipeta):
    // o par é que mora na linha.
    const linha = cor.closest('.lb-campo-cor')?.parentElement
    expect(linha, 'rótulo e amostra são irmãos na mesma linha').toBe(rotulo?.parentElement)
    expect(linha?.firstElementChild, 'o rótulo vem antes da amostra: o "?" da dica cai logo depois dele').toBe(rotulo)
    expect(linha?.classList.contains('lb-field')).toBe(true)
    expect(linha?.classList.contains('lb-floor-linha')).toBe(true)
  })

  it('a linha do chão é linha no CSS da peça: rótulo à esquerda, amostra à direita, na altura do alvo', async () => {
    const linha = regra(await lerCssDaPeca(), '.lb-field.lb-floor-linha')
    expect(linha.get('flex-direction')).toBe('row')
    expect(linha.get('align-items')).toBe('center')
    expect(linha.get('justify-content')).toBe('space-between')
    expect(linha.get('min-height')).toBe('34px')
  })

  it('mudar a amostra repinta o chão do mapa', () => {
    const props = renderChao()
    escolherCor(amostra('lb-floor-fill-color'), '#336699')
    expect(props.onStyleChange).toHaveBeenLastCalledWith({ fillColor: '#336699' })
  })

  it('mapa sem chão: a frase de por que a cor não aparece vira a dica de "Cor do chão" e de "Contorno", fora do fluxo', () => {
    renderChao({ hasFloorContent: false })
    const [frase] = descricoes(amostra('lb-floor-fill-color'))
    expect(frase?.textContent).toContain(FRASE_SEM_CHAO)
    expect(frase?.textContent).toContain('ferramenta Chão ou o menu da imagem de fundo')
    expect(frase?.classList.contains('lb-field__hint')).toBe(true)
    expect(descricoes(interruptor('Contorno')), 'sem chão o contorno também não aparece: a mesma frase explica').toContain(frase)
    expect(classificarDicas(container).sobDemanda, 'ligada a controles ativos, a frase vira balão e sai da coluna').toContain(frase)
  })

  it('mapa com chão: nenhuma frase e nada descrito, porque a cor aparece na hora', () => {
    renderChao({ hasFloorContent: true })
    expect(container.textContent).not.toContain(FRASE_SEM_CHAO)
    expect(amostra('lb-floor-fill-color').hasAttribute('aria-describedby')).toBe(false)
    expect(interruptor('Contorno').hasAttribute('aria-describedby')).toBe(false)
  })

  it('Contorno continua: ligar pede a cor escura; ligado, "Cor do contorno" também mora na linha do rótulo', () => {
    const props = renderChao()
    act(() => interruptor('Contorno').click())
    expect(props.onStyleChange).toHaveBeenLastCalledWith({ strokeColor: '#000000' })

    renderChao({ style: { ...DEFAULT_FLOOR_STYLE, strokeColor: '#222222' } })
    const contorno = amostra('lb-floor-stroke-color')
    expect(contorno.value).toBe('#222222')
    expect(container.querySelector('label[for="lb-floor-stroke-color"]')?.textContent?.trim()).toBe('Cor do contorno')
    expect(contorno.closest('.lb-campo-cor')?.parentElement?.classList.contains('lb-floor-linha')).toBe(true)
  })
})
