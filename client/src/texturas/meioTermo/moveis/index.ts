/**
 * MÓVEIS COM TEXTURA do Meio-Termo, vista "de cima com volume": quais tipos já
 * têm desenho (os 6 da fatia MT2) e a montagem da cena de um móvel a partir do
 * DESENHO (tipo, Frente/Lado, materiais, pegada em casas, semente). Os outros
 * 5 tipos chegam na MT3; até lá seguem no desenho de linhas.
 */
import type { TipoMobilia } from '../../../lib/mobilia/tipos'
import { LUGARES_DE_MATERIAL, ehMaterial, type OpcaoDeMaterial } from '../materiais'
import { G, materialDaPeca, type LadoDoMovel, type MateriaisDoMovel, type MontarMovel } from './contexto'
import { criarPecas, pintarCena, type Cena, type LimitesDaImagem, type MaterialDaPeca } from './motor'
import { montarBarril } from './barril'
import { montarCaixa } from './caixa'
import { montarBau } from './bau'
import { montarCatre } from './catre'
import { montarMesa } from './mesa'
import { montarCadeira } from './cadeira'

const MONTADORES = {
  barril: montarBarril,
  caixa: montarCaixa,
  bau: montarBau,
  catre: montarCatre,
  mesa: montarMesa,
  cadeira: montarCadeira,
} as const satisfies Partial<Record<TipoMobilia, MontarMovel>>

export type TipoComTextura = keyof typeof MONTADORES

/**
 * Px de MUNDO por casa que a imagem supõe. `drawPropSilhouettes` não recebe a
 * grade do mapa (a assinatura é fixa), então a pegada em casas sai do tamanho
 * do objeto sobre a grade padrão do app (50 px, `player/meuCaderno.ts:210`).
 * Em mapa de outra grade a imagem só é esticada para o tamanho do objeto.
 */
export const GRADE_DE_REFERENCIA = 50

/** Pixels da imagem por px do protótipo no nível 1, 2 ou 3: o nível é pixels da imagem por px de mundo. */
export function escalaDoNivel(nivel: number): number {
  return (nivel * GRADE_DE_REFERENCIA) / G
}

/** Os tipos que já têm desenho com textura, na ordem do catálogo. */
export const TIPOS_COM_TEXTURA: readonly TipoComTextura[] = ['barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira']

export function temTextura(tipo: TipoMobilia | undefined): tipo is TipoComTextura {
  return TIPOS_COM_TEXTURA.some((t) => t === tipo)
}

/** O que define a imagem de um móvel. Móveis com o mesmo desenho dividem a mesma imagem. */
export interface DesenhoDoMovel {
  readonly tipo: TipoComTextura
  readonly lado: LadoDoMovel
  /** Uma opção por lugar, na ordem de `LUGARES_DE_MATERIAL[tipo]`. */
  readonly materiais: readonly OpcaoDeMaterial[]
  /** Pegada em casas (largura e altura do objeto, sem giro). */
  readonly casasW: number
  readonly casasH: number
  /** Semente do veio: inteira, a mesma para o mesmo desenho. */
  readonly semente: number
}

/**
 * O material de cada lugar. Opção fora da lista do lugar vira o padrão; as
 * que usam a madeira do móvel (`mesma`, `varas`) viram a madeira escolhida.
 */
function materiaisDoDesenho(d: DesenhoDoMovel): MateriaisDoMovel {
  const lugares = LUGARES_DE_MATERIAL[d.tipo]
  const ids = lugares.map((lugar, i) => {
    const escolhida = d.materiais[i]
    return escolhida !== undefined && lugar.opcoes.includes(escolhida) ? escolhida : lugar.padrao
  })
  // Todo tipo com textura tem o lugar `madeira`, e as opções dele são todas madeiras de verdade.
  const daMadeira = ids.find((_id, i) => lugares[i].id === 'madeira')
  const madeira = daMadeira !== undefined && ehMaterial(daMadeira) ? daMadeira : 'carvalho'
  const m: Record<string, MaterialDaPeca> = {}
  lugares.forEach((lugar, i) => {
    const id = ids[i]
    m[lugar.id] = materialDaPeca(ehMaterial(id) ? id : madeira)
  })
  return m
}

/** As peças e as sombras do móvel, em px do protótipo, centradas na origem. */
export function montarCena(d: DesenhoDoMovel): Cena {
  const w = d.casasW * G
  const h = d.casasH * G
  const cena: Cena = { partes: [], sombras: [] }
  MONTADORES[d.tipo]({ w, h, hw: w / 2, hh: h / 2, g: G, lado: d.lado, m: materiaisDoDesenho(d), peca: criarPecas(d.semente) }, cena)
  return cena
}

/** A imagem inteira de uma vez, em `S` pixels por px do protótipo (teste e folha de contato). */
export function pintarMovel(d: DesenhoDoMovel, S: number): { limites: LimitesDaImagem; pixels: Uint8ClampedArray } {
  return pintarCena(montarCena(d), S)
}
