/**
 * O MOTOR DOS PUZZLES (plano §2.1): puro, sem React, sem rede e sem relógio.
 * Recebe o puzzle, o progresso de todos, a mochila de quem age e a ação, e
 * devolve o progresso novo, a mochila nova e os efeitos. Quem chama é o HOST
 * de verdade e o "Testar como jogador" do editor (com uma mochila de mentira):
 * a conta é a mesma nos dois, porque o teste não pode mentir sobre o jogo. O
 * teste só não recebe `entregar` nem `castigar`.
 *
 * As regras são as do protótipo aprovado (`prototipo-v2.html`: `aceita`,
 * `porPz`, `tirarPz`, `verificarPz`; a troca de peso e as metades, do v1):
 * - a peça sai da mochila ao encaixar e volta à mochila de QUEM PÔS se alguém a
 *   tirar antes de resolver; depois de resolvido fica presa (nunca volta);
 * - no Encaixe a peça errada nem entra; só a Ordem certa (tudo cheio na ordem
 *   errada) e a Troca de peso (peso errado) castigam;
 * - Juntar peças: as duas metades entram no mesmo encaixe e viram uma peça só;
 *   tirar devolve as duas metades, porque a peça inteira não existe no acervo;
 * - Troca de peso: as pedras da bandeja voltam até a troca dar certo; depois
 *   ficam presas, e a peça guardada vai para quem apertou "Trocar".
 * - Combinação (`puzzles/combinacao.ts`; `girarRodaPz`, `tentarPz`,
 *   `relogioPor` e `apertarBotaoPz` do v2): as rodas e os ponteiros só mudam,
 *   e o "Tentar" confere (errado castiga); cada botão fora da sequência
 *   castiga e a recomeça (do 1, se ele for o primeiro toque). Na combinação
 *   os encaixes não valem: pôr e tirar são recusados.
 *
 * Nunca muda o que recebeu: o resultado é sempre cópia. Pedido recusado
 * devolve o MESMO progresso, sem subir o `rev`.
 */
import { mochilaComItemDoAcervo, quantidadeDe } from '../lib/items'
import type { CarriedItem } from '../types/map'
import { certosNoProgresso, combinacaoCerta, combinacaoDoPuzzle, comCertos, comMinutos, comRodas, mecanicaDesconhecida, modulo, rodasNoProgresso, tamanhoDaRoda } from './combinacao'
import { visualEhPorta } from './padroes'
import { BANDEJA_MAX } from './tipos'
import type {
  AcaoNoPuzzle,
  CombinacaoDoPuzzle,
  ContextoDoMotor,
  EfeitoDoPuzzle,
  EncaixeDoPuzzle,
  MetadesPostas,
  MotivoDaRecusa,
  PecaPosta,
  ProgressoDoPuzzle,
  Puzzle,
  QuemMexe,
  ResultadoDoMotor,
  TrocaDePeso,
} from './tipos'

type EncaixeDePeca = Extract<EncaixeDoPuzzle, { jeito: 'peca' }>
type EncaixeDeMetades = Extract<EncaixeDoPuzzle, { jeito: 'metades' }>
type Lado = 'a' | 'b'
const LADOS: readonly Lado[] = ['a', 'b']

/** Tentativas de achar um id de vaga livre antes de desistir (o gerador do app é aleatório; colidir duas vezes já é defeito). */
const TENTATIVAS_DE_ID_LIVRE = 8

// ------------------------------------------------------------------ leituras do progresso

/** O progresso de um puzzle que ninguém tocou. */
export function progressoInicial(puzzle: Pick<Puzzle, 'encaixes'>): ProgressoDoPuzzle {
  return {
    rev: 0,
    encaixes: Object.fromEntries(puzzle.encaixes.map((encaixe) => [encaixe.id, null])),
    bandeja: [],
    trocaFeita: false,
    resolvido: null,
    erros: 0,
  }
}

