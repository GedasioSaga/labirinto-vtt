import type { Graphics } from 'pixi.js'
import type { Agua, RegionPoint } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import { mapaDoPiso } from '../lib/pisos'
import { larguraDoRio, pontosMinimos } from '../lib/agua/dados'
import { aguaNoPonto, curvaGuardada, curvaPelosPontos, decimarTraco, AMOSTRA_DA_CURVA } from '../lib/agua/forma'

/**
 * ÁGUA no editor: os gestos da ferramenta (pedido de 12/11/2026, protótipo
 * `docs/design/agua/`). Arrastar traça uma água nova do tipo do painel: o rio
 * segue o traço, no sentido da correnteza; o lago e o mar fecham a área ao
 * soltar. Um clique (sem arrastar) escolhe a água de cima no ponto, ou solta a
 * escolhida. Delete apaga a escolhida e Esc a solta.
 *
 * O rascunho e o contorno da escolhida vão no `draftGraphics` do palco (fora
 * da imagem exportada), só com a ferramenta Água na mão.
 */

/** Distância entre os pontos de controle guardados, em casas (a curva suave sai deles). */
const PASSO_DOS_PONTOS = 0.5
/** Arrasto menor que isto (casas) é clique. */
const CLIQUE_ATE = 0.3
/** O contorno da água escolhida: latão, como no protótipo. */
const COR_DA_ESCOLHIDA = 0xf3ba66

export interface GestoDaAgua {
  comecar: (p: RegionPoint) => void
  mover: (p: RegionPoint) => void
  /** `null` = soltou fora do palco: o que já foi traçado vale. */
  soltar: (p: RegionPoint | null) => void
  cancelar: () => void
  emGesto: () => boolean
  /** Delete com a ferramenta Água: apaga a escolhida. `false` = nenhuma escolhida. */
  apagarEscolhida: () => boolean
  /** Esc com a ferramenta Água: solta a escolhida. `false` = nenhuma. */
  soltarEscolhida: () => boolean
  destruir: () => void
}

function corEmNumero(hex: string): number {
  const v = Number.parseInt(hex.slice(1, 7), 16)
  return Number.isFinite(v) ? v : 0x4b87a8
}

