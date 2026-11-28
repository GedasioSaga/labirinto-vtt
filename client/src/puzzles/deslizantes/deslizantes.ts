/**
 * AS PEÇAS DESLIZANTES (28/11, o 7º da `docs/design/puzzles/FILA.md`): um
 * tabuleiro na parede com a figura cortada numa grade de 3 x 3 a 5 x 5 e uma
 * casa vazia. Só a peça vizinha da vazia desliza, para dentro dela. No modo
 * `figura` o puzzle cede com todas as peças no lugar; no modo `chave`, quando a
 * peça-chave chega à casa da saída (as outras são blocos lisos).
 *
 * Mora em `Puzzle.futuro = { tipo: 'deslizantes', … }`, como as peças
 * giratórias. O PROGRESSO (`ProgressoDoPuzzle.deslizantes`) guarda a peça de
 * cada casa, os lances e a última peça de cada pessoa; ausente = o começo, que
 * sai da semente por deslizadas de verdade a partir da figura pronta (então
 * sempre tem volta).
 *
 * O mínimo de lances (só para o mestre) sai de uma busca IDA* com distância de
 * Manhattan e conflito de linha, que nunca passa do mínimo de verdade; com
 * orçamento de nós, para não travar a tela: estourou, vira "pelo menos N".
 *
 * Puro: sem React, sem rede.
 */
import { sementeNova, sorteio } from '../giratorias/giratorias'
import {
  FIGURAS_DAS_DESLIZANTES,
  LADO_DAS_DESLIZANTES_MAX,
  LADO_DAS_DESLIZANTES_MIN,
  LADO_DAS_DESLIZANTES_PADRAO,
  MATERIAIS_DAS_DESLIZANTES,
  MODOS_DAS_DESLIZANTES,
  ULTIMAS_DESLIZADAS_MAX,
} from '../tipos'
import type { DeslizantesDoPuzzle, DeslizantesNaVista, DeslizantesNoProgresso, FiguraDasDeslizantes, MaterialDasDeslizantes, ModoDasDeslizantes, ProgressoDoPuzzle, Puzzle, QuemMexe } from '../tipos'

export const NOME_DAS_DESLIZANTES = 'Peças deslizantes'

export const NOME_DO_MATERIAL_DAS_DESLIZANTES: Readonly<Record<MaterialDasDeslizantes, string>> = { madeira: 'Madeira entalhada', bronze: 'Bronze' }

export const NOME_DA_FIGURA_DAS_DESLIZANTES: Readonly<Record<FiguraDasDeslizantes, string>> = {
  farol: 'Farol',
  rosa: 'Rosa dos ventos',
  chave: 'Chave antiga',
  mariposa: 'Mariposa',
  imagem: 'Imagem sua',
}

export const NOME_DO_MODO_DAS_DESLIZANTES: Readonly<Record<ModoDasDeslizantes, string>> = { figura: 'Montar a figura', chave: 'Levar a peça-chave à saída' }

/** O teto da semente (um inteiro de 31 bits, que o JSON guarda sem perda). */
const SEMENTE_MAX = 0x7fffffff
const IMAGEM_MAX = 200
/** O teto dos lances guardados (ninguém chega lá; só para o leitor não aceitar qualquer número). */
export const LANCES_MAX = 1_000_000

/** Quantas deslizadas o embaralho dá em cada lado: o 3 x 3 sai perto de 20 lances da figura. */
const DESLIZADAS_DO_EMBARALHO: Readonly<Record<number, number>> = { 3: 36, 4: 64, 5: 96 }
const TENTATIVAS_DO_EMBARALHO = 24

/** O orçamento da busca do mínimo, em nós: alguns milissegundos, nunca uma tarefa longa. */
const NOS_DA_BUSCA = 30_000
const BUSCAS_GUARDADAS = 64

export function deslizantesPadrao(embaralho: number = sementeNova()): DeslizantesDoPuzzle {
  const lado = LADO_DAS_DESLIZANTES_PADRAO
  return { tipo: 'deslizantes', modo: 'figura', material: 'madeira', figura: 'farol', imagem: null, lado, chave: 0, alvo: lado * lado - 1, embaralho }
}

/** A peça que falta (a casa vazia): a última da figura pronta. */
export function pecaVazia(lado: number): number {
  return lado * lado - 1
}

// ------------------------------------------------------------------ a leitura (o `futuro` é entrada hostil)

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function umDaLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return lista.find((item) => item === valor)
}

function inteiroEntre(valor: unknown, min: number, max: number): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= min && valor <= max ? valor : null
}

function imagemCurta(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= IMAGEM_MAX ? valor : null
}

