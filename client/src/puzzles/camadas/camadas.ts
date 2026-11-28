/**
 * SOBREPOR CAMADAS (28/11, o 6º da `docs/design/puzzles/FILA.md`): uma mesa de
 * luz e 2 a 5 lâminas (vidro pintado, papel vegetal ou grade de ferro). A
 * figura é cortada em cacos (uma grade de 5 x 5 com os nós tortos e algumas
 * casas partidas em dois), e cada lâmina pinta só os cacos dela. Na mesa, as
 * lâminas certas, de pé e na ordem, fecham a figura; uma lâmina torta deixa
 * buracos onde a luz passa, e, quando a ordem importa, cada lâmina tem manchas
 * sobre cacos das de cima, que só ficam tapadas na ordem certa.
 *
 * Mora em `Puzzle.futuro = { tipo: 'camadas', … }`. Os encaixes do puzzle são
 * as lâminas, um por lâmina, NA ORDEM CERTA (de baixo para cima); cada um pede
 * o item do acervo da sua lâmina (`idDoItemDaLamina`). O id do encaixe sai da
 * marca gravada na lâmina (`lamina-lua`), sorteada pela semente, então nem o
 * id nem a marca dizem a ordem.
 *
 * O PROGRESSO (`ProgressoDoPuzzle.camadas`) guarda a pilha e o giro de cada
 * lâmina posta; a peça em si fica no encaixe, como em qualquer puzzle, e volta
 * a quem a pôs pelo "tirar".
 *
 * Puro: sem React, sem rede.
 */
import { CACOS_MAX, CODIGO_DAS_CAMADAS_MAX, FIGURAS_DAS_CAMADAS, LAMINAS_MAX, LAMINAS_MIN, LAMINAS_PADRAO, MARCAS_DAS_LAMINAS, MATERIAIS_DAS_CAMADAS, NOME_DA_PECA_MAX } from '../tipos'
import type { CamadasDoPuzzle, CamadasNaVista, CamadasNoProgresso, EncaixeDoPuzzle, FiguraDasCamadas, LaminaNaVista, MarcaDaLamina, MaterialDasCamadas, ProgressoDoPuzzle, Puzzle } from '../tipos'

export const NOME_DAS_CAMADAS = 'Sobrepor camadas'

export const NOME_DO_MATERIAL_DAS_CAMADAS: Readonly<Record<MaterialDasCamadas, string>> = { vidro: 'Vidro pintado', papel: 'Papel vegetal', ferro: 'Grade de ferro' }

export const NOME_DA_FIGURA: Readonly<Record<FiguraDasCamadas, string>> = {
  farol: 'Farol na noite',
  rosa: 'Rosa dos ventos',
  chave: 'Chave antiga',
  mariposa: 'Mariposa',
  codigo: 'Código de letras e números',
  imagem: 'Imagem sua',
}

export const NOME_DA_MARCA: Readonly<Record<MarcaDaLamina, string>> = { sol: 'Sol', lua: 'Lua', estrela: 'Estrela', olho: 'Olho', coroa: 'Coroa' }
const DA_MARCA: Readonly<Record<MarcaDaLamina, string>> = { sol: 'do sol', lua: 'da lua', estrela: 'da estrela', olho: 'do olho', coroa: 'da coroa' }

export const TEXTO_DAS_CAMADAS_RESOLVIDO = 'As lâminas assentam umas nas outras e a figura acende inteira na luz da mesa. Algo destrava atrás da parede.'

const CODIGO_PADRAO = '1847'
const VOLTA = 4

// ------------------------------------------------------------------ a sorte (a mesma conta em todo host)

/** Um número do `sal` misturado à semente (murmur3, 32 bits). */
export function salgado(semente: number, sal: number): number {
  let h = (semente ^ Math.imul(sal + 0x9e3779b9, 0x85ebca6b)) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}

/** Números de 0 a 1 a partir de uma semente (mulberry32). */
function sorteador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function embaralhado<T>(lista: readonly T[], sorte: () => number): T[] {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(sorte() * (i + 1))
    const guarda = copia[i] as T
    copia[i] = copia[j] as T
    copia[j] = guarda
  }
  return copia
}

