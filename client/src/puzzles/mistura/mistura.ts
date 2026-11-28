/**
 * A MISTURA DE LÍQUIDOS (28/11, o 5º da `docs/design/puzzles/FILA.md`): uma
 * bancada de vidro e latão com 2 a 5 recipientes, uma pia com torneira e um
 * receptáculo. Levar um recipiente até outro despeja até um esvaziar ou o outro
 * encher; até a torneira, enche de água; até a pia, esvazia; até o receptáculo,
 * confere o alvo do modo (os litros, a cor ou a receita).
 *
 * Mora em `Puzzle.futuro = { tipo: 'mistura', … }`, como a cooperação.
 *
 * As contas são em litros inteiros. Cada recipiente guarda as `partes` de cada
 * líquido (na ordem de `LIQUIDOS_DA_MISTURA`); despejar uma mistura leva a
 * mesma proporção, com o litro que sobra da divisão indo aos maiores restos
 * (empate: a ordem dos líquidos), então a conta é a mesma em todo host.
 *
 * O PROGRESSO (`ProgressoDoPuzzle.mistura`) guarda o que cada recipiente tem.
 * Ausente = o começo (o que o mestre pôs em cada um). Se o mestre mudar a
 * bancada no meio do jogo e o guardado não couber mais, ela volta ao começo.
 *
 * Puro: sem React, sem rede.
 */
import {
  AO_ERRAR_NA_MISTURA,
  CAPACIDADE_MAX,
  CAPACIDADE_MIN,
  INGREDIENTES_MAX,
  ITENS_NO_RECIPIENTE_MAX,
  LIQUIDOS_DA_MISTURA,
  MATERIAIS_DOS_INTERRUPTORES,
  MODOS_DA_MISTURA,
  NOME_DO_INGREDIENTE_MAX,
  RECIPIENTES_MAX,
  RECIPIENTES_MIN,
} from '../tipos'
import type {
  AlvoDaMisturaNaVista,
  AoErrarNaMistura,
  IngredienteDaMistura,
  LiquidoDaMistura,
  MisturaDoPuzzle,
  MisturaNaVista,
  ModoDaMistura,
  PecaPosta,
  ProgressoDoPuzzle,
  Puzzle,
  RecipienteDaMistura,
  RecipienteNoProgresso,
} from '../tipos'

export const NOME_DA_MISTURA = 'Mistura de líquidos'

export const NOME_DO_MODO: Readonly<Record<ModoDaMistura, string>> = { volumes: 'Medir volumes', cores: 'Misturar cores', receita: 'Seguir a receita' }

export const NOME_DO_LIQUIDO: Readonly<Record<LiquidoDaMistura, string>> = { agua: 'Água', vermelho: 'Vermelho', amarelo: 'Amarelo', azul: 'Azul', branco: 'Branco' }

export const NOME_DO_AO_ERRAR: Readonly<Record<AoErrarNaMistura, string>> = { derrama: 'Derrama o que pôs', recomeca: 'Estraga tudo: recomeça' }

/** O índice da água nas `partes`. */
export const AGUA = 0
const LIQUIDOS = LIQUIDOS_DA_MISTURA.length
/** O alvo de cor mais "grosso" que o leitor aceita (partes de um líquido, já na menor proporção). */
const PARTE_DA_COR_MAX = CAPACIDADE_MAX * RECIPIENTES_MAX

