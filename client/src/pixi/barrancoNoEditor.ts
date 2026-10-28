import type { Graphics } from 'pixi.js'
import type { BarrancoDoMapa, RegionPoint } from '../types/map'
import {
  alcaDoRisco,
  alvoDaRampa,
  aplicarRampa,
  apagarRiscoDoBarranco,
  arrastoViraRisco,
  barrancoOuVazio,
  escalaDoBarranco,
  geosDoBarranco,
  NIVEL_MAXIMO,
  nivelNoPonto,
  pertoDoGeo,
  pincelarArea,
  RAIO_DO_PINCEL_DA_AREA,
  riscarBarranco,
  riscoPerto,
  VIRAR_MS,
  virarRisco,
  type AlvoDaRampa,
} from '../lib/barranco'
import { useMapStore } from '../stores/mapStore'
import { pintarRampa, type EntradaDoBarranco } from './drawBarranco'

/**
 * Os gestos da ferramenta Barranco no editor (`PixiCanvas`), com o
 * comportamento do protótipo aprovado (`docs/design/barranco/`):
 * - Risco: arrastar risca (lado alto para cima); clicar escolhe o risco; a
 *   alça Virar recolhe a parede e a faz crescer do outro lado em 220 ms.
 * - Área alta: o traço sobe um degrau a partir do nível onde começou (Alt ou
 *   Descer baixa); a prévia é o próprio barranco, e soltar vira UM passo.
 * - Rampa: o ponteiro mostra onde a rampa cai (ou qual sai); clicar põe ou tira.
 * O estado transitório (rascunho da área, virada) fica aqui, fora da store:
 * a lista inteira só muda ao soltar.
 */

const COR_DO_RISCO = 0xc69a66
const ALFA_DO_RISCO = 0.6
const COR_DA_RAMPA_SAI = 0xc0563a
const COR_DA_RAMPA_ENTRA = 0xd9a441

type Gesto =
  | { tipo: 'riscar'; pontos: RegionPoint[] }
  | { tipo: 'pintar'; ini: number; descer: boolean; ultimo: RegionPoint; antes: BarrancoDoMapa; rascunho: BarrancoDoMapa }
  | { tipo: 'rampa'; inicio: RegionPoint }

export interface GestoDoBarranco {
  /** Começa um gesto no ponto (px de mundo). `true` = consumido. */
  comecar: (p: RegionPoint, altKey: boolean) => boolean
  mover: (p: RegionPoint) => void
  /** Solta. `null` = soltou fora do canvas (vale o que já foi pintado; risco e rampa não). */
  soltar: (p: RegionPoint | null) => void
  cancelar: () => void
  /** Ponteiro parado sem botão: a prévia da rampa. */
  pairar: (p: RegionPoint | null) => void
  emGesto: () => boolean
  /** F: vira o risco escolhido na hora. `false` = não havia risco escolhido. */
  virarEscolhido: () => boolean
  /** Delete: apaga o risco escolhido. */
  apagarEscolhido: () => boolean
  /** O que a camada do barranco desenha agora (o rascunho da área e a virada entram aqui). */
  entrada: () => EntradaDoBarranco
}

