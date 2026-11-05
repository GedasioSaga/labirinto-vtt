import { describe, expect, it } from 'vitest'
import type { CarriedItem } from '../../types/map'
import { fichaDBTVazia, lerFichaDBT } from '../dbt/modelo'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { aplicar, aplicarOp } from './aplicar'
import { chaveDaEtiqueta } from './caminho'
import { paraJson, type Json } from './json'
import type { Mudanca } from './tipos'

/**
 * APLICAR (plano do Lobby §4.7, §5.1-5.3): a mesma função no app, no site e no
 * servidor. Mochila na ficha (criar empilhável soma na vaga que existe), tetos
 * que dependem da ficha, eco da própria op sem efeito, recusa que não some.
 */

const NAMI = 'pers_nami'

function cartao(id: string, nome: string, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { id, nome, campos: {}, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [], ...extra }
}

function ficha(extra: Partial<Personagem> = {}): Personagem {
  return {
    id: NAMI,
    tipo: 'jogador',
    nome: 'Nami',
    descricao: '',
    retrato: null,
    escolhas: {},
    etiquetas: [],
    recursos: { hp: 300 },
    maximos: {},
    modificadoresDosRecursos: {},
    atributos: {},
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: { tecnicas: [] },
    ...extra,
  }
}

function op(caminho: string[], acao: Mudanca['acao'], extra: Partial<Mudanca> = {}): Mudanca {
  return { fichaId: NAMI, caminho, acao, ...extra }
}

/** Congela a ficha inteira: se `aplicar` escrever nela, o modo estrito do módulo lança. */
function congelada<T>(valor: T): T {
  if (valor !== null && typeof valor === 'object') {
    for (const filho of Object.values(valor)) congelada(filho)
    Object.freeze(valor)
  }
  return valor
}

