import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Pin, Stair } from '../types/map'
import { CabecaDoPino } from './PlayerPinCard'
import { rotuloNaEscolha, tituloDaEscolha } from './pinChooser'

interface PlayerPinChooserProps {
  /** Os pinos sob o dedo, já do recorte e na ordem do toque (do mais perto ao mais longe). */
  pins: readonly Pin[]
  /** As escadas do recorte: a linha do pino de escada diz "Subir"/"Descer", como o cartão dele. */
  stairs: readonly Stair[]
  onChoose: (pinId: string) => void
  onClose: () => void
}

/**
 * DOIS PINOS NO MESMO PONTO: "Aqui há 2 coisas". Uma linha por pino, com a
 * mesma cabeça do mapa e as primeiras palavras do cartão; tocar numa linha
 * abre aquele cartão. Mesmo lugar, mesma moldura e mesmo jeito de fechar do
 * cartão do pino (`PlayerPinCard`): Escape, "Fechar" ou tocar fora — e o toque
 * de fechar que cai no mapa para ali, sem arrastar nem abrir outro pino.
 *
 * Só recebe pinos do recorte: o que a névoa, a zona oculta ou o mestre
 * escondem não chega aqui, nem como contagem.
 */
export function PlayerPinChooser({ pins, stairs, onChoose, onClose }: PlayerPinChooserProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const titleId = useId()
  const titulo = tituloDaEscolha(pins.length)

  useEffect(() => {
    // Quem chegou pelo teclado já está na primeira coisa: Enter abre, setas andam.
    listRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && cardRef.current?.contains(alvo)) return
      onClose()
      // No mapa o toque só fecha; nos painéis ao lado segue para o controle tocado.
      if (alvo instanceof HTMLCanvasElement) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  /** Setas para cima e para baixo andam entre as linhas, dando a volta. */
  function onListKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const botoes = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
    if (botoes.length === 0) return
    const atual = botoes.findIndex((b) => b === document.activeElement)
    const passo = event.key === 'ArrowDown' ? 1 : -1
    const proximo = atual === -1 ? 0 : (atual + passo + botoes.length) % botoes.length
    event.preventDefault()
    botoes[proximo].focus()
  }

  return (
    <div className="pp-pincard__backdrop">
      <div ref={cardRef} className="pp-pincard pp-pincard--compacto pp-pinchooser" role="dialog" aria-modal="true" aria-label={titulo}>
        <p id={titleId} className="pp-pinchooser__title">
          {titulo}
        </p>
        <ul ref={listRef} className="pp-pinchooser__list" aria-labelledby={titleId} onKeyDown={onListKeyDown}>
          {pins.map((pin) => (
            <li key={pin.id}>
              <button type="button" className="pp-pinchooser__option" onClick={() => onChoose(pin.id)}>
                <CabecaDoPino pin={pin} />
                <span className="pp-pinchooser__label">{rotuloNaEscolha(pin, stairs)}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
