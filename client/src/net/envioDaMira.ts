import type { MiraNoMapa } from '../stores/batalha/miraNoMapa'
import type { BatalhaMiraMessage } from './protocoloDaBatalha'

/**
 * FASE D DO ALCANCE (docs/design/habilidades/ALCANCE.md §6): a mira desta tela vai à mesa. Só sai
 * quando o que a mesa vê muda (a ação, o lado, o ponto, o centro): o mouse que corre dentro da
 * mesma casa não manda nada. E no máximo uma a cada `INTERVALO_DA_MIRA_MS` (o host tem teto de 10
 * por segundo): a última fica guardada e sai no fim do intervalo. Fechar sai na hora.
 *
 * Puro: o relógio e o agendador vêm de fora (o rascunho de prova roda sem esperar).
 */

/** Menos de 10 por segundo, com folga para o teto do host (`MIRAS_POR_JANELA`). */
export const INTERVALO_DA_MIRA_MS = 120

/** A mensagem da mira desta tela; sem mira (ou mira que não sai daqui, como a do Testar) = fechar. */
export function mensagemDaMira(mira: MiraNoMapa | null): BatalhaMiraMessage {
  if (mira === null || mira.fio === undefined) return { type: 'batalha.mira', off: true }
  const { fio } = mira
  return {
    type: 'batalha.mira',
    tokenId: mira.tokenId,
    acao: fio.acao,
    ...(mira.direcao === null ? {} : { direcao: mira.direcao }),
    ...(fio.ponto === undefined ? {} : { ponto: fio.ponto }),
    ...(fio.centroId === undefined ? {} : { centroId: fio.centroId }),
  }
}

export interface RelogioDaMira {
  agora: () => number
  agendar: (fazer: () => void, ms: number) => ReturnType<typeof setTimeout>
  cancelar: (id: ReturnType<typeof setTimeout>) => void
}

export interface EnvioDaMira {
  /** A mira desta tela mudou (ou fechou, `null`). */
  mudou: (mira: MiraNoMapa | null) => void
  /** A tela saiu da batalha: o que estiver no ar fecha. */
  parar: () => void
}

export function criarEnvioDaMira(enviar: (msg: BatalhaMiraMessage) => void, relogio: RelogioDaMira): EnvioDaMira {
  /** O JSON da última que saiu; `null` = nenhuma no ar (nunca mandou, ou a última foi o fechar). */
  let noAr: string | null = null
  let ultimoEnvio = Number.NEGATIVE_INFINITY
  let guardada: BatalhaMiraMessage | null = null
  let espera: ReturnType<typeof setTimeout> | null = null

  const cancelarEspera = (): void => {
    if (espera !== null) relogio.cancelar(espera)
    espera = null
    guardada = null
  }

  const mandar = (msg: BatalhaMiraMessage): void => {
    noAr = 'off' in msg ? null : JSON.stringify(msg)
    ultimoEnvio = relogio.agora()
    enviar(msg)
  }

  const fimDaEspera = (): void => {
    espera = null
    const msg = guardada
    guardada = null
    if (msg !== null && JSON.stringify(msg) !== noAr) mandar(msg)
  }

  const mudou = (mira: MiraNoMapa | null): void => {
    const msg = mensagemDaMira(mira)
    if ('off' in msg) {
      cancelarEspera()
      if (noAr !== null) mandar(msg)
      return
    }
    if (JSON.stringify(msg) === noAr) {
      // Voltou ao que já está no ar: a guardada (outro lado no meio do caminho) não sai mais.
      cancelarEspera()
      return
    }
    const passou = relogio.agora() - ultimoEnvio
    if (passou >= INTERVALO_DA_MIRA_MS && espera === null) {
      mandar(msg)
      return
    }
    guardada = msg
    if (espera === null) espera = relogio.agendar(fimDaEspera, Math.max(0, INTERVALO_DA_MIRA_MS - passou))
  }

  return {
    mudou,
    parar: () => mudou(null),
  }
}
