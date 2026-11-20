/**
 * A LEITURA DO PUZZLE vindo de fora (plano §1.6, §1.7): o `map.json` da cena,
 * o "Meus puzzles" do disco e a ação que chega pela rede. Tudo é entrada
 * hostil: arquivo editado à mão, versão de outro app, jogador mal-intencionado.
 *
 * A regra é a dos outros leitores do mapa (`lib/conteudoDoObjeto.ts`,
 * `lib/leituraDoItem.ts`): campo torto vira o padrão, campo a campo, e o
 * puzzle continua; número fora da faixa é trazido para dentro dela; texto é
 * cortado no teto; imagem só como referência de mídia (`midia:<id>`), nunca
 * `data:` (o mapa não cresce). Só o que não dá para ler de jeito nenhum volta
 * `null`.
 *
 * Compatibilidade para a frente: a mecânica de uma leva futura (`futuro`) é
 * guardada como veio, e a versão maior não é rebaixada, para que um app
 * desta leva não apague nem estrague um puzzle mais novo ao salvar o mapa.
 */
import { lerConteudoDoArquivo, MOEDAS_NO_CONTEUDO_MAX } from '../lib/conteudoDoObjeto'
import { readCarriedItems } from '../lib/items'
import { ehIdDeItemDoAcervo } from '../lib/leituraDoItem'
import { ehRefDeMidia } from '../lib/midia'
import type { CarriedItem, ItemNoConteudo } from '../types/map'
import { lerCombinacao, minutosNoMostrador } from './combinacao'
import { aceitaMolduraPorta, PADROES_DOS_MODELOS, POSICAO_DA_TROCA_PADRAO, PESO_DA_TROCA_PADRAO, PV_DO_CASTIGO_PADRAO, puzzleDoModelo, visualEhPorta } from './padroes'
import {
  BANDEJA_MAX,
  DOCUMENTOS_DO_DESFECHO_MAX,
  ENCAIXES_MAX,
  ESCALA_DO_CONTROLE_MAX,
  ESCALA_DO_CONTROLE_MIN,
  FORMAS_DO_ENCAIXE,
  INSCRICAO_MAX,
  MODELOS_DO_PUZZLE,
  NOME_DA_PECA_MAX,
  NOME_DO_PUZZLE_MAX,
  PESO_MAX,
  PESO_MIN,
  PESOS_MAX,
  PV_DO_CASTIGO_MAX,
  REGRAS_DO_PUZZLE,
  TAMANHO_DO_ENCAIXE_MAX,
  TAMANHO_DO_ENCAIXE_MIN,
  TEXTO_DO_CASTIGO_MAX,
  TEXTO_DO_PUZZLE_MAX,
  VERSAO_DO_PUZZLE,
} from './tipos'
import type {
  AcaoNoPuzzle,
  CastigoDoPuzzle,
  DesfechoDoPuzzle,
  DicaDoPuzzle,
  EncaixeDoPuzzle,
  FormaDoEncaixe,
  MetadesPostas,
  MinigamePuzzle,
  ModeloDoPuzzle,
  PecaPosta,
  ProgressoDoPuzzle,
  Puzzle,
  QuemMexe,
  RegraDoPuzzle,
  TrocaDePeso,
  VisualDoPuzzle,
} from './tipos'

/** Id de encaixe, de documento e de modelo: a forma dos do app, num teto. */
const ID_MAX = 80
const FORMA_DO_ID = /^[A-Za-z0-9_-]+$/
/** Nomes que, como chave de um objeto, mexem no protótipo dele em vez de guardar um valor. */
const IDS_PROIBIDOS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype'])
/** Id de vaga e de boneco: o app não fixa a forma (o "!" antigo usa o id do pino), só o teto. */
const ID_SOLTO_MAX = 200
/** O nome de quem pôs ("Lara"), como o nome do jogador no chat. */
const NOME_DE_QUEM_MAX = 40
const NOME_DE_QUEM_PADRAO = 'Alguém'
/** O tamanho de um encaixe sem tamanho: o meio da faixa do editor, perto dos 9,4 da Fonte. */
const TAMANHO_DO_ENCAIXE_PADRAO = 9
/** Tetos do que o progresso guarda das levas futuras e dos encaixes que o mestre já tirou. */
const ENTRADAS_DO_PROGRESSO_MAX = 64
const LISTA_DO_FUTURO_MAX = 64
/** A mecânica futura guardada como veio: maior que isto não é um puzzle, é lixo ou ataque. */
const FUTURO_MAX_CARACTERES = 64 * 1024
const ERROS_MAX = 1_000_000
const COR = /^#[0-9a-fA-F]{6}$/

