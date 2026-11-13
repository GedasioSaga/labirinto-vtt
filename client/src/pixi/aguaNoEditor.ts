import type { Graphics } from 'pixi.js'
import type { Agua, RegionPoint } from '../types/map'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDaAgua } from '../stores/ferramentaDaAgua'
import { mapaDoPiso } from '../lib/pisos'
import { larguraDoRio, pontosMinimos } from '../lib/agua/dados'
import { aguaNoPonto, curvaGuardada, curvaPelosPontos, decimarTraco, AMOSTRA_DA_CURVA } from '../lib/agua/forma'
import { cantosDoPontoAPonto, naBordaDoMapa, retanguloDaAgua, type RetanguloDoMapa } from '../lib/agua/pincel'
import { mapBoundsRect } from './drawMapBounds'

/**
 * ÁGUA no editor: os gestos da ferramenta (pedido de 12/11/2026, protótipo
 * `docs/design/agua/`). O rio segue o traço da mão, no sentido da correnteza.
 * O lago e o mar nascem pela FORMA do painel (pedido "MAR MAIS FÁCIL",
 * 13/11/2026): à mão (o arrasto fecha a área ao soltar), retângulo (de canto
 * a canto) ou ponto a ponto (um clique por canto; duplo clique ou Enter fecha,
 * Esc cancela). O ponto que passa da borda do mapa fica na borda. Um clique
 * (sem arrastar) escolhe a água de cima no ponto, ou solta a escolhida. Delete
 * apaga a escolhida e Esc a solta.
 *
 * O rascunho e o contorno da escolhida vão no `draftGraphics` do palco (fora
 * da imagem exportada), só com a ferramenta Água na mão.
 */

/** Distância entre os pontos de controle guardados, em casas (a curva suave sai deles). */
const PASSO_DOS_PONTOS = 0.5
/** Arrasto menor que isto (casas) é clique. */
const CLIQUE_ATE = 0.3
/** Dois cantos do ponto a ponto mais perto que isto (px de TELA) são um só: o duplo clique repete o último. */
const CANTOS_JUNTOS_PX = 8
/** O contorno da água escolhida: latão, como no protótipo. */
const COR_DA_ESCOLHIDA = 0xf3ba66

export interface GestoDaAgua {
  /** `alt`: o Alt segurado no começo do gesto. */
  comecar: (p: RegionPoint, alt: boolean) => void
  mover: (p: RegionPoint) => void
  /** `null` = soltou fora do palco: o que já foi traçado vale. */
  soltar: (p: RegionPoint | null) => void
  /** O ponteiro parado (sem botão): a prévia do ponto a ponto segue ele. */
  pairar: (p: RegionPoint) => void
  /** Cantos do ponto a ponto em construção (0 = nenhum traçado aberto). */
  cantosDoTracado: () => number
  /** Duplo clique ou Enter: fecha o ponto a ponto. Com menos de 3 cantos avisa e deixa o traçado aberto. */
  fecharPontoAPonto: () => void
  /** Ctrl+Z/Backspace no ponto a ponto: tira o último canto. */
  tirarUltimoCanto: () => void
  /** Esc, troca de ferramenta: o gesto e o ponto a ponto abertos somem sem virar água. */
  cancelar: () => void
  emGesto: () => boolean
  /** Desenha de novo o contorno da escolhida (quem limpou o rascunho por fora chama). */
  redesenhar: () => void
  /** Delete com a ferramenta Água: apaga a escolhida. `false` = nenhuma escolhida. */
  apagarEscolhida: () => boolean
  /** Esc com a ferramenta Água: solta a escolhida. `false` = nenhuma. */
  soltarEscolhida: () => boolean
  destruir: () => void
}

/** O gesto do botão apertado. */
type Gesto =
  | { tipo: 'nenhum' }
  | { tipo: 'mao'; bruto: RegionPoint[] }
  | { tipo: 'retangulo'; de: RegionPoint; ate: RegionPoint }
  /** Um clique do ponto a ponto: o canto já entrou no apertar; o soltar só termina o toque. */
  | { tipo: 'canto' }
  /** O ponto a ponto sem traçado aberto, apertado numa água (ou com uma escolhida): o soltar escolhe ou solta. */
  | { tipo: 'escolher'; em: RegionPoint }

function corEmNumero(hex: string): number {
  const v = Number.parseInt(hex.slice(1, 7), 16)
  return Number.isFinite(v) ? v : 0x4b87a8
}

/** O retângulo e o ponto a ponto nascem de linhas retas: a curva suave de 4 pontos viraria uma bolha. */
const FORMA_RETA: Partial<Agua> = { reto: true }

