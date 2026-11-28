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
import { acionadosNoProgresso, comAcionamento, cooperacaoDoPuzzle, todosAcesos } from './cooperacao/cooperacao'
import { alinhadas, errosNoProgresso, girarAneis, giratoriasDoPuzzle } from './giratorias/giratorias'
import { batemComOAlvo, interruptoresDoPuzzle, luzesNoProgresso, puxar } from './interruptores/interruptores'
import { AGUA, aindaDaReceita, bateComOAlvo, cabeIngrediente, comecoDaMistura, despejo, idsPostos, ingredientesPerdidos, misturaDoPuzzle, misturaNoProgresso, partesVazias, total } from './mistura/mistura'
import { camadasDoPuzzle, giroAoPousar, girado, mesaCerta, mesaNoProgresso } from './camadas/camadas'
import { comUltima, deslizantesDoPuzzle, deslizar, tabuleiroCerto, tabuleiroNoProgresso } from './deslizantes/deslizantes'
import { puzzleAbrePorta } from './padroes'
import { BANDEJA_MAX } from './tipos'
import type {
  AcaoNoPuzzle,
  CamadasDoPuzzle,
  CamadasNoProgresso,
  DeslizantesDoPuzzle,
  CombinacaoDoPuzzle,
  ContextoDoMotor,
  CooperacaoDoPuzzle,
  EfeitoDoPuzzle,
  EncaixeDoPuzzle,
  GiratoriasDoPuzzle,
  InterruptoresDoPuzzle,
  MetadesPostas,
  MisturaDoPuzzle,
  MotivoDaRecusa,
  PecaPosta,
  ProgressoDoPuzzle,
  Puzzle,
  QuemMexe,
  RecipienteNoProgresso,
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
  // Nas peças giratórias e nos interruptores também: o medalhão e o painel não têm encaixe.
  const encaixes = combinacaoDoPuzzle(puzzle) === null && giratoriasDoPuzzle(puzzle) === null && interruptoresDoPuzzle(puzzle) === null && cooperacaoDoPuzzle(puzzle) === null && misturaDoPuzzle(puzzle) === null && deslizantesDoPuzzle(puzzle) === null ? puzzle.encaixes : []
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
  // Os ingredientes da mistura de líquidos também (os de uma bancada resolvida ficam no recipiente, como a peça presa).
  const nosRecipientes = (progresso.mistura ?? []).flatMap((recipiente) => recipiente.itens)
  return [...nosEncaixes, ...progresso.bandeja, ...nosRecipientes]
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
  const giratorias = giratoriasDoPuzzle(puzzle)
  const interruptores = interruptoresDoPuzzle(puzzle)
  const cooperacao = cooperacaoDoPuzzle(puzzle)
  const mistura = misturaDoPuzzle(puzzle)
  const camadas = camadasDoPuzzle(puzzle)
  const deslizantes = deslizantesDoPuzzle(puzzle)
  // Na combinação, nas peças giratórias, nos interruptores, na cooperação, na mistura e no tabuleiro deslizante os encaixes não aparecem: o pedido é de uma tela de antes da troca de mecânica.
  const semEncaixes = combinacao !== null || giratorias !== null || interruptores !== null || cooperacao !== null || mistura !== null || deslizantes !== null
  // O medalhão, o painel, os pontos da cooperação, a bancada, a mesa de luz e o tabuleiro também não têm a troca de peso (o recorte não a manda).
  const semTroca = giratorias !== null || interruptores !== null || cooperacao !== null || mistura !== null || camadas !== null || deslizantes !== null
  switch (acao.tipo) {
    case 'deslizar':
      return deslizantes === null ? recusa(progresso, mochila, 'mudou') : deslizarPeca(puzzle, deslizantes, progresso, mochila, acao.peca, contexto)
    case 'por':
      // Na mesa de luz a lâmina vai pela pilha (`empilhar`): o host acha o encaixe dela.
      return semEncaixes || camadas !== null ? recusa(progresso, mochila, 'mudou') : por(puzzle, progresso, mochila, acao, contexto)
    case 'tirar':
      if (camadas !== null) return tirarLamina(puzzle, camadas, progresso, mochila, acao.encaixeId, contexto)
      return semEncaixes ? recusa(progresso, mochila, 'mudou') : tirar(puzzle, progresso, mochila, acao.encaixeId, contexto)
    case 'empilhar':
      return camadas === null ? recusa(progresso, mochila, 'mudou') : empilhar(puzzle, camadas, progresso, mochila, acao.vagaId, contexto)
    case 'girarLamina':
      return camadas === null ? recusa(progresso, mochila, 'mudou') : girarLamina(puzzle, camadas, progresso, mochila, acao, contexto)
    case 'moverLamina':
      return camadas === null ? recusa(progresso, mochila, 'mudou') : moverLamina(puzzle, camadas, progresso, mochila, acao, contexto)
    case 'porNaBandeja':
      return semTroca ? recusa(progresso, mochila, 'mudou') : porNaBandeja(puzzle, progresso, mochila, acao.vagaId, contexto)
    case 'tirarDaBandeja':
      return semTroca ? recusa(progresso, mochila, 'mudou') : tirarDaBandeja(puzzle, progresso, mochila, contexto)
    case 'trocar':
      return semTroca ? recusa(progresso, mochila, 'mudou') : trocar(puzzle, progresso, mochila, contexto)
    case 'girar':
      return giratorias !== null ? girarAnel(puzzle, giratorias, progresso, mochila, acao, contexto) : girar(puzzle, combinacao, progresso, mochila, acao, contexto)
    case 'ponteiro':
      return ponteiro(puzzle, combinacao, progresso, mochila, acao.minutos, contexto)
    case 'apertar':
      if (cooperacao !== null) return acionarPonto(puzzle, cooperacao, progresso, mochila, acao.botao, contexto)
      return interruptores !== null ? puxarAlavanca(puzzle, interruptores, progresso, mochila, acao.botao, contexto) : apertar(puzzle, combinacao, progresso, mochila, acao.botao, contexto)
    case 'tentar':
      return tentar(puzzle, combinacao, progresso, mochila, contexto)
    case 'despejar':
      return mistura === null ? recusa(progresso, mochila, 'mudou') : despejar(puzzle, mistura, progresso, mochila, acao, contexto)
    case 'deitar':
      return mistura === null ? recusa(progresso, mochila, 'mudou') : deitar(puzzle, mistura, progresso, mochila, acao, contexto)
    case 'recomecar':
      return mistura === null ? recusa(progresso, mochila, 'mudou') : recomecarBancada(puzzle, mistura, progresso, mochila, contexto)
  }
}

