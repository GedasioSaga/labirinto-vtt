import { Container, Graphics } from 'pixi.js'
import type { Caixa } from '../lib/texturas'
import type { Drawing, DrawingPoint } from '../types/map'
import { criarCamadaDePiso, type CamadaDePiso, type ContextoDoPiso, type FormaDoPiso } from './pisoDesenhado'

/**
 * O CAMINHO DESENHADO (plano de 29/10/2026, F2a): a trilha da ferramenta
 * Caminho (`Drawing` de `kind: 'path'`) no estilo Desenhado vira os pedaços do
 * chão `caminho` do pacote, na cor da própria textura, vistos por uma máscara
 * com o traço (`pisoDesenhado.ts`, o mesmo cache de pedaços do chão).
 *
 * O traço chapado de hoje continua POR BAIXO (é o Atual: enquanto as imagens
 * não chegam, ou se o chão não carregar, a tela mostra a trilha chapada). Por
 * isso cada nó das faixas de caminhos (`pathsGraphics` no editor, `paths` no
 * jogador) virou um Container com dois filhos, o traço (Graphics) e a camada
 * do Desenhado por cima: o Pixi 8 não deixa um Graphics ter filhos.
 */

interface PartesDoNo {
  readonly traco: Graphics
  readonly piso: CamadaDePiso
}

export interface CaminhosDesenhados {
  /** O nó de hoje de uma faixa de caminhos, com o traço chapado `traco` dentro. */
  base: (traco: Graphics) => Container
  /** Pinta o nó: o traço chapado (por `desenhar`) e, no Desenhado, a trilha do pacote por cima. */
  pintar: (no: Container, caminhos: readonly Drawing[], desenhar: (traco: Graphics) => void, contexto: ContextoDoPiso | null) => void
  /** Solta o que um nó criado pela pilha guardava (o nó em si é de quem criou). */
  soltar: (no: Container) => void
  ajustarAVista: (vista: Caixa | null) => void
  destruir: () => void
}

const BRANCO = 0xffffff

function tracarTrilha(g: Graphics, pontos: readonly DrawingPoint[], largura: number): void {
  const [primeiro, ...resto] = pontos
  g.moveTo(primeiro.x, primeiro.y)
  for (const p of resto) g.lineTo(p.x, p.y)
  // A mesma ponta e junta do traço chapado (`drawDrawings`): a máscara cobre o que ele cobre.
  g.stroke({ width: largura, color: BRANCO, cap: 'round', join: 'round' })
}

/** A caixa da trilha com a meia largura em volta; `null` = nada a cobrir. */
function caixaDaTrilha(pontos: readonly DrawingPoint[], largura: number): Caixa | null {
  if (pontos.length < 2 || !(largura > 0)) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pontos) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const meia = largura / 2 + 1
  if (!Number.isFinite(minX + minY + maxX + maxY)) return null
  return { minX: Math.floor(minX - meia), minY: Math.floor(minY - meia), maxX: Math.ceil(maxX + meia), maxY: Math.ceil(maxY + meia) }
}

/** As trilhas da lista (os outros desenhos não têm piso), na ordem de pintura. */
export function formasDoCaminho(desenhos: readonly Drawing[]): FormaDoPiso[] {
  const formas: FormaDoPiso[] = []
  for (const d of desenhos) {
    if (d.kind !== 'path') continue
    const caixa = caixaDaTrilha(d.points, d.width)
    if (caixa === null) continue
    const { points, width } = d
    formas.push({ chave: `caminho:${d.id}`, textura: 'caminho', cor: null, desenho: d, caixa, tracar: (g) => tracarTrilha(g, points, width) })
  }
  return formas
}

export function criarCaminhosDesenhados(): CaminhosDesenhados {
  const partes = new Map<Container, PartesDoNo>()
  let vista: Caixa | null = null

  function montar(no: Container, traco: Graphics): PartesDoNo {
    const piso = criarCamadaDePiso()
    piso.ajustarAVista(vista)
    no.addChild(traco, piso.camada)
    const novas = { traco, piso }
    partes.set(no, novas)
    return novas
  }

  /** Os nós que a pilha cria (camada fora do lugar) nascem vazios: o traço e o piso entram no primeiro uso. */
  function partesDe(no: Container): PartesDoNo {
    return partes.get(no) ?? montar(no, new Graphics())
  }

  return {
    base: (traco) => {
      const no = new Container()
      no.label = 'caminhos'
      montar(no, traco)
      return no
    },
    pintar: (no, caminhos, desenhar, contexto) => {
      const { traco, piso } = partesDe(no)
      desenhar(traco)
      piso.atualizar(contexto === null ? [] : formasDoCaminho(caminhos), contexto)
    },
    soltar: (no) => {
      const doNo = partes.get(no)
      if (doNo === undefined) return
      partes.delete(no)
      no.removeChild(doNo.piso.camada)
      doNo.piso.destruir()
    },
    ajustarAVista: (agora) => {
      vista = agora
      for (const { piso } of partes.values()) piso.ajustarAVista(agora)
    },
    destruir: () => {
      for (const { piso } of partes.values()) piso.destruir()
      partes.clear()
    },
  }
}
