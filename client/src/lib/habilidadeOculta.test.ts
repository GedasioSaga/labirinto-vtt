/**
 * HABILIDADE OCULTA (fatia C7): o segredo nunca sai do app do mestre. Dados
 * inventados (repositório público). No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { aplicarNasFichasDoApp } from '../net/nuvem/acertoDasFichas'
import { mudancasDaPasta } from '../net/nuvem/emissor'
import { aplicarPartes } from '../net/edicaoDoPersonagem'
import { cartaoSemImagem } from '../net/protocoloDoPersonagem'
import { revelarCartao, semOcultas } from './habilidadeOculta'
import { paraOFio, personagemDoArquivo, type CartaoDaFicha, type Personagem } from './personagem'

const SEGREDO = 'Garra da Lua Cheia'
const TEXTO_SECRETO = 'Rasga a sombra: 300 de dano'

function cartao(id: string, nome: string, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], ...extra }
}

function fichaDaLina(): Personagem {
  const lida = personagemDoArquivo({
    id: 'pers_lina',
    tipo: 'jogador',
    nome: 'Lina',
    abas: {
      habilidades: [
        cartao('cart_soco', 'Soco Rápido'),
        cartao('cart_garra', SEGREDO, { oculta: true, campos: { efeito: TEXTO_SECRETO }, mecanica: { versao: 1, segredo: SEGREDO } }),
        cartao('cart_chute', 'Chute Baixo'),
      ],
      transformacoes: [cartao('cart_forma', 'Forma Lunar', { subcartoes: [cartao('cart_uivo', 'Uivo Visível'), cartao('cart_sub_oculta', 'Mordida Oculta', { oculta: true, revelaAoUsar: true })] })],
    },
    cartoesAtivos: ['cart_forma', 'cart_garra'],
  })
  if (lida === null) throw new Error('ficha de teste torta')
  return lida
}

describe('o que vai ao jogador', () => {
  it('a sala LAN recebe a ficha sem o cartão oculto, sem o id dele nos ligados e com a contagem "???" por aba', () => {
    const ficha = fichaDaLina()
    const noFio = paraOFio(ficha)
    const texto = JSON.stringify(noFio)
    expect(texto).not.toContain(SEGREDO)
    expect(texto).not.toContain(TEXTO_SECRETO)
    expect(texto).not.toContain('Mordida Oculta')
    expect(texto).not.toContain('cart_garra')
    expect(noFio.abas.habilidades?.map((c) => c.id)).toEqual(['cart_soco', 'cart_chute'])
    expect(noFio.abas.transformacoes?.[0]?.subcartoes.map((c) => c.id)).toEqual(['cart_uivo'])
    expect(noFio.cartoesAtivos).toEqual(['cart_forma'])
    // O subcartão oculto da forma visível sai sem contar: o "???" da aba seria um cartão solto, fora da forma.
    expect(noFio.ocultas).toEqual({ habilidades: 1 })
  })

  it('ficha sem cartão oculto sai igual (mesma referência) e a contagem lida do disco passa pelo leitor', () => {
    const semNada = revelarCartao(revelarCartao(fichaDaLina(), 'cart_garra'), 'cart_sub_oculta')
    expect(semOcultas(semNada)).toBe(semNada)
    expect(personagemDoArquivo({ id: 'x', ocultas: { habilidades: 2, 'aba torta': 1, armas: 0 } })?.ocultas).toEqual({ habilidades: 2 })
  })
})

describe('a edição do jogador na sala LAN', () => {
  it('a aba que volta do jogador (sem o oculto) põe o cartão oculto de volta no mesmo lugar', () => {
    const ficha = fichaDaLina()
    const doJogador = paraOFio(ficha).abas.habilidades ?? []
    const mudada = doJogador.map((c) => (c.id === 'cart_chute' ? { ...c, nome: 'Chute Alto' } : c)).map(cartaoSemImagem)
    const depois = aplicarPartes(ficha, { abas: { habilidades: mudada } })
    expect(depois.abas.habilidades?.map((c) => [c.id, c.nome])).toEqual([
      ['cart_soco', 'Soco Rápido'],
      ['cart_garra', SEGREDO],
      ['cart_chute', 'Chute Alto'],
    ])
    expect(depois.abas.habilidades?.[1]?.oculta).toBe(true)
  })

  it('o jogador não apaga nem troca o oculto forjando o id, nem esconde um cartão dele', () => {
    const ficha = fichaDaLina()
    const forjada = [cartao('cart_garra', 'Troquei'), cartao('cart_soco', 'Soco Rápido', { oculta: true })].map(cartaoSemImagem)
    const depois = aplicarPartes(ficha, { abas: { habilidades: forjada } })
    const garra = depois.abas.habilidades?.find((c) => c.id === 'cart_garra')
    expect(garra?.nome).toBe(SEGREDO)
    expect(depois.abas.habilidades?.filter((c) => c.id === 'cart_garra')).toHaveLength(1)
    expect(depois.abas.habilidades?.find((c) => c.id === 'cart_soco')?.oculta).toBeUndefined()
  })
})

describe('o Lobby', () => {
  it('esconder vira apagar sem o segredo; mexer no oculto não sobe nada; revelar sobe o cartão inteiro', () => {
    const visivel = revelarCartao(fichaDaLina(), 'cart_garra')
    const escondida = fichaDaLina()
    const aoEsconder = mudancasDaPasta([visivel], [escondida])
    expect(aoEsconder.some((m) => m.acao === 'apagar' && m.caminho.join('/') === 'abas/habilidades/cart_garra')).toBe(true)
    expect(JSON.stringify(aoEsconder.filter((m) => m.caminho[0] !== 'abas' || m.acao !== 'apagar'))).not.toContain(SEGREDO)
    const mexida: Personagem = { ...escondida, abas: { ...escondida.abas, habilidades: (escondida.abas.habilidades ?? []).map((c) => (c.id === 'cart_garra' ? { ...c, nome: 'Garra Nova' } : c)) } }
    expect(mudancasDaPasta([escondida], [mexida])).toEqual([])
    const aoRevelar = mudancasDaPasta([escondida], [visivel])
    expect(aoRevelar.find((m) => m.acao === 'criar')?.caminho).toEqual(['abas', 'habilidades', 'cart_garra'])
    expect(JSON.stringify(aoRevelar)).toContain(SEGREDO)
  })

  it('op que chega do Lobby não toca no cartão oculto do app (nem apagar, nem a contagem)', () => {
    const ficha = fichaDaLina()
    const vindas = [
      { fichaId: ficha.id, caminho: ['abas', 'habilidades', 'cart_garra'], acao: 'apagar' as const },
      { fichaId: ficha.id, caminho: ['ocultas'], acao: 'definir' as const, valor: { habilidades: 9 } },
      { fichaId: ficha.id, caminho: ['abas', 'habilidades', 'cart_soco', 'nome'], acao: 'definir' as const, valor: 'Soco Forte' },
    ]
    const depois = aplicarNasFichasDoApp([ficha], vindas)?.[0]
    expect(depois?.abas.habilidades?.map((c) => c.nome)).toEqual(['Soco Forte', SEGREDO, 'Chute Baixo'])
    expect(depois?.ocultas).toBeUndefined()
  })
})
