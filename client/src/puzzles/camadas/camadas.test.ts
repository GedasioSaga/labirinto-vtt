import { describe, expect, it } from 'vitest'
import { lerVistaDoPuzzle } from '../../net/protocoloDoPuzzle'
import type { CarriedItem } from '../../types/map'
import { agirNoPuzzle, progressoInicial } from '../motor'
import { puzzleDoModelo } from '../padroes'
import { vistaDoPuzzle } from '../recorte'
import type { AcaoNoPuzzle, CamadasDoPuzzle, ContextoDoMotor, ProgressoDoPuzzle, Puzzle } from '../tipos'
import { camadasPadrao, puzzleDasCamadas } from './camadas'

/**
 * SOBREPOR CAMADAS (28/11): as lâminas vão da mochila para a mesa; a mesa só
 * cede com todas nela, de pé (se o giro importa) e na ordem (se a ordem
 * importa), e o jogador recebe pelo fio a pilha que vê, nunca a ordem certa.
 * Semente fixa: o mesmo corte e os mesmos giros em toda rodada.
 */

const QUEM = { personagemId: 'p-lara', tokenId: 't-lara', nome: 'Lara' }

function contexto(): ContextoDoMotor {
  let n = 0
  return { quem: QUEM, agora: 1_700_000_000_000, modo: 'jogo', pecaDoAcervo: () => null, novoId: () => `novo-${++n}` }
}

function mesa(mudar: Partial<CamadasDoPuzzle> = {}, quantas = 3): Puzzle {
  const base = puzzleDasCamadas(puzzleDoModelo('fonte'), { ...camadasPadrao(4242), ...mudar }, quantas)
  return { ...base, desfecho: { ...base.desfecho, abrePorta: true } }
}

/** A mochila com as lâminas do puzzle (na ordem certa) e uma corda que não serve. */
function mochilaDas(puzzle: Puzzle): CarriedItem[] {
  const laminas = puzzle.encaixes.map((encaixe, k): CarriedItem => ({ id: `vaga-${k}`, nome: `Lâmina ${k}`, itemId: encaixe.jeito === 'peca' ? (encaixe.itemId ?? undefined) : undefined }))
  return [...laminas, { id: 'vaga-corda', nome: 'Corda', itemId: 'item_corda' }]
}

interface Mesa {
  progresso: ProgressoDoPuzzle
  mochila: CarriedItem[]
}

function agir(puzzle: Puzzle, agora: Mesa, acao: AcaoNoPuzzle) {
  const r = agirNoPuzzle(puzzle, agora.progresso, agora.mochila, acao, contexto())
  return { r, mesa: { progresso: r.progresso, mochila: r.mochila } }
}

/** Empilha as lâminas de índice `ordem` (índices dos encaixes, de baixo para cima). */
function empilhar(puzzle: Puzzle, ordem: readonly number[]): Mesa {
  let agora: Mesa = { progresso: progressoInicial(puzzle), mochila: mochilaDas(puzzle) }
  for (const k of ordem) {
    const { r, mesa: depois } = agir(puzzle, agora, { tipo: 'empilhar', vagaId: `vaga-${k}` })
    expect(r.efeitos.filter((e) => e.tipo === 'recusado')).toEqual([])
    agora = depois
  }
  return agora
}

/** Gira cada lâmina posta até ficar de pé, pelo giro que a VISTA mostra (o que o jogador vê). */
function endireitar(puzzle: Puzzle, agora: Mesa): { mesa: Mesa; resolveuNoMeio: boolean } {
  let resolveuNoMeio = false
  for (const lamina of vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso: agora.progresso, mochila: agora.mochila }).camadas?.pilha ?? []) {
    for (let giro = lamina.giro; giro % 4 !== 0; giro += 1) {
      const { r, mesa: depois } = agir(puzzle, agora, { tipo: 'girarLamina', encaixeId: lamina.encaixeId, passo: 1 })
      expect(r.efeitos.filter((e) => e.tipo === 'recusado')).toEqual([])
      if (r.efeitos.some((e) => e.tipo === 'resolveu')) resolveuNoMeio = true
      agora = depois
    }
  }
  return { mesa: agora, resolveuNoMeio }
}

