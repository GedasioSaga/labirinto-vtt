import { Fragment, useEffect, useLayoutEffect, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import './batalha.css'

/**
 * O menu da carta do MESTRE (dar a vez, agir de novo, equipe, tirar da
 * batalha). Próprio da batalha, e não o `Pop` do grimório, porque a faixa
 * também monta na tela do jogador, que não carrega o grimório.
 *
 * Convenções de "Menu de ações": abre do gatilho em 140 ms (ease-out, escala
 * 0,97 → 1, origem no gatilho), as setas andam pulando o item desligado,
 * Home/End vão às pontas, Esc e Tab fecham e devolvem o foco à carta, clicar
 * fora fecha, escolher fecha e executa. Item que não vale agora fica no lugar,
 * apagado, com o motivo embaixo.
 */

export interface ItemDoMenuDaCarta {
  id: string
  rotulo: string
  /** Segunda linha apagada: o motivo de estar desligado, ou o que o item faz. */
  detalhe?: string
  perigo?: boolean
  desabilitado?: boolean
  /** Escolha única (a equipe): `true` = a atual. Ausente = item de ação. */
  marcado?: boolean
  /** A bolinha de cor do item de escolha. */
  cor?: string | null
  /** Começa um trecho com este título ("Equipe"). */
  secao?: string
  onEscolher: () => void
}

export interface MenuDaCartaProps {
  /** A carta que abriu: dá a posição e recebe o foco de volta. */
  ancora: HTMLElement
  rotulo: string
  itens: readonly ItemDoMenuDaCarta[]
  onFechar: () => void
}

const MARGEM = 8
const DISTANCIA = 6

const itensAtivos = (menu: HTMLElement) => Array.from(menu.querySelectorAll<HTMLButtonElement>('[data-bt-item]:not(:disabled)'))

export function MenuDaCarta({ ancora, rotulo, itens, onFechar }: MenuDaCartaProps) {
  const caixa = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = caixa.current
    if (!menu) return
    const r = ancora.getBoundingClientRect()
    const largura = menu.offsetWidth
    const altura = menu.offsetHeight
    const cabeEmbaixo = r.bottom + DISTANCIA + altura <= window.innerHeight - MARGEM
    const y = cabeEmbaixo ? r.bottom + DISTANCIA : r.top - DISTANCIA - altura
    const x = Math.max(MARGEM, Math.min(window.innerWidth - largura - MARGEM, r.left))
    menu.style.left = `${x}px`
    menu.style.top = `${Math.max(MARGEM, y)}px`
    menu.style.setProperty('--bt-origem', cabeEmbaixo ? '0 0' : '0 100%')
    itensAtivos(menu)[0]?.focus({ preventScroll: true })
  }, [ancora])

  // Clicar fora fecha; a própria carta fica de fora (ela alterna sozinha).
  useEffect(() => {
    const aoApertar = (evento: PointerEvent) => {
      const alvo = evento.target
      if (!(alvo instanceof Node)) return
      if (caixa.current?.contains(alvo) || ancora.contains(alvo)) return
      onFechar()
    }
    document.addEventListener('pointerdown', aoApertar, true)
    return () => document.removeEventListener('pointerdown', aoApertar, true)
  }, [ancora, onFechar])

  const fecharDevolvendo = () => {
    onFechar()
    ancora.focus({ preventScroll: true })
  }

  const teclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    // Nenhuma tecla daqui vira atalho do mapa (o mapa ouve no `window`).
    evento.stopPropagation()
    if (evento.key === 'Escape' || evento.key === 'Tab') {
      evento.preventDefault()
      fecharDevolvendo()
      return
    }
    const ativos = itensAtivos(evento.currentTarget)
    if (ativos.length === 0) return
    const atual = ativos.findIndex((item) => item === document.activeElement)
    const ultimo = ativos.length - 1
    const destinos: Record<string, number> = {
      ArrowDown: atual < 0 || atual === ultimo ? 0 : atual + 1,
      ArrowUp: atual <= 0 ? ultimo : atual - 1,
      Home: 0,
      End: ultimo,
    }
    if (!Object.hasOwn(destinos, evento.key)) return
    evento.preventDefault()
    ativos[destinos[evento.key]]?.focus()
  }

  return createPortal(
    <div ref={caixa} className="bt-menu" role="menu" aria-label={rotulo} tabIndex={-1} onKeyDown={teclar}>
      {itens.map((item, indice) => {
        const detalheId = item.detalhe === undefined ? undefined : `bt-menu-${item.id}-detalhe`
        const escolha = item.marcado !== undefined
        return (
          <Fragment key={item.id}>
            {item.secao !== undefined && (
              <>
                {indice > 0 && <div className="bt-menu__sep" role="separator" />}
                <div className="bt-menu__rot" role="presentation">
                  {item.secao}
                </div>
              </>
            )}
            <button
              type="button"
              data-bt-item=""
              role={escolha ? 'menuitemradio' : 'menuitem'}
              aria-checked={escolha ? item.marcado : undefined}
              aria-describedby={detalheId}
              className={item.perigo ? 'bt-menu__item bt-menu__item--perigo' : 'bt-menu__item'}
              tabIndex={-1}
              disabled={item.desabilitado}
              style={item.cor ? ({ '--lado': item.cor } as CSSProperties) : undefined}
              onClick={() => {
                fecharDevolvendo()
                item.onEscolher()
              }}
            >
              {escolha && <span className="bt-menu__marca" aria-hidden="true" />}
              <span>
                {item.rotulo}
                {item.detalhe !== undefined && <small id={detalheId}>{item.detalhe}</small>}
              </span>
            </button>
          </Fragment>
        )
      })}
    </div>,
    document.body,
  )
}
