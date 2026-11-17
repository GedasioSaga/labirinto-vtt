import type { Graphics } from 'pixi.js'
import type { RegionPoint } from '../types/map'
import { abismoNoPonto, contornoSimplificado, contornoValeAbismo } from '../lib/abismo'
import { abismosDoMapa } from '../lib/abismoPintado'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDoAbismo } from '../stores/ferramentaDoAbismo'
import type { EntradaDoAbismo } from './drawAbismo'

/**
 * Os gestos da ferramenta ABISMO (`lib/abismo.ts`) no editor: arrastar em
 * volta do buraco contorna a boca (solta = nasce o abismo, com o brilho do
 * painel, e fica escolhido); um clique escolhe o abismo no ponto (ou solta o
 * escolhido, fora de todos). Delete apaga o escolhido; Esc larga o traço e,
 * sem traço, solta o escolhido.
 */

/** Andou menos que isto (em casas) do aperto ao soltar: foi um clique. */
const CLIQUE_EM_CASAS = 0.25
/** O traço guarda um ponto a cada tanto (em casas): a mão tremida não vira mil pontos. */
const PASSO_DO_TRACO_EM_CASAS = 0.1
/** A tolerância do contorno enxuto (em casas). */
const TOLERANCIA_EM_CASAS = 0.04
const COR_DO_RASCUNHO = 0xd9a441
export const AVISO_DE_ABISMO_PEQUENO = 'Contorno pequeno demais: arraste em volta da boca do buraco.'

export interface GestoDoAbismo {
  comecar: (p: RegionPoint) => boolean
  mover: (p: RegionPoint) => void
  soltar: (p: RegionPoint | null) => void
  cancelar: () => void
  apagarEscolhido: () => boolean
  entrada: () => EntradaDoAbismo
}

export function criarGestoDoAbismo(dep: { rascunho: Graphics; aoMudarDesenho: () => void; avisar: (texto: string) => void }): GestoDoAbismo {
  let traco: RegionPoint[] | null = null
  let percorrido = 0
  let ultimaEntrada: EntradaDoAbismo | null = null

  const desenharRascunho = (): void => {
    const g = dep.rascunho
    g.clear()
    if (traco === null || traco.length < 2) return
    const grid = useMapStore.getState().map.grid
    const plano = traco.flatMap((p) => [p.x, p.y])
    // A boca que vai nascer: um véu escuro e o traço dourado; o fecho, mais fino.
    g.poly(plano, true).fill({ color: 0x17120f, alpha: 0.3 })
    g.poly(plano, false).stroke({ color: COR_DO_RASCUNHO, width: Math.max(1.5, grid * 0.05), alpha: 0.95, join: 'round', cap: 'round' })
    const ultimo = traco[traco.length - 1]
    g.moveTo(ultimo.x, ultimo.y).lineTo(traco[0].x, traco[0].y).stroke({ color: COR_DO_RASCUNHO, width: Math.max(1, grid * 0.022), alpha: 0.6 })
  }

  const juntar = (p: RegionPoint): void => {
    if (traco === null) return
    const grid = useMapStore.getState().map.grid
    const ultimo = traco[traco.length - 1]
    const d = Math.hypot(p.x - ultimo.x, p.y - ultimo.y)
    if (d < PASSO_DO_TRACO_EM_CASAS * grid) return
    traco.push(p)
    percorrido += d
  }

  const comecar = (p: RegionPoint): boolean => {
    traco = [p]
    percorrido = 0
    desenharRascunho()
    return true
  }

  const mover = (p: RegionPoint): void => {
    if (traco === null) return
    juntar(p)
    desenharRascunho()
  }

  const soltar = (p: RegionPoint | null): void => {
    if (traco === null) return
    if (p !== null) juntar(p)
    const pontos = traco
    traco = null
    dep.rascunho.clear()
    const s = useMapStore.getState()
    const ferramenta = useFerramentaDoAbismo.getState()
    const grid = s.map.grid
    if (percorrido < CLIQUE_EM_CASAS * grid) {
      // Um clique: escolhe o abismo no ponto; fora de todos, solta o escolhido.
      ferramenta.escolher(abismoNoPonto(s.map.abismos, s.pisoAtivo, pontos[0])?.id ?? null)
      dep.aoMudarDesenho()
      return
    }
    const contorno = contornoSimplificado(pontos, TOLERANCIA_EM_CASAS * grid)
    if (!contornoValeAbismo(contorno, grid)) {
      dep.avisar(AVISO_DE_ABISMO_PEQUENO)
      return
    }
    const id = crypto.randomUUID()
    const antes = s.map.abismos
    s.porAbismo({ id, pontos: contorno, ...(ferramenta.brilho !== 'nenhum' ? { brilho: ferramenta.brilho } : {}) })
    // A camada Terreno travada recusa (e avisa): nada nasceu, nada a escolher.
    if (useMapStore.getState().map.abismos !== antes) ferramenta.escolher(id)
    dep.aoMudarDesenho()
  }

  const cancelar = (): void => {
    if (traco !== null) {
      traco = null
      dep.rascunho.clear()
      return
    }
    // Sem traço, o Esc (e a troca de ferramenta) solta o escolhido.
    if (useFerramentaDoAbismo.getState().escolhido !== null) useFerramentaDoAbismo.getState().escolher(null)
  }

  const apagarEscolhido = (): boolean => {
    const ferramenta = useFerramentaDoAbismo.getState()
    const id = ferramenta.escolhido
    const s = useMapStore.getState()
    if (id === null || !(s.map.abismos ?? []).some((a) => a.id === id)) return false
    s.apagarAbismo(id)
    if (!(useMapStore.getState().map.abismos ?? []).some((a) => a.id === id)) ferramenta.escolher(null)
    return true
  }

  const entrada = (): EntradaDoAbismo => {
    const { map, pisoAtivo, activeTool } = useMapStore.getState()
    const escolhido = activeTool === 'abismo' ? useFerramentaDoAbismo.getState().escolhido : null
    // Os contornados à mão e os pintados por pincel (`abismosDoMapa` devolve a MESMA lista para o mesmo mapa).
    const abismos = abismosDoMapa(map)
    // A mesma entrada volta o MESMO objeto: o desenho compara por referência e não refaz à toa.
    if (
      ultimaEntrada !== null &&
      ultimaEntrada.abismos === abismos &&
      ultimaEntrada.piso === pisoAtivo &&
      ultimaEntrada.grid === map.grid &&
      ultimaEntrada.escolhido === escolhido
    ) {
      return ultimaEntrada
    }
    ultimaEntrada = { abismos, piso: pisoAtivo, grid: map.grid, escolhido }
    return ultimaEntrada
  }

  return { comecar, mover, soltar, cancelar, apagarEscolhido, entrada }
}
