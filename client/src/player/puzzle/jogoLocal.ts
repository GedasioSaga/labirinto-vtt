/**
 * O PUZZLE SEM REDE: o motor de verdade (`puzzles/motor.ts`) e o recorte de
 * verdade (`puzzles/recorte.ts`) rodando aqui, para a tela do jogador funcionar
 * antes da ligação com o host (onda 4). Faz o papel do host para UM jogador:
 * confere o `rev`, chama o motor, monta a vista e traduz os efeitos em
 * acontecimentos da tela. A conta é a mesma do host: a tela não pode mentir
 * sobre o jogo.
 *
 * Fora daqui ficam as outras pessoas: a peça de outro que alguém tira (`devolver`)
 * vai para uma ficha que não existe nesta mesa, então só sai do puzzle.
 */
import { useCallback, useMemo, useState } from 'react'
import { mochilaComItemDoAcervo } from '../../lib/items'
import { agirNoPuzzle, progressoInicial } from '../../puzzles/motor'
import { vistaDoPuzzle } from '../../puzzles/recorte'
import type { AcaoNoPuzzle, DesfechoDoPuzzle, EfeitoDoPuzzle, PecaDoAcervo, ProgressoDoPuzzle, Puzzle, QuemMexe, VistaDoPuzzle } from '../../puzzles/tipos'
import type { CarriedItem } from '../../types/map'
import type { AcontecimentoNoPuzzle, CastigoNaTela, CorpoDoAcontecimento, DesfechoNaTela, PvNaTela } from './tipos'

export interface OpcoesDoJogoLocal {
  desafioId: string
  puzzle: Puzzle
  /** A mochila de quem joga, no começo. */
  mochila: CarriedItem[]
  quem: QuemMexe
  pv: PvNaTela
  /** O item do acervo pelo id (a peça guardada da troca); `null` = apagado. */
  pecaDoAcervo: (itemId: string) => PecaDoAcervo | null
  /** O progresso de partida (as peças que outra pessoa já pôs); ausente = ninguém tocou. */
  progresso?: ProgressoDoPuzzle
}

export interface JogoLocalDoPuzzle {
  vista: VistaDoPuzzle
  acontecimentos: readonly AcontecimentoNoPuzzle[]
  pv: PvNaTela
  progresso: ProgressoDoPuzzle
  agir: (acao: AcaoNoPuzzle, rev: number) => void
}

interface EstadoLocal {
  progresso: ProgressoDoPuzzle
  mochila: CarriedItem[]
  pv: PvNaTela
  acontecimentos: AcontecimentoNoPuzzle[]
  /** O próximo `id` de acontecimento (e a semente dos ids de vaga). */
  proximo: number
}

/** A tela só precisa dos últimos: ela guarda o `id` do último que tratou. */
const ACONTECIMENTOS_GUARDADOS = 12

export function useJogoLocalDoPuzzle(opcoes: OpcoesDoJogoLocal): JogoLocalDoPuzzle {
  const { desafioId, puzzle, quem, pecaDoAcervo } = opcoes
  const [estado, setEstado] = useState<EstadoLocal>(() => ({
    progresso: opcoes.progresso ?? progressoInicial(opcoes.puzzle),
    mochila: opcoes.mochila,
    pv: opcoes.pv,
    acontecimentos: [],
    proximo: 1,
  }))

  const agir = useCallback(
    (acao: AcaoNoPuzzle, rev: number) => setEstado((antes) => passo(antes, { puzzle, quem, pecaDoAcervo }, acao, rev)),
    [puzzle, quem, pecaDoAcervo],
  )

  const vista = useMemo(
    () => vistaDoPuzzle({ desafioId, puzzle, progresso: estado.progresso, mochila: estado.mochila }),
    [desafioId, puzzle, estado.progresso, estado.mochila],
  )
  return { vista, acontecimentos: estado.acontecimentos, pv: estado.pv, progresso: estado.progresso, agir }
}

interface Mesa {
  puzzle: Puzzle
  quem: QuemMexe
  pecaDoAcervo: (itemId: string) => PecaDoAcervo | null
}

