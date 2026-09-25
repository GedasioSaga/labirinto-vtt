import { useEffect, useRef } from 'react'
import type { CluePeers, MapShare } from './playerConnection'

/**
 * PASSAR O MAPA — "Mostrar meu mapa a…" no painel do jogador. Um botão pede a
 * lista de quem está NESTA cena; cada colega vira um botão; a linha de status
 * conta o que o host respondeu. O que passa é o que o jogador explorou nesta
 * cena, e só o colega escolhido passa a conhecer. Aberta, "Fechar" (ou
 * Escape num nome da lista) a recolhe e devolve o foco ao botão que a abre.
 */
export interface PlayerMapShareProps {
  peers: CluePeers | undefined
  result: MapShare | undefined
  onAskPeers: () => void
  onShare: (name: string) => void
  /** Recolhe a lista e o resultado (o dono zera `peers` e `result`). */
  onClose: () => void
}

/**
 * O aviso de quem recebe: quem mostrou, e nada de lugar (o nome da cena é do
 * mestre). `null` = MAPA DE PAPEL do mestre, que pode ser de outra cena: o
 * aviso não promete que já aparece aqui.
 */
export function mapSharedNoticeText(from: string | null): string {
  if (from === null) return 'O mestre te deu um mapa. As salas dele aparecem no seu quando você estiver lá.'
  return `${from} mostrou o próprio mapa a você. O trecho explorado já aparece no seu.`
}

function resultText(result: MapShare): string {
  if (result.phase === 'sending') return `Mostrando o mapa a ${result.to}…`
  if (result.phase === 'ok') return `${result.to} agora conhece o que você explorou nesta cena.`
  // O mestre segura um instante entre dois mapas mostrados; o colega continua aqui.
  if (result.phase === 'too_soon') return `Espere um instante e toque em ${result.to} de novo.`
  // Sem dizer para onde foi: o host só conta que não chegou.
  return `Não deu para mostrar a ${result.to}: não está mais nesta cena.`
}

export function PlayerMapShare({ peers, result, onAskPeers, onShare, onClose }: PlayerMapShareProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const firstPeerRef = useRef<HTMLButtonElement | null>(null)
  const peersReady = peers?.phase === 'ready'
  useEffect(() => {
    // A lista chegou: quem veio pelo teclado já está no primeiro nome.
    if (peersReady) firstPeerRef.current?.focus()
  }, [peersReady])
  const sending = result?.phase === 'sending'
  // Esperando o host (a lista ou o envio): fechar agora e a resposta reabriria sozinha.
  const busy = peers?.phase === 'loading' || sending
  const open = peers !== undefined || result !== undefined
  const close = () => {
    // O foco vai antes ao botão que abre: o "Fechar" some junto com a lista.
    triggerRef.current?.focus()
    onClose()
  }

  return (
    <>
      {/* Fica sempre: com a lista aberta, tocar de novo refaz a pergunta (alguém chegou ou saiu da cena). */}
      <button ref={triggerRef} type="button" className="pp-button" disabled={busy} onClick={onAskPeers}>
        Mostrar meu mapa a…
      </button>
      {peers?.phase === 'loading' && (
        <p className="pp-empty" role="status">
          Procurando quem está nesta cena…
        </p>
      )}
      {peers?.phase === 'ready' && peers.names.length === 0 && (
        <p className="pp-empty" role="status">
          Ninguém mais está nesta cena agora.
        </p>
      )}
      {peers?.phase === 'ready' && peers.names.length > 0 && (
        <ul
          className="pp-list"
          aria-label="Mostrar meu mapa a"
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || busy) return
            // O Escape é da lista: sem isto ele chega à janela e fecha a gaveta junto.
            event.stopPropagation()
            close()
          }}
        >
          {peers.names.map((name, index) => (
            <li key={name}>
              <button ref={index === 0 ? firstPeerRef : undefined} type="button" className="pp-button" disabled={sending} onClick={() => onShare(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {result !== undefined && (
        <p className="pp-empty" role="status">
          {resultText(result)}
        </p>
      )}
      {open && (
        <button type="button" className="pp-button" disabled={busy} onClick={close}>
          Fechar
        </button>
      )}
    </>
  )
}