export function criarGestoDaAgua(dep: { rascunho: Graphics; avisar: (texto: string) => void }): GestoDaAgua {
  let bruto: RegionPoint[] = []

  const grid = (): number => useMapStore.getState().map.grid
  const aguasDoPiso = (): readonly Agua[] => {
    const { map, pisoAtivo } = useMapStore.getState()
    return mapaDoPiso(map, pisoAtivo).aguas ?? []
  }

  /** O contorno da água escolhida (com a ferramenta Água na mão e sem gesto). */
  function desenharEscolhida(): void {
    const g = dep.rascunho
    g.clear()
    if (useMapStore.getState().activeTool !== 'agua') return
    const id = useFerramentaDaAgua.getState().escolhida
    const agua = id === null ? undefined : aguasDoPiso().find((a) => a.id === id)
    if (agua === undefined) return
    const xy = curvaGuardada(agua, grid())
    if (xy.length < 4) return
    g.moveTo(xy[0], xy[1])
    for (let i = 2; i + 1 < xy.length; i += 2) g.lineTo(xy[i], xy[i + 1])
    if (agua.tipo === 'rio') {
      g.stroke({ width: larguraDoRio(agua) * grid(), color: COR_DA_ESCOLHIDA, alpha: 0.18, cap: 'round', join: 'round' })
      g.moveTo(xy[0], xy[1])
      for (let i = 2; i + 1 < xy.length; i += 2) g.lineTo(xy[i], xy[i + 1])
    } else g.closePath()
    g.stroke({ width: Math.max(1.5, grid() * 0.04), color: COR_DA_ESCOLHIDA, alpha: 0.95, join: 'round' })
  }

  function desenharTraco(): void {
    const g = dep.rascunho
    g.clear()
    if (bruto.length === 0) return
    const f = useFerramentaDaAgua.getState()
    const cor = corEmNumero(f.cor)
    const pts = curvaPelosPontos(decimarTraco(bruto, grid() * PASSO_DOS_PONTOS), f.tipo !== 'rio', grid() * AMOSTRA_DA_CURVA)
    if (pts.length < 4) {
      g.circle(bruto[0].x, bruto[0].y, f.tipo === 'rio' ? (f.largura * grid()) / 2 : grid() * 0.1).fill({ color: cor, alpha: 0.5 })
      return
    }
    g.moveTo(pts[0], pts[1])
    for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    if (f.tipo === 'rio') {
      g.stroke({ width: f.largura * grid(), color: cor, alpha: 0.55, cap: 'round', join: 'round' })
      return
    }
    g.closePath()
    g.fill({ color: cor, alpha: 0.4 })
    g.stroke({ width: Math.max(1.5, grid() * 0.04), color: cor, alpha: 0.9, join: 'round' })
  }

  function extensao(): number {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of bruto) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
    return Math.max(x1 - x0, y1 - y0)
  }

  function escolherNoPonto(p: RegionPoint): void {
    const agua = aguaNoPonto(aguasDoPiso(), grid(), p.x, p.y)
    useFerramentaDaAgua.getState().escolher(agua === null ? null : agua.id)
  }

  function criar(): void {
    const f = useFerramentaDaAgua.getState()
    const pontos = decimarTraco(bruto, grid() * PASSO_DOS_PONTOS)
    if (pontos.length < pontosMinimos(f.tipo)) {
      dep.avisar(f.tipo === 'rio' ? 'Arraste um pouco mais para traçar o rio.' : 'Arraste o contorno em volta da área para fechar o lago ou o mar.')
      return
    }
    const agua: Agua = {
      id: crypto.randomUUID(),
      tipo: f.tipo,
      pontos: pontos.map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 })),
      cor: f.cor,
      ...(f.corPronta === null ? {} : { corPronta: f.corPronta }),
      ...(f.tipo === 'rio' ? { largura: f.largura } : {}),
      velocidade: f.velocidade,
      ondas: f.ondas,
      espuma: f.espuma,
    }
    useMapStore.getState().porAgua(agua)
    f.escolher(agua.id)
  }

  // O contorno da escolhida segue o mapa, a escolha e a ferramenta.
  const soltarMapa = useMapStore.subscribe((s, antes) => {
    if (bruto.length > 0) return
    if (s.map !== antes.map || s.pisoAtivo !== antes.pisoAtivo || s.activeTool !== antes.activeTool) {
      if (s.activeTool === 'agua' || antes.activeTool === 'agua') desenharEscolhida()
    }
  })
  const soltarEscolha = useFerramentaDaAgua.subscribe((s, antes) => {
    if (bruto.length === 0 && s.escolhida !== antes.escolhida) desenharEscolhida()
  })

  return {
    comecar(p) {
      bruto = [{ x: p.x, y: p.y }]
      desenharTraco()
    },
    mover(p) {
      if (bruto.length === 0) return
      const u = bruto[bruto.length - 1]
      if (Math.hypot(p.x - u.x, p.y - u.y) < grid() * 0.08) return
      bruto.push({ x: p.x, y: p.y })
      desenharTraco()
    },
    soltar(p) {
      if (bruto.length === 0) return
      if (p !== null) bruto.push({ x: p.x, y: p.y })
      const clique = extensao() < grid() * CLIQUE_ATE
      const primeiro = bruto[0]
      if (clique) escolherNoPonto(primeiro)
      else criar()
      bruto = []
      desenharEscolhida()
    },
    cancelar() {
      if (bruto.length === 0) return
      bruto = []
      desenharEscolhida()
    },
    emGesto: () => bruto.length > 0,
    apagarEscolhida() {
      const id = useFerramentaDaAgua.getState().escolhida
      if (id === null || !aguasDoPiso().some((a) => a.id === id)) return false
      useMapStore.getState().apagarAgua(id)
      useFerramentaDaAgua.getState().escolher(null)
      return true
    },
    soltarEscolhida() {
      if (useFerramentaDaAgua.getState().escolhida === null) return false
      useFerramentaDaAgua.getState().escolher(null)
      return true
    },
    destruir() {
      soltarMapa()
      soltarEscolha()
      bruto = []
    },
  }
}