function modulo(valor: number, base: number): number {
  return ((valor % base) + base) % base
}

/** Uma semente nova para o "Cortar de novo" do editor. */
export function sementeNova(): number {
  return 1 + Math.floor(Math.random() * 0x7ffffffe)
}

// ------------------------------------------------------------------ o padrão e a leitura (o `futuro` é entrada hostil)

export function camadasPadrao(semente: number = 1847): CamadasDoPuzzle {
  return { tipo: 'camadas', material: 'vidro', figura: 'farol', codigo: CODIGO_PADRAO, imagem: null, ordemImporta: false, rotacaoImporta: true, semente }
}

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function umDaLista<T extends string>(lista: readonly T[], valor: unknown): T | undefined {
  return lista.find((item) => item === valor)
}

/** Só letras sem acento e algarismos, em maiúsculas, até `CODIGO_DAS_CAMADAS_MAX`. */
export function codigoLimpo(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  return valor
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODIGO_DAS_CAMADAS_MAX)
}

function imagemPadrao(valor: unknown): string | null {
  return typeof valor === 'string' && /^midia:[0-9a-zA-Z_-]{1,128}$/.test(valor) ? valor : null
}

/** As camadas guardadas, campo a campo (campo torto vira o padrão). `null` = não é desse tipo. */
export function lerCamadas(valor: unknown, imagemLida: (valor: unknown) => string | null = imagemPadrao): CamadasDoPuzzle | null {
  if (!isRecord(valor) || valor.tipo !== 'camadas') return null
  const semente = typeof valor.semente === 'number' && Number.isInteger(valor.semente) && valor.semente > 0 && valor.semente <= 0x7fffffff ? valor.semente : 1847
  const codigo = codigoLimpo(valor.codigo)
  return {
    tipo: 'camadas',
    material: umDaLista(MATERIAIS_DAS_CAMADAS, valor.material) ?? 'vidro',
    figura: umDaLista(FIGURAS_DAS_CAMADAS, valor.figura) ?? 'farol',
    codigo: codigo === '' ? CODIGO_PADRAO : codigo,
    imagem: imagemLida(valor.imagem),
    ordemImporta: valor.ordemImporta === true,
    rotacaoImporta: valor.rotacaoImporta !== false,
    semente,
  }
}

/** As camadas do puzzle; `null` = ele é de outra mecânica. */
export function camadasDoPuzzle(puzzle: Pick<Puzzle, 'futuro'>): CamadasDoPuzzle | null {
  const futuro = puzzle.futuro
  if (futuro === undefined || futuro.tipo !== 'camadas') return null
  return lerCamadas(futuro, (valor) => (typeof valor === 'string' && valor.startsWith('midia:') && valor.length <= 200 ? valor : null))
}

// ------------------------------------------------------------------ o corte: os cacos da figura

export type Ponto = readonly [number, number]

/** A figura mede 100 x 100 (o `viewBox` da lâmina). */
export const LADO_DA_FIGURA = 100
const GRADE = 5
const PASSO = LADO_DA_FIGURA / GRADE
/** Quanto um nó de dentro da grade pode andar, para os cacos não serem quadrados. */
const TREMOR = 6.5
/** De cada 10 casas, quantas se partem em dois triângulos. */
const PARTIDAS_EM_10 = 4

const cortes = new Map<number, Ponto[][]>()

/** A semente só da forma dos cacos (a que vai ao jogador). */
export function corteDas(camadas: Pick<CamadasDoPuzzle, 'semente'>): number {
  return salgado(camadas.semente, 11)
}

