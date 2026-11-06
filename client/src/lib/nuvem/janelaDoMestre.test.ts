import { afterEach, describe, expect, it } from 'vitest'
import { comBase, ligarEmissor, marcaDaBase, prepararEmissao, salvarPelaBase } from '../../net/nuvem/emissor'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { campanhaDeTeste, cartao, docDe, enviar, F_NAMI, ficha, guardada, MESTRE_NO_APP, NAMI, NAMI_NO_PC, op } from './campanha.fixture'
import { membroAtivo } from './permissao'
import type { Op } from './tipos'

/**
 * A JANELA DO MESTRE (plano do Lobby §5.1 e §5.7, aceite da A4; testes
 * liberados: mescla). O mestre abre a ficha da Nami para editar; enquanto a
 * janela está aberta, a Nami muda a própria ficha pelo site. O Salvar da
 * janela parte da ficha de quando ela ABRIU (a base) e entra na de agora: o
 * que a Nami mudou e o mestre não tocou fica; o mesmo campo mudado nos dois
 * lados sai com a base antiga, e o servidor responde conflito em vez de
 * gravar por cima calado. Fichas inventadas (One Piece).
 */

const PASTA = 'pasta_onepiece_teste'

const CLIMA = 'cart_clima'
const MIRAGEM = 'cart_miragem'

let desligar: () => void = () => undefined

afterEach(() => desligar())

function namiComDuasTecnicas(): Personagem {
  return ficha(F_NAMI, {
    dono: NAMI.contaId,
    descricao: 'Navegadora do bando',
    abas: { tecnicas: [cartao(CLIMA, 'Clima-Tact', { campos: { dano: '1d6' } }), cartao(MIRAGEM, 'Miragem', { campos: { efeito: 'some da vista' } })] },
  })
}

/** A campanha publicada e o emissor da pasta ligado a ela, como o sincronizador (A5) ligaria. */
function publicar(): { campanha: ReturnType<typeof campanhaDeTeste>; recebidas: Op[] } {
  const campanha = campanhaDeTeste([guardada(namiComDuasTecnicas())])
  const recebidas: Op[] = []
  desligar = ligarEmissor(PASTA, {
    clienteId: MESTRE_NO_APP.clienteId,
    revConfirmada: () => campanha.revAtual(),
    ehMembro: (contaId) => membroAtivo(campanha.membro(contaId)),
    receber: (ops) => recebidas.push(...ops),
  })
  return { campanha, recebidas }
}

function comCampo(cartoes: readonly CartaoDaFicha[], cartaoId: string, campo: string, valor: string): CartaoDaFicha[] {
  return cartoes.map((atual) => (atual.id === cartaoId ? { ...atual, campos: { ...atual.campos, [campo]: valor } } : atual))
}

function campoDoCartao(doc: Personagem, cartaoId: string, campo: string): string | undefined {
  return doc.abas.tecnicas?.find((atual) => atual.id === cartaoId)?.campos[campo]
}

describe('janela do mestre aberta antes de mudança remota', () => {
  it('não a desfaz: o que a Nami mudou e o mestre não tocou fica, até noutro cartão da mesma aba', () => {
    const { campanha, recebidas } = publicar()
    // O mestre abre a janela: a base e a marca da nuvem dela.
    const base = docDe(campanha, F_NAMI)
    const marca = marcaDaBase()
    // Com a janela aberta, a Nami muda a descrição e o dano do Clima-Tact pelo site.
    const daNami = enviar(campanha, NAMI_NO_PC, [
      op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'Navegadora e ladra' }),
      op(NAMI_NO_PC, F_NAMI, ['abas', 'tecnicas', CLIMA, 'campos', 'dano'], 'definir', { valor: '2d6' }),
    ])
    expect(daNami.respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack'])
    const atual = docDe(campanha, F_NAMI)

    // Na janela o mestre só mudou o nome e o efeito da Miragem (a aba inteira está no rascunho, com o dano antigo).
    const rascunho: Personagem = { ...base, nome: 'Nami, a Gata Ladra', abas: { tecnicas: comCampo(base.abas.tecnicas ?? [], MIRAGEM, 'efeito', 'engana o alvo') } }
    const salvo = salvarPelaBase(base, rascunho, atual)

    expect(salvo.nome).toBe('Nami, a Gata Ladra')
    expect(campoDoCartao(salvo, MIRAGEM, 'efeito')).toBe('engana o alvo')
    expect(salvo.descricao).toBe('Navegadora e ladra')
    expect(campoDoCartao(salvo, CLIMA, 'dano')).toBe('2d6')

    // O Salvar passa pelo funil dentro de `comBase`: só o que o mestre mudou sai, com a base da janela.
    const emissao = comBase(marca, () => prepararEmissao(PASTA, [atual], [salvo]))
    if (!emissao.ok) throw new Error(emissao.motivo)
    emissao.entregar()
    expect(recebidas.map((enviada) => enviada.caminho)).toEqual([['nome'], ['abas', 'tecnicas', MIRAGEM, 'campos', 'efeito']])
    expect(recebidas.every((enviada) => enviada.baseRev === 0)).toBe(true)

    // No servidor, as quatro mudanças convivem.
    expect(enviar(campanha, MESTRE_NO_APP, recebidas).respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack'])
    const noServidor = docDe(campanha, F_NAMI)
    expect([noServidor.nome, noServidor.descricao, campoDoCartao(noServidor, CLIMA, 'dano'), campoDoCartao(noServidor, MIRAGEM, 'efeito')]).toEqual([
      'Nami, a Gata Ladra',
      'Navegadora e ladra',
      '2d6',
      'engana o alvo',
    ])
  })

  it('o mesmo campo mudado nos dois lados vira conflito com a base da janela, e não sobrescreve calado', () => {
    const { campanha, recebidas } = publicar()
    const base = docDe(campanha, F_NAMI)
    const marca = marcaDaBase()
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'Navegadora e ladra' })])
    const atual = docDe(campanha, F_NAMI)

    const salvo = salvarPelaBase(base, { ...base, descricao: 'Cartógrafa' }, atual)
    expect(salvo.descricao).toBe('Cartógrafa')

    // Sem a base da janela, a op sairia com a rev de agora e o servidor gravaria por cima da Nami.
    const semBase = prepararEmissao(PASTA, [atual], [salvo])
    if (!semBase.ok) throw new Error(semBase.motivo)
    semBase.entregar()
    expect(recebidas.map((enviada) => enviada.baseRev)).toEqual([1])
    recebidas.length = 0

    const emissao = comBase(marca, () => prepararEmissao(PASTA, [atual], [salvo]))
    if (!emissao.ok) throw new Error(emissao.motivo)
    emissao.entregar()
    expect(recebidas.map((enviada) => [enviada.caminho, enviada.baseRev])).toEqual([[['descricao'], 0]])

    const [resposta] = enviar(campanha, MESTRE_NO_APP, recebidas).respostas
    expect(resposta).toMatchObject({ t: 'conflito', quem: NAMI.nome, valorAtual: 'Navegadora e ladra' })
    expect(docDe(campanha, F_NAMI).descricao).toBe('Navegadora e ladra')
  })
})
