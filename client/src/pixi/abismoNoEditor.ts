import type { Graphics } from 'pixi.js'
import type { Abismo, AbismoPintado, BrilhoDoAbismo, RegionPoint } from '../types/map'
import { abismoNoPonto, contornoSimplificado, contornoValeAbismo } from '../lib/abismo'
import { centrosDoMesmoLado } from '../lib/abismoNaParede'
import { abismoPintadoOuVazio, abismosDoMapa, ehAbismoPintado, pincelarAbismo } from '../lib/abismoPintado'
import { RAIO_DO_PINCEL_DA_AREA } from '../lib/barranco'
import { useMapStore } from '../stores/mapStore'
import { useFerramentaDoAbismo } from '../stores/ferramentaDoAbismo'
import type { EntradaDoAbismo } from './drawAbismo'

/**
 * Os gestos da ferramenta ABISMO no editor, pelo modo do painel
 * (`ferramentaDoAbismo`):
 * - Contornar (`lib/abismo.ts`): arrastar em volta do buraco contorna a boca
 *   (solta = nasce o abismo, com o brilho do painel, e fica escolhido); um
 *   clique escolhe o abismo contornado no ponto (ou solta o escolhido, fora de
 *   todos). Delete apaga o escolhido; Esc larga o traço e, sem traço, solta o
 *   escolhido.
 * - Pincel (`lib/abismoPintado.ts`): o traço cava quadrado por quadrado, com o
 *   brilho do painel; com Alt, tapa (tapar no meio do buraco deixa uma ilha). A
 *   prévia é o próprio abismo, e soltar vira UM passo do desfazer. O buraco
 *   pintado não se escolhe nem se apaga com Delete: só o pincel mexe nele. O
 *   traço não passa de parede: fica do lado em que começou (`lib/abismoNaParede.ts`).
 * O estado transitório (o traço da boca, o rascunho do pincel) fica aqui, fora
 * da store: o mapa só muda ao soltar.
 */

/** Andou menos que isto (em casas) do aperto ao soltar: foi um clique. */
const CLIQUE_EM_CASAS = 0.25
/** O traço guarda um ponto a cada tanto (em casas): a mão tremida não vira mil pontos. */
const PASSO_DO_TRACO_EM_CASAS = 0.1
/** A tolerância do contorno enxuto (em casas). */
const TOLERANCIA_EM_CASAS = 0.04
/** O pincel carimba a cada tanto (em quadrados) do caminho da mão: o arrasto rápido não deixa buraco no traço. */
const PASSO_DO_PINCEL_EM_QUADRADOS = 0.5
const COR_DO_RASCUNHO = 0xd9a441
export const AVISO_DE_ABISMO_PEQUENO = 'Contorno pequeno demais: arraste em volta da boca do buraco.'
export const AVISO_DE_BURACO_PINTADO = 'Este buraco foi feito com o Pincel. Escolha Pincel e segure Alt para tapar.'
export const AVISO_DE_ABISMO_CONTORNADO = 'O Pincel só tapa o buraco pintado. Este foi contornado: escolha Contornar, clique nele e aperte Delete.'

/** Um traço do pincel em andamento. O que decide o traço (Alt, brilho, grossura, piso) é o de quando ele começou. */
interface Pintura {
  tapar: boolean
  brilho: BrilhoDoAbismo | null
  raioEmQuadrados: number
  piso: number
  inicio: RegionPoint
  ultimo: RegionPoint
  /** O último carimbo que valeu: o traço fica do lado da parede em que começou (`centrosDoMesmoLado`). */
  doLado: RegionPoint
  /** Todo carimbo do traço que valeu, na ordem: refaz o traço se o mapa mudar debaixo dele. */
  centros: RegionPoint[]
  /** O abismo pintado do mapa quando o traço começou (`undefined` = não havia). */
  doMapa: AbismoPintado | undefined
  antes: AbismoPintado
  rascunho: AbismoPintado
}