// ------------------------------------------------------------------ sobrepor camadas

/**
 * A lâmina da mochila vai para o alto da pilha, no encaixe dela (o host acha
 * qual pelo item; a tela não sabe). Pousa com o giro dela. O host confere a
 * cada mexida: tudo na mesa, de pé e na ordem resolve. Nada aqui é erro, então
 * nunca castiga.
 */
function empilhar(puzzle: Puzzle, camadas: CamadasDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], vagaId: string, contexto: ContextoDoMotor): ResultadoDoMotor {
  const vaga = mochila.find((v) => v.id === vagaId)
  if (vaga === undefined) return recusa(progresso, mochila, 'sem_vaga')
  const itemId = vaga.itemId
  const dela = itemId === undefined ? [] : puzzle.encaixes.filter((e): e is EncaixeDePeca => e.jeito === 'peca' && e.itemId === itemId)
  if (dela.length === 0) return recusa(progresso, mochila, 'nao_e_lamina')
  const livre = dela.find((e) => postaEm(progresso, e.id) === null)
  if (livre === undefined) return recusa(progresso, mochila, 'lamina_repetida')
  const a = andamento(puzzle, progresso, mochila, contexto)
  const mesa = mesaNoProgresso(puzzle, camadas, a.progresso)
  a.mochila = semUmaDaVaga(a.mochila, vaga.id)
  a.progresso.encaixes[livre.id] = { vaga: vagaPosta(vaga), por: { ...contexto.quem } }
  a.progresso.camadas = { pilha: [...mesa.pilha, livre.id], giros: { ...mesa.giros, [livre.id]: giroAoPousar(puzzle, camadas, livre.id) } }
  conferirMesa(a, camadas)
  return fim(a)
}

