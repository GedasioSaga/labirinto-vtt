/**
 * QUANDO MONTAR A MALHA DO "ANDAR ATÉ AQUI" no jogador (F4 da otimização do
 * mapa grande, 27/10/2026).
 *
 * Medido no Tasmaturi (mesa de verdade, mestre arrastando um NPC): a cada
 * pacote do mestre, uma parede presa à ficha andava junto (a parede 0 mudava
 * de x1/x2 a cada ~200 ms), a estrutura das paredes mudava e a malha do
 * jogador era refeita do zero: 19 montagens em 3 s, o Dijkstra dos marcos
 * (`andarDijkstra`) virou ~30% da CPU do jogador, sem ninguém pedir caminho.
 *
 * A malha continua a MESMA (mesmo código de montagem, mesmo caminho); muda só
 * QUANDO ela é montada:
 * - a primeira montagem, e mapa cuja malha já está pronta, não esperam;
 * - parede mudou: espera o mapa ficar `QUIETO_MS` sem mudar de novo, mas não
 *   mais que `ESPERA_MAXIMA_MS` desde a primeira mudança ainda não montada;
 * - montagem começada vai até o fim (em fatias), mesmo que chegue mapa novo;
 *   no fim, o mapa mais recente entra na mesma regra.
 * Assim um NPC andando sem parar custa no máximo uma montagem a cada
 * `ESPERA_MAXIMA_MS`, e não uma a cada pacote. Quem pede caminho no meio
 * (toque longo) monta na hora, como sempre (`caminhoConhecido`).
 */
import { caminhoConhecidoPronto, prepararCaminhoConhecido, temMalhaDoJogador, type PathMap } from './knownPath'

/** Sem mudança de parede por este tempo, a montagem começa. */
export const QUIETO_MS = 400
/** Mudança contínua: a montagem começa no máximo este tempo depois da primeira mudança pendente. */
export const ESPERA_MAXIMA_MS = 3000
/** Fatia de montagem por tarefa (a mesma de antes, em `player/main.tsx`). */
export const FATIA_DA_MALHA_MS = 8

export interface RelogioDoPreparo {
  agora: () => number
  agendar: (fazer: () => void, ms: number) => unknown
  cancelar: (alca: unknown) => void
}

export interface MontagemDoPreparo {
  /** A malha deste mapa já está pronta (só confere). */
  pronta: (map: PathMap) => boolean
  /** Já houve alguma montagem (a primeira não espera). */
  jaMontou: () => boolean
  /** Monta mais um pedaço por até `orcamentoMs`; `true` quando pronta. */
  avancar: (map: PathMap, orcamentoMs: number) => boolean
}

export interface PreparoDoCaminho {
  /** O mapa do jogador mudou (cada pacote do mestre). */
  atualizar: (map: PathMap) => void
  /** A tela saiu: nada mais roda. */
  parar: () => void
}

const RELOGIO_DO_NAVEGADOR: RelogioDoPreparo = {
  agora: () => performance.now(),
  agendar: (fazer, ms) => setTimeout(fazer, ms),
  cancelar: (alca) => clearTimeout(alca as ReturnType<typeof setTimeout>),
}

const MONTAGEM_DO_JOGADOR: MontagemDoPreparo = {
  pronta: caminhoConhecidoPronto,
  jaMontou: temMalhaDoJogador,
  avancar: prepararCaminhoConhecido,
}

export function criarPreparoDoCaminho(relogio: RelogioDoPreparo = RELOGIO_DO_NAVEGADOR, montagem: MontagemDoPreparo = MONTAGEM_DO_JOGADOR): PreparoDoCaminho {
  let pedido: PathMap | null = null
  let montando: PathMap | null = null
  /** Quando chegou a primeira mudança ainda não montada; `null` = nada pendente. */
  let pendenteDesde: number | null = null
  let alca: unknown = null
  let parado = false

  const desmarcar = () => {
    if (alca !== null) relogio.cancelar(alca)
    alca = null
  }

  const fatia = () => {
    alca = null
    if (parado || montando === null) return
    if (!montagem.avancar(montando, FATIA_DA_MALHA_MS)) {
      alca = relogio.agendar(fatia, 0)
      return
    }
    const feito = montando
    montando = null
    pendenteDesde = null
    if (pedido !== null && pedido !== feito) atualizar(pedido)
  }

  const comecar = () => {
    alca = null
    if (parado || pedido === null) return
    montando = pedido
    fatia()
  }

  function atualizar(map: PathMap): void {
    if (parado) return
    pedido = map
    // Montagem em curso vai até o fim; o mapa novo entra quando ela acabar.
    if (montando !== null) return
    if (montagem.pronta(map)) {
      desmarcar()
      pendenteDesde = null
      return
    }
    const agora = relogio.agora()
    pendenteDesde ??= agora
    const espera = montagem.jaMontou() ? Math.max(0, Math.min(QUIETO_MS, pendenteDesde + ESPERA_MAXIMA_MS - agora)) : 0
    desmarcar()
    alca = relogio.agendar(comecar, espera)
  }

  return {
    atualizar,
    parar: () => {
      parado = true
      desmarcar()
    },
  }
}
