import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PinItem } from '../types/map'
import { quantidadeDe } from '../lib/items'
import { useImagemDaMesa } from '../components/ImagemDaMesa'

/** O que o cartão diz quando nenhuma ficha do jogador alcança o item (a mesma régua do host). */
export const TEXTO_LONGE_DO_ITEM = 'Chegue mais perto para pegar.'

interface PlayerItemCardProps {
  /** O item como veio no recorte (`itemParaJogador`): nome, imagem por referência, descrição, categoria, quantidade. */
  item: PinItem
  /** Texto do PINO de item, quando o mestre escreveu um e o item não tem descrição própria. */
  textoDoPino?: string
  onClose: () => void
  /** "Pegar" (pega direto) ou "Pedir para pegar". Ausente = o cartão só mostra. */
  onTake?: () => void
  /** Já há um "Pegar" esperando o mestre: o botão fica desligado. */
  takeWaiting?: boolean
  /** Nenhuma ficha do jogador alcança o item: o botão apaga e o cartão diz por quê. */
  longe?: boolean
}

/**
 * CARTÃO DO ITEM (entrega 5): o toque num item do mapa — a imagem deitada no
 * chão ou o pino de item. A IMAGEM GRANDE em cima, com "Ver inteira" para a
 * imagem na tela toda (pedido da fila do usuário); embaixo o nome, a categoria
 * e a quantidade, a descrição e "Pegar" (o item é "Pega direto") ou "Pedir
 * para pegar" (o mestre decide na caixa de Pedidos).
 *
 * Mesmo lugar, mesma moldura e mesmo jeito de fechar do cartão do pino
 * (`PlayerPinCard`): Escape, "Fechar" e tocar fora. Com a imagem inteira
 * aberta, o Escape e o toque fecham só ela, e o foco volta ao "Ver inteira".
 */
export function PlayerItemCard({ item, textoDoPino, onClose, onTake, takeWaiting = false, longe = false }: PlayerItemCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const inteiraRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const verInteiraRef = useRef<HTMLButtonElement | null>(null)
  const fecharInteiraRef = useRef<HTMLButtonElement | null>(null)
  const [inteira, setInteira] = useState(false)
  // Lido pelos ouvintes da janela sem religá-los a cada troca (religar tiraria o foco do "Fechar").
  const inteiraAbertaRef = useRef(false)
  inteiraAbertaRef.current = inteira
  // Imagem que não carrega (a sala caiu) some em vez de virar o ícone de imagem quebrada.
  const [falhou, setFalhou] = useState<string | null>(null)
  const resolver = useImagemDaMesa()
  const resolvida = resolver(item.imagem)
  const src = resolvida !== null && resolvida !== falhou ? resolvida : null

  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (inteiraAbertaRef.current) {
        setInteira(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    // Tocar fora fecha, como no cartão do pino. A imagem inteira mora num
    // portal fora do cartão: tocar nela fecha só ela (o botão e o fundo dela).
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && (cardRef.current?.contains(alvo) || inteiraRef.current?.contains(alvo))) return
      onClose()
      if (alvo instanceof HTMLCanvasElement) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  // Abrir leva o foco ao "Fechar imagem"; fechar devolve ao "Ver inteira" (quem veio pelo teclado não se perde).
  const abriuInteiraRef = useRef(false)
  useEffect(() => {
    if (inteira) {
      abriuInteiraRef.current = true
      fecharInteiraRef.current?.focus()
    } else if (abriuInteiraRef.current) {
      abriuInteiraRef.current = false
      verInteiraRef.current?.focus()
    }
  }, [inteira])

  const quantidade = quantidadeDe(item)
  const detalhes = [item.categoria, quantidade > 1 ? `Quantidade: ${quantidade}` : undefined].filter((parte): parte is string => parte !== undefined && parte !== '')
  const texto = item.descricao ?? (textoDoPino !== undefined && textoDoPino.trim() !== '' ? textoDoPino.trim() : undefined)
  const pede = item.livre !== true
  const rotuloDoBotao = takeWaiting ? 'Pedido enviado ao mestre' : pede ? 'Pedir para pegar' : 'Pegar'

  return (
    <div className="pp-pincard__backdrop">
      <div ref={cardRef} className={src === null ? 'pp-pincard pp-pincard--compacto' : 'pp-pincard'} role="dialog" aria-modal="true" aria-label={item.nome}>
        {src !== null && (
          <div className="pp-itemcard__foto">
            <img className="pp-pincard__image" src={src} alt={item.nome} onError={() => setFalhou(src)} />
            <button
              ref={verInteiraRef}
              type="button"
              className="pp-itemcard__ver-inteira"
              aria-label={`Ver a imagem de ${item.nome} inteira`}
              aria-haspopup="dialog"
              onClick={() => setInteira(true)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Ver inteira
            </button>
          </div>
        )}
        <div className="pp-pincard__body">
          <p className="pp-pincard__title">{item.nome}</p>
          {detalhes.length > 0 && <p className="pp-itemcard__detalhes">{detalhes.join(' · ')}</p>}
          {texto !== undefined && <p className="pp-pincard__text">{texto}</p>}
        </div>
        {onTake !== undefined && (
          // Sem confirmação, como o "Pegar" do pino: no "Pede ao mestre" o mestre
          // ainda decide, e no "Pega direto" o item só troca do chão para a mochila.
          <>
            <button type="button" className="pp-pincard__travel" disabled={takeWaiting || longe} onClick={onTake}>
              {rotuloDoBotao}
            </button>
            {longe && !takeWaiting && <p className="pp-itemcard__longe">{TEXTO_LONGE_DO_ITEM}</p>}
          </>
        )}
        <button ref={closeRef} type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
      {inteira &&
        src !== null &&
        createPortal(
          <div
            ref={inteiraRef}
            className="pp-itemcard__inteira"
            role="dialog"
            aria-modal="true"
            aria-label={`Imagem de ${item.nome}`}
            onClick={(event) => {
              // O fundo fecha; a imagem em si não (quem toca a imagem quer olhar).
              if (event.target === event.currentTarget) setInteira(false)
            }}
          >
            <img className="pp-itemcard__inteira-img" src={src} alt={item.nome} />
            <button ref={fecharInteiraRef} type="button" className="pp-itemcard__fechar-inteira" onClick={() => setInteira(false)}>
              Fechar imagem
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
