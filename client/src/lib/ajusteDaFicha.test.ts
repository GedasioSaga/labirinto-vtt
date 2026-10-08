/**
 * AJUSTE RÁPIDO DA FICHA — as contas que o mestre, a ficha otimista do
 * jogador e o host fazem igual: a ficha antiga lida sem quebrar, cada parte
 * dentro das regras, o rank pelo total, o "-50" lido certo e o histórico
 * que junta os cliques de um instante numa linha só.
 */
import { describe, expect, it } from 'vitest'
import {
  aplicarAjuste,
  aplicarAjustes,
  atributoComposto,
  interpretarAjuste,
  interpretarValor,
  JANELA_DO_REGISTRO_MS,
  linhasDoAviso,
  maximoComposto,
  NUMERO_DA_FICHA_MAX,
  salvarSobreOAtual,
  textoDaConta,
  trocarNumero,
  valorDoRank,
  type Ajuste,
} from './ajusteDaFicha'
import { HISTORICO_MAX, novoCartao, novoPersonagem, personagemDoArquivo, type CartaoDaFicha, type Personagem } from './personagem'
import { lerSistemaDeRpg, rankDoValor } from './sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

const OP = SISTEMA_ONE_PIECE
const FORCA = OP.atributos.find((atributo) => atributo.id === 'forca')

const FORMA: CartaoDaFicha = {
  ...novoCartao('Transformação'),
  id: 'forma',
  nome: 'Forma Híbrida',
  modificadores: [
    { atributo: 'forca', delta: 10 },
    { atributo: 'hp', delta: 100 },
  ],
}
const GEAR: CartaoDaFicha = { ...novoCartao('Transformação'), id: 'gear', nome: 'Gear Second', modificadores: [{ atributo: 'forca', delta: 40 }] }
const SOCO: CartaoDaFicha = { ...novoCartao('Habilidade'), id: 'soco', nome: 'Soco', modificadores: [{ atributo: 'forca', delta: 99 }] }

/** Aira como uma ficha de ANTES dos ajustes: HP e SP de um número só. */
function aira(extra: Partial<Personagem> = {}): Personagem {
  const base = novoPersonagem(OP, 'jogador', 'Aira')
  return {
    ...base,
    id: 'pers_aira',
    recursos: { hp: 600, sp: 60, escudo: 100 },
    atributos: { ...base.atributos, forca: 35 },
    abas: { ...base.abas, transformacoes: [FORMA, GEAR], habilidades: [SOCO] },
    ...extra,
  }
}

const ajuste = (parte: Ajuste['parte'], chave: string, valor: number): Ajuste => ({ parte, chave, valor })
const hp = (p: Personagem): string => `${p.recursos.hp}/${maximoComposto(p, 'hp').total}`

