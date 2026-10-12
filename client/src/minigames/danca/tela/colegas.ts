import type { DancaEvento, DancaPlacarAoVivo } from '../../../net/protocoloDaDanca'
import type { DancaLoteDoColega } from '../../../player/estadoDaDanca'
import { dancar, novoDancarino, type Dancarino } from '../palco'
import type { DificuldadeDanca } from '../tipos'

/**
 * OS COLEGAS NO PALCO: os toques de cada colega chegam do mestre em lotes de
 * ~250 ms (`danca.colegas`) e viram poses aqui. Cada lote entra na fila do
 * colega e sai no tempo da música DESTE aparelho, com um atraso fixo: mostrar
 * o lote inteiro ao chegar faria o colega pular para a última pose.
 */

/** Lote (250 ms) + rede + folga: o colega dança meio segundo atrás de quem dança de verdade. */
export const ATRASO_DOS_COLEGAS_S = 0.5
/** Fila acumulada além disso (a aba ficou parada) é descartada: o colega volta ao presente de uma vez. */
const ATRASO_DESCARTADO_S = 2

export interface ColegaNaTela {
  playerId: string
  nome: string
  dif: DificuldadeDanca
  dancarino: Dancarino
  /** Toques ainda por mostrar, na ordem em que chegaram. */
  fila: DancaEvento[]
}

export interface PlateiaDosColegas {
  colegas: ColegaNaTela[]
  /** O último `seq` já posto na fila (os lotes vêm numerados por `estadoDaDanca`). */
  ultimoSeq: number
}

export function criarPlateia(participantes: readonly { playerId: string; nome: string; dificuldade?: DificuldadeDanca }[], euId: string | undefined): PlateiaDosColegas {
  return {
    colegas: participantes
      .filter((p) => p.playerId !== euId)
      .map((p) => ({ playerId: p.playerId, nome: p.nome, dif: p.dificuldade ?? 'diversao', dancarino: novoDancarino(), fila: [] })),
    ultimoSeq: 0,
  }
}

/** Põe na fila os lotes que ainda não entraram (seq maior que o último visto). Lote de quem não está na plateia cai. */
export function receberLotes(plateia: PlateiaDosColegas, lotes: readonly DancaLoteDoColega[]): void {
  for (const lote of lotes) {
    if (lote.seq <= plateia.ultimoSeq) continue
    plateia.ultimoSeq = lote.seq
    const colega = plateia.colegas.find((c) => c.playerId === lote.playerId)
    if (colega !== undefined) colega.fila.push(...lote.eventos)
  }
}

/**
 * Mostra os toques cujo tempo, com o atraso, já chegou em `st` (posição da
 * música deste aparelho). Errou no Expert tropeça; na Diversão é só um "ops".
 * Colega com a vida zerada no Expert cai e fica caído.
 */
export function avancarColegas(plateia: PlateiaDosColegas, st: number, batidaS: number, placares: Readonly<Record<string, DancaPlacarAoVivo>>): void {
  for (const colega of plateia.colegas) {
    const d = colega.dancarino
    while (colega.fila.length > 0 && colega.fila[0].t + ATRASO_DOS_COLEGAS_S <= st) {
      const evento = colega.fila[0]
      colega.fila.shift()
      // Atrasado demais e com outros na fila: pula, para não desfilar o passado em câmera rápida.
      if (evento.t + ATRASO_DESCARTADO_S < st && colega.fila.length > 0) continue
      if (evento.j === 'errou') dancar(d, evento.lane, st, batidaS, colega.dif === 'expert' ? 'tropeco' : 'ops')
      else dancar(d, evento.lane, st, batidaS)
    }
    const placar = placares[colega.playerId]
    if (colega.dif === 'expert' && placar !== undefined && placar.julgadas > 0 && placar.vida <= 0) d.caiu = true
  }
}