// ------------------------------------------------------------------ peças pequenas

function isRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Corta em `max` unidades UTF-16 sem deixar meio emoji no fim (como `lib/leituraDoItem.ts`). */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

/** Texto aparado no teto; o vazio vale. Não é texto: o padrão. */
function textoLido(valor: unknown, max: number, padrao: string): string {
  return typeof valor === 'string' ? cortado(valor.trim(), max) : padrao
}

/** Como `textoLido`, mas o vazio também cai no padrão (um nome precisa existir). */
function textoNaoVazio(valor: unknown, max: number, padrao: string): string {
  const texto = textoLido(valor, max, '')
  return texto === '' ? padrao : texto
}

/** Número finito trazido para a faixa; o resto, o padrão. */
function numeroEntre(valor: unknown, min: number, max: number, padrao: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return padrao
  return Math.min(max, Math.max(min, valor))
}

function inteiroEntre(valor: unknown, min: number, max: number, padrao: number): number {
  return Math.round(numeroEntre(valor, min, max, padrao))
}

function idLido(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor === '' || valor.length > ID_MAX || !FORMA_DO_ID.test(valor) || IDS_PROIBIDOS.has(valor)) return null
  return valor
}

function idSolto(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' && valor.length <= ID_SOLTO_MAX ? valor : null
}

/** O id do item do acervo, com a forma dos do Acervo e fora dos nomes proibidos (vira chave de `pesos`). */
function itemIdLido(valor: unknown): string | null {
  return ehIdDeItemDoAcervo(valor) && !IDS_PROIBIDOS.has(valor) ? valor : null
}

function imagemLida(valor: unknown): string | null {
  return ehRefDeMidia(valor) ? valor : null
}

function corLida(valor: unknown, padrao: string): string {
  return typeof valor === 'string' && COR.test(valor) ? valor : padrao
}

function ehModelo(valor: unknown): valor is ModeloDoPuzzle {
  return MODELOS_DO_PUZZLE.some((modelo) => modelo === valor)
}

function ehRegra(valor: unknown): valor is RegraDoPuzzle {
  return REGRAS_DO_PUZZLE.some((regra) => regra === valor)
}

function ehForma(valor: unknown): valor is FormaDoEncaixe {
  return FORMAS_DO_ENCAIXE.some((forma) => forma === valor)
}

// ------------------------------------------------------------------ o desafio e o puzzle

/**
 * `Desafio.minigame` com `jogo: 'puzzle'`, como vem do disco ou da rede.
 * `null` = não é um puzzle. A versão 1 é a primeira: quando houver a 2, o
 * passo de 1 para 2 entra aqui, antes de ler os campos.
 */
export function lerPuzzleDoArquivo(valor: unknown): MinigamePuzzle | null {
  if (!isRecord(valor) || valor.jogo !== 'puzzle') return null
  const minigame: MinigamePuzzle = {
    jogo: 'puzzle',
    // A versão maior (app mais novo) fica como veio: rebaixá-la diria que o arquivo é desta leva.
    versao: inteiroEntre(valor.versao, VERSAO_DO_PUZZLE, Number.MAX_SAFE_INTEGER, VERSAO_DO_PUZZLE),
    npc: '',
    modeloId: idLido(valor.modeloId),
    puzzle: lerPuzzle(valor.puzzle),
  }
  if (valor.mudadaAqui === true) minigame.mudadaAqui = true
  return minigame
}

/**
 * Um `Puzzle` de fora, sempre utilizável: os campos tortos caem no padrão do
 * modelo do visual (a Fonte, se nem o visual se lê). Serve o mapa e o "Meus puzzles".
 */
