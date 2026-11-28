import { describe, expect, it } from 'vitest'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import type { CarriedItem } from '../../types/map'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { puzzleDoModelo } from '../padroes'
import { vistaDoPuzzle } from '../recorte'
import type { AcaoNoPuzzle, ContextoDoMotor, MisturaDoPuzzle, ProgressoDoPuzzle, Puzzle } from '../tipos'
import { misturaPadrao, total } from './mistura'
import { buscarNaBancada, caminhoDoAlvo, passosMinimos } from './solucao'

/**
 * A MISTURA DE LÍQUIDOS (28/11): despejar respeita a capacidade de quem recebe;
 * o receptáculo confere o alvo (o certo destrava com a porta, o errado castiga e
 * derrama); o caminho que o editor mostra ao mestre é o mais curto e resolve pelo
 * motor de verdade; o jogador recebe pelo fio o que cada recipiente tem, nunca a
 * proporção certa nem os ids da receita.
 */

const QUEM = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }

function contexto(): ContextoDoMotor {
  let n = 0
  return { quem: QUEM, agora: 1_700_000_000_000, modo: 'jogo', pecaDoAcervo: () => null, novoId: () => `novo-${++n}` }
}

function bancada(mudar: Partial<MisturaDoPuzzle> = {}): Puzzle {
  const base = puzzleDoModelo('fonte')
  return { ...base, encaixes: [], futuro: { ...misturaPadrao(), ...mudar }, desfecho: { ...base.desfecho, abrePorta: true } }
}

interface Passo {
  progresso: ProgressoDoPuzzle
  mochila: CarriedItem[]
  efeitos: ReturnType<typeof agirNoPuzzle>['efeitos']
}

function agir(puzzle: Puzzle, antes: Pick<Passo, 'progresso' | 'mochila'>, acao: AcaoNoPuzzle): Passo {
  const feito = agirNoPuzzle(puzzle, antes.progresso, antes.mochila, acao, contexto())
  return { progresso: feito.progresso, mochila: [...feito.mochila], efeitos: feito.efeitos }
}

/** Os litros de cada recipiente, como o jogador os vê (pelo recorte). */
function litrosVistos(puzzle: Puzzle, progresso: ProgressoDoPuzzle): number[] {
  return (vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] }).mistura?.recipientes ?? []).map((r) => total(r.partes))
}

