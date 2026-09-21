import { useEffect, useRef } from 'react'
import type { Pin } from '../types/map'
import { PIN_GLYPH, isPlayerSafePinImage } from '../lib/pins'
import { PinTravelArt } from '../components/PinSymbolArt'

interface PlayerPinCardProps {
  pin: Pin
  onClose: () => void
}

/**
 * Cenário sem foto. Fica como `<img>` de verdade, e não como um `<div>` vazio,
 * porque a área de imagem é parte do que o cartão promete: o jogador precisa
 * ver que ali CABE uma imagem e que o mestre não pôs nenhuma — um buraco sem
 * explicação leria como falha de carregamento.
 */
const IMAGEM_AUSENTE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180">' +
      '<rect width="320" height="180" fill="%23191a20"/>' +
      '<path d="M96 122l38-44 26 30 18-20 46 34z" fill="none" stroke="%235d6070" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="118" cy="66" r="9" fill="none" stroke="%235d6070" stroke-width="3"/>' +
      '</svg>',
  )

/**
 * O cartão do ponto de interesse, do jeito que o usuário descreveu: "abrir a
 * imagem de um cenário ou um item e embaixo a descrição".
 *
 * Imagem EM CIMA, texto EMBAIXO — nesta ordem no DOM, sem `order` de flex ou
 * posicionamento que desmanche a ordem de leitura: quem enxerga e quem ouve
 * recebem a mesma sequência.
 *
 * Fecha por Escape, pelo botão e por tocar fora. O "fora" é um fundo que cobre
 * a tela inteira: sem ele, o toque de fechar passaria direto para o canvas e
 * arrastaria o mapa junto.
 */
export function PlayerPinCard({ pin, onClose }: PlayerPinCardProps) {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Foco no botão de fechar: quem chegou aqui pelo teclado tem para onde ir,
    // e Escape funciona mesmo sem o foco estar dentro do cartão.
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const descricao = pin.description.trim()
  // Só data URL vira foto: se um caminho de disco escapasse até aqui, o
  // `<img>` tentaria abrir o computador do mestre pelo navegador do jogador.
  const foto = isPlayerSafePinImage(pin.image) ? pin.image : null
  // Pino de viagem: o cartão é o de sempre (imagem e descrição do mestre), com
  // a passagem no lugar do glifo — a mesma cabeça que o jogador vê no mapa.
  // O nome da cena de destino nunca chega aqui (`lib/fogFilter.ts`).
  const viagem = pin.kind === 'viagem'

  return (
    <div className="pp-pincard__backdrop" onPointerDown={onClose}>
      <div
        className="pp-pincard"
        role="dialog"
        aria-modal="true"
        aria-label={viagem ? 'Passagem' : `Ponto de interesse ${PIN_GLYPH[pin.kind]}`}
        // Toque DENTRO do cartão não conta como "tocar fora".
        onPointerDown={(event) => event.stopPropagation()}
      >
        <img
          className="pp-pincard__image"
          src={foto === null ? IMAGEM_AUSENTE : foto}
          alt={foto === null ? 'Este ponto de interesse ainda não tem imagem' : 'Imagem deixada pelo mestre neste ponto de interesse'}
        />
        <div className="pp-pincard__body">
          <span className={viagem ? 'pp-pincard__glyph pp-pincard__glyph--viagem' : 'pp-pincard__glyph'} aria-hidden="true">
            {viagem ? <PinTravelArt size={16} /> : PIN_GLYPH[pin.kind]}
          </span>
          <p className="pp-pincard__text">
            {descricao === '' ? 'O mestre ainda não escreveu nada sobre este ponto.' : descricao}
          </p>
        </div>
        <button ref={closeRef} type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