/** Uma ação, como o host a trataria. Puro a não ser pelo relógio do `resolvido.em`. */
function passo(antes: EstadoLocal, mesa: Mesa, acao: AcaoNoPuzzle, rev: number): EstadoLocal {
  let ids = 0
  // Determinístico: o React pode chamar o atualizador duas vezes (StrictMode) e o resultado tem de ser o mesmo.
  const novoId = () => `vaga-local-${antes.proximo}-${(ids += 1)}`
  if (rev !== antes.progresso.rev) return comAcontecimentos(antes, [{ tipo: 'recusado', motivo: 'velho' }])

  const resultado = agirNoPuzzle(mesa.puzzle, antes.progresso, antes.mochila, acao, {
    quem: mesa.quem,
    agora: Date.now(),
    modo: 'jogo',
    pecaDoAcervo: mesa.pecaDoAcervo,
    novoId,
  })
  let mochila = resultado.mochila
  let pv = antes.pv
  for (const efeito of resultado.efeitos) {
    if (efeito.tipo === 'entregar') mochila = comOsItensDoDesfecho(mochila, efeito.desfecho, novoId)
    if (efeito.tipo === 'castigar' && efeito.castigo.tipo !== 'barulho') pv = { ...pv, atual: Math.max(0, pv.atual - efeito.castigo.pv) }
  }
  const corpos = acontecimentosDosEfeitos(resultado.efeitos, mesa)
  return comAcontecimentos({ ...antes, progresso: resultado.progresso, mochila, pv }, corpos)
}

function comAcontecimentos(estado: EstadoLocal, corpos: CorpoDoAcontecimento[]): EstadoLocal {
  if (corpos.length === 0) return estado
  const novos = corpos.map((corpo, i): AcontecimentoNoPuzzle => ({ ...corpo, id: estado.proximo + i }))
  return { ...estado, acontecimentos: [...estado.acontecimentos, ...novos].slice(-ACONTECIMENTOS_GUARDADOS), proximo: estado.proximo + corpos.length }
}

/** O que o host mandaria a quem agiu: a recusa, o erro com o castigo, as metades juntas, a troca e o desfecho. */
function acontecimentosDosEfeitos(efeitos: readonly EfeitoDoPuzzle[], mesa: Mesa): CorpoDoAcontecimento[] {
  const castigar = efeitos.find((efeito) => efeito.tipo === 'castigar')
  const entregar = efeitos.find((efeito) => efeito.tipo === 'entregar')
  return efeitos.flatMap((efeito): CorpoDoAcontecimento[] => {
    switch (efeito.tipo) {
      case 'recusado':
        return [{ tipo: 'recusado', motivo: efeito.motivo }]
      case 'errou':
        return [{ tipo: 'errou', em: efeito.em, castigo: castigar === undefined ? null : castigoNaTela(castigar.castigo) }]
      case 'juntou':
        return [{ tipo: 'juntou', encaixeId: efeito.encaixeId }]
      case 'trocou':
        return [{ tipo: 'trocou', nome: mesa.pecaDoAcervo(efeito.guarda)?.nome ?? 'A peça' }]
      case 'resolveu':
        return [{ tipo: 'resolvido', desfecho: desfechoNaTela(entregar?.desfecho ?? mesa.puzzle.desfecho, mesa.quem.nome, entregar !== undefined) }]
      case 'devolver':
      case 'entregar':
      case 'castigar':
        return []
    }
  })
}

function castigoNaTela(castigo: Extract<EfeitoDoPuzzle, { tipo: 'castigar' }>['castigo']): CastigoNaTela {
  if (castigo.tipo === 'barulho') return { tipo: 'barulho', texto: castigo.texto, pv: 0 }
  return { tipo: castigo.tipo, texto: castigo.texto, pv: castigo.pv }
}

/** O desfecho como o host o manda a quem resolveu; `ganhou: false` = o teste, sem nada entregue. */
function desfechoNaTela(desfecho: DesfechoDoPuzzle, por: string, ganhou: boolean): DesfechoNaTela {
  return {
    por,
    modo: desfecho.modo,
    texto: desfecho.texto,
    itens: ganhou ? desfecho.itens.map((item) => ({ nome: item.item.nome, quantidade: item.quantidade, imagem: item.item.imagem ?? null })) : [],
    moedas: ganhou ? desfecho.moedas : 0,
    // Os títulos moram na biblioteca Documentos, que chega na leva do Documento.
    documentos: [],
    abriuPorta: ganhou && desfecho.abrePorta,
  }
}

/** Os itens do desfecho entram na mochila de quem resolveu, pela regra de pilha do acervo. */
function comOsItensDoDesfecho(mochila: CarriedItem[], desfecho: DesfechoDoPuzzle, novoId: () => string): CarriedItem[] {
  return desfecho.itens.reduce((atual, { item, quantidade }) => {
    const { livre: _livre, ...paraDar } = item
    return mochilaComItemDoAcervo(atual, paraDar, quantidade, novoId())?.mochila ?? atual
  }, mochila)
}
