import type { MapData, Pin, Token, Wall } from '../types/map'
import { DOOR_REACH_CELLS, distanceToWall, tokenRadiusOf, tokenReachesDoor, type ReachPoint } from './doorReach'

/**
 * JOGADOR TRANCA PORTA OU PASSAGEM — a conta pura, compartilhada pelo host
 * (`net/hostSession.ts`, que decide) e pela tela do jogador (que só oferece o
 * botão). O ferrolho e a barra moram na sessão do host, nunca no mapa do
 * mestre: são estado de jogo, como o pedido de passagem.
 */

/** De que lado da reta da porta está um ponto. Os dois lados são 1 e -1; qual é qual não importa. */
export type LadoDaPorta = 1 | -1

/**
 * Abaixo disto (em px de mundo, pela distância à reta) o ponto está NA porta,
 * sem lado: a ficha parada no vão não corre ferrolho de lado nenhum.
 */
const NA_LINHA_PX = 0.5

/** O lado do ponto em relação à reta que passa pela porta, ou `null` em cima dela. */
export function ladoDaPorta(wall: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>, ponto: ReachPoint): LadoDaPorta | null {
  const dx = wall.x2 - wall.x1
  const dy = wall.y2 - wall.y1
  const comprimento = Math.hypot(dx, dy)
  if (comprimento === 0) return null
  // Produto vetorial dividido pelo comprimento: a distância com sinal à reta.
  const distancia = (dx * (ponto.y - wall.y1) - dy * (ponto.x - wall.x1)) / comprimento
  if (Math.abs(distancia) < NA_LINHA_PX) return null
  return distancia > 0 ? 1 : -1
}

/**
 * Alguma destas fichas ALCANÇA a porta (`tokenReachesDoor`) e está do `lado`
 * dado? É o critério único do "do lado do ferrolho": o host decide com ele se
 * tirar/abrir vale, e o recorte põe a marca `ferrolhoDoMeuLado` com ele. Ficha
 * do lado certo mas longe da porta não conta — senão a tela oferecia "tirar"
 * que o host recusaria.
 */
export function fichaDoLadoAlcanca(fichas: readonly Pick<Token, 'x' | 'y' | 'size'>[], wall: Wall, lado: LadoDaPorta, grid: number): boolean {
  return fichas.some((ficha) => tokenReachesDoor(ficha, wall, grid) && ladoDaPorta(wall, ficha) === lado)
}

/**
 * A ficha alcança o pino: o centro dele até `DOOR_REACH_CELLS` casa além da
 * borda da ficha — o mesmo "encostado" da porta, para o botão da tela e a
 * checagem do host baterem.
 */
export function tokenAlcancaPino(token: Pick<Token, 'x' | 'y' | 'size'>, pin: Pick<Pin, 'x' | 'y'>, grid: number): boolean {
  return Math.hypot(pin.x - token.x, pin.y - token.y) <= tokenRadiusOf(token, grid) + grid * DOOR_REACH_CELLS
}

/** O que o botão do ferrolho oferece na tela do jogador, e para qual porta. */
export interface AcaoDeFerrolho {
  wallId: string
  /** `passar`: correr o ferrolho (o host fecha a porta se ela estiver aberta); `tirar`: o ferrolho é do lado dele. */
  acao: 'passar' | 'tirar'
  aberta: boolean
}

/**
 * A porta que o jogador alcança agora, a mais perto de uma ficha dele, e o
 * que dá para fazer com o ferrolho dela. Porta trancada pelo mestre não
 * entra: o ferrolho não mexe nela. `map` é o RECORTE do jogador — a marca
 * `ferrolhoDoMeuLado` só chega a quem está do lado de quem trancou.
 */
export function acaoDeFerrolho(map: MapData, ownTokenIds: readonly string[]): AcaoDeFerrolho | null {
  const owned = new Set(ownTokenIds)
  const fichas = map.tokens.filter((t) => owned.has(t.id))
  let melhor: { wall: Wall; distancia: number } | null = null
  for (const wall of map.walls) {
    if (wall.door === null || wall.door.locked) continue
    for (const ficha of fichas) {
      if (!tokenReachesDoor(ficha, wall, map.grid)) continue
      const distancia = distanceToWall(ficha, wall)
      if (melhor === null || distancia < melhor.distancia) melhor = { wall, distancia }
    }
  }
  if (melhor === null || melhor.wall.door === null) return null
  const door = melhor.wall.door
  return { wallId: melhor.wall.id, acao: door.ferrolhoDoMeuLado === true ? 'tirar' : 'passar', aberta: door.open }
}