describe('mistura de líquidos', () => {
  it('despejar para quando quem recebe enche; o alvo errado castiga e derrama, o certo destrava a porta', () => {
    const puzzle = bancada({ modo: 'volumes', recipientes: [{ capacidade: 3, comeca: 'agua', quanto: 0 }, { capacidade: 5, comeca: 'agua', quanto: 0 }], fonte: true, litros: 4, aoErrar: 'derrama' })
    let agora: Passo = { progresso: progressoInicial(puzzle), mochila: [], efeitos: [] }
    agora = agir(puzzle, agora, { tipo: 'despejar', de: 'fonte', para: 1 })
    expect(litrosVistos(puzzle, agora.progresso)).toEqual([0, 5])
    // A jarra de 3 recebe só 3; os 2 ficam na de 5.
    agora = agir(puzzle, agora, { tipo: 'despejar', de: 1, para: 0 })
    expect(litrosVistos(puzzle, agora.progresso)).toEqual([3, 2])
    expect(agir(puzzle, agora, { tipo: 'despejar', de: 1, para: 0 }).efeitos).toEqual([{ tipo: 'recusado', motivo: 'recipiente_cheio' }])
    expect(agir(puzzle, agora, { tipo: 'despejar', de: 'fonte', para: 0 }).efeitos).toEqual([{ tipo: 'recusado', motivo: 'recipiente_cheio' }])

    // 3 litros no receptáculo não são 4: castiga e a jarra derrama; a outra fica como estava.
    agora = agir(puzzle, agora, { tipo: 'despejar', de: 0, para: 'receptaculo' })
    expect(agora.efeitos).toContainEqual({ tipo: 'errou', em: 'mistura' })
    expect(agora.progresso.erros).toBe(1)
    expect(agora.progresso.resolvido).toBeNull()
    expect(litrosVistos(puzzle, agora.progresso)).toEqual([0, 2])

    for (const acao of [{ de: 1, para: 0 }, { de: 'fonte', para: 1 }, { de: 1, para: 0 }] as const) {
      agora = agir(puzzle, agora, { tipo: 'despejar', ...acao })
      expect(agora.progresso.resolvido).toBeNull()
    }
    expect(litrosVistos(puzzle, agora.progresso)).toEqual([3, 4])
    agora = agir(puzzle, agora, { tipo: 'despejar', de: 1, para: 'receptaculo' })
    expect(agora.progresso.resolvido).not.toBeNull()
    expect(agora.efeitos).toContainEqual(expect.objectContaining({ tipo: 'entregar', desfecho: expect.objectContaining({ abrePorta: true }) }))
    expect(agir(puzzle, agora, { tipo: 'despejar', de: 0, para: 'ralo' }).efeitos).toEqual([{ tipo: 'recusado', motivo: 'resolvido' }])
  })

  it('sempre solucionável: o caminho mais curto que o mestre vê resolve pelo motor, nos volumes e nas cores', () => {
    const classica = { ...misturaPadrao(), modo: 'volumes' as const, recipientes: [{ capacidade: 3, comeca: 'agua' as const, quanto: 0 }, { capacidade: 5, comeca: 'agua' as const, quanto: 0 }], fonte: true, litros: 4 }
    // 3 e 5 até 4: seis gestos e o receptáculo.
    expect(passosMinimos(classica)).toBe(7)
    // Com 4 e 6 nunca sai litro ímpar: o editor nem oferece.
    const pares = buscarNaBancada({ modo: 'volumes', recipientes: [{ capacidade: 4, comeca: 'agua', quanto: 0 }, { capacidade: 6, comeca: 'agua', quanto: 0 }], fonte: true })
    expect([...pares.litros.keys()].sort((a, b) => a - b)).toEqual([2, 4, 6])

    const cores = { ...misturaPadrao(), modo: 'cores' as const, fonte: false, litros: null, cor: [0, 1, 1, 0, 0], recipientes: [{ capacidade: 3, comeca: 'vermelho' as const, quanto: 3 }, { capacidade: 5, comeca: 'amarelo' as const, quanto: 5 }, { capacidade: 8, comeca: null, quanto: 0 }] }
    for (const mistura of [classica, cores]) {
      const puzzle = bancada(mistura)
      const alvo = caminhoDoAlvo(mistura)
      expect(alvo).not.toBeNull()
      let agora: Passo = { progresso: progressoInicial(puzzle), mochila: [], efeitos: [] }
      for (const passo of alvo?.caminho ?? []) {
        agora = agir(puzzle, agora, { tipo: 'despejar', de: passo.de, para: passo.para })
        expect(agora.efeitos.some((e) => e.tipo === 'recusado')).toBe(false)
      }
      agora = agir(puzzle, agora, { tipo: 'despejar', de: alvo?.recipiente ?? 0, para: 'receptaculo' })
      expect(agora.progresso.resolvido).not.toBeNull()
      expect(agora.progresso.erros).toBe(0)
    }
  })

  it('o fio leva a bancada ao jogador (sem a proporção nem os ids da receita) e a receita turva, devolve na pia e resolve', () => {
    const cores = bancada({ modo: 'cores', fonte: false, litros: null, cor: [0, 2, 1, 0, 0], recipientes: [{ capacidade: 4, comeca: 'vermelho', quanto: 4 }, { capacidade: 4, comeca: 'amarelo', quanto: 2 }] })
    const mexida = agir(cores, { progresso: progressoInicial(cores), mochila: [] }, { tipo: 'despejar', de: 0, para: 1 }).progresso
    const vista = vistaDoPuzzle({ desafioId: 'd1', puzzle: cores, progresso: mexida, mochila: [] })
    expect(vista.mistura?.recipientes.map((r) => r.partes)).toEqual([[0, 2, 0, 0, 0], [0, 2, 2, 0, 0]])
    const fio = JSON.stringify(vista)
    expect(fio).not.toMatch(/"cor":\[|"comeca"|"quanto"/)
    const lida = lerVistaDoPuzzle(JSON.parse(fio))
    expect(lida?.mistura).toEqual(vista.mistura)
    expect(lida?.mistura?.alvo).toEqual({ tipo: 'cor', cor: expect.stringMatching(/^#[0-9a-f]{6}$/) })
    expect(lida?.encaixes).toEqual([])
    expect(lida?.troca).toBeNull()

    const receita = bancada({
      modo: 'receita',
      recipientes: [{ capacidade: 5, comeca: 'agua', quanto: 0 }, { capacidade: 3, comeca: 'agua', quanto: 0 }],
      fonte: true,
      litros: null,
      ingredientes: [{ itemId: 'item_erva', nome: 'Erva verde' }, { itemId: 'item_po', nome: 'Pó vermelho' }],
      emOrdem: false,
      turvaNaHora: true,
    })
    const mochila: CarriedItem[] = [{ id: 'v1', nome: 'Erva verde', itemId: 'item_erva' }, { id: 'v2', nome: 'Pó vermelho', itemId: 'item_po' }, { id: 'v3', nome: 'Pena', itemId: 'item_pena' }]
    let agora: Passo = { progresso: progressoInicial(receita), mochila, efeitos: [] }
    agora = agir(receita, agora, { tipo: 'despejar', de: 'fonte', para: 0 })
    agora = agir(receita, agora, { tipo: 'deitar', vagaId: 'v3', recipiente: 0 })
    const turva = vistaDoPuzzle({ desafioId: 'd1', puzzle: receita, progresso: agora.progresso, mochila: agora.mochila })
    expect(turva.mistura?.recipientes[0]).toEqual(expect.objectContaining({ turvo: true, itens: [expect.objectContaining({ nome: 'Pena', por: 'Lara' })] }))
    expect(JSON.stringify(turva)).not.toMatch(/item_/)
    expect(lerVistaDoPuzzle(JSON.parse(JSON.stringify(turva)))?.mistura).toEqual(turva.mistura)

    // Na pia a pena volta à mochila de quem a pôs, e a mistura deixa de ser turva.
    agora = agir(receita, agora, { tipo: 'despejar', de: 0, para: 'ralo' })
    expect(agora.mochila.map((v) => v.nome).sort()).toEqual(['Erva verde', 'Pena', 'Pó vermelho'])
    expect(agora.progresso.erros).toBe(0)

    agora = agir(receita, agora, { tipo: 'despejar', de: 'fonte', para: 0 })
    agora = agir(receita, agora, { tipo: 'deitar', vagaId: 'v2', recipiente: 0 })
    agora = agir(receita, agora, { tipo: 'deitar', vagaId: 'v1', recipiente: 0 })
    expect(agora.progresso.mistura?.[0]?.turvo).toBe(false)
    agora = agir(receita, agora, { tipo: 'despejar', de: 0, para: 'receptaculo' })
    expect(agora.progresso.resolvido).not.toBeNull()
    expect(agora.mochila.map((v) => v.nome)).toEqual(['Pena'])
  })
})
