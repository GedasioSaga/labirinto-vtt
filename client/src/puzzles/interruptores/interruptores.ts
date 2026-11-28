/**
 * OS INTERRUPTORES COM ESTADO (28/11, o 3º da `docs/design/puzzles/FILA.md`):
 * um painel de metal na parede com 3 a 9 lampiões, cada um com a sua alavanca
 * embaixo. Puxar uma alavanca abre ou fecha o gás do lampião dela e o dos
 * ligados a ela, pela regra que o mestre escolheu: cada chama ligada acende ou
 * apaga. O puzzle cede quando os lampiões ficam como o objetivo pede (todos
 * acesos, ou igual ao desenho).
 *
 * Mora em `Puzzle.futuro = { tipo: 'interruptores', … }`, como as peças
 * giratórias: o app de antes desta leva guarda o puzzle como veio.
 *
 * As contas são de aceso e apagado (puxar duas vezes desfaz): cada alavanca é
 * uma máscara de bits dos lampiões que ela vira, e o estado do painel é outra.
 *
 * O PROGRESSO (`ProgressoDoPuzzle.luzes`) guarda o que cada lampião mostra
 * agora. Ausente = o começo, que sai da semente (`embaralho`) por puxadas de
 * verdade a partir do objetivo: sempre tem volta. Se o mestre mudar a regra ou
 * o objetivo no meio do jogo e o painel aceso deixar de ter volta, ele volta ao
 * começo.
 *
 * Puro: sem React, sem rede.
 */
import { sementeNova, sorteio } from '../giratorias/giratorias'
import { INTERRUPTORES_MAX, INTERRUPTORES_MIN, INTERRUPTORES_PADRAO, LIGACOES_DOS_INTERRUPTORES, MATERIAIS_DOS_INTERRUPTORES, OBJETIVOS_DOS_INTERRUPTORES } from '../tipos'
import type { InterruptoresDoPuzzle, InterruptoresNaVista, LigacaoDosInterruptores, MaterialDosInterruptores, ObjetivoDosInterruptores, ProgressoDoPuzzle, Puzzle } from '../tipos'

export { sementeNova }

export const NOME_DOS_INTERRUPTORES = 'Interruptores com estado'

export const NOME_DO_MATERIAL_DO_PAINEL: Readonly<Record<MaterialDosInterruptores, string>> = { latao: 'Latão', ferro: 'Ferro' }

export const NOME_DA_LIGACAO: Readonly<Record<LigacaoDosInterruptores, string>> = { vizinhos: 'Os do lado', linha: 'Linha e coluna', propria: 'Sua regra' }

export const NOME_DO_OBJETIVO: Readonly<Record<ObjetivoDosInterruptores, string>> = { todas: 'Todos acesos', desenho: 'Igual ao desenho' }

/** O teto da semente (o mesmo das peças giratórias). */
const SEMENTE_MAX = 0x7fffffff

/** Quantas vezes o sorteio tenta um começo com pelo menos duas puxadas que não se anulam. */
const TENTATIVAS_DO_EMBARALHO = 24

export function interruptoresPadrao(embaralho: number = sementeNova()): InterruptoresDoPuzzle {
  return {
    tipo: 'interruptores',
    material: 'latao',
    quantos: INTERRUPTORES_PADRAO,
    ligacao: 'vizinhos',
    ligados: Array.from({ length: INTERRUPTORES_PADRAO }, () => []),
    objetivo: 'todas',
    desenho: Array.from({ length: INTERRUPTORES_PADRAO }, (_, i) => i % 2 === 0),
    desenhoNoPainel: true,
    embaralho,
  }
}

// ------------------------------------------------------------------ a grade do painel

/**
 * Quantas colunas o painel tem: sempre fileiras cheias (5 e 7 numa fila só,
 * 4 em 2x2, 6 em 2x3, 8 em 2x4, 9 em 3x3), para "o do lado" nunca ser dúbio.
 */
export function colunasDoPainel(quantos: number): number {
  if (quantos === 4) return 2
  if (quantos === 6 || quantos === 9) return 3
  if (quantos === 8) return 4
  return quantos
}

/** A linha e a coluna do lampião `i` (ordem de leitura). */
export function lugarNoPainel(i: number, quantos: number): { linha: number; coluna: number } {
  const colunas = colunasDoPainel(quantos)
  return { linha: Math.floor(i / colunas), coluna: i % colunas }
}

// ------------------------------------------------------------------ a leitura (o `futuro` é entrada hostil)

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function umDaLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return lista.find((item) => item === valor)
}

function indiceAte(valor: unknown, tamanho: number): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor < tamanho
}