describe('leitura tolerante: ficha de antes dos ajustes', () => {
  it('HP de um número só vira atual = máximo; modificadores 0, nada ligado, histórico vazio', () => {
    const lida = personagemDoArquivo({ id: 'p1', nome: 'Velha', recursos: { hp: 600, sp: 40, escudo: 10 }, atributos: { forca: 60 } })
    if (lida === null) throw new Error('a ficha antiga deveria abrir')
    expect([lida.maximos, lida.modificadoresDosRecursos, lida.modificadoresDosAtributos, lida.cartoesAtivos, lida.historico]).toEqual([{}, {}, {}, [], []])
    expect(hp(lida)).toBe('600/600')
    expect(atributoComposto(lida, 'forca')).toEqual({ base: 60, modificador: 0, cartoes: [], total: 60 })
  })

  it('o que vem torto sai: máximo que não é número, cartão ligado repetido, linha de histórico sem forma', () => {
    const boa = { quem: 'Ana', parte: 'recurso', chave: 'hp', rotulo: 'HP', de: 600, para: 590, quando: 1000 }
    const lida = personagemDoArquivo({
      id: 'p1',
      maximos: { hp: 'muito', sp: 50 },
      cartoesAtivos: ['forma', 3, 'forma'],
      historico: [boa, { ...boa, parte: 'veneno' }, { ...boa, de: 'x' }, { ...boa, quando: 1e20 }, { ...boa, chave: '' }, 'lixo', { ...boa, quem: '', rotulo: '' }],
    })
    expect(lida?.maximos).toEqual({ sp: 50 })
    expect(lida?.cartoesAtivos).toEqual(['forma'])
    expect(lida?.historico).toEqual([boa, { ...boa, quem: 'Alguém', rotulo: 'hp' }])
  })

  it('histórico maior que o teto: ficam as linhas mais novas', () => {
    const linhas = Array.from({ length: HISTORICO_MAX + 20 }, (_, i) => ({ quem: 'Ana', parte: 'atributo', chave: 'forca', rotulo: 'Força', de: i, para: i + 1, quando: i }))
    const lida = personagemDoArquivo({ id: 'p1', historico: linhas })
    expect(lida?.historico).toHaveLength(HISTORICO_MAX)
    expect(lida?.historico.at(0)?.de).toBe(20)
  })

  it('o sistema só liga "atual e máximo" com true; personagem novo nasce 0/0, sem máximo gravado', () => {
    const lido = lerSistemaDeRpg({ id: 'x', nome: 'X', atributos: [{ id: 'a' }], recursos: [{ id: 'vida', atualEMaximo: true }, { id: 'ouro', atualEMaximo: 'sim' }] })
    expect(lido.ok && lido.sistema.recursos).toEqual([
      { id: 'vida', nome: 'vida', tom: 'neutro', atualEMaximo: true },
      { id: 'ouro', nome: 'ouro', tom: 'neutro' },
    ])
    const novo = novoPersonagem(OP, 'npc', 'Novo')
    expect([novo.maximos, hp(novo)]).toEqual([{}, '0/0'])
  })
})

describe('aplicarAjuste: cada parte dentro das regras', () => {
  it('dano na ficha de antes grava o máximo antes: 600 vira 590/600, e não 590/590', () => {
    const depois = aplicarAjuste(aira(), OP, ajuste('recurso', 'hp', 590))
    expect(hp(depois)).toBe('590/600')
    expect(depois.maximos).toEqual({ hp: 600 })
  })

  it('o atual fica entre 0 e o máximo de verdade (base + modificador)', () => {
    expect(hp(aplicarAjuste(aira(), OP, ajuste('recurso', 'hp', -50)))).toBe('0/600')
    expect(hp(aplicarAjuste(aira(), OP, ajuste('recurso', 'hp', 9999)))).toBe('600/600')
    const comMod = aplicarAjuste(aira(), OP, ajuste('modRecurso', 'hp', 100))
    expect(hp(comMod)).toBe('600/700')
    expect(hp(aplicarAjuste(comMod, OP, ajuste('recurso', 'hp', 9999)))).toBe('700/700')
  })

  it('o máximo que cai puxa o atual; modificador que zera o máximo zera o atual; máximo não fica negativo', () => {
    expect(hp(aplicarAjuste(aira(), OP, ajuste('maximo', 'hp', 500)))).toBe('500/500')
    expect(hp(aplicarAjuste(aira(), OP, ajuste('modRecurso', 'hp', -700)))).toBe('0/0')
    expect(aplicarAjuste(aira(), OP, ajuste('maximo', 'hp', -10)).maximos.hp).toBe(0)
  })

  it('Escudo é um número só: não fica negativo e não tem máximo', () => {
    const zerado = aira({ recursos: { hp: 600, sp: 60, escudo: 0 } })
    expect(aplicarAjuste(zerado, OP, ajuste('recurso', 'escudo', -1))).toBe(zerado)
    expect(aplicarAjuste(zerado, OP, ajuste('recurso', 'escudo', 1)).recursos.escudo).toBe(1)
    expect(aplicarAjuste(zerado, OP, ajuste('maximo', 'escudo', 50))).toBe(zerado)
  })

  it('atributo: base não fica negativa, modificador pode; chave estranha, NaN e repetido não mudam nada', () => {
    const p = aira()
    expect(aplicarAjuste(p, OP, ajuste('atributo', 'forca', -3)).atributos.forca).toBe(0)
    expect(aplicarAjuste(p, OP, ajuste('modAtributo', 'forca', -5)).modificadoresDosAtributos.forca).toBe(-5)
    expect(aplicarAjuste(p, OP, ajuste('atributo', 'forca', 2.7)).atributos.forca).toBe(2)
    expect(aplicarAjuste(p, OP, ajuste('atributo', 'forca', 10 ** 9)).atributos.forca).toBe(NUMERO_DA_FICHA_MAX)
    expect(aplicarAjuste(p, OP, ajuste('atributo', 'sorte', 5))).toBe(p)
    expect(aplicarAjuste(p, OP, ajuste('atributo', 'forca', Number.NaN))).toBe(p)
    expect(aplicarAjuste(p, OP, ajuste('atributo', 'forca', 35))).toBe(p)
  })

  it('transformação: liga só cartão da aba de transformações; desligar puxa o HP de volta ao máximo', () => {
    const p = aira()
    const ligada = aplicarAjuste(p, OP, ajuste('cartao', 'forma', 1))
    expect([ligada.cartoesAtivos, hp(ligada)]).toEqual([['forma'], '600/700'])
    expect(aplicarAjuste(p, OP, ajuste('cartao', 'nao-existe', 1))).toBe(p)
    expect(aplicarAjuste(p, OP, ajuste('cartao', 'soco', 1))).toBe(p)
    expect(aplicarAjuste(p, OP, ajuste('cartao', 'forma', 7))).toBe(p)
    const curada = aplicarAjuste(ligada, OP, ajuste('recurso', 'hp', 690))
    const desligada = aplicarAjuste(curada, OP, ajuste('cartao', 'forma', 0))
    expect([desligada.cartoesAtivos, hp(desligada)]).toEqual([[], '600/600'])
  })

  it('edição (trocarNumero) é crua: sem máximo gravado, digitar o atual é digitar os dois', () => {
    const nova = novoPersonagem(OP, 'npc', 'Nova')
    expect(hp(['6', '60', '600'].reduce((p, texto) => trocarNumero(p, 'recurso', 'hp', Number(texto)), nova))).toBe('600/600')
    expect(hp(trocarNumero(trocarNumero(nova, 'maximo', 'hp', 800), 'recurso', 'hp', 750))).toBe('750/800')
  })
})