/** Os cacos do corte, cada um um polígono no quadro de 100 x 100. O mesmo corte dá sempre os mesmos cacos. */
export function cacosDoCorte(corte: number): Ponto[][] {
  const pronto = cortes.get(corte)
  if (pronto !== undefined) return pronto
  const sorte = sorteador(corte)
  const nos: Ponto[][] = []
  for (let linha = 0; linha <= GRADE; linha += 1) {
    const fila: Ponto[] = []
    for (let coluna = 0; coluna <= GRADE; coluna += 1) {
      const dentroX = coluna > 0 && coluna < GRADE
      const dentroY = linha > 0 && linha < GRADE
      const x = coluna * PASSO + (dentroX ? (sorte() - 0.5) * 2 * TREMOR : 0)
      const y = linha * PASSO + (dentroY ? (sorte() - 0.5) * 2 * TREMOR : 0)
      fila.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100])
    }
    nos.push(fila)
  }
  const cacos: Ponto[][] = []
  for (let linha = 0; linha < GRADE; linha += 1) {
    for (let coluna = 0; coluna < GRADE; coluna += 1) {
      const a = nos[linha]?.[coluna]
      const b = nos[linha]?.[coluna + 1]
      const c = nos[linha + 1]?.[coluna + 1]
      const d = nos[linha + 1]?.[coluna]
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue
      const partir = sorte() * 10 < PARTIDAS_EM_10
      if (!partir) cacos.push([a, b, c, d])
      else if (sorte() < 0.5) cacos.push([a, b, c], [a, c, d])
      else cacos.push([a, b, d], [b, c, d])
    }
  }
  const limitados = cacos.slice(0, CACOS_MAX)
  cortes.set(corte, limitados)
  return limitados
}

export interface Reparticao {
  /** Por lâmina (na ordem certa): os cacos que ela pinta. */
  cacos: number[][]
  /** Por lâmina: as manchas dela (cacos de lâminas de cima). Vazias quando a ordem não importa. */
  manchas: number[][]
}

/**
 * Quem pinta cada caco (as lâminas ficam com quase o mesmo tanto) e, quando a
 * ordem importa, as manchas: para cada par de lâminas, a de baixo tem uma
 * mancha sobre um caco da de cima. Assim qualquer par trocado mostra uma
 * mancha, e só a ordem certa fecha a figura.
 */
export function repartir(camadas: Pick<CamadasDoPuzzle, 'semente' | 'ordemImporta'>, quantas: number): Reparticao {
  const total = cacosDoCorte(corteDas(camadas)).length
  const sorte = sorteador(salgado(camadas.semente, 23))
  const ordem = embaralhado(
    Array.from({ length: total }, (_, i) => i),
    sorte,
  )
  const cacos = Array.from({ length: quantas }, (_, k) => ordem.filter((_, i) => i % quantas === k).sort((a, b) => a - b))
  const manchas: number[][] = Array.from({ length: quantas }, () => [])
  if (camadas.ordemImporta) {
    const fila = cacos.map((deCima) => embaralhado(deCima, sorte))
    for (let baixo = 0; baixo < quantas - 1; baixo += 1) {
      for (let cima = baixo + 1; cima < quantas; cima += 1) {
        const daDeCima = fila[cima] ?? []
        const caco = daDeCima[(baixo + cima) % Math.max(1, daDeCima.length)]
        if (caco !== undefined) manchas[baixo]?.push(caco)
      }
    }
  }
  return { cacos, manchas: manchas.map((lista) => [...new Set(lista)].sort((a, b) => a - b)) }
}

/** O giro de cada lâmina quando ela pousa na mesa (1 a 3 quartos de volta; 0 se o giro não importa). */
export function girosAoPousar(camadas: Pick<CamadasDoPuzzle, 'semente' | 'rotacaoImporta'>, quantas: number): number[] {
  const sorte = sorteador(salgado(camadas.semente, 37))
  return Array.from({ length: quantas }, () => (camadas.rotacaoImporta ? 1 + Math.floor(sorte() * 3) : 0))
}

/** A marca gravada em cada lâmina, na ordem certa (sorteada: a marca não diz a altura). */
export function marcasDas(camadas: Pick<CamadasDoPuzzle, 'semente'>, quantas: number): MarcaDaLamina[] {
  return embaralhado(MARCAS_DAS_LAMINAS, sorteador(salgado(camadas.semente, 31))).slice(0, quantas)
}

