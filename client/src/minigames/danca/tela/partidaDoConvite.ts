import type { DancaDoJogador } from '../../../player/estadoDaDanca'
import { notasDaMusica, ritmoDaMusica } from '../coreografia'
import { DIF } from '../regras'
import { DURACAO_DEMO } from '../som'
import type { DificuldadeDanca, MusicaDaDanca } from '../tipos'
import type { ConfigDaPartida } from './motor'

/**
 * Do convite e do "começar" (estado da rede) para a partida deste aparelho.
 * Puro: a tela e os testes montam a mesma partida.
 */

/** A seta precisa de tempo para cair do topo: folga antes da primeira, igual à do protótipo. */
const FOLGA_ANTES_DA_PRIMEIRA_S = 1.2

/**
 * Quanto a música importada espera depois do instante combinado para a
 * primeira seta poder cair do topo. Igual em todo aparelho, de propósito: usa a
 * queda mais lenta e a primeira seta das DUAS coreografias, e não a da
 * dificuldade de cada um — na mesma sala, a música começa junto para todos.
 */
export function esperaDaMusica(musica: MusicaDaDanca): number {
  if (musica.tipo === 'demo') return 0
  const primeiras = [...musica.coreografias.diversao, ...musica.coreografias.expert].map((n) => n.t)
  const primeira = primeiras.length > 0 ? Math.min(...primeiras) : 0
  const queda = Math.max(DIF.diversao.tela, DIF.expert.tela)
  return Math.max(0, queda + FOLGA_ANTES_DA_PRIMEIRA_S - primeira)
}

/** A dificuldade que vale: a que o mestre confirmou no "começar", senão a do Pronto, senão a escolhida na tela. */
export function dificuldadeDaPartida(danca: DancaDoJogador, euId: string | undefined, escolhida: DificuldadeDanca): DificuldadeDanca {
  const confirmada = danca.comecar?.participantes.find((p) => p.playerId === euId)?.dificuldade
  return confirmada ?? danca.pronto ?? escolhida
}

/** A partida pronta para o motor; `null` enquanto falta o "começar" ou a música importada. */
export function configDaPartida(danca: DancaDoJogador, dif: DificuldadeDanca, buffer: AudioBuffer | null): ConfigDaPartida | null {
  const comecar = danca.comecar
  if (comecar === undefined) return null
  const musica = danca.convite.musica
  if (musica.tipo === 'arquivo' && buffer === null) return null
  return {
    dif,
    notas: notasDaMusica(musica, dif, danca.convite.pinId),
    ritmo: ritmoDaMusica(musica),
    duracaoS: musica.tipo === 'demo' ? DURACAO_DEMO : (buffer?.duration ?? musica.duracaoS),
    notaMin: danca.convite.notaMin,
    musica: musica.tipo === 'demo' || buffer === null ? { tipo: 'demo' } : { tipo: 'buffer', buffer },
    inicioMs: comecar.recebidoEm + comecar.emMs + esperaDaMusica(musica) * 1000,
    contagem: musica.tipo === 'demo' ? 'faixa' : 'antes',
  }
}
