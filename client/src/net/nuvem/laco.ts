import type { ResultadoDoCiclo } from './sincronizador'

/**
 * O RITMO DO SINCRONIZADOR (docs/planos/lobby-jogadores-2026-11-05.md §5.5 e
 * §7): a duração do DO é o recurso mais apertado do plano grátis, então o app
 * só consulta a cada 5 s com a campanha aberta no editor E a janela visível;
 * fora disso, ao focar a janela ou a cada 10 min. Sem rede: espera crescente
 * 2, 5, 10, 30, 60 s. Mudança do mestre: manda em ~1 s (o lote de ~1 s da §7).
 *
 * Versão diferente, campanha que não existe mais e falta do token PARAM o
 * laço: repetir não adianta. `retomar` volta (o token colado, o app atualizado).
 */

export const ESPERA_COM_A_CAMPANHA_ABERTA_MS = 5_000
export const ESPERA_COM_A_CAMPANHA_FECHADA_MS = 10 * 60_000
export const ESPERA_DEPOIS_DA_MUDANCA_MS = 1_000
export const ESPERAS_SEM_REDE_MS: readonly number[] = [2_000, 5_000, 10_000, 30_000, 60_000]

export interface ContextoDoLaco {
  janelaVisivel(): boolean
  /** A pasta desta campanha está aberta no editor. */
  campanhaAberta(): boolean
}

export type Agendar = (fazer: () => void, ms: number) => () => void

export interface Laco {
  /** Roda já e segue no ritmo. */
  iniciar(): void
  /** Antecipa o próximo ciclo para daqui a `ms` (ao focar a janela: 0; mudança local: ~1 s). Laço parado não volta. */
  cutucar(ms: number): void
  /** Volta a rodar depois de uma parada (token colado, app atualizado). */
  retomar(): void
  parar(): void
  /** `true` = parado por versão, campanha inexistente ou falta do token. */
  parado(): boolean
}

/** Quanto esperar depois de um ciclo. `null` = parar até `retomar`. */
export function proximaEspera(resultado: ResultadoDoCiclo, falhasSeguidas: number, contexto: ContextoDoLaco): number | null {
  switch (resultado.t) {
    case 'versao':
    case 'nao-existe':
    case 'sem-credencial':
      return null
    case 'sem-rede':
    case 'erro':
      return ESPERAS_SEM_REDE_MS[Math.min(Math.max(falhasSeguidas, 1), ESPERAS_SEM_REDE_MS.length) - 1]
    case 'ok':
      if (resultado.faltaEnviar) return ESPERA_DEPOIS_DA_MUDANCA_MS
      return contexto.janelaVisivel() && contexto.campanhaAberta() ? ESPERA_COM_A_CAMPANHA_ABERTA_MS : ESPERA_COM_A_CAMPANHA_FECHADA_MS
  }
}

export function criarLaco(ciclo: () => Promise<ResultadoDoCiclo>, contexto: ContextoDoLaco, agendar: Agendar, agora: () => number): Laco {
  let cancelar: (() => void) | null = null
  /** Quando o ciclo agendado vai rodar; `null` = nada agendado. */
  let marcadoPara: number | null = null
  let rodando = false
  let cutucadoDuranteOCiclo = false
  let falhasSeguidas = 0
  let estaParado = false
  let desligado = true

  function agendarEm(ms: number): void {
    cancelar?.()
    marcadoPara = agora() + ms
    cancelar = agendar(() => {
      cancelar = null
      marcadoPara = null
      void rodar()
    }, ms)
  }

  async function rodar(): Promise<void> {
    if (desligado || estaParado || rodando) return
    rodando = true
    cutucadoDuranteOCiclo = false
    let resultado: ResultadoDoCiclo
    try {
      resultado = await ciclo()
    } catch (erro) {
      resultado = { t: 'erro', detalhe: erro instanceof Error ? erro.message : String(erro) }
    }
    rodando = false
    if (desligado) return
    falhasSeguidas = resultado.t === 'sem-rede' || resultado.t === 'erro' ? falhasSeguidas + 1 : 0
    const espera = proximaEspera(resultado, falhasSeguidas, contexto)
    if (espera === null) {
      estaParado = true
      return
    }
    // Mudança que chegou durante o ciclo vai logo (com rede); sem rede, a espera crescente manda.
    agendarEm(cutucadoDuranteOCiclo && falhasSeguidas === 0 ? Math.min(espera, ESPERA_DEPOIS_DA_MUDANCA_MS) : espera)
  }

  return {
    iniciar() {
      desligado = false
      estaParado = false
      agendarEm(0)
    },
    cutucar(ms) {
      if (desligado || estaParado) return
      if (rodando) {
        cutucadoDuranteOCiclo = true
        return
      }
      // Sem rede, cutucar não fura a espera crescente (senão cada tecla seria um pedido).
      if (falhasSeguidas > 0) return
      if (marcadoPara === null || agora() + ms < marcadoPara) agendarEm(ms)
    },
    retomar() {
      if (desligado) return
      estaParado = false
      falhasSeguidas = 0
      if (!rodando) agendarEm(0)
    },
    parar() {
      desligado = true
      cancelar?.()
      cancelar = null
      marcadoPara = null
    },
    parado: () => estaParado,
  }
}
