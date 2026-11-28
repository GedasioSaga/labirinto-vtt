import { useCallback, useEffect, useMemo, useState } from 'react'
import { itemParaDar, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import type { ItemParaDar } from '../../lib/items'
import type { ResolverDeImagem } from '../../lib/midia'
import { moedasLabel } from '../../lib/troca'
import { useJogoLocalDoPuzzle } from '../../player/puzzle/jogoLocal'
import { TelaDoPuzzle } from '../../player/puzzle/TelaDoPuzzle'
import type { PvNaTela, TesteNaTela } from '../../player/puzzle/tipos'
import { urlDaPeca } from '../../puzzles/arte/pecas'
import { combinacaoDoPuzzle } from '../../puzzles/combinacao'
import { giratoriasDoPuzzle } from '../../puzzles/giratorias/giratorias'
import { interruptoresDoPuzzle } from '../../puzzles/interruptores/interruptores'
import { misturaDoPuzzle } from '../../puzzles/mistura/mistura'
import { passosMinimos } from '../../puzzles/mistura/solucao'
import { camadasDoPuzzle } from '../../puzzles/camadas/camadas'
import { cooperacaoDoPuzzle } from '../../puzzles/cooperacao/cooperacao'
import { deslizantesDoPuzzle } from '../../puzzles/deslizantes/deslizantes'
import { puzzleAbrePorta } from '../../puzzles/padroes'
import { CATEGORIA_DA_PECA_DE_PUZZLE, type PecaDoAcervo, type Puzzle, type QuemMexe, type TrocaDePeso } from '../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { useDocumentosStore } from '../../stores/documentosStore'
import type { CarriedItem } from '../../types/map'
import { ImagemDaMesa, useImagemDaMesa } from '../ImagemDaMesa'
import { usePecasDoEditor, type PecasDoEditor } from './pecasDoEditor'

/**
 * TESTAR COMO JOGADOR (plano dos puzzles, §2.1 e §4 P9; aba Testar do
 * protótipo v2). O puzzle que está no editor, salvo ou não, na tela do jogador
 * de verdade (`TelaDoPuzzle`), com o motor de verdade rodando aqui
 * (`jogoLocal.ts` no modo `teste`): a conta é a mesma do jogo, porque o teste
 * não pode mentir sobre ele. Não passa pela rede nem pelas lojas: nenhuma
 * mochila, ficha, porta ou registro muda. A moldura Porta abre as folhas só
 * nesta tela.
 *
 * A mochila é de mentira, como a `pecasDeTeste` do v2: as peças certas (uma
 * por encaixe e por metade), as pedras que fecham a troca de peso, e mais duas
 * peças que não servem.
 */

/** Quem joga no teste: ninguém da mesa. O nome só aparece no "posto por", que no teste é sempre ele. */
const QUEM_TESTA: QuemMexe = { personagemId: null, tokenId: 'teste', nome: 'Você' }
/** Sem a barra de PV: no teste ninguém perde vida (v2). */
const SEM_PV: PvNaTela = { atual: 0, max: 0 }
/** As peças que não servem, como no v2. */
const PECAS_QUE_NAO_SERVEM = 2
/** O id do desafio na vista: o teste não é de lugar nenhum. */
const DESAFIO_DO_TESTE = 'teste'
/** A peça desenhada que ainda não está no acervo vem como o SVG embutido dela (`urlDaPeca`), que o resolvedor da mesa não conhece. */
const DESENHO_DA_PECA = 'data:image/svg+xml'

interface PropsDoTeste {
  /** O puzzle como está no editor agora (com o que ainda não foi salvo). */
  puzzle: Puzzle
  /** O nome da porta ligada a este lugar (só na cópia de um lugar); `null` = nenhuma escolhida. */
  porta: string | null
  /** "Voltar ao editor" (e o Esc). */
  onVoltar: () => void
}

export function TestarComoJogador({ puzzle, porta, onVoltar }: PropsDoTeste) {
  const pecas = usePecasDoEditor()
  const itens = useAcervoDeItensStore((estado) => estado.itens)
  const documentos = useDocumentosStore((estado) => estado.documentos)
  // "Recomeçar o teste": a sessão nasce de novo, com o progresso zerado e a mochila cheia outra vez.
  const [vez, setVez] = useState(0)

  // O foco volta a quem abriu o teste (o "Testar como jogador" do editor). Lido no primeiro render: o
  // efeito da tela, que roda antes deste, já leva o foco à primeira peça.
  const [quemAbriu] = useState(() => document.activeElement)
  useEffect(
    () => () => {
      if (quemAbriu instanceof HTMLElement && quemAbriu.isConnected) quemAbriu.focus({ preventScroll: true })
    },
    [quemAbriu],
  )

  const mochila = useMemo(() => mochilaDeTeste(puzzle, pecas, itens), [puzzle, pecas, itens])
  const pecaDoAcervo = useCallback((itemId: string): PecaDoAcervo | null => itemDaPeca(itemId, pecas, itens), [pecas, itens])
  const recomecar = useCallback(() => setVez((antes) => antes + 1), [])
  // No teste, o desenho da peça aparece como está; o resto (a `midia:` do acervo) segue pelo resolvedor da mesa.
  const resolverDaMesa = useImagemDaMesa()
  const resolver = useCallback<ResolverDeImagem>((valor) => (valor?.startsWith(DESENHO_DA_PECA) === true ? valor : resolverDaMesa(valor)), [resolverDaMesa])

  const teste = useMemo((): TesteNaTela => {
    const titulos = new Map(documentos.map((documento) => [documento.id, documento.titulo]))
    return {
      ganhos: ganhosDoDesfecho(puzzle, titulos),
      porta: puzzleAbrePorta(puzzle) && puzzle.desfecho.abrePorta ? (porta ?? 'porta ligada ao lugar') : null,
      aviso: avisoDosEncaixesSemPeca(puzzle),
      onRecomecar: recomecar,
    }
  }, [puzzle, porta, documentos, recomecar])

  return (
    <ImagemDaMesa.Provider value={resolver}>
      <SessaoDoTeste key={vez} puzzle={puzzle} mochila={mochila} pecaDoAcervo={pecaDoAcervo} teste={teste} onVoltar={onVoltar} />
    </ImagemDaMesa.Provider>
  )
}

interface PropsDaSessao {
  puzzle: Puzzle
  mochila: CarriedItem[]
  pecaDoAcervo: (itemId: string) => PecaDoAcervo | null
  teste: TesteNaTela
  onVoltar: () => void
}

function SessaoDoTeste({ puzzle, mochila, pecaDoAcervo, teste, onVoltar }: PropsDaSessao) {
  const jogo = useJogoLocalDoPuzzle({ desafioId: DESAFIO_DO_TESTE, puzzle, mochila, quem: QUEM_TESTA, pv: SEM_PV, pecaDoAcervo, modo: 'teste' })
  return <TelaDoPuzzle vista={jogo.vista} eu={QUEM_TESTA.nome} pv={null} acontecimentos={jogo.acontecimentos} onAgir={jogo.agir} onSair={onVoltar} teste={teste} />
}

// ------------------------------------------------------------------ a mochila de mentira (puro)

/** A peça como vai para a mochila: a do acervo; a desenhada que ainda não está lá, pelo desenho; a apagada, só com o id. */
function itemDaPeca(itemId: string, pecas: PecasDoEditor, itens: readonly ItemDoCatalogo[]): ItemParaDar {
  const item = itens.find((candidato) => candidato.id === itemId)
  if (item !== undefined) return itemParaDar(item, itens)
  const peca = pecas.porId(itemId)
  if (peca === null) return { nome: 'Peça apagada do acervo', itemId, categoria: CATEGORIA_DA_PECA_DE_PUZZLE }
  return { nome: peca.nome, itemId, categoria: CATEGORIA_DA_PECA_DE_PUZZLE, ...(peca.desenhada === null ? {} : { imagem: urlDaPeca(peca.desenhada) }) }
}

/** As peças que resolvem: uma por encaixe de peça e uma por metade (as que o mestre ainda não escolheu não entram). */
function pecasCertas(puzzle: Puzzle): string[] {
  return puzzle.encaixes.flatMap((encaixe) => {
    const ids = encaixe.jeito === 'peca' ? [encaixe.itemId] : encaixe.metades
    return ids.filter((itemId): itemId is string => itemId !== null)
  })
}

/**
 * As pedras da troca: as menos pedras que somam o peso pedido (o mestre pode ter
 * pensado em duas iguais) e uma de cada outra pedra marcada.
 */
function pedrasDaTroca(troca: TrocaDePeso | null): string[] {
  if (troca === null) return []
  const marcadas = Object.entries(troca.pesos).filter(([, peso]) => Number.isInteger(peso) && peso >= 1)
  // melhor[soma] = a lista mais curta de pedras que dá essa soma; `null` = nenhuma dá.
  const melhor: (string[] | null)[] = [[]]
  for (let soma = 1; soma <= troca.peso; soma += 1) {
    let achou: string[] | null = null
    for (const [itemId, peso] of marcadas) {
      const antes = peso <= soma ? melhor[soma - peso] : null
      if (antes === null || antes === undefined) continue
      if (achou === null || antes.length + 1 < achou.length) achou = [...antes, itemId]
    }
    melhor[soma] = achou
  }
  const fecham = melhor[troca.peso] ?? []
  const usadas = new Set(fecham)
  return [...fecham, ...marcadas.map(([itemId]) => itemId).filter((itemId) => !usadas.has(itemId))]
}

/** Um número fixo por texto (FNV-1a): a mesma mochila a cada teste do mesmo puzzle, embaralhada como no v2. */
function semente(texto: string): number {
  let hash = 2166136261
  for (let i = 0; i < texto.length; i += 1) hash = Math.imul(hash ^ texto.charCodeAt(i), 16777619)
  return hash >>> 0
}

function embaralhado<T>(lista: readonly T[], chave: (item: T, i: number) => string): T[] {
  return lista.map((item, i) => ({ item, ordem: semente(chave(item, i)) })).sort((a, b) => a.ordem - b.ordem).map(({ item }) => item)
}

/**
 * As peças certas, as pedras e duas que não servem, numa mochila que só existe
 * nesta tela: uma vaga por peça, sem a regra de pilha do acervo, que também
 * descartaria o desenho embutido da peça que ainda não está no acervo.
 */
function mochilaDeTeste(puzzle: Puzzle, pecas: PecasDoEditor, itens: readonly ItemDoCatalogo[]): CarriedItem[] {
  const base = puzzle.encaixes.map((encaixe) => encaixe.id).join(',')
  // O medalhão não usa peça nenhuma (nem a troca de peso): a mochila do teste vem vazia.
  if (giratoriasDoPuzzle(puzzle) !== null) return []
  // O painel de lampiões também não (só alavancas).
  if (interruptoresDoPuzzle(puzzle) !== null) return []
  // Os pontos da cooperação também não (só os controles).
  if (cooperacaoDoPuzzle(puzzle) !== null) return []
  // As peças deslizantes também não (só o tabuleiro).
  if (deslizantesDoPuzzle(puzzle) !== null) return []
  // A mistura só usa itens na receita: os ingredientes certos e dois do acervo que não servem.
  const mistura = misturaDoPuzzle(puzzle)
  if (mistura !== null) {
    if (mistura.modo !== 'receita') return []
    const daReceita = mistura.ingredientes.map((ingrediente) => ingrediente.itemId)
    const fora = embaralhado(itens.map((item) => item.id).filter((id) => !daReceita.includes(id)), (id) => `receita|fora|${id}`).slice(0, PECAS_QUE_NAO_SERVEM)
    return embaralhado([...daReceita, ...fora], (id, i) => `receita|${id}|${i}`).map((itemId, i): CarriedItem => ({ ...itemDaPeca(itemId, pecas, itens), id: `vaga-de-teste-${i}` }))
  }
  // A combinação não usa peças (v2: a mochila do teste vem vazia); só as pedras, se houver troca de peso.
  if (combinacaoDoPuzzle(puzzle) !== null) return pedrasDaTroca(puzzle.troca).map((itemId, i): CarriedItem => ({ ...itemDaPeca(itemId, pecas, itens), id: `vaga-de-teste-${i}` }))
  const servem = [...pecasCertas(puzzle), ...pedrasDaTroca(puzzle.troca)]
  const usadas = new Set([...servem, ...(puzzle.troca === null ? [] : [puzzle.troca.guarda])])
  const candidatas = pecas.biblioteca.map((peca) => peca.itemId).filter((itemId) => !usadas.has(itemId))
  const naoServem = embaralhado(candidatas, (itemId) => `${base}|fora|${itemId}`).slice(0, PECAS_QUE_NAO_SERVEM)
  const todas = embaralhado([...servem, ...naoServem], (itemId, i) => `${base}|${itemId}|${i}`)
  return todas.map((itemId, i): CarriedItem => ({ ...itemDaPeca(itemId, pecas, itens), id: `vaga-de-teste-${i}` }))
}

// ------------------------------------------------------------------ o que o cartão e o aviso dizem (puro)

/** "Chave de latão ×2", "30 moedas", "documento “Bilhete”": o que o jogo daria a quem resolver. */
function ganhosDoDesfecho(puzzle: Puzzle, titulos: ReadonlyMap<string, string>): string[] {
  const { itens, moedas, documentos } = puzzle.desfecho
  return [
    ...itens.map(({ item, quantidade }) => (quantidade > 1 ? `${item.nome} ×${quantidade}` : item.nome)),
    ...(moedas > 0 ? [moedasLabel(moedas)] : []),
    ...documentos.map((docId) => {
      const titulo = titulos.get(docId)?.trim() ?? ''
      return titulo === '' ? 'um documento da biblioteca' : `o documento “${titulo}”`
    }),
  ]
}

/** O aviso do v2 ao testar: um encaixe sem peça certa não fecha em regra nenhuma; a sequência vazia, também. `null` = nada falta. */
function avisoDosEncaixesSemPeca(puzzle: Puzzle): string | null {
  // O medalhão guarda os encaixes de antes sem usá-los: só a imagem própria que falta impede de jogar.
  // O painel de lampiões sempre tem volta e não usa peça: nada impede de jogar.
  if (interruptoresDoPuzzle(puzzle) !== null) return null
  // A cooperação também: no teste, o mestre aciona todos os pontos.
  if (cooperacaoDoPuzzle(puzzle) !== null) return null
  // A mistura: o editor só deixa alvo alcançável; sem água nenhuma, não há alvo.
  const mistura = misturaDoPuzzle(puzzle)
  if (mistura !== null) return passosMinimos(mistura) === null ? 'A bancada não chega a alvo nenhum: ligue a torneira ou ponha líquido num recipiente, no editor.' : null
  const giratorias = giratoriasDoPuzzle(puzzle)
  if (giratorias !== null) return giratorias.desenho === 'imagem' && giratorias.imagem === null ? 'O medalhão ainda não tem imagem: escolha uma no editor, em Medalhão.' : null
  // A mesa de luz: as lâminas saem da figura; sem a imagem do mestre, não há lâmina (as do teste são as certas e duas que não servem).
  const camadas = camadasDoPuzzle(puzzle)
  if (camadas !== null) return camadas.figura === 'imagem' && camadas.imagem === null ? 'As lâminas ainda não têm imagem: escolha uma no editor, em Mesa de luz.' : null
  // O tabuleiro: no modo figura, as peças saem da imagem; sem ela, não há o que montar.
  const deslizantes = deslizantesDoPuzzle(puzzle)
  if (deslizantes !== null) return deslizantes.modo === 'figura' && deslizantes.figura === 'imagem' && deslizantes.imagem === null ? 'O tabuleiro ainda não tem imagem: escolha uma no editor, em Tabuleiro.' : null
  const combinacao = combinacaoDoPuzzle(puzzle)
  if (combinacao !== null) return combinacao.forma === 'botoes' && combinacao.resposta.length === 0 ? 'A sequência certa está vazia: assim ninguém resolve. Aperte os botões na ordem, no editor.' : null
  const sem = puzzle.encaixes.filter((encaixe) => (encaixe.jeito === 'peca' ? encaixe.itemId === null : encaixe.metades.some((metade) => metade === null))).length
  if (sem === 0) return null
  return `${sem} ${sem > 1 ? 'encaixes ainda não têm' : 'encaixe ainda não tem'} peça certa: assim ninguém resolve. Escolha no editor.`
}