/** O que está no encaixe. Lê só a chave própria: um id como `constructor` não cai no protótipo do objeto. */
export function postaEm(progresso: Pick<ProgressoDoPuzzle, 'encaixes'>, encaixeId: string): PecaPosta | MetadesPostas | null {
  return Object.hasOwn(progresso.encaixes, encaixeId) ? (progresso.encaixes[encaixeId] ?? null) : null
}

/** O encaixe está completo: a peça posta, ou as duas metades. A forma que não casa com o encaixe (o mestre mudou o jeito) não conta. */
export function encaixeCheio(encaixe: EncaixeDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'encaixes'>): boolean {
  const posta = postaEm(progresso, encaixe.id)
  if (posta === null) return false
  if (encaixe.jeito === 'peca') return 'vaga' in posta
  return 'a' in posta && posta.a !== null && posta.b !== null
}

/** "2 de 3 no lugar": a contagem que o jogador e a página Jogos mostram. */
export function contagemDoPuzzle(puzzle: Pick<Puzzle, 'encaixes' | 'futuro'>, progresso: Pick<ProgressoDoPuzzle, 'encaixes'>): { postos: number; total: number } {
  // Na combinação os encaixes ficam guardados (para quando o mestre voltar ao Encaixe), mas não contam: ninguém os vê.
  const encaixes = combinacaoDoPuzzle(puzzle) === null ? puzzle.encaixes : []
  return { postos: encaixes.filter((encaixe) => encaixeCheio(encaixe, progresso)).length, total: encaixes.length }
}

/** O peso marcado do item, ou `null` (a chave própria, pelo mesmo motivo de `postaEm`). */
export function pesoDe(troca: Pick<TrocaDePeso, 'pesos'>, itemId: string | undefined): number | null {
  if (itemId === undefined || !Object.hasOwn(troca.pesos, itemId)) return null
  return troca.pesos[itemId] ?? null
}

/** O que a bandeja pesa agora. Pedra sem peso marcado (o mestre o tirou depois) pesa zero. */
export function somaDaBandeja(troca: Pick<TrocaDePeso, 'pesos'>, bandeja: readonly PecaPosta[]): number {
  return bandeja.reduce((soma, pedra) => soma + (pesoDe(troca, pedra.vaga.itemId) ?? 0), 0)
}

/**
 * Toda peça que está no progresso, inclusive a de encaixe que o mestre já
 * tirou do puzzle: é o que o "Zerar progresso" devolve a quem pôs.
 */
export function pecasPostas(progresso: ProgressoDoPuzzle): PecaPosta[] {
  const nosEncaixes = Object.values(progresso.encaixes).flatMap((posta) => {
    if (posta === null || posta === undefined) return []
    if ('vaga' in posta) return [posta]
    return [posta.a, posta.b].filter((metade): metade is PecaPosta => metade !== null)
  })
  return [...nosEncaixes, ...progresso.bandeja]
}

/** A mesma pessoa: a mesma ficha, ou o mesmo boneco quando não há ficha. */
export function mesmaPessoa(a: QuemMexe, b: QuemMexe): boolean {
  if (a.personagemId !== null && a.personagemId === b.personagemId) return true
  return a.tokenId === b.tokenId
}

// ------------------------------------------------------------------ a ação

/** O andamento de uma ação aceita: cópias que o motor pode mudar. */
interface Andamento {
  puzzle: Puzzle
  progresso: ProgressoDoPuzzle
  mochila: CarriedItem[]
  efeitos: EfeitoDoPuzzle[]
  contexto: ContextoDoMotor
}

function recusa(progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], motivo: MotivoDaRecusa): ResultadoDoMotor {
  return { progresso, mochila: [...mochila], efeitos: [{ tipo: 'recusado', motivo }] }
}

function andamento(puzzle: Puzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], contexto: ContextoDoMotor): Andamento {
  return { puzzle, progresso: structuredClone(progresso), mochila: structuredClone([...mochila]), efeitos: [], contexto }
}

