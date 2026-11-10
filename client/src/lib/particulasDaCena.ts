import type { MapData, ParticulasDaCena, QuantidadeDeParticulas } from '../types/map'

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
