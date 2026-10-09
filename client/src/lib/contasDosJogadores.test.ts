/**
 * CONTAS DOS JOGADORES — o que fica guardado: o PIN nunca, o hash com sal
 * próprio de cada conta; a leitura tolerante do arquivo; as regras do PIN e
 * do nome; os aparelhos lembrados com teto.
 */
import { describe, expect, it } from 'vitest'
import {
  aparelhoDoHash,
  comAparelho,
  comSoComConta,
  contasDoTexto,
  contasVazias,
  guardarPin,
  hashDoAparelho,
  iguaisEmTempoConstante,
  ITERACOES_DO_PIN,
  MAX_APARELHOS_POR_CONTA,
  novoTokenDeAparelho,
  pinConfere,
  problemaDaNovaConta,
  semConta,
  serializarContas,
  APARELHO_TOKEN_PADRAO,
  type AparelhoDaConta,
  type ArquivoDeContas,
  type ContaDeJogador,
} from './contasDosJogadores'

const PIN = '4321'

async function conta(id: string, nome: string, pin = PIN): Promise<ContaDeJogador> {
  return { id, nome, pin: await guardarPin(pin), aparelhos: [], criada: 1 }
}

function aparelho(id: string, vistoEm: number, hash = btoa('x'.repeat(32))): AparelhoDaConta {
  return { id, hash, rotulo: 'Chrome no Android', criado: 1, vistoEm }
}

