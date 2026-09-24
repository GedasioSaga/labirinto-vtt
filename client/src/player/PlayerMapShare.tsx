import { useEffect, useRef } from 'react'
import type { CluePeers, MapShare } from './playerConnection'

/**
 * PASSAR O MAPA — "Mostrar meu mapa a…" no painel do jogador. Um botão pede a
 * lista de quem está NESTA cena; cada colega vira um botão; a linha de status
 * conta o que o host respondeu. O que passa é o que o jogador explorou nesta
 * cena, e só o colega escolhido passa a conhecer.
 */
export interface PlayerMapShareProps {
  peers: CluePeers | undefined
  result: MapShare | undefined
  onAskPeers: () => void
  onShare: (name: string) => void
}

/** O aviso de quem recebe: quem mostrou, e nada de lugar (o nome da cena é do mestre). */
export function mapSharedNoticeText(from: string): string {
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

export function PlayerMapShare({ peers, result, onAskPeers, onShare }: PlayerMapShareProps) {
  const firstPeerRef = useRef<HTMLButtonElement | null>(null)
  const peersReady = peers?.phase === 'ready'
  useEffect(() => {
    // A lista chegou: quem veio pelo teclado já está no primeiro nome.
    if (peersReady) firstPeerRef.current?.focus()
  }, [peersReady])
  const sending = result?.phase === 'sending'

  return (
    <>
      {/* Fica sempre: com a lista aberta, tocar de novo refaz a pergunta (alguém chegou ou saiu da cena). */}
      <button type="button" className="pp-button" disabled={peers?.phase === 'loading' || sending} onClick={onAskPeers}>
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
        <ul className="pp-list" aria-label="Mostrar meu mapa a">
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
    </>
  )
}
