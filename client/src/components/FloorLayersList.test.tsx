import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FloorPiece } from '../types/map'
import { NOVA_CAMADA } from '../lib/camadasDoPincel'
import { FloorLayersList, type FloorLayersListProps } from './FloorLayersList'

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

function peca(id: string, fillColor?: string): FloorPiece {
  return { id, shape: { kind: 'rect', cx: 0, cy: 0, w: 10, h: 10 }, op: 'add', fillColor, modifiers: [] } as FloorPiece
}

function botao(nome: string): HTMLButtonElement {
  const achado = [...container.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') ?? b.textContent) === nome)
  if (!achado) throw new Error(`botão "${nome}" não achado`)
  return achado
}

describe('FloorLayersList', () => {
  it('lista de cima para baixo, trava, sobe, desce e seleciona pela linha', () => {
    const onSelect = vi.fn()
    const onToggleLock = vi.fn()
    const onReorder = vi.fn()
    act(() =>
      root.render(
        <FloorLayersList
          floor={[peca('mar', '#2f6690'), peca('chao')]}
          floorFillColor="#ddccaa"
          selectedPieceId={null}
          onSelect={onSelect}
          onToggleLock={onToggleLock}
          onColorChange={vi.fn()}
          onReorder={onReorder}
        />,
      ),
    )
    const nomes = [...container.querySelectorAll('.lb-floor-layers__pick')].map((b) => b.textContent)
    expect(nomes).toEqual(['Chão', 'Mar'])

    act(() => botao('Travar Mar').click())
    expect(onToggleLock).toHaveBeenCalledWith('mar', true)
    act(() => botao('Subir Mar').click())
    expect(onReorder).toHaveBeenCalledWith('mar', 1)
    expect(botao('Subir Chão').disabled).toBe(true)
    expect(botao('Descer Mar').disabled).toBe(true)
    act(() => botao('Chão').click())
    expect(onSelect).toHaveBeenCalledWith('chao')
  })

  describe('camadas do pincel', () => {
    function blocos(id: string, extra: Partial<FloorPiece> = {}): FloorPiece {
      return { id, shape: { kind: 'blocos', cell: 10, cells: [{ col: 0, row: 0 }] }, op: 'add', modifiers: {}, ...extra }
    }

    function monta(props: Partial<FloorLayersListProps> = {}): FloorLayersListProps {
      const base: FloorLayersListProps = {
        floor: [blocos('agua', { fillColor: '#2f6690' }), blocos('grama', { nome: 'Grama alta' }), peca('sala')],
        floorFillColor: '#ddccaa',
        selectedPieceId: null,
        onSelect: vi.fn(),
        onToggleLock: vi.fn(),
        onColorChange: vi.fn(),
        onReorder: vi.fn(),
        onToggleHidden: vi.fn(),
        onRename: vi.fn(),
        ...props,
      }
      act(() => root.render(<FloorLayersList {...base} />))
      return base
    }

    const pincel = (ativaId: string) => ({ ativaId, nomeDaNova: 'Camada 3', corDaNova: '#4a6b35', onAtivar: vi.fn(), onNovaCamada: vi.fn() })

    function renomear(nomeAtual: string, novo: string): void {
      act(() => botao(nomeAtual).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })))
      const campo = container.querySelector<HTMLInputElement>(`input[aria-label="Nome de ${nomeAtual}"]`)
      if (!campo) throw new Error('o campo de nome não abriu')
      campo.value = novo
      act(() => {
        campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
    }

    it('mapa antigo: a folha de pincel sem nome aparece como "Camada 1"; o nome dado aparece como foi dado', () => {
      monta()
      const nomes = [...container.querySelectorAll('.lb-floor-layers__pick')].map((b) => b.textContent)
      expect(nomes).toEqual(['Chão', 'Grama alta', 'Camada 1'])
    })

    it('com o pincel na mão, o clique no nome ATIVA a camada (não seleciona) e o topo diz onde a tinta cai', () => {
      const p = pincel('agua')
      const props = monta({ pincel: p })
      expect(container.querySelector('.lb-floor-layers__ativa')?.textContent).toBe('Pintando em Camada 1')
      expect(botao('Camada 1').getAttribute('aria-pressed')).toBe('true')
      act(() => botao('Grama alta').click())
      expect(p.onAtivar).toHaveBeenCalledWith('grama')
      expect(props.onSelect).not.toHaveBeenCalled()
      // Peça que não é do pincel continua selecionando.
      act(() => botao('Chão').click())
      expect(props.onSelect).toHaveBeenCalledWith('sala')
    })

    it('"Nova camada" pede a camada nova; com ela pendente, a linha fantasma mostra o nome e o botão desliga', () => {
      const p = pincel('agua')
      monta({ pincel: p })
      act(() => botao('+ Nova camada').click())
      expect(p.onNovaCamada).toHaveBeenCalled()
      monta({ pincel: pincel(NOVA_CAMADA) })
      expect(container.querySelector('.lb-floor-layers__row--nova')?.textContent).toContain('Camada 3')
      expect(container.querySelector('.lb-floor-layers__ativa')?.textContent).toBe('Pintando em Camada 3')
      expect(botao('+ Nova camada').disabled).toBe(true)
    })

    it('olho esconde e mostra; clique duplo renomeia com Enter, e nome vazio volta ao automático', () => {
      const props = monta({ floor: [blocos('agua', { hidden: true }), blocos('grama')] })
      act(() => botao('Mostrar Camada 1').click())
      expect(props.onToggleHidden).toHaveBeenCalledWith('agua', false)
      act(() => botao('Esconder Camada 2').click())
      expect(props.onToggleHidden).toHaveBeenCalledWith('grama', true)

      renomear('Camada 2', 'Grama')
      expect(props.onRename).toHaveBeenCalledWith('grama', 'Grama')
      expect(props.onRename).toHaveBeenCalledTimes(1)

      renomear('Camada 1', '   ')
      expect(props.onRename).toHaveBeenLastCalledWith('agua', undefined)
    })
  })
})
