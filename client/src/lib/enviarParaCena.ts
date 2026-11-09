import type { MapData, Pin } from '../types/map'
import type { Adventure } from './adventure'
import { arrivalSpot, arrivalSpotWithoutPin } from './pinTravel'
import type { Point } from './tokenSize'

/**
 * "ENVIAR PARA CENA ›" do clique direito no token — a parte pura: para quais
 * cenas o menu oferece mandar, e onde a ficha chega lá. Quem move de verdade
 * (e põe o envio no Ctrl+Z) é `stores/enviarParaCena.ts`.
 */

/** Uma linha do submenu: a cena e, quando ela não recebe agora, o porquê. */
export interface CenaDoEnvio {
  id: string
  nome: string
  /** `null` = recebe. Texto = aparece desligada, com o motivo na dica. */
  motivo: string | null
  /** A palavra ao lado do nome da desligada ("abrindo", "não abriu"); `null` na que recebe. */
  estado: string | null
}

/** As outras cenas do mapa e, quando não há nenhuma, o motivo do item desligado. */
export interface OpcoesDoEnvio {
  cenas: CenaDoEnvio[]
  /** `null` = há para onde mandar. Texto = o item "Enviar para cena" desligado, com a dica. */
  motivo: string | null
}

/** O mapa tem só a cena aberta (ou é um mapa solto): não há para onde mandar. */
export const MOTIVO_SO_UMA_CENA = 'Este mapa só tem esta cena. Crie outra em Cenas para mandar fichas para lá.'

/** Só o que a lista precisa saber de cada cena guardada: se ela já abriu. */
type SituacaoDasCenas = Readonly<Record<string, { status: string } | undefined>>

/**
 * As cenas DESTE mapa para onde a ficha pode ir: todas menos a aberta, na
 * ordem da lista Cenas. A que ainda está vindo do disco ou não abriu aparece
 * desligada, com o motivo — some só a aberta, onde a ficha já está.
 */
export function opcoesDoEnvio(adventure: Adventure | null, cenaAberta: string | null, situacao: SituacaoDasCenas): OpcoesDoEnvio {
  if (adventure === null || cenaAberta === null) return { cenas: [], motivo: MOTIVO_SO_UMA_CENA }
  const cenas = adventure.scenes
    .filter((entry) => entry.id !== cenaAberta)
    .map((entry): CenaDoEnvio => {
      const status = situacao[entry.id]?.status
      const nome = entry.name.trim() === '' ? 'Cena sem nome' : entry.name
      if (status === 'ok') return { id: entry.id, nome, motivo: null, estado: null }
      if (status === 'carregando') return { id: entry.id, nome, motivo: 'Esta cena ainda está abrindo.', estado: 'abrindo' }
      return { id: entry.id, nome, motivo: 'Esta cena não abriu.', estado: 'não abriu' }
    })
  return { cenas, motivo: cenas.length === 0 ? MOTIVO_SO_UMA_CENA : null }
}

/**
 * O PINO DE CHEGADA da cena: o primeiro pino de viagem que o mestre enxerga
 * (nem escondido no editor, nem secreto). `null` = a cena não tem: a ficha
 * chega no centro.
 */
export function pinoDeChegada(map: MapData): Pin | null {
  return map.pins.find((pin) => pin.kind === 'viagem' && pin.hidden !== true && pin.secret !== true) ?? null
}

/**
 * Onde a ficha de `tamanho` casas assenta: na casa livre mais perto do pino de
 * chegada (`arrivalSpot`) ou, sem pino, no centro livre da cena
 * (`arrivalSpotWithoutPin`). Nas duas, nunca dentro de parede nem em cima de
 * outra ficha: quem chega depois pelo mesmo envio senta na casa ao lado.
 */
export function casaDeChegada(map: MapData, pino: Pin | null, tamanho: number, tokenId: string): Point {
  return pino === null ? arrivalSpotWithoutPin(map, tamanho, tokenId) : arrivalSpot(map, pino, tamanho, tokenId)
}

/** O aviso do mestre: "Zumbi foi para Térreo" ou "3 fichas foram para Térreo". */
export function textoDoEnvio(nomes: readonly string[], cena: string): string {
  if (nomes.length === 1) {
    const nome = nomes[0].trim()
    return `${nome === '' ? 'A ficha' : nome} foi para ${cena}`
  }
  return `${nomes.length} fichas foram para ${cena}`
}
