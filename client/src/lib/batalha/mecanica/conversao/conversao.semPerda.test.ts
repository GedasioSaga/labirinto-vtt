// @vitest-environment node
/**
 * REWORK DO EDITOR DE HABILIDADES (0.6.5, PLANO.md E8, teste 1): as fichas REAIS dos testkits das fatias
 * B a F passam pela conversão de leitura (D11). Nenhum texto de antes some, a segunda passada devolve a
 * MESMA ficha, o cartão com regra na tabela à mão e o cartão montado saem intocados, e a técnica
 * convertida tem a mesma ação, custo e dano que a batalha lia no texto.
 */
import { describe, expect, it } from 'vitest'
import { cartaoComAMecanica } from '../../../../components/batalha/editor/gravarNoCartao'
import { tecnicasNoMenu, type TecnicaNoMenu } from '../../acoes'
import { jimboy, may, sistema } from '../../fichasDaFatiaB.testkit'
import { aira, alexei } from '../../fichasDaFatiaC.testkit'
import { guilherme, vagnCom } from '../../fichasDaFatiaD.testkit'
import { outroOgro, ryokoCom, vincentCom } from '../../fichasDaFatiaE.testkit'
import { harveyCom, siegCom } from '../../fichasDaFatiaF.testkit'
import type { LeituraDoCusto } from '../../leituraDaFicha'
import { temLinhaNaTabela } from '../../mecanicasAMao'
import { mecanicaDoModeloNovo } from '../modelos'
import { converterFicha } from './ficha'
import { novoCartao, type CartaoDaFicha, type Personagem } from '../../../personagem'

const FICHAS: readonly Personagem[] = [jimboy, may, aira, alexei, vagnCom(), guilherme, ryokoCom(), outroOgro(), vincentCom(), harveyCom(), siegCom()]

/** A mesma ficha com ids que a tabela à mão não conhece: a conversão de verdade (a tabela manda nos ids reais). */
function comIdsNovos(personagem: Personagem): Personagem {
  let contador = 0
  const novo = (cartao: CartaoDaFicha): CartaoDaFicha => {
    contador += 1
    return { ...cartao, id: `cart_e8-${personagem.nome.length}-${contador}`, subcartoes: cartao.subcartoes.map(novo) }
  }
  return { ...personagem, abas: Object.fromEntries(Object.entries(personagem.abas).map(([aba, cartoes]) => [aba, cartoes.map(novo)])), cartoesAtivos: [] }
}

function cartoesDe(personagem: Personagem): CartaoDaFicha[] {
  const todos: CartaoDaFicha[] = []
  const juntar = (cartao: CartaoDaFicha): void => {
    todos.push(cartao)
    cartao.subcartoes.forEach(juntar)
  }
  Object.values(personagem.abas).forEach((cartoes) => cartoes.forEach(juntar))
  return todos
}

/** Todo texto que o mestre escreveu no cartão: os campos e os extras, sem os vazios. */
function textosDoCartao(cartao: CartaoDaFicha): string[] {
  return [...Object.values(cartao.campos), ...cartao.extras.map((extra) => extra.valor)].map((texto) => texto.trim()).filter((texto) => texto !== '')
}

/** Onde o texto de antes pode estar no convertido: os campos (a Descrição com o "Confira" inclusive) e os extras ("Texto de antes"). */
function ondeOTextoMora(cartao: CartaoDaFicha): string {
  return [...Object.values(cartao.campos), ...cartao.extras.flatMap((extra) => [extra.nome, extra.valor])].join('\n')
}

/** Custo 0 conta igual a sem custo (a mesma régua da conversão). */
function custoNaBatalha(custo: LeituraDoCusto): string {
  return custo.tipo === 'valor' && custo.valor === 0 ? JSON.stringify({ tipo: 'nada' }) : JSON.stringify(custo)
}

function comoABatalhaLe(tecnica: TecnicaNoMenu): { acao: string | null; overload: boolean; custo: string; dano: string } {
  return { acao: tecnica.acao, overload: tecnica.overload, custo: custoNaBatalha(tecnica.custo), dano: JSON.stringify(tecnica.dano) }
}

describe('conversão das habilidades de antes (D11) nas fichas reais', () => {
  it('sem perda: todo texto fica no cartão, a 2ª passada devolve a mesma ficha, a ficha de entrada não muda e a técnica convertida lê igual na batalha', () => {
    let convertidosNoTotal = 0
    let tecnicasComparadas = 0
    for (const real of FICHAS) {
      const antes = comIdsNovos(real)
      const foto = structuredClone(antes)
      const { personagem: convertida, relatorio } = converterFicha(antes, sistema)
      convertidosNoTotal += relatorio.convertidos

      expect(antes).toEqual(foto)
      expect(converterFicha(convertida, sistema).personagem).toBe(convertida)

      const depoisPorId = new Map(cartoesDe(convertida).map((cartao) => [cartao.id, cartao]))
      for (const cartao of cartoesDe(antes)) {
        const depois = depoisPorId.get(cartao.id)
        expect(depois, `${real.nome}: o cartão ${cartao.nome} sumiu`).toBeDefined()
        if (depois === undefined) continue
        const mora = ondeOTextoMora(depois)
        for (const texto of textosDoCartao(cartao)) expect(mora.includes(texto), `${real.nome} · ${cartao.nome}: perdeu "${texto}"`).toBe(true)
      }

      // A técnica convertida: a mesma Ação, Overload, Custo e Dano que a batalha lia no texto.
      const doTexto = new Map(tecnicasNoMenu(antes, sistema, undefined, null, null).map((tecnica) => [tecnica.cartao.id, comoABatalhaLe(tecnica)]))
      for (const tecnica of tecnicasNoMenu(convertida, sistema, undefined, null, null)) {
        const linha = relatorio.cartoes.find((candidata) => candidata.cartaoId === tecnica.cartao.id)
        if (linha?.resultado !== 'convertido' || linha.deQue !== 'tecnica') continue
        tecnicasComparadas += 1
        expect(comoABatalhaLe(tecnica), `${real.nome} · ${tecnica.cartao.nome}`).toEqual(doTexto.get(tecnica.cartao.id))
      }
    }
    // A prova só vale se a conversão de fato montou cartões e técnicas (os números do smoke da E2: 29 montados).
    expect(convertidosNoTotal).toBeGreaterThan(10)
    expect(tecnicasComparadas).toBeGreaterThan(3)
  })

  it('o cartão com regra na tabela à mão e o cartão já montado saem intocados (a mesma referência)', () => {
    const corte = cartaoComAMecanica(novoCartao('Corte Gelado'), mecanicaDoModeloNovo('corteGelado', sistema), 'mestre', { personagem: jimboy, sistema })
    if (corte === null) throw new Error('o editor recusou o Corte Gelado')
    let daTabela = 0
    for (const real of FICHAS) {
      const comMontado: Personagem = { ...real, abas: { ...real.abas, habilidades: [...(real.abas.habilidades ?? []), corte] } }
      const { personagem: convertida } = converterFicha(comMontado, sistema)
      const depoisPorId = new Map(cartoesDe(convertida).map((cartao) => [cartao.id, cartao]))
      expect(depoisPorId.get(corte.id)).toBe(corte)
      for (const cartao of cartoesDe(comMontado)) {
        if (!temLinhaNaTabela(cartao.id)) continue
        daTabela += 1
        expect(depoisPorId.get(cartao.id), `${real.nome} · ${cartao.nome}`).toBe(cartao)
      }
    }
    expect(daTabela).toBeGreaterThan(10)
  })
})
