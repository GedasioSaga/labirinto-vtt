import { useEffect, useRef } from 'react'
import type { ClueShow, CluePeers } from './playerConnection'

/** "Mostrar a…" da régua: o que o host respondeu até agora e as duas ações. */
export interface RouteShareProps {
  peers: CluePeers | undefined
  result: ClueShow | undefined
  onAskPeers: () => void
  onShow: (name: string) => void
}

function resultText(result: ClueShow): string {
  if (result.phase === 'sending') return `Mostrando o caminho a ${result.to}…`
  if (result.phase === 'ok') return `Caminho mostrado a ${result.to}.`
  // O mestre segura um instante entre dois caminhos mostrados; o colega continua aqui.
  if (result.phase === 'too_soon') return `Espere um instante e toque em ${result.to} de novo.`
  // O host só recusa quem não está mais na cena, e sem dizer para onde foi.
  return `O caminho não chegou a ${result.to}: não está mais nesta cena.`
}

/**
 * CAMINHO DA RÉGUA, lado de quem mediu: com uma medida solta na tela, "Mostrar
 * a…" pede os colegas da mesma cena e cada nome manda o traço a ele. Não é
 * diálogo: o mapa continua na mão, e medir de novo troca o traço que vai.
 */
export function PlayerRouteShare({ peers, result, onAskPeers, onShow }: RouteShareProps) {
  const firstPeerRef = useRef<HTMLButtonElement | null>(null)
  const peersReady = peers?.phase === 'ready'
  useEffect(() => {
    // A lista chegou: quem veio pelo teclado (tocou "Mostrar a…") já está no primeiro nome.
    if (peersReady) firstPeerRef.current?.focus()
  }, [peersReady])
  const sending = result?.phase === 'sending'

  return (
    <section className="pp-route-share" aria-label="Mostrar este caminho">
      {peers === undefined && (
        <button type="button" className="pp-route-share__ask" onClick={onAskPeers}>
          Mostrar a…
        </button>
      )}
      {peers?.phase === 'loading' && (
        <p className="pp-route-share__status" role="status">
          Procurando quem está nesta cena…
        </p>
      )}
      {peers?.phase === 'ready' && peers.names.length === 0 && (
        <p className="pp-route-share__status" role="status">
          Ninguém mais está nesta cena agora.
        </p>
      )}
      {peers?.phase === 'ready' && peers.names.length > 0 && (
        <ul className="pp-route-share__peers" aria-label="Mostrar o caminho a">
          {peers.names.map((name, index) => (
            <li key={name}>
              <button ref={index === 0 ? firstPeerRef : undefined} type="button" className="pp-route-share__peer" disabled={sending} onClick={() => onShow(name)}>
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {result !== undefined && (
        <p className="pp-route-share__status" role="status">
          {resultText(result)}
        </p>
      )}
    </section>
  )
}

/**
 * CAMINHO DA RÉGUA, lado de quem recebe: o aviso de que um colega mostrou um
 * caminho (o traço já está no mapa). Chega sem o jogador pedir, então não
 * rouba o foco — ele pode estar arrastando a ficha ou digitando.
 */
export function PlayerSharedRouteNotice({ from, onDismiss }: { from: string; onDismiss: () => void }) {
  return (
    <div className="pp-route-notice" role="status">
      <span>{from} mostrou um caminho no mapa.</span>
      <button type="button" className="pp-route-notice__dismiss" onClick={onDismiss}>
        Dispensar
      </button>
    </div>
  )
}