/** Os ligados de cada alavanca: só índices do painel, sem ela mesma, sem repetir, em ordem. */
function ligadosLidos(valor: unknown, quantos: number): number[][] {
  const lidos: readonly unknown[] = Array.isArray(valor) ? valor : []
  return Array.from({ length: quantos }, (_, i) => {
    const deste: readonly unknown[] = Array.isArray(lidos[i]) ? (lidos[i] as readonly unknown[]) : []
    return [...new Set(deste.filter((j): j is number => indiceAte(j, quantos) && j !== i))].sort((a, b) => a - b)
  })
}

/**
 * Os interruptores guardados, campo a campo (campo torto vira o padrão).
 * `null` = não são interruptores.
 */
export function lerInterruptores(valor: unknown): InterruptoresDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'interruptores') return null
  const quantos = typeof valor.quantos === 'number' && Number.isInteger(valor.quantos) && valor.quantos >= INTERRUPTORES_MIN && valor.quantos <= INTERRUPTORES_MAX ? valor.quantos : INTERRUPTORES_PADRAO
  const embaralho = typeof valor.embaralho === 'number' && Number.isInteger(valor.embaralho) && valor.embaralho > 0 && valor.embaralho <= SEMENTE_MAX ? valor.embaralho : 1
  const desenho: readonly unknown[] = Array.isArray(valor.desenho) ? valor.desenho : []
  return {
    tipo: 'interruptores',
    material: umDaLista(MATERIAIS_DOS_INTERRUPTORES, valor.material) ?? 'latao',
    quantos,
    ligacao: umDaLista(LIGACOES_DOS_INTERRUPTORES, valor.ligacao) ?? 'vizinhos',
    ligados: ligadosLidos(valor.ligados, quantos),
    objetivo: umDaLista(OBJETIVOS_DOS_INTERRUPTORES, valor.objetivo) ?? 'todas',
    desenho: Array.from({ length: quantos }, (_, i) => desenho[i] === true),
    desenhoNoPainel: valor.desenhoNoPainel !== false,
    embaralho,
  }
}

/** Os interruptores do puzzle; `null` = ele é de outra mecânica. */
export function interruptoresDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): InterruptoresDoPuzzle | null {
  const futuro = puzzle.futuro
  if (futuro === undefined || futuro.tipo !== 'interruptores') return null
  return lerInterruptores(futuro)
}

// ------------------------------------------------------------------ a regra

/** A alavanca `i` vira o lampião `j` (além do dela)? */
function vira(interruptores: Pick<InterruptoresDoPuzzle, 'quantos' | 'ligacao' | 'ligados'>, i: number, j: number): boolean {
  if (i === j) return true
  if (interruptores.ligacao === 'propria') return interruptores.ligados[i]?.includes(j) === true
  const a = lugarNoPainel(i, interruptores.quantos)
  const b = lugarNoPainel(j, interruptores.quantos)
  if (interruptores.ligacao === 'linha') return a.linha === b.linha || a.coluna === b.coluna
  return (a.linha === b.linha && Math.abs(a.coluna - b.coluna) === 1) || (a.coluna === b.coluna && Math.abs(a.linha - b.linha) === 1)
}

/** Os lampiões que cada alavanca vira, como máscara de bits (o bit `j` = o lampião `j`). */
export function mascarasDaRegra(interruptores: Pick<InterruptoresDoPuzzle, 'quantos' | 'ligacao' | 'ligados'>): number[] {
  return Array.from({ length: interruptores.quantos }, (_, i) => {
    let mascara = 0
    for (let j = 0; j < interruptores.quantos; j++) if (vira(interruptores, i, j)) mascara |= 1 << j
    return mascara
  })
}

/** Os lampiões que a alavanca `i` vira, em índices (o editor e o painel do mestre mostram). */
export function viradosPor(interruptores: Pick<InterruptoresDoPuzzle, 'quantos' | 'ligacao' | 'ligados'>, i: number): number[] {
  return Array.from({ length: interruptores.quantos }, (_, j) => j).filter((j) => vira(interruptores, i, j))
}

export function paraMascara(luzes: readonly boolean[]): number {
  return luzes.reduce((mascara, acesa, i) => (acesa ? mascara | (1 << i) : mascara), 0)
}

export function paraLuzes(mascara: number, quantos: number): boolean[] {
  return Array.from({ length: quantos }, (_, i) => (mascara & (1 << i)) !== 0)
}