/**
 * As peças deslizantes guardadas, campo a campo (campo torto vira o padrão).
 * `null` = não são peças deslizantes. `lerImagem` confere a referência de mídia.
 */
export function lerDeslizantes(valor: unknown, lerImagem: (valor: unknown) => string | null = imagemCurta): DeslizantesDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'deslizantes') return null
  const lado = inteiroEntre(valor.lado, LADO_DAS_DESLIZANTES_MIN, LADO_DAS_DESLIZANTES_MAX) ?? LADO_DAS_DESLIZANTES_PADRAO
  const vazia = pecaVazia(lado)
  return {
    tipo: 'deslizantes',
    modo: umDaLista(MODOS_DAS_DESLIZANTES, valor.modo) ?? 'figura',
    material: umDaLista(MATERIAIS_DAS_DESLIZANTES, valor.material) ?? 'madeira',
    figura: umDaLista(FIGURAS_DAS_DESLIZANTES, valor.figura) ?? 'farol',
    imagem: lerImagem(valor.imagem),
    lado,
    chave: inteiroEntre(valor.chave, 0, vazia - 1) ?? 0,
    alvo: inteiroEntre(valor.alvo, 0, vazia) ?? vazia,
    embaralho: inteiroEntre(valor.embaralho, 1, SEMENTE_MAX) ?? 1,
  }
}

/** As peças deslizantes do puzzle; `null` = ele é de outra mecânica. */
export function deslizantesDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): DeslizantesDoPuzzle | null {
  const futuro = puzzle.futuro
  if (futuro === undefined || futuro.tipo !== 'deslizantes') return null
  return lerDeslizantes(futuro)
}

// ------------------------------------------------------------------ a regra

/** Duas casas lado a lado (na mesma linha ou na mesma coluna, sem diagonal). */
export function casasVizinhas(a: number, b: number, lado: number): boolean {
  return Math.abs(Math.floor(a / lado) - Math.floor(b / lado)) + Math.abs((a % lado) - (b % lado)) === 1
}

/** As casas vizinhas de `casa`, em cima, à esquerda, à direita e embaixo. */
export function vizinhasDe(casa: number, lado: number): number[] {
  const linha = Math.floor(casa / lado)
  const coluna = casa % lado
  const vizinhas: number[] = []
  if (linha > 0) vizinhas.push(casa - lado)
  if (coluna > 0) vizinhas.push(casa - 1)
  if (coluna < lado - 1) vizinhas.push(casa + 1)
  if (linha < lado - 1) vizinhas.push(casa + lado)
  return vizinhas
}

/** As casas depois de `peca` deslizar para a vazia; `null` = ela não é vizinha da vazia (ou não existe). */
export function deslizar(casas: readonly number[], peca: number, lado: number): number[] | null {
  const vazia = pecaVazia(lado)
  const de = casas.indexOf(peca)
  const para = casas.indexOf(vazia)
  if (peca === vazia || de === -1 || para === -1 || !casasVizinhas(de, para, lado)) return null
  const novas = [...casas]
  novas[para] = peca
  novas[de] = vazia
  return novas
}

/** As peças que podem deslizar agora: as vizinhas da casa vazia. */
export function pecasQueDeslizam(casas: readonly number[], lado: number): number[] {
  const vazia = casas.indexOf(pecaVazia(lado))
  return vazia === -1 ? [] : vizinhasDe(vazia, lado).map((casa) => casas[casa] ?? -1)
}

/** O tabuleiro está como o modo pede: a figura inteira, ou a peça-chave na saída. */
export function tabuleiroCerto(casas: readonly number[], deslizantes: Pick<DeslizantesDoPuzzle, 'modo' | 'chave' | 'alvo'>): boolean {
  if (deslizantes.modo === 'chave') return casas[deslizantes.alvo] === deslizantes.chave
  return casas.length > 0 && casas.every((peca, casa) => peca === casa)
}

/** As peças formam uma permutação das casas do lado (cada peça uma vez). */
function ehPermutacao(casas: readonly number[], lado: number): boolean {
  const total = lado * lado
  if (casas.length !== total) return false
  const vistas = new Set<number>()
  for (const peca of casas) {
    if (!Number.isInteger(peca) || peca < 0 || peca >= total || vistas.has(peca)) return false
    vistas.add(peca)
  }
  return true
}

/**
 * A figura tem volta a partir destas casas: a paridade das inversões (somada à
 * linha da vazia contada de baixo, no lado par) é a da figura pronta. Metade das
 * arrumações não tem; o começo por deslizadas de verdade sempre tem.
 */
