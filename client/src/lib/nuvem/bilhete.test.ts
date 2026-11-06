// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assinarBilhete, conferirBilhete, FOLGA_DO_RELOGIO_MS, lerBilheteSemConferir, NOME_DO_BILHETE_MAX, novaChaveDaSala, VALIDADE_DO_BILHETE_MS } from './bilhete'
import type { RegrasDoBilhete } from './bilhete'

/**
 * BILHETE DE ENTRADA (pedido de 06/11/2026, "Entrar na mesa agora"): o Lobby
 * assina, o host confere. Roda no ambiente `node`, sem DOM, como no Worker.
 * Contas inventadas (One Piece).
 */

const SALA = 'K7M2QX'
const AGORA = 1_762_430_400_000
const NAMI = { sala: SALA, contaId: 'conta_nami', nome: 'Nami' }
const USOPP = { sala: SALA, contaId: 'conta_usopp', nome: 'Usopp' }
const ALFABETO_BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** O `v1.<payload>.<assinatura>` em pedaços; o teste só monta bilhete torto a partir de um bom. */
function partes(bilhete: string): { payload: string; assinatura: string } {
  const [, payload, assinatura] = bilhete.split('.')
  return { payload, assinatura }
}

/** O último caractere com outro bit de sobra: o `atob` daria os mesmos 32 bytes. */
function comBitDeSobraTrocado(assinatura: string): string {
  const ultimo = ALFABETO_BASE64URL.indexOf(assinatura.slice(-1))
  return assinatura.slice(0, -1) + ALFABETO_BASE64URL[ultimo ^ 1]
}

describe('bilhete de entrada na mesa', () => {
  it('o válido confere, e a tela lê o mesmo código e nome sem a chave', async () => {
    const chave = novaChaveDaSala()
    const bilhete = await assinarBilhete(chave, { ...NAMI, nome: `  ${'N'.repeat(NOME_DO_BILHETE_MAX + 8)}  ` }, AGORA)

    const resultado = await conferirBilhete(bilhete, { chave, sala: SALA, agoraMs: AGORA })

    expect(bilhete.startsWith('v1.')).toBe(true)
    expect(resultado).toEqual({
      ok: true,
      dados: { sala: SALA, contaId: 'conta_nami', nome: 'N'.repeat(NOME_DO_BILHETE_MAX), jti: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/), validoAte: AGORA + VALIDADE_DO_BILHETE_MS },
    })
    expect(lerBilheteSemConferir(bilhete)).toEqual(resultado.ok ? resultado.dados : null)
    // Dois bilhetes da mesma conta não repetem o jti: o host recusa o segundo uso pelo jti.
    expect(partes(await assinarBilhete(chave, NAMI, AGORA)).payload).not.toBe(partes(bilhete).payload)
    await expect(assinarBilhete(chave, { ...NAMI, nome: '   ' }, AGORA)).rejects.toThrow(TypeError)
  })

  it('adulterado, vencido, de outra sala e de outra chave são recusados', async () => {
    const chave = novaChaveDaSala()
    const regras: RegrasDoBilhete = { chave, sala: SALA, agoraMs: AGORA }
    const daNami = await assinarBilhete(chave, NAMI, AGORA)
    const doUsopp = await assinarBilhete(chave, USOPP, AGORA)
    const limite = AGORA + VALIDADE_DO_BILHETE_MS + FOLGA_DO_RELOGIO_MS

    const casos: readonly { caso: string; bilhete: string; regras: RegrasDoBilhete; esperado: string }[] = [
      { caso: 'no limite da folga do relógio', bilhete: daNami, regras: { ...regras, agoraMs: limite }, esperado: 'ok' },
      { caso: 'adulterado: payload do Usopp com a assinatura da Nami', bilhete: `v1.${partes(doUsopp).payload}.${partes(daNami).assinatura}`, regras, esperado: 'assinatura' },
      { caso: 'assinatura com bit de sobra trocado', bilhete: `v1.${partes(daNami).payload}.${comBitDeSobraTrocado(partes(daNami).assinatura)}`, regras, esperado: 'formato' },
      { caso: 'vencido', bilhete: daNami, regras: { ...regras, agoraMs: limite + 1 }, esperado: 'vencido' },
      { caso: 'do futuro, além da folga', bilhete: await assinarBilhete(chave, NAMI, AGORA + FOLGA_DO_RELOGIO_MS + 1), regras, esperado: 'vencido' },
      { caso: 'outra sala', bilhete: daNami, regras: { ...regras, sala: 'ZZ9P4R' }, esperado: 'outra-sala' },
      { caso: 'outra chave (outra abertura da sala)', bilhete: daNami, regras: { ...regras, chave: novaChaveDaSala() }, esperado: 'assinatura' },
      { caso: 'vazio', bilhete: '', regras, esperado: 'formato' },
    ]

    const obtidos = await Promise.all(
      casos.map(async ({ caso, bilhete, regras: dele }) => {
        const resultado = await conferirBilhete(bilhete, dele)
        return { caso, esperado: resultado.ok ? 'ok' : resultado.motivo }
      }),
    )

    expect(obtidos).toEqual(casos.map(({ caso, esperado }) => ({ caso, esperado })))
    expect(lerBilheteSemConferir('')).toBeNull()
    // Relógio sem número (o `agora` do Lobby não veio): com NaN nenhum bilhete venceria; é erro de programa, não "ok".
    await expect(conferirBilhete(daNami, { ...regras, agoraMs: Number.NaN })).rejects.toThrow(TypeError)
  })
})
