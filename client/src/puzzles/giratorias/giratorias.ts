/**
 * AS PEÇAS GIRATÓRIAS (28/11, o 2º da `docs/design/puzzles/FILA.md`): um
 * medalhão na parede com 3 a 6 anéis em volta de um miolo fixo. Cada toque
 * gira um anel 45 graus; com "vizinhas", os dois anéis ao lado vão junto. O
 * puzzle cede quando todos param na posição certa (o desenho inteiro, ou o
 * símbolo pedido de cada anel debaixo da marca).
 *
 * Mora em `Puzzle.futuro = { tipo: 'giratorias', … }`, como a combinação: o
 * app de antes desta leva guarda o puzzle como veio ("versão mais nova").
 *
 * O PROGRESSO (`ProgressoDoPuzzle.rotacoes`) guarda o ERRO de cada anel (quantos
 * passos ele está longe da posição certa), e não a posição: assim, se o mestre
 * trocar os símbolos no meio do jogo, o que falta girar continua tendo solução.
 * Ausente = o começo, que sai da semente (`embaralho`) por giros de verdade.
 *
 * Puro: sem React, sem rede.
 */
import { ANEIS_MAX, ANEIS_MIN, ANEIS_PADRAO, CENAS_DO_RELEVO, DESENHOS_DAS_GIRATORIAS, MATERIAIS_DAS_GIRATORIAS, PASSOS_DO_GIRO, SIMBOLOS_DO_ANEL } from '../tipos'
import type { GiratoriasDoPuzzle, GiratoriasNaVista, MaterialDasGiratorias, ProgressoDoPuzzle, Puzzle, SimboloDoAnel } from '../tipos'

export const NOME_DAS_GIRATORIAS = 'Peças giratórias'

export const NOME_DO_MATERIAL: Readonly<Record<MaterialDasGiratorias, string>> = { bronze: 'Bronze', ferro: 'Ferro', prata: 'Prata velha', pedra: 'Pedra' }

export const NOME_DO_SIMBOLO_DO_ANEL: Readonly<Record<SimboloDoAnel, string>> = {
  sol: 'Sol',
  lua: 'Lua',
  estrela: 'Estrela',
  olho: 'Olho',
  peixe: 'Peixe',
  coroa: 'Coroa',
  chave: 'Chave',
  ancora: 'Âncora',
}

/** Os símbolos pedidos de todo puzzle novo, do anel de fora para dentro. */
const SIMBOLOS_PADRAO: readonly SimboloDoAnel[] = ['sol', 'chave', 'lua', 'olho', 'coroa', 'peixe']

/**
 * Cada anel começa a roda de símbolos 3 posições (135 graus) adiante do anel de
 * fora: com tudo no zero, os anéis não formam raios de símbolos iguais, que
 * pareceriam "resolvido" sem ser.
 */
export const DESLOCAMENTO_DO_ANEL = 3

/** O teto da semente (um inteiro de 31 bits, que o JSON guarda sem perda). */
const SEMENTE_MAX = 0x7fffffff

/** Quantas vezes o sorteio tenta um começo com pelo menos metade dos anéis fora do lugar. */
const TENTATIVAS_DO_EMBARALHO = 16

/** `n` dentro de `[0, tamanho)`, também para negativos. */
export function modulo(n: number, tamanho: number): number {
  return ((n % tamanho) + tamanho) % tamanho
}

/** Uma semente nova para o embaralho ("Embaralhar de novo" e todo puzzle novo). */
export function sementeNova(): number {
  return 1 + Math.floor(Math.random() * (SEMENTE_MAX - 1))
}

export function giratoriasPadrao(embaralho: number = sementeNova()): GiratoriasDoPuzzle {
  return {
    tipo: 'giratorias',
    desenho: 'cena',
    cena: 'dragao',
    imagem: null,
    material: 'bronze',
    aneis: ANEIS_PADRAO,
    simbolos: SIMBOLOS_PADRAO.slice(0, ANEIS_PADRAO),
    vizinhas: false,
    embaralho,
  }
}

// ------------------------------------------------------------------ a leitura (o `futuro` é entrada hostil)

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function umDaLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return lista.find((item) => item === valor)
}

