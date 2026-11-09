import { describe, expect, it } from 'vitest'
import type { CartaoDaFicha, Personagem } from '../../personagem'
import { ficha, sistema } from '../fichasDaFatiaB.testkit'
import { alvosNaAreaPelaGrade, alvosNaOrdemDaMira, direcaoDaAreaAoAbrir, golpesDeHabilidade, type AlvoNaMira } from '../../../components/batalha/dadosDoMenu'
import { lancarGolpe, podeAgir, type ContextoDoGolpe } from '../golpe'
import { novaCarta, type TurnosDaCena } from '../turnos'

/**
 * Construtor de mecânicas, fatia C3 (alvo e área): a área montada marca pela
 * grade (a ficha inteira, a frente de quem age) e o dano dividido sai no
 * host. Dados inventados; a grade de teste tem casas de 50 px.
 */

const CASA = 50

function cartao(id: string, nome: string, mecanica: CartaoDaFicha['mecanica']): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], mecanica }
}

/** O centro da casa (col, row) em px, como o token de 1 casa fica no mapa. */
function naCasa(col: number, row: number): { x: number; y: number } {
  return { x: col * CASA + CASA / 2, y: row * CASA + CASA / 2 }
}

const ONDA = cartao('cart_onda_de_teste', 'Onda de Teste', {
  versao: 1,
  acao: 'completa',
  alvo: { quem: 'inimigos', forma: { tipo: 'quadrado', lado: 3, centro: 'frente' } },
  dano: { base: { fixo: 40 }, multiplicadores: { concentracao: true, surpresa: true } },
})

describe('a área montada marca pela grade', () => {
  it('3x3 à frente de quem olha para a direita: só os inimigos dentro, o token grande com um pé dentro, nada atrás na borda', () => {
    const npc = ficha('Capitão de Teste', { forca: 30 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [ONDA] })
    const golpe = golpesDeHabilidade(npc, sistema, undefined, null, null).find((item) => item.chave === `tecnica:${ONDA.id}`)
    expect([golpe?.areaPelaGrade, golpe?.area]).toEqual([true, { forma: { tipo: 'frente', lado: 3 }, quem: 'inimigos' }])
    // Quem age na casa (1, 2) olhando para a direita (90°): o 3x3 vai das colunas 2 a 4, linhas 1 a 3.
    const fichas = [
      { id: 'npc', ...naCasa(1, 2), size: 1, rotation: 90 },
      { id: 'colado', ...naCasa(2, 2) },
      { id: 'quina', ...naCasa(4, 3) },
      { id: 'longe', ...naCasa(5, 2) },
      { id: 'amigo', ...naCasa(3, 2) },
      // 2x2 com o centro no canto (250, 50): ocupa as colunas 4 e 5, linhas 0 e 1; a casa (4, 1) está na área.
      { id: 'grandao', x: 250, y: 50, size: 2 },
      { id: 'atras', ...naCasa(0, 2) },
      { id: 'acima', ...naCasa(2, 0) },
    ]
    const lado = (id: string): AlvoNaMira['lado'] => (id === 'npc' ? 'eu' : id === 'amigo' ? 'aliado' : 'outro')
    const alvos = alvosNaOrdemDaMira(
      fichas.map((item): AlvoNaMira => ({ tokenId: item.id, nome: item.id, lado: lado(item.id), caiu: false })),
      fichas,
      'npc',
      CASA,
    )
    const area = golpe?.area
    if (area === undefined) throw new Error('a técnica montada perdeu a área')
    expect(direcaoDaAreaAoAbrir(area, alvos)).toBe('leste')
    expect(alvosNaAreaPelaGrade(area, alvos, 'leste').sort()).toEqual(['colado', 'grandao', 'quina'])
    // Virada para cima, a mesma área pega só quem está acima de quem age.
    expect(alvosNaAreaPelaGrade(area, alvos, 'norte')).toEqual(['acima'])
    // Quem age grande (2x2 no canto da grade) com 3x3 em volta: 1 casa a partir da borda da ficha inteira.
    const emVolta = { forma: { tipo: 'raio' as const, casas: 1 }, quem: 'todos' as const }
    const noCanto = [{ id: 'gigante', x: 50, y: 50, size: 2 }, { id: 'perto', ...naCasa(2, 2) }, { id: 'fora', ...naCasa(3, 0) }]
    const doCanto = alvosNaOrdemDaMira(
      noCanto.map((item): AlvoNaMira => ({ tokenId: item.id, nome: item.id, lado: item.id === 'gigante' ? 'eu' : 'outro', caiu: false })),
      noCanto,
      'gigante',
      CASA,
    )
    expect(alvosNaAreaPelaGrade(emVolta, doCanto, 'norte')).toEqual(['perto'])
  })
})

describe('o dano dividido no host', () => {
  it('71 dividido entre 3 inimigos dá 23 em cada; o 4º marcado é recusado', () => {
    const lua = cartao('cart_lua_de_teste', 'Lua de Teste', {
      versao: 1,
      acao: 'simples',
      alvo: { quem: 'inimigos', forma: { tipo: 'varios', max: 3, dividirDano: true } },
      teste: { tipo: 'naoErra' },
      dano: { base: { fixo: 71 }, multiplicadores: { concentracao: true, surpresa: true } },
    })
    const quem = ficha('Feiticeira de Teste', { forca: 10 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades: [lua] })
    const bonecos = [1, 2, 3, 4].map((n) => ficha(`Boneco ${n}`, { forca: 10 }, { hp: 400, sp: 50, escudo: 0 }, {}))
    const carta = novaCarta('tok_quem', quem.id, quem.nome)
    const cartas = [carta, ...bonecos.map((boneco, i) => novaCarta(`tok_${i + 1}`, boneco.id, boneco.nome))]
    const personagens: Personagem[] = [quem, ...bonecos]
    const turnos: TurnosDaCena = { cartas, vez: carta.id, rodada: 1, desempate: 'd20', d20: {}, empates: {}, extras: {}, gastos: {} }
    const ctx: ContextoDoGolpe = { turnos, carta, personagem: quem, sistema, regras: null, autor: { tipo: 'mestre' }, personagens, personagemDoToken: (tokenId) => cartas.find((item) => item.tokenId === tokenId)?.personagemId ?? undefined }
    const pedido = (quantos: number) => ({ tipo: 'habilidade' as const, cartaoId: lua.id, armaId: null, alvos: cartas.slice(1, quantos + 1).map((item) => ({ tokenId: item.tokenId, dano: 71 })), surpresa: false, perfurante: false, custo: null, acao: null })
    const tres = lancarGolpe(ctx, pedido(3), { golpe: 'g', linha: 'l' })
    expect(tres.golpe?.alvos.map((alvo) => alvo.danoFinal)).toEqual([23, 23, 23])
    expect(podeAgir(ctx, pedido(3))).toBeNull()
    expect(podeAgir(ctx, pedido(4))).toBe('Lua de Teste acerta no máximo 3 alvos (o dano é dividido)')
  })
})