export function misturaPadrao(): MisturaDoPuzzle {
  return {
    tipo: 'mistura',
    modo: 'volumes',
    material: 'latao',
    recipientes: [
      { capacidade: 3, comeca: null, quanto: 0 },
      { capacidade: 5, comeca: null, quanto: 0 },
    ],
    fonte: true,
    litros: 4,
    cor: [0, 1, 1, 0, 0],
    ingredientes: [],
    emOrdem: false,
    turvaNaHora: true,
    aoErrar: 'derrama',
    alvoNaPlaqueta: true,
  }
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

function recipienteLido(valor: unknown, modo: ModoDaMistura): RecipienteDaMistura | null {
  if (!isRecord(valor)) return null
  const capacidade = inteiroEntre(valor.capacidade, CAPACIDADE_MIN, CAPACIDADE_MAX)
  if (capacidade === null) return null
  const quanto = inteiroEntre(valor.quanto, 0, capacidade) ?? 0
  // Nos volumes e na receita só há água; nas cores, o que o mestre pôs.
  const lido = umDaLista(LIQUIDOS_DA_MISTURA, valor.comeca) ?? null
  const comeca = quanto === 0 || lido === null ? null : modo === 'cores' ? lido : 'agua'
  return { capacidade, comeca, quanto: comeca === null ? 0 : quanto }
}

function ingredienteLido(valor: unknown): IngredienteDaMistura | null {
  if (!isRecord(valor) || typeof valor.itemId !== 'string' || valor.itemId === '' || valor.itemId.length > 200) return null
  const nome = typeof valor.nome === 'string' && valor.nome.trim() !== '' ? valor.nome.trim().slice(0, NOME_DO_INGREDIENTE_MAX) : 'Ingrediente'
  return { itemId: valor.itemId, nome }
}

function corLida(valor: unknown): number[] {
  const lida: readonly unknown[] = Array.isArray(valor) ? valor : []
  const cor = Array.from({ length: LIQUIDOS }, (_, i) => inteiroEntre(lida[i], 0, PARTE_DA_COR_MAX) ?? 0)
  return total(cor) === 0 ? [0, 1, 1, 0, 0] : menorProporcao(cor)
}

/**
 * A mistura guardada, campo a campo (campo torto vira o padrão).
 * `null` = não é mistura.
 */
export function lerMistura(valor: unknown): MisturaDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'mistura') return null
  const padrao = misturaPadrao()
  const modo = umDaLista(MODOS_DA_MISTURA, valor.modo) ?? 'volumes'
  const lidos = (Array.isArray(valor.recipientes) ? valor.recipientes : []).slice(0, RECIPIENTES_MAX).flatMap((r) => recipienteLido(r, modo) ?? [])
  const recipientes = lidos.length >= RECIPIENTES_MIN ? lidos : padrao.recipientes
  const maior = Math.max(...recipientes.map((r) => r.capacidade))
  const litrosLidos = inteiroEntre(valor.litros, 1, maior)
  const litros = modo === 'receita' && valor.litros === null ? null : (litrosLidos ?? Math.min(padrao.litros ?? 1, maior))
  const ingredientes = (Array.isArray(valor.ingredientes) ? valor.ingredientes : []).slice(0, INGREDIENTES_MAX).flatMap((i) => ingredienteLido(i) ?? [])
  return {
    tipo: 'mistura',
    modo,
    material: umDaLista(MATERIAIS_DOS_INTERRUPTORES, valor.material) ?? 'latao',
    recipientes,
    // Nas cores a torneira traria água sem fim: a proporção perderia o sentido.
    fonte: modo !== 'cores' && valor.fonte !== false,
    litros,
    cor: corLida(valor.cor),
    ingredientes,
    emOrdem: valor.emOrdem === true,
    turvaNaHora: valor.turvaNaHora !== false,
    aoErrar: umDaLista(AO_ERRAR_NA_MISTURA, valor.aoErrar) ?? 'derrama',
    alvoNaPlaqueta: valor.alvoNaPlaqueta !== false,
  }
}

/** A mistura do puzzle; `null` = ele é de outra mecânica. */
export function misturaDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): MisturaDoPuzzle | null {
  const futuro = puzzle.futuro
  if (futuro === undefined || futuro.tipo !== 'mistura') return null
  return lerMistura(futuro)
}

// ------------------------------------------------------------------ as contas dos litros

export function total(partes: readonly number[]): number {
  return partes.reduce((soma, p) => soma + p, 0)
}

function mdc(a: number, b: number): number {
  return b === 0 ? a : mdc(b, a % b)
}

/** A mesma proporção nos menores números (2:2 vira 1:1). */
export function menorProporcao(partes: readonly number[]): number[] {
  const divisor = partes.reduce((d, p) => mdc(d, p), 0)
  return divisor <= 1 ? [...partes] : partes.map((p) => p / divisor)
}

/** As duas misturas têm a mesma cor (a mesma proporção de cada líquido)? Vazio nunca. */
export function mesmaProporcao(a: readonly number[], b: readonly number[]): boolean {
  const sa = total(a)
  const sb = total(b)
  if (sa === 0 || sb === 0) return false
  return a.every((p, i) => p * sb === (b[i] ?? 0) * sa)
}

