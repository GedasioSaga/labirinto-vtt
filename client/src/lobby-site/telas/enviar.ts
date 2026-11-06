import type { Mudanca } from '../../lib/nuvem/tipos'
import type { Site } from '../dados/lobbyStore'
import type { ResultadoDaEdicao } from '../dados/sessaoDaCampanha'
import { marcarEnvio } from './foco'

/**
 * Mandar mudanças da tela para a sessão da campanha (a fila da S2), com a
 * frase de cada falha. "Salvo" nunca sai daqui: quem diz é a faixa, quando o
 * servidor confirmou.
 */

export type FalhaDaEdicao = Extract<ResultadoDaEdicao, { ok: false }>

/** O que deu errado, para a linha de erro da tela. */
export function textoDaFalha(falha: FalhaDaEdicao): string {
  switch (falha.motivo) {
    case 'sem-rede':
      return 'Sem internet: mudanças novas ficam pausadas até a conexão voltar.'
    case 'sem-permissao':
      return 'Você não pode mudar esta ficha: só o dono dela e o mestre mudam.'
    case 'erro-local':
      return `Não deu para guardar a mudança neste navegador (${falha.detalhe}). Ela não foi feita: libere espaço ou feche outras abas e tente de novo.`
    case 'recusada':
      return falha.problemas.map((problema) => problema.detalhe).join(' ') || 'A mudança não foi aceita.'
  }
}

/** As mudanças, a partir da `baseRev` que a pessoa viu; `null` = não há campanha aberta. */
export async function enviarMudancas(site: Site, mudancas: readonly Mudanca[], baseRev: number): Promise<ResultadoDaEdicao> {
  const sessao = site.sessao()
  if (sessao === null) return { ok: false, motivo: 'sem-rede' }
  marcarEnvio()
  try {
    return await sessao.enviarMudancas(mudancas, baseRev)
  } catch (erro) {
    return { ok: false, motivo: 'erro-local', detalhe: erro instanceof Error ? erro.message : String(erro) }
  }
}

/** A rev confirmada de agora: a base de uma mudança feita na hora (−/+, mochila). */
export function revDeAgora(site: Site): number | null {
  return site.store.getState().campanha?.rev ?? null
}