describe('contas dos jogadores: o PIN guardado', () => {
  it('guarda PBKDF2-SHA256 com sal de 16 bytes e 600 mil iterações; o PIN não aparece no arquivo', async () => {
    const ana = await conta('conta_ana', 'Ana', '987654')
    expect(ana.pin.algoritmo).toBe('PBKDF2-SHA256')
    expect(ana.pin.iteracoes).toBe(ITERACOES_DO_PIN)
    expect(atob(ana.pin.sal)).toHaveLength(16)
    expect(atob(ana.pin.hash)).toHaveLength(32)
    const texto = serializarContas({ soComConta: false, contas: [ana] })
    expect(texto).not.toContain('987654')
  })

  it('o mesmo PIN em duas contas dá sal e hash diferentes', async () => {
    const [ana, bia] = await Promise.all([conta('conta_ana', 'Ana'), conta('conta_bia', 'Bia')])
    expect(ana.pin.sal).not.toBe(bia.pin.sal)
    expect(ana.pin.hash).not.toBe(bia.pin.hash)
  })

  it('confere o PIN certo e recusa o errado (e o sal mexido)', async () => {
    const ana = await conta('conta_ana', 'Ana')
    await expect(pinConfere(PIN, ana.pin)).resolves.toBe(true)
    await expect(pinConfere('1234', ana.pin)).resolves.toBe(false)
    await expect(pinConfere(PIN, { ...ana.pin, sal: '###' })).resolves.toBe(false)
  })

  it('compara em tempo constante: tamanhos diferentes são diferentes, iguais são iguais', () => {
    expect(iguaisEmTempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(iguaisEmTempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(iguaisEmTempoConstante(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false)
    expect(iguaisEmTempoConstante(new Uint8Array([]), new Uint8Array([0]))).toBe(false)
  })
})

describe('contas dos jogadores: nome e PIN da conta nova', () => {
  it('PIN de 4 a 12 dígitos, nome não vazio e sem repetir pelo esqueleto (maiúscula, espaço, letra disfarçada)', async () => {
    const arquivo: ArquivoDeContas = { soComConta: false, contas: [await conta('conta_ana', 'Ana Lu')] }
    expect(problemaDaNovaConta(arquivo, 'Bia', '1234')).toBeNull()
    expect(problemaDaNovaConta(arquivo, 'Bia', '123456789012')).toBeNull()
    expect(problemaDaNovaConta(arquivo, 'Bia', '123')).toBe('pin_invalido')
    expect(problemaDaNovaConta(arquivo, 'Bia', '1234567890123')).toBe('pin_invalido')
    expect(problemaDaNovaConta(arquivo, 'Bia', '12a4')).toBe('pin_invalido')
    expect(problemaDaNovaConta(arquivo, '   ', '1234')).toBe('nome_vazio')
    expect(problemaDaNovaConta(arquivo, 'x'.repeat(33), '1234')).toBe('nome_longo')
    expect(problemaDaNovaConta(arquivo, 'ana lu', '1234')).toBe('nome_repetido')
    // "А" cirílico no lugar do latino: o mesmo nome para quem lê.
    expect(problemaDaNovaConta(arquivo, 'Аna Lu', '1234')).toBe('nome_repetido')
  })
})

describe('contas dos jogadores: aparelhos e "Só com conta"', () => {
  it('o segredo do aparelho tem 32 bytes em base64url e só o hash é comparado', async () => {
    const token = novoTokenDeAparelho()
    expect(token).toMatch(APARELHO_TOKEN_PADRAO)
    expect(novoTokenDeAparelho()).not.toBe(token)
    const ana = await conta('conta_ana', 'Ana')
    const arquivo = comAparelho({ soComConta: false, contas: [ana] }, ana.id, aparelho('ap_1', 5, await hashDoAparelho(token)))
    expect(serializarContas(arquivo)).not.toContain(token)
    expect(aparelhoDoHash(arquivo, await hashDoAparelho(token))?.conta.id).toBe('conta_ana')
    expect(aparelhoDoHash(arquivo, await hashDoAparelho(novoTokenDeAparelho()))).toBeNull()
  })

  it(`passou de ${MAX_APARELHOS_POR_CONTA} aparelhos, sai o visto há mais tempo`, async () => {
    const ana = await conta('conta_ana', 'Ana')
    let arquivo: ArquivoDeContas = { soComConta: false, contas: [ana] }
    for (let i = 0; i < MAX_APARELHOS_POR_CONTA; i += 1) arquivo = comAparelho(arquivo, ana.id, aparelho(`ap_${i}`, i === 3 ? 0 : 100 + i))
    arquivo = comAparelho(arquivo, ana.id, aparelho('ap_novo', 999))
    const ids = arquivo.contas[0].aparelhos.map((a) => a.id)
    expect(ids).toHaveLength(MAX_APARELHOS_POR_CONTA)
    expect(ids).not.toContain('ap_3')
    expect(ids).toContain('ap_novo')
  })

  it('"Só com conta" não liga sem conta nenhuma, e apagar a última conta o desliga', async () => {
    expect(comSoComConta(contasVazias(), true).soComConta).toBe(false)
    const ana = await conta('conta_ana', 'Ana')
    const ligado = comSoComConta({ soComConta: false, contas: [ana] }, true)
    expect(ligado.soComConta).toBe(true)
    expect(semConta(ligado, ana.id)).toEqual({ soComConta: false, contas: [] })
  })
})

describe('contas dos jogadores: leitura tolerante do arquivo', () => {
  it('relê o que gravou, igual', async () => {
    const ana = await conta('conta_ana', 'Ana')
    const arquivo = comAparelho({ soComConta: true, contas: [ana] }, ana.id, aparelho('ap_1', 7))
    expect(contasDoTexto(serializarContas(arquivo))).toEqual(arquivo)
  })

  it('conta torta sai; id ou nome repetido: a primeira vence; aparelho torto sai', async () => {
    const ana = await conta('conta_ana', 'Ana')
    const bia = await conta('conta_bia', 'Bia')
    const texto = JSON.stringify({
      formato: 1,
      soComConta: false,
      contas: [
        { ...ana, aparelhos: [aparelho('ap_1', 3), { id: 'ap_2', hash: 'curto' }, 'lixo'] },
        { ...bia, id: 'conta_ana' },
        { ...bia, id: 'conta_outra', nome: 'ANA' },
        { ...bia, pin: { ...bia.pin, iteracoes: 1000 } },
        { ...bia, pin: { ...bia.pin, algoritmo: 'MD5' } },
        { ...bia, nome: '' },
        bia,
      ],
    })
    const lidas = contasDoTexto(texto)
    expect(lidas).not.toBeNull()
    expect(lidas).not.toBe('futuro')
    if (lidas === null || lidas === 'futuro') return
    expect(lidas.contas.map((c) => c.id)).toEqual(['conta_ana', 'conta_bia'])
    expect(lidas.contas[0].aparelhos.map((a) => a.id)).toEqual(['ap_1'])
  })

  it('formato mais novo não é lido (nem regravado por cima); texto que não é de contas é null', () => {
    expect(contasDoTexto(JSON.stringify({ formato: 2, contas: [] }))).toBe('futuro')
    expect(contasDoTexto('{')).toBeNull()
    expect(contasDoTexto(JSON.stringify({ contas: [] }))).toBeNull()
  })

  it('"Só com conta" gravado sem conta nenhuma volta desligado', () => {
    expect(contasDoTexto(JSON.stringify({ formato: 1, soComConta: true, contas: [] }))).toEqual({ soComConta: false, contas: [] })
  })
})
