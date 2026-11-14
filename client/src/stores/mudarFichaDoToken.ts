import { NOME_DO_MESTRE } from '../lib/ajusteDaFicha'
import { personagemComFormaAtiva, tokenNaBatalha } from '../lib/mudarFicha'
import { sistemaAtivo, useAdventureStore } from './adventureStore'
import { useBatalhaDBTStore } from './batalhaDBTStore'
import { useBatalhaStore } from './batalhaStore'
import { useMapStore } from './mapStore'
import { sistemaPorId, useRpgStore } from './rpgStore'

/** A dica embaixo do "Mudar ficha" apagado quando o token está na batalha (`tokenNaBatalha`). */
export const MOTIVO_NA_BATALHA = 'Na batalha, troque a forma pelo menu da batalha.'

/** A chave da cena aberta no mapa do mestre: a mesma do `App.tsx` (o id da cena, senão o do mapa). */
export function chaveDaCenaAberta(): string {
  return useAdventureStore.getState().activeSceneId ?? useMapStore.getState().map.id
}

/** O token `tokenId`, do mapa aberto, está numa batalha ligada (One Piece ou Dragon Ball Tales)? */
export function tokenDoMapaNaBatalha(tokenId: string): boolean {
  const token = useMapStore.getState().map.tokens.find((t) => t.id === tokenId)
  if (token === undefined) return false
  return tokenNaBatalha(chaveDaCenaAberta(), token.characterId, { onePiece: useBatalhaStore.getState().cenas, dragonBall: useBatalhaDBTStore.getState().cenas })
}

/**
 * MUDAR FICHA (pedido de 14/11/2026), a porta do menu do botão direito: o
 * token passa a mostrar a imagem da transformação `formaId` (`null` = a imagem
 * base) E a ficha de personagem ligada marca essa transformação como Ativa,
 * sem cobrar custo (`personagemComFormaAtiva`); a base desliga as formas.
 *
 * O token muda num passo do Ctrl+Z (`setTokenFormaVisivel`). A ficha grava
 * pelo caminho de sempre do ajuste rápido (`ajustarPersonagem`), que não é do
 * Ctrl+Z do mapa: desfazer devolve a imagem, não a marca de Ativa.
 *
 * Na batalha não muda nada (o menu já mostra o item apagado): a forma da
 * batalha se troca pelo menu dela, com o custo e o fim da forma de lá.
 */
export function mudarFichaDoToken(tokenId: string, formaId: string | null): void {
  const token = useMapStore.getState().map.tokens.find((t) => t.id === tokenId)
  if (token === undefined || tokenDoMapaNaBatalha(tokenId)) return
  useMapStore.getState().setTokenFormaVisivel(tokenId, formaId)
  if (token.characterId === null) return
  const aventura = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(aventura))
  if (sistema === undefined) return
  aventura.ajustarPersonagem(token.characterId, (atual) => personagemComFormaAtiva(atual, sistema, formaId, NOME_DO_MESTRE, Date.now()))
}
