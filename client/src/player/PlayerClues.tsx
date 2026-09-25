import { useEffect, useId, useRef } from 'react'
import type { ClueEntry } from '../net/protocol'
import type { ColecaoProgresso } from '../lib/colecao'
import { isPlayerSafePinImage } from '../lib/pins'
import { isEditableTarget } from '../lib/keymap'
import { formatNoteTime } from './PlayerNotebook'
import type { ClueShow, CluePeers } from './playerConnection'

/**
 * MINHAS PISTAS no Caderno: uma linha por pista, a mais nova em cima, pelo
 * título (a primeira linha do cartão). Tocar reabre o cartão com a foto. O
 * texto da pista não fica na lista: ela é índice, o cartão é a leitura.
 */
export function PlayerClueList({ clues, onOpen }: { clues: readonly ClueEntry[]; onOpen: (clueId: string) => void }) {
  if (clues.length === 0) {
    return <p className="pp-empty">Nenhuma pista ainda. O que você lê nos pontos de interesse e ao entrar nas salas fica guardado aqui.</p>
  }
  return (
    <ol className="pp-clues">
      {[...clues].reverse().map((clue) => (
        <li key={clue.id}>
          <button type="button" className="pp-clues__item" onClick={() => onOpen(clue.id)}>
            <span className="pp-clues__title">{clue.title}</span>
            <span className="pp-clues__meta">
              {formatNoteTime(clue.at)}
              {clue.from !== undefined && ` · mostrada por ${clue.from}`}
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}

/**
 * COLEÇÃO DE PISTAS no Caderno: por coleção, o nome, "5 de 12" e uma fileira
 * de casas — cheias as peças que o jogador tem (tocar reabre o cartão da
 * pista, se ela ainda está no caderno), vazias as que faltam, sem dizer onde
 * estão. Completa, a frase inteira aparece embaixo, como texto.
 */
export function PlayerColecaoList({
  colecoes,
  clues,
  onOpen,
}: {
  colecoes: readonly ColecaoProgresso[]
  clues: readonly ClueEntry[]
  onOpen: (clueId: string) => void
}) {
  if (colecoes.length === 0) return null
  const noCaderno = new Set(clues.map((clue) => clue.id))
  return (
    <ul className="pp-colecoes">
      {colecoes.map((colecao) => {
        const pecas = new Map(colecao.partes.map((peca) => [peca.parte, peca.clueId]))
        const casas = Array.from({ length: colecao.total }, (_, index) => index + 1)
        return (
          <li key={colecao.nome} className={colecao.completa ? 'pp-colecao pp-colecao--completa' : 'pp-colecao'}>
            <p className="pp-colecao__head">
              <span className="pp-colecao__nome">{colecao.nome}</span>
              <span className="pp-colecao__conta">
                {colecao.partes.length} de {colecao.total}
              </span>
            </p>
            <ol className="pp-colecao__casas" aria-label={`${colecao.nome}: ${colecao.partes.length} de ${colecao.total}`}>
              {casas.map((parte) => {
                const clueId = pecas.get(parte)
                if (clueId === undefined) {
                  return (
                    <li key={parte}>
                      <span className="pp-colecao__casa" role="img" aria-label={`Peça ${parte} de ${colecao.total}: falta`} />
                    </li>
                  )
                }
                const rotulo = `Peça ${parte} de ${colecao.total}`
                return (
                  <li key={parte}>
                    {noCaderno.has(clueId) ? (
                      <button type="button" className="pp-colecao__casa pp-colecao__casa--cheia" aria-label={rotulo} onClick={() => onOpen(clueId)}>
                        {parte}
                      </button>
                    ) : (
                      <span className="pp-colecao__casa pp-colecao__casa--cheia" role="img" aria-label={rotulo}>
                        {parte}
                      </span>
                    )}
                  </li>
                )
              })}
            </ol>
            {colecao.completa && <p className="pp-colecao__inteira">{colecao.inteira ?? 'Você juntou todas as peças.'}</p>}
          </li>
        )
      })}
    </ul>
  )
}

/** "Mostrar para…" do cartão: o que o host respondeu até agora e as duas ações. */
export interface ClueShareProps {
  peers: CluePeers | undefined
  result: ClueShow | undefined
  onAskPeers: () => void
  onShow: (name: string) => void
}

export interface PlayerClueCardProps {
  clue: ClueEntry
  /** Cabeçalho: o título da pista, ou "Gabi mostrou: Bilhete" no cartão que chegou de um colega. */
  title: string
  onClose: () => void
  /** Ausente = o cartão não oferece mostrar (o que um colega mostrou já está no Caderno de quem recebeu). */
  share?: ClueShareProps
  /** Escape fecha. Desligado enquanto o cartão do pino está aberto: o Escape é dele. */
  escapeCloses?: boolean
  /**
   * Chegou sem o jogador pedir (um colega mostrou): não rouba o foco, como o
   * recado do mestre — ele pode estar no meio de arrastar a ficha ou de digitar.
   */
  arrivedUnasked?: boolean
}

function resultText(result: ClueShow): string {
  if (result.phase === 'sending') return `Mostrando para ${result.to}…`
  if (result.phase === 'ok') return `Mostrado para ${result.to}.`
  // O mestre segura um instante entre duas pistas mostradas; o colega continua aqui.
  if (result.phase === 'too_soon') return `Espere um instante e toque em ${result.to} de novo.`
  // Sem dizer para onde foi: o host só conta que não chegou.
  return `Não deu para mostrar para ${result.to}: não está mais nesta cena.`
}

/**
 * O CARTÃO DA PISTA: o mesmo molde do cartão do pino (foto em cima, texto
 * embaixo, nesta ordem no DOM), aberto do Caderno ou quando um colega mostra.
 * Fecha por Escape, pelo botão e por tocar fora; aberto do Caderno, o foco
 * entra no cartão e volta a quem o abriu ao fechar.
 *
 * O texto entra como filho de texto do React (nunca `innerHTML`), e a foto só
 * em `data:image/` — a mesma fronteira do cartão do pino.
 */
export function PlayerClueCard({ clue, title, onClose, share, escapeCloses = true, arrivedUnasked = false }: PlayerClueCardProps) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const firstPeerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (arrivedUnasked) return
    // Quem abriu pelo Caderno segue com o foco; ao fechar, ele volta à linha da pista.
    const opener = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [arrivedUnasked])

  useEffect(() => {
    if (!escapeCloses) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const alvo = event.target
      if (alvo instanceof HTMLElement && isEditableTarget(alvo.tagName, alvo instanceof HTMLInputElement ? alvo.type : undefined, alvo.isContentEditable)) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [escapeCloses, onClose])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const alvo = event.target
      if (alvo instanceof Node && cardRef.current?.contains(alvo)) return
      onClose()
      // No mapa o toque só fecha (não arrasta nem abre outro pino); nos painéis segue para o controle tocado.
      if (alvo instanceof HTMLCanvasElement) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [onClose])

  const peersReady = share?.peers?.phase === 'ready'
  useEffect(() => {
    // A lista chegou: quem veio pelo teclado já está no primeiro nome.
    if (peersReady) firstPeerRef.current?.focus()
  }, [peersReady])

  const foto = isPlayerSafePinImage(clue.image) ? clue.image : null
  const sending = share?.result?.phase === 'sending'

  return (
    <div className="pp-pincard__backdrop">
      <div ref={cardRef} className="pp-pincard pp-cluecard" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {foto !== null && <img className="pp-pincard__image" src={foto} alt="Imagem guardada com esta pista" />}
        <h2 id={titleId} className="pp-cluecard__title">
          {title}
        </h2>
        {clue.text !== '' && <p className="pp-pincard__text pp-cluecard__text">{clue.text}</p>}
        {share !== undefined && share.peers === undefined && (
          <button type="button" className="pp-pincard__travel" onClick={share.onAskPeers}>
            Mostrar para…
          </button>
        )}
        {share?.peers?.phase === 'loading' && (
          <p className="pp-cluecard__status" role="status">
            Procurando quem está nesta cena…
          </p>
        )}
        {share?.peers?.phase === 'ready' && share.peers.names.length === 0 && (
          <p className="pp-cluecard__status" role="status">
            Ninguém mais está nesta cena agora.
          </p>
        )}
        {share?.peers?.phase === 'ready' && share.peers.names.length > 0 && (
          <ul className="pp-pincard__exits" aria-label="Mostrar para">
            {share.peers.names.map((name, index) => (
              <li key={name}>
                <button ref={index === 0 ? firstPeerRef : undefined} type="button" className="pp-pincard__travel" disabled={sending} onClick={() => share.onShow(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {share?.result !== undefined && (
          <p className="pp-cluecard__status" role="status">
            {resultText(share.result)}
          </p>
        )}
        <button ref={closeRef} type="button" className="pp-pincard__close" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  )
}
