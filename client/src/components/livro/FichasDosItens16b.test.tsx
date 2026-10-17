import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FloorPiece } from '../../types/map'
import type { DrawingStyleControlsProps } from '../DrawingStyleControls'
import type { StairControlsProps } from '../StairControls'
import type { TextLabelControlsProps } from '../TextLabelControls'
import { TEXT_FONT_FAMILIES } from '../labels'
import { FichaDaEscada } from './FichaDaEscada'
import { FichaDaPecaDeChao } from './FichaDaPecaDeChao'
import { FichaDaRegiao } from './FichaDaRegiao'
import { FichaDoDesenho } from './FichaDoDesenho'
import { FichaDoTexto } from './FichaDoTexto'

/*
 * Fichas do desenho, do texto, da peça de chão, da região e da escada (fatia
 * 16b do design consolidado): a gramática da porta — essencial à vista e
 * fichas recolhidas com resumo — sem perder nenhum controle de antes, e com
 * todo campo opcional ausente (o caminho, a escada sem destino, a peça sem
 * cor própria) sem quebrar.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  // A escolha de abrir ou fechar cada ficha é lembrada: cada teste começa do padrão.
  localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const montar = (no: ReactElement) => act(() => root.render(no))
const titulosDasFichas = () => Array.from(container.querySelectorAll('.gr-ficha__tit')).map((t) => t.textContent)
/** O cartão recolhível inteiro (cabeçalho e miolo) pelo título. */
const ficha = (titulo: string) => Array.from(container.querySelectorAll('.gr-ficha')).find((f) => f.querySelector('.gr-ficha__tit')?.textContent === titulo) ?? null
/** Fechada, o miolo fica inerte (fora do Tab e do leitor de tela). Ficha que não existe é erro, não "fechada". */
function fechada(titulo: string): boolean {
  const cartao = ficha(titulo)
  if (cartao === null) throw new Error('sem a ficha ' + titulo)
  return cartao.querySelector('[inert]') !== null
}
const resumoDaFicha = (titulo: string) => ficha(titulo)?.querySelector('.gr-ficha__resumo')?.textContent ?? null
const tituloOculto = () => container.querySelector('h2.gr-sr')?.textContent
const essencial = () => container.querySelector('.gr-essencial')?.textContent ?? ''
/** Dentro da ficha, nenhum bloco de antes repete o título de seção (a ficha já diz). */
const titulosDeSecaoVisiveis = () => container.querySelectorAll('h2.lb-eyebrow').length

const estiloDoDesenho: DrawingStyleControlsProps = {
  target: 'selected',
  color: '#c0392b',
  onColorChange: vi.fn(),
  width: 4,
  onWidthChange: vi.fn(),
  filled: false,
  onFilledChange: vi.fn(),
  fillAlpha: 1,
  onFillAlphaChange: vi.fn(),
  showFilled: false,
  showWidth: true,
  fontSize: 16,
  onFontSizeChange: vi.fn(),
  fontFamily: TEXT_FONT_FAMILIES[0],
  onFontFamilyChange: vi.fn(),
  showFontSize: false,
}

describe('FichaDoDesenho', () => {
  it('linha: Cor, Espessura, Formato e Oculto no essencial; "Traço" e "Paredes" nascem fechadas, com resumo', () => {
    montar(
      <FichaDoDesenho
        estilo={estiloDoDesenho}
        formato={{ kind: 'line', onConvertToCurve: vi.fn(), onConvertToLine: null }}
        traco={{ cap: 'round', onCapChange: vi.fn(), dash: { dash: 'dashed', onDashChange: vi.fn() } }}
        paredes={{ valor: undefined, quantidade: 0, onChange: vi.fn(), onSoltar: vi.fn() }}
        jogadores={{ secret: false, onSecretChange: vi.fn() }}
      />,
    )
    expect(tituloOculto()).toBe('Estilo do desenho selecionado')
    expect(container.querySelector('.gr-essencial #lb-draw-color')).not.toBeNull()
    expect(container.querySelector('.gr-essencial #lb-draw-width')).not.toBeNull()
    expect(container.querySelector('.gr-essencial [role="radiogroup"][aria-label="Formato da linha"]')).not.toBeNull()
    expect(essencial()).toContain('Oculto para jogadores')
    expect(titulosDasFichas()).toEqual(['Traço', 'Paredes'])
    expect(fechada('Traço')).toBe(true)
    expect(fechada('Paredes')).toBe(true)
    expect(resumoDaFicha('Traço')).toBe('Tracejada')
    expect(resumoDaFicha('Paredes')).toBe('Desligadas')
    // Os controles de antes seguem lá dentro, sem o título dos blocos.
    expect(ficha('Traço')?.textContent).toContain('Ponta da linha')
    expect(ficha('Paredes')?.textContent).toContain('Paredes ao redor')
    expect(titulosDeSecaoVisiveis()).toBe(0)
  })

  it('caminho (todo opcional ausente): só Cor e Espessura no essencial, sem fichas nem Oculto', () => {
    montar(<FichaDoDesenho estilo={estiloDoDesenho} />)
    expect(container.querySelector('.gr-essencial #lb-draw-color')).not.toBeNull()
    expect(container.querySelector('.gr-essencial #lb-draw-width')).not.toBeNull()
    expect(titulosDasFichas()).toEqual([])
    expect(essencial()).not.toContain('Oculto para jogadores')
  })

  it('forma e pincel: Preenchido e Opacidade no essencial; o traço sem estilo (pincel) resume a ponta', () => {
    montar(
      <FichaDoDesenho
        estilo={estiloDoDesenho}
        preenchimento={{ filled: true, onFilledChange: vi.fn(), fillAlpha: 0.5, onFillAlphaChange: vi.fn() }}
        traco={{ cap: 'square', onCapChange: vi.fn(), dash: null }}
      />,
    )
    expect(essencial()).toContain('Preenchido')
    expect(container.querySelector('.gr-essencial #lb-fill-alpha')).not.toBeNull()
    expect(titulosDasFichas()).toEqual(['Traço'])
    expect(resumoDaFicha('Traço')).toBe('Quadrada')
  })
})