export function lerPuzzle(valor: unknown): Puzzle {
  const bruto = isRecord(valor) ? valor : {}
  const visual = lerVisual(bruto.visual)
  const padrao = puzzleDoModelo(visual.tipo === 'modelo' ? visual.modelo : 'fonte')
  const puzzle: Puzzle = {
    nome: textoNaoVazio(bruto.nome, NOME_DO_PUZZLE_MAX, padrao.nome),
    nomePublico: textoLido(bruto.nomePublico, NOME_DO_PUZZLE_MAX, padrao.nomePublico),
    regra: ehRegra(bruto.regra) ? bruto.regra : padrao.regra,
    visual,
    // Sem encaixes legíveis, nenhum: inventar os do modelo criaria lugares que o progresso nunca teve.
    encaixes: lerEncaixes(bruto.encaixes),
    troca: lerTroca(bruto.troca),
    dica: lerDica(bruto.dica, padrao.dica),
    desfecho: lerDesfecho(bruto.desfecho, padrao.desfecho, visual),
    castigo: lerCastigo(bruto.castigo, padrao.castigo),
    controle: lerControle(bruto.controle, padrao.controle),
  }
  const futuro = lerFuturo(bruto.futuro)
  if (futuro !== undefined) puzzle.futuro = futuro
  return puzzle
}

function lerVisual(valor: unknown): VisualDoPuzzle {
  if (isRecord(valor) && valor.tipo === 'imagem') return { tipo: 'imagem', imagem: imagemLida(valor.imagem) }
  const bruto = isRecord(valor) ? valor : {}
  const modelo = ehModelo(bruto.modelo) ? bruto.modelo : 'fonte'
  const padrao = PADROES_DOS_MODELOS[modelo]
  const cores = isRecord(bruto.cores) ? bruto.cores : {}
  return {
    tipo: 'modelo',
    modelo,
    cores: { parede: corLida(cores.parede, padrao.cores.parede), chao: corLida(cores.chao, padrao.cores.chao), objeto: corLida(cores.objeto, padrao.cores.objeto) },
    inscricao: textoLido(bruto.inscricao, INSCRICAO_MAX, padrao.inscricao),
    // A Porta de brasões já é porta: a moldura Porta não existe para ela.
    moldura: bruto.moldura === 'porta' && aceitaMolduraPorta(modelo) ? 'porta' : 'original',
  }
}

function lerEncaixes(valor: unknown): EncaixeDoPuzzle[] {
  if (!Array.isArray(valor)) return []
  const vistos = new Set<string>()
  const encaixes: EncaixeDoPuzzle[] = []
  for (const bruto of valor) {
    if (encaixes.length >= ENCAIXES_MAX) break
    const encaixe = lerEncaixe(bruto)
    // Id repetido: o progresso é pelo id, então dois encaixes com o mesmo seriam o mesmo lugar.
    if (encaixe === null || vistos.has(encaixe.id)) continue
    vistos.add(encaixe.id)
    encaixes.push(encaixe)
  }
  return encaixes
}

function lerEncaixe(valor: unknown): EncaixeDoPuzzle | null {
  if (!isRecord(valor)) return null
  const id = idLido(valor.id)
  if (id === null) return null
  const lugar = {
    id,
    x: numeroEntre(valor.x, 0, 100, 50),
    y: numeroEntre(valor.y, 0, 100, 50),
    t: numeroEntre(valor.t, TAMANHO_DO_ENCAIXE_MIN, TAMANHO_DO_ENCAIXE_MAX, TAMANHO_DO_ENCAIXE_PADRAO),
    forma: ehForma(valor.forma) ? valor.forma : 'redondo',
  }
  if (valor.jeito !== 'metades') return { ...lugar, jeito: 'peca', itemId: itemIdLido(valor.itemId) }
  const metades: unknown[] = Array.isArray(valor.metades) ? valor.metades : []
  const vira = isRecord(valor.vira) ? valor.vira : {}
  return {
    ...lugar,
    jeito: 'metades',
    metades: [itemIdLido(metades[0]), itemIdLido(metades[1])],
    vira: { nome: textoNaoVazio(vira.nome, NOME_DA_PECA_MAX, 'Peça inteira'), imagem: imagemLida(vira.imagem) },
  }
}

