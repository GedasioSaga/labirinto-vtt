import { useMapStore } from './mapStore'
import { criarMovel } from '../lib/mobilia'
import { roomCentroid, roomRotationOf } from '../lib/roomRotation'
import { selectionOfItem } from '../lib/selectionModel'
import type { Region, TipoMobilia } from '../types/map'

/**
 * MOBÍLIA DESENHADA — o que o botão "Catre"/"Mesa"/"Baú" do painel da sala
 * faz no mapa. O móvel nasce no centro da sala, deitado no giro dela, e fica
 * selecionado para o mestre arrastar e girar pelos controles de sempre do
 * objeto. Um passo só no desfazer (`addProp`).
 *
 * Fora do App para a ligação ser testada de ponta a ponta com o painel de
 * verdade (`mobiliaNaSala.test.tsx`). Região que não é sala (ou nada
 * selecionado) não oferece mobília: devolve `undefined` e a seção some.
 */
export function porMobiliaNaSala(
  sala: Pick<Region, 'points' | 'room'> | null,
  novoId: () => string = () => crypto.randomUUID(),
): ((tipo: TipoMobilia) => void) | undefined {
  if (sala?.room === undefined) return undefined
  const { points, room } = sala
  return (tipo) => {
    const store = useMapStore.getState()
    const movel = criarMovel(tipo, roomCentroid(points), store.map.grid, novoId())
    const giro = roomRotationOf(room)
    store.addProp(giro === 0 ? movel : { ...movel, rotation: giro })
    store.setSelection(selectionOfItem({ kind: 'prop', id: movel.id }))
  }
}