describe('FichaDoTexto', () => {
  const rotulo: TextLabelControlsProps = {
    text: 'Cuidado',
    onTextChange: vi.fn(),
    color: '#ffffff',
    onColorChange: vi.fn(),
    fontSize: 16,
    onFontSizeChange: vi.fn(),
    fontFamily: TEXT_FONT_FAMILIES[0],
    onFontFamilyChange: vi.fn(),
  }

  it('o campo do texto tem nome ("Texto", pendência da fatia 0); Cor, Tamanho da fonte, Fonte e Oculto no essencial', () => {
    montar(<FichaDoTexto rotulo={rotulo} jogadores={{ secret: true, onSecretChange: vi.fn() }} />)
    expect(container.querySelector<HTMLInputElement>('#lb-text-content')?.value).toBe('Cuidado')
    expect(container.querySelector('label[for="lb-text-content"]')?.textContent?.trim()).toBe('Texto')
    expect(tituloOculto()).toBe('Rótulo de texto')
    expect(titulosDeSecaoVisiveis()).toBe(0)
    expect(essencial()).toContain('Tamanho da fonte')
    expect(essencial()).toContain('Fonte')
    expect(essencial()).toContain('Oculto para jogadores')
    expect(titulosDasFichas()).toEqual([])
  })

  it('sem a ligação dos jogadores (opcional ausente), o essencial fica sem o Oculto e o campo continua', () => {
    montar(<FichaDoTexto rotulo={rotulo} />)
    expect(essencial()).not.toContain('Oculto para jogadores')
    expect(container.querySelector('#lb-text-content')).not.toBeNull()
  })
})

describe('FichaDaPecaDeChao', () => {
  const retangulo: FloorPiece = { id: 'f1', op: 'add', shape: { kind: 'rect', cx: 0, cy: 0, w: 200, h: 100 }, modifiers: {} }
  const controles = (piece: FloorPiece) => ({
    piece,
    floorFillColor: '#806040',
    index: 1,
    count: 3,
    grid: 50,
    onChange: vi.fn(),
    onReorder: vi.fn(),
    onRemove: vi.fn(),
  })

  it('sem cor própria, sem giro e sem borda (opcionais ausentes): Travar, Operação e Cor no essencial; Medidas aberta; Borda e Ordem fechadas', () => {
    montar(<FichaDaPecaDeChao controles={controles(retangulo)} />)
    expect(tituloOculto()).toBe('Peça de chão · Retângulo')
    expect(essencial()).toContain('Travar peça')
    expect(essencial()).toContain('Operação')
    expect(essencial()).toContain('Cor desta peça')
    expect(essencial()).not.toContain('Voltar à cor do chão')
    expect(titulosDasFichas()).toEqual(['Medidas', 'Borda', 'Ordem'])
    expect(fechada('Medidas')).toBe(false)
    expect(fechada('Borda')).toBe(true)
    expect(fechada('Ordem')).toBe(true)
    expect(resumoDaFicha('Medidas')).toBe('Retângulo')
    expect(resumoDaFicha('Borda')).toBe('Reta')
    expect(resumoDaFicha('Ordem')).toBe('2 de 3')
    expect(ficha('Medidas')?.textContent).toContain('Rotação (graus)')
    expect(ficha('Ordem')?.textContent).toContain('Apagar peça de chão')
    expect(titulosDeSecaoVisiveis()).toBe(0)
  })

  it('cor própria e borda irregular: o "Voltar à cor do chão" aparece e a borda resume Irregular', () => {
    montar(<FichaDaPecaDeChao controles={controles({ ...retangulo, fillColor: '#ff0000', modifiers: { noise: { amplitude: 4, scale: 50, seed: 1 } } })} />)
    expect(essencial()).toContain('Voltar à cor do chão')
    expect(resumoDaFicha('Borda')).toBe('Irregular')
    expect(ficha('Borda')?.textContent).toContain('Semente')
  })
})