export function partesVazias(): number[] {
  return Array.from({ length: LIQUIDOS }, () => 0)
}

/** `litros` de um líquido só. */
export function partesDe(liquido: LiquidoDaMistura, litros: number): number[] {
  const partes = partesVazias()
  partes[LIQUIDOS_DA_MISTURA.indexOf(liquido)] = litros
  return partes
}

/**
 * `k` litros tirados de uma mistura, na proporção: cada líquido leva a parte
 * inteira dele, e o litro que sobra da divisão vai aos maiores restos.
 */
export function porcao(partes: readonly number[], k: number): number[] {
  const soma = total(partes)
  if (k >= soma) return [...partes]
  const vai = partes.map((p) => Math.floor((p * k) / soma))
  let falta = k - total(vai)
  const restos = partes.map((p, i) => ({ i, resto: (p * k) % soma })).sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (const { i } of restos) {
    if (falta <= 0) break
    if ((vai[i] ?? 0) < (partes[i] ?? 0)) {
      vai[i] = (vai[i] ?? 0) + 1
      falta -= 1
    }
  }
  return vai
}

/** Despeja `de` em `para` até um esvaziar ou o outro encher. Devolve as duas partes novas e quantos litros passaram. */
export function despejo(de: readonly number[], para: readonly number[], capacidadeDoPara: number): { de: number[]; para: number[]; litros: number } {
  const litros = Math.min(total(de), capacidadeDoPara - total(para))
  if (litros <= 0) return { de: [...de], para: [...para], litros: 0 }
  const vai = porcao(de, litros)
  return { de: de.map((p, i) => p - (vai[i] ?? 0)), para: para.map((p, i) => p + (vai[i] ?? 0)), litros }
}

// ------------------------------------------------------------------ o começo e o progresso

export function comecoDaMistura(mistura: Pick<MisturaDoPuzzle, 'recipientes'>): RecipienteNoProgresso[] {
  return mistura.recipientes.map((r) => ({ partes: r.comeca === null ? partesVazias() : partesDe(r.comeca, r.quanto), itens: [], turvo: false }))
}

/** O guardado ainda cabe nesta bancada: os mesmos recipientes, nenhum acima da capacidade, e ingredientes só na receita. */
function cabeNaBancada(guardado: readonly RecipienteNoProgresso[], mistura: MisturaDoPuzzle): boolean {
  if (guardado.length !== mistura.recipientes.length) return false
  return guardado.every((r, i) => {
    const capacidade = mistura.recipientes[i]?.capacidade ?? 0
    if (r.partes.length !== LIQUIDOS || r.partes.some((p) => !Number.isInteger(p) || p < 0) || total(r.partes) > capacidade) return false
    // Nos volumes e na receita só entra água (a torneira); a cor só nas cores.
    if (mistura.modo !== 'cores' && r.partes.some((p, j) => j !== AGUA && p > 0)) return false
    return mistura.modo === 'receita' || (r.itens.length === 0 && !r.turvo)
  })
}

/** O que cada recipiente tem agora: o guardado, se cabe na bancada; senão, o começo. */
export function misturaNoProgresso(progresso: Pick<ProgressoDoPuzzle, 'mistura'>, mistura: MisturaDoPuzzle): RecipienteNoProgresso[] {
  const guardado = progresso.mistura
  if (guardado !== undefined && cabeNaBancada(guardado, mistura)) return structuredClone(guardado)
  return comecoDaMistura(mistura)
}

/** O guardado que não cabe mais (o mestre mudou a bancada): os ingredientes dele precisam voltar a quem os pôs. */
export function ingredientesPerdidos(progresso: Pick<ProgressoDoPuzzle, 'mistura'>, mistura: MisturaDoPuzzle): PecaPosta[] {
  const guardado = progresso.mistura
  if (guardado === undefined || cabeNaBancada(guardado, mistura)) return []
  return guardado.flatMap((r) => r.itens)
}

// ------------------------------------------------------------------ a receita e o alvo

function idsDaReceita(mistura: Pick<MisturaDoPuzzle, 'ingredientes'>): string[] {
  return mistura.ingredientes.map((ingrediente) => ingrediente.itemId)
}