export function temVolta(casas: readonly number[], lado: number): boolean {
  if (!ehPermutacao(casas, lado)) return false
  const vazia = pecaVazia(lado)
  const pecas = casas.filter((peca) => peca !== vazia)
  let inversoes = 0
  for (let i = 0; i < pecas.length; i++) {
    for (let j = i + 1; j < pecas.length; j++) if ((pecas[i] ?? 0) > (pecas[j] ?? 0)) inversoes++
  }
  if (lado % 2 === 1) return inversoes % 2 === 0
  const linhaDeBaixo = lado - Math.floor(casas.indexOf(vazia) / lado)
  return (inversoes + linhaDeBaixo) % 2 === 1
}

function identidade(lado: number): number[] {
  return Array.from({ length: lado * lado }, (_, casa) => casa)
}

/** A distância de Manhattan de cada peça até a casa dela (sem a vazia). */
function manhattan(casas: ArrayLike<number>, lado: number): number {
  const vazia = pecaVazia(lado)
  let soma = 0
  for (let casa = 0; casa < casas.length; casa++) {
    const peca = casas[casa] ?? vazia
    if (peca === vazia) continue
    soma += Math.abs(Math.floor(peca / lado) - Math.floor(casa / lado)) + Math.abs((peca % lado) - (casa % lado))
  }
  return soma
}

/** O quanto o começo está longe da solução, para o embaralho não sair fácil demais. */
function distanciaDoComeco(casas: readonly number[], deslizantes: Pick<DeslizantesDoPuzzle, 'modo' | 'lado' | 'chave' | 'alvo'>): number {
  const { lado } = deslizantes
  if (deslizantes.modo === 'chave') {
    const onde = casas.indexOf(deslizantes.chave)
    return Math.abs(Math.floor(onde / lado) - Math.floor(deslizantes.alvo / lado)) + Math.abs((onde % lado) - (deslizantes.alvo % lado))
  }
  return manhattan(casas, lado)
}

/** O mínimo que o começo precisa estar longe: na figura, em Manhattan; na chave, em casas até a saída. */
function longeOBastante(deslizantes: Pick<DeslizantesDoPuzzle, 'modo' | 'lado'>): number {
  const { lado } = deslizantes
  return deslizantes.modo === 'chave' ? lado - 1 : lado * (lado + 1) - 2
}

/**
 * O começo: a figura pronta desfeita por deslizadas de verdade (sem voltar a
 * deslizada de antes), pela semente. Sempre tem volta, e fica longe o bastante
 * da solução (ou o mais longe das tentativas).
 */
export function comecoDasDeslizantes(deslizantes: Pick<DeslizantesDoPuzzle, 'modo' | 'lado' | 'chave' | 'alvo' | 'embaralho'>): number[] {
  const { lado } = deslizantes
  const vazia = pecaVazia(lado)
  const proximo = sorteio(deslizantes.embaralho)
  const deslizadas = DESLIZADAS_DO_EMBARALHO[lado] ?? lado * lado * 4
  let melhor = identidade(lado)
  let maisLonge = -1
  for (let tentativa = 0; tentativa < TENTATIVAS_DO_EMBARALHO; tentativa++) {
    const casas = identidade(lado)
    let ondeVazia = vazia
    let antes = -1
    for (let i = 0; i < deslizadas; i++) {
      const opcoes = vizinhasDe(ondeVazia, lado).filter((casa) => casa !== antes)
      const casa = opcoes[Math.floor(proximo() * opcoes.length)] ?? opcoes[0] ?? ondeVazia
      casas[ondeVazia] = casas[casa] ?? vazia
      casas[casa] = vazia
      antes = ondeVazia
      ondeVazia = casa
    }
    const distancia = tabuleiroCerto(casas, deslizantes) ? 0 : distanciaDoComeco(casas, deslizantes)
    if (distancia >= longeOBastante(deslizantes)) return casas
    if (distancia > maisLonge) {
      melhor = casas
      maisLonge = distancia
    }
  }
  return melhor
}

/** O tabuleiro de agora: o guardado, se casa com o puzzle (e tem volta); senão, o começo com zero lances. */
export function tabuleiroNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'deslizantes'>, deslizantes: DeslizantesDoPuzzle): DeslizantesNoProgresso {
  const guardado = progresso.deslizantes
  const { lado } = deslizantes
  if (guardado !== undefined && ehPermutacao(guardado.casas, lado) && (deslizantes.modo === 'chave' || temVolta(guardado.casas, lado))) {
    const vazia = pecaVazia(lado)
    return { casas: [...guardado.casas], lances: guardado.lances, ultimas: guardado.ultimas.filter((ultima) => ultima.peca >= 0 && ultima.peca < vazia) }
  }
  return { casas: comecoDasDeslizantes(deslizantes), lances: 0, ultimas: [] }
}