describe('mochila', () => {
  const tangerina: CarriedItem = { id: 'vaga_tangerina', nome: 'Tangerina', itemId: 'item_tangerina', empilhavel: true, quantidade: 3 }

  it('criar item empilhável com itemId já na mochila soma na vaga que existe', () => {
    const antes = ficha({ mochila: [tangerina] })
    const nova = { id: 'vaga_outra', nome: 'Tangerina', itemId: 'item_tangerina', empilhavel: true, quantidade: 2 }
    const resultado = aplicarOp(antes, op(['mochila', 'vaga_outra'], 'criar', { valor: nova }))
    expect(resultado).toMatchObject({
      ok: true,
      antes: 3,
      depois: 5,
      efetiva: { fichaId: NAMI, caminho: ['mochila', 'vaga_tangerina', 'quantidade'], acao: 'somar', delta: 2 },
    })
    expect(resultado.ok && resultado.doc?.mochila).toEqual([{ ...tangerina, quantidade: 5 }])
  })

  it('item que não empilha abre vaga nova no fim', () => {
    const antes = ficha({ mochila: [tangerina] })
    const mapa = { id: 'vaga_mapa', nome: 'Mapa de Arlong Park' }
    const resultado = aplicarOp(antes, op(['mochila', 'vaga_mapa'], 'criar', { valor: mapa }))
    expect(resultado.ok && resultado.doc?.mochila).toEqual([tangerina, mapa])
  })

  it('soma para no teto da pilha; tirar mais do que tem é recusado', () => {
    const antes = ficha({ mochila: [tangerina] })
    const noTeto = aplicarOp(antes, op(['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: 9999 }))
    expect(noTeto.ok && noTeto.doc?.mochila?.[0].quantidade).toBe(9999)
    expect(aplicarOp(antes, op(['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: -3 }))).toMatchObject({ ok: false, motivo: 'acima-do-teto' })
    const umaSo = aplicarOp(antes, op(['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: -2 }))
    // 1 é o ausente, como no leitor do disco.
    expect(umaSo.ok && umaSo.doc?.mochila).toEqual([{ id: 'vaga_tangerina', nome: 'Tangerina', itemId: 'item_tangerina', empilhavel: true }])
  })

  it('tirar a última vaga tira a chave mochila; campo torto do item é recusado contra a vaga inteira', () => {
    const antes = ficha({ mochila: [tangerina] })
    const vazia = aplicarOp(antes, op(['mochila', 'vaga_tangerina'], 'apagar'))
    expect(vazia.ok && vazia.doc !== null && 'mochila' in vazia.doc).toBe(false)
    expect(aplicarOp(antes, op(['mochila', 'vaga_tangerina', 'preco'], 'definir', { valor: -1 }))).toMatchObject({ ok: false, motivo: 'fora-do-esquema' })
    const comPreco = aplicarOp(antes, op(['mochila', 'vaga_tangerina', 'preco'], 'definir', { valor: 30 }))
    expect(comPreco.ok && comPreco.doc?.mochila).toEqual([{ ...tangerina, preco: 30 }])
  })

  it('mexer em item que outro já tirou não grava nada: alvo-inexistente', () => {
    expect(aplicarOp(ficha(), op(['mochila', 'vaga_sumiu', 'quantidade'], 'somar', { delta: 1 }))).toMatchObject({ ok: false, motivo: 'alvo-inexistente' })
  })
})

describe('moedas', () => {
  it('soma, zero tira a chave e abaixo de zero é recusado', () => {
    const antes = ficha({ moedas: 100 })
    const mais = aplicarOp(antes, op(['moedas'], 'somar', { delta: 50 }))
    expect(mais).toMatchObject({ ok: true, antes: 100, depois: 150 })
    const zerou = aplicarOp(antes, op(['moedas'], 'somar', { delta: -100 }))
    expect(zerou.ok && zerou.doc !== null && 'moedas' in zerou.doc).toBe(false)
    expect(aplicarOp(antes, op(['moedas'], 'somar', { delta: -101 }))).toMatchObject({ ok: false, motivo: 'acima-do-teto' })
    expect(aplicarOp(ficha(), op(['moedas'], 'somar', { delta: 5 }))).toMatchObject({ ok: true, depois: 5 })
  })
})

/**
 * A volta de uma op gravada, como o servidor a monta só com ela (§5.3):
 * criar → apagar; apagar → criar com `antes`; ordenar → a ordem de antes;
 * definir e somar → definir `antes` (o caminho da soma que o teto cortou).
 */
function volta(ida: Mudanca, antes: Json | undefined): Mudanca {
  const { fichaId, caminho } = ida
  switch (ida.acao) {
    case 'criar':
      return { fichaId, caminho, acao: 'apagar' }
    case 'apagar':
      return { fichaId, caminho, acao: 'criar', valor: antes }
    case 'ordenar':
      return { fichaId, caminho, acao: 'ordenar', valor: antes }
    case 'definir':
    case 'somar':
      return antes === undefined ? { fichaId, caminho, acao: 'definir' } : { fichaId, caminho, acao: 'definir', valor: antes }
  }
}

/** Aplica a ida e a volta; devolve a ficha depois das duas. */
function idaEVolta(antes: Personagem, ida: Mudanca, voltaDe: (ida: Mudanca, antes: Json | undefined) => Mudanca = volta): Personagem | null {
  const feita = aplicarOp(antes, ida)
  if (!feita.ok) throw new Error(`a ida não entrou: ${ida.caminho.join('/')} (${feita.detalhe})`)
  expect(feita.semEfeito, ida.caminho.join('/')).toBeUndefined()
  const desfeita = aplicarOp(feita.doc, voltaDe(ida, feita.antes))
  if (!desfeita.ok) throw new Error(`a volta foi recusada: ${ida.caminho.join('/')} (${desfeita.motivo}: ${desfeita.detalhe})`)
  return desfeita.doc
}

describe('desfazer (§5.3)', () => {
  const tangerina: CarriedItem = { id: 'vaga_tangerina', nome: 'Tangerina', itemId: 'item_tangerina', empilhavel: true }
  const mapa: CarriedItem = { id: 'vaga_mapa', nome: 'Mapa de Arlong Park' }

  /** Sem moedas, vaga sem quantidade, cartão sem aMao: os campos ausentes são o caso que quebrava a volta. */
  function semOpcionais(): Personagem {
    return ficha({ etiquetas: ['Navegadora'], mochila: [tangerina, mapa], abas: { tecnicas: [cartao('cart_a', 'Clima-Tact'), cartao('cart_b', 'Thunderbolt Tempo')] } })
  }

  it('a volta de cada op entra e devolve a ficha de antes, inclusive em campo que não existia', () => {
    const idas: Mudanca[] = [
      op(['moedas'], 'somar', { delta: 5 }),
      op(['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: 2 }),
      op(['mochila', 'vaga_tangerina', 'quantidade'], 'definir', { valor: 4 }),
      op(['mochila', 'vaga_mapa', 'preco'], 'definir', { valor: 30 }),
      op(['mochila', 'vaga_mapa'], 'apagar'),
      op(['mochila', 'vaga_bolinho'], 'criar', { valor: { id: 'vaga_bolinho', nome: 'Bolinho' } }),
      op(['abas', 'tecnicas', 'cart_a', 'aMao'], 'definir', { valor: true }),
      op(['abas', 'tecnicas', 'cart_a', 'campos', 'dano'], 'definir', { valor: '2d6' }),
      op(['abas', 'tecnicas', 'cart_b'], 'apagar'),
      op(['abas', 'tecnicas', 'cart_c'], 'criar', { valor: paraJson(cartao('cart_c', 'Mirage Tempo')) }),
      op(['abas', 'tecnicas', '#ordem'], 'ordenar', { valor: ['cart_b', 'cart_a'] }),
      op(['etiquetas', chaveDaEtiqueta('Navegadora')], 'apagar'),
      op(['etiquetas', chaveDaEtiqueta('Ladra')], 'criar', { valor: 'Ladra' }),
      op(['escolhas', 'origem'], 'definir', { valor: 'east-blue' }),
      op(['recursos', 'sp'], 'definir', { valor: 40 }),
      op(['recursos', 'hp'], 'definir', { valor: 250 }),
      op(['cartoesAtivos', 'cart_a'], 'definir', { valor: true }),
      op(['nome'], 'definir', { valor: 'Gata Ladra' }),
      op(['dono'], 'definir', { valor: 'conta_nami' }),
      op(['notaDoMestre'], 'definir', { valor: 'Sonha com o mapa do mundo.' }),
    ]
    for (const ida of idas) expect(idaEVolta(semOpcionais(), ida), ida.caminho.join('/')).toEqual(semOpcionais())
  })

  it('a soma também volta somando o contrário, até o ausente', () => {
    const somaContraria = (ida: Mudanca): Mudanca => ({ ...ida, delta: -(ida.delta ?? 0) })
    expect(idaEVolta(semOpcionais(), op(['moedas'], 'somar', { delta: 5 }), somaContraria)).toEqual(semOpcionais())
    expect(idaEVolta(semOpcionais(), op(['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: 2 }), somaContraria)).toEqual(semOpcionais())
  })

  it('Dragon Ball: a volta do NPC que não existia tira o bloco', () => {
    const dbt = lerFichaDBT(fichaDBTVazia())
    if (dbt === null) throw new Error('ficha Dragon Ball vazia não passou no leitor')
    const goku = ficha({ id: 'pers_goku', nome: 'Son Goku', dbt })
    const npc = { nd: 2, categoria: 'elite', rank: 'C', passivas: [], prontoId: null }
    expect(idaEVolta(goku, { fichaId: 'pers_goku', caminho: ['dbt', 'npc'], acao: 'definir', valor: npc })).toEqual(goku)
    expect(idaEVolta(goku, { fichaId: 'pers_goku', caminho: ['dbt', 'pdl'], acao: 'definir', valor: 9000 })).toEqual(goku)
  })
})

describe('tudo ou nada', () => {
  it('as atomico seguidas entram juntas ou nenhuma entra; as soltas em volta entram sempre', () => {
    const antes = ficha()
    const grande: Personagem = { ...antes, tipo: 'npc', descricao: 'x'.repeat(300 * 1024) }
    const lote: Mudanca[] = [
      op(['recursos', 'hp'], 'definir', { valor: 250 }),
      op([], 'apagar', { atomico: true }),
      op([], 'criar', { valor: paraJson(grande), atomico: true }),
      op(['nome'], 'definir', { valor: 'Gata Ladra' }),
    ]
    const { doc, recusadas } = aplicar(antes, lote)
    // A ficha não sumiu: o apagar voltou junto com o criar grande demais.
    expect(doc).toEqual({ ...antes, recursos: { hp: 250 }, nome: 'Gata Ladra' })
    expect(recusadas.map((recusada) => [recusada.mudanca.acao, recusada.motivo])).toEqual([
      ['apagar', 'doc-grande'],
      ['criar', 'doc-grande'],
    ])
    expect(recusadas[0].detalhe).toMatch(/junto/)
  })

  it('o par que cabe troca a ficha inteira', () => {
    const antes = ficha()
    const npc: Personagem = { ...antes, tipo: 'npc' }
    expect(aplicar(antes, [op([], 'apagar', { atomico: true }), op([], 'criar', { valor: paraJson(npc), atomico: true })])).toEqual({ doc: npc, recusadas: [] })
  })
})

describe('eco e alvo que sumiu', () => {
  it('criar o que já existe e apagar o que já saiu não mudam nada', () => {
    const tec = cartao('cart_clima', 'Clima-Tact')
    const antes = ficha({ abas: { tecnicas: [tec] } })
    const criarDeNovo = aplicarOp(antes, op(['abas', 'tecnicas', 'cart_clima'], 'criar', { valor: paraJson(tec) }))
    expect(criarDeNovo).toMatchObject({ ok: true, semEfeito: true })
    expect(criarDeNovo.ok && criarDeNovo.doc).toBe(antes)
    expect(aplicarOp(antes, op(['abas', 'tecnicas', 'cart_sumiu'], 'apagar'))).toMatchObject({ ok: true, semEfeito: true })
    expect(aplicarOp(antes, op(['etiquetas', chaveDaEtiqueta('Navegadora')], 'apagar'))).toMatchObject({ ok: true, semEfeito: true })
  })

  it('mudar campo de cartão apagado = alvo-inexistente; mudar ficha apagada também', () => {
    const antes = ficha()
    expect(aplicarOp(antes, op(['abas', 'tecnicas', 'cart_sumiu', 'nome'], 'definir', { valor: 'X' }))).toMatchObject({ ok: false, motivo: 'alvo-inexistente' })
    expect(aplicarOp(null, op(['nome'], 'definir', { valor: 'X' }))).toMatchObject({ ok: false, motivo: 'alvo-inexistente' })
  })

  it('ordenar tolera cartão apagado e cartão criado por outro no meio', () => {
    const [a, b, c] = [cartao('cart_a', 'A'), cartao('cart_b', 'B'), cartao('cart_c', 'C')]
    const antes = ficha({ abas: { tecnicas: [a, b, c] } })
    const resultado = aplicarOp(antes, op(['abas', 'tecnicas', '#ordem'], 'ordenar', { valor: ['cart_c', 'cart_sumiu', 'cart_a'] }))
    expect(resultado.ok && resultado.doc?.abas.tecnicas.map((cartaoDaLista) => cartaoDaLista.id)).toEqual(['cart_c', 'cart_a', 'cart_b'])
  })
})

describe('proteção ao aplicar', () => {
  it('nunca escreve na ficha recebida', () => {
    const antes = congelada(
      ficha({
        mochila: [{ id: 'vaga_1', nome: 'Bastão', quantidade: 2, empilhavel: true, itemId: 'item_bastao' }],
        moedas: 10,
        abas: { tecnicas: [cartao('cart_a', 'A', { subcartoes: [cartao('cart_b', 'B')] })] },
        notaDoMestre: 'nota',
      }),
    )
    const copia = JSON.stringify(antes)
    const { recusadas } = aplicar(antes, [
      op(['recursos', 'hp'], 'definir', { valor: 10 }),
      op(['mochila', 'vaga_1', 'quantidade'], 'somar', { delta: 1 }),
      op(['moedas'], 'somar', { delta: -10 }),
      op(['abas', 'tecnicas', 'cart_a', 'subcartoes', 'cart_b', 'campos', 'dano'], 'definir', { valor: '1d4' }),
      op(['notaDoMestre'], 'definir'),
      op(['etiquetas', chaveDaEtiqueta('Ladra')], 'criar', { valor: 'Ladra' }),
    ])
    expect(recusadas).toEqual([])
    expect(JSON.stringify(antes)).toBe(copia)
  })

  it('chave com nome de método do objeto (toString) é lida como da ficha, não do protótipo', () => {
    const resultado = aplicarOp(ficha(), op(['recursos', 'toString'], 'definir', { valor: 7 }))
    expect(resultado).toMatchObject({ ok: true, depois: 7 })
    expect(resultado.ok && resultado.antes).toBeUndefined()
  })

  it('no máximo 30 etiquetas', () => {
    const trinta = Array.from({ length: 30 }, (_, indice) => `Etiqueta ${indice}`)
    expect(aplicarOp(ficha({ etiquetas: trinta }), op(['etiquetas', chaveDaEtiqueta('Mais uma')], 'criar', { valor: 'Mais uma' }))).toMatchObject({
      ok: false,
      motivo: 'acima-do-teto',
    })
  })

  it('ficha acima de 256 KiB é recusada como doc-grande', () => {
    const cartoes = Array.from({ length: 40 }, (_, indice) => cartao(`cart_${indice}`, `C${indice}`, { campos: { texto: 'x'.repeat(7000) } }))
    expect(aplicarOp(ficha({ abas: { tecnicas: cartoes } }), op(['recursos', 'hp'], 'definir', { valor: 1 }))).toMatchObject({ ok: false, motivo: 'doc-grande' })
  })

  it('op torta do fio volta recusada sem derrubar o lote', () => {
    // JSON.parse cru devolve `any`: é o fio mentindo para o tipo, de propósito.
    const torta = JSON.parse('{"fichaId":"pers_nami","caminho":"nome","acao":"definir","valor":"x"}')
    const semAcao = JSON.parse('{"fichaId":"pers_nami","caminho":["nome"],"acao":"explodir","valor":"x"}')
    const { doc, recusadas } = aplicar(ficha(), [torta, semAcao, op(['recursos', 'hp'], 'definir', { valor: 25 })])
    expect(recusadas.map((recusada) => recusada.motivo)).toEqual(['fora-do-esquema', 'fora-do-esquema'])
    expect(doc).toMatchObject({ recursos: { hp: 25 }, nome: 'Nami' })
    expect(aplicarOp(ficha(), JSON.parse('null'))).toMatchObject({ ok: false, motivo: 'fora-do-esquema' })
  })

  it('a recusada não some: volta em recusadas, com motivo, e as outras passam', () => {
    const recusada = op(['nome'], 'definir', { valor: { nome: 'objeto' } })
    const { doc, recusadas } = aplicar(ficha(), [op(['recursos', 'hp'], 'definir', { valor: 25 }), recusada, op(['descricao'], 'definir', { valor: 'Navegadora' })])
    expect(recusadas).toEqual([{ mudanca: recusada, motivo: 'fora-do-esquema', detalhe: expect.any(String) }])
    expect(doc).toMatchObject({ recursos: { hp: 25 }, descricao: 'Navegadora', nome: 'Nami' })
  })
})
