import { useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import type { MapData } from '../types/map'
import { temLigacaoAoPreludio } from './falasDoPino'
import { preparoLigado } from './preparo/chave'

/**
 * A PORTA DO PINO LIGADO AO PRELÚDIO no pacote principal (P3): pequena de
 * propósito. Fica olhando se o mapa aberto (ou uma cena de fundo dele) tem pino
 * ligado (ou "?" com entrada ligada, P5); no primeiro que aparecer, com a chave
 * do Prelúdio ligada, baixa quem mantém o texto deles em dia
 * (`preludio/mesa/pinosLigados.ts`). Mapa sem pino ligado não baixa nada nem
 * lê o Prelúdio, até a ficha de um "?" pedir os Personagens
 * (`lerPreludioParaAFicha`).
 *
 * Liga-se UMA VEZ, na raiz do app: `useEffect(() => vigiarPinosLigados(), [])`.
 * Devolve o cancelamento.
 */

function temPinoLigado(map: MapData): boolean {
  return map.pins.some(temLigacaoAoPreludio)
}

let baixou = false
let pararDeVigiar: (() => void) | null = null

function baixar(): void {
  if (baixou || !preparoLigado()) return
  baixou = true
  pararDeVigiar?.()
  pararDeVigiar = null
  import('../preludio/mesa/pinosLigados').then(
    ({ ligarPinosLigados }) => ligarPinosLigados(),
    () => {
      // O pedaço não baixou (app atualizado com ele aberto): o pino fica com a cópia de reserva até abrir de novo.
    },
  )
}

/** A ficha do "?" quer escolher quem diz (P5): lê o Prelúdio nesta janela, se a chave está ligada. */
export function lerPreludioParaAFicha(): void {
  baixar()
}

export function vigiarPinosLigados(): () => void {
  const conferir = () => {
    if (baixou || !preparoLigado()) return
    const aventura = useAdventureStore.getState()
    const algum = temPinoLigado(useMapStore.getState().map) || Object.values(aventura.cache).some((slot) => slot.status === 'ok' && temPinoLigado(slot.map))
    if (algum) baixar()
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
    if (pararDeVigiar === parar) pararDeVigiar = null
  }
  pararDeVigiar = parar
  conferir()
  return parar
}
