import { useEffect, useId, useMemo, useRef, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { corteDaTorre, rotuloDoPonto, type CorteCena, type CorteJogador, type PontoDoCorte } from '../lib/corteDaTorre'
import type { MapData } from '../types/map'
import { CloseIcon } from './icons'

/** Entrada da janela: a mesma da Visão geral (SceneOverview.tsx) — ease-out curto, nunca de escala zero. */
const ENTER_MS = 160
/** Largura da coluna de cada poço, à esquerda dos andares. */
const POCO_COLUMN = '12px'

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

function focusablesIn(root: HTMLElement | null): HTMLElement[] {
  return root ? Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)) : []
}

export interface CorteDaTorreDialogProps {
  scenes: readonly CorteCena[]
  maps: ReadonlyMap<string, MapData>
  /** Jogadores da sala; vazio = sala fechada, e só as fichas sem dono aparecem. */
  players: readonly CorteJogador[]
  /** Nome de cena clicado. Quem chama troca de cena (ou não, se já é a aberta) e fecha. */
  onPickScene: (sceneId: string) => void
  /** Ponto clicado: quem chama leva o editor à cena com a ficha no centro e fecha. */
  onPickPoint: (ponto: PontoDoCorte) => void
  onClose: () => void
}

/**
 * CORTE DA TORRE: a aventura vista de lado, só na tela do mestre. Um andar
 * por faixa (o de cima no alto), as cenas de cada andar como etiquetas, as
 * fichas como pontos e os poços como fios verticais que atravessam os andares
 * que ligam. Clicar num ponto leva o editor à cena e à ficha; no nome da cena,
 * abre a cena. Esc, o X e o clique no fundo fecham sem trocar.
 *
 * Janela modal por portal no `body`, como a Visão geral: o painel lateral usa
 * `backdrop-filter`, que prenderia a janela na coluna estreita.
 */
export function CorteDaTorreDialog({ scenes, maps, players, onPickScene, onPickPoint, onClose }: CorteDaTorreDialogProps) {
  const titleId = useId()
  const hintId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Fecha só se o clique COMEÇOU no fundo (mesma regra da Visão geral).
  const pressStartedOnBackdrop = useRef(false)
  const corte = useMemo(() => corteDaTorre(scenes, maps, players), [scenes, maps, players])
  const totalDeAndares = corte.andares.length
  const semFicha = corte.andares.every((andar) => andar.cenas.every((cena) => cena.pontos.length === 0))

  useEffect(() => {
    const box = dialogRef.current
    // O foco começa na cena aberta: é de onde o mestre está olhando.
    const current = box?.querySelector<HTMLButtonElement>('.lb-corte__nome[aria-current="true"]:not(:disabled)')
    ;(current ?? focusablesIn(box)[0] ?? box)?.focus()
    // `animate` não existe em jsdom, e quem pediu menos movimento não recebe nenhum.
    if (!box || typeof box.animate !== 'function') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return
    box.animate([{ opacity: 0, transform: 'scale(0.95)' }, { opacity: 1, transform: 'scale(1)' }], { duration: ENTER_MS, easing: 'ease-out' })
  }, [])

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

  /** Linha da grade do andar `numero`: o de cima (o maior número) na linha 1. */
  const linhaDoAndar = (numero: number) => totalDeAndares - numero + 1
  const colunasDosPocos = corte.pocos.length
  const pilhaStyle: CSSProperties = {
    gridTemplateColumns: colunasDosPocos === 0 ? 'minmax(0, 1fr)' : `repeat(${colunasDosPocos}, ${POCO_COLUMN}) minmax(0, 1fr)`,
  }

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={onBackdropMouseDown} onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="lb-panel lb-dialog lb-corte"
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
              Corte da torre
            </h2>
            <p id={hintId} className="lb-field__hint">
              Um andar por faixa. Clique numa ficha para ir até ela, ou no nome da cena para abri-la.
            </p>
          </div>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-dialog__body lb-scroll lb-corte__corpo">
          {semFicha && <p className="lb-corte__vazio">Nenhuma ficha nas cenas.</p>}
          <div className="lb-corte__pilha" style={pilhaStyle}>
            {corte.pocos.map((poco, index) => (
              <div
                key={poco.chave}
                data-poco=""
                className="lb-corte__poco"
                role="img"
                aria-label={`Poço ${poco.nome}: do andar ${poco.de} ao ${poco.ate}`}
                title={poco.nome}
                style={{ gridColumn: index + 1, gridRow: `${linhaDoAndar(poco.ate)} / ${linhaDoAndar(poco.de) + 1}` }}
              />
            ))}
            {corte.andares.map((andar) => (
              <section
                key={andar.id}
                data-andar={andar.id}
                className="lb-corte__andar"
                aria-label={`Andar ${andar.numero}: ${andar.nome}`}
                style={{ gridColumn: colunasDosPocos + 1, gridRow: linhaDoAndar(andar.numero) }}
              >
                <span className="lb-corte__numero" aria-hidden="true">
                  {andar.numero}
                </span>
                <ul className="lb-corte__cenas">
                  {andar.cenas.map((cena) => (
                    <li key={cena.id} className="lb-corte__cena">
                      <button
                        type="button"
                        className="lb-corte__nome"
                        aria-current={cena.ativa ? 'true' : undefined}
                        disabled={!cena.disponivel}
                        title={cena.disponivel ? undefined : 'Arquivo não encontrado'}
                        onClick={() => onPickScene(cena.id)}
                      >
                        {cena.nome}
                      </button>
                      {cena.pontos.length > 0 && (
                        <span className="lb-corte__pontos">
                          {cena.pontos.map((ponto) => {
                            const rotulo = rotuloDoPonto(ponto, cena.nome)
                            const classes = ['lb-corte__ponto', `lb-corte__ponto--${ponto.tipo}`]
                            if (ponto.pedido) classes.push('lb-corte__ponto--pedido')
                            if (ponto.tipo === 'jogador' && !ponto.conectado) classes.push('lb-corte__ponto--fora')
                            return (
                              <button
                                key={ponto.chave}
                                type="button"
                                className={classes.join(' ')}
                                // Só a cor: o atalho `background` zeraria o recorte do disco (`background-clip`) do CSS.
                                style={ponto.cor === null ? undefined : { backgroundColor: ponto.cor }}
                                aria-label={rotulo}
                                title={rotulo}
                                onClick={() => onPickPoint(ponto)}
                              />
                            )
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