/** Troca de peso sem a peça guardada não troca nada: volta `null` (o editor não deixa ligar sem ela). */
function lerTroca(valor: unknown): TrocaDePeso | null {
  if (!isRecord(valor)) return null
  const guarda = itemIdLido(valor.guarda)
  if (guarda === null) return null
  return {
    guarda,
    peso: inteiroEntre(valor.peso, PESO_MIN, PESO_MAX, PESO_DA_TROCA_PADRAO),
    pesos: lerPesos(valor.pesos),
    x: numeroEntre(valor.x, 0, 100, POSICAO_DA_TROCA_PADRAO.x),
    y: numeroEntre(valor.y, 0, 100, POSICAO_DA_TROCA_PADRAO.y),
  }
}

function lerPesos(valor: unknown): Record<string, number> {
  if (!isRecord(valor)) return {}
  const pesos = Object.entries(valor).flatMap(([itemId, peso]): [string, number][] => {
    const id = itemIdLido(itemId)
    return id === null || typeof peso !== 'number' || !Number.isFinite(peso) ? [] : [[id, inteiroEntre(peso, PESO_MIN, PESO_MAX, PESO_MIN)]]
  })
  return Object.fromEntries(pesos.slice(0, PESOS_MAX))
}

function lerDica(valor: unknown, padrao: DicaDoPuzzle): DicaDoPuzzle {
  if (!isRecord(valor)) return { ...padrao }
  if (valor.tipo === 'documento') {
    const docId = idLido(valor.docId)
    // O documento sem id não aponta para nada: a dica vira o texto vazio, que o jogador não vê.
    return docId === null ? { tipo: 'texto', texto: '' } : { tipo: 'documento', docId }
  }
  if (valor.tipo === 'texto') return { tipo: 'texto', texto: textoLido(valor.texto, TEXTO_DO_PUZZLE_MAX, '') }
  return { ...padrao }
}

/** Os itens pela mesma porta do conteúdo do baú (o tipo é o mesmo), com o teto dele. */
function lerItensDoDesfecho(valor: unknown): ItemNoConteudo[] {
  return Array.isArray(valor) ? (lerConteudoDoArquivo({ itens: valor }, 'bau')?.itens ?? []) : []
}

function lerDesfecho(valor: unknown, padrao: DesfechoDoPuzzle, visual: VisualDoPuzzle): DesfechoDoPuzzle {
  if (!isRecord(valor)) return structuredClone(padrao)
  const documentos = Array.isArray(valor.documentos) ? [...new Set(valor.documentos.flatMap((id) => idLido(id) ?? []))].slice(0, DOCUMENTOS_DO_DESFECHO_MAX) : []
  return {
    modo: valor.modo === 'texto' || valor.modo === 'cena' ? valor.modo : padrao.modo,
    texto: textoLido(valor.texto, TEXTO_DO_PUZZLE_MAX, padrao.texto),
    itens: lerItensDoDesfecho(valor.itens),
    moedas: inteiroEntre(valor.moedas, 0, MOEDAS_NO_CONTEUDO_MAX, 0),
    documentos,
    // Só um visual de porta abre a porta do mapa.
    abrePorta: valor.abrePorta === true && visualEhPorta(visual),
  }
}

function lerCastigo(valor: unknown, padrao: CastigoDoPuzzle): CastigoDoPuzzle {
  if (!isRecord(valor)) return { ...padrao }
  const texto = textoLido(valor.texto, TEXTO_DO_CASTIGO_MAX, '')
  switch (valor.tipo) {
    case 'nada':
      return { tipo: 'nada' }
    case 'dano':
      return { tipo: 'dano', pv: inteiroEntre(valor.pv, 1, PV_DO_CASTIGO_MAX, PV_DO_CASTIGO_PADRAO), texto }
    case 'armadilha':
      // A armadilha pode ser só o susto (0 PV), como o texto "Uma armadilha dispara." do v2.
      return { tipo: 'armadilha', pv: inteiroEntre(valor.pv, 0, PV_DO_CASTIGO_MAX, PV_DO_CASTIGO_PADRAO), texto }
    case 'barulho':
      return { tipo: 'barulho', texto }
    default:
      return { ...padrao }
  }
}

