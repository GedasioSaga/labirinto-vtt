import type { MapData, RegionPoint } from '../types/map'
import { pointInRing } from './floorContour'
import { luzDoCarimbo, luzDoObjeto, luzesDosCarimbos, raioDaLuzDoObjeto, raioDaLuzDosCarimbos } from './luzDoFogo'
import { luzesDosItens } from './luzDoItem'
import { cenaNoEscuro, luzAcesaNoPeriodo, periodoDaCena, salaEscura, type PeriodoLido } from './periodo'
import { mapaDoPiso, pisoDe } from './pisos'
import { hasLineOfSight, visionSegments } from './visibility'

/**
 * REQUISITOS E5 ("na luz" / "no escuro"): a ficha está na luz AGORA? O host mede com o mapa inteiro
 * (o mestre vê toda luz) e passa só o sim ou não ao portão (`ContextoDoGolpe.naLuz`): `lib/batalha`
 * nunca lê o mapa.
 *
 * A regra (decisão do Claude, 23/11/2026; REQUISITOS.md §5, E5):
 * - a casa só é ESCURA quando a cena pede escuro (`cenaNoEscuro`, a mesma regra da visão): "Cena
 *   escura" (`map.dark`), o período Noite da cena (`periodoDaCena`: cena externa à noite, ou o
 *   período fixo dela) ou o centro da ficha dentro de uma sala escura (`salaEscura`). A Tarde não
 *   escurece, e o tema do ambiente (Escuro, Noite) é só cor;
 * - mapa sem nada disso (nenhuma luz configurada) = NA LUZ;
 * - no escuro, está na luz quem fica no raio de uma luz acesa (a Luz do mapa acesa no período, o objeto
 *   que ilumina, o carimbo que ilumina, o item aceso no chão ou na mochila) com a linha da luz até o
 *   centro da ficha livre de parede (as paredes da visão, no piso da ficha).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

interface PontoDeLuz {
  x: number
  y: number
  raio: number
}

/** O mapa não muda de objeto enquanto nada muda: a resposta fica guardada por ficha e período. */
const guardadas = new WeakMap<MapData, Map<string, boolean | null>>()

function dentroDeSalaEscura(doPiso: MapData, centro: RegionPoint): boolean {
  return doPiso.regions.some((regiao) => salaEscura(regiao) && pointInRing(centro, regiao.points))
}

/** As luzes que clareiam no piso, no período da cena. */
function pontosDeLuz(doPiso: MapData, sessao: PeriodoLido | null | undefined): PontoDeLuz[] {
  const pontos: PontoDeLuz[] = []
  for (const luz of [...doPiso.lights, ...luzesDosItens(doPiso)]) {
    if (luz.hidden === true || !Number.isFinite(luz.radius) || !(luz.radius > 0) || !luzAcesaNoPeriodo(luz, doPiso, sessao)) continue
    pontos.push({ x: luz.x, y: luz.y, raio: luz.radius })
  }
  for (const objeto of doPiso.props) {
    const luz = objeto.hidden === true ? null : luzDoObjeto(objeto)
    if (luz !== null) pontos.push({ x: objeto.x, y: objeto.y, raio: raioDaLuzDoObjeto(objeto, luz, doPiso.grid) })
  }
  const carimbos = (doPiso.carimbos ?? []).filter((carimbo) => luzDoCarimbo(carimbo.tipo) !== null)
  for (const celula of luzesDosCarimbos(carimbos, doPiso.grid)) pontos.push({ x: celula.x, y: celula.y, raio: raioDaLuzDosCarimbos(celula, doPiso.grid) })
  return pontos
}

function medir(map: MapData, tokenId: string, sessao: PeriodoLido | null | undefined): boolean | null {
  const token = map.tokens.find((candidato) => candidato.id === tokenId)
  if (token === undefined) return null
  const doPiso = mapaDoPiso(map, pisoDe(token))
  const centro: RegionPoint = { x: token.x, y: token.y }
  // A regra única de escuro (`cenaNoEscuro`): a mesma que a visão do jogador lê.
  const escuro = cenaNoEscuro(map, periodoDaCena(map, sessao)) || dentroDeSalaEscura(doPiso, centro)
  if (!escuro) return true
  const paredes = visionSegments(doPiso)
  return pontosDeLuz(doPiso, sessao).some((luz) => Math.hypot(luz.x - centro.x, luz.y - centro.y) <= luz.raio && hasLineOfSight({ x: luz.x, y: luz.y }, centro, paredes))
}

/** A ficha `tokenId` está na luz no mapa `map` com a sessão no período `sessao`. `null` = a ficha não está no mapa. */
export function fichaNaLuz(map: MapData, tokenId: string, sessao: PeriodoLido | null | undefined): boolean | null {
  const chave = `${tokenId}|${sessao ?? ''}`
  let doMapa = guardadas.get(map)
  const guardada = doMapa?.get(chave)
  if (guardada !== undefined) return guardada
  const resposta = medir(map, tokenId, sessao)
  if (doMapa === undefined) {
    doMapa = new Map()
    guardadas.set(map, doMapa)
  }
  doMapa.set(chave, resposta)
  return resposta
}