describe('sobrepor camadas', () => {
  it('só a pilha certa destrava: torta ou fora de ordem não, e o que não é lâmina nem entra', () => {
    const puzzle = mesa({ ordemImporta: true, rotacaoImporta: true })
    const ids = puzzle.encaixes.map((e) => e.id)
    expect(ids).toHaveLength(3)

    // A corda não é lâmina desta mesa.
    const corda = agir(puzzle, { progresso: progressoInicial(puzzle), mochila: mochilaDas(puzzle) }, { tipo: 'empilhar', vagaId: 'vaga-corda' })
    expect(corda.r.efeitos).toEqual([{ tipo: 'recusado', motivo: 'nao_e_lamina' }])

    // Todas na mesa, mas de cabeça para baixo (pousam tortas) e na ordem errada: nada cede.
    const fora = empilhar(puzzle, [2, 0, 1])
    expect(fora.progresso.resolvido).toBeNull()
    const pousadas = vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso: fora.progresso, mochila: fora.mochila }).camadas?.pilha ?? []
    expect(pousadas.map((l) => l.encaixeId)).toEqual([ids[2], ids[0], ids[1]])
    expect(pousadas.every((l) => l.giro !== 0)).toBe(true)

    // De pé, ainda fora de ordem: nada cede.
    const dePe = endireitar(puzzle, fora)
    expect(dePe.resolveuNoMeio).toBe(false)
    expect(dePe.mesa.progresso.resolvido).toBeNull()

    // A de baixo (a 2) sobe duas vezes: a pilha fica 0, 1, 2 e a mesa cede, com a porta ligada.
    const id2 = ids[2] ?? ''
    const uma = agir(puzzle, dePe.mesa, { tipo: 'moverLamina', encaixeId: id2, passo: 1 })
    expect(uma.mesa.progresso.resolvido).toBeNull()
    const duas = agir(puzzle, uma.mesa, { tipo: 'moverLamina', encaixeId: id2, passo: 1 })
    expect(duas.r.efeitos.some((e) => e.tipo === 'resolveu')).toBe(true)
    expect(duas.r.efeitos.find((e) => e.tipo === 'entregar')).toMatchObject({ desfecho: { abrePorta: true } })
    // Errar não castiga: nenhuma mexida contou erro.
    expect(duas.mesa.progresso.erros).toBe(0)
  })

  it('o giro e a ordem só contam quando o mestre os liga', () => {
    // Sem giro nem ordem: as lâminas pousam de pé, e qualquer ordem fecha; girar é recusado.
    const solta = mesa({ ordemImporta: false, rotacaoImporta: false })
    const quase = empilhar(solta, [2, 1])
    const pousada = vistaDoPuzzle({ desafioId: 'd1', puzzle: solta, progresso: quase.progresso, mochila: quase.mochila }).camadas?.pilha ?? []
    expect(pousada.every((l) => l.giro === 0)).toBe(true)
    const girar = agir(solta, quase, { tipo: 'girarLamina', encaixeId: pousada[0]?.encaixeId ?? '', passo: 1 })
    expect(girar.r.efeitos).toEqual([{ tipo: 'recusado', motivo: 'mudou' }])
    const ultima = agir(solta, quase, { tipo: 'empilhar', vagaId: 'vaga-0' })
    expect(ultima.r.efeitos.some((e) => e.tipo === 'resolveu')).toBe(true)

    // Só o giro: a ordem errada fecha assim que todas ficam de pé; mudar a ordem é recusado.
    const girando = mesa({ ordemImporta: false, rotacaoImporta: true })
    const tortas = empilhar(girando, [1, 2, 0])
    expect(tortas.progresso.resolvido).toBeNull()
    const mover = agir(girando, tortas, { tipo: 'moverLamina', encaixeId: girando.encaixes[0]?.id ?? '', passo: -1 })
    expect(mover.r.efeitos).toEqual([{ tipo: 'recusado', motivo: 'mudou' }])
    const dePe = endireitar(girando, tortas)
    expect(dePe.mesa.progresso.resolvido).not.toBeNull()
  })

  it('sincroniza: o fio leva a pilha, os giros e os cacos de cada lâmina, e nada que diga a ordem certa', () => {
    const puzzle = mesa({ ordemImporta: true, rotacaoImporta: true, figura: 'codigo', codigo: 'k7x2' }, 4)
    const agora = empilhar(puzzle, [3, 1])
    const vista = vistaDoPuzzle({ desafioId: 'd1', puzzle, progresso: agora.progresso, mochila: agora.mochila })
    const lida = lerVistaDoPuzzle(JSON.parse(JSON.stringify(vista)))
    expect(lida).not.toBeNull()
    expect(lida?.camadas).toEqual(vista.camadas)
    expect(lida?.camadas?.pilha.map((l) => l.encaixeId)).toEqual([puzzle.encaixes[3]?.id, puzzle.encaixes[1]?.id])
    expect(lida?.camadas?.codigo).toBe('K7X2')
    // Os encaixes (na ordem certa) não vão; a semente e os itens certos também não.
    expect(lida?.encaixes).toEqual([])
    const fio = JSON.stringify(vista)
    expect(fio).not.toContain('"semente"')
    expect(fio).not.toContain('item_lamina_')
    // Cada lâmina posta pinta cacos que nenhuma outra pinta, e as manchas da de baixo caem sobre cacos de lâminas de cima.
    const [baixo, cima] = vista.camadas?.pilha ?? []
    expect(baixo?.cacos.some((caco) => cima?.cacos.includes(caco))).toBe(false)
    expect((vista.camadas?.pilha ?? []).every((l) => l.cacos.length > 0)).toBe(true)
  })
})