function conferirMesa(a: Andamento, camadas: CamadasDoPuzzle): void {
  if (mesaCerta(a.puzzle, camadas, mesaNoProgresso(a.puzzle, camadas, a.progresso))) resolver(a)
}

/** A lâmina na mesa (o pedido vem da rede: o encaixe tem de existir e a lâmina, estar na pilha). */
function laminaNaMesa(puzzle: Puzzle, camadas: CamadasDoPuzzle, progresso: ProgressoDoPuzzle, encaixeId: string, passo: number): { mesa: CamadasNoProgresso; motivo: MotivoDaRecusa | null } {
  const mesa = mesaNoProgresso(puzzle, camadas, progresso)
  if ((passo !== 1 && passo !== -1) || !puzzle.encaixes.some((e) => e.id === encaixeId)) return { mesa, motivo: 'mudou' }
  return { mesa, motivo: mesa.pilha.includes(encaixeId) ? null : 'vazio' }
}

/** Um quarto de volta na lâmina (só quando o giro importa: senão ela só assenta de pé). */
function girarLamina(puzzle: Puzzle, camadas: CamadasDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], acao: Extract<AcaoNoPuzzle, { tipo: 'girarLamina' }>, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (!camadas.rotacaoImporta) return recusa(progresso, mochila, 'mudou')
  const { mesa, motivo } = laminaNaMesa(puzzle, camadas, progresso, acao.encaixeId, acao.passo)
  if (motivo !== null) return recusa(progresso, mochila, motivo)
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.camadas = { pilha: mesa.pilha, giros: { ...mesa.giros, [acao.encaixeId]: girado(mesa.giros[acao.encaixeId] ?? 0, acao.passo) } }
  conferirMesa(a, camadas)
  return fim(a)
}

/** A lâmina troca de lugar com a de cima (+1) ou a de baixo (-1) (só quando a ordem importa). */
function moverLamina(puzzle: Puzzle, camadas: CamadasDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], acao: Extract<AcaoNoPuzzle, { tipo: 'moverLamina' }>, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (!camadas.ordemImporta) return recusa(progresso, mochila, 'mudou')
  const { mesa, motivo } = laminaNaMesa(puzzle, camadas, progresso, acao.encaixeId, acao.passo)
  if (motivo !== null) return recusa(progresso, mochila, motivo)
  const i = mesa.pilha.indexOf(acao.encaixeId)
  const j = i + acao.passo
  const vizinha = mesa.pilha[j]
  if (vizinha === undefined) return recusa(progresso, mochila, 'mudou')
  const pilha = [...mesa.pilha]
  pilha[i] = vizinha
  pilha[j] = acao.encaixeId
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.camadas = { pilha, giros: mesa.giros }
  conferirMesa(a, camadas)
  return fim(a)
}

/** Tirar da mesa: a lâmina volta a quem a pôs (o "tirar" de sempre) e sai da pilha. */
function tirarLamina(puzzle: Puzzle, camadas: CamadasDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], encaixeId: string, contexto: ContextoDoMotor): ResultadoDoMotor {
  const resultado = tirar(puzzle, progresso, mochila, encaixeId, contexto)
  if (resultado.efeitos.some((efeito) => efeito.tipo === 'recusado')) return resultado
  resultado.progresso.camadas = mesaNoProgresso(puzzle, camadas, resultado.progresso)
  return resultado
}

// ------------------------------------------------------------------ a mistura de líquidos

