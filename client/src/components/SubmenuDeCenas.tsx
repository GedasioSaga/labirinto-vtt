import { useEffect, useLayoutEffect, useRef, type KeyboardEvent } from 'react'
import type { CenaDoEnvio } from '../lib/enviarParaCena'
import './MenuDaSelecao.css'

export interface SubmenuDeCenasProps {
  /** As outras cenas do mapa, na ordem da lista Cenas; a desligada leva o motivo na dica. */
  cenas: readonly CenaDoEnvio[]
  /** O item "Enviar para cena ›" que abriu o submenu: ele abre na altura dele. */
  ancora: HTMLElement | null
  /** Abriu pelo teclado: o foco entra na primeira cena que recebe. */
  focar: boolean
  onEscolher: (sceneId: string) => void
  /** Seta para a esquerda ou Esc: fecha só o submenu (o foco volta ao item pai). */
  onFechar: () => void
  /** Tab: fecha o menu inteiro, como no resto dos menus do mapa. */
  onSair: () => void
}

/** Folga entre o submenu e a borda do canvas. */
const FOLGA_DA_BORDA = 8

function botoes(raiz: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(raiz?.querySelectorAll<HTMLButtonElement>('button') ?? [])
}

/** Foca a cena `indice` (com volta), pulando as desligadas. */
function focarCena(itens: readonly HTMLButtonElement[], indice: number, passo: 1 | -1): void {
  for (let i = 0; i < itens.length; i += 1) {
    const alvo = itens[(((indice + i * passo) % itens.length) + itens.length) % itens.length]
    if (!alvo.disabled) {
      alvo.focus()
      return
    }
  }
}

/**
 * O submenu "Enviar para cena ›": as outras cenas do mapa, uma por linha. A
 * cena aberta não aparece (a ficha já está nela); a que ainda está abrindo
 * aparece desligada, com o motivo. Mesmo molde do "Mover para camada ›"
 * (`MenuDaSelecao`): abre ao lado do pai, à esquerda quando não cabe; setas
 * andam pulando a desligada, Home/End vão às pontas.
 */
export function SubmenuDeCenas({ cenas, ancora, focar, onEscolher, onFechar, onSair }: SubmenuDeCenasProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (focar) focarCena(botoes(ref.current), 0, 1)
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
    const itens = botoes(ref.current)
    const agora = itens.findIndex((item) => item === document.activeElement)
    switch (event.key) {
      case 'ArrowLeft':
      case 'Escape':
        event.preventDefault()
        onFechar()
        return
      case 'Tab':
        onSair()
        return
      case 'ArrowDown':
        event.preventDefault()
        focarCena(itens, agora + 1, 1)
        return
      case 'ArrowUp':
        event.preventDefault()
        focarCena(itens, agora - 1, -1)
        return
      case 'Home':
        event.preventDefault()
        focarCena(itens, 0, 1)
        return
      case 'End':
        event.preventDefault()
        focarCena(itens, itens.length - 1, -1)
        return
    }
  }

  return (
    <div ref={ref} className="lb-panel lb-portamenu lb-menusel__sub" role="menu" aria-label="Enviar para cena" onKeyDown={onKeyDown}>
      {cenas.map((cena) => (
        <button
          key={cena.id}
          type="button"
          role="menuitem"
          tabIndex={-1}
          disabled={cena.motivo !== null}
          title={cena.motivo ?? undefined}
          className="lb-portamenu__item lb-menusel__cena"
          onPointerEnter={(event) => {
            if (!event.currentTarget.disabled) event.currentTarget.focus()
          }}
          onClick={() => onEscolher(cena.id)}
        >
          <span className="lb-menusel__nome">{cena.nome}</span>
          {cena.estado !== null && <span className="lb-menusel__estado">{cena.estado}</span>}
        </button>
      ))}
    </div>
  )
}
