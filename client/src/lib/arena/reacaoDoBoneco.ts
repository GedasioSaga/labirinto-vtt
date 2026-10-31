import { MODIFICADOR_DA_REACAO_MAX, type GolpeDaBatalha, type PedidoDeReacao, type SaidaDaReacao } from '../batalha/combate'
import type { VezEsperada } from '../batalha/ponte'
import { saidasPossiveis } from '../batalha/reacao'
import { cartaDaVez, type TurnosDaCena } from '../batalha/turnos'
import type { ReacaoDoBoneco } from './tipos'

/**
 * O BONECO REAGE SOZINHO (seção 4.3 do plano; decisão 1 do usuário): o
 * próximo passo automático do boneco na batalha da arena.
 *  - "parado": golpe esperando o boneco = Não reagir (toma o golpe inteiro);
 *  - "d20": rola com o modificador dele e, com o dado na mesa, escolhe a
 *    melhor defesa que o dado liberou: esquiva > metade > cheio. Nunca o
 *    contra-ataque (o boneco não age); o crítico entra quando o dado manda;
 *  - a vez dele: passa sozinha (com a vez esperada), assim os selos dele
 *    contam (Q4).
 * Reação primeiro, depois a vez. Quem chama (`stores/arenaStore.ts`) espera
 * um instante antes de cada passo, para o d20 e o número aparecerem.
 *
 * Puro: sem store.
 */

/** A melhor saída que o dado liberou, sem o contra-ataque. */
export function melhorDefesa(d20: number, total: number): SaidaDaReacao {
  return saidasPossiveis(d20, total).find((saida) => saida !== 'contra') ?? 'cheio'
}

/** O modificador no teto da reação (o que a batalha aceita). */
function modificadorValido(modificador: number): number {
  if (!Number.isFinite(modificador)) return 0
  return Math.min(MODIFICADOR_DA_REACAO_MAX, Math.max(-MODIFICADOR_DA_REACAO_MAX, Math.trunc(modificador)))
}

/** O próximo pedido de reação do boneco num golpe que espera por ele; `null` = nenhum golpe esperando o boneco. */
export function reacaoDoBoneco(golpes: readonly GolpeDaBatalha[] | undefined, bonecoTokenId: string, reage: ReacaoDoBoneco, modificador: number): PedidoDeReacao | null {
  for (const golpe of golpes ?? []) {
    const alvo = golpe.alvos.find((candidato) => candidato.tokenId === bonecoTokenId)
    if (alvo === undefined || alvo.danoFinal !== undefined || !alvo.podeReagir) continue
    if (reage === 'parado') return { tipo: 'naoReagir', golpeId: golpe.id, tokenId: bonecoTokenId }
    if (alvo.rolagem === undefined) return { tipo: 'rolar', golpeId: golpe.id, tokenId: bonecoTokenId, modificador: modificadorValido(modificador) }
    return { tipo: 'escolher', golpeId: golpe.id, tokenId: bonecoTokenId, saida: melhorDefesa(alvo.rolagem.d20, alvo.rolagem.total) }
  }
  return null
}

/** A vez é do boneco? A vez esperada para passá-la; senão `null`. */
export function vezDoBoneco(turnos: TurnosDaCena, bonecoTokenId: string): VezEsperada | null {
  const carta = cartaDaVez(turnos)
  if (carta === null || carta.tokenId !== bonecoTokenId) return null
  return { cartaId: carta.id, rodada: turnos.rodada }
}

/** O próximo passo automático do boneco: reagir ou passar a vez. */
export type PassoDoBoneco = { tipo: 'reagir'; pedido: PedidoDeReacao } | { tipo: 'passarVez'; esperado: VezEsperada }

/**
 * Reação primeiro, depois a vez; `null` = nada esperando o boneco. `caidos`
 * (`tokensCaidos`): com todo mundo além do boneco caído, a vez NÃO passa
 * sozinha — voltaria a ele, rodada após rodada, sem fim; o mestre decide.
 */
export function passoDoBoneco(turnos: TurnosDaCena, bonecoTokenId: string, reage: ReacaoDoBoneco, modificador: number, caidos: ReadonlySet<string>): PassoDoBoneco | null {
  const pedido = reacaoDoBoneco(turnos.golpes, bonecoTokenId, reage, modificador)
  if (pedido !== null) return { tipo: 'reagir', pedido }
  const esperado = vezDoBoneco(turnos, bonecoTokenId)
  if (esperado === null) return null
  const alguemJoga = turnos.cartas.some((carta) => carta.tokenId !== bonecoTokenId && !caidos.has(carta.tokenId))
  return alguemJoga ? { tipo: 'passarVez', esperado } : null
}
