import type { Container, Graphics, Renderer, Ticker } from 'pixi.js'
import type { MapData, RegionPoint } from '../types/map'
import { intensidadeDoMapaInteiro, type ResultadoDaNeblina } from '../lib/neblina'
import { mapaDoPiso } from '../lib/pisos'
import { unidadeDoRelevo } from '../lib/relevo'
import { raioDoPincelDeTextura } from '../lib/texturas'
import { useMapStore } from '../stores/mapStore'
import { usePincelDaNeblina } from '../stores/pincelDaNeblina'
import { createNeblinaRenderer, logoAbaixoDe, type EstadoDaNeblina, type NeblinaRenderer } from './drawNeblina'

/**
 * A NEBLINA NO EDITOR (`lib/neblina.ts`): o renderer do palco do mestre, o
 * gesto do pincel e o anel dele. Mora fora do `PixiCanvas.tsx` para a
 * neblina tocar o mínimo no palco (que outra linha de trabalho também mexe).
 */

/** O que a tela diz quando o gesto não fez nada. */
export const AVISOS_DA_NEBLINA: Record<Exclude<ResultadoDaNeblina, 'ok' | 'vazio'>, string> = {
  'sem-neblina': 'Não há neblina pintada aqui para a borracha tirar.',
}

/** O raio do pincel de Neblina neste mapa (a mesma régua do pincel de Texturas). */
export function raioDoPincelDeNeblina(map: Pick<MapData, 'width' | 'height' | 'grid'>, tamanho: number): number {
  return raioDoPincelDeTextura(unidadeDoRelevo(map), tamanho)
}

export interface NeblinaDoEditor {
  readonly renderer: NeblinaRenderer
  /**
   * Por quadro (no relógio do mapa de luz): confere se o mapa ou o piso mudou
   * (só referência) e põe a neblina logo abaixo de `acima`. Devolve a camada,
   * para o mapa de luz entrar logo abaixo dela.
   */
  quadro: (map: MapData, piso: number, acima: Container) => Container
  destruir: () => void
}

export function criarNeblinaDoEditor(dep: {
  renderer: Renderer
  ticker: Pick<Ticker, 'add' | 'remove'>
  reducedMotion: () => boolean
  mundo: Container
  aoMudar?: (estado: EstadoDaNeblina) => void
}): NeblinaDoEditor {
  const renderer = createNeblinaRenderer(dep.renderer, { ticker: dep.ticker, reducedMotion: dep.reducedMotion }, { aoMudar: dep.aoMudar })
  let ultimo: { map: MapData; piso: number } | null = null
  return {
    renderer,
    quadro(map, piso, acima) {
      logoAbaixoDe(dep.mundo, renderer.camada, acima)
      if (ultimo !== null && ultimo.map === map && ultimo.piso === piso) return renderer.camada
      const anterior = ultimo
      ultimo = { map, piso }
      // Só a neblina importa: o resto do mapa mudou e ela não, nada a refazer.
      if (anterior !== null && anterior.piso === piso && anterior.map.neblina === map.neblina && anterior.map.neblinaPintada === map.neblinaPintada && anterior.map.width === map.width && anterior.map.height === map.height && anterior.map.grid === map.grid) {
        return renderer.camada
      }
      renderer.atualizar({
        largura: map.width * map.grid,
        altura: map.height * map.grid,
        grid: map.grid,
        inteira: intensidadeDoMapaInteiro(map),
        pintada: mapaDoPiso(map, piso).neblinaPintada,
        animar: true,
      })
      return renderer.camada
    },
    destruir() {
      renderer.destruir()
    },
  }
}

export interface GestoDaNeblina {
  /** Começa a pincelada no ponto; Alt troca pincel e borracha só nela. */
  comecar: (p: RegionPoint, altKey: boolean) => void
  mover: (p: RegionPoint) => void
  /** Solta: a pincelada inteira vira UMA mudança no mapa. `null` = soltou fora do palco (o que já foi pintado vale). */
  soltar: (p: RegionPoint | null) => void
  /** Esc ou troca de ferramenta: a pincelada não vira passo. */
  cancelar: () => void
  emGesto: () => boolean
}

/** Cor do rascunho: a bruma clara do pincel e o escuro da borracha (o mesmo do esconder). */
const COR_DO_PINCEL = 0xe6eaee
const COR_DA_BORRACHA = 0x1a1f2b

export function criarGestoDaNeblina(dep: { rascunho: Graphics; avisar: (texto: string) => void }): GestoDaNeblina {
  let pontos: RegionPoint[] = []
  let tipo: 'pincel' | 'borracha' = 'pincel'
  let raio = 0
  let forca = 0

  function desenhar(): void {
    const g = dep.rascunho
    g.clear()
    const [primeiro, ...resto] = pontos
    if (primeiro === undefined) return
    const cor = tipo === 'pincel' ? COR_DO_PINCEL : COR_DA_BORRACHA
    const alfa = tipo === 'pincel' ? 0.2 + forca * 0.35 : 0.4
    if (resto.length === 0) {
      g.circle(primeiro.x, primeiro.y, raio).fill({ color: cor, alpha: alfa })
      return
    }
    g.moveTo(primeiro.x, primeiro.y)
    for (const p of resto) g.lineTo(p.x, p.y)
    g.stroke({ width: raio * 2, color: cor, alpha: alfa, cap: 'round', join: 'round' })
  }

  /** Um ponto novo só depois de andar um quarto do raio: a pincelada não guarda um ponto por pixel. */
  function estender(p: RegionPoint): void {
    const ultimo = pontos[pontos.length - 1]
    if (ultimo !== undefined && Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < raio * 0.25) return
    pontos.push({ x: p.x, y: p.y })
    desenhar()
  }

  return {
    comecar(p, altKey) {
      const { modo, tamanho, forca: daMao } = usePincelDaNeblina.getState()
      const borracha = modo === 'borracha'
      tipo = borracha !== altKey ? 'borracha' : 'pincel'
      raio = raioDoPincelDeNeblina(useMapStore.getState().map, tamanho)
      forca = daMao
      pontos = [{ x: p.x, y: p.y }]
      desenhar()
    },
    mover(p) {
      if (pontos.length > 0) estender(p)
    },
    soltar(p) {
      if (p !== null && pontos.length > 0) estender(p)
      const feitos = pontos
      pontos = []
      dep.rascunho.clear()
      if (feitos.length === 0) return
      const resultado = useMapStore.getState().pintarNeblina({ tipo, forca, raio, pontos: feitos })
      if (resultado === 'sem-neblina') dep.avisar(AVISOS_DA_NEBLINA[resultado])
    },
    cancelar() {
      if (pontos.length === 0) return
      pontos = []
      dep.rascunho.clear()
    },
    emGesto: () => pontos.length > 0,
  }
}
