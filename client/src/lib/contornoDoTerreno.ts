import type { FloorPiece, PinceladaDeTextura, RegionPoint } from '../types/map'
import type { FloorClip } from './floorContour'
import { formasDoTerreno, passoDoTerreno, pontosDosAneis } from './terrenoDoChao'

/**
 * O CONTRATO DO WORKER DO CONTORNO DO TERRENO (FX-CAMINHO2-062): o que vai e o
 * que volta entre a página (`terrenoNoWorker.ts`) e o worker
 * (`terreno.worker.ts`), e as duas pontas da conta. Arquivo à parte para o
 * worker não importar quem o abre (o `new Worker` dentro do worker).
 *
 * A conta é a de `passosDoTerreno` (`formasDoTerreno` e `pontosDosAneis`); os
 * pontos viajam num `Float64Array` por material (transferido, sem cópia) e a
 * página monta os passos pelo mesmo `passoDoTerreno`: saem iguais, byte a byte.
 */

/** Um material contado: a textura e os pontos da forma dele (x, y, x, y...), como `pontosDosAneis` os dá. */
export interface MaterialContado {
  readonly textura: string
  readonly pontos: Float64Array
}

/** O pedido que vai ao worker. `clip: null` = sem recorte. */
export interface PedidoDoTerreno {
  readonly pedido: number
  readonly pecas: readonly FloorPiece[]
  readonly grid: number
  readonly clip: FloorClip | null
}

/** O que o worker manda de volta: o aviso de que abriu, ou a resposta de um pedido. */
export type RespostaDoTerreno =
  | { readonly tipo: 'pronto' }
  | { readonly tipo: 'terreno'; readonly pedido: number; readonly materiais: readonly MaterialContado[] }
  | { readonly tipo: 'erro'; readonly pedido: number }

/** Os materiais contados destas peças: a conta de `passosDoTerreno`, com os pontos em linha. Roda no worker. */
export function materiaisContados(pecas: readonly FloorPiece[], grid: number, clip: FloorClip | null): MaterialContado[] {
  return formasDoTerreno(pecas, grid, clip ?? undefined).map((forma) => {
    const pontos = pontosDosAneis(forma.aneis)
    const linha = new Float64Array(pontos.length * 2)
    pontos.forEach((p, i) => {
      linha[i * 2] = p.x
      linha[i * 2 + 1] = p.y
    })
    return { textura: forma.textura, pontos: linha }
  })
}

/** Os passos de balde dos materiais contados, montados como `passosDoTerreno` monta. */
export function passosDosMateriais(materiais: readonly MaterialContado[]): PinceladaDeTextura[] {
  return materiais.map((m) => {
    const pontos = new Array<RegionPoint>(m.pontos.length / 2)
    for (let i = 0; i < pontos.length; i += 1) pontos[i] = { x: m.pontos[i * 2], y: m.pontos[i * 2 + 1] }
    return passoDoTerreno(m.textura, pontos)
  })
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function materialContado(valor: unknown): MaterialContado | null {
  if (!ehRegistro(valor)) return null
  const { textura, pontos } = valor
  return typeof textura === 'string' && pontos instanceof Float64Array && pontos.length % 2 === 0 ? { textura, pontos } : null
}

/** Lê a mensagem do worker; forma estranha = `null` (ignorada). */
export function respostaDoTerreno(valor: unknown): RespostaDoTerreno | null {
  if (!ehRegistro(valor)) return null
  if (valor.tipo === 'pronto') return { tipo: 'pronto' }
  const { pedido } = valor
  if (typeof pedido !== 'number' || !Number.isSafeInteger(pedido)) return null
  if (valor.tipo === 'erro') return { tipo: 'erro', pedido }
  if (valor.tipo !== 'terreno' || !Array.isArray(valor.materiais)) return null
  const materiais: MaterialContado[] = []
  for (const item of valor.materiais) {
    const material = materialContado(item)
    if (material === null) return null
    materiais.push(material)
  }
  return { tipo: 'terreno', pedido, materiais }
}

/**
 * O pedido do jeito que o worker aceita; o resto ele ignora. As peças só são
 * conferidas como lista: vêm da própria página (`pedirTerreno`), e peça torta
 * faz a conta lançar, o que volta como `erro` (a página conta de novo).
 */
export function ehPedidoDoTerreno(valor: unknown): valor is PedidoDoTerreno {
  if (!ehRegistro(valor)) return false
  const { pedido, pecas, grid, clip } = valor
  const clipServe = clip === null || (ehRegistro(clip) && [clip.minX, clip.minY, clip.maxX, clip.maxY].every((n) => typeof n === 'number' && Number.isFinite(n)))
  return typeof pedido === 'number' && Number.isSafeInteger(pedido) && Array.isArray(pecas) && typeof grid === 'number' && Number.isFinite(grid) && grid > 0 && clipServe
}
