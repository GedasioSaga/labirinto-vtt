import type { HostWorld } from '../net/hostSession'
import type { MapData, Token } from '../types/map'
import { carriedBy } from './carry'
import { passengersOf } from './vehicle'

/**
 * CONGELAR FICHA — a parte pura. O mestre congela a ficha de um jogador
 * (`Token.congelado`): o servidor da sala recusa todo pedido de JOGADOR que a
 * moveria, e o mestre continua movendo. Sem store, sem rede: quem aplica é o
 * editor (`stores/adventureStore.ts`) e quem recusa é a sessão
 * (`net/hostSession.ts`); a trava do passo mora em `travaDaFichaDoJogador`
 * (`lib/moveValidation.ts`), que não importa daqui (este arquivo puxa
 * `carry.ts`, que puxa a validação do passo).
 */

/** O que o jogador lê: no aviso fixo da tela, na recusa do passo e no cartão do pino. */
export const TEXTO_CONGELADO = 'Congelado pelo mestre'

/** A ficha está congelada? Só `true` conta: o mapa do disco chega cru. */
export function estaCongelada(token: { readonly congelado?: unknown }): boolean {
  return token.congelado === true
}

/** A ficha congelada (`true`) ou solta, SEM o campo — mapa salvo antes da feature abre igual. */
function comCongelado(token: Token, congelado: boolean): Token {
  if (congelado) return token.congelado === true ? token : { ...token, congelado: true }
  if (!('congelado' in token)) return token
  const { congelado: _antes, ...solta } = token
  return solta
}

/**
 * Liga (`true`) ou desliga `congelado` nas fichas `ids`. Nada a mudar devolve o
 * MESMO mapa (o editor redesenha pela referência, e o desfazer não ganha
 * passo vazio). Pura e reaplicável: serve de mudança de MESA (`applyPlayerChange`).
 */
export function congelarNoMapa(map: MapData, ids: ReadonlySet<string>, congelado: boolean): MapData {
  let mudou = false
  const tokens = map.tokens.map((token) => {
    if (!ids.has(token.id)) return token
    const nova = comCongelado(token, congelado)
    if (nova !== token) mudou = true
    return nova
  })
  return mudou ? { ...map, tokens } : map
}

/** "Descongelar todos": nenhuma ficha do mapa congelada, de quem quer que seja. */
export function descongelarTudoNoMapa(map: MapData): MapData {
  return congelarNoMapa(map, new Set(map.tokens.filter((token) => 'congelado' in token).map((token) => token.id)), false)
}

/**
 * A primeira ficha congelada que andaria PRESA às fichas `ids` — a bordo de
 * uma delas (veículo) ou levada por elas ou por quem vai a bordo, a mesma
 * conta de `setTokenPosition` (`lib/mapFactory.ts`). As próprias `ids` não
 * contam: cada uma passa pela trava dela. `null` = ninguém congelado preso.
 */
export function congeladaPresaA(map: MapData, ids: Iterable<string>): Token | null {
  const grupo = new Set(ids)
  const aBordo = [...grupo].flatMap((id) => passengersOf(map, id))
  const levadas = [...grupo, ...aBordo.map((token) => token.id)].flatMap((id) => carriedBy(map, id))
  return [...aBordo, ...levadas].find((token) => !grupo.has(token.id) && estaCongelada(token)) ?? null
}

/**
 * O mapa sem as fichas congeladas: a conta de quem só ACOMPANHA a passagem do
 * jogador (séquito, ajudante emprestado) — congelada, fica. Nenhuma
 * congelada: o mesmo mapa.
 */
export function semAsCongeladas(map: MapData): MapData {
  return map.tokens.some(estaCongelada) ? { ...map, tokens: map.tokens.filter((token) => !estaCongelada(token)) } : map
}

/**
 * O que os botões do Grupo oferecem. `todas`: toda ficha de jogador em cena
 * carregada já está congelada (sem ficha nenhuma em cena, não há o que
 * congelar: `false`). `alguma`: há ficha congelada em cena carregada, de
 * jogador ou não — a de quem saiu da sala também precisa de "Descongelar todos".
 */
export function congelamentoDaMesa(fichasDeJogador: readonly string[], world: HostWorld): { todas: boolean; alguma: boolean } {
  const fichas = [world.open, ...world.background].flatMap((scene) => scene.map.tokens)
  const deJogador = new Set(fichasDeJogador)
  const emCena = fichas.filter((token) => deJogador.has(token.id))
  return { todas: emCena.length > 0 && emCena.every(estaCongelada), alguma: fichas.some(estaCongelada) }
}