function mesmaPessoa(a: QuemMexe, b: QuemMexe): boolean {
  if (a.personagemId !== null && a.personagemId === b.personagemId) return true
  return a.tokenId === b.tokenId
}

/** A última peça de cada pessoa, com a de `quem` trocada por `peca` e posta no fim. */
export function comUltima(ultimas: readonly { peca: number; por: QuemMexe }[], peca: number, quem: QuemMexe): { peca: number; por: QuemMexe }[] {
  const outras = ultimas.filter((ultima) => !mesmaPessoa(ultima.por, quem))
  return [...outras, { peca, por: quem }].slice(-ULTIMAS_DESLIZADAS_MAX)
}

/** O tabuleiro resolvido, para o "Ver resolvido" do editor: a figura pronta, ou a peça-chave na saída. */
export function casasResolvidas(deslizantes: Pick<DeslizantesDoPuzzle, 'modo' | 'lado' | 'chave' | 'alvo'>): number[] {
  const casas = identidade(deslizantes.lado)
  if (deslizantes.modo !== 'chave' || deslizantes.chave === deslizantes.alvo) return casas
  const naSaida = casas[deslizantes.alvo] ?? 0
  casas[deslizantes.alvo] = deslizantes.chave
  casas[deslizantes.chave] = naSaida
  return casas
}

/** O tabuleiro para o jogador, por lista branca: onde cada peça está, nunca a semente nem o começo. */
export function deslizantesNaVista(deslizantes: DeslizantesDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'deslizantes'>): DeslizantesNaVista {
  const tabuleiro = tabuleiroNoProgresso(progresso, deslizantes)
  const chave = deslizantes.modo === 'chave'
  return {
    modo: deslizantes.modo,
    material: deslizantes.material,
    figura: deslizantes.figura,
    imagem: deslizantes.figura === 'imagem' ? deslizantes.imagem : null,
    lado: deslizantes.lado,
    casas: tabuleiro.casas,
    lances: tabuleiro.lances,
    chave: chave ? deslizantes.chave : null,
    alvo: chave ? deslizantes.alvo : null,
    ultimas: tabuleiro.ultimas.map((ultima) => ({ peca: ultima.peca, por: ultima.por.nome })),
  }
}

// ------------------------------------------------------------------ o mínimo de lances (só para o mestre)

export type MinimoDeLances = { exato: true; lances: number } | { exato: false; pelomenos: number }

/** O mínimo de lances no modo chave: busca em largura pelo par (onde a chave está, onde a vazia está). */
function minimoDaChave(casas: readonly number[], deslizantes: Pick<DeslizantesDoPuzzle, 'lado' | 'chave' | 'alvo'>): number {
  const { lado, alvo } = deslizantes
  const total = lado * lado
  const chave0 = casas.indexOf(deslizantes.chave)
  const vazia0 = casas.indexOf(pecaVazia(lado))
  if (chave0 === alvo) return 0
  const visto = new Uint8Array(total * total)
  let fronteira: number[] = [chave0 * total + vazia0]
  visto[chave0 * total + vazia0] = 1
  for (let lances = 1; fronteira.length > 0; lances++) {
    const proxima: number[] = []
    for (const estado of fronteira) {
      const chave = Math.floor(estado / total)
      const vazia = estado % total
      for (const casa of vizinhasDe(vazia, lado)) {
        // A peça da casa vizinha desliza para a vazia; se for a chave, ela anda.
        const novaChave = casa === chave ? vazia : chave
        if (novaChave === alvo) return lances
        const novo = novaChave * total + casa
        if (visto[novo] === 1) continue
        visto[novo] = 1
        proxima.push(novo)
      }
    }
    fronteira = proxima
  }
  return 0
}

/** O maior pedaço de `valores` que já está em ordem crescente (a subsequência crescente mais longa). */
function emOrdem(valores: readonly number[]): number {
  const fim: number[] = []
  for (const valor of valores) {
    let i = 0
    while (i < fim.length && (fim[i] ?? 0) < valor) i++
    fim[i] = valor
  }
  return fim.length
}

/**
 * A estimativa que nunca passa do mínimo: Manhattan mais o conflito de linha
 * (em cada linha e coluna, as peças dela que precisam trocar de ordem saem da
 * fila: 2 lances por peça que sai, contando só as que precisam sair).
 */