/** O índice de um recipiente da bancada (o pedido vem da rede). */
function ehRecipiente(valor: unknown, mistura: MisturaDoPuzzle): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor < mistura.recipientes.length
}

/**
 * A bancada no andamento: o que cada recipiente tem. Se o mestre mudou a
 * bancada e o guardado não cabe mais, os ingredientes dele voltam a quem os pôs.
 */
function bancada(a: Andamento, mistura: MisturaDoPuzzle): RecipienteNoProgresso[] {
  for (const posta of ingredientesPerdidos(a.progresso, mistura)) devolver(a, posta)
  return misturaNoProgresso(a.progresso, mistura)
}

/** Esvazia o recipiente `i` na pia: o líquido some e cada ingrediente volta a quem o pôs. */
function esvaziarNaPia(a: Andamento, recipientes: RecipienteNoProgresso[], i: number): void {
  for (const posta of recipientes[i]?.itens ?? []) devolver(a, posta)
  recipientes[i] = { partes: partesVazias(), itens: [], turvo: false }
}

/**
 * Levar um recipiente (ou a água da torneira) até outro lugar. O host confere
 * o receptáculo a cada vez: o alvo certo resolve; o errado castiga e, pelo
 * `aoErrar`, derrama o que foi posto ou faz a bancada voltar ao começo.
 */
function despejar(puzzle: Puzzle, mistura: MisturaDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], acao: Extract<AcaoNoPuzzle, { tipo: 'despejar' }>, contexto: ContextoDoMotor): ResultadoDoMotor {
  const { de, para } = acao
  if (de === 'fonte' ? !mistura.fonte || !ehRecipiente(para, mistura) : !ehRecipiente(de, mistura)) return recusa(progresso, mochila, 'mudou')
  if (typeof para === 'number' && (!ehRecipiente(para, mistura) || para === de)) return recusa(progresso, mochila, 'mudou')
  const agora = misturaNoProgresso(progresso, mistura)
  const capacidade = (i: number) => mistura.recipientes[i]?.capacidade ?? 0
  const litros = (i: number) => total(agora[i]?.partes ?? [])

  if (de === 'fonte') {
    const alvo = typeof para === 'number' ? para : 0
    if (litros(alvo) >= capacidade(alvo)) return recusa(progresso, mochila, 'recipiente_cheio')
    const a = andamento(puzzle, progresso, mochila, contexto)
    const recipientes = bancada(a, mistura)
    const cheio = recipientes[alvo]
    if (cheio !== undefined) cheio.partes[AGUA] = (cheio.partes[AGUA] ?? 0) + capacidade(alvo) - total(cheio.partes)
    a.progresso.mistura = recipientes
    return fim(a)
  }

  const origem = agora[de]
  if (para === 'ralo') {
    if (origem === undefined || (litros(de) === 0 && origem.itens.length === 0)) return recusa(progresso, mochila, 'recipiente_vazio')
    const a = andamento(puzzle, progresso, mochila, contexto)
    const recipientes = bancada(a, mistura)
    esvaziarNaPia(a, recipientes, de)
    a.progresso.mistura = recipientes
    return fim(a)
  }

  if (litros(de) === 0) return recusa(progresso, mochila, 'recipiente_vazio')
  if (para === 'receptaculo') {
    const a = andamento(puzzle, progresso, mochila, contexto)
    const recipientes = bancada(a, mistura)
    const posto = recipientes[de]
    if (posto !== undefined && bateComOAlvo(posto, mistura)) {
      // O líquido desce no receptáculo; os ingredientes ficam presos (como a peça de um puzzle resolvido).
      recipientes[de] = { partes: partesVazias(), itens: posto.itens, turvo: false }
      a.progresso.mistura = recipientes
      resolver(a)
      return fim(a)
    }
    errar(a, { tipo: 'errou', em: 'mistura' })
    if (mistura.aoErrar === 'recomeca') {
      for (const recipiente of recipientes) for (const posta of recipiente.itens) devolver(a, posta)
      a.progresso.mistura = comecoDaMistura(mistura)
    } else {
      esvaziarNaPia(a, recipientes, de)
      a.progresso.mistura = recipientes
    }
    return fim(a)
  }

  // De um recipiente no outro: até a origem esvaziar ou o destino encher.
  if ((origem?.itens.length ?? 0) > 0) return recusa(progresso, mochila, 'com_ingredientes')
  if (litros(para) >= capacidade(para)) return recusa(progresso, mochila, 'recipiente_cheio')
  const a = andamento(puzzle, progresso, mochila, contexto)
  const recipientes = bancada(a, mistura)
  const saiu = recipientes[de]
  const entrou = recipientes[para]
  if (saiu === undefined || entrou === undefined) return recusa(progresso, mochila, 'mudou')
  const passou = despejo(saiu.partes, entrou.partes, capacidade(para))
  saiu.partes = passou.de
  entrou.partes = passou.para
  a.progresso.mistura = recipientes
  return fim(a)
}