export interface GestoDoAbismo {
  /** Começa um gesto no ponto (px de mundo). `altKey`: no Pincel, o traço tapa em vez de cavar. `true` = consumido. */
  comecar: (p: RegionPoint, altKey: boolean) => boolean
  mover: (p: RegionPoint) => void
  /** Solta. `null` = soltou fora do canvas (vale o que já foi pintado; o contorno fecha onde a mão parou). */
  soltar: (p: RegionPoint | null) => void
  cancelar: () => void
  apagarEscolhido: () => boolean
  /** O raio do pincel em px de mundo, para o anel em volta do ponteiro; `null` no Contornar. */
  raioDoPincel: () => number | null
  /** O que a camada do abismo desenha agora (o rascunho do pincel entra aqui). */
  entrada: () => EntradaDoAbismo
}

export function criarGestoDoAbismo(dep: { rascunho: Graphics; aoMudarDesenho: () => void; avisar: (texto: string) => void }): GestoDoAbismo {
  let traco: RegionPoint[] | null = null
  let percorrido = 0
  let pintura: Pintura | null = null
  let ultimaEntrada: EntradaDoAbismo | null = null

  /** O abismo contornado à mão no ponto, no buraco já cortado pela parede (o clique do outro lado da parede não o pega). */
  const contornadoNoPonto = (piso: number, p: RegionPoint): Abismo | null =>
    abismoNoPonto(abismosDoMapa(useMapStore.getState().map)?.filter((a) => !ehAbismoPintado(a.id)), piso, p)

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

  /** O pincel anda do último carimbo até `p`, carimbando no caminho; o desenho só refaz se algum quadrado mudou. */
  const pincelarAte = (g: Pintura, p: RegionPoint): void => {
    const passo = g.rascunho.quadrado * PASSO_DO_PINCEL_EM_QUADRADOS
    const passos = Math.max(1, Math.ceil(Math.hypot(p.x - g.ultimo.x, p.y - g.ultimo.y) / passo))
    const caminho: RegionPoint[] = []
    for (let k = 1; k <= passos; k += 1) caminho.push({ x: g.ultimo.x + ((p.x - g.ultimo.x) * k) / passos, y: g.ultimo.y + ((p.y - g.ultimo.y) * k) / passos })
    g.ultimo = p
    // A mão que passa da parede deixa de cavar até voltar para o lado em que o traço começou.
    const { walls } = useMapStore.getState().map
    const { ficam: novos, ancora } = centrosDoMesmoLado(g.doLado, caminho, walls, g.piso)
    g.doLado = ancora
    if (novos.length === 0) return
    g.centros.push(...novos)
    const rascunho = pincelarAbismo(g.rascunho, novos, g.raioEmQuadrados, g.tapar, g.brilho, g.piso, walls)
    if (rascunho === g.rascunho) return
    g.rascunho = rascunho
    dep.aoMudarDesenho()
  }

  const comecar = (p: RegionPoint, altKey: boolean): boolean => {
    const ferramenta = useFerramentaDoAbismo.getState()
    if (ferramenta.modo === 'pincel') {
      const s = useMapStore.getState()
      const antes = abismoPintadoOuVazio(s.map)
      pintura = {
        tapar: altKey,
        brilho: ferramenta.brilho === 'nenhum' ? null : ferramenta.brilho,
        raioEmQuadrados: RAIO_DO_PINCEL_DA_AREA[ferramenta.pincel],
        piso: s.pisoAtivo,
        inicio: p,
        ultimo: p,
        doLado: p,
        centros: [],
        doMapa: s.map.abismoPintado,
        antes,
        rascunho: antes,
      }
      pincelarAte(pintura, p)
      return true
    }
    traco = [p]
    percorrido = 0
    desenharRascunho()
    return true
  }

  const mover = (p: RegionPoint): void => {
    if (pintura !== null) {
      pincelarAte(pintura, p)
      return
    }
    if (traco === null) return
    juntar(p)
    desenharRascunho()
  }

  const soltarPintura = (g: Pintura, p: RegionPoint | null): void => {
    if (p !== null && (p.x !== g.ultimo.x || p.y !== g.ultimo.y)) pincelarAte(g, p)
    const s = useMapStore.getState()
    if (g.rascunho !== g.antes) {
      // O que se viu é o que fica. Só se o mapa mudou debaixo do traço (um Ctrl+Z com o botão apertado)
      // o traço é refeito em cima do que há agora, em vez de gravar o rascunho velho por cima.
      const intacto = s.map.abismoPintado === g.doMapa
      s.mudarAbismoPintado((atual, piso) => (intacto ? g.rascunho : pincelarAbismo(atual, g.centros, g.raioEmQuadrados, g.tapar, g.brilho, piso, s.map.walls)))
    } else if (g.tapar && contornadoNoPonto(g.piso, g.inicio) !== null) {
      // Alt em cima de um abismo contornado não tapa nada: diz por onde ele se apaga.
      dep.avisar(AVISO_DE_ABISMO_CONTORNADO)
    }
    // Terreno travado recusa: o rascunho sai da tela e o mapa volta a mandar no desenho.
    dep.aoMudarDesenho()
  }

  const soltar = (p: RegionPoint | null): void => {
    if (pintura !== null) {
      const g = pintura
      pintura = null
      soltarPintura(g, p)
      return
    }
    if (traco === null) return
    if (p !== null) juntar(p)
    const pontos = traco
    traco = null
    dep.rascunho.clear()
    const s = useMapStore.getState()
    const ferramenta = useFerramentaDoAbismo.getState()
    const grid = s.map.grid
    if (percorrido < CLIQUE_EM_CASAS * grid) {
      // Um clique: escolhe o abismo contornado no ponto (o buraco já cortado pela parede:
      // o clique do outro lado da parede não o pega); fora de todos, solta o escolhido.
      const contornado = contornadoNoPonto(s.pisoAtivo, pontos[0])
      ferramenta.escolher(contornado?.id ?? null)
      // O buraco pintado não se escolhe: o clique nele diz por onde ele muda.
      if (contornado === null) {
        const noPonto = abismoNoPonto(abismosDoMapa(s.map), s.pisoAtivo, pontos[0])
        if (noPonto !== null && ehAbismoPintado(noPonto.id)) dep.avisar(AVISO_DE_BURACO_PINTADO)
      }
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
    if (pintura !== null) {
      // O traço do pincel largado (Esc, troca de ferramenta) não vira passo: o desenho volta ao mapa.
      pintura = null
      dep.aoMudarDesenho()
      return
    }
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

  const raioDoPincel = (): number | null => {
    const ferramenta = useFerramentaDoAbismo.getState()
    if (ferramenta.modo !== 'pincel') return null
    // No meio do traço vale a grossura com que ele começou.
    const raioEmQuadrados = pintura !== null ? pintura.raioEmQuadrados : RAIO_DO_PINCEL_DA_AREA[ferramenta.pincel]
    return raioEmQuadrados * abismoPintadoOuVazio(useMapStore.getState().map).quadrado
  }

  const entrada = (): EntradaDoAbismo => {
    const { map, pisoAtivo, activeTool } = useMapStore.getState()
    const escolhido = activeTool === 'abismo' ? useFerramentaDoAbismo.getState().escolhido : null
    // Os contornados à mão e os pintados por pincel; no meio de um traço do pincel, os pintados são os do
    // rascunho. `abismosDoMapa` devolve a MESMA lista para os mesmos contornados e o mesmo abismo pintado.
    // Todos já rentes à parede; as paredes vão junto para o desenho fazer o corte reto onde o buraco encosta.
    const abismos = abismosDoMapa(pintura !== null ? { abismos: map.abismos, abismoPintado: pintura.rascunho, walls: map.walls } : map)
    // A mesma entrada volta o MESMO objeto: o desenho compara por referência e não refaz à toa.
    if (
      ultimaEntrada !== null &&
      ultimaEntrada.abismos === abismos &&
      ultimaEntrada.paredes === map.walls &&
      ultimaEntrada.piso === pisoAtivo &&
      ultimaEntrada.grid === map.grid &&
      ultimaEntrada.escolhido === escolhido
    ) {
      return ultimaEntrada
    }
    ultimaEntrada = { abismos, paredes: map.walls, piso: pisoAtivo, grid: map.grid, escolhido }
    return ultimaEntrada
  }

  return { comecar, mover, soltar, cancelar, apagarEscolhido, raioDoPincel, entrada }
}