export function criarGestoDaAgua(dep: { rascunho: Graphics; avisar: (texto: string) => void }): GestoDaAgua {
  let gesto: Gesto = { tipo: 'nenhum' }
  /** Os cantos do ponto a ponto em construção (fica entre um clique e outro). */
  let cantos: RegionPoint[] = []
  /** Onde o ponteiro estava por último: a prévia do ponto a ponto vai até ele. */
  let cursor: RegionPoint | null = null

  const grid = (): number => useMapStore.getState().map.grid
  const escala = (): number => {
    const s = useMapStore.getState().camera.scale
    return Number.isFinite(s) && s > 0 ? s : 1
  }
  const borda = (): RetanguloDoMapa | null => mapBoundsRect(useMapStore.getState().map)
  const aguasDoPiso = (): readonly Agua[] => {
    const { map, pisoAtivo } = useMapStore.getState()
    return mapaDoPiso(map, pisoAtivo).aguas ?? []
  }
  const formaDoTipo = (): 'mao' | 'retangulo' | 'pontos' => {
    const f = useFerramentaDaAgua.getState()
    return f.tipo === 'rio' ? 'mao' : f.forma
  }
  const temRascunho = (): boolean => gesto.tipo !== 'nenhum' || cantos.length > 0

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

  /** A área do rascunho (lago e mar): preenchida e contornada na cor do painel. */
  function desenharArea(pts: readonly number[], fechar: boolean): void {
    const g = dep.rascunho
    const cor = corEmNumero(useFerramentaDaAgua.getState().cor)
    g.moveTo(pts[0], pts[1])
    for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
    if (fechar) {
      g.closePath()
      g.fill({ color: cor, alpha: 0.4 })
    }
    g.stroke({ width: Math.max(1.5, grid() * 0.04), color: cor, alpha: 0.9, join: 'round' })
  }

  function desenharTraco(bruto: readonly RegionPoint[]): void {
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
    if (f.tipo === 'rio') {
      g.moveTo(pts[0], pts[1])
      for (let i = 2; i + 1 < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1])
      g.stroke({ width: f.largura * grid(), color: cor, alpha: 0.55, cap: 'round', join: 'round' })
      return
    }
    desenharArea(pts, true)
  }

  function desenharRetangulo(de: RegionPoint, ate: RegionPoint): void {
    dep.rascunho.clear()
    const r = retanguloDaAgua(de, ate, borda())
    desenharArea(r.flatMap((p) => [p.x, p.y]), true)
  }

  /** O ponto a ponto aberto: os cantos, a linha até o cursor e a volta ao primeiro (tracejo leve). */
  function desenharCantos(): void {
    const g = dep.rascunho
    g.clear()
    if (cantos.length === 0) return
    const b = borda()
    const pts = cantos.map((c) => naBordaDoMapa(c, b))
    if (cursor !== null) pts.push(naBordaDoMapa(cursor, b))
    const cor = corEmNumero(useFerramentaDaAgua.getState().cor)
    const xy = pts.flatMap((p) => [p.x, p.y])
    if (pts.length >= 3) desenharArea(xy, true)
    else if (pts.length === 2) desenharArea(xy, false)
    const raio = 3.5 / escala()
    for (const c of cantos) {
      const p = naBordaDoMapa(c, b)
      g.circle(p.x, p.y, raio + 1.5 / escala()).fill({ color: 0x1e1e1e, alpha: 0.85 })
      g.circle(p.x, p.y, raio).fill({ color: cor })
    }
  }

  function escolherNoPonto(p: RegionPoint): void {
    const agua = aguaNoPonto(aguasDoPiso(), grid(), p.x, p.y)
    useFerramentaDaAgua.getState().escolher(agua === null ? null : agua.id)
  }

  /** A água nova, com o que o painel diz, no mapa e escolhida. */
  function porAguaNova(pontos: RegionPoint[], extra: Partial<Agua>): void {
    const f = useFerramentaDaAgua.getState()
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
      ...extra,
    }
    useMapStore.getState().porAgua(agua)
    f.escolher(agua.id)
  }

  function criarDaMao(bruto: readonly RegionPoint[]): void {
    const f = useFerramentaDaAgua.getState()
    const b = borda()
    const pontos = decimarTraco(
      bruto.map((p) => naBordaDoMapa(p, b)),
      grid() * PASSO_DOS_PONTOS,
    )
    if (pontos.length < pontosMinimos(f.tipo)) {
      dep.avisar(f.tipo === 'rio' ? 'Arraste um pouco mais para traçar o rio.' : 'Arraste o contorno em volta da área para fechar o lago ou o mar.')
      return
    }
    porAguaNova(pontos, {})
  }

  function criarRetangulo(de: RegionPoint, ate: RegionPoint): void {
    const r = retanguloDaAgua(de, ate, borda())
    const minimo = grid() * CLIQUE_ATE
    if (r[1].x - r[0].x < minimo || r[2].y - r[1].y < minimo) {
      dep.avisar('O retângulo ficou fino demais: arraste de um canto ao outro.')
      return
    }
    porAguaNova(r, FORMA_RETA)
  }

  function extensao(pts: readonly RegionPoint[]): number {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const p of pts) {
      x0 = Math.min(x0, p.x)
      y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x)
      y1 = Math.max(y1, p.y)
    }
    return Math.max(x1 - x0, y1 - y0)
  }

  const cantosFechados = (): RegionPoint[] => cantosDoPontoAPonto(cantos, borda(), CANTOS_JUNTOS_PX / escala())

  // O contorno da escolhida segue o mapa, a escolha e a ferramenta.
  const soltarMapa = useMapStore.subscribe((s, antes) => {
    if (temRascunho()) return
    if (s.map !== antes.map || s.pisoAtivo !== antes.pisoAtivo || s.activeTool !== antes.activeTool) {
      if (s.activeTool === 'agua' || antes.activeTool === 'agua') desenharEscolhida()
    }
  })
  const soltarEscolha = useFerramentaDaAgua.subscribe((s, antes) => {
    if (!temRascunho() && s.escolhida !== antes.escolhida) desenharEscolhida()
  })

  return {
    comecar(p) {
      const forma = formaDoTipo()
      if (forma === 'pontos') {
        if (cantos.length === 0) {
          // Sem traçado aberto, o clique numa água a escolhe (e com uma escolhida, o clique fora a solta).
          const naAgua = aguaNoPonto(aguasDoPiso(), grid(), p.x, p.y)
          if (naAgua !== null || useFerramentaDaAgua.getState().escolhida !== null) {
            gesto = { tipo: 'escolher', em: { x: p.x, y: p.y } }
            return
          }
        }
        cantos = [...cantos, { x: p.x, y: p.y }]
        cursor = { x: p.x, y: p.y }
        gesto = { tipo: 'canto' }
        desenharCantos()
        return
      }
      if (forma === 'retangulo') {
        gesto = { tipo: 'retangulo', de: { x: p.x, y: p.y }, ate: { x: p.x, y: p.y } }
        desenharRetangulo(gesto.de, gesto.ate)
        return
      }
      gesto = { tipo: 'mao', bruto: [{ x: p.x, y: p.y }] }
      desenharTraco(gesto.bruto)
    },
    mover(p) {
      if (gesto.tipo === 'mao') {
        const u = gesto.bruto[gesto.bruto.length - 1]
        if (Math.hypot(p.x - u.x, p.y - u.y) < grid() * 0.08) return
        gesto.bruto.push({ x: p.x, y: p.y })
        desenharTraco(gesto.bruto)
      } else if (gesto.tipo === 'retangulo') {
        gesto.ate = { x: p.x, y: p.y }
        desenharRetangulo(gesto.de, gesto.ate)
      } else if (gesto.tipo === 'canto') {
        cursor = { x: p.x, y: p.y }
        desenharCantos()
      }
    },
    soltar(p) {
      const g = gesto
      gesto = { tipo: 'nenhum' }
      if (g.tipo === 'canto') {
        desenharCantos()
        return
      }
      if (g.tipo === 'mao') {
        if (p !== null) g.bruto.push({ x: p.x, y: p.y })
        if (extensao(g.bruto) < grid() * CLIQUE_ATE) escolherNoPonto(g.bruto[0])
        else criarDaMao(g.bruto)
      } else if (g.tipo === 'escolher') {
        escolherNoPonto(g.em)
      } else if (g.tipo === 'retangulo') {
        const ate = p ?? g.ate
        if (extensao([g.de, ate]) < grid() * CLIQUE_ATE) escolherNoPonto(g.de)
        else criarRetangulo(g.de, ate)
      }
      desenharEscolhida()
    },
    pairar(p) {
      cursor = { x: p.x, y: p.y }
      if (cantos.length > 0) desenharCantos()
    },
    cantosDoTracado: () => (cantos.length === 0 ? 0 : cantosFechados().length),
    fecharPontoAPonto() {
      if (cantos.length === 0) return
      const pontos = cantosFechados()
      const f = useFerramentaDaAgua.getState()
      if (pontos.length < 3) {
        const faltam = 3 - pontos.length
        dep.avisar(`O ${f.tipo === 'mar' ? 'mar' : 'lago'} precisa de 3 cantos para fechar: ${faltam === 1 ? 'falta 1' : `faltam ${faltam}`}.`)
        return
      }
      cantos = []
      gesto = { tipo: 'nenhum' }
      porAguaNova(pontos, FORMA_RETA)
      desenharEscolhida()
    },
    tirarUltimoCanto() {
      if (cantos.length === 0) return
      cantos = cantos.slice(0, -1)
      if (cantos.length > 0) desenharCantos()
      else desenharEscolhida()
    },
    cancelar() {
      if (!temRascunho()) return
      gesto = { tipo: 'nenhum' }
      cantos = []
      desenharEscolhida()
    },
    emGesto: () => gesto.tipo !== 'nenhum',
    redesenhar() {
      if (cantos.length > 0) desenharCantos()
      else if (gesto.tipo === 'nenhum') desenharEscolhida()
    },
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
      gesto = { tipo: 'nenhum' }
      cantos = []
    },
  }
}