/** Jogar um item da mochila num recipiente (só na receita). O que sai da receita turva a mistura, se o mestre quis. */
function deitar(puzzle: Puzzle, mistura: MisturaDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], acao: Extract<AcaoNoPuzzle, { tipo: 'deitar' }>, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (mistura.modo !== 'receita' || !ehRecipiente(acao.recipiente, mistura)) return recusa(progresso, mochila, 'mudou')
  const vaga = mochila.find((v) => v.id === acao.vagaId)
  if (vaga === undefined) return recusa(progresso, mochila, 'sem_vaga')
  // Como no encaixe: a vaga sem `itemId` (o item solto) não é ingrediente de receita nenhuma.
  if (vaga.itemId === undefined) return recusa(progresso, mochila, 'nao_encaixa')
  const agora = misturaNoProgresso(progresso, mistura)[acao.recipiente]
  if (agora === undefined || !cabeIngrediente(agora)) return recusa(progresso, mochila, 'recipiente_cheio')
  const a = andamento(puzzle, progresso, mochila, contexto)
  const recipientes = bancada(a, mistura)
  const recipiente = recipientes[acao.recipiente]
  if (recipiente === undefined) return recusa(progresso, mochila, 'mudou')
  a.mochila = semUmaDaVaga(a.mochila, vaga.id)
  recipiente.itens.push({ vaga: vagaPosta(vaga), por: { ...contexto.quem } })
  if (mistura.turvaNaHora && !aindaDaReceita(idsPostos(recipiente), mistura)) recipiente.turvo = true
  a.progresso.mistura = recipientes
  return fim(a)
}

