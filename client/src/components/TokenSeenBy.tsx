import { useCallback, useSyncExternalStore } from 'react'

export interface TokenSeenByProps {
  tokenId: string
  /** `HostBridge.watchPlayerScreens`: avisa a cada recorte novo que sai para um jogador. */
  watch(listener: () => void): () => void
  /** `HostBridge.tokenSeenBy`: nomes de quem vê a ficha agora; `null` = não se aplica. */
  read(tokenId: string): string[] | null
}

/** A frase do painel; `null` = não desenhar (sala fechada ou ficha com dono). */
export function seenByText(names: readonly string[] | null): string | null {
  if (names === null) return null
  return names.length === 0 ? 'Ninguém vê' : `Visto por: ${names.join(', ')}`
}

/**
 * "Visto por" da ficha sem dono: o mestre pergunta em voz alta quem vê o
 * guarda, e a resposta está no painel. Redesenha a cada recorte que sai pelo
 * fio — no arrasto também —, só este bloco, sem re-renderizar o app.
 *
 * O snapshot é a FRASE (string), não o array: `useSyncExternalStore` compara
 * por `Object.is`, e um array novo a cada leitura redesenharia sem parar.
 */
export function TokenSeenBy({ tokenId, watch, read }: TokenSeenByProps) {
  const snapshot = useCallback(() => seenByText(read(tokenId)), [read, tokenId])
  const text = useSyncExternalStore(watch, snapshot)
  if (text === null) return null
  return <p className="lb-label">{text}</p>
}
