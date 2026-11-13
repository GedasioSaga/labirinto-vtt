import type { MapData, Token } from '../types/map'
import { snapPointForTarget } from '../pixi/tokenInteraction'
import { limitarTamanho, seatTokenCenter, tokenSizeInSquares, type Point } from './tokenSize'

/**
 * TAMANHO DA FICHA AO ENTRAR, por cena (`MapData.tamanhoDaFichaAoEntrar`,
 * pedido do mestre de 12/11/2026: "de uma cena para outra eu tenho que ficar
 * remodelando").
 *
 * - Cena COM padrão: toda ficha que chega a ela, por qualquer caminho
 *   (passagem, escada, "Reunir grupo", "Levar para…", "Enviar para cena",
 *   rotina do NPC, "+ Token", acervo, personagem arrastado do livro), entra com
 *   esse lado. Ficha grande (2 x 2, montaria) também: decisão do mestre — ele
 *   aumenta à mão depois.
 * - Cena SEM padrão ("Não mudar", toda cena de antes): a ficha entra com o
 *   tamanho que tinha. Nada muda.
 * - Mudar de lugar DENTRO da cena (atalho, escada para outro piso da mesma
 *   cena, arrastar) não é entrar: o tamanho fica.
 *
 * UM PONTO DE DECISÃO: quem põe ficha numa cena pergunta a `tamanhoAoEntrar`
 * (para escolher a casa de chegada já no tamanho certo) e grava com
 * `fichaQueEntra`; nunca lê o campo direto.
 */

/**
 * O lado (em casas) que o arquivo e o painel aceitam: o número digitado no
 * campo (pedido de 12/11/2026, 0,5 ou 1,5 também), com duas casas decimais e
 * dentro de 0,25 a 6 — fora disso, o limite mais perto (`limitarTamanho`).
 * Texto, zero, negativo ou NaN não são tamanho: sem padrão.
 */
export function lerTamanhoAoEntrar(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return undefined
  return limitarTamanho(raw).casas
}

/** O padrão da cena, em casas; `null` = "Não mudar". Valor torto vale como sem padrão. */
export function tamanhoPadraoDaCena(map: Pick<MapData, 'tamanhoDaFichaAoEntrar'>): number | null {
  return lerTamanhoAoEntrar(map.tamanhoDaFichaAoEntrar) ?? null
}

/**
 * O lado com que `token` chega a `destino`: o padrão da cena, quando ela tem;
 * senão o que ele tem agora. É o tamanho que a procura da casa de chegada
 * tem de usar — a casa livre de uma ficha de 1 casa não serve à de 2.
 */
export function tamanhoAoEntrar(destino: Pick<MapData, 'tamanhoDaFichaAoEntrar'>, token: { size?: unknown }): number {
  return tamanhoPadraoDaCena(destino) ?? tokenSizeInSquares(token)
}

/**
 * Onde o centro de uma ficha de `cells` casas assenta, a partir de `point`:
 * o snap de token do editor (`snapPointForTarget` + `seatTokenCenter`, o mesmo
 * par de `pinSeat` em `lib/pinTravel.ts`). Na grade quadrada, ficha de lado
 * par assenta na linha da grade e a de lado ímpar ou quebrado (0,5, 1,5) no
 * meio da casa; um ponto já assentado para `cells` volta igual. Na grade
 * hexagonal o ponto fica.
 */
function assentoNoTamanho(map: Pick<MapData, 'grid' | 'gridShape'>, point: Point, cells: number): Point {
  if (map.gridShape !== 'square') return point
  const snapped = snapPointForTarget('token', map.gridShape, point.x, point.y, map.grid)
  return seatTokenCenter(point, snapped, map.grid, cells)
}

/**
 * A ficha `token`, já no ponto de chegada, como entra em `destino`: com o
 * padrão da cena quando ele existe e é outro lado. A casa de chegada deve ter
 * sido escolhida com `tamanhoAoEntrar`; se veio no tamanho antigo (um caminho
 * que ainda não pergunta), o centro é assentado de novo para o lado novo, para
 * a ficha não ficar atravessada na grade. Sem padrão, ou já no padrão: o MESMO
 * objeto, sem mexer em nada.
 */
export function fichaQueEntra(destino: Pick<MapData, 'tamanhoDaFichaAoEntrar' | 'grid' | 'gridShape'>, token: Token): Token {
  const padrao = tamanhoPadraoDaCena(destino)
  if (padrao === null || token.size === padrao) return token
  const casa = assentoNoTamanho(destino, { x: token.x, y: token.y }, padrao)
  return { ...token, size: padrao, x: casa.x, y: casa.y }
}

/**
 * "Aplicar às fichas desta cena (N)": quantas fichas da cena mudam de tamanho
 * se o padrão for posto em todas. `0` também quando a cena não tem padrão.
 */
export function fichasForaDoPadrao(map: Pick<MapData, 'tamanhoDaFichaAoEntrar' | 'tokens'>): number {
  const padrao = tamanhoPadraoDaCena(map)
  if (padrao === null) return 0
  return map.tokens.filter((token) => token.size !== padrao).length
}

/**
 * Todas as fichas da cena no padrão dela, num passo só. Como o "Tamanho da
 * ficha" do painel, o centro não sai do lugar: a ficha cresce (ou encolhe) em
 * volta de onde está, e o próximo arrasto a assenta na grade. Sem padrão, ou
 * com todas já nele: o MESMO mapa (nenhum passo de desfazer).
 */
export function comFichasNoPadrao(map: MapData): MapData {
  const padrao = tamanhoPadraoDaCena(map)
  if (padrao === null || !map.tokens.some((token) => token.size !== padrao)) return map
  return { ...map, tokens: map.tokens.map((token) => (token.size === padrao ? token : { ...token, size: padrao })) }
}

/**
 * Grava o padrão da cena. `undefined` (ou valor que não é tamanho) TIRA o campo,
 * como `setSceneVisionCells`: a cena volta a ser a de sempre, e o arquivo não
 * ganha a chave. Escolher o que já vale devolve o MESMO mapa.
 */
export function comTamanhoAoEntrar(map: MapData, tamanho: number | undefined): MapData {
  const valido = lerTamanhoAoEntrar(tamanho)
  if (valido !== undefined) return map.tamanhoDaFichaAoEntrar === valido ? map : { ...map, tamanhoDaFichaAoEntrar: valido }
  if (!('tamanhoDaFichaAoEntrar' in map)) return map
  const { tamanhoDaFichaAoEntrar: _semPadrao, ...rest } = map
  return rest
}
