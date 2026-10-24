import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { camadaDosItens, motivoParaNaoMover, nomeDaCamada, refsDaSelecao } from '../lib/camadas/mover'
import { useMapStore } from '../stores/mapStore'
import type { ComSaidaFilho } from './grimorio/ComSaida'
import './MenuDaSelecao.css'

export interface MenuDaSelecaoProps {
  /** Ponto do clique direito, em px da caixa do canvas (a âncora do menu). */
  x: number
  y: number
  onClose: () => void
}

/** Folga entre o menu e a borda do canvas quando o clique foi rente a ela. */
const FOLGA_DA_BORDA = 8

/** Foca o item `indice` (com volta), pulando os desligados. */
function focarItem(itens: readonly HTMLButtonElement[], indice: number, passo: 1 | -1): void {
  if (itens.length === 0) return
  for (let i = 0; i < itens.length; i += 1) {
    const alvo = itens[(((indice + i * passo) % itens.length) + itens.length) % itens.length]
    if (!alvo.disabled) {
      alvo.focus()
      return
    }
  }
}

/**
 * Clique direito em cima do que está selecionado (fase 3, fatia 8): "Mover
 * para camada ›" com as 13 padrão e as livres, na ordem do painel, a atual
 * marcada. Vale para a seleção inteira (vários itens = um passo do Ctrl+Z).
 *
 * Mesmo molde do menu da porta (`DoorContextMenu`): o foco entra no item,
 * setas andam pulando o desligado, Esc fecha e devolve o foco, clique fora
 * fecha. Seta para a direita, Enter ou o ponteiro abrem o submenu; seta para
 * a esquerda e Esc fecham só ele. Camada travada aparece desligada no lugar
 * dela ("não recebe"); seleção presa (cadeado) desliga o item e diz por quê.
 */
