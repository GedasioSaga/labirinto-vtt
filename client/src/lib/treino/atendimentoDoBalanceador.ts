import { LUTAS_POR_TESTE, BOTOES_DO_AJUSTE, type BotaoDoAjuste, type MetaDoAchar } from './balanceadorComum'
import { acharNumeros, rodarBalanco } from './balanceador'
import { pedidoDoFio, type Relogio } from './atendimentoDasLutas'
import { ehRegistro } from './protocoloDasLutas'
import type { RespostaDoBalanceador } from './protocoloDoBalanceador'

/**
 * O LADO DO WORKER DO BALANCEADOR: relê o pedido (os lutadores e o sistema
 * pelas leituras das 100 lutas, `pedidoDoFio`), roda o "Testar" ou o "Achar
 * os números" e responde com o progresso (no máximo a cada 40 ms) e o
 * resultado. Pedido torto vira resposta de erro, nunca exceção solta.
 */

/** O progresso sai no máximo a cada tantos ms: 500 lutas não mandam 500 mensagens. */
const INTERVALO_DO_PROGRESSO_MS = 40
const TURNOS_DA_META: [number, number] = [1, 30]
const VITORIA_DA_META: [number, number] = [0.05, 0.95]

function serieDoFio(valor: unknown) {
  const lido = pedidoDoFio({ tipo: 'serie', pedido: valor })
  return lido === null || lido.tipo !== 'serie' ? null : lido.pedido
}

function numeroNaFaixa(valor: unknown, [minimo, maximo]: [number, number]): number | null | undefined {
  if (valor === null) return null
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= minimo && valor <= maximo ? valor : undefined
}

function metaDoFio(valor: unknown): MetaDoAchar | null {
  if (!ehRegistro(valor)) return null
  const turnos = numeroNaFaixa(valor.turnos, TURNOS_DA_META)
  const vitoria = numeroNaFaixa(valor.vitoria, VITORIA_DA_META)
  if (turnos === undefined || vitoria === undefined || (turnos === null && vitoria === null)) return null
  return { turnos, vitoria }
}

function botoesDoFio(valor: unknown): Record<BotaoDoAjuste, boolean> | null {
  if (!ehRegistro(valor)) return null
  const botoes: Record<BotaoDoAjuste, boolean> = { hp: false, escudo: false, dano: false, atributos: false }
  for (const botao of BOTOES_DO_AJUSTE) {
    const ligado = valor[botao]
    if (typeof ligado !== 'boolean') return null
    botoes[botao] = ligado
  }
  return botoes
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Atende UM pedido do balanceador. */
export function atenderBalanceador(valor: unknown, enviar: (resposta: RespostaDoBalanceador) => void, agora: Relogio): void {
  const serie = ehRegistro(valor) ? serieDoFio(valor.serie) : null
  if (!ehRegistro(valor) || serie === null) {
    enviar({ tipo: 'erro', motivo: 'pedido do balanceador com forma inválida' })
    return
  }
  const inicio = agora()
  let ultimo = -Infinity
  const aviso = (feitas: number, total: number, fase: string): void => {
    const instante = agora()
    if (instante - ultimo < INTERVALO_DO_PROGRESSO_MS) return
    ultimo = instante
    enviar({ tipo: 'progresso', feitas, total, fase })
  }
  try {
    if (valor.tipo === 'balanco') {
      const n = LUTAS_POR_TESTE.find((quantas) => quantas === valor.n)
      if (n === undefined) throw new RangeError(`lutas por teste inválidas: ${String(valor.n)}`)
      const balanco = rodarBalanco({ sistema: serie.sistema, lutadores: serie.lutadores, semente: serie.semente, n }, aviso)
      enviar({ tipo: 'balanco', balanco, ms: agora() - inicio })
      return
    }
    if (valor.tipo === 'achar') {
      const meta = metaDoFio(valor.meta)
      const botoes = botoesDoFio(valor.botoes)
      const alvos = Array.isArray(valor.alvos) ? valor.alvos.filter((alvo): alvo is string => typeof alvo === 'string') : []
      if (meta === null || botoes === null || alvos.length === 0) throw new RangeError('meta, botões ou alvo do "Achar os números" inválidos')
      const proposta = acharNumeros({ sistema: serie.sistema, lutadores: serie.lutadores, semente: serie.semente, alvos, meta, botoes }, aviso)
      enviar({ tipo: 'achar', proposta, ms: agora() - inicio })
      return
    }
    enviar({ tipo: 'erro', motivo: 'pedido do balanceador com forma inválida' })
  } catch (erro) {
    enviar({ tipo: 'erro', motivo: textoDoErro(erro) })
  }
}
