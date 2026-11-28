import { describe, expect, it } from 'vitest'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { puzzleDoModelo } from '../padroes'
import { vistaDoPuzzle } from '../recorte'
import { PASSOS_DO_GIRO } from '../tipos'
import type { ContextoDoMotor, GiratoriasDoPuzzle, ProgressoDoPuzzle, Puzzle } from '../tipos'
import { alvosDasGiratorias, giratoriasPadrao, simboloNaMarca } from './giratorias'

/**
 * AS PEÇAS GIRATÓRIAS (28/11): cada giro anda um anel 45 graus (e, no modo
 * difícil, os dois vizinhos junto); o último anel no lugar destrava o que o
 * mestre escolheu; o jogador recebe pelo fio onde cada anel está, nunca onde
 * ele deveria estar. Semente fixa: o mesmo começo em toda rodada.
 */

const QUEM = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }

function contexto(): ContextoDoMotor {
  let n = 0
  return { quem: QUEM, agora: 1_700_000_000_000, modo: 'jogo', pecaDoAcervo: () => null, novoId: () => `novo-${++n}` }
}

function medalhao(mudar: Partial<GiratoriasDoPuzzle> = {}): Puzzle {
  const base = puzzleDoModelo('fonte')
  return { ...base, encaixes: [], futuro: { ...giratoriasPadrao(424242), ...mudar }, desfecho: { ...base.desfecho, abrePorta: true } }
}

/** As posições que o jogador vê agora, pelo recorte. */
function girosVistos(puzzle: Puzzle, progresso: ProgressoDoPuzzle): number[] {
  return vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] }).giratorias?.giros ?? []
}

function girar(puzzle: Puzzle, progresso: ProgressoDoPuzzle, roda: number, passo: 1 | -1) {
  return agirNoPuzzle(puzzle, progresso, [], { tipo: 'girar', roda, passo }, contexto())
}

/** O passo mais curto de `de` até `para` numa volta de 8. */
function falta(de: number, para: number): number {
  const d = (((para - de) % PASSOS_DO_GIRO) + PASSOS_DO_GIRO) % PASSOS_DO_GIRO
  return d > PASSOS_DO_GIRO / 2 ? d - PASSOS_DO_GIRO : d
}

describe('peças giratórias', () => {
  it('cada giro anda só o anel tocado, e o último anel no lugar resolve (não antes)', () => {
    const puzzle = medalhao({ aneis: 4, vizinhas: false })
    let progresso = progressoInicial(puzzle)
    const antes = girosVistos(puzzle, progresso)
    expect(antes).toHaveLength(4)

    const um = girar(puzzle, progresso, 2, 1)
    expect(girosVistos(puzzle, um.progresso)).toEqual(antes.map((giro, k) => (k === 2 ? (giro + 1) % PASSOS_DO_GIRO : giro)))

    // Gira cada anel até o zero (o desenho inteiro); só o último giro resolve.
    const resolveu: boolean[] = []
    antes.forEach((giro, anel) => {
      const passos = falta(giro, 0)
      for (let i = 0; i < Math.abs(passos); i++) {
        const passo = girar(puzzle, progresso, anel, passos > 0 ? 1 : -1)
        progresso = passo.progresso
        resolveu.push(passo.efeitos.some((efeito) => efeito.tipo === 'resolveu'))
      }
    })
    expect(resolveu.at(-1)).toBe(true)
    expect(resolveu.slice(0, -1).every((r) => !r)).toBe(true)
    expect(girosVistos(puzzle, progresso)).toEqual([0, 0, 0, 0])
    expect(girar(puzzle, progresso, 0, 1).efeitos).toEqual([{ tipo: 'recusado', motivo: 'resolvido' }])
  })

  it('no modo difícil, girar um anel leva os vizinhos, e o começo sorteado sempre tem volta', () => {
    const puzzle = medalhao({ aneis: 5, vizinhas: true })
    const progresso = progressoInicial(puzzle)
    const antes = girosVistos(puzzle, progresso)
    const meio = girosVistos(puzzle, girar(puzzle, progresso, 2, 1).progresso)
    expect(meio.map((giro, k) => falta(antes[k] ?? 0, giro))).toEqual([0, 1, 1, 1, 0])
    const borda = girosVistos(puzzle, girar(puzzle, progresso, 0, -1).progresso)
    expect(borda.map((giro, k) => falta(antes[k] ?? 0, giro))).toEqual([-1, -1, 0, 0, 0])

    // Com 5 anéis e vizinhas nem todo estado tem volta: o começo tem (busca por giros de verdade, no motor).
    const vistos = new Set<string>([antes.join()])
    let fronteira: ProgressoDoPuzzle[] = [progresso]
    let achou = false
    while (fronteira.length > 0 && !achou) {
      const proxima: ProgressoDoPuzzle[] = []
      for (const atual of fronteira) {
        for (let anel = 0; anel < 5 && !achou; anel++) {
          const passo = girar(puzzle, atual, anel, 1)
          if (passo.progresso.resolvido !== null) achou = true
          const chave = girosVistos(puzzle, passo.progresso).join()
          if (!vistos.has(chave)) {
            vistos.add(chave)
            proxima.push(passo.progresso)
          }
        }
      }
      fronteira = proxima
    }
    expect(achou).toBe(true)
  })

  it('o último anel destrava a porta ligada, e o jogador recebe o medalhão sem a resposta', () => {
    const simbolos = ['lua', 'olho', 'chave'] as const
    const puzzle = medalhao({ desenho: 'simbolos', aneis: 3, simbolos: [...simbolos], vizinhas: false, material: 'pedra' })
    const giratorias = puzzle.futuro?.tipo === 'giratorias' ? (puzzle.futuro as GiratoriasDoPuzzle) : null
    if (giratorias === null) throw new Error('o medalhão nasceu sem as peças giratórias')
    const alvos = alvosDasGiratorias(giratorias)
    let progresso = progressoInicial(puzzle)
    let ultimo: ReturnType<typeof girar> | null = null
    girosVistos(puzzle, progresso).forEach((giro, anel) => {
      const passos = falta(giro, alvos[anel] ?? 0)
      for (let i = 0; i < Math.abs(passos); i++) {
        ultimo = girar(puzzle, progresso, anel, passos > 0 ? 1 : -1)
        progresso = ultimo.progresso
      }
    })
    const efeitos = (ultimo as ReturnType<typeof girar> | null)?.efeitos ?? []
    const entrega = efeitos.find((efeito) => efeito.tipo === 'entregar')
    expect(entrega?.tipo === 'entregar' && entrega.desfecho.abrePorta).toBe(true)

    const vista = vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso, mochila: [] })
    const fio = JSON.parse(JSON.stringify(vista)) as Record<string, unknown>
    const lida = lerVistaDoPuzzle(fio)
    expect(lida?.resolvido).toBe(true)
    expect(lida?.encaixes).toEqual([])
    expect(lida?.giratorias?.material).toBe('pedra')
    expect(lida?.giratorias?.giros.map((giro, anel) => simboloNaMarca(giro, anel))).toEqual([...simbolos])
    // A resposta (os símbolos pedidos), o começo e a semente nunca vão pelo fio: só a lista branca.
    expect(Object.keys(fio.giratorias as object).sort()).toEqual(['cena', 'desenho', 'giros', 'imagem', 'material', 'vizinhas'])
    expect(JSON.stringify(fio)).not.toMatch(/"simbolos":|embaralho|alvo/)
  })
})