function fim(a: Andamento): ResultadoDoMotor {
  a.progresso.rev += 1
  return { progresso: a.progresso, mochila: a.mochila, efeitos: a.efeitos }
}

/**
 * Faz a ação de `contexto.quem` no puzzle. Pedido que não vale volta com um
 * único efeito `recusado` e o progresso e a mochila de antes.
 */
export function agirNoPuzzle(
  puzzle: Puzzle,
  progresso: ProgressoDoPuzzle,
  mochila: readonly CarriedItem[],
  acao: AcaoNoPuzzle,
  contexto: ContextoDoMotor,
): ResultadoDoMotor {
  // Um app desta leva não sabe jogar a mecânica de uma leva futura: recusa tudo, sem mexer no que veio.
  if (mecanicaDesconhecida(puzzle)) return recusa(progresso, mochila, 'versao_nova')
  if (progresso.resolvido !== null) return recusa(progresso, mochila, 'resolvido')
  const combinacao = combinacaoDoPuzzle(puzzle)
  switch (acao.tipo) {
    case 'por':
      // Na combinação os encaixes não aparecem: o pedido é de uma tela de antes da troca de mecânica.
      return combinacao !== null ? recusa(progresso, mochila, 'mudou') : por(puzzle, progresso, mochila, acao, contexto)
    case 'tirar':
      return combinacao !== null ? recusa(progresso, mochila, 'mudou') : tirar(puzzle, progresso, mochila, acao.encaixeId, contexto)
    case 'porNaBandeja':
      return porNaBandeja(puzzle, progresso, mochila, acao.vagaId, contexto)
    case 'tirarDaBandeja':
      return tirarDaBandeja(puzzle, progresso, mochila, contexto)
    case 'trocar':
      return trocar(puzzle, progresso, mochila, contexto)
    case 'girar':
      return girar(puzzle, combinacao, progresso, mochila, acao, contexto)
    case 'ponteiro':
      return ponteiro(puzzle, combinacao, progresso, mochila, acao.minutos, contexto)
    case 'apertar':
      return apertar(puzzle, combinacao, progresso, mochila, acao.botao, contexto)
    case 'tentar':
      return tentar(puzzle, combinacao, progresso, mochila, contexto)
  }
}

// ------------------------------------------------------------------ a combinação

function girar(
  puzzle: Puzzle,
  combinacao: CombinacaoDoPuzzle | null,
  progresso: ProgressoDoPuzzle,
  mochila: readonly CarriedItem[],
  acao: Extract<AcaoNoPuzzle, { tipo: 'girar' }>,
  contexto: ContextoDoMotor,
): ResultadoDoMotor {
  if (combinacao === null || (combinacao.forma !== 'numeros' && combinacao.forma !== 'simbolos')) return recusa(progresso, mochila, 'mudou')
  const quantas = combinacao.resposta.length
  if (!Number.isInteger(acao.roda) || acao.roda < 0 || acao.roda >= quantas) return recusa(progresso, mochila, 'mudou')
  const tamanho = tamanhoDaRoda(combinacao.forma)
  const rodas = rodasNoProgresso(progresso, quantas, tamanho).map((valor, i) => (i === acao.roda ? modulo(valor + acao.passo, tamanho) : valor))
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso = comRodas(a.progresso, rodas)
  return fim(a)
}

function ponteiro(puzzle: Puzzle, combinacao: CombinacaoDoPuzzle | null, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], minutos: number, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (combinacao === null || combinacao.forma !== 'relogio') return recusa(progresso, mochila, 'mudou')
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso = comMinutos(a.progresso, minutos)
  return fim(a)
}

/**
 * Um botão: o certo acende a próxima luz (e o último resolve); o errado
 * castiga e recomeça a sequência, já com uma luz se ele é o primeiro toque
 * (o v2: `p.seq = i === seq[0] ? 1 : 0`).
 */