function lerControle(valor: unknown, padrao: Puzzle['controle']): Puzzle['controle'] {
  if (!isRecord(valor)) return { ...padrao }
  return {
    x: numeroEntre(valor.x, 0, 100, padrao.x),
    y: numeroEntre(valor.y, 0, 100, padrao.y),
    s: numeroEntre(valor.s, ESCALA_DO_CONTROLE_MIN, ESCALA_DO_CONTROLE_MAX, padrao.s),
  }
}

/**
 * A combinação, ou a mecânica de uma leva futura guardada como veio (uma cópia
 * pelo JSON, que tira o que não é dado). Sem `tipo` de texto, ou grande demais: some.
 */
function lerFuturo(valor: unknown): Puzzle['futuro'] {
  // A combinação que este app joga é lida campo a campo; a de uma forma que ele não conhece segue como veio.
  const combinacao = lerCombinacao(valor)
  if (combinacao !== null) return combinacao
  if (!isRecord(valor) || typeof valor.tipo !== 'string' || valor.tipo === '') return undefined
  let json: string
  try {
    json = JSON.stringify(valor)
  } catch {
    // Ciclo ou BigInt: não veio de um arquivo nem da rede, e não dá para guardar.
    return undefined
  }
  if (json.length > FUTURO_MAX_CARACTERES) return undefined
  const copia: unknown = JSON.parse(json)
  if (!isRecord(copia) || typeof copia.tipo !== 'string') return undefined
  return { ...copia, tipo: copia.tipo }
}

// ------------------------------------------------------------------ o progresso

/**
 * `Desafio.progressoDoPuzzle` como vem do disco. `undefined` = sem progresso
 * (ninguém mexeu). A peça de um encaixe que o mestre já tirou do puzzle FICA:
 * apagá-la sumiria com o item de alguém; o "Zerar progresso" a devolve.
 */
export function lerProgressoDoPuzzle(valor: unknown): ProgressoDoPuzzle | undefined {
  if (!isRecord(valor)) return undefined
  const encaixes = isRecord(valor.encaixes)
    ? Object.entries(valor.encaixes).flatMap(([id, posta]): [string, PecaPosta | MetadesPostas | null][] => (idLido(id) === null ? [] : [[id, lerPostaNoEncaixe(posta)]]))
    : []
  const progresso: ProgressoDoPuzzle = {
    rev: inteiroEntre(valor.rev, 0, Number.MAX_SAFE_INTEGER, 0),
    encaixes: Object.fromEntries(encaixes.slice(0, ENTRADAS_DO_PROGRESSO_MAX)),
    bandeja: Array.isArray(valor.bandeja) ? valor.bandeja.flatMap((pedra) => lerPecaPosta(pedra) ?? []).slice(0, BANDEJA_MAX) : [],
    trocaFeita: valor.trocaFeita === true,
    resolvido: lerResolvido(valor.resolvido),
    erros: inteiroEntre(valor.erros, 0, ERROS_MAX, 0),
  }
  const controles = lerControles(valor.controles)
  if (controles !== undefined) progresso.controles = controles
  const rotacoes = listaDe(valor.rotacoes, (n): n is number => typeof n === 'number' && Number.isFinite(n))
  if (rotacoes !== undefined) progresso.rotacoes = rotacoes
  const luzes = listaDe(valor.luzes, (n): n is boolean => typeof n === 'boolean')
  if (luzes !== undefined) progresso.luzes = luzes
  return progresso
}

function lerPostaNoEncaixe(valor: unknown): PecaPosta | MetadesPostas | null {
  if (!isRecord(valor)) return null
  if ('vaga' in valor) return lerPecaPosta(valor)
  const metades: MetadesPostas = { a: lerPecaPosta(valor.a), b: lerPecaPosta(valor.b) }
  return metades.a === null && metades.b === null ? null : metades
}

/** A peça posta. Sem uma vaga legível não há o que devolver; sem quem pôs, ela fica (e volta a "Alguém"). */
function lerPecaPosta(valor: unknown): PecaPosta | null {
  if (!isRecord(valor)) return null
  const vaga: CarriedItem | undefined = readCarriedItems([valor.vaga])?.[0]
  if (vaga === undefined) return null
  // Posta no puzzle ela nunca está acesa (o motor tira o aceso ao pôr).
  const { acesa: _acesa, ...apagada } = vaga
  return { vaga: apagada, por: lerQuem(valor.por) }
}

