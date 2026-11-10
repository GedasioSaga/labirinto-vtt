/**
 * VIGIA DA CARGA do Fogo na Floresta: decide quando o "Carregando o jogo…"
 * virou erro. O prazo conta o tempo PARADO, não o total: enquanto o jogo avisa
 * que chegaram bytes novos (`carga`, da casca do export web), a tela espera,
 * por mais lenta que a rede seja.
 *
 * Antes era um prazo único de 90 s contado do convite. Medido em 10/11/2026
 * (Chromium, perfil novo): com 1,6 Mbps e a CPU 4 vezes mais lenta o jogo fica
 * pronto em 81 a 97 s (54 s de download e o resto o motor ligando), e com três
 * jogadores dividindo esse 1,6 Mbps, em 184 s. O prazo estourava no meio de
 * uma carga que estava andando: "demorou demais para carregar".
 *
 * Três esperas, uma de cada vez:
 *  - `sem_sinal`: o jogo ainda não avisou nada (pacote antigo, que não avisa,
 *    ou a página do jogo que nem abriu);
 *  - `parado`: já avisou, falta baixar, e nenhum byte novo chegou no prazo;
 *  - `motor`: baixou tudo e o jogo não disse `pronto`. O motor liga numa
 *    tarefa só, sem poder avisar nada no meio: na primeira vez num aparelho
 *    ele compila os shaders (20 a 30 s medidos num PC rápido, 43 s com a CPU
 *    4 vezes mais lenta), por isso o prazo dele é longo.
 *
 * Sem React e sem relógio próprio: quem monta entrega o `agendar`.
 */

export type MotivoDaCargaParada = 'sem_sinal' | 'parado' | 'motor'

/** Sem aviso nenhum: cobre o pacote antigo inteiro (download e motor) numa rede lenta. */
export const CARGA_SEM_SINAL_MAX_MS = 180_000
export const CARGA_PARADA_MAX_MS = 40_000
/** Quatro vezes o pior tempo medido do motor ligando (43 s). */
export const CARGA_DO_MOTOR_MAX_MS = 180_000

/** Bytes do motor e do jogo que já chegaram, e o total (descompactados). */
export interface ProgressoDaCarga {
  atual: number
  total: number
}

export interface OpcoesDaVigia {
  /** `setTimeout` que devolve como cancelar (o teste troca por um relógio falso). */
  agendar(fazer: () => void, ms: number): () => void
  /**
   * Roda `fazer` depois das mensagens do jogo que JÁ estavam na fila da
   * página. Na página do jogador (mesma origem do jogo) o motor liga na
   * mesma thread e a segura por dezenas de segundos: quando ela volta, o
   * temporizador vencido e o `pronto` do jogo estão os dois esperando, e o
   * temporizador não pode passar na frente e acusar um jogo que carregou.
   */
  depoisDaFila(fazer: () => void): void
  /** A espera da vez estourou. Chamado uma vez só. */
  aoParar(motivo: MotivoDaCargaParada): void
}

export interface VigiaDaCarga {
  /** O jogo avisou quantos bytes já chegaram. */
  progresso(carga: ProgressoDaCarga): void
  /** O jogo carregou, falhou por outro motivo, ou a tela fechou: ninguém mais espera. */
  encerrar(): void
}

export function criarVigiaDaCarga(op: OpcoesDaVigia): VigiaDaCarga {
  let encerrada = false
  let maior = -1
  /** Cada espera nova (e o fim) invalida o que a anterior deixou na fila. */
  let vez = 0
  const esperar = (motivo: MotivoDaCargaParada, ms: number) => {
    const desta = (vez += 1)
    return op.agendar(() => {
      // Venceu. Antes de acusar, o que o jogo já mandou é lido: um aviso de bytes novos
      // (outra espera) ou o `pronto` (a vigia encerra) cancelam a acusação.
      op.depoisDaFila(() => {
        if (encerrada || desta !== vez) return
        encerrada = true
        op.aoParar(motivo)
      })
    }, ms)
  }
  let cancelar = esperar('sem_sinal', CARGA_SEM_SINAL_MAX_MS)

  return {
    progresso({ atual, total }) {
      // Só byte novo é sinal de vida: o mesmo número de novo não empurra o prazo.
      if (encerrada || atual <= maior) return
      maior = atual
      cancelar()
      cancelar = total > 0 && atual >= total ? esperar('motor', CARGA_DO_MOTOR_MAX_MS) : esperar('parado', CARGA_PARADA_MAX_MS)
    },
    encerrar() {
      encerrada = true
      vez += 1
      cancelar()
    },
  }
}