describe('total e rank', () => {
  it('o rank sai do total: base + modificador + transformações ligadas, que SOMAM', () => {
    const rank = (p: Personagem) => rankDoValor(FORCA?.rank, valorDoRank(p, 'forca'))
    const p = aira()
    expect(rank(p)).toBe(1)
    const comMod = aplicarAjuste(p, OP, ajuste('modAtributo', 'forca', 5))
    expect(rank(comMod)).toBe(2)
    const duas = [ajuste('cartao', 'forma', 1), ajuste('cartao', 'gear', 1)].reduce((atual, a) => aplicarAjuste(atual, OP, a), comMod)
    expect(rank(duas)).toBe(3)
    expect(textoDaConta(atributoComposto(duas, 'forca'))).toBe('90 = 35 base +5 mod +10 Forma Híbrida +40 Gear Second')
    expect(rank(aplicarAjuste(duas, OP, ajuste('cartao', 'gear', 0)))).toBe(2)
  })

  it('cartão ligado que foi apagado na edição não soma', () => {
    const p = aplicarAjuste(aira(), OP, ajuste('cartao', 'forma', 1))
    expect(atributoComposto({ ...p, abas: { ...p.abas, transformacoes: [] } }, 'forca').total).toBe(35)
  })
})

describe('o que se digita', () => {
  it('"-50" tira, "+30" soma, "50" é o valor exato; espaço e o "−" do celular valem', () => {
    expect(['-50', '+30', '50', ' -5 ', '- 5', '−20'].map((texto) => interpretarAjuste(texto, 600))).toEqual([550, 630, 50, 595, 595, 580])
  })

  it('lixo não vira número', () => {
    for (const lixo of ['', ' ', 'abc', '5-', '1e3', '2.5', '--5', '+', '-', '1234567890', '5 5']) expect(interpretarAjuste(lixo, 600), lixo).toBeNull()
  })

  it('no modificador o sinal é do número: "+3" é +3, não "soma 3"', () => {
    expect(['+3', '-3', '7', '−2', 'x'].map(interpretarValor)).toEqual([3, -3, 7, -2, null])
  })
})