function estimativa(casas: ArrayLike<number>, lado: number): number {
  const vazia = pecaVazia(lado)
  let conflito = 0
  for (let k = 0; k < lado; k++) {
    const naLinha: number[] = []
    const naColuna: number[] = []
    for (let j = 0; j < lado; j++) {
      const daLinha = casas[k * lado + j] ?? vazia
      if (daLinha !== vazia && Math.floor(daLinha / lado) === k) naLinha.push(daLinha % lado)
      const daColuna = casas[j * lado + k] ?? vazia
      if (daColuna !== vazia && daColuna % lado === k) naColuna.push(Math.floor(daColuna / lado))
    }
    conflito += naLinha.length - emOrdem(naLinha) + (naColuna.length - emOrdem(naColuna))
  }
  return manhattan(casas, lado) + 2 * conflito
}

/** IDA*: o mínimo exato, ou o limite a que a busca chegou quando o orçamento acabou. */
function minimoDaFigura(inicio: readonly number[], lado: number): MinimoDeLances {
  const vazia = pecaVazia(lado)
  const casas = Int8Array.from(inicio)
  let ondeVazia = casas.indexOf(vazia)
  let nos = 0
  let achou = -1
  const ACHOU = -1
  const ESTOUROU = -2
  const buscar = (g: number, limite: number, antes: number): number => {
    const h = estimativa(casas, lado)
    if (h === 0) {
      achou = g
      return ACHOU
    }
    const f = g + h
    if (f > limite) return f
    if (++nos > NOS_DA_BUSCA) return ESTOUROU
    let menor = Number.POSITIVE_INFINITY
    for (const casa of vizinhasDe(ondeVazia, lado)) {
      if (casa === antes) continue
      const daqui = ondeVazia
      casas[daqui] = casas[casa] ?? vazia
      casas[casa] = vazia
      ondeVazia = casa
      const resultado = buscar(g + 1, limite, daqui)
      ondeVazia = daqui
      casas[casa] = casas[daqui] ?? vazia
      casas[daqui] = vazia
      if (resultado === ACHOU || resultado === ESTOUROU) return resultado
      if (resultado < menor) menor = resultado
    }
    return menor
  }
  let limite = estimativa(casas, lado)
  for (;;) {
    const resultado = buscar(0, limite, -1)
    if (resultado === ACHOU) return { exato: true, lances: achou }
    if (resultado === ESTOUROU || !Number.isFinite(resultado)) return { exato: false, pelomenos: limite }
    limite = resultado
  }
}

const buscasFeitas = new Map<string, MinimoDeLances>()

/**
 * O mínimo de lances a partir destas casas (o mestre vê na ficha e no editor).
 * Na figura de 3 x 3 sai sempre exato; nas maiores, quando a busca passa do
 * orçamento, sai "pelo menos N". Guardado por tabuleiro, para não repetir a conta.
 */
export function minimoDeLances(casas: readonly number[], deslizantes: Pick<DeslizantesDoPuzzle, 'modo' | 'lado' | 'chave' | 'alvo'>): MinimoDeLances {
  if (tabuleiroCerto(casas, deslizantes)) return { exato: true, lances: 0 }
  const chave = `${deslizantes.modo}|${deslizantes.lado}|${deslizantes.chave}|${deslizantes.alvo}|${casas.join(',')}`
  const guardada = buscasFeitas.get(chave)
  if (guardada !== undefined) return guardada
  const minimo: MinimoDeLances = deslizantes.modo === 'chave' ? { exato: true, lances: minimoDaChave(casas, deslizantes) } : minimoDaFigura(casas, deslizantes.lado)
  if (buscasFeitas.size >= BUSCAS_GUARDADAS) buscasFeitas.delete(buscasFeitas.keys().next().value ?? '')
  buscasFeitas.set(chave, minimo)
  return minimo
}

/** "faltam 12 lances" ou "faltam pelo menos 26 lances". */
export function textoDoMinimo(minimo: MinimoDeLances): string {
  const n = minimo.exato ? minimo.lances : minimo.pelomenos
  return `faltam ${minimo.exato ? '' : 'pelo menos '}${n} ${n === 1 ? 'lance' : 'lances'}`
}

/** O que a ficha do desafio mostra ao mestre: os lances feitos e quanto falta, no mínimo. */
export function textoDoTabuleiro(deslizantes: DeslizantesDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'deslizantes' | 'resolvido'>): string {
  const tabuleiro = tabuleiroNoProgresso(progresso, deslizantes)
  const feitos = `${tabuleiro.lances} ${tabuleiro.lances === 1 ? 'lance feito' : 'lances feitos'}`
  if (progresso.resolvido !== null) return `Resolvido: ${feitos}`
  return `${feitos}, ${textoDoMinimo(minimoDeLances(tabuleiro.casas, deslizantes))}`
}
