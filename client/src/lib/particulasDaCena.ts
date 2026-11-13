import type { MapData, ParticulasDaCena, QuantidadeDeParticulas } from '../types/map'
import { soltaFumacaEBrasas, type FogoQueIlumina } from './luzDoFogo'

/**
 * PARTÍCULAS DA CENA (pedido do mestre de 09/11/2026: "partículas de fumaça
 * preta e brasas" para os jogadores). O mapa guarda só QUANTO de cada efeito
 * (`MapData.particulas`); o desenho é do `pixi/particulasDoMapa.ts`, igual no
 * mestre e no jogador. Ausente = desligado, e o mapa salva como antes.
 *
 * RASCUNHO: os tetos abaixo são os números que o mestre ajusta.
 */

export type EfeitoDeParticula = keyof ParticulasDaCena

export const EFEITOS_DE_PARTICULA: readonly EfeitoDeParticula[] = ['fumaca', 'brasas']
export const QUANTIDADES_DE_PARTICULAS: readonly QuantidadeDeParticulas[] = ['pouca', 'media', 'muita']

/**
 * Quantas partículas de cada efeito ficam vivas na tela ao mesmo tempo. É o
 * teto do custo: a tela nunca desenha mais que a soma dos dois em "muita".
 */
export const TETO_DE_PARTICULAS: Readonly<Record<EfeitoDeParticula, Readonly<Record<QuantidadeDeParticulas, number>>>> = {
  fumaca: { pouca: 40, media: 90, muita: 160 },
  brasas: { pouca: 30, media: 70, muita: 130 },
}

function lerQuantidade(bruto: unknown): QuantidadeDeParticulas | undefined {
  return QUANTIDADES_DE_PARTICULAS.find((q) => q === bruto)
}

/**
 * Lê o campo do arquivo: só entra efeito com quantidade conhecida. Nada
 * válido (ou o que não é objeto, editado à mão) devolve `undefined`.
 */
export function lerParticulas(bruto: unknown): ParticulasDaCena | undefined {
  if (typeof bruto !== 'object' || bruto === null) return undefined
  const fumaca = 'fumaca' in bruto ? lerQuantidade(bruto.fumaca) : undefined
  const brasas = 'brasas' in bruto ? lerQuantidade(bruto.brasas) : undefined
  if (fumaca === undefined && brasas === undefined) return undefined
  return { ...(fumaca === undefined ? {} : { fumaca }), ...(brasas === undefined ? {} : { brasas }) }
}

/** O teto de partículas vivas de um efeito nesta cena; 0 = desligado. */
export function tetoDoEfeito(map: Pick<MapData, 'particulas'>, efeito: EfeitoDeParticula): number {
  const quantidade = map.particulas?.[efeito]
  return quantidade === undefined ? 0 : TETO_DE_PARTICULAS[efeito][quantidade]
}

/** A cena tem algum efeito de partícula ligado? */
export function temParticulas(map: Pick<MapData, 'particulas'>): boolean {
  return EFEITOS_DE_PARTICULA.some((efeito) => tetoDoEfeito(map, efeito) > 0)
}

/** A cena inteira tem algum fogo que solta fumaça e brasas (`lib/luzDoFogo.ts`)? Só quem tem a cena toda responde. */
export function cenaTemFogo(objetos: readonly FogoQueIlumina[]): boolean {
  return objetos.some(soltaFumacaEBrasas)
}

/** O que uma tela entrega à camada de partículas (`pixi/particulasDoMapa.ts`). */
export interface ParticulasDaTela {
  /** A cena (`MapData.id`): trocou, as partículas da outra somem na hora. */
  cena: string
  /** Quantas partículas de cada efeito ficam vivas (`tetoDoEfeito`); 0 = efeito desligado. */
  fumaca: number
  brasas: number
  /** Os objetos que a tela tem: os fogos entre eles são as fontes. */
  objetos: readonly FogoQueIlumina[]
  /**
   * A cena inteira não tem fogo: as partículas nascem espalhadas pela vista.
   * Com `false`, só nascem dos fogos de `objetos`; sem nenhum à vista, nada nasce.
   */
  espalhar: boolean
  /** O lado da casa do mapa, em px de mundo. */
  grid: number
}

type CenaComParticulas = Pick<MapData, 'id' | 'particulas' | 'props' | 'grid'>

function particulasDaTela(map: CenaComParticulas, espalhar: boolean): ParticulasDaTela | null {
  if (!temParticulas(map)) return null
  return { cena: map.id, fumaca: tetoDoEfeito(map, 'fumaca'), brasas: tetoDoEfeito(map, 'brasas'), objetos: map.props, espalhar, grid: map.grid }
}

/**
 * As partículas na tela do mestre: só as que nascem dos fogos. AMBIENTE
 * (12/11/2026): sem fogo na cena, a fumaça e as brasas do mapa inteiro são do
 * `pixi/drawAmbiente.ts`, que cobre o mapa (e não a vista, que espalhava
 * brasa fora da beira). `null` = desligadas.
 */
export function particulasDoMestre(map: CenaComParticulas): ParticulasDaTela | null {
  return particulasDaTela(map, false)
}

/**
 * As partículas na tela do jogador, a partir do RECORTE que o host mandou. Ele
 * nunca decide espalhar por conta própria: os objetos dele são só os que
 * enxerga, e "nenhum fogo no recorte" numa cena cheia de fogos cobria a tela
 * (e a névoa) de fumaça. Quem diz que a cena não tem fogo é o host
 * (`MapData.particulasSemFogo`). `null` = desligadas.
 */
export function particulasDoJogador(recorte: CenaComParticulas & Pick<MapData, 'particulasSemFogo'>): ParticulasDaTela | null {
  // AMBIENTE: sem fogo na cena (`particulasSemFogo`), quem desenha é o `drawAmbiente.ts`; aqui, só dos fogos.
  return particulasDaTela(recorte, false)
}

/**
 * O mapa com um efeito na quantidade nova (`null` = desligado). O mesmo valor
 * devolve o MESMO mapa (sem passo vazio no desfazer); desligar o último efeito
 * tira o campo, e o mapa volta a salvar como antes.
 */
export function comParticulas(map: MapData, efeito: EfeitoDeParticula, quantidade: QuantidadeDeParticulas | null): MapData {
  const atual = map.particulas ?? {}
  if ((atual[efeito] ?? null) === quantidade) return map
  const nova: ParticulasDaCena = { ...atual }
  if (quantidade === null) delete nova[efeito]
  else nova[efeito] = quantidade
  if (nova.fumaca === undefined && nova.brasas === undefined) {
    const copia = { ...map }
    delete copia.particulas
    return copia
  }
  return { ...map, particulas: nova }
}