/** Quantas vezes cada id aparece. */
function contagem(ids: readonly string[]): Map<string, number> {
  const vezes = new Map<string, number>()
  for (const id of ids) vezes.set(id, (vezes.get(id) ?? 0) + 1)
  return vezes
}

/** Os ingredientes postos ainda podem virar a receita? Na ordem: um começo dela. Fora de ordem: nenhum a mais do que ela pede. */
export function aindaDaReceita(postos: readonly string[], mistura: Pick<MisturaDoPuzzle, 'ingredientes' | 'emOrdem'>): boolean {
  const receita = idsDaReceita(mistura)
  if (postos.length > receita.length) return false
  if (mistura.emOrdem) return postos.every((id, i) => receita[i] === id)
  const pede = contagem(receita)
  return [...contagem(postos)].every(([id, vezes]) => vezes <= (pede.get(id) ?? 0))
}

/** Os ingredientes postos são a receita inteira (na ordem, se ela pede). */
export function receitaCompleta(postos: readonly string[], mistura: Pick<MisturaDoPuzzle, 'ingredientes' | 'emOrdem'>): boolean {
  return postos.length === mistura.ingredientes.length && aindaDaReceita(postos, mistura)
}

export function idsPostos(recipiente: Pick<RecipienteNoProgresso, 'itens'>): string[] {
  return recipiente.itens.map((posta) => posta.vaga.itemId ?? '')
}

/** O recipiente posto no receptáculo cumpre o alvo? Vazio nunca. */
export function bateComOAlvo(recipiente: RecipienteNoProgresso, mistura: MisturaDoPuzzle): boolean {
  const litros = total(recipiente.partes)
  if (litros === 0) return false
  if (mistura.modo === 'volumes') return litros === mistura.litros
  if (mistura.modo === 'cores') return mesmaProporcao(recipiente.partes, mistura.cor)
  return !recipiente.turvo && receitaCompleta(idsPostos(recipiente), mistura) && (mistura.litros === null || litros === mistura.litros)
}

/** O jogador pode jogar mais um ingrediente aqui? */
export function cabeIngrediente(recipiente: Pick<RecipienteNoProgresso, 'itens'>): boolean {
  return recipiente.itens.length < ITENS_NO_RECIPIENTE_MAX
}

// ------------------------------------------------------------------ as cores (a tinta que a tela pinta)

/** A cor de cada líquido puro, em sRGB de 0 a 1. */
const CORES_DOS_LIQUIDOS: Readonly<Record<LiquidoDaMistura, readonly [number, number, number]>> = {
  agua: [0.66, 0.83, 0.88],
  vermelho: [0.71, 0.13, 0.16],
  amarelo: [0.92, 0.71, 0.13],
  azul: [0.15, 0.33, 0.67],
  branco: [0.95, 0.94, 0.9],
}
const TURVO: readonly [number, number, number] = [0.23, 0.22, 0.15]
/** Nada é preto puro: o logaritmo da média de tinta não aguenta zero. */
const PISO_DA_TINTA = 0.02

