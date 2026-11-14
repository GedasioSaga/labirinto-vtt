import { NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import { personagemComFormaAtiva } from '../lib/mudarFicha'
import { sistemaAtivo, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { sistemaPorId, useRpgStore } from './rpgStore'

/**
 * MUDAR FICHA (pedido de 14/11/2026), a porta do menu do botão direito: o
 * token passa a mostrar a imagem da transformação `formaId` (`null` = a imagem
 * base) E a ficha de personagem ligada marca essa transformação como Ativa,
 * sem cobrar custo (`personagemComFormaAtiva`); a base desliga as formas.
 *
 * O token muda num passo do Ctrl+Z (`setTokenFormaVisivel`). A ficha grava
 * pelo caminho de sempre do ajuste rápido (`ajustarPersonagem`), que não é do
 * Ctrl+Z do mapa: desfazer devolve a imagem, não a marca de Ativa.
 */
export function mudarFichaDoToken(tokenId: string, formaId: string | null): void {
  const token = useMapStore.getState().map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return
  useMapStore.getState().setTokenFormaVisivel(tokenId, formaId)
  if (token.characterId === null) return
  const aventura = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura))
  if (sistema === undefined) return
  aventura.ajustarPersonagem(token.characterId, (atual) => personagemComFormaAtiva(atual, sistema, formaId, NOME_DO_MESTRE, Date.now()))
}
