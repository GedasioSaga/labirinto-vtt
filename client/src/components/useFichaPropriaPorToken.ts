import { useEffect, useMemo } from 'react'
import { fichaDeUmTokenSo } from '../lib/ligarFicha'
import type { Token } from '../types/map'
import { personagensAtivos, useAdventureStore } from '../stores/adventureStore'
import { useBatalhaDBTStore } from '../stores/batalhaDBTStore'
import { useBatalhaStore } from '../stores/batalhaStore'
import { separarFichasRepetidasDaCena } from '../stores/fichaPropriaDoToken'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'

/** Separa os ids da chave; nenhum id de personagem tem esta letra (`novoIdDePersonagem`, uuid). */
const SEPARADOR = '|'

/** Os `characterId` que aparecem em 2+ tokens da cena, em ordem: a chave só muda quando a repetição muda (não a cada passo do arrasto). */
function chaveDosRepetidos(tokens: readonly Pick<Token, 'characterId'>[]): string {
  const vistos = new Set<string>()
  const repetidos = new Set<string>()
  for (const { characterId } of tokens) {
    if (characterId === null) continue
    if (vistos.has(characterId)) repetidos.add(characterId)
    else vistos.add(characterId)
  }
  return [...repetidos].sort().join(SEPARADOR)
}

/**
 * UMA FICHA POR TOKEN DE NPC, a migração (bug de 25/11/2026): a cena aberta
 * com tokens de NPC que dividem a ficha (save de antes do conserto, ou uma
 * porta que ainda não dá a cópia) dá a cada um a sua, com a vida de agora
 * (`separarFichasRepetidasDaCena`). Idempotente: depois dela a cena não tem
 * repetição e nada roda. Com batalha ligada na cena, espera ela acabar (a
 * carta da ordem lê pelo personagem e perderia a ficha no meio da luta).
 */
export function useFichaPropriaPorToken(): void {
  const repetidos = useMapStore((state) => chaveDosRepetidos(state.map.tokens))
  const mapaId = useMapStore((state) => state.map.id)
  const cenaId = useAdventureStore((state) => state.activeSceneId)
  const personagens = useAdventureStore(personagensAtivos)
  // A mesma chave da cena de `chaveDaCenaAberta` (stores/mudarFichaDoToken.ts).
  const sceneKey = cenaId ?? mapaId
  const naBatalha = useBatalhaStore((state) => Object.hasOwn(state.cenas, sceneKey))
  const naBatalhaDBT = useBatalhaDBTStore((state) => Object.hasOwn(state.cenas, sceneKey))
  const precisa = useMemo(() => {
    if (repetidos === '') return false
    const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
    return repetidos.split(SEPARADOR).some((id) => {
      const ficha = porId.get(id)
      return ficha !== undefined && fichaDeUmTokenSo(ficha)
    })
  }, [repetidos, personagens])
  useEffect(() => {
    if (!precisa || naBatalha || naBatalhaDBT) return
    const separados = separarFichasRepetidasDaCena()
    if (separados === 0) return
    const quem = separados === 1 ? '1 token de NPC ganhou ficha própria' : `${separados} tokens de NPC ganharam ficha própria`
    useToastStore.getState().push('info', `${quem}: cada um com a própria vida, cópia numerada do modelo.`)
  }, [precisa, naBatalha, naBatalhaDBT])
}
