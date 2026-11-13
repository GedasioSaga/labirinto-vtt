import type { Container, Graphics, Renderer, Ticker } from 'pixi.js'
import type { EfeitoDoAmbiente, MapData, PinceladaDeAmbiente, RegionPoint } from '../types/map'
import { EFEITOS_DO_AMBIENTE, intensidadeNoMapaInteiro, relampagoDoMapa, somDaChuvaLigado, tipoDeFolhas, ventoDoMapa, vetorDoVento, type EfeitoDoPainel } from '../lib/ambiente'
import { criarSomDaChuva } from '../lib/sons/somDaChuva'
import { abrigoDoMestre } from '../lib/abrigoDoAmbiente'
import { cenaTemFogo } from '../lib/particulasDaCena'
import { aquecerAmbiente, createAmbienteRenderer, type EntradaDoAmbiente, type EstadoDoAmbiente } from './drawAmbiente'
import { densidadeDoMapaInteiro, intensidadeDoMapaInteiro, PINCELADAS_MAX, type ResultadoDaNeblina } from '../lib/neblina'
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
  cheio: `Este mapa já tem ${PINCELADAS_MAX.toLocaleString('pt-BR')} pinceladas de neblina, o máximo. Use "Apagar toda a neblina pintada" ou a chave do mapa inteiro.`,
}

/** O nome do efeito pintado no aviso da borracha ("Não há chuva pintada aqui..."). */
const NOME_PINTADO: Record<EfeitoDoAmbiente, string> = {
  chuva: 'chuva',
  brasas: 'brasa',
  neve: 'neve',
  folhas: 'folha nem cinza',
  fumaca: 'fumaça',
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
  aoMudarAmbiente?: (estado: EstadoDoAmbiente) => void
}): NeblinaDoEditor {
  const neblina = createNeblinaRenderer(dep.renderer, { ticker: dep.ticker, reducedMotion: dep.reducedMotion }, { aoMudar: dep.aoMudar })
  // AMBIENTE (`drawAmbiente.ts`): as partículas logo acima da neblina. O shader compila já, em segundo plano.
  const ambiente = createAmbienteRenderer(dep.renderer, { ticker: dep.ticker, reducedMotion: dep.reducedMotion }, { aoMudar: dep.aoMudarAmbiente, som: criarSomDaChuva() })
  void aquecerAmbiente(dep.renderer)
  // O período vai para os dois: a tela chama `renderer.setPeriodo` como antes.
  const renderer: NeblinaRenderer = {
    camada: neblina.camada,
    atualizar: neblina.atualizar,
    setAbrigo: neblina.setAbrigo,
    setPeriodo(periodo) {
      neblina.setPeriodo(periodo)
      ambiente.setPeriodo(periodo)
    },
    destruir: neblina.destruir,
  }
  let ultimo: { map: MapData; piso: number } | null = null
  let doPisoAnterior: MapData | null = null
  return {
    renderer,
    quadro(map, piso, acima) {
      logoAbaixoDe(dep.mundo, ambiente.camada, acima)
      logoAbaixoDe(dep.mundo, neblina.camada, ambiente.camada)
      if (ultimo !== null && ultimo.map === map && ultimo.piso === piso) return neblina.camada
      ultimo = { map, piso }
      const doPiso = mapaDoPiso(map, piso)
      const antes = doPisoAnterior
      doPisoAnterior = doPiso
      const largura = map.width * map.grid
      const altura = map.height * map.grid
      // O abrigo só muda com sala, parede ou porta: o resto do mapa mudou e ele não, nada a refazer.
      if (antes === null || antes.regions !== doPiso.regions || antes.walls !== doPiso.walls || antes.grid !== doPiso.grid || antes.width !== doPiso.width || antes.height !== doPiso.height) {
        ambiente.setAbrigo(abrigoDoMestre(doPiso), largura, altura, map.grid)
        neblina.setAbrigo(ambiente.ar(), largura, altura)
      }
      if (antes === null || antes.ambiente !== doPiso.ambiente || antes.ambientePintado !== doPiso.ambientePintado || antes.props !== doPiso.props || antes.grid !== doPiso.grid || antes.width !== doPiso.width || antes.height !== doPiso.height) {
        ambiente.atualizar(entradaDoAmbiente(map, doPiso.ambientePintado, !cenaTemFogo(map.props), true))
      }
      // Só a neblina importa daqui para baixo: o resto do mapa mudou e ela não, nada a refazer.
      if (antes !== null && antes.neblina === doPiso.neblina && antes.neblinaPintada === doPiso.neblinaPintada && antes.width === doPiso.width && antes.height === doPiso.height && antes.grid === doPiso.grid) {
        return neblina.camada
      }
      neblina.atualizar({
        largura: map.width * map.grid,
        altura: map.height * map.grid,
        grid: map.grid,
        inteira: intensidadeDoMapaInteiro(map),
        densidade: densidadeDoMapaInteiro(map),
        pintada: doPiso.neblinaPintada,
        animar: true,
      })
      return neblina.camada
    },
    destruir() {
      neblina.destruir()
      ambiente.destruir()
    },
  }
}