/** Os símbolos pedidos, um por anel: o que falta ou não se lê vira o padrão daquela posição. */
function simbolosLidos(valor: unknown, aneis: number): SimboloDoAnel[] {
  const lidos: readonly unknown[] = Array.isArray(valor) ? valor : []
  return Array.from({ length: aneis }, (_, k) => umDaLista(SIMBOLOS_DO_ANEL, lidos[k]) ?? SIMBOLOS_PADRAO[k % SIMBOLOS_PADRAO.length])
}

/**
 * As peças giratórias guardadas, campo a campo (campo torto vira o padrão).
 * `null` = não são peças giratórias. `lerImagem` confere a referência de mídia
 * (o leitor do mapa passa a dele; sem ela, qualquer texto curto passa).
 */
export function lerGiratorias(valor: unknown, lerImagem: (valor: unknown) => string | null = imagemCurta): GiratoriasDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'giratorias') return null
  const aneis = typeof valor.aneis === 'number' && Number.isInteger(valor.aneis) && valor.aneis >= ANEIS_MIN && valor.aneis <= ANEIS_MAX ? valor.aneis : ANEIS_PADRAO
  const embaralho = typeof valor.embaralho === 'number' && Number.isInteger(valor.embaralho) && valor.embaralho > 0 && valor.embaralho <= SEMENTE_MAX ? valor.embaralho : 1
  return {
    tipo: 'giratorias',
    desenho: umDaLista(DESENHOS_DAS_GIRATORIAS, valor.desenho) ?? 'cena',
    cena: umDaLista(CENAS_DO_RELEVO, valor.cena) ?? 'dragao',
    imagem: lerImagem(valor.imagem),
    material: umDaLista(MATERIAIS_DAS_GIRATORIAS, valor.material) ?? 'bronze',
    aneis,
    simbolos: simbolosLidos(valor.simbolos, aneis),
    vizinhas: valor.vizinhas === true,
    embaralho,
  }
}

const IMAGEM_MAX = 200

function imagemCurta(valor: unknown): string | null {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= IMAGEM_MAX ? valor : null
}

/** As peças giratórias do puzzle; `null` = ele é de outra mecânica. */
export function giratoriasDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): GiratoriasDoPuzzle | null {
  const futuro = puzzle.futuro
  if (futuro === undefined || futuro.tipo !== 'giratorias') return null
  return lerGiratorias(futuro)
}

// ------------------------------------------------------------------ a regra

/**
 * O giro: o anel `anel` anda `passo` (+1 = sentido horário); com `vizinhas`,
 * os anéis de fora e de dentro dele andam o mesmo passo (presos pelo atrito).
 * Vale para posições e para erros (a conta é a mesma). Devolve uma cópia.
 */
export function girarAneis(giros: readonly number[], anel: number, passo: 1 | -1, vizinhas: boolean): number[] {
  return giros.map((giro, k) => (k === anel || (vizinhas && Math.abs(k - anel) === 1) ? modulo(giro + passo, PASSOS_DO_GIRO) : giro))
}

/** Todos os anéis na posição certa (erro zero). */
export function alinhadas(erros: readonly number[]): boolean {
  return erros.length > 0 && erros.every((erro) => modulo(erro, PASSOS_DO_GIRO) === 0)
}

function foraDoLugar(erros: readonly number[]): number {
  return erros.filter((erro) => modulo(erro, PASSOS_DO_GIRO) !== 0).length
}

/**
 * Com "vizinhas" e 5 anéis, nem todo erro tem volta (a matriz dos giros é
 * singular: o vetor (1, −1, 0, 1, −1) a anula). O erro tem volta quando
 * e0 − e1 + e3 − e4 é múltiplo de 8. Com 3, 4 e 6 anéis, e sem vizinhas, sempre tem.
 */
export function temVolta(erros: readonly number[], vizinhas: boolean): boolean {
  if (!vizinhas || erros.length !== 5) return true
  const [e0 = 0, e1 = 0, , e3 = 0, e4 = 0] = erros
  return modulo(e0 - e1 + e3 - e4, PASSOS_DO_GIRO) === 0
}

