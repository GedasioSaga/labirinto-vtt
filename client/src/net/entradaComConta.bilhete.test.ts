// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { ArquivoDeContas, ContaDeJogador, PinGuardado } from '../lib/contasDosJogadores'
import { assinarBilhete, FOLGA_DO_RELOGIO_MS, novaChaveDaSala, VALIDADE_DO_BILHETE_MS, type RegrasDoBilhete } from '../lib/nuvem/bilhete'
import { criarPortaDasContas } from './entradaComConta'

/**
 * ENTRAR PELO LOBBY ("Entrar na mesa agora", 06/11/2026): a terceira
 * credencial da porta das contas. O bilhete que o Lobby assinou com a chave
 * da sala aberta liga a conta do app, uma vez e dentro do prazo. Ambiente
 * `node` (WebCrypto sem DOM), como o `bilhete.test.ts`. Contas inventadas (One Piece).
 */

const SALA = 'K7M2QX'
/** Relógio do Lobby quando assinou; o host confere com o dele já corrigido (`regras.agoraMs`). */
const ASSINADO_EM = 1_762_430_400_000
/** A conta não tem PIN em jogo aqui: o bilhete nunca o confere. */
const PIN_QUALQUER: PinGuardado = { algoritmo: 'PBKDF2-SHA256', iteracoes: 600_000, sal: 'AAAAAAAAAAAAAAAAAAAAAA==', hash: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' }

function conta(id: string, nome: string): ContaDeJogador {
  return { id, nome, pin: PIN_QUALQUER, aparelhos: [], criada: 1 }
}

function portaCom(arquivo: ArquivoDeContas) {
  return criarPortaDasContas({
    prontas: async () => undefined,
    ler: () => arquivo,
    alterar: async () => {
      throw new Error('o bilhete não grava nada em contas.json')
    },
  })
}

describe('porta das contas: bilhete do Lobby', () => {
  it('o bilhete aceito liga a conta do app, com o nome do app (não o do bilhete)', async () => {
    const chave = novaChaveDaSala()
    const porta = portaCom({ soComConta: true, contas: [conta('conta_nami', 'Nami')] })
    const bilhete = await assinarBilhete(chave, { sala: SALA, contaId: 'conta_nami', nome: 'Nami do Lobby' }, ASSINADO_EM)
    const regras: RegrasDoBilhete = { chave, sala: SALA, agoraMs: ASSINADO_EM + 3_000 }
    await expect(porta.entrarComBilhete(bilhete, regras)).resolves.toEqual({ ok: true, conta: { id: 'conta_nami', nome: 'Nami' } })
  })

  it('o mesmo bilhete de novo, o vencido e o de conta que não existe são recusados (e sem sala no Lobby, unavailable)', async () => {
    const chave = novaChaveDaSala()
    const porta = portaCom({ soComConta: false, contas: [conta('conta_nami', 'Nami'), conta('conta_usopp', 'Usopp')] })
    const regras: RegrasDoBilhete = { chave, sala: SALA, agoraMs: ASSINADO_EM + 1_000 }
    const recusa = { ok: false, motivo: 'invalid' }

    const daNami = await assinarBilhete(chave, { sala: SALA, contaId: 'conta_nami', nome: 'Nami' }, ASSINADO_EM)
    await expect(porta.entrarComBilhete(daNami, regras)).resolves.toMatchObject({ ok: true })
    await expect(porta.entrarComBilhete(daNami, { ...regras, agoraMs: regras.agoraMs + 5_000 })).resolves.toEqual(recusa)

    const vencido = await assinarBilhete(chave, { sala: SALA, contaId: 'conta_usopp', nome: 'Usopp' }, ASSINADO_EM)
    const depoisDoPrazo = ASSINADO_EM + VALIDADE_DO_BILHETE_MS + FOLGA_DO_RELOGIO_MS + 1
    await expect(porta.entrarComBilhete(vencido, { ...regras, agoraMs: depoisDoPrazo })).resolves.toEqual(recusa)
    // Recusado por vencer, não por uso: dentro do prazo, o mesmo bilhete ainda entra.
    await expect(porta.entrarComBilhete(vencido, regras)).resolves.toEqual({ ok: true, conta: { id: 'conta_usopp', nome: 'Usopp' } })

    const semConta = await assinarBilhete(chave, { sala: SALA, contaId: 'conta_zoro', nome: 'Zoro' }, ASSINADO_EM)
    await expect(porta.entrarComBilhete(semConta, regras)).resolves.toEqual(recusa)

    const outro = await assinarBilhete(chave, { sala: SALA, contaId: 'conta_nami', nome: 'Nami' }, ASSINADO_EM)
    await expect(porta.entrarComBilhete(outro, null)).resolves.toEqual({ ok: false, motivo: 'unavailable' })
  })
})
