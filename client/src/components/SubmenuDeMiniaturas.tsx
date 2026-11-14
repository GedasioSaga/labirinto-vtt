import { useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './MenuDaSelecao.css'

export interface MiniaturaDoSubmenu {
  chave: string
  nome: string
  /** A opção que vale hoje: leva o contorno e é onde o foco entra. */
  marcada: boolean
  miniatura: ReactNode
  aoEscolher: () => void
}

export interface SubmenuDeMiniaturasProps {
  /** O nome acessível do submenu ("Mudar ficha", "Aura"). */
  rotulo: string
  itens: readonly MiniaturaDoSubmenu[]
  /** O item pai que abriu o submenu: ele abre na altura dele. */
  ancora: HTMLElement | null
  /** Abriu pelo teclado: o foco entra na opção marcada (ou na primeira). */
  focar: boolean
  /** Esc, ou seta para a esquerda na primeira coluna: fecha só o submenu. */
  onFechar: () => void
  /** Tab: fecha o menu inteiro. */
  onSair: () => void
}

/** Folga entre o submenu e a borda do canvas. */
const FOLGA_DA_BORDA = 8

/** Colunas da grade; a mesma conta está em `.lb-minis__grade` (MenuDaSelecao.css). */
const COLUNAS = 3

function botoes(raiz: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(raiz?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
}

/**
 * Submenu em GRADE DE MINIATURAS (pedido de 14/11/2026): "Mudar ficha ›" e
 * "Aura ›" do botão direito. Mesmo molde do "Enviar para cena ›"
 * (`SubmenuDeCenas`): abre ao lado do pai, à esquerda quando não cabe, sem
 * animação própria. As setas andam na grade; a esquerda, na primeira coluna,
 * volta ao item pai; Home e End vão às pontas.
 */
export function SubmenuDeMiniaturas({ rotulo, itens, ancora, focar, onFechar, onSair }: SubmenuDeMiniaturasProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!focar) return
    const lista = botoes(ref.current)
    const alvo = lista.find((item) => item.getAttribute('aria-checked') === 'true') ?? lista[0]
    alvo?.focus()
  }, [focar])

  // Na altura do item pai; à direita do menu, ou à esquerda sem espaço — sem sair do canvas.
  useLayoutEffect(() => {
    const submenu = ref.current
    const menu = submenu?.offsetParent
    const caixa = menu instanceof HTMLElement ? menu.offsetParent : null
    if (!submenu || !(menu instanceof HTMLElement) || !(caixa instanceof HTMLElement)) return
    const cabeADireita = menu.offsetLeft + menu.offsetWidth + submenu.offsetWidth + FOLGA_DA_BORDA <= caixa.clientWidth
    submenu.dataset.lado = cabeADireita ? 'direita' : 'esquerda'
    const base = ancora?.offsetTop ?? 0
    const sobra = caixa.clientHeight - FOLGA_DA_BORDA - (menu.offsetTop + base + submenu.offsetHeight)
    submenu.style.top = `${base + Math.min(0, sobra)}px`
  }, [ancora])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // As teclas daqui não chegam ao menu pai nem ao editor.
    event.stopPropagation()
    const lista = botoes(ref.current)
    const agora = lista.findIndex((item) => item === document.activeElement)
    const focarEm = (indice: number) => {
      event.preventDefault()
      lista[Math.max(0, Math.min(lista.length - 1, indice))]?.focus()
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        onFechar()
        return
      case 'Tab':
        onSair()
        return
      case 'ArrowLeft':
        if (agora < 0 || agora % COLUNAS === 0) {
          event.preventDefault()
          onFechar()
          return
        }
        focarEm(agora - 1)
        return
      case 'ArrowRight':
        focarEm(agora + 1)
        return
      case 'ArrowDown':
        // Sem linha embaixo, fica onde está; linha de baixo mais curta, vai à última.
        focarEm(agora < 0 ? 0 : Math.floor(agora / COLUNAS) < Math.floor((lista.length - 1) / COLUNAS) ? agora + COLUNAS : agora)
        return
      case 'ArrowUp':
        focarEm(agora < COLUNAS ? Math.max(0, agora) : agora - COLUNAS)
        return
      case 'Home':
        focarEm(0)
        return
      case 'End':
        focarEm(lista.length - 1)
        return
    }
  }

  return (
    <div ref={ref} className="lb-panel lb-portamenu lb-menusel__sub lb-minis" role="menu" aria-label={rotulo} onKeyDown={onKeyDown}>
      <div className="lb-minis__grade">
        {itens.map((item) => (
          <button
            key={item.chave}
            type="button"
            role="menuitemradio"
            tabIndex={-1}
            aria-checked={item.marcada}
            title={item.nome}
            className="lb-portamenu__item lb-minis__item"
            // O destaque segue o ponteiro, como segue as setas.
            onPointerEnter={(event) => event.currentTarget.focus()}
            onClick={item.aoEscolher}
          >
            <span className="lb-minis__foto" aria-hidden="true">
              {item.miniatura}
            </span>
            <span className="lb-minis__nome">{item.nome}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
