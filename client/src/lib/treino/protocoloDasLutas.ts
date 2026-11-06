import type { ComparacaoDeBuild, LutaDaSerie, PedidoDaSerie, PedidoDeComparacao, ResultadoDaSerie } from './cemLutas'
import type { FimDaLuta } from './fimDaLuta'
import type { LadoDoTreino } from './mesaEmMemoria'
import { sementeValida } from './sorteio'

/**
 * O PROTOCOLO ENTRE A PÁGINA E O WORKER DAS LUTAS (LOBBY v2, fatia T4 de
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2). Um worker por pedido: a
 * página manda UM pedido, recebe o progresso e UMA resposta final (o
 * resultado ou o erro), e fecha o worker. Por isso não há id de pedido.
 *
 * Este arquivo não importa o motor da luta (só tipos): a página que lê a
 * resposta não carrega a batalha; quem carrega é o worker
 * (`atendimentoDasLutas.ts`).
 */

export type PedidoAoWorker = { tipo: 'serie'; pedido: PedidoDaSerie } | { tipo: 'comparar'; pedido: PedidoDeComparacao }

export type RespostaDoWorker =
  | { tipo: 'progresso'; feitas: number; total: number }
  /** `ms` = o tempo das lutas medido dentro do worker. */
  | { tipo: 'serie'; resultado: ResultadoDaSerie; ms: number }
  | { tipo: 'comparar'; comparacao: ComparacaoDeBuild; ms: number }
  | { tipo: 'erro'; motivo: string }

export function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function ehLado(valor: unknown): valor is LadoDoTreino {
  return valor === 'a' || valor === 'b'
}

function ehContagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehTempo(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
}

function fimDoFio(valor: unknown): FimDaLuta | null {
  if (!ehRegistro(valor)) return null
  if (valor.tipo === 'vitoria') return ehLado(valor.vencedor) ? { tipo: 'vitoria', vencedor: valor.vencedor } : null
  if (valor.tipo === 'todosCaidos') return { tipo: 'todosCaidos' }
  if (valor.tipo === 'tempo' && (valor.teto === 'rodadas' || valor.teto === 'passos')) return { tipo: 'tempo', teto: valor.teto }
  return null
}

function lutaDoFio(valor: unknown): LutaDaSerie | null {
  if (!ehRegistro(valor) || !sementeValida(valor.semente) || !ehContagem(valor.rodada)) return null
  const fim = fimDoFio(valor.fim)
  return fim === null ? null : { semente: valor.semente, fim, rodada: valor.rodada }
}

function serieDoFio(valor: unknown): ResultadoDaSerie | null {
  if (!ehRegistro(valor) || !sementeValida(valor.semente) || !ehRegistro(valor.vitorias) || !ehRegistro(valor.empates) || !Array.isArray(valor.lutas)) return null
  const { a, b } = valor.vitorias
  const { todosCaidos, tempo } = valor.empates
  if (!ehContagem(a) || !ehContagem(b) || !ehContagem(todosCaidos) || !ehContagem(tempo)) return null
  const doFio: readonly unknown[] = valor.lutas
  const lutas: LutaDaSerie[] = []
  for (const item of doFio) {
    const luta = lutaDoFio(item)
    if (luta === null) return null
    lutas.push(luta)
  }
  return { semente: valor.semente, vitorias: { a, b }, empates: { todosCaidos, tempo }, lutas }
}

function comparacaoDoFio(valor: unknown): ComparacaoDeBuild | null {
  if (!ehRegistro(valor) || !ehLado(valor.lado) || typeof valor.diferenca !== 'number' || !Number.isSafeInteger(valor.diferenca)) return null
  const atual = serieDoFio(valor.atual)
  const rascunho = serieDoFio(valor.rascunho)
  return atual === null || rascunho === null ? null : { lado: valor.lado, atual, rascunho, diferenca: valor.diferenca }
}

/** A resposta do worker relida campo a campo (o `data` da mensagem não tem tipo); forma torta = `null`. */
export function respostaDoFio(valor: unknown): RespostaDoWorker | null {
  if (!ehRegistro(valor)) return null
  switch (valor.tipo) {
    case 'progresso':
      return ehContagem(valor.feitas) && ehContagem(valor.total) ? { tipo: 'progresso', feitas: valor.feitas, total: valor.total } : null
    case 'erro':
      return typeof valor.motivo === 'string' ? { tipo: 'erro', motivo: valor.motivo } : null
    case 'serie': {
      const resultado = serieDoFio(valor.resultado)
      return resultado !== null && ehTempo(valor.ms) ? { tipo: 'serie', resultado, ms: valor.ms } : null
    }
    case 'comparar': {
      const comparacao = comparacaoDoFio(valor.comparacao)
      return comparacao !== null && ehTempo(valor.ms) ? { tipo: 'comparar', comparacao, ms: valor.ms } : null
    }
    default:
      return null
  }
}