function lerQuem(valor: unknown): QuemMexe {
  const bruto = isRecord(valor) ? valor : {}
  return {
    personagemId: idSolto(bruto.personagemId),
    tokenId: idSolto(bruto.tokenId) ?? '',
    nome: textoNaoVazio(bruto.nome, NOME_DE_QUEM_MAX, NOME_DE_QUEM_PADRAO),
  }
}

function lerResolvido(valor: unknown): ProgressoDoPuzzle['resolvido'] {
  if (!isRecord(valor)) return null
  return { por: textoNaoVazio(valor.por, NOME_DE_QUEM_MAX, NOME_DE_QUEM_PADRAO), em: numeroEntre(valor.em, 0, Number.MAX_SAFE_INTEGER, 0) }
}

/** Os controles da combinação (leva 2): número, ou lista de números, por id. */
function lerControles(valor: unknown): Record<string, number | number[]> | undefined {
  if (!isRecord(valor)) return undefined
  const entradas = Object.entries(valor).flatMap(([id, controle]): [string, number | number[]][] => {
    if (idLido(id) === null) return []
    if (typeof controle === 'number' && Number.isFinite(controle)) return [[id, controle]]
    const lista = listaDe(controle, (n): n is number => typeof n === 'number' && Number.isFinite(n))
    return lista === undefined ? [] : [[id, lista]]
  })
  return entradas.length === 0 ? undefined : Object.fromEntries(entradas.slice(0, ENTRADAS_DO_PROGRESSO_MAX))
}

/** A lista só com os itens bons, no teto; vazia ou não lista = ausente. */
function listaDe<T>(valor: unknown, bom: (item: unknown) => item is T): T[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const lista = valor.filter(bom).slice(0, LISTA_DO_FUTURO_MAX)
  return lista.length === 0 ? undefined : lista
}

// ------------------------------------------------------------------ a ação vinda da rede

/** A roda ou o botão pelo índice: inteiro pequeno (o motor confere se existe). */
function indiceLido(valor: unknown): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor < LISTA_DO_FUTURO_MAX ? valor : null
}

/** A ação de `puzzle.acao`, do jogador. `null` = não é uma ação desta leva (o host recusa). */
export function lerAcaoNoPuzzle(valor: unknown): AcaoNoPuzzle | null {
  if (!isRecord(valor)) return null
  switch (valor.tipo) {
    case 'por': {
      const encaixeId = idLido(valor.encaixeId)
      const vagaId = idSolto(valor.vagaId)
      if (encaixeId === null || vagaId === null) return null
      const acao: AcaoNoPuzzle = { tipo: 'por', encaixeId, vagaId }
      if (valor.metade === 'a' || valor.metade === 'b') acao.metade = valor.metade
      return acao
    }
    case 'tirar': {
      const encaixeId = idLido(valor.encaixeId)
      return encaixeId === null ? null : { tipo: 'tirar', encaixeId }
    }
    case 'porNaBandeja': {
      const vagaId = idSolto(valor.vagaId)
      return vagaId === null ? null : { tipo: 'porNaBandeja', vagaId }
    }
    case 'tirarDaBandeja':
      return { tipo: 'tirarDaBandeja' }
    case 'trocar':
      return { tipo: 'trocar' }
    case 'girar': {
      const roda = indiceLido(valor.roda)
      const passo = valor.passo === 1 || valor.passo === -1 ? valor.passo : null
      return roda === null || passo === null ? null : { tipo: 'girar', roda, passo }
    }
    case 'ponteiro':
      return typeof valor.minutos === 'number' && Number.isFinite(valor.minutos) ? { tipo: 'ponteiro', minutos: minutosNoMostrador(valor.minutos) } : null
    case 'apertar': {
      const botao = indiceLido(valor.botao)
      return botao === null ? null : { tipo: 'apertar', botao }
    }
    case 'tentar':
      return { tipo: 'tentar' }
    default:
      return null
  }
}
