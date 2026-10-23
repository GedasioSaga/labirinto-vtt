/**
 * MÓVEIS COM TEXTURA do Meio-Termo, vista "de cima com volume": os 11 tipos do
 * catálogo (6 da fatia MT2 e 5 da MT3: cerca reta e curva, armário, aparador,
 * fogueira e tapete) e a montagem da cena de um móvel a partir do DESENHO
 * (tipo, Frente/Lado, materiais, pegada em casas, forma do tapete, volta da
 * cerca, semente).
 */
import type { TipoMobilia } from '../../../lib/mobilia/tipos'
import type { FormaDoTapete } from '../../../types/map'
import { LUGARES_DE_MATERIAL, ehMaterial, type OpcaoDeMaterial } from '../materiais'
import { G, materialDaPeca, type LadoDoMovel, type MateriaisDoMovel, type MontarMovel } from './contexto'
import { criarPecas, pintarCena, type Cena, type LimitesDaImagem, type MaterialDaPeca } from './motor'
import { montarBarril } from './barril'
import { montarCaixa } from './caixa'
import { montarBau } from './bau'
import { montarCatre } from './catre'
import { montarMesa } from './mesa'
import { montarCadeira } from './cadeira'
import { montarCerca } from './cerca'
import { montarArmario } from './armario'
import { montarAparador } from './aparador'
import { montarFogueira } from './fogueira'
import { montarTapete } from './tapete'
import { montarMesaQuadrada } from './mesaQuadrada'
import { montarMesaRedonda } from './mesaRedonda'
import { montarLapide } from './lapide'
import { montarVaso } from './vaso'
import { montarLampiao } from './lampiao'
import { montarQuadroDeAvisos } from './quadroDeAvisos'
import { montarPoco } from './poco'
import { montarBarraca } from './barraca'
import { montarCarroca } from './carroca'

const MONTADORES = {
  barril: montarBarril,
  caixa: montarCaixa,
  bau: montarBau,
  catre: montarCatre,
  mesa: montarMesa,
  cadeira: montarCadeira,
  cerca: montarCerca,
  armario: montarArmario,
  aparador: montarAparador,
  fogueira: montarFogueira,
  tapete: montarTapete,
  // As peças novas do lote 1 (MT4). Com o desenho aqui elas saem em imagem; o painel só as
  // oferece depois de medidas (`PECAS_NOVAS_PRONTAS` em `lib/mobilia/pecasNovas.ts`).
  mesaQuadrada: montarMesaQuadrada,
  mesaRedonda: montarMesaRedonda,
  lapide: montarLapide,
  vaso: montarVaso,
  lampiao: montarLampiao,
  quadroDeAvisos: montarQuadroDeAvisos,
  poco: montarPoco,
  barraca: montarBarraca,
  carroca: montarCarroca,
} as const satisfies Record<TipoMobilia, MontarMovel>

export type TipoComTextura = keyof typeof MONTADORES

/**
 * Px de MUNDO por casa que a imagem supõe. `drawPropSilhouettes` não recebe a
 * grade do mapa (a assinatura é fixa, e quem a chama no jogador é
 * `PlayerView.tsx`, arquivo quente), então a pegada em casas sai do tamanho do
 * objeto sobre a grade padrão do app (50 px, `player/meuCaderno.ts:210`).
 * Em mapa de outra grade a imagem NÃO é só esticada: o desenho é feito para a
 * pegada em casas de 50 px, e o que se repete por casa sai mais denso ou mais
 * ralo. Medido: na grade 70 o tapete 3 x 2 (210 x 140 px) é desenhado como
 * 4,2 x 2,8 casas, com 2,8 losangos da borda por casa do mapa em vez de 2 (o
 * tapete longo da MT5 herda isso). A cerca não: os mourões tomam a espessura
 * dela como régua (`geometriaDaCerca`).
 */
export const GRADE_DE_REFERENCIA = 50

/** Pixels da imagem por px do protótipo no nível 1, 2 ou 3: o nível é pixels da imagem por px de mundo. */
export function escalaDoNivel(nivel: number): number {
  return (nivel * GRADE_DE_REFERENCIA) / G
}

/** Os tipos que têm desenho com textura, na ordem do catálogo: os 11. */
export const TIPOS_COM_TEXTURA: readonly TipoComTextura[] = [
  'barril', 'caixa', 'bau', 'catre', 'mesa', 'cadeira', 'cerca', 'armario', 'aparador', 'fogueira', 'tapete',
  'mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'poco', 'barraca', 'carroca',
]

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
  /** Só no tapete: retangular (o padrão) ou redondo. */
  readonly forma?: FormaDoTapete
  /** Só na cerca: a volta em graus (0 ou ausente = reta). */
  readonly curva?: number
  /** Só na lápide: o desenho (0, 1 ou 2), do hash do id do objeto (`varianteDaLapide`). */
  readonly variante?: number
}

/**
 * O material de cada lugar. Opção fora da lista do lugar vira o padrão; as
 * que usam a madeira do móvel (`mesma` da cadeira, `varas` da cerca) viram a
 * madeira escolhida. A fogueira e o tapete não têm madeira, mas também não têm
 * essas opções.
 */
function materiaisDoDesenho(d: DesenhoDoMovel): MateriaisDoMovel {
  const lugares = LUGARES_DE_MATERIAL[d.tipo]
  const ids = lugares.map((lugar, i) => {
    const escolhida = d.materiais[i]
    return escolhida !== undefined && lugar.opcoes.includes(escolhida) ? escolhida : lugar.padrao
  })
  // Quem tem `mesma` ou `varas` tem o lugar `madeira`, e as opções dele são todas madeiras de verdade.
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
  const contexto = { w, h, hw: w / 2, hh: h / 2, g: G, lado: d.lado, m: materiaisDoDesenho(d), peca: criarPecas(d.semente), forma: d.forma ?? 'retangular', curva: d.curva ?? 0, variante: d.variante ?? 0 }
  MONTADORES[d.tipo](contexto, cena)
  return cena
}

/** A imagem inteira de uma vez, em `S` pixels por px do protótipo (teste e folha de contato). */
export function pintarMovel(d: DesenhoDoMovel, S: number): { limites: LimitesDaImagem; pixels: Uint8ClampedArray } {
  return pintarCena(montarCena(d), S)
}
