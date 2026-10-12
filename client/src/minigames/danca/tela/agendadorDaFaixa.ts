import { saidasDaFaixa, tocarEvento, type EventoDaFaixa } from '../som'

/**
 * AGENDADOR AO VIVO DA FAIXA DEMO: em vez de renderizar a música inteira
 * offline (23 s no Edge, mais no celular), agenda só os ataques dos próximos
 * `JANELA_DO_AGENDADOR_S`, a cada `PASSO_DO_AGENDADOR_MS`, no barramento que a
 * tela der. O mesmo agendador roda no conferir-som (provas-app/som), com o
 * relógio fingido: o que se mede lá é o que toca aqui.
 *
 * Pausar é suspender o contexto (o tempo dele para, a janela não anda);
 * recomeçar ou sair é desconectar o barramento, que leva junto o que já estava
 * agendado.
 */

/** Quanto à frente se agenda: folga de sobra para um quadro travado de 1 s. */
export const JANELA_DO_AGENDADOR_S = 1.5
/** De quanto em quanto tempo a tela chama `agendarAte`. */
export const PASSO_DO_AGENDADOR_MS = 250
/** Ataque que ficou para trás por mais que isso (a página travou além da janela) é pulado: tocar tudo junto seria pior. */
const TOLERANCIA_DO_ATRASO_S = 0.05

export interface AgendadorDaFaixa {
  /**
   * Agenda os ataques que começam antes de `ateS` (tempo do contexto), em
   * ordem, cada um só uma vez. `agoraS` é o tempo atual do contexto: o que
   * já passou dele é pulado. Devolve quantos agendou nesta chamada.
   */
  agendarAte(ateS: number, agoraS: number): number
  /** Ataques que ainda faltam agendar. */
  readonly restantes: number
  /** Ataques pulados por atraso desde o começo. */
  readonly pulados: number
}

/** `lista` em ordem de tempo (como `eventosDaDemo`); `t0` = tempo do contexto do começo da música. */
export function criarAgendadorDaFaixa(ctx: BaseAudioContext, destino: AudioNode, lista: readonly EventoDaFaixa[], t0: number): AgendadorDaFaixa {
  const saidaDe = saidasDaFaixa(ctx, destino)
  let proximo = 0
  let pulados = 0
  return {
    agendarAte(ateS, agoraS) {
      let agendados = 0
      while (proximo < lista.length) {
        const evento = lista[proximo]
        const quando = t0 + evento.t
        if (quando >= ateS) break
        proximo += 1
        if (quando < agoraS - TOLERANCIA_DO_ATRASO_S) {
          pulados += 1
          continue
        }
        // Um pouco atrasado (dentro da tolerância): sai agora, com o envelope inteiro.
        tocarEvento(ctx, saidaDe(evento.inst), Math.max(quando, agoraS), evento)
        agendados += 1
      }
      return agendados
    },
    get restantes() {
      return lista.length - proximo
    },
    get pulados() {
      return pulados
    },
  }
}