function apertar(puzzle: Puzzle, combinacao: CombinacaoDoPuzzle | null, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], botao: number, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (combinacao === null || combinacao.forma !== 'botoes') return recusa(progresso, mochila, 'mudou')
  if (!Number.isInteger(botao) || botao < 0 || botao >= combinacao.rotulos.length) return recusa(progresso, mochila, 'mudou')
  const sequencia = combinacao.resposta
  const certos = certosNoProgresso(progresso, sequencia.length)
  const a = andamento(puzzle, progresso, mochila, contexto)
  if (certos < sequencia.length && sequencia[certos] === botao) {
    a.progresso = comCertos(a.progresso, certos + 1)
    if (certos + 1 === sequencia.length) resolver(a)
    return fim(a)
  }
  a.progresso = comCertos(a.progresso, sequencia[0] === botao ? 1 : 0)
  errar(a, { tipo: 'errou', em: 'sequencia' })
  return fim(a)
}

/** O "Tentar abrir" das rodas e o "Tentar" do relógio: certo resolve; errado castiga, e os controles ficam onde estão (v2). */
function tentar(puzzle: Puzzle, combinacao: CombinacaoDoPuzzle | null, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], contexto: ContextoDoMotor): ResultadoDoMotor {
  // A sequência de botões confere a cada toque: não tem "Tentar".
  if (combinacao === null || combinacao.forma === 'botoes') return recusa(progresso, mochila, 'mudou')
  const a = andamento(puzzle, progresso, mochila, contexto)
  if (combinacaoCerta(combinacao, progresso)) resolver(a)
  else errar(a, { tipo: 'errou', em: combinacao.forma === 'relogio' ? 'hora' : 'combinacao' })
  return fim(a)
}

function por(
  puzzle: Puzzle,
  progresso: ProgressoDoPuzzle,
  mochila: readonly CarriedItem[],
  acao: Extract<AcaoNoPuzzle, { tipo: 'por' }>,
  contexto: ContextoDoMotor,
): ResultadoDoMotor {
  const encaixe = puzzle.encaixes.find((e) => e.id === acao.encaixeId)
  if (encaixe === undefined) return recusa(progresso, mochila, 'mudou')
  const vaga = mochila.find((v) => v.id === acao.vagaId)
  if (vaga === undefined) return recusa(progresso, mochila, 'sem_vaga')
  // O encaixe compara pelo item do acervo: a vaga sem `itemId` (o "!" antigo, o item solto) nunca é peça.
  if (vaga.itemId === undefined) return recusa(progresso, mochila, 'nao_encaixa')
  if (encaixe.jeito === 'metades') return porMetade(puzzle, progresso, mochila, encaixe, vaga, vaga.itemId, acao.metade, contexto)
  return porPeca(puzzle, progresso, mochila, encaixe, vaga, vaga.itemId, contexto)
}

/** `null` = a peça `itemId` entra no encaixe; senão, por que não. */
function motivoParaPeca(puzzle: Puzzle, progresso: ProgressoDoPuzzle, encaixe: EncaixeDePeca, itemId: string): MotivoDaRecusa | null {
  if (puzzle.regra === 'lugarCerto') {
    if (encaixe.itemId === null) return 'sem_peca_certa'
    return encaixe.itemId === itemId ? null : 'nao_encaixa'
  }
  // Qualquer lugar e Ordem certa: qualquer peça do conjunto, mas nunca mais cópias dela do que o conjunto pede
  // (duas Garças não podem fechar a Fonte no lugar da Garça e do Sapo).
  const deEncaixe = puzzle.encaixes.filter((e): e is EncaixeDePeca => e.jeito === 'peca')
  const pedidas = deEncaixe.filter((e) => e.itemId === itemId).length
  const jaPostas = deEncaixe.filter((e) => {
    if (e.id === encaixe.id) return false
    const posta = postaEm(progresso, e.id)
    return posta !== null && 'vaga' in posta && posta.vaga.itemId === itemId
  }).length
  return jaPostas < pedidas ? null : 'nao_encaixa'
}

