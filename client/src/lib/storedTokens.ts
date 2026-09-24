import type { MapData, Token } from '../types/map'

/**
 * GUARDAR FICHA de quem foi embora: a ficha sai do mapa do editor, e a cópia
 * fica com a ponte da sala até ele voltar (ou até Dispensar / fechar a sala).
 * Só do mestre; nunca vai pela rede.
 *
 * O arquivo em disco nunca perde a ficha guardada: quem grava passa por
 * `withStoredTokens`, e a ficha volta ao arquivo na cena de onde saiu. Sem
 * isso, "Guardar ficha" + Salvar + fechar a janela apagava a ficha para sempre
 * (a cópia só existia na memória da ponte).
 */
export interface StoredToken {
  token: Token
  /** Cena de onde a ficha saiu; `null` = mapa solto. */
  sceneId: string | null
}

/**
 * As fichas guardadas que moram na cena `sceneId` na hora de gravar: as que
 * saíram dela e, se ela é a cena aberta, as que saíram de uma cena que já não
 * existe (ou do mapa solto, antes de ele virar aventura). É a mesma regra da
 * devolução ao mapa ("sumida a cena, na aberta"), para a ficha nunca ficar sem
 * arquivo.
 */
export function storedTokensOfScene(
  stored: readonly StoredToken[],
  sceneId: string,
  scenes: { ids: ReadonlySet<string>; activeId: string },
): StoredToken[] {
  const isActive = sceneId === scenes.activeId
  return stored.filter((entry) => entry.sceneId === sceneId || (isActive && (entry.sceneId === null || !scenes.ids.has(entry.sceneId))))
}

/**
 * `map` como vai para o disco: com as fichas guardadas `stored` de volta.
 * Ficha que já está no mapa (o mestre desfez a retirada) não entra de novo.
 * Sem nada a acrescentar, devolve o próprio `map` (mesma referência).
 */
export function withStoredTokens(map: MapData, stored: readonly StoredToken[]): MapData {
  const present = new Set(map.tokens.map((token) => token.id))
  const missing: Token[] = []
  for (const { token } of stored) {
    if (present.has(token.id)) continue
    present.add(token.id)
    missing.push(token)
  }
  return missing.length === 0 ? map : { ...map, tokens: [...map.tokens, ...missing] }
}