function hex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`
}

/**
 * A cor de uma mistura como tinta de verdade: a média geométrica ponderada de
 * cada canal (amarelo com azul dá verde, não cinza). Vazio = a cor da água.
 */
export function corDasPartes(partes: readonly number[]): string {
  const soma = total(partes)
  if (soma === 0) return hex(CORES_DOS_LIQUIDOS.agua)
  const canal = (c: 0 | 1 | 2) => Math.exp(partes.reduce((acc, p, i) => acc + (p / soma) * Math.log(Math.max(PISO_DA_TINTA, CORES_DOS_LIQUIDOS[LIQUIDOS_DA_MISTURA[i] ?? 'agua'][c])), 0))
  return hex([canal(0), canal(1), canal(2)])
}

/** A tinta de um ingrediente: um matiz que sai do id (o mesmo item tinge sempre igual). */
function tintaDoIngrediente(id: string): readonly [number, number, number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  const matiz = (h % 360) / 60
  const x = 1 - Math.abs((matiz % 2) - 1)
  const [r, g, b] = matiz < 1 ? [1, x, 0] : matiz < 2 ? [x, 1, 0] : matiz < 3 ? [0, 1, x] : matiz < 4 ? [0, x, 1] : matiz < 5 ? [x, 0, 1] : [1, 0, x]
  // Um tom de erva ou de pó, nunca neon: puxado para o meio.
  return [0.25 + 0.5 * r, 0.25 + 0.5 * g, 0.25 + 0.5 * b]
}

/** A cor do que está no recipiente: a tinta das partes, tingida pelos ingredientes; turvo é lama. */
export function corDoRecipiente(partes: readonly number[], ingredientes: readonly string[], turvo: boolean): string {
  if (turvo) return hex(TURVO)
  if (ingredientes.length === 0) return corDasPartes(partes)
  const base = corDasPartes(partes)
  const rgb: [number, number, number] = [parseInt(base.slice(1, 3), 16) / 255, parseInt(base.slice(3, 5), 16) / 255, parseInt(base.slice(5, 7), 16) / 255]
  const pesoDaBase = 1
  const pesoDeCada = 0.7
  const soma = pesoDaBase + pesoDeCada * ingredientes.length
  const canal = (c: 0 | 1 | 2) => Math.exp((pesoDaBase * Math.log(Math.max(PISO_DA_TINTA, rgb[c])) + ingredientes.reduce((acc, id) => acc + pesoDeCada * Math.log(Math.max(PISO_DA_TINTA, tintaDoIngrediente(id)[c])), 0)) / soma)
  return hex([canal(0), canal(1), canal(2)])
}

/** Quão opaco o líquido parece: água pura é quase transparente; tinta, cheia. */
export function opacidadeDasPartes(partes: readonly number[], comIngredientes: boolean): number {
  const soma = total(partes)
  if (soma === 0) return 0
  const agua = (partes[AGUA] ?? 0) / soma
  return comIngredientes ? 0.82 : 0.38 + 0.56 * (1 - agua)
}

// ------------------------------------------------------------------ o recorte do jogador

function alvoNaVista(mistura: MisturaDoPuzzle): AlvoDaMisturaNaVista {
  if (mistura.modo === 'volumes') return { tipo: 'litros', litros: mistura.litros ?? 1 }
  if (mistura.modo === 'cores') return { tipo: 'cor', cor: corDasPartes(mistura.cor) }
  return { tipo: 'receita', ingredientes: mistura.ingredientes.map((ingrediente) => ingrediente.nome), emOrdem: mistura.emOrdem, litros: mistura.litros }
}

/**
 * A bancada para o jogador, por lista branca: o que cada recipiente tem e o
 * alvo, só se o mestre o pôs na plaqueta. A cor vai pronta (nunca a proporção)
 * e a receita vai pelos nomes (nunca os ids do acervo).
 */
export function misturaNaVista(mistura: MisturaDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'mistura'>): MisturaNaVista {
  const agora = misturaNoProgresso(progresso, mistura)
  return {
    modo: mistura.modo,
    material: mistura.material,
    fonte: mistura.fonte,
    aoErrar: mistura.aoErrar,
    recipientes: agora.map((r, i) => ({
      capacidade: mistura.recipientes[i]?.capacidade ?? CAPACIDADE_MIN,
      partes: [...r.partes],
      itens: r.itens.map((posta) => ({ nome: posta.vaga.nome, imagem: posta.vaga.imagem ?? null, por: posta.por.nome })),
      turvo: r.turvo,
    })),
    alvo: mistura.alvoNaPlaqueta ? alvoNaVista(mistura) : null,
    // O "Recomeçar a bancada" só vale quando algo mudou (o jogador não conhece o começo, só se está nele).
    noComeco: JSON.stringify(agora) === JSON.stringify(comecoDaMistura(mistura)),
  }
}

/** "2 L, 3 L e vazio": o que a bancada tem, para o painel do mestre. */
export function textoDaBancada(mistura: MisturaDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'mistura'>): string {
  const partes = misturaNoProgresso(progresso, mistura).map((r, i) => {
    const litros = total(r.partes)
    const de = `de ${mistura.recipientes[i]?.capacidade ?? 0} L`
    if (r.turvo) return `${litros} L turvo ${de}`
    return litros === 0 ? `vazio ${de}` : `${litros} L ${de}`
  })
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}
