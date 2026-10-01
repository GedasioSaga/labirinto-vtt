import { destravarAudioNoPrimeiroGesto } from '../lib/sons/contexto'
import type { SomId } from '../lib/sons/receitas'
import { tocarSom } from '../lib/sons/tocarSom'
import type { PlayerConnection, PlayerState } from './playerConnection'
import { anotarVistos, criarJaVistos, estaAoVivo, sonsDaMudanca } from './quandoTocarSom'

/**
 * SONS DO JOGADOR: liga a regra de quando tocar (`quandoTocarSom.ts`) à
 * conexão de UMA sessão. Instala junto com a conexão e sai junto com ela
 * (`main.tsx`): uma inscrição só por conexão, nunca duas tocando o mesmo som.
 */

/**
 * Silêncio, em ms, depois de entrar no jogo (ou voltar da queda, do lobby, do
 * "Volto já") e depois de uma passagem. O host manda a entrada numa rajada,
 * uma mensagem atrás da outra: o recorte, o caderno, o recado da cena, o
 * alarme que ainda vale. Tudo isso é história, não novidade; e a chegada a uma
 * cena já tem o som dela. O host manda a rajada num lote só (`entryOutbound`)
 * e o cliente a abre em ordem (`criarEntradaEmOrdem`): ela chega junta, e o
 * segundo e meio é folga para a rede lenta do celular. O que chegar depois
 * disso ainda passa pelo "já visto" (`JaVistos`).
 */
export const SILENCIO_DA_CHEGADA_MS = 1500

export interface OpcoesDosSonsDoJogador {
  /** Quem toca. Padrão: `tocarSom`, que respeita mudo e volume e não toca antes do primeiro gesto. */
  tocar?: (id: SomId) => unknown
  /** Onde escutar o primeiro gesto que destrava o áudio. Padrão: a janela. */
  alvoDoGesto?: EventTarget
  destravar?: (alvo: EventTarget) => () => void
  /** Relógio em ms, monotônico. */
  agora?: () => number
}

/** Conecta os sons à conexão; devolve a função que desliga tudo (inscrição e ouvintes do gesto). */
export function instalarSonsDoJogador(
  conexao: Pick<PlayerConnection, 'getState' | 'subscribe'>,
  { tocar = tocarSom, alvoDoGesto = window, destravar = destravarAudioNoPrimeiroGesto, agora = () => performance.now() }: OpcoesDosSonsDoJogador = {},
): () => void {
  const vistos = criarJaVistos()
  let anterior = conexao.getState()
  // O que já está na tela ao instalar é a base: nada disso toca.
  anotarVistos(vistos, anterior)
  let silencioAte = Number.NEGATIVE_INFINITY

  function tocarAMudanca(antes: PlayerState, depois: PlayerState): void {
    const sons = sonsDaMudanca(antes, depois, vistos)
    anotarVistos(vistos, depois, antes)
    const instante = agora()
    if (!estaAoVivo(antes) && estaAoVivo(depois)) silencioAte = instante + SILENCIO_DA_CHEGADA_MS
    if (instante < silencioAte) return
    // Com ou sem som (mudo), a chegada abre o silêncio: a rajada da cena nova vem logo atrás.
    if (sons.includes('passagem')) silencioAte = instante + SILENCIO_DA_CHEGADA_MS
    for (const id of sons) tocar(id)
  }

  const pararDeOuvir = conexao.subscribe(() => {
    const atual = conexao.getState()
    if (atual === anterior) return
    const antes = anterior
    anterior = atual
    try {
      tocarAMudanca(antes, atual)
    } catch {
      // Este ouvinte roda dentro do `setState` da conexão: um erro aqui cortaria a mensagem do
      // host no meio e deixaria a tela velha. Som é enfeite; o jogo segue sem ele.
    }
  })
  const pararDeDestravar = destravar(alvoDoGesto)
  return () => {
    pararDeOuvir()
    pararDeDestravar()
  }
}