function reduzirMovimento(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function suave(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

export function criarGestoDoBarranco(dep: { rascunho: Graphics; aoMudarDesenho: () => void; avisar: (texto: string) => void }): GestoDoBarranco {
  let gesto: Gesto | null = null
  let mostras: Map<string, number> | null = null
  let quadroDaVirada: number | null = null
  let ultimaEntrada: EntradaDoBarranco | null = null

  const estado = () => useMapStore.getState()

  const geosDeAgora = () => {
    const { map, pisoAtivo } = estado()
    return geosDoBarranco(map.barranco, pisoAtivo, map.grid)
  }

  const desenharRisco = (pontos: readonly RegionPoint[]) => {
    dep.rascunho.clear()
    const [primeiro, ...resto] = pontos
    if (primeiro === undefined || resto.length === 0) return
    const escala = escalaDoBarranco(estado().map.grid)
    dep.rascunho.moveTo(primeiro.x, primeiro.y)
    for (const p of resto) dep.rascunho.lineTo(p.x, p.y)
    dep.rascunho.stroke({ width: 3 * escala, color: COR_DO_RISCO, alpha: ALFA_DO_RISCO, cap: 'round', join: 'round' })
  }

  const desenharAlvoDaRampa = (alvo: AlvoDaRampa | null) => {
    dep.rascunho.clear()
    if (alvo === null) return
    const { map } = estado()
    const escala = escalaDoBarranco(map.grid)
    const meio = map.grid
    if (alvo.tirar) {
      dep.rascunho.circle(alvo.x, alvo.y, meio).stroke({ width: 2 * escala, color: COR_DA_RAMPA_SAI, alpha: 0.9 })
      return
    }
    const geos = geosDeAgora()
    const geo = geos.find((g) => pertoDoGeo(g, alvo.ponto).d < 0.5)
    if (geo !== undefined) pintarRampa(dep.rascunho, geo, pertoDoGeo(geo, alvo.ponto).s, 2 * meio, escala, 0.72)
    dep.rascunho.circle(alvo.x, alvo.y, meio).stroke({ width: 2 * escala, color: COR_DA_RAMPA_ENTRA, alpha: 0.9 })
  }

  const animarVirada = (id: string, de: number, ate: number) => {
    if (quadroDaVirada !== null) cancelAnimationFrame(quadroDaVirada)
    const t0 = performance.now()
    const passo = (agora: number) => {
      const u = (agora - t0) / VIRAR_MS
      if (u >= 1) {
        mostras = null
        quadroDaVirada = null
      } else {
        mostras = new Map([[id, de + (ate - de) * suave(u)]])
        quadroDaVirada = requestAnimationFrame(passo)
      }
      dep.aoMudarDesenho()
    }
    quadroDaVirada = requestAnimationFrame(passo)
  }

  const virar = (id: string, animado: boolean) => {
    const risco = estado().map.barranco?.riscos.find((r) => r.id === id)
    if (risco === undefined) return
    // Começa de onde a parede está: virar de novo no meio da volta não dá salto.
    const de = mostras?.get(id) ?? risco.lado
    if (!estado().mudarBarranco((b) => virarRisco(b, id))) return
    if (animado && !reduzirMovimento()) animarVirada(id, de, -risco.lado)
  }

  const alcaNoPonto = (p: RegionPoint): string | null => {
    const { barrancoEscolhido, map } = estado()
    if (barrancoEscolhido === null) return null
    const geo = geosDeAgora().find((g) => g.id === barrancoEscolhido)
    if (geo === undefined) return null
    const alca = alcaDoRisco(geo, map.grid)
    return Math.hypot(p.x - alca.x, p.y - alca.y) <= alca.raio ? barrancoEscolhido : null
  }

  const comecar = (p: RegionPoint, altKey: boolean): boolean => {
    const s = estado()
    const alca = alcaNoPonto(p)
    if (alca !== null) {
      virar(alca, true)
      return true
    }
    if (s.barrancoModo === 'risco') {
      gesto = { tipo: 'riscar', pontos: [p] }
      return true
    }
    if (s.barrancoModo === 'area') {
      const antes = barrancoOuVazio(s.map)
      const ini = nivelNoPonto(antes, p, s.pisoAtivo)
      const descer = altKey || s.barrancoArea === 'descer'
      const alvo = descer ? ini - 1 : ini + 1
      if (alvo > NIVEL_MAXIMO) dep.avisar(`Limite de ${NIVEL_MAXIMO} degraus acima do chão.`)
      else if (alvo < 0) dep.avisar('Aqui já é o chão: não dá para descer mais.')
      const rascunho = pincelarArea(antes, p, RAIO_DO_PINCEL_DA_AREA[s.barrancoPincel], ini, descer, s.barrancoAltura, s.pisoAtivo)
      gesto = { tipo: 'pintar', ini, descer, ultimo: p, antes, rascunho }
      if (rascunho !== antes) dep.aoMudarDesenho()
      return true
    }
    gesto = { tipo: 'rampa', inicio: p }
    return true
  }

  const mover = (p: RegionPoint) => {
    if (gesto === null) return
    const s = estado()
    if (gesto.tipo === 'riscar') {
      const ultimo = gesto.pontos[gesto.pontos.length - 1]
      if (Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < 4 * escalaDoBarranco(s.map.grid)) return
      gesto.pontos.push(p)
      desenharRisco(gesto.pontos)
      return
    }
    if (gesto.tipo === 'pintar') {
      const q = gesto.rascunho.quadrado
      const passos = Math.max(1, Math.ceil(Math.hypot(p.x - gesto.ultimo.x, p.y - gesto.ultimo.y) / (q / 2)))
      let rascunho = gesto.rascunho
      for (let k = 1; k <= passos; k += 1) {
        const c = { x: gesto.ultimo.x + ((p.x - gesto.ultimo.x) * k) / passos, y: gesto.ultimo.y + ((p.y - gesto.ultimo.y) * k) / passos }
        rascunho = pincelarArea(rascunho, c, RAIO_DO_PINCEL_DA_AREA[s.barrancoPincel], gesto.ini, gesto.descer, s.barrancoAltura, s.pisoAtivo)
      }
      gesto.ultimo = p
      if (rascunho !== gesto.rascunho) {
        gesto.rascunho = rascunho
        dep.aoMudarDesenho()
      }
    }
  }

  const soltar = (p: RegionPoint | null) => {
    const g = gesto
    gesto = null
    dep.rascunho.clear()
    if (g === null) return
    const s = estado()
    if (g.tipo === 'riscar') {
      if (p === null) return
      const pontos = g.pontos[g.pontos.length - 1] === p ? g.pontos : [...g.pontos, p]
      if (arrastoViraRisco(pontos, s.map.grid)) {
        const id = crypto.randomUUID()
        if (s.mudarBarranco((b, piso) => riscarBarranco(b, pontos, s.barrancoAltura, piso, id))) {
          s.setBarrancoEscolhido(id)
          const risco = estado().map.barranco?.riscos.find((r) => r.id === id)
          if (risco !== undefined) dep.avisar(`Risco posto. O lado alto ficou ${risco.lado === 1 ? 'para cima' : 'para baixo'}; use Virar (ou F) para trocar.`)
        }
        return
      }
      s.setBarrancoEscolhido(riscoPerto(geosDeAgora(), p, 10 * escalaDoBarranco(s.map.grid)))
      return
    }
    if (g.tipo === 'pintar') {
      const rascunho = g.rascunho
      if (rascunho !== g.antes) s.mudarBarranco(() => rascunho)
      dep.aoMudarDesenho()
      return
    }
    if (p === null || Math.hypot(p.x - g.inicio.x, p.y - g.inicio.y) >= 8 * escalaDoBarranco(s.map.grid)) return
    const alvo = alvoDaRampa(geosDeAgora(), p, 10 * escalaDoBarranco(s.map.grid))
    if (alvo === null) {
      dep.avisar('Aqui não há barranco. Passe o ponteiro sobre a parede de terra.')
      return
    }
    const id = crypto.randomUUID()
    if (s.mudarBarranco((b, piso) => aplicarRampa(b, alvo, piso, id))) {
      dep.avisar(alvo.tirar ? 'Rampa tirada. O barranco voltou a segurar a ficha ali.' : 'Rampa posta. A ficha sobe e desce por ela.')
    }
  }

  const cancelar = () => {
    const pintando = gesto !== null && gesto.tipo === 'pintar'
    gesto = null
    dep.rascunho.clear()
    if (pintando) dep.aoMudarDesenho()
  }

  const pairar = (p: RegionPoint | null) => {
    if (gesto !== null) return
    if (p === null || estado().barrancoModo !== 'rampa') {
      dep.rascunho.clear()
      return
    }
    desenharAlvoDaRampa(alvoDaRampa(geosDeAgora(), p, 10 * escalaDoBarranco(estado().map.grid)))
  }

  const virarEscolhido = (): boolean => {
    const id = estado().barrancoEscolhido
    if (id === null || estado().map.barranco?.riscos.some((r) => r.id === id) !== true) return false
    virar(id, false)
    return true
  }

  const apagarEscolhido = (): boolean => {
    const s = estado()
    const id = s.barrancoEscolhido
    if (id === null) return false
    if (!s.mudarBarranco((b) => apagarRiscoDoBarranco(b, id))) return false
    s.setBarrancoEscolhido(null)
    return true
  }

  const entrada = (): EntradaDoBarranco => {
    const { map, pisoAtivo, barrancoEscolhido, activeTool } = estado()
    const barranco = gesto !== null && gesto.tipo === 'pintar' ? gesto.rascunho : map.barranco
    const escolhido = activeTool === 'barranco' ? barrancoEscolhido : null
    // A mesma entrada volta o MESMO objeto: o desenho compara por referência e não refaz à toa.
    if (
      ultimaEntrada !== null &&
      ultimaEntrada.barranco === barranco &&
      ultimaEntrada.piso === pisoAtivo &&
      ultimaEntrada.grid === map.grid &&
      ultimaEntrada.mostras === (mostras ?? undefined) &&
      ultimaEntrada.escolhido === escolhido
    ) {
      return ultimaEntrada
    }
    ultimaEntrada = { barranco, piso: pisoAtivo, grid: map.grid, mostras: mostras ?? undefined, escolhido }
    return ultimaEntrada
  }

  return { comecar, mover, soltar, cancelar, pairar, emGesto: () => gesto !== null, virarEscolhido, apagarEscolhido, entrada }
}
