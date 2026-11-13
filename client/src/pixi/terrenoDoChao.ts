import type { Container } from 'pixi.js'
import type { FloorPiece, PinceladaDeTextura, TexturaImportada } from '../types/map'
import { mapFloorClip } from '../lib/floorContour'
import type { Caixa } from '../lib/texturas'
import { temMaterial } from '../lib/terrenoDoChao'
import { pedirTerreno } from '../lib/terrenoNoWorker'
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
 * A forma sai de uma conta de contorno (`pedirTerreno`), feita num worker
 * (`lib/terrenoNoWorker.ts`, FX-CAMINHO2-062): enquanto a mão mexe numa peça,
 * ela espera `ESPERA_DO_TERRENO_MS` sem pedido novo antes de pedir; enquanto o
 * worker conta, a pintura de antes fica na tela (nada, na primeira vez), e a
 * nova entra quando ele volta. Resposta de pedido que já foi trocado por outro
 * não pinta. Troca de cena solta a pintura da anterior e pede na hora.
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

/** Os passos desta entrada: na hora, ou a promessa do worker; `null` = nenhuma peça com material. */
function passosDaEntrada(entrada: EntradaDoTerreno): PinceladaDeTextura[] | Promise<PinceladaDeTextura[]> | null {
  if (!entrada.floor.some(temMaterial)) return null
  return pedirTerreno(entrada.floor, entrada.mapa.grid, mapFloorClip(entrada.mapa))
}

function entradaDasTexturas(entrada: EntradaDoTerreno, passos: PinceladaDeTextura[]): EntradaDasTexturas | null {
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
  /** Sobe a cada pedido: a resposta do worker de um pedido trocado por outro não pinta. */
  let versao = 0

  const cancelar = () => {
    if (pendente !== null) clearTimeout(pendente)
    pendente = null
  }

  const atualizar = (entrada: EntradaDoTerreno | null) => {
    if (destruido) return
    cancelar()
    versao += 1
    const minha = versao
    const cenaNova = (entrada?.cena ?? null) !== cenaPedida
    cenaPedida = entrada?.cena ?? null
    if (entrada === null || !entrada.floor.some(temMaterial)) {
      pintor.atualizar(null)
      return
    }
    const pintar = () => {
      pendente = null
      if (destruido || minha !== versao) return
      const passos = passosDaEntrada(entrada)
      if (passos === null || Array.isArray(passos)) {
        pintor.atualizar(passos === null ? null : entradaDasTexturas(entrada, passos))
        return
      }
      // Cena nova contando no worker: a pintura da anterior não fica por cima do mapa novo.
      if (cenaNova) pintor.atualizar(null)
      passos.then(
        (contados) => {
          if (!destruido && minha === versao) pintor.atualizar(entradaDasTexturas(entrada, contados))
        },
        (erro: unknown) => console.warn('[terreno] a conta do contorno falhou', erro),
      )
    }
    if (cenaNova) pintar()
    else pendente = setTimeout(pintar, ESPERA_DO_TERRENO_MS)
  }

  return {
    camada: pintor.camada,
    atualizar,
    ajustarAVista: (vista) => pintor.ajustarAVista(vista),
    pintarAParte: async (entrada) => {
      const passos = passosDaEntrada(entrada)
      const daEntrada = passos === null ? null : entradaDasTexturas(entrada, await passos)
      return daEntrada === null || destruido ? null : pintor.pintarAParte(daEntrada)
    },
    destruir: () => {
      destruido = true
      cancelar()
      pintor.destruir()
    },
  }
}