/** Em qual canto da lâmina a marca está gravada (0 = em cima à esquerda, no sentido do relógio); não diz o giro certo. */
export function cantoDaMarca(corte: number, marca: MarcaDaLamina): number {
  return salgado(corte, 41 + MARCAS_DAS_LAMINAS.indexOf(marca)) % VOLTA
}

// ------------------------------------------------------------------ as lâminas como itens e encaixes

/** FNV-1a de 32 bits, em base 36: o pedaço do id que muda quando a lâmina muda. */
function marcaDoConteudo(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) h = Math.imul(h ^ texto.charCodeAt(i), 0x01000193) >>> 0
  return h.toString(36)
}

/**
 * O id do item da lâmina: muda com tudo o que muda o desenho dela (a figura, o
 * material, o corte, as manchas, o giro de quando pousa e quantas são). Pôr de
 * novo cai no mesmo item.
 */
export function idDoItemDaLamina(camadas: CamadasDoPuzzle, quantas: number, marca: MarcaDaLamina): string {
  const figura = camadas.figura === 'codigo' ? `codigo:${camadas.codigo}` : camadas.figura === 'imagem' ? `imagem:${camadas.imagem ?? ''}` : camadas.figura
  const chave = marcaDoConteudo([figura, camadas.material, camadas.semente, camadas.ordemImporta ? 1 : 0, camadas.rotacaoImporta ? 1 : 0, quantas].join('|'))
  return `item_lamina_${chave}_${quantas}_${marca}`
}

/** "Vidro pintado (marca da lua)": o que distingue vem por último, mas cabe na mochila. */
export function nomeDaLamina(camadas: Pick<CamadasDoPuzzle, 'material'>, marca: MarcaDaLamina): string {
  return `${NOME_DO_MATERIAL_DAS_CAMADAS[camadas.material]} (marca ${DA_MARCA[marca]})`.slice(0, NOME_DA_PECA_MAX)
}

export function descricaoDaLamina(camadas: Pick<CamadasDoPuzzle, 'material'>): string {
  if (camadas.material === 'papel') return 'Uma folha de papel vegetal com traços soltos de tinta. Sozinha não forma nada; parece ser de uma pilha.'
  if (camadas.material === 'ferro') return 'Uma grade de ferro vazada, com vidros coloridos presos em alguns vãos. Sozinha não forma nada; parece ser de uma pilha.'
  return 'Uma lâmina de vidro pintado em pedaços, com veios de chumbo. Sozinha não forma nada; parece ser de uma pilha.'
}

/** Quantas lâminas o puzzle tem (os encaixes dele), no limite. */
export function quantasLaminas(puzzle: Pick<Puzzle, 'encaixes'>): number {
  return Math.min(LAMINAS_MAX, Math.max(LAMINAS_MIN, puzzle.encaixes.length))
}

/** Os encaixes das lâminas, na ordem certa (de baixo para cima). Sem imagem ainda, a peça certa fica por escolher. */
export function laminasDoPuzzle(camadas: CamadasDoPuzzle, quantas: number): EncaixeDoPuzzle[] {
  const n = Math.min(LAMINAS_MAX, Math.max(LAMINAS_MIN, Math.round(quantas)))
  const semImagem = camadas.figura === 'imagem' && camadas.imagem === null
  return marcasDas(camadas, n).map((marca): EncaixeDoPuzzle => ({ id: `lamina-${marca}`, x: 50, y: 50, t: 12, forma: 'quadrado', jeito: 'peca', itemId: semImagem ? null : idDoItemDaLamina(camadas, n, marca) }))
}

/** O puzzle com estas camadas e `quantas` lâminas (os encaixes saem delas; o resto do puzzle fica). */
export function comAsCamadas(puzzle: Puzzle, camadas: CamadasDoPuzzle, quantas: number = puzzle.encaixes.length): Puzzle {
  return { ...puzzle, regra: 'lugarCerto', troca: null, futuro: camadas, encaixes: laminasDoPuzzle(camadas, quantas) }
}