function porPeca(
  puzzle: Puzzle,
  progresso: ProgressoDoPuzzle,
  mochila: readonly CarriedItem[],
  encaixe: EncaixeDePeca,
  vaga: CarriedItem,
  itemId: string,
  contexto: ContextoDoMotor,
): ResultadoDoMotor {
  const atual = postaEm(progresso, encaixe.id)
  // Metades num encaixe que virou de peça: o mestre mudou o jeito; tirar devolve o que está lá.
  if (atual !== null && !('vaga' in atual)) return recusa(progresso, mochila, 'mudou')
  // A peça de outra pessoa só sai pelo "tirar": pôr por cima não pode jogá-la de volta sem que ninguém peça.
  if (atual !== null && !mesmaPessoa(atual.por, contexto.quem)) return recusa(progresso, mochila, 'ocupado')
  const motivo = motivoParaPeca(puzzle, progresso, encaixe, itemId)
  if (motivo !== null) return recusa(progresso, mochila, motivo)
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.mochila = semUmaDaVaga(a.mochila, vaga.id)
  // Pôr sobre a própria peça troca as duas, como no v2: a de antes volta para a mochila.
  const antes = postaEm(a.progresso, encaixe.id)
  if (antes !== null && 'vaga' in antes) devolver(a, antes)
  a.progresso.encaixes[encaixe.id] = { vaga: vagaPosta(vaga), por: { ...contexto.quem } }
  conferir(a)
  return fim(a)
}

function porMetade(
  puzzle: Puzzle,
  progresso: ProgressoDoPuzzle,
  mochila: readonly CarriedItem[],
  encaixe: EncaixeDeMetades,
  vaga: CarriedItem,
  itemId: string,
  pedido: Lado | undefined,
  contexto: ContextoDoMotor,
): ResultadoDoMotor {
  const atual = postaEm(progresso, encaixe.id)
  if (atual !== null && 'vaga' in atual) return recusa(progresso, mochila, 'mudou')
  const postas: MetadesPostas = atual ?? { a: null, b: null }
  const livres = LADOS.filter((lado) => postas[lado] === null && (pedido === undefined || pedido === lado))
  const lado = livres.find((l) => encaixe.metades[ladoParaIndice(l)] === itemId)
  if (lado === undefined) {
    // Já juntas, ou essa metade já está aqui: o encaixe está ocupado para ela.
    if (encaixe.metades.includes(itemId)) return recusa(progresso, mochila, 'ocupado')
    return recusa(progresso, mochila, livres.some((l) => encaixe.metades[ladoParaIndice(l)] === null) ? 'sem_peca_certa' : 'nao_encaixa')
  }
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.mochila = semUmaDaVaga(a.mochila, vaga.id)
  const antes = postaEm(a.progresso, encaixe.id)
  const ja: MetadesPostas = antes !== null && 'a' in antes ? antes : { a: null, b: null }
  const nova: PecaPosta = { vaga: vagaPosta(vaga), por: { ...contexto.quem } }
  const novas: MetadesPostas = lado === 'a' ? { a: nova, b: ja.b } : { a: ja.a, b: nova }
  a.progresso.encaixes[encaixe.id] = novas
  if (novas.a !== null && novas.b !== null) a.efeitos.push({ tipo: 'juntou', encaixeId: encaixe.id })
  conferir(a)
  return fim(a)
}

function ladoParaIndice(lado: Lado): 0 | 1 {
  return lado === 'a' ? 0 : 1
}