/**
 * O que a tela entrega ao `drawAmbiente.ts`, igual no mestre e no jogador.
 * `semFogo` = a cena não tem fogo: só então brasas e fumaça do mapa inteiro
 * saem daqui; com fogo, elas nascem dos fogos (`particulasDoMapa.ts`). O
 * pincel vale sempre.
 */
export function entradaDoAmbiente(map: MapData, pintada: readonly PinceladaDeAmbiente[] | undefined, semFogo: boolean, animar: boolean): EntradaDoAmbiente | null {
  const inteira: Record<EfeitoDoAmbiente, number> = {
    chuva: intensidadeNoMapaInteiro(map, 'chuva'),
    brasas: semFogo ? intensidadeNoMapaInteiro(map, 'brasas') : 0,
    neve: intensidadeNoMapaInteiro(map, 'neve'),
    folhas: intensidadeNoMapaInteiro(map, 'folhas'),
    fumaca: semFogo ? intensidadeNoMapaInteiro(map, 'fumaca') : 0,
  }
  const temAlgo = EFEITOS_DO_AMBIENTE.some((e) => inteira[e] > 0) || (pintada ?? []).some((p) => p.tipo === 'pincel')
  if (!temAlgo) return null
  return {
    largura: map.width * map.grid,
    altura: map.height * map.grid,
    grid: map.grid,
    inteira,
    pintada,
    folhas: tipoDeFolhas(map),
    vento: vetorDoVento(ventoDoMapa(map)),
    animar,
    relampago: relampagoDoMapa(map),
    somDaChuva: somDaChuvaLigado(map),
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
  let densidade = 0
  /** O efeito da pincelada, fixo do começo ao fim (trocar no painel no meio não a divide). */
  let efeito: EfeitoDoPainel = 'neblina'

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
      const { modo, tamanho, forca: daMao, densidade: densidadeDaMao, efeito: daVez } = usePincelDaNeblina.getState()
      efeito = daVez
      const borracha = modo === 'borracha'
      tipo = borracha !== altKey ? 'borracha' : 'pincel'
      raio = raioDoPincelDeNeblina(useMapStore.getState().map, tamanho)
      forca = daMao
      densidade = densidadeDaMao
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
      // AMBIENTE: o pincel pinta o efeito escolhido no painel; a neblina segue nos campos dela.
      const resultado =
        efeito === 'neblina'
          ? useMapStore.getState().pintarNeblina({ tipo, forca, raio, pontos: feitos, densidade })
          : useMapStore.getState().pintarAmbiente({ efeito, tipo, forca, raio, pontos: feitos })
      if (resultado === 'sem-neblina') dep.avisar(efeito === 'neblina' ? AVISOS_DA_NEBLINA[resultado] : `Não há ${NOME_PINTADO[efeito]} pintada aqui para a borracha tirar.`)
      if (resultado === 'cheio') dep.avisar(AVISOS_DA_NEBLINA[resultado])
    },
    cancelar() {
      if (pontos.length === 0) return
      pontos = []
      dep.rascunho.clear()
    },
    emGesto: () => pontos.length > 0,
  }
}