describe('histórico: quem, o quê, de quanto para quanto', () => {
  /** Ajustes um por um, como cliques: `passo` ms entre eles. */
  function clicar(p: Personagem, quem: string, ajustes: Ajuste[], inicio: number, passo = 100): Personagem {
    return ajustes.reduce((atual, a, i) => aplicarAjustes(atual, OP, [a], quem, inicio + i * passo), p)
  }
  const linhas = (p: Personagem) => p.historico.map((r) => `${r.quem}: ${r.parte} ${r.de}→${r.para}`)

  it('dez "−" rápidos são UMA linha "HP 600 → 590", e o aviso diz o mesmo', () => {
    const dez = Array.from({ length: 10 }, (_, i) => ajuste('recurso', 'hp', 599 - i))
    const p = clicar(aira(), 'Ana', dez, 1000)
    expect(linhas(p)).toEqual(['Ana: recurso 600→590'])
    expect(linhasDoAviso(p.historico, 'Ana')).toEqual(['HP 600 → 590'])
  })

  it('passou da janela: linha nova; o mestre no meio: a linha dele fica e a da Ana recomeça de onde ele deixou', () => {
    const a = clicar(aira(), 'Ana', [ajuste('recurso', 'hp', 590)], 0)
    const b = clicar(a, 'Ana', [ajuste('recurso', 'hp', 580)], JANELA_DO_REGISTRO_MS + 1)
    expect(linhas(b)).toEqual(['Ana: recurso 600→590', 'Ana: recurso 590→580'])
    const c = clicar(b, 'Mestre', [ajuste('recurso', 'hp', 500)], JANELA_DO_REGISTRO_MS + 50)
    const d = clicar(c, 'Ana', [ajuste('recurso', 'hp', 510)], JANELA_DO_REGISTRO_MS + 100)
    expect(linhas(d)).toEqual(['Ana: recurso 600→590', 'Ana: recurso 590→580', 'Mestre: recurso 580→500', 'Ana: recurso 500→510'])
  })

  it('ida e volta não deixa linha; nada mudou devolve o MESMO personagem', () => {
    const p = aira()
    expect(clicar(p, 'Ana', [ajuste('atributo', 'forca', 36), ajuste('atributo', 'forca', 35)], 0).historico).toEqual([])
    expect(aplicarAjustes(p, OP, [ajuste('atributo', 'forca', 35)], 'Ana', 0)).toBe(p)
  })

  it('o máximo que puxa o atual grava as duas linhas; a transformação grava "ativou"', () => {
    const p = aplicarAjustes(aira(), OP, [ajuste('maximo', 'hp', 500), ajuste('cartao', 'forma', 1)], 'Mestre', 0)
    expect(p.historico.map((r) => [r.rotulo, r.parte, r.de, r.para])).toEqual([
      ['HP', 'maximo', 600, 500],
      ['HP', 'recurso', 600, 500],
      ['Forma Híbrida', 'cartao', 0, 1],
    ])
    expect(linhasDoAviso(p.historico, 'Mestre')).toEqual(['HP máx. 600 → 500', 'HP 600 → 500', 'ativou Forma Híbrida'])
  })

  it('no teto, as linhas mais velhas saem', () => {
    const muitos = Array.from({ length: HISTORICO_MAX + 5 }, (_, i) => ajuste('atributo', 'forca', 36 + i))
    const p = clicar(aira(), 'Ana', muitos, 0, JANELA_DO_REGISTRO_MS)
    expect(p.historico).toHaveLength(HISTORICO_MAX)
    expect(p.historico.at(-1)?.para).toBe(36 + HISTORICO_MAX + 4)
  })
})

describe('Salvar do mestre sobre a ficha de agora', () => {
  it('número que ele não tocou fica como está agora; o histórico e as transformações não voltam no tempo', () => {
    const base = aira()
    const agora = aplicarAjustes(base, OP, [ajuste('recurso', 'hp', 550), ajuste('cartao', 'forma', 1)], 'Ana', 0)
    const rascunho = { ...base, descricao: 'Navegadora.', atributos: { ...base.atributos, forca: 70 } }
    const salvo = salvarSobreOAtual(base, rascunho, agora)
    expect([salvo.descricao, salvo.atributos.forca, salvo.recursos.hp, salvo.maximos.hp, salvo.cartoesAtivos]).toEqual(['Navegadora.', 70, 550, 600, ['forma']])
    expect(salvo.historico).toBe(agora.historico)
  })
})
