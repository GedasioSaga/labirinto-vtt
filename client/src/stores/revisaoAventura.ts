import { aplicarConserto, type Conserto } from '../lib/revisorAventura'
import { useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'

/**
 * O conserto do REVISOR DA AVENTURA aplicado onde a cena mora.
 *
 * Cena aberta (ou o mapa solto, id `''`): o conserto vira UM passo de desfazer
 * do editor — o mesmo par "muda o mapa, depois `commitDragHistory(antes)`" do
 * arrasto do pino —, e o Ctrl+Z o desfaz. Cena de fundo: muda o mapa do cache
 * e marca a cena para salvar (`updateBackgroundScene`), como qualquer mudança
 * feita de fora dela; o desfazer da cena aberta não é tocado.
 *
 * Devolve `false` quando nada mudou (o item sumiu ou já estava consertado).
 */
export function consertarNaAventura(sceneId: string, conserto: Conserto): boolean {
  const aventura = useAdventureStore.getState()
  if (aventura.adventure === null || sceneId === '' || sceneId === aventura.activeSceneId) {
    const antes = useMapStore.getState().map
    const depois = aplicarConserto(antes, conserto)
    if (depois === antes) return false
    useMapStore.setState({ map: depois })
    useMapStore.getState().commitDragHistory(antes)
    return true
  }
  let mudou = false
  aventura.updateBackgroundScene(sceneId, (map) => {
    const depois = aplicarConserto(map, conserto)
    mudou = depois !== map
    return depois
  })
  return mudou
}