describe('FichaDaRegiao', () => {
  it('aparência no essencial; "Trava" aberta (Travada) e "Gatilho" fechada (Nenhum)', () => {
    montar(
      <FichaDaRegiao
        aparencia={<p>Cor da região</p>}
        trava={{ title: 'Região', locked: true, onLockedChange: vi.fn() }}
        gatilho={{ kind: null, revealed: false, onKindChange: vi.fn(), onRevealedChange: vi.fn() }}
      />,
    )
    expect(tituloOculto()).toBe('Região')
    expect(essencial()).toContain('Cor da região')
    expect(titulosDasFichas()).toEqual(['Trava', 'Gatilho'])
    expect(fechada('Trava')).toBe(false)
    expect(fechada('Gatilho')).toBe(true)
    expect(resumoDaFicha('Trava')).toBe('Travada')
    expect(resumoDaFicha('Gatilho')).toBe('Nenhum')
    expect(ficha('Trava')?.textContent).toContain('Travado')
    expect(ficha('Gatilho')?.querySelector('[role="radiogroup"][aria-label="Gatilho da área"]')).not.toBeNull()
  })

  it('oculta vence travada no resumo; sem aparência, trava e gatilho (opcionais ausentes), nada quebra', () => {
    montar(<FichaDaRegiao aparencia={<p>Cor</p>} trava={{ title: 'Região', locked: true, secret: true, onSecretChange: vi.fn(), onLockedChange: vi.fn() }} />)
    expect(resumoDaFicha('Trava')).toBe('Oculta')
    montar(<FichaDaRegiao />)
    expect(titulosDasFichas()).toEqual([])
    expect(container.querySelector('.gr-essencial')).toBeNull()
    expect(tituloOculto()).toBe('Região')
  })
})

describe('FichaDaEscada', () => {
  const escada = (extra: Partial<StairControlsProps> = {}): StairControlsProps => ({
    direction: 'up',
    onDirectionChange: vi.fn(),
    shape: 'straight',
    onShapeChange: vi.fn(),
    stepWidth: 100,
    onStepWidthChange: vi.fn(),
    grid: 50,
    travel: null,
    tamanho: { length: 150, onLengthChange: vi.fn(), curve: { degrees: 0, maxDegrees: 90 }, onCurveChange: vi.fn() },
    ...extra,
  })

  it('reta sem destino nem jogadores (opcionais ausentes): Sentido, Forma, Tamanho, Comprimento, Largura e Curva no essencial, sem fichas', () => {
    montar(<FichaDaEscada controles={escada()} />)
    expect(tituloOculto()).toBe('Escada')
    expect(titulosDeSecaoVisiveis()).toBe(0)
    for (const grupo of ['Sentido da escada', 'Forma da escada', 'Tamanho da escada']) {
      expect(container.querySelector(`.gr-essencial [role="radiogroup"][aria-label="${grupo}"]`)).not.toBeNull()
    }
    expect(container.querySelector('.gr-essencial #lb-stair-length')).not.toBeNull()
    expect(container.querySelector('.gr-essencial #lb-stair-step-width')).not.toBeNull()
    expect(essencial()).toContain('Curva')
    expect(essencial()).not.toContain('Oculto para jogadores')
    expect(titulosDasFichas()).toEqual([])
  })

  it('espiral: só o Diâmetro; com o piso e o Oculto, "Para onde leva" nasce fechada com o resumo do piso', () => {
    montar(
      <FichaDaEscada
        controles={escada({ shape: 'spiral' })}
        levaAoPiso={2}
        piso={<p>Campo do piso</p>}
        jogadores={{ secret: false, onSecretChange: vi.fn() }}
      />,
    )
    expect(essencial()).toContain('Diâmetro')
    expect(container.querySelector('#lb-stair-step-width')).toBeNull()
    expect(essencial()).toContain('Oculto para jogadores')
    expect(titulosDasFichas()).toEqual(['Para onde leva'])
    expect(fechada('Para onde leva')).toBe(true)
    expect(resumoDaFicha('Para onde leva')).toBe('Piso 2')
    expect(ficha('Para onde leva')?.textContent).toContain('Campo do piso')
  })
})
