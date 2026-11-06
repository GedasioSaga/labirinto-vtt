import { emailDaContaLimpo, type ArquivoDeContas, type ContaDeJogador } from '../../lib/contasDosJogadores'
import { useContasStore } from '../../stores/contasStore'
import { reenviarMembros, type EnvioDosMembros } from './ponteDoLobby'

/**
 * O E-MAIL GOOGLE DA CONTA (docs/planos/lobby-jogadores-2026-11-05.md §4.3,
 * fatia A6): quem entra no site com aquele Google vê as fichas daquela conta.
 * Fica no `contas.json` do mestre; depois de gravado, a lista de jogadores vai
 * de novo a toda campanha publicada (§5.4). Usado pela aba "Jogadores do
 * Lobby" e por "Contas dos jogadores".
 */

/** A conta com o e-mail novo (`null` = sem e-mail: não entra no site). */
function comEmail(arquivo: ArquivoDeContas, contaId: string, email: string | null): ArquivoDeContas {
  return {
    ...arquivo,
    contas: arquivo.contas.map((conta): ContaDeJogador => {
      if (conta.id !== contaId) return conta
      if (email !== null) return { ...conta, email }
      const semEmail = { ...conta }
      delete semEmail.email
      return semEmail
    }),
  }
}

/** O problema do e-mail digitado, em linguagem comum; `null` = pode gravar. */
export function problemaDoEmail(contas: readonly ContaDeJogador[], contaId: string | null, bruto: string): string | null {
  if (bruto.trim() === '') return 'Escreva o e-mail Google do jogador.'
  const email = emailDaContaLimpo(bruto)
  if (email === null) return 'Falta um pedaço do e-mail. Exemplo: nome@gmail.com'
  const dono = contas.find((conta) => conta.id !== contaId && conta.email === email)
  return dono === undefined ? null : `Esse e-mail já é de ${dono.nome}. Cada e-mail vale para um jogador só.`
}

/**
 * Grava (ou tira) o e-mail da conta e reenvia a lista de jogadores. Lança com
 * a frase pronta se o e-mail não serve ou o disco recusou; a falha do reenvio
 * (rede, token) volta em `falha`, com o e-mail já gravado no app.
 */
export async function trocarEmailDaConta(contaId: string, bruto: string | null): Promise<EnvioDosMembros> {
  const loja = useContasStore.getState()
  let email: string | null = null
  if (bruto !== null && bruto.trim() !== '') {
    const problema = problemaDoEmail(loja.arquivo.contas, contaId, bruto)
    if (problema !== null) throw new Error(problema)
    email = emailDaContaLimpo(bruto)
  }
  await loja.alterar((arquivo) => comEmail(arquivo, contaId, email))
  return reenviarMembros(useContasStore.getState().arquivo.contas)
}

/** Depois de apagar ou criar conta: a lista de jogadores vai de novo ao servidor. */
export function reenviarContasAtuais(): Promise<EnvioDosMembros> {
  return reenviarMembros(useContasStore.getState().arquivo.contas)
}