/** O puzzle novo da mesa de luz, a partir da base dos modelos (quem chama a dá, para não haver ciclo de import). */
export function puzzleDasCamadas(base: Puzzle, camadas: CamadasDoPuzzle = camadasPadrao(), quantas: number = LAMINAS_PADRAO): Puzzle {
  return {
    ...comAsCamadas(base, camadas, quantas),
    nome: 'Mesa de luz',
    nomePublico: camadas.figura === 'imagem' || camadas.figura === 'codigo' ? 'Mesa de luz' : `Mesa de luz: ${NOME_DA_FIGURA[camadas.figura]}`,
    dica: { tipo: 'texto', texto: 'Lâminas soltas pela casa. Juntas, na luz, mostram alguma coisa.' },
    desfecho: { modo: 'cena', texto: TEXTO_DAS_CAMADAS_RESOLVIDO, itens: [], moedas: 0, documentos: [], abrePorta: false },
    castigo: { tipo: 'nada' },
  }
}

// ------------------------------------------------------------------ a mesa: a pilha, os giros e a conferência

function postaDe(progresso: Pick<ProgressoDoPuzzle, 'encaixes'>, encaixeId: string) {
  const posta = progresso.encaixes[encaixeId]
  return posta !== null && posta !== undefined && 'vaga' in posta ? posta : null
}

/**
 * A mesa de agora, sempre coerente com os encaixes: a pilha só tem lâminas
 * postas, cada uma uma vez; a posta que faltava na pilha vai para o alto; o
 * giro guardado vale, e o que falta é o de quando pousa.
 */
export function mesaNoProgresso(puzzle: Pick<Puzzle, 'encaixes'>, camadas: Pick<CamadasDoPuzzle, 'semente' | 'rotacaoImporta'>, progresso: Pick<ProgressoDoPuzzle, 'encaixes' | 'camadas'>): CamadasNoProgresso {
  const ids = puzzle.encaixes.map((encaixe) => encaixe.id)
  const postas = ids.filter((id) => postaDe(progresso, id) !== null)
  const guardada = progresso.camadas
  const pilha = (guardada?.pilha ?? []).filter((id, i, lista) => postas.includes(id) && lista.indexOf(id) === i)
  for (const id of postas) if (!pilha.includes(id)) pilha.push(id)
  const iniciais = girosAoPousar(camadas, ids.length)
  const giros: Record<string, number> = {}
  for (const id of pilha) {
    const guardado = guardada?.giros[id]
    const inicial = iniciais[ids.indexOf(id)] ?? 0
    giros[id] = !camadas.rotacaoImporta ? 0 : typeof guardado === 'number' && Number.isInteger(guardado) ? modulo(guardado, VOLTA) : inicial
  }
  return { pilha, giros }
}

/** O giro de quando a lâmina do encaixe pousa. */
export function giroAoPousar(puzzle: Pick<Puzzle, 'encaixes'>, camadas: Pick<CamadasDoPuzzle, 'semente' | 'rotacaoImporta'>, encaixeId: string): number {
  const i = puzzle.encaixes.findIndex((encaixe) => encaixe.id === encaixeId)
  return girosAoPousar(camadas, puzzle.encaixes.length)[i] ?? 0
}

/** A mesa fecha a figura: todas as lâminas nela, de pé (se o giro importa) e na ordem dos encaixes (se a ordem importa). */
export function mesaCerta(puzzle: Pick<Puzzle, 'encaixes'>, camadas: Pick<CamadasDoPuzzle, 'ordemImporta' | 'rotacaoImporta'>, mesa: CamadasNoProgresso): boolean {
  const ids = puzzle.encaixes.map((encaixe) => encaixe.id)
  if (ids.length < LAMINAS_MIN || mesa.pilha.length !== ids.length || ids.some((id) => !mesa.pilha.includes(id))) return false
  if (camadas.rotacaoImporta && mesa.pilha.some((id) => modulo(mesa.giros[id] ?? 0, VOLTA) !== 0)) return false
  if (camadas.ordemImporta && mesa.pilha.some((id, i) => ids[i] !== id)) return false
  return true
}

