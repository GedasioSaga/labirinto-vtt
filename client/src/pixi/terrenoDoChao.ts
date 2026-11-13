import type { Container } from 'pixi.js'
import type { FloorPiece, TexturaImportada } from '../types/map'
import { mapFloorClip } from '../lib/floorContour'
import type { Caixa } from '../lib/texturas'
import { passosDoTerreno, temMaterial } from '../lib/terrenoDoChao'
import { createTexturasRenderer, type EntradaDasTexturas, type OpcoesDasTexturas } from './drawTexturas'

/**
 * TERRENO DO CHÃO no palco (`lib/terrenoDoChao.ts`): as peças de Chão com
 * material, numa faixa própria acima das Texturas e abaixo da luz do relevo
 * (`lib/camadas/ordem.ts`, `terrenoDoChao` no editor e `terrenoContainer` no
 * jogador). Pinta com o MESMO motor das Texturas (`drawTexturas.ts`): o
 * ladrilho da biblioteca (e os pedaços do Meio-Termo), visto por uma máscara
 * que aqui é a forma do material, com a beira nítida. Nada é desenhado por
 * quadro: a máscara nasce quando as peças mudam e fica parada.
 *
 * A forma sai de uma conta de contorno (`passosDoTerreno`): enquanto a mão
 * mexe numa peça, ela espera `ESPERA_DO_TERRENO_MS` sem pedido novo antes de
 * contar; a pintura de antes fica na tela até a nova ficar pronta. Troca de
 * cena pinta na hora.
 */

export const ESPERA_DO_TERRENO_MS = 150

export interface EntradaDoTerreno {
  /** Id da cena (com o piso): cena nova solta a pintura da anterior na hora. */
  cena: string
  mapa: EntradaDasTexturas['mapa']
  /** As peças de Chão que ESTA tela desenha (no jogador, as do recorte dele). */
  floor: FloorPiece[]
  importadas: readonly TexturaImportada[] | undefined
}

export interface TerrenoDoChao {
  readonly camada: Container
  atualizar: (entrada: EntradaDoTerreno | null) => void
  /** O pedaço do mundo à vista (`vistaDaCamera`), como o das Texturas. */
  ajustarAVista: (vista: Caixa | null) => void
  /** A pintura desta entrada num contêiner NOVO (a imagem exportada); `null` = nada a pintar. */
  pintarAParte: (entrada: EntradaDoTerreno) => Promise<Container | null>
  destruir: () => void
}

function entradaDasTexturas(entrada: EntradaDoTerreno): EntradaDasTexturas | null {
  if (!entrada.floor.some(temMaterial)) return null
  const passos = passosDoTerreno(entrada.floor, entrada.mapa.grid, mapFloorClip(entrada.mapa))
  if (passos.length === 0) return null
  // Sem salas nem desenhos: o balde do terreno é a área da forma, sem recorte.
  return { cena: entrada.cena, mapa: entrada.mapa, passos, importadas: entrada.importadas, regioes: [], desenhos: [] }
}

export function criarTerrenoDoChao(opcoes: OpcoesDasTexturas = {}): TerrenoDoChao {
  // A espera é daqui (antes da conta do contorno), não do pintor.
  const pintor = createTexturasRenderer({ ...opcoes, esperaMs: 0 })
  pintor.camada.label = 'terrenoDoChao'
  let pendente: ReturnType<typeof setTimeout> | null = null
  let cenaPedida: string | null = null
  let destruido = false

  const cancelar = () => {
    if (pendente !== null) clearTimeout(pendente)
    pendente = null
  }

  const atualizar = (entrada: EntradaDoTerreno | null) => {
    if (destruido) return
    cancelar()
    const cenaNova = (entrada?.cena ?? null) !== cenaPedida
    cenaPedida = entrada?.cena ?? null
    if (entrada === null || !entrada.floor.some(temMaterial)) {
      pintor.atualizar(null)
      return
    }
    const pintar = () => {
      pendente = null
      if (!destruido) pintor.atualizar(entradaDasTexturas(entrada))
    }
    if (cenaNova) pintar()
    else pendente = setTimeout(pintar, ESPERA_DO_TERRENO_MS)
  }

  return {
    camada: pintor.camada,
    atualizar,
    ajustarAVista: (vista) => pintor.ajustarAVista(vista),
    pintarAParte: async (entrada) => {
      const daEntrada = entradaDasTexturas(entrada)
      return daEntrada === null ? null : pintor.pintarAParte(daEntrada)
    },
    destruir: () => {
      destruido = true
      cancelar()
      pintor.destruir()
    },
  }
}
