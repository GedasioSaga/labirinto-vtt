import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  GRUPOS_REVISAO,
  revisarAventura,
  rotuloDoConserto,
  TITULO_DO_GRUPO,
  type CenaParaRevisar,
  type Conserto,
  type ProblemaRevisao,
} from '../lib/revisorAventura'
import type { SceneListItem } from '../stores/adventureStore'
import type { MapData } from '../types/map'
import { CloseIcon } from './icons'

/** Entrada da janela: a mesma da Visão geral (SceneOverview.tsx) — ease-out curto, nunca de escala zero. */
const ENTER_MS = 160

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

/** "1 problema", "3 problemas" — a linha de resumo do topo. */
export function problemasLabel(count: number): string {
  return count === 1 ? '1 problema' : `${count} problemas`
}

export interface RevisorAventuraDialogProps {
  scenes: readonly SceneListItem[]
  /** O mapa de cada cena que abriu (`sceneMaps`, adventureStore.ts), pelo id da lista. */
  maps: ReadonlyMap<string, MapData>
  /** "Ir lá": quem chama leva o editor à cena com o ponto no centro e fecha. */
  onGoTo: (sceneId: string, x: number, y: number) => void
  /** Aplica o conserto na cena. `false` = não mudou nada (o item sumiu ou já estava consertado). */
  onFix: (sceneId: string, conserto: Conserto) => boolean
  onClose: () => void
}

/**
 * REVISAR AVENTURA: o que vaza ao jogador, o que quebra o jogo e o que ficou
 * feio, cena por cena, com "Ir lá" e o conserto de um clique quando ele é
 * seguro. A lista é recalculada a partir dos mapas: consertou, o item some.
 *
 * Janela modal por portal no `body`, como a Visão geral: o painel lateral usa
 * `backdrop-filter`, que prenderia a janela na coluna estreita.
 */
export function RevisorAventuraDialog({ scenes, maps, onGoTo, onFix, onClose }: RevisorAventuraDialogProps) {
  const titleId = useId()
  const hintId = useId()
  const baseId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Fecha só se o clique COMEÇOU no fundo (mesma regra da Visão geral).
  const pressStartedOnBackdrop = useRef(false)
  /** Posição, na lista inteira, do item que acabou de ser consertado: o foco vai para o que ficou no lugar dele. */
  const focoAposConserto = useRef<number | null>(null)
  const [aviso, setAviso] = useState('')

  const revisao = useMemo(() => {
    const cenas: CenaParaRevisar[] = scenes.map((scene) => ({ id: scene.id, name: scene.name, map: maps.get(scene.id) ?? null }))
    return revisarAventura(cenas)
  }, [scenes, maps])
  const { problemas, cenasFora } = revisao
  const cenasComProblema = new Set(problemas.map((p) => p.sceneId)).size

  useEffect(() => {
    const box = dialogRef.current
    ;(focusablesIn(box).find((el) => el.dataset.revisorAcao !== undefined) ?? box)?.focus()
    // `animate` não existe em jsdom, e quem pediu menos movimento não recebe nenhum.
    if (!box || typeof box.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    box.animate([{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ENTER_MS, easing: 'ease-out' })
  }, [])

  // O item consertado some da lista: sem isto o foco cairia no `body`, fora da janela.
  useEffect(() => {
    const posicao = focoAposConserto.current
    if (posicao === null) return
    focoAposConserto.current = null
    const box = dialogRef.current
    const itens = Array.from(box?.querySelectorAll<HTMLElement>('[data-revisor-item]') ?? [])
    const alvo = itens[Math.min(posicao, itens.length - 1)]?.querySelector<HTMLElement>('[data-revisor-acao]')
    ;(alvo ?? box)?.focus()
  }, [problemas])

  function consertar(problema: ProblemaRevisao, conserto: Conserto) {
    const ok = onFix(problema.sceneId, conserto)
    if (!ok) {
      setAviso(`Não deu para consertar: o item mudou ou já estava consertado.`)
      return
    }
    focoAposConserto.current = problemas.indexOf(problema)
    setAviso(`Consertado: ${rotuloDoConserto(conserto)} (${problema.sceneName}).`)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor (Esc lá troca a ferramenta).
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusablesIn(dialogRef.current)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    pressStartedOnBackdrop.current = event.target === event.currentTarget
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
    pressStartedOnBackdrop.current = false
  }

  const resumo =
    problemas.length === 0
      ? 'Nenhum problema encontrado nas cenas abertas.'
      : `${problemasLabel(problemas.length)} em ${cenasComProblema === 1 ? '1 cena' : `${cenasComProblema} cenas`}.`

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="lb-panel lb-dialog lb-revisor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="lb-dialog__head">
          <div className="lb-visao__cabeca">
            <h2 id={titleId} className="lb-dialog__title">
              Revisar aventura
            </h2>
            <p id={hintId} className="lb-field__hint">
              {resumo}
            </p>
          </div>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-dialog__body lb-scroll lb-revisor__corpo">
          <p className="lb-revisor__aviso" role="status">
            {aviso}
          </p>
          {GRUPOS_REVISAO.map((grupo) => {
            const doGrupo = problemas.filter((p) => p.grupo === grupo)
            const tituloGrupoId = `${baseId}-${grupo}`
            return (
              <section key={grupo} className="lb-revisor__grupo" aria-labelledby={tituloGrupoId}>
                <h3 id={tituloGrupoId} className="lb-revisor__titulo">
                  {TITULO_DO_GRUPO[grupo]} <span className="lb-revisor__conta">({doGrupo.length})</span>
                </h3>
                {doGrupo.length === 0 ? (
                  <p className="lb-revisor__vazio">Nada encontrado.</p>
                ) : (
                  <ul className="lb-revisor__lista">
                    {doGrupo.map((problema) => {
                      const textoId = `${baseId}-${problema.id}`
                      const conserto = problema.conserto
                      return (
                        <li key={problema.id} className="lb-revisor__item" data-revisor-item="">
                          <p id={textoId} className="lb-revisor__texto">
                            <span className="lb-revisor__cena">{problema.sceneName}</span>
                            {problema.texto}
                          </p>
                          <div className="lb-revisor__acoes">
                            <button
                              type="button"
                              className="lb-btn"
                              data-revisor-acao=""
                              aria-describedby={textoId}
                              onClick={() => onGoTo(problema.sceneId, problema.ponto.x, problema.ponto.y)}
                            >
                              Ir lá
                            </button>
                            {conserto !== null && (
                              <button type="button" className="lb-btn" aria-describedby={textoId} onClick={() => consertar(problema, conserto)}>
                                {rotuloDoConserto(conserto)}
                              </button>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
          {cenasFora.length > 0 && <p className="lb-revisor__vazio">Fora da revisão (o arquivo não abriu): {cenasFora.join(', ')}.</p>}
        </div>
      </div>
    </div>,
    document.body,
  )
}
