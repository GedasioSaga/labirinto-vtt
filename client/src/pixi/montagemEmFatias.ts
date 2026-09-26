import type { MapData } from '../types/map'
import { SHAPES_LAYERS, type ShapesLayer, type ShapesSnapshot } from './shapesRedraw'

/** O redesenho das camadas vetoriais (`createShapesRedrawer`): pinta as que mudaram e devolve quais. */
export type ShapesRedrawer = (snapshot: ShapesSnapshot, only?: readonly ShapesLayer[]) => ShapesLayer[]

/**
 * TROCA DE CENA RÁPIDA. Entrar num andar denso travava a tela por segundos
 * (medido na torre cheia, 24/09/2026: a09 5.050 ms na 1ª visita, tarefa longa
 * de 2.772 ms; redesenho das formas 895 ms, dos quais 511 ms só nos nomes de
 * sala). Agora o clique pinta paredes e salas, e o resto chega em fatias, uma
 * por quadro, com o navegador desenhando e respondendo entre elas.
 *
 * Cena pequena continua trocando inteira no clique: para ela, adiar só
 * atrasaria nomes e pinos sem tirar tarefa longa nenhuma.
 */
export const LIMIAR_CENA_DENSA = 300

/** Quantos objetos vetoriais a cena tem: salas, paredes, escadas, luzes, pinos, desenhos e fichas. */
export function cenaDensa(map: MapData): boolean {
  const total =
    map.regions.length + map.walls.length + map.stairs.length + map.lights.length + map.pins.length + map.drawings.length + map.tokens.length
  return total >= LIMIAR_CENA_DENSA
}

/** O que a pessoa precisa ver no clique para saber onde está: chão, grade, traços, salas, paredes e escadas. */
const PRIMEIRA_FATIA: ReadonlySet<ShapesLayer> = new Set<ShapesLayer>(['floor', 'gridMask', 'mapLines', 'mapFrame', 'regions', 'walls', 'stairs'])

/**
 * O resto, um grupo por quadro. Nomes de sala e luzes (as duas pinturas mais
 * caras do perfil) ficam sozinhos no quadro deles, para não somarem numa
 * tarefa longa de novo.
 */
const FATIAS_SEGUINTES: readonly (readonly ShapesLayer[])[] = [
  ['floorSelection', 'perigos', 'drawings', 'hazards', 'areaTriggers'],
  ['roomNames'],
  ['lights', 'watchCones', 'patrolRoutes'],
  ['concealZones', 'pins', 'textLabels', 'handles', 'areaOutline'],
]

export interface MontagemOpcoes {
  /** Estado de AGORA: a fatia seguinte desenha o mapa do quadro dela, não o do clique. */
  ler: () => ShapesSnapshot
  /** Roda `tarefa` no próximo quadro; devolve quem cancela. */
  agendar: (tarefa: () => void) => () => void
  /** Esconde a camada adiada até ela ser pintada: sem isto ela mostraria nomes e pinos da cena anterior. */
  esconder: (camada: ShapesLayer, oculta: boolean) => void
  /** Uma fatia foi pintada fora de `redesenhar` (quem chama sincroniza a resolução dos textos). */
  aoPintar?: (pintadas: readonly ShapesLayer[]) => void
  /** A montagem começou (`true`) ou terminou (`false`): o editor marca `aria-busy`. */
  aoMudarMontagem?: (montando: boolean) => void
}

export interface MontadorDeCena {
  /** Mesmo contrato do redesenho de formas, com a troca para cena densa em fatias. */
  redesenhar: ShapesRedrawer
  /** Pinta agora tudo o que faltava (exportar imagem precisa da cena inteira na mesma chamada). */
  concluir: () => ShapesLayer[]
  /** Editor fechando: desliga o quadro agendado sem pintar. */
  cancelar: () => void
  montando: () => boolean
}

/** Filtra `camadas` mantendo a ordem de pintura de SHAPES_LAYERS. */
function naOrdem(camadas: ReadonlySet<ShapesLayer>): ShapesLayer[] {
  return SHAPES_LAYERS.filter((camada) => camadas.has(camada))
}

export function createMontadorEmFatias(redraw: ShapesRedrawer, opcoes: MontagemOpcoes): MontadorDeCena {
  let ultimaCena: string | null = null
  const pendentes = new Set<ShapesLayer>()
  let cancelarQuadro: (() => void) | null = null

  const desagendar = () => {
    if (cancelarQuadro === null) return
    cancelarQuadro()
    cancelarQuadro = null
  }

  /** Mostra de volta as camadas que saíram de `pendentes` e avisa o fim da montagem, se acabou. */
  const liberar = (camadas: readonly ShapesLayer[]) => {
    for (const camada of camadas) {
      pendentes.delete(camada)
      opcoes.esconder(camada, false)
    }
    if (pendentes.size === 0) {
      desagendar()
      opcoes.aoMudarMontagem?.(false)
    }
  }

  const proximaFatia = () => {
    cancelarQuadro = null
    const fatia = FATIAS_SEGUINTES.find((grupo) => grupo.some((camada) => pendentes.has(camada)))
    if (fatia === undefined) return
    const camadas = fatia.filter((camada) => pendentes.has(camada))
    const pintadas = redraw(opcoes.ler(), camadas)
    liberar(camadas)
    if (pintadas.length > 0) opcoes.aoPintar?.(pintadas)
    if (pendentes.size > 0) cancelarQuadro = opcoes.agendar(proximaFatia)
  }

  const iniciar = () => {
    desagendar()
    const jaMontava = pendentes.size > 0
    for (const camada of SHAPES_LAYERS) {
      if (PRIMEIRA_FATIA.has(camada)) continue
      pendentes.add(camada)
      opcoes.esconder(camada, true)
    }
    if (!jaMontava) opcoes.aoMudarMontagem?.(true)
    cancelarQuadro = opcoes.agendar(proximaFatia)
  }

  const redesenhar: ShapesRedrawer = (snapshot, only) => {
    const cena = snapshot.map.id
    const trocou = ultimaCena !== null && cena !== ultimaCena
    ultimaCena = cena
    const pedidas = new Set<ShapesLayer>(only ?? SHAPES_LAYERS)

    if (trocou && cenaDensa(snapshot.map)) {
      iniciar()
      return redraw(snapshot, naOrdem(new Set([...pedidas].filter((camada) => PRIMEIRA_FATIA.has(camada)))))
    }

    if (trocou && pendentes.size > 0) {
      // Cena pequena no meio de uma montagem: o que faltava não pode ficar com a cena velha.
      const faltavam = [...pendentes]
      for (const camada of faltavam) pedidas.add(camada)
      const pintadas = redraw(snapshot, naOrdem(pedidas))
      liberar(faltavam)
      return pintadas
    }

    // Redesenho comum: camada adiada espera o quadro dela, que lê o estado de então.
    for (const camada of pendentes) pedidas.delete(camada)
    return redraw(snapshot, naOrdem(pedidas))
  }

  return {
    redesenhar,
    concluir: () => {
      if (pendentes.size === 0) return []
      const faltavam = [...pendentes]
      const pintadas = redraw(opcoes.ler(), naOrdem(new Set(faltavam)))
      liberar(faltavam)
      return pintadas
    },
    cancelar: desagendar,
    montando: () => pendentes.size > 0,
  }
}