function tirar(puzzle: Puzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], encaixeId: string, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (!puzzle.encaixes.some((e) => e.id === encaixeId)) return recusa(progresso, mochila, 'mudou')
  if (postaEm(progresso, encaixeId) === null) return recusa(progresso, mochila, 'vazio')
  const a = andamento(puzzle, progresso, mochila, contexto)
  const atual = postaEm(a.progresso, encaixeId)
  // As metades saem as duas, cada uma para quem a pôs: a peça inteira não existe no acervo (decisão 1 do plano).
  const saem = atual === null ? [] : 'vaga' in atual ? [atual] : [atual.a, atual.b].filter((metade): metade is PecaPosta => metade !== null)
  for (const posta of saem) devolver(a, posta)
  a.progresso.encaixes[encaixeId] = null
  return fim(a)
}

function porNaBandeja(puzzle: Puzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], vagaId: string, contexto: ContextoDoMotor): ResultadoDoMotor {
  const troca = puzzle.troca
  if (troca === null) return recusa(progresso, mochila, 'mudou')
  if (progresso.trocaFeita) return recusa(progresso, mochila, 'troca_feita')
  const vaga = mochila.find((v) => v.id === vagaId)
  if (vaga === undefined) return recusa(progresso, mochila, 'sem_vaga')
  if (pesoDe(troca, vaga.itemId) === null) return recusa(progresso, mochila, 'sem_peso')
  if (progresso.bandeja.length >= BANDEJA_MAX) return recusa(progresso, mochila, 'bandeja_cheia')
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.mochila = semUmaDaVaga(a.mochila, vaga.id)
  a.progresso.bandeja.push({ vaga: vagaPosta(vaga), por: { ...contexto.quem } })
  return fim(a)
}

function tirarDaBandeja(puzzle: Puzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], contexto: ContextoDoMotor): ResultadoDoMotor {
  if (puzzle.troca === null) return recusa(progresso, mochila, 'mudou')
  if (progresso.trocaFeita) return recusa(progresso, mochila, 'troca_feita')
  if (progresso.bandeja.length === 0) return recusa(progresso, mochila, 'vazio')
  const a = andamento(puzzle, progresso, mochila, contexto)
  const ultima = a.progresso.bandeja.pop()
  if (ultima !== undefined) devolver(a, ultima)
  return fim(a)
}

function trocar(puzzle: Puzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], contexto: ContextoDoMotor): ResultadoDoMotor {
  const troca = puzzle.troca
  if (troca === null) return recusa(progresso, mochila, 'mudou')
  if (progresso.trocaFeita) return recusa(progresso, mochila, 'troca_feita')
  const soma = somaDaBandeja(troca, progresso.bandeja)
  if (soma !== troca.peso) {
    // Bandeja vazia também é erro (v1): tirar a joia sem nada no lugar faz o pedestal subir de estalo.
    const a = andamento(puzzle, progresso, mochila, contexto)
    errar(a, { tipo: 'errou', em: 'peso', soma, pedido: troca.peso })
    return fim(a)
  }
  // A peça guardada vem do acervo; se o mestre a apagou, a troca não acontece (as pedras ficam e voltam).
  const guardada = contexto.pecaDoAcervo(troca.guarda)
  if (guardada === null) return recusa(progresso, mochila, 'mudou')
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.trocaFeita = true
  receber(a, { ...guardada, itemId: troca.guarda }, idLivre(a, contexto.novoId()))
  a.efeitos.push({ tipo: 'trocou', guarda: troca.guarda })
  return fim(a)
}

// ------------------------------------------------------------------ conferir, errar, resolver

/** Depois de pôr: com tudo cheio, a Ordem certa confere a ordem; o resto resolve. Sem encaixe nunca resolve (v2). */
function conferir(a: Andamento): void {
  const { puzzle, progresso } = a
  if (puzzle.encaixes.length === 0 || !puzzle.encaixes.every((encaixe) => encaixeCheio(encaixe, progresso))) return
  if (puzzle.regra === 'ordem' && !puzzle.encaixes.every((encaixe) => naOrdem(encaixe, progresso))) {
    errar(a, { tipo: 'errou', em: 'ordem' })
    return
  }
  resolver(a)
}

