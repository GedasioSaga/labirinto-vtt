/**
 * CONTAS — a porta da sala: nome + PIN certo entra; nome errado e PIN errado
 * dão a MESMA recusa; os freios (por nome, com bloqueio que dobra, e o teto
 * da sala por minuto); o aparelho lembrado entra sozinho, e o esquecido não.
 */
import { describe, expect, it } from 'vitest'
import { guardarPin, semAparelho, serializarContas, type ArquivoDeContas } from '../lib/contasDosJogadores'
import { BLOQUEIO_INICIAL_MS, criarPortaDasContas, FALHAS_ANTES_DO_BLOQUEIO, JANELA_DOS_PINS_MS, PINS_POR_JANELA } from './entradaComConta'

const PIN = '2468'

async function salaComAna(soComConta = false) {
  let arquivo: ArquivoDeContas = { soComConta, contas: [{ id: 'conta_ana', nome: 'Ana', pin: await guardarPin(PIN), aparelhos: [], criada: 1 }] }
  let agora = 1_000_000
  const porta = criarPortaDasContas({
    prontas: async () => undefined,
    ler: () => arquivo,
    alterar: async (mudar) => {
      arquivo = mudar(arquivo)
    },
    now: () => agora,
  })
  return {
    porta,
    arquivo: () => arquivo,
    mudar: (mudar: (atual: ArquivoDeContas) => ArquivoDeContas) => {
      arquivo = mudar(arquivo)
    },
    passar: (ms: number) => {
      agora += ms
    },
  }
}

describe('porta das contas: nome + PIN', () => {
  it('o PIN certo entra; a sala só fica sabendo o id e o nome da conta', async () => {
    const { porta } = await salaComAna()
    await expect(porta.entrarComPin('ana', PIN)).resolves.toEqual({ ok: true, conta: { id: 'conta_ana', nome: 'Ana' } })
  })

  it('PIN errado e nome que não tem conta dão exatamente a mesma recusa', async () => {
    const { porta } = await salaComAna()
    const pinErrado = await porta.entrarComPin('Ana', '1111')
    const nomeErrado = await porta.entrarComPin('Zeca', PIN)
    expect(pinErrado).toEqual({ ok: false, motivo: 'invalid' })
    expect(nomeErrado).toEqual(pinErrado)
  })

  it(`${FALHAS_ANTES_DO_BLOQUEIO} erros seguidos bloqueiam o nome (nem o PIN certo entra); o bloqueio passa e o seguinte dobra`, async () => {
    const { porta, passar } = await salaComAna()
    for (let i = 0; i < FALHAS_ANTES_DO_BLOQUEIO; i += 1) await porta.entrarComPin('Ana', '0000')
    await expect(porta.entrarComPin('Ana', PIN)).resolves.toEqual({ ok: false, motivo: 'locked', esperarS: BLOQUEIO_INICIAL_MS / 1000 })
    // Outro nome não é freado pelo da Ana.
    await expect(porta.entrarComPin('Bia', '0000')).resolves.toEqual({ ok: false, motivo: 'invalid' })
    passar(BLOQUEIO_INICIAL_MS + 1)
    await expect(porta.entrarComPin('Ana', '0000')).resolves.toEqual({ ok: false, motivo: 'invalid' })
    await expect(porta.entrarComPin('Ana', PIN)).resolves.toEqual({ ok: false, motivo: 'locked', esperarS: (2 * BLOQUEIO_INICIAL_MS) / 1000 })
    passar(2 * BLOQUEIO_INICIAL_MS + 1)
    // Acertou: os erros de antes somem.
    await expect(porta.entrarComPin('Ana', PIN)).resolves.toMatchObject({ ok: true })
    await expect(porta.entrarComPin('Ana', '0000')).resolves.toEqual({ ok: false, motivo: 'invalid' })
  })

  it('o nome sem conta bloqueia do mesmo jeito: o bloqueio não conta quais nomes existem', async () => {
    const { porta } = await salaComAna()
    for (let i = 0; i < FALHAS_ANTES_DO_BLOQUEIO; i += 1) await porta.entrarComPin('Zeca', '0000')
    await expect(porta.entrarComPin('Zeca', '0000')).resolves.toEqual({ ok: false, motivo: 'locked', esperarS: BLOQUEIO_INICIAL_MS / 1000 })
  })

  it('duas conferências do mesmo nome ao mesmo tempo: a segunda espera (bloqueada), sem gastar PBKDF2', async () => {
    const { porta } = await salaComAna()
    const [primeira, segunda] = await Promise.all([porta.entrarComPin('Ana', PIN), porta.entrarComPin('ana', PIN)])
    expect(primeira).toMatchObject({ ok: true })
    expect(segunda).toEqual({ ok: false, motivo: 'locked', esperarS: 1 })
  })

  it(`a sala confere no máximo ${PINS_POR_JANELA} PINs por minuto, de todo mundo junto`, async () => {
    const { porta, passar } = await salaComAna()
    for (let i = 0; i < PINS_POR_JANELA; i += 1) await porta.entrarComPin(`Jogador ${i}`, '0000')
    await expect(porta.entrarComPin('Ana', PIN)).resolves.toEqual({ ok: false, motivo: 'locked', esperarS: JANELA_DOS_PINS_MS / 1000 })
    passar(JANELA_DOS_PINS_MS)
    await expect(porta.entrarComPin('Ana', PIN)).resolves.toMatchObject({ ok: true })
  }, 20_000)

  it('conta apagada (ou PIN trocado) no meio da conferência não entra', async () => {
    const { porta, mudar } = await salaComAna()
    const tentativa = porta.entrarComPin('Ana', PIN)
    mudar((arquivo) => ({ ...arquivo, contas: [] }))
    await expect(tentativa).resolves.toEqual({ ok: false, motivo: 'invalid' })
  })
})