/** A puxada: a alavanca `alavanca` vira o lampião dela e os ligados. Devolve uma cópia. */
export function puxar(luzes: readonly boolean[], alavanca: number, interruptores: Pick<InterruptoresDoPuzzle, 'quantos' | 'ligacao' | 'ligados'>): boolean[] {
  const mascara = mascarasDaRegra(interruptores)[alavanca] ?? 0
  return paraLuzes(paraMascara(luzes) ^ mascara, luzes.length)
}

/** O que precisa ficar aceso: todos, ou o desenho. */
export function alvoDosInterruptores(interruptores: Pick<InterruptoresDoPuzzle, 'quantos' | 'objetivo' | 'desenho'>): boolean[] {
  return Array.from({ length: interruptores.quantos }, (_, i) => interruptores.objetivo === 'todas' || interruptores.desenho[i] === true)
}

/**
 * Dá para chegar ao alvo a partir daqui? Eliminação de Gauss em aceso/apagado:
 * a diferença entre o painel e o alvo precisa ser uma soma de alavancas (com
 * alavancas que se repetem, nem toda diferença é).
 */
export function temVolta(diferenca: number, mascaras: readonly number[]): boolean {
  const pivos = new Map<number, number>()
  const reduzir = (valor: number): number => {
    let x = valor
    for (let bit = 30; bit >= 0 && x !== 0; bit--) {
      if ((x & (1 << bit)) === 0) continue
      const pivo = pivos.get(bit)
      if (pivo === undefined) return x
      x ^= pivo
    }
    return x
  }
  for (const mascara of mascaras) {
    const resto = reduzir(mascara)
    if (resto !== 0) pivos.set(31 - Math.clz32(resto), resto)
  }
  return reduzir(diferenca) === 0
}

/**
 * O começo: o alvo com algumas alavancas puxadas de verdade (cada uma no
 * máximo uma vez, pela regra do puzzle), então sempre tem volta. Pelo menos
 * duas puxadas, e o painel nunca começa já resolvido.
 */
export function comecoDosInterruptores(interruptores: Pick<InterruptoresDoPuzzle, 'quantos' | 'ligacao' | 'ligados' | 'objetivo' | 'desenho' | 'embaralho'>): boolean[] {
  const { quantos } = interruptores
  const mascaras = mascarasDaRegra(interruptores)
  const alvo = paraMascara(alvoDosInterruptores(interruptores))
  const proximo = sorteio(interruptores.embaralho)
  for (let tentativa = 0; tentativa < TENTATIVAS_DO_EMBARALHO; tentativa++) {
    let estado = alvo
    let puxadas = 0
    for (let i = 0; i < quantos; i++) {
      if (proximo() < 0.5) continue
      estado ^= mascaras[i] ?? 0
      puxadas += 1
    }
    if (puxadas >= 2 && estado !== alvo) return paraLuzes(estado, quantos)
  }
  // Uma puxada só sempre muda alguma coisa: a alavanca vira pelo menos o lampião dela.
  return paraLuzes(alvo ^ (mascaras[0] ?? 1), quantos)
}

/** O que cada lampião mostra agora: o guardado, se casa com o painel (e tem volta); senão, o começo. */
export function luzesNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'luzes'>, interruptores: InterruptoresDoPuzzle): boolean[] {
  const guardadas = progresso.luzes
  if (guardadas !== undefined && guardadas.length === interruptores.quantos) {
    const diferenca = paraMascara(guardadas) ^ paraMascara(alvoDosInterruptores(interruptores))
    if (temVolta(diferenca, mascarasDaRegra(interruptores))) return [...guardadas]
  }
  return comecoDosInterruptores(interruptores)
}

/** Todos os lampiões como o alvo pede. */
export function batemComOAlvo(luzes: readonly boolean[], interruptores: InterruptoresDoPuzzle): boolean {
  const alvo = alvoDosInterruptores(interruptores)
  return luzes.length === alvo.length && luzes.every((acesa, i) => acesa === alvo[i])
}

/** Quantos lampiões já estão como o alvo pede (só para o mestre). */
export function lampioesCertos(interruptores: InterruptoresDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'luzes'>): number {
  const alvo = alvoDosInterruptores(interruptores)
  return luzesNoProgresso(progresso, interruptores).filter((acesa, i) => acesa === alvo[i]).length
}

/** O painel para o jogador, por lista branca: o que cada lampião mostra, nunca quem vira quem. */
export function interruptoresNaVista(interruptores: InterruptoresDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'luzes'>): InterruptoresNaVista {
  return {
    material: interruptores.material,
    luzes: luzesNoProgresso(progresso, interruptores),
    objetivo: interruptores.objetivo,
    desenho: interruptores.objetivo === 'desenho' && interruptores.desenhoNoPainel ? [...interruptores.desenho] : null,
  }
}