export function MenuDaSelecao({ x, y, onClose, saindo = false }: MenuDaSelecaoProps & ComSaidaFilho) {
  const map = useMapStore((state) => state.map)
  const selection = useMapStore((state) => state.selection)
  const pinoId = useMapStore((state) => state.selectedPinId)
  const [refs] = useState(() => refsDaSelecao(selection, pinoId))
  const [submenuAberto, setSubmenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const itemRef = useRef<HTMLButtonElement | null>(null)
  const submenuRef = useRef<HTMLDivElement | null>(null)
  const focoAntes = useRef<Element | null>(document.activeElement)
  const atual = camadaDosItens(map, refs)
  const motivo = motivoParaNaoMover(map, refs)

  // A seleção sumiu por baixo do menu (Ctrl+Z, outra ação): não há o que mover.
  useEffect(() => {
    if (atual === null && !saindo) onClose()
  }, [atual, onClose, saindo])

  useEffect(() => {
    if (!saindo) itemRef.current?.focus()
  }, [saindo])

  // Clique rente à borda: o menu recua para caber no canvas.
  useLayoutEffect(() => {
    const menu = menuRef.current
    const caixa = menu?.offsetParent
    if (!menu || !(caixa instanceof HTMLElement) || caixa.clientWidth === 0) return
    menu.style.left = `${Math.max(FOLGA_DA_BORDA, Math.min(x, caixa.clientWidth - menu.offsetWidth - FOLGA_DA_BORDA))}px`
    menu.style.top = `${Math.max(FOLGA_DA_BORDA, Math.min(y, caixa.clientHeight - menu.offsetHeight - FOLGA_DA_BORDA))}px`
  }, [x, y])

  // O submenu abre à direita; sem espaço, à esquerda (sem sair do canvas).
  useLayoutEffect(() => {
    const submenu = submenuRef.current
    const menu = menuRef.current
    const caixa = menu?.offsetParent
    if (!submenuAberto || !submenu || !menu || !(caixa instanceof HTMLElement)) return
    const cabeADireita = menu.offsetLeft + menu.offsetWidth + submenu.offsetWidth + FOLGA_DA_BORDA <= caixa.clientWidth
    submenu.dataset.lado = cabeADireita ? 'direita' : 'esquerda'
    const sobra = caixa.clientHeight - FOLGA_DA_BORDA - (menu.offsetTop + submenu.offsetHeight)
    submenu.style.top = `${Math.min(0, sobra)}px`
  }, [submenuAberto])

  useEffect(() => {
    if (saindo) return
    const fora = (event: PointerEvent) => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', fora)
    return () => document.removeEventListener('pointerdown', fora)
  }, [onClose, saindo])

  if (atual === null) return null
  const camadas = contextoDeCamadas(map)
  const opcoes = [...camadas.ordem].reverse()

  const abrirSubmenu = (focar: boolean) => {
    if (motivo !== null) return
    setSubmenuAberto(true)
    if (!focar) return
    // Depois do render: o foco vai à camada atual (ou à primeira que recebe).
    requestAnimationFrame(() => {
      const itens = Array.from(submenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
      const daAtual = itens.findIndex((item) => item.getAttribute('aria-checked') === 'true')
      focarItem(itens, Math.max(0, daAtual), 1)
    })
  }

  const fecharSubmenu = () => {
    setSubmenuAberto(false)
    itemRef.current?.focus()
  }

  const fecharTudo = () => {
    const antes = focoAntes.current
    onClose()
    if (antes instanceof HTMLElement && antes.isConnected) antes.focus()
  }

  const escolher = (destino: (typeof opcoes)[number]) => {
    useMapStore.getState().moverParaCamada(refs, destino)
    onClose()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla do menu vale como atalho do editor (Esc largaria a seleção, setas a moveriam).
    event.stopPropagation()
    const noSubmenu = submenuRef.current?.contains(document.activeElement) === true
    if (event.key === 'Escape') {
      event.preventDefault()
      if (noSubmenu) fecharSubmenu()
      else fecharTudo()
      return
    }
    if (event.key === 'Tab') {
      onClose()
      return
    }
    if (!noSubmenu) {
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        abrirSubmenu(true)
      }
      return
    }
    const itens = Array.from(submenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    const agora = itens.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault()
        fecharSubmenu()
        return
      case 'ArrowDown':
        event.preventDefault()
        focarItem(itens, agora + 1, 1)
        return
      case 'ArrowUp':
        event.preventDefault()
        focarItem(itens, agora - 1, -1)
        return
      case 'Home':
        event.preventDefault()
        focarItem(itens, 0, 1)
        return
      case 'End':
        event.preventDefault()
        focarItem(itens, itens.length - 1, -1)
        return
    }
  }

  return (
    <div
      ref={menuRef}
      className={saindo ? 'lb-panel lb-portamenu lb-menusel gr-anima gr-sai' : 'lb-panel lb-portamenu lb-menusel gr-anima'}
      inert={saindo}
      role="menu"
      aria-label={refs.length === 1 ? 'Item selecionado' : `${refs.length} itens selecionados`}
      style={{ left: x, top: y }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        ref={itemRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        className="lb-portamenu__item lb-menusel__pai"
        aria-haspopup="menu"
        aria-expanded={submenuAberto}
        aria-disabled={motivo !== null}
        title={motivo ?? undefined}
        onPointerEnter={(event) => {
          event.currentTarget.focus()
          abrirSubmenu(false)
        }}
        onClick={() => (submenuAberto ? fecharSubmenu() : abrirSubmenu(true))}
      >
        <span>Mover para camada</span>
        <span className="lb-menusel__seta" aria-hidden="true">
          ›
        </span>
      </button>
      {motivo !== null && <p className="lb-menusel__motivo">{motivo}</p>}
      {submenuAberto && (
        <div ref={submenuRef} className="lb-panel lb-portamenu lb-menusel__sub" role="menu" aria-label="Mover para camada">
          {opcoes.map((camada) => {
            const travada = camadas.travada(camada)
            const marcada = atual === camada
            return (
              <button
                key={camada}
                type="button"
                role="menuitemradio"
                tabIndex={-1}
                aria-checked={marcada}
                disabled={travada && !marcada}
                className="lb-portamenu__item lb-menusel__camada"
                onPointerEnter={(event) => {
                  if (!event.currentTarget.disabled) event.currentTarget.focus()
                }}
                onClick={() => escolher(camada)}
              >
                <span className="lb-menusel__marca" aria-hidden="true">
                  {marcada ? '✓' : ''}
                </span>
                <span className="lb-menusel__nome">{nomeDaCamada(map, camada)}</span>
                {travada && <span className="lb-menusel__estado">travada</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