export function girado(giro: number, passo: number): number {
  return modulo(giro + passo, VOLTA)
}

/** "2 de 3 lâminas na mesa" (a ficha do desafio, para o mestre). */
export function textoDaMesa(puzzle: Pick<Puzzle, 'encaixes'>, camadas: CamadasDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'encaixes' | 'camadas'>): string {
  const mesa = mesaNoProgresso(puzzle, camadas, progresso)
  const n = puzzle.encaixes.length
  const tortas = camadas.rotacaoImporta ? mesa.pilha.filter((id) => (mesa.giros[id] ?? 0) !== 0).length : 0
  const base = `${mesa.pilha.length} de ${n} lâminas na mesa`
  return tortas === 0 ? base : `${base}, ${tortas === 1 ? '1 torta' : `${tortas} tortas`}`
}

// ------------------------------------------------------------------ a vista (o recorte do jogador e o quadro do editor)

function baseDaVista(camadas: CamadasDoPuzzle, total: number): Omit<CamadasNaVista, 'pilha'> {
  return {
    material: camadas.material,
    figura: camadas.figura,
    codigo: camadas.figura === 'codigo' ? camadas.codigo : '',
    imagem: camadas.figura === 'imagem' ? camadas.imagem : null,
    corte: corteDas(camadas),
    ordemImporta: camadas.ordemImporta,
    rotacaoImporta: camadas.rotacaoImporta,
    total,
  }
}

/** A mesa como o jogador a vê: só as lâminas postas, de baixo para cima, com o giro de agora. */
export function camadasNaVista(puzzle: Pick<Puzzle, 'encaixes'>, camadas: CamadasDoPuzzle, progresso: Pick<ProgressoDoPuzzle, 'encaixes' | 'camadas'>): CamadasNaVista {
  const ids = puzzle.encaixes.map((encaixe) => encaixe.id)
  const reparticao = repartir(camadas, ids.length)
  const marcas = marcasDas(camadas, ids.length)
  const mesa = mesaNoProgresso(puzzle, camadas, progresso)
  const pilha = mesa.pilha.flatMap((id): LaminaNaVista[] => {
    const k = ids.indexOf(id)
    const posta = postaDe(progresso, id)
    const marca = marcas[k]
    if (posta === null || marca === undefined) return []
    return [{ encaixeId: id, nome: posta.vaga.nome, imagem: posta.vaga.imagem ?? null, por: posta.por.nome, giro: mesa.giros[id] ?? 0, marca, cacos: reparticao.cacos[k] ?? [], manchas: reparticao.manchas[k] ?? [] }]
  })
  return { ...baseDaVista(camadas, ids.length), pilha }
}

/**
 * A mesa do quadro do editor: todas as lâminas nela. Resolvida, na ordem e de
 * pé; senão, como cairiam se alguém as pusesse todas de uma vez (a ordem
 * embaralhada e o giro de quando pousam).
 */
export function camadasDoEditor(puzzle: Pick<Puzzle, 'encaixes'>, camadas: CamadasDoPuzzle, resolvida: boolean): CamadasNaVista {
  const n = puzzle.encaixes.length
  const reparticao = repartir(camadas, n)
  const marcas = marcasDas(camadas, n)
  const giros = girosAoPousar(camadas, n)
  const todas = marcas.map((marca, k): LaminaNaVista => ({ encaixeId: puzzle.encaixes[k]?.id ?? `lamina-${marca}`, nome: nomeDaLamina(camadas, marca), imagem: null, por: '', giro: resolvida ? 0 : (giros[k] ?? 0), marca, cacos: reparticao.cacos[k] ?? [], manchas: reparticao.manchas[k] ?? [] }))
  const pilha = resolvida || !camadas.ordemImporta ? todas : embaralhado(todas, sorteador(salgado(camadas.semente, 53)))
  return { ...baseDaVista(camadas, n), pilha }
}