/** O sorteio de semente fixa (o mulberry32 do grão do quadro): o mesmo começo em todo host. */
function sorteio(semente: number): () => number {
  let s = semente >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * O começo: o erro de cada anel quando ninguém mexeu. Sai de giros de verdade
 * (cada anel girado de 0 a 7 vezes, pela regra do puzzle), então sempre tem
 * solução; pelo menos metade dos anéis começa fora do lugar.
 */
export function comecoDasGiratorias(giratorias: Pick<GiratoriasDoPuzzle, 'aneis' | 'vizinhas' | 'embaralho'>): number[] {
  const { aneis, vizinhas } = giratorias
  const proximo = sorteio(giratorias.embaralho)
  let erros: number[] = new Array<number>(aneis).fill(0)
  for (let tentativa = 0; tentativa < TENTATIVAS_DO_EMBARALHO; tentativa++) {
    erros = new Array<number>(aneis).fill(0)
    for (let anel = 0; anel < aneis; anel++) {
      const vezes = Math.floor(proximo() * PASSOS_DO_GIRO)
      for (let i = 0; i < vezes; i++) erros = girarAneis(erros, anel, 1, vizinhas)
    }
    if (foraDoLugar(erros) >= Math.ceil(aneis / 2)) return erros
  }
  return alinhadas(erros) ? girarAneis(erros, 0, 1, vizinhas) : erros
}

/** O erro de cada anel agora: o guardado, se casa com o puzzle (e tem volta); senão, o começo. */
export function errosNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'rotacoes'>, giratorias: GiratoriasDoPuzzle): number[] {
  const guardados = progresso.rotacoes
  if (guardados !== undefined && guardados.length === giratorias.aneis && guardados.every((n) => Number.isInteger(n))) {
    const erros = guardados.map((n) => modulo(n, PASSOS_DO_GIRO))
    if (temVolta(erros, giratorias.vizinhas)) return erros
  }
  return comecoDasGiratorias(giratorias)
}

/** A posição certa de cada anel: no desenho, o zero; nos símbolos, a do símbolo pedido. */
export function alvosDasGiratorias(giratorias: Pick<GiratoriasDoPuzzle, 'desenho' | 'aneis' | 'simbolos'>): number[] {
  return Array.from({ length: giratorias.aneis }, (_, k) => {
    if (giratorias.desenho !== 'simbolos') return 0
    const simbolo = giratorias.simbolos[k] ?? SIMBOLOS_DO_ANEL[0]
    return modulo(SIMBOLOS_DO_ANEL.indexOf(simbolo) + k * DESLOCAMENTO_DO_ANEL, PASSOS_DO_GIRO)
  })
}

/** O símbolo debaixo da marca, com o anel `anel` na posição `giro`. */
export function simboloNaMarca(giro: number, anel: number): SimboloDoAnel {
  return SIMBOLOS_DO_ANEL[modulo(giro - anel * DESLOCAMENTO_DO_ANEL, PASSOS_DO_GIRO)] ?? SIMBOLOS_DO_ANEL[0]
}

/** Quantos anéis já estão na posição certa (só para o mestre: na tela do jogador seria uma dica). */
export function aneisNoLugar(giratorias: GiratoriasDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'rotacoes'>): number {
  return errosNoProgresso(progresso, giratorias).filter((erro) => erro === 0).length
}

/** O medalhão para o jogador, por lista branca: onde cada anel está, nunca onde ele deveria estar. */
export function giratoriasNaVista(giratorias: GiratoriasDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'rotacoes'>): GiratoriasNaVista {
  const alvos = alvosDasGiratorias(giratorias)
  const erros = errosNoProgresso(progresso, giratorias)
  return {
    desenho: giratorias.desenho,
    cena: giratorias.desenho === 'cena' ? giratorias.cena : null,
    imagem: giratorias.desenho === 'imagem' ? giratorias.imagem : null,
    material: giratorias.material,
    giros: erros.map((erro, k) => modulo((alvos[k] ?? 0) + erro, PASSOS_DO_GIRO)),
    vizinhas: giratorias.vizinhas,
  }
}

/** As posições de cada anel resolvido (o editor mostra "como fica resolvido"). */
export function girosResolvidos(giratorias: GiratoriasDoPuzzle): number[] {
  return alvosDasGiratorias(giratorias)
}
