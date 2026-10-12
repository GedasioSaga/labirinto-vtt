/**
 * RELÓGIO DA DANÇA: leva o instante de um toque (ms de `performance.now`,
 * `event.timeStamp` ou `gamepad.timestamp`) para o tempo do contexto de áudio
 * em que aquele som saiu do alto-falante. É o único relógio do jogo: a rede
 * nunca julga, cada aparelho julga contra o próprio áudio.
 *
 * Um relógio por contexto, sem nada global: quem cria o contexto cria o relógio.
 */

/** O pedaço do `AudioContext` que o relógio lê; um contexto de verdade serve, e o teste monta um de mentira. */
export interface ContextoDoRelogio {
  readonly currentTime: number
  readonly outputLatency?: number
  readonly baseLatency?: number
  getOutputTimestamp?: () => AudioTimestamp
}

export interface RelogioDoAudio {
  /** Tempo de contexto do som que sai do alto-falante no instante `perfMs`. */
  ouvidoEm(perfMs: number): number
  /** Esquece o deslocamento suavizado: chame depois de retomar o contexto ou de agendar a música. */
  reiniciar(): void
}

/** Salto maior que 40 ms na estimativa é troca de verdade (retomou, trocou a saída): adota na hora. */
const SALTO_QUE_REINICIA_S = 0.04
/** Abaixo disso, a estimativa nova entra só 8% por leitura: tira o tremor sem atrasar a correção. */
const SUAVIZACAO = 0.08

export function criarRelogio(ctx: ContextoDoRelogio, agoraMs: () => number = () => performance.now()): RelogioDoAudio {
  /** Deslocamento entre o relógio de performance (s) e o tempo de contexto ouvido; null = ainda sem leitura. */
  let k: number | null = null

  function estimativa(): number {
    const ts = typeof ctx.getOutputTimestamp === 'function' ? ctx.getOutputTimestamp() : null
    const contexto = ts?.contextTime ?? 0
    const perfDoCarimbo = ts?.performanceTime ?? 0
    if (contexto > 0 && perfDoCarimbo > 0) return contexto - perfDoCarimbo / 1000
    // Sem carimbo de saída (Safari antigo, contexto parado): o que tocou agora menos a latência conhecida.
    // `||` de propósito: latência 0 é "não sei", não "sem atraso".
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0) - agoraMs() / 1000
  }

  return {
    ouvidoEm(perfMs) {
      const est = estimativa()
      if (k === null || Math.abs(est - k) > SALTO_QUE_REINICIA_S) k = est
      else k += (est - k) * SUAVIZACAO
      return perfMs / 1000 + k
    },
    reiniciar() {
      k = null
    },
  }
}

/**
 * Posição da música que ESTE jogador ouve no instante `perfMs`, já com o atraso
 * dele: `t0` é o tempo de contexto em que a música começou; `ajusteMs` positivo
 * = os toques dele chegam depois do som, então o jogo desconta.
 */
export function posicaoNaMusica(relogio: RelogioDoAudio, perfMs: number, t0: number, ajusteMs: number): number {
  return relogio.ouvidoEm(perfMs) - t0 - ajusteMs / 1000
}
