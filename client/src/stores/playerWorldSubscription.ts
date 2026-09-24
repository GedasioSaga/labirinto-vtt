import { useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'

/**
 * Assina tudo o que os jogadores veem: o mapa da cena aberta e as cenas de
 * fundo. O host monta o snapshot dos jogadores com as duas (`hostWorldOf`), e
 * há mudança que só mexe no fundo — trancar os dois lados com este lado já
 * trancado grava só o par, pelo `updateBackgroundScene`, e o mapa aberto não
 * muda. Sem assinar o cache, quem está na cena do par seguia vendo o valor
 * antigo até a próxima mudança na cena aberta.
 */
export function subscribeToPlayerWorldChanges(onChange: () => void): () => void {
  const pararMapa = useMapStore.subscribe((state) => state.map, onChange)
  const pararFundo = useAdventureStore.subscribe((state, previous) => {
    if (state.cache !== previous.cache) onChange()
  })
  return () => {
    pararMapa()
    pararFundo()
  }
}