describe('porta das contas: o aparelho lembrado', () => {
  it('lembrar dá o segredo UMA vez e guarda só o hash; com ele o aparelho entra e o "visto em" anda', async () => {
    const { porta, arquivo, passar } = await salaComAna()
    const token = await porta.lembrarAparelho('conta_ana', 'Chrome no Android')
    expect(token).not.toBeNull()
    if (token === null) return
    expect(serializarContas(arquivo())).not.toContain(token)
    const [aparelho] = arquivo().contas[0].aparelhos
    expect(aparelho).toMatchObject({ rotulo: 'Chrome no Android', vistoEm: 1_000_000 })
    passar(5000)
    await expect(porta.entrarComAparelho(token)).resolves.toEqual({ ok: true, conta: { id: 'conta_ana', nome: 'Ana' } })
    expect(arquivo().contas[0].aparelhos[0].vistoEm).toBe(1_005_000)
  })

  it('o aparelho esquecido pelo mestre (ou um segredo inventado) é recusado como "device"', async () => {
    const { porta, arquivo, mudar } = await salaComAna()
    const token = await porta.lembrarAparelho('conta_ana', '')
    if (token === null) throw new Error('não lembrou o aparelho')
    expect(arquivo().contas[0].aparelhos[0].rotulo).toBe('Aparelho')
    mudar((atual) => semAparelho(atual, 'conta_ana', atual.contas[0].aparelhos[0].id))
    await expect(porta.entrarComAparelho(token)).resolves.toEqual({ ok: false, motivo: 'device' })
    await expect(porta.entrarComAparelho('x'.repeat(43))).resolves.toEqual({ ok: false, motivo: 'device' })
    await expect(porta.entrarComAparelho('curto')).resolves.toEqual({ ok: false, motivo: 'device' })
  })

  it('conta que não existe não ganha aparelho', async () => {
    const { porta } = await salaComAna()
    await expect(porta.lembrarAparelho('conta_fantasma', 'Firefox no Windows')).resolves.toBeNull()
  })

  it('a sala lê o "Só com conta" e os nomes, nada além', async () => {
    const { porta } = await salaComAna(true)
    expect(porta.naSala()).toEqual({ soComConta: true, nomes: ['Ana'] })
  })
})
