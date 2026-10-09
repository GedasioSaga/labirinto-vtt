/**
 * A grade de sistemas como BIBLIOTECA (entrega 6): o "+" abre em branco,
 * cópia ou arquivo; cada cartão edita, duplica, exporta e apaga; o embutido
 * só se edita por cópia; apagar pergunta antes e recusa o sistema da aventura
 * aberta.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { SistemasDialog, type SistemasDialogProps } from './SistemasDialog'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const CASA: SistemaDeRpg = { ...SISTEMA_ONE_PIECE, id: 'casa', nome: 'Sistema da Casa' }

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => (candidato.getAttribute('aria-label') ?? candidato.textContent?.trim()) === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

function mais(): HTMLButtonElement {
  const achado = document.body.querySelector<HTMLButtonElement>('.lb-sistema--mais')
  if (achado === null) throw new Error('o "+" da grade deveria estar fechado e na tela')
  return achado
}

function temBotao(nome: string): boolean {
  return Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).some((candidato) => (candidato.getAttribute('aria-label') ?? candidato.textContent?.trim()) === nome)
}

describe('SistemasDialog: a biblioteca', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function abrir(props: Partial<SistemasDialogProps> = {}): SistemasDialogProps {
    const completas: SistemasDialogProps = {
      sistemas: [SISTEMA_ONE_PIECE, CASA],
      escolhidoId: undefined,
      avisos: [],
      onEscolher: vi.fn(),
      onImportar: vi.fn(async () => null),
      onEditar: vi.fn(),
      onDuplicar: vi.fn(async (sistema: SistemaDeRpg) => ({ ...sistema, id: `${sistema.id}-copia`, nome: `${sistema.nome} (cópia)` })),
      onExportar: vi.fn(async () => true),
      onApagar: vi.fn(async () => undefined),
      ehEmbutido: (id) => id === SISTEMA_ONE_PIECE.id,
      onClose: vi.fn(),
      ...props,
    }
    act(() => root.render(<SistemasDialog {...completas} />))
    return completas
  }

  it('o embutido não tem "Apagar" e o "Editar" dele oferece uma cópia sua; o importado edita direto', () => {
    const props = abrir()
    expect(temBotao('Apagar One Piece')).toBe(false)
    act(() => botao('Editar One Piece').click())
    expect(props.onEditar).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('O One Piece vem com o Labirinto e não muda. Edite uma cópia sua do One Piece')
    act(() => botao('Editar uma cópia').click())
    expect(props.onEditar).toHaveBeenCalledWith({ tipo: 'novo', copiaDe: SISTEMA_ONE_PIECE })

    act(() => botao('Editar Sistema da Casa').click())
    expect(props.onEditar).toHaveBeenLastCalledWith({ tipo: 'editar', sistema: CASA })
  })

  it('apagar o sistema da aventura aberta é recusado com a razão, sem chamar ninguém', () => {
    const props = abrir({ escolhidoId: 'casa' })
    act(() => botao('Apagar Sistema da Casa').click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('Esta aventura usa o Sistema da Casa. Escolha outro sistema para ela antes de apagar este.')
    expect(temBotao('Apagar')).toBe(false)
    act(() => botao('Entendi').click())
    expect(props.onApagar).not.toHaveBeenCalled()
  })

  it('apagar outro sistema pergunta antes, explica o que acontece e só apaga no "Apagar"', async () => {
    const props = abrir({ escolhidoId: 'one-piece' })
    act(() => botao('Apagar Sistema da Casa').click())
    expect(document.body.textContent).toContain('Aventuras que o usam guardam as fichas, mas ficam sem sistema até você importar o arquivo de novo')
    // O foco cai no "Manter": Enter por engano não apaga.
    expect(document.activeElement?.textContent).toBe('Manter')
    act(() => botao('Manter').click())
    expect(props.onApagar).not.toHaveBeenCalled()
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Apagar Sistema da Casa')

    act(() => botao('Apagar Sistema da Casa').click())
    await act(async () => botao('Apagar').click())
    expect(props.onApagar).toHaveBeenCalledWith(CASA)
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Sistema da Casa saiu da biblioteca.')
  })

  it('duplicar e exportar dizem o que fizeram; a falha diz a razão', async () => {
    const props = abrir({ onExportar: vi.fn<(sistema: SistemaDeRpg) => Promise<boolean>>().mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('Disco cheio.')) })
    await act(async () => botao('Duplicar One Piece').click())
    expect(props.onDuplicar).toHaveBeenCalledWith(SISTEMA_ONE_PIECE)
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Cópia criada: One Piece (cópia).')
    await act(async () => botao('Exportar arquivo de Sistema da Casa').click())
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Sistema da Casa exportado.')
    await act(async () => botao('Exportar arquivo de Sistema da Casa').click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('Disco cheio.')
  })

  it('o "+" oferece em branco, cópia de qualquer sistema e arquivo; Esc fecha só o "+"', () => {
    const props = abrir()
    act(() => mais().click())
    act(() => botao('Em branco').click())
    expect(props.onEditar).toHaveBeenCalledWith({ tipo: 'novo', copiaDe: null })

    act(() => mais().click())
    const select = document.body.querySelector<HTMLSelectElement>('.lb-sistema-novo select')
    if (select === null) throw new Error('o "+" aberto deveria ter o "Copiar de…"')
    act(() => {
      select.value = 'casa'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    act(() => botao('Copiar e editar').click())
    expect(props.onEditar).toHaveBeenLastCalledWith({ tipo: 'novo', copiaDe: CASA })

    act(() => mais().click())
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.body.querySelector('.lb-sistema-novo')).toBeNull()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(document.activeElement?.classList.contains('lb-sistema--mais')).toBe(true)
  })
})