/** Resolvido por quem agiu; no jogo, o desfecho vai para ele (no teste, nada é entregue). */
function resolver(a: Andamento): void {
  const { puzzle } = a
  a.progresso.resolvido = { por: a.contexto.quem.nome, em: a.contexto.agora }
  a.efeitos.push({ tipo: 'resolveu' })
  if (a.contexto.modo === 'jogo') {
    const desfecho = structuredClone(puzzle.desfecho)
    // A porta só abre com um visual que é porta, mesmo que o arquivo diga outra coisa.
    desfecho.abrePorta = desfecho.abrePorta && visualEhPorta(puzzle.visual)
    a.efeitos.push({ tipo: 'entregar', para: a.contexto.quem, desfecho })
  }
}

/** Na Ordem certa, cada encaixe de peça tem a dele; as metades estão sempre no lugar delas. */
function naOrdem(encaixe: EncaixeDoPuzzle, progresso: ProgressoDoPuzzle): boolean {
  if (encaixe.jeito === 'metades') return true
  const posta = postaEm(progresso, encaixe.id)
  return posta !== null && 'vaga' in posta && encaixe.itemId !== null && posta.vaga.itemId === encaixe.itemId
}

function errar(a: Andamento, efeito: Extract<EfeitoDoPuzzle, { tipo: 'errou' }>): void {
  a.progresso.erros += 1
  a.efeitos.push(efeito)
  const castigo = a.puzzle.castigo
  if (a.contexto.modo === 'jogo' && castigo.tipo !== 'nada') a.efeitos.push({ tipo: 'castigar', para: a.contexto.quem, castigo: structuredClone(castigo) })
}

// ------------------------------------------------------------------ a mochila

/** A vaga como fica no puzzle: uma unidade, e apagada (largar ou dar o item não leva o aceso). */
function vagaPosta(vaga: CarriedItem): CarriedItem {
  const { quantidade: _daPilha, acesa: _acesa, ...umaSo } = structuredClone(vaga)
  return umaSo
}

/** Tira uma unidade da vaga; a que chega a zero sai. */
function semUmaDaVaga(mochila: CarriedItem[], vagaId: string): CarriedItem[] {
  return mochila.flatMap((vaga) => {
    if (vaga.id !== vagaId) return [vaga]
    const resta = quantidadeDe(vaga) - 1
    if (resta < 1) return []
    const { quantidade: _antes, ...semQuantidade } = vaga
    return [resta > 1 ? { ...semQuantidade, quantidade: resta } : semQuantidade]
  })
}

/** A peça volta para quem a pôs: na mochila de quem age, ou num efeito para a ficha da outra pessoa. */
function devolver(a: Andamento, posta: PecaPosta): void {
  if (!mesmaPessoa(posta.por, a.contexto.quem)) {
    a.efeitos.push({ tipo: 'devolver', para: posta.por, vaga: posta.vaga })
    return
  }
  receber(a, posta.vaga, idLivre(a, posta.vaga.id))
}

/**
 * Põe uma unidade na mochila de quem age, pela regra de pilha do acervo
 * (`mochilaComItemDoAcervo`): o empilhável soma na vaga que já existe. A pilha
 * no teto não pode engolir a peça: ela abre vaga própria.
 */
function receber(a: Andamento, item: Omit<CarriedItem, 'id'>, idDaVaga: string): void {
  const recebeu = mochilaComItemDoAcervo(a.mochila, item, 1, idDaVaga)
  if (recebeu !== null && recebeu.entraram > 0) {
    a.mochila = recebeu.mochila
    return
  }
  const { quantidade: _daPilha, acesa: _acesa, ...umaSo } = item
  a.mochila = [...a.mochila, { ...umaSo, id: idDaVaga }]
}

/** O id de antes, se ninguém na mochila o usa; senão, um novo. */
function idLivre(a: Andamento, preferido: string): string {
  let id = preferido
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_ID_LIVRE && a.mochila.some((vaga) => vaga.id === id); tentativa++) id = a.contexto.novoId()
  return id
}