/** A bancada volta ao começo; cada ingrediente volta a quem o pôs. Não é erro. */
function recomecarBancada(puzzle: Puzzle, mistura: MisturaDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], contexto: ContextoDoMotor): ResultadoDoMotor {
  const a = andamento(puzzle, progresso, mochila, contexto)
  for (const recipiente of bancada(a, mistura)) for (const posta of recipiente.itens) devolver(a, posta)
  a.progresso.mistura = comecoDaMistura(mistura)
  return fim(a)
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

// ------------------------------------------------------------------ as peças giratórias

/**
 * Um anel do medalhão anda um passo (com "vizinhas", os do lado também). O
 * host confere a cada giro: todos no lugar resolve. Girar nunca é erro, então
 * nunca castiga.
 */
function girarAnel(
  puzzle: Puzzle,
  giratorias: GiratoriasDoPuzzle,
  progresso: ProgressoDoPuzzle,
  mochila: readonly CarriedItem[],
  acao: Extract<AcaoNoPuzzle, { tipo: 'girar' }>,
  contexto: ContextoDoMotor,
): ResultadoDoMotor {
  if (!Number.isInteger(acao.roda) || acao.roda < 0 || acao.roda >= giratorias.aneis) return recusa(progresso, mochila, 'mudou')
  if (acao.passo !== 1 && acao.passo !== -1) return recusa(progresso, mochila, 'mudou')
  const erros = girarAneis(errosNoProgresso(progresso, giratorias), acao.roda, acao.passo, giratorias.vizinhas)
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.rotacoes = erros
  if (alinhadas(erros)) resolver(a)
  return fim(a)
}

// ------------------------------------------------------------------ as peças deslizantes

/**
 * Uma peça do tabuleiro desliza para a casa vazia. O host confere no tabuleiro
 * de AGORA que ela é vizinha da vazia (dois jogadores deslizando juntos: o
 * segundo pedido vale ou não pelo que o primeiro deixou). Conta o lance e acende
 * a peça de quem mexeu. Deslizar nunca é erro, então nunca castiga.
 */
function deslizarPeca(puzzle: Puzzle, deslizantes: DeslizantesDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], peca: number, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (!Number.isInteger(peca) || peca < 0 || peca >= deslizantes.lado * deslizantes.lado - 1) return recusa(progresso, mochila, 'mudou')
  const tabuleiro = tabuleiroNoProgresso(progresso, deslizantes)
  const casas = deslizar(tabuleiro.casas, peca, deslizantes.lado)
  if (casas === null) return recusa(progresso, mochila, 'peca_presa')
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.deslizantes = { casas, lances: tabuleiro.lances + 1, ultimas: comUltima(tabuleiro.ultimas, peca, contexto.quem) }
  if (tabuleiroCerto(casas, deslizantes)) resolver(a)
  return fim(a)
}

// ------------------------------------------------------------------ os interruptores com estado

/**
 * Uma alavanca do painel: vira o lampião dela e os ligados a ela (pela regra
 * que só o host conhece). O host confere a cada puxada: tudo como o alvo pede
 * resolve. Puxar nunca é erro, então nunca castiga.
 */
function puxarAlavanca(puzzle: Puzzle, interruptores: InterruptoresDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], alavanca: number, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (!Number.isInteger(alavanca) || alavanca < 0 || alavanca >= interruptores.quantos) return recusa(progresso, mochila, 'mudou')
  const luzes = puxar(luzesNoProgresso(progresso, interruptores), alavanca, interruptores)
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.luzes = luzes
  if (batemComOAlvo(luzes, interruptores)) resolver(a)
  return fim(a)
}

// ------------------------------------------------------------------ a cooperação em dois lugares

/**
 * Alguém aciona o ponto `ponto` (puxa a alavanca, pisa na placa, aperta o
 * botão): o lampião dele acende por `janela` segundos. No jogo, só o ponto que
 * o host conferiu (a ficha encostada no selo dele), e a mesma pessoa noutro
 * ponto solta o de antes. Todos acesos ao mesmo tempo resolve. Acionar nunca é
 * erro, então nunca castiga.
 */
function acionarPonto(puzzle: Puzzle, cooperacao: CooperacaoDoPuzzle, progresso: ProgressoDoPuzzle, mochila: readonly CarriedItem[], ponto: number, contexto: ContextoDoMotor): ResultadoDoMotor {
  if (!Number.isInteger(ponto) || ponto < 0 || ponto >= cooperacao.pontos.length) return recusa(progresso, mochila, 'mudou')
  const noJogo = contexto.modo === 'jogo'
  if (noJogo && contexto.ponto !== ponto) return recusa(progresso, mochila, 'longe')
  const antes = acionadosNoProgresso(progresso, cooperacao.pontos.length)
  const acionados = comAcionamento(antes, ponto, { em: contexto.agora, por: contexto.quem }, noJogo, mesmaPessoa)
  const a = andamento(puzzle, progresso, mochila, contexto)
  a.progresso.acionados = acionados
  if (todosAcesos(acionados, cooperacao.janela, contexto.agora)) resolver(a)
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
    desfecho.abrePorta = desfecho.abrePorta && puzzleAbrePorta(puzzle)
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
