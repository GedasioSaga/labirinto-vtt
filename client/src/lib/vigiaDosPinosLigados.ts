import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData } from '../types/map'
import { preparoLigado } from './preparo/chave'

/**
 * A PORTA DO PINO LIGADO AO PRELÚDIO no pacote principal (P3): pequena de
 * propósito. Fica olhando se o mapa aberto (ou uma cena de fundo dele) tem pino
 * ligado; no primeiro que aparecer, com a chave do Prelúdio ligada, baixa quem
 * mantém o texto deles em dia (`preludio/mesa/pinosLigados.ts`). Mapa sem pino
 * ligado não baixa nada nem lê o Prelúdio.
 *
 * Liga-se UMA VEZ, na raiz do app: `useEffect(() => vigiarPinosLigados(), [])`.
 * Devolve o cancelamento.
 */

function temPinoLigado(map: MapData): boolean {
  return map.pins.some((pin) => pin.fonte !== undefined)
}

export function vigiarPinosLigados(): () => void {
  let baixou = false
  const conferir = () => {
    if (baixou || !preparoLigado()) return
    const aventura = useAdventureStore.getState()
    const algum = temPinoLigado(useMapStore.getState().map) || Object.values(aventura.cache).some((slot) => slot.status === 'ok' && temPinoLigado(slot.map))
    if (!algum) return
    baixou = true
    parar()
    import('../preludio/mesa/pinosLigados').then(
      ({ ligarPinosLigados }) => ligarPinosLigados(),
      () => {
        // O pedaço não baixou (app atualizado com ele aberto): o pino fica com a cópia de reserva até abrir de novo.
      },
    )
  }
  const pararMapa = useMapStore.subscribe((estado, antes) => {
    if (estado.map.pins !== antes.map.pins) conferir()
  })
  const pararAventura = useAdventureStore.subscribe((estado, antes) => {
    if (estado.cache !== antes.cache) conferir()
  })
  function parar() {
    pararMapa()
    pararAventura()
  }
  conferir()
  return parar
}
