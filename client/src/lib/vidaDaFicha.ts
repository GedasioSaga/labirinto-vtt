import type { Token, TokenHealth } from '../types/map'
import { maximoComposto } from './ajusteDaFicha'
import { numeroDaFicha, type Personagem } from './personagem'
import type { RecursoDoSistema, SistemaDeRpg } from './sistemaDeRpg'

/**
 * VIDA DA FICHA DO SISTEMA — a barra sob o token vem da ficha de personagem
 * ligada a ele (`Token.characterId`), e não de um número guardado no token
 * (decisão D do design consolidado, fatia 10).
 *
 * O caminho: token → personagem → o recurso do sistema que é VIDA (`tom ===
 * 'vida'`) e tem atual e máximo (`atualEMaximo`) → atual e máximo EFETIVO
 * (base + modificador + cartões ligados, a mesma conta da ficha). Sem ficha
 * ligada, personagem apagado, sistema sem recurso de vida ou máximo zerado:
 * sem barra, e sem erro.
 *
 * `Token.health`, a vida digitada no token antes da fatia 9, fica no arquivo
 * sem uso (decisão 4.4): nada aqui a lê, e ela nunca vai ao jogador.
 *
 * Quem vê (decisão 4.3): o mestre vê a barra de toda ficha ligada; o jogador,
 * a das fichas de jogador e a das que ele controla — a de NPC, não — e sempre
 * só a PROPORÇÃO, nunca os pontos (`proporcaoParaJogador`).
 *
 * Puro: nada de store nem de rede. Quem chama dá os personagens e o sistema em uso.
 */

/** Atual e máximo efetivo do recurso de vida, nos pontos da ficha. Só o mestre lê. */
export interface VidaDaFicha {
  atual: number
  maximo: number
}

/** A vida de cada token com ficha, pelo id do token. */
export type VidasDaCena = ReadonlyMap<string, VidaDaFicha>

/** O que o recorte de um jogador recebe por token (`lib/fogFilter.ts`): só a proporção. */
export interface BarraParaJogador {
  /** Em centésimos (`ESCALA_DO_JOGADOR`), no formato que a tela do jogador já lê (`Token.health`). */
  proporcao: TokenHealth
  /** A ficha ligada é de jogador: todo jogador que vê o token vê a barra. NPC só para quem o controla. */
  deJogador: boolean
}

export type BarrasParaJogador = ReadonlyMap<string, BarraParaJogador>

/** O jogador recebe a proporção nesta escala (centésimos), nunca os pontos. */
export const ESCALA_DO_JOGADOR = 100

const SEM_VIDAS: VidasDaCena = new Map()
const SEM_BARRAS: BarrasParaJogador = new Map()

const limitar = (valor: number, min: number, max: number): number => Math.min(max, Math.max(min, valor))

/** O recurso que a barra lê: o primeiro de vida com atual e máximo. `null` = o sistema não tem (sem barra). */
export function recursoDeVida(sistema: SistemaDeRpg | null): RecursoDoSistema | null {
  if (sistema === null) return null
  return sistema.recursos.find((recurso) => recurso.tom === 'vida' && recurso.atualEMaximo === true) ?? null
}

/** Atual e máximo efetivo do personagem nesse recurso; `null` com máximo abaixo de 1 (a barra não teria escala). */
export function vidaDoPersonagem(personagem: Personagem, recurso: RecursoDoSistema): VidaDaFicha | null {
  const maximo = maximoComposto(personagem, recurso.id).total
  if (!Number.isFinite(maximo) || maximo < 1) return null
  const atual = numeroDaFicha(personagem.recursos, recurso.id)
  return { atual: limitar(Number.isFinite(atual) ? atual : 0, 0, maximo), maximo }
}

type TokenComFicha = Pick<Token, 'id' | 'characterId'>

/** Cada token com ficha ligada que tem vida, com o personagem dele. Id de personagem repetido: o primeiro vence. */
function fichasComVida(
  tokens: readonly TokenComFicha[],
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
): { tokenId: string; personagem: Personagem; vida: VidaDaFicha }[] {
  const recurso = recursoDeVida(sistema)
  if (recurso === null || personagens.length === 0) return []
  const porId = new Map<string, Personagem>()
  for (const personagem of personagens) if (!porId.has(personagem.id)) porId.set(personagem.id, personagem)
  const achadas: { tokenId: string; personagem: Personagem; vida: VidaDaFicha }[] = []
  for (const token of tokens) {
    if (token.characterId === null) continue
    const personagem = porId.get(token.characterId)
    if (personagem === undefined) continue
    const vida = vidaDoPersonagem(personagem, recurso)
    if (vida !== null) achadas.push({ tokenId: token.id, personagem, vida })
  }
  return achadas
}

/** A barra de cada token da cena, como o MESTRE a vê (sempre, com os pontos). */
export function vidasDaCena(tokens: readonly TokenComFicha[], personagens: readonly Personagem[], sistema: SistemaDeRpg | null): VidasDaCena {
  const achadas = fichasComVida(tokens, personagens, sistema)
  if (achadas.length === 0) return SEM_VIDAS
  return new Map(achadas.map(({ tokenId, vida }) => [tokenId, vida]))
}

/**
 * A vida como o jogador pode recebê-la: a proporção em centésimos. 419 pontos
 * contariam que o ogro é um dragão. Vivo nunca chega como 0, ferido nunca
 * chega como cheio (o arredondamento não pode mentir o estado).
 */
export function proporcaoParaJogador(vida: VidaDaFicha): TokenHealth {
  let parte = Math.round((vida.atual / vida.maximo) * ESCALA_DO_JOGADOR)
  if (vida.atual > 0) parte = Math.max(1, parte)
  if (vida.atual < vida.maximo) parte = Math.min(ESCALA_DO_JOGADOR - 1, parte)
  return { current: limitar(parte, 0, ESCALA_DO_JOGADOR), max: ESCALA_DO_JOGADOR, shownToPlayers: true }
}

/**
 * O que o host entrega ao recorte de cada jogador: por token com vida, a
 * proporção e se a ficha é de jogador. Quem controla o token decide o resto
 * no recorte (`lib/fogFilter.ts`), que sabe de quem é cada ficha.
 */
export function barrasParaJogador(tokens: readonly TokenComFicha[], personagens: readonly Personagem[], sistema: SistemaDeRpg | null): BarrasParaJogador {
  const achadas = fichasComVida(tokens, personagens, sistema)
  if (achadas.length === 0) return SEM_BARRAS
  return new Map(achadas.map(({ tokenId, personagem, vida }) => [tokenId, { proporcao: proporcaoParaJogador(vida), deJogador: personagem.tipo === 'jogador' }]))
}

/** A barra que este jogador vê no token, ou `undefined`: ficha de jogador, ou NPC que ele controla (decisão 4.3). */
export function barraVistaPeloJogador(barra: BarraParaJogador | undefined, controla: boolean): TokenHealth | undefined {
  if (barra === undefined || (!barra.deJogador && !controla)) return undefined
  return { ...barra.proporcao }
}

/** Mesma barra na tela: mesmo atual e mesmo máximo (o mapa é refeito a cada desenho; o objeto, não). */
export function mesmaVida(a: VidaDaFicha | null, b: VidaDaFicha | null): boolean {
  if (a === null || b === null) return a === b
  return a.atual === b.atual && a.maximo === b.maximo
}
