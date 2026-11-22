import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { cleanItemName, ITEM_CATEGORIA_MAX, ITEM_DESCRICAO_MAX, ITEM_PRECO_MAX, MUNICOES_POR_ARMA_MAX, type ItemParaDar, type MunicaoDaVaga } from './items'
import { luzDoItemLida } from './luzDoItem'
import { ehRefDeMidia } from './midia'
import type { EfeitoDoItem, LuzDoItem } from '../types/map'
import { resumoDoEfeitoDoItem } from './batalha/mecanica/resumoDoItem'
import { efeitoDoItemLido } from './leituraDoItem'
import { ensureDir, writeTextFileSafely } from './mapFileIO'
import { ehIdDePasta, pastasDasCategorias, pastasLidas, pastasPorPai, PASTAS_MAX, type PastaDeItens } from './pastasDosItens'
import { PECAS_DESENHADAS } from '../puzzles/padroes'
import { CATEGORIA_DA_PECA_DE_PUZZLE, type IdDaPecaDesenhada } from '../puzzles/tipos'

export type { PastaDeItens }

/**
 * ACERVO DE ITENS (entrega 4 dos sistemas de RPG) — a espada, a poção, a Gomu
 * Gomu no Mi que o mestre cadastra uma vez e dá a qualquer personagem, em
 * qualquer aventura. É do APP, como o acervo de tokens (`lib/tokenLibrary.ts`):
 * mora em `appDataDir()/itens`, irmã de `tokens`, e aparece logo abaixo dos
 * tokens no painel do mestre (`AcervoDeItensPanel`).
 *
 * O que fica no disco:
 *   <appData>/itens/itens.json   índice: categorias + pastas + itens (com a referência da imagem e a pasta)
 *   <appData>/midia/<sha256>.*   a imagem, gravada pela mídia da mesa (`lib/midiaNoDisco.ts`)
 *
 * A imagem não mora aqui ao lado de propósito: a pasta de mídia é a que a sala
 * serve por URL ao jogador (`/media/{id}`), e o mesmo arquivo serve ao item,
 * ao retrato e a quem mais o usar.
 *
 * Mesmas defesas do acervo de tokens, pelos mesmos motivos: índice ilegível é
 * posto de lado (`.invalido`) antes de o acervo recomeçar vazio; leitura que
 * falha por I/O não deixa gravar por cima (`lido`); cada gravação tira cópia
 * do índice (`.anterior`) e passa pela fila, uma depois da outra.
 */

const PASTA_DO_ACERVO = 'itens'
const ARQUIVO_DO_INDICE = 'itens.json'
const ARQUIVO_INVALIDO = 'itens.json.invalido'
const ARQUIVO_ANTERIOR = 'itens.json.anterior'
/** Fase 7 (SISTEMA.md, cópias de segurança): o índice de antes do efeito, guardado UMA vez, nunca por cima. */
const ARQUIVO_ANTES_DOS_EFEITOS = 'itens.json.antes-dos-efeitos'
/** Armas numa fonte só (ARMAS-FONTE-UNICA §4): o índice de antes de o Juntar as armas criar coisas, guardado UMA vez, nunca por cima. */
const ARQUIVO_ANTES_DAS_ARMAS = 'itens.json.antes-das-armas'
/**
 * 2 (16/11/2026): a categoria Munição entrou; o índice de antes a ganha uma vez ao ser lido (`acervoDoTexto`).
 * 3 (18/11/2026): as pastas entraram; o índice de antes ganha uma pasta por categoria mostrada (`pastasDasCategorias`).
 * 4 (19/11/2026): as peças de puzzle entraram; o índice de antes ganha a categoria e a pasta "Peça de puzzle" uma vez (`comAPecaDePuzzle`).
 * 5 (21/11/2026): o efeito do item entrou (`ItemDoCatalogo.efeito`, opcional); nada se transforma, o de antes fica guardado.
 */
const VERSAO_DO_INDICE = 5
/** A versão que trouxe o efeito do item: o índice de antes dela é guardado ao lado antes da 1ª gravação. */
const VERSAO_DOS_EFEITOS = 5
/** A versão que trouxe a categoria Munição. */
const VERSAO_DA_MUNICAO = 2
/** A versão que trouxe a categoria e a pasta das peças de puzzle. */
const VERSAO_DA_PECA_DE_PUZZLE = 4

/** MUNIÇÃO (pedido de 16/11/2026): a categoria das balas, que empilham e que a arma de fogo declara que aceita (`municoes`). */
export const CATEGORIA_DA_MUNICAO = 'Munição'

/** As categorias de um acervo novo. A lista é do mestre: ele tira e põe. */
export const CATEGORIAS_PADRAO: readonly string[] = ['Arma', 'Armadura', 'Consumível', 'Munição', 'Fruta', 'Chave', 'Tesouro', CATEGORIA_DA_PECA_DE_PUZZLE]
// O teto mora em `lib/items.ts` porque a vaga da mochila também o aplica; daqui ele segue exportado para a tela do item.
export { MUNICOES_POR_ARMA_MAX }

/** A categoria é a Munição, sem acento e sem caixa ("municao", "MUNIÇÕES"). */
export function ehCategoriaDeMunicao(categoria: string): boolean {
  return /^munic(ao|oes)$/.test(
    categoria
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim(),
  )
}
/** Teto de categorias na lista (o seletor do item vira lista de rolagem sem fim). */
export const CATEGORIAS_MAX = 40
export const ITEM_SEM_NOME = 'Item sem nome'

/** Um item do acervo, como fica GRAVADO. */
export interface ItemDoCatalogo {
  id: string
  nome: string
  /** Referência de mídia (`midia:<id>`); `null` = sem imagem (a vaga mostra as iniciais). */
  imagem: string | null
  descricao: string
  /** Texto livre; a lista do acervo só sugere. Vazio = sem categoria. */
  categoria: string
  /** Preço em berries, para a loja; `null` = sem preço. */
  preco: number | null
  /** Dar de novo a quem já tem soma na mesma vaga ("Poção ×3"). */
  empilhavel: boolean
  /**
   * MUNIÇÃO (pedido de 16/11/2026: "cada arma pode usar certos de munição"):
   * os ids dos itens de Munição que a arma de fogo aceita. A batalha mostra
   * cada uma como bala da arma, com a quantidade da mochila. Ausente = a arma
   * não declara munição.
   */
  municoes?: string[]
  /**
   * ITEM QUE ILUMINA (pedido de 18/11/2026): a cor, o alcance em casas, a
   * força e se crepita como fogo. Vai com a cópia dada (`itemParaDar`): no
   * chão clareia, na mochila só aceso. Ausente = não ilumina.
   */
  luz?: LuzDoItem
  /**
   * PASTAS (pedido de 18/11/2026): o id da pasta onde o item mora no Acervo.
   * Ausente = Sem pasta. Só organiza o Acervo: não vai com a cópia dada.
   */
  pasta?: string
  /**
   * EFEITO DO ITEM (Fase 7, SISTEMA.md §5.1): as peças da técnica, quanto
   * gasta e onde vale. Vai com a cópia dada (`itemParaDar`), com a frase.
   * Ausente = item sem efeito (os de antes da Fase 7 abrem iguais).
   */
  efeito?: EfeitoDoItem
}

export interface AcervoDeItens {
  itens: ItemDoCatalogo[]
  categorias: string[]
  /** As pastas e subpastas do Acervo (`lib/pastasDosItens.ts`). */
  pastas: PastaDeItens[]
}

export interface AcervoDeItensLido {
  acervo: AcervoDeItens
  /** Frase pronta para a tela quando a leitura deu errado; `null` = tudo certo. */
  aviso: string | null
  /** O índice foi LIDO (ou não existia ainda)? `false` = gravar seria passar por cima do que não se leu. */
  lido: boolean
}

const AVISO = 'Não foi possível ler o acervo de itens'
export const ACERVO_DE_ITENS_NAO_LIDO = `${AVISO}, então nada foi gravado para não apagar o que está lá. Feche e abra o app de novo.`

export function acervoVazio(): AcervoDeItens {
  return { itens: [], categorias: [...CATEGORIAS_PADRAO], pastas: [] }
}

export function novoIdDeItem(): string {
  return `item_${crypto.randomUUID()}`
}

export function novoItemDoCatalogo(categoria = ''): ItemDoCatalogo {
  return { id: novoIdDeItem(), nome: ITEM_SEM_NOME, imagem: null, descricao: '', categoria, preco: null, empilhavel: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

/** A categoria como fica gravada: aparada e no teto. */
export function categoriaLimpa(raw: string): string {
  return cortado(raw.trim(), ITEM_CATEGORIA_MAX)
}

/**
 * Um item do índice. Sem id ele sai (o "Dar" e a pilha o acham pelo id); o
 * resto é tolerante: nome vazio vira "Item sem nome", imagem que não é
 * referência de mídia sai, preço torto vira "sem preço".
 */
export function itemDoCatalogoLido(value: unknown): ItemDoCatalogo | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.id)) return null
  const preco = value.preco
  return {
    id: value.id,
    nome: (typeof value.nome === 'string' ? cleanItemName(value.nome) : '') || ITEM_SEM_NOME,
    imagem: ehRefDeMidia(value.imagem) ? value.imagem : null,
    descricao: typeof value.descricao === 'string' ? cortado(value.descricao, ITEM_DESCRICAO_MAX) : '',
    categoria: typeof value.categoria === 'string' ? categoriaLimpa(value.categoria) : '',
    preco: typeof preco === 'number' && Number.isSafeInteger(preco) && preco >= 0 && preco <= ITEM_PRECO_MAX ? preco : null,
    empilhavel: value.empilhavel === true,
    ...municoesLidas(value.municoes, value.id),
    ...luzLida(value.luz),
    ...(ehIdDePasta(value.pasta) ? { pasta: value.pasta } : {}),
    ...efeitoLido(value.efeito),
  }
}

/** O efeito do item: torto sai (o item fica, sem efeito). */
function efeitoLido(value: unknown): { efeito?: EfeitoDoItem } {
  const efeito = efeitoDoItemLido(value)
  return efeito === undefined ? {} : { efeito }
}

/** A luz do item: torta sai (o item só não ilumina). */
function luzLida(value: unknown): { luz?: LuzDoItem } {
  const luz = luzDoItemLida(value)
  return luz === undefined ? {} : { luz }
}

/** As munições da arma: ids com a forma dos do Acervo, sem repetir, sem a própria arma, no teto. Vazia = sem o campo. */
function municoesLidas(value: unknown, armaId: string): { municoes?: string[] } {
  if (!Array.isArray(value)) return {}
  const ids = [...new Set(value.filter((id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(id) && id !== armaId))].slice(0, MUNICOES_POR_ARMA_MAX)
  return ids.length === 0 ? {} : { municoes: ids }
}

/** A lista de categorias: textos limpos, sem repetir (sem diferença de caixa), no teto. */
export function categoriasLidas(value: unknown): string[] {
  if (!Array.isArray(value)) return [...CATEGORIAS_PADRAO]
  const vistas = new Set<string>()
  const lidas: string[] = []
  for (const bruta of value) {
    if (typeof bruta !== 'string') continue
    const categoria = categoriaLimpa(bruta)
    const chave = categoria.toLocaleLowerCase('pt-BR')
    if (categoria === '' || vistas.has(chave)) continue
    vistas.add(chave)
    lidas.push(categoria)
    if (lidas.length >= CATEGORIAS_MAX) break
  }
  return lidas
}

/** O índice como texto. `null` = não é JSON de acervo (o arquivo vai para `.invalido`). */
export function acervoDoTexto(texto: string): AcervoDeItens | null {
  const indice = indiceDoTexto(texto)
  return indice === null ? null : indice.acervo
}

/** O índice como texto, com a versão que o gravou (0 = de antes de o índice ter versão). */
function indiceDoTexto(texto: string): { acervo: AcervoDeItens; versao: number } | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (!isRecord(bruto) || !Array.isArray(bruto.itens)) return null
  const vistos = new Set<string>()
  const itens: ItemDoCatalogo[] = []
  for (const valor of bruto.itens) {
    const item = itemDoCatalogoLido(valor)
    if (item === null || vistos.has(item.id)) continue
    vistos.add(item.id)
    itens.push(item)
  }
  const categorias = categoriasLidas(bruto.categorias)
  // O índice de antes da Munição a ganha UMA vez: gravado de novo com a versão nova, o mestre que a tirar não a vê voltar.
  const antesDaMunicao = typeof bruto.version !== 'number' || bruto.version < VERSAO_DA_MUNICAO
  const semMunicao = !categorias.some(ehCategoriaDeMunicao)
  const comMunicao = antesDaMunicao && semMunicao && categorias.length < CATEGORIAS_MAX ? [...categorias, CATEGORIA_DA_MUNICAO] : categorias
  // O índice de antes das pastas: as categorias que a lista mostrava viram as pastas de cima, cada item na dele.
  const guardadas = pastasLidas(bruto.pastas)
  const organizado = guardadas === null ? pastasDasCategorias(itens) : { pastas: guardadas, itens: semPastaQueSumiu(itens, guardadas) }
  return { acervo: { itens: organizado.itens, categorias: comMunicao, pastas: organizado.pastas }, versao: typeof bruto.version === 'number' ? bruto.version : 0 }
}

// ------------------------------------------------------------------ peças de puzzle (PLANO dos puzzles, §1.4)

/**
 * O id fixo da pasta das peças de puzzle: ler duas vezes o mesmo índice de
 * antes dela dá a mesma pasta, sem gravar nada, e o "Pôr no acervo" a acha
 * mesmo depois de o mestre renomeá-la ou levá-la para dentro de outra.
 */
export const ID_DA_PASTA_DA_PECA_DE_PUZZLE = 'pasta_peca_de_puzzle'

function mesmoNome(a: string, b: string): boolean {
  return a.toLocaleLowerCase('pt-BR') === b.toLocaleLowerCase('pt-BR')
}

/** A pasta das peças de puzzle que já está no índice: a do id fixo, ou uma de cima com o nome da categoria. */
export function pastaDaPecaDePuzzle(pastas: readonly PastaDeItens[]): PastaDeItens | undefined {
  return pastas.find((pasta) => pasta.id === ID_DA_PASTA_DA_PECA_DE_PUZZLE) ?? (pastasPorPai(pastas).get(null) ?? []).find((pasta) => mesmoNome(pasta.nome, CATEGORIA_DA_PECA_DE_PUZZLE))
}

/**
 * O índice de antes das peças de puzzle (versão 3 ou mais velho) ganha a
 * categoria e a pasta "Peça de puzzle", cada uma só se ainda não houver uma
 * igual e se couber no teto. Gravado de novo, com a versão nova, o mestre que
 * tirar uma das duas não a vê voltar.
 */
export function comAPecaDePuzzle(acervo: AcervoDeItens): AcervoDeItens {
  const temCategoria = acervo.categorias.some((categoria) => mesmoNome(categoria, CATEGORIA_DA_PECA_DE_PUZZLE))
  const categorias = temCategoria || acervo.categorias.length >= CATEGORIAS_MAX ? acervo.categorias : [...acervo.categorias, CATEGORIA_DA_PECA_DE_PUZZLE]
  const semPasta = pastaDaPecaDePuzzle(acervo.pastas) === undefined && acervo.pastas.length < PASTAS_MAX
  const pastas = semPasta ? [...acervo.pastas, { id: ID_DA_PASTA_DA_PECA_DE_PUZZLE, nome: CATEGORIA_DA_PECA_DE_PUZZLE }] : acervo.pastas
  return { ...acervo, categorias, pastas }
}

/**
 * O id do item de cada peça desenhada, sempre o mesmo: o puzzle liga o
 * encaixe ao item pelo id (`puzzleDoModelo`), e pôr de novo a peça que o
 * mestre apagou devolve o item que os puzzles já apontavam.
 */
export function idDoItemDaPeca(peca: IdDaPecaDesenhada): string {
  return `item_peca_${peca}`
}

/**
 * O item novo de uma peça desenhada, com a imagem já gravada (`imagem` =
 * `midia:<id>`), e onde ele mora: na pasta das peças de puzzle, criada (com o
 * id fixo) se não houver. Sem lugar no teto de pastas, fica Sem pasta.
 */
export function itemDaPecaDesenhada(peca: IdDaPecaDesenhada, imagem: string, pastas: readonly PastaDeItens[]): { item: ItemDoCatalogo; pastas: PastaDeItens[] } {
  const { nome, descricao } = PECAS_DESENHADAS[peca]
  const item: ItemDoCatalogo = { id: idDoItemDaPeca(peca), nome, imagem, descricao, categoria: CATEGORIA_DA_PECA_DE_PUZZLE, preco: null, empilhavel: false }
  const achada = pastaDaPecaDePuzzle(pastas)
  if (achada !== undefined) return { item: { ...item, pasta: achada.id }, pastas: [...pastas] }
  if (pastas.length >= PASTAS_MAX) return { item, pastas: [...pastas] }
  return { item: { ...item, pasta: ID_DA_PASTA_DA_PECA_DE_PUZZLE }, pastas: [...pastas, { id: ID_DA_PASTA_DA_PECA_DE_PUZZLE, nome: CATEGORIA_DA_PECA_DE_PUZZLE }] }
}

/** O item que aponta para uma pasta que não está no índice fica Sem pasta (o campo sai). */
function semPastaQueSumiu(itens: ItemDoCatalogo[], pastas: readonly PastaDeItens[]): ItemDoCatalogo[] {
  const ids = new Set(pastas.map((pasta) => pasta.id))
  return itens.map((item) => {
    if (item.pasta === undefined || ids.has(item.pasta)) return item
    const { pasta: _sumiu, ...semPasta } = item
    return semPasta
  })
}

export function serializarAcervo(acervo: AcervoDeItens): string {
  return `${JSON.stringify({ version: VERSAO_DO_INDICE, categorias: acervo.categorias, pastas: acervo.pastas, itens: acervo.itens }, null, 2)}\n`
}

/**
 * O que vai para a mochila quando o item é dado (`darDoAcervoChange`).
 * `acervo` = a lista de agora, de onde sai o nome de cada munição que a arma
 * aceita: a vaga leva `{ itemId, nome }` porque o app do jogador não vê o
 * Acervo. Munição que já saiu do Acervo não vai (não há nome a mostrar).
 */
export function itemParaDar(item: ItemDoCatalogo, acervo: readonly Pick<ItemDoCatalogo, 'id' | 'nome'>[]): ItemParaDar {
  return {
    nome: item.nome,
    itemId: item.id,
    ...(item.imagem !== null ? { imagem: item.imagem } : {}),
    ...(item.descricao.trim() !== '' ? { descricao: item.descricao } : {}),
    ...(item.categoria !== '' ? { categoria: item.categoria } : {}),
    ...(item.preco !== null ? { preco: item.preco } : {}),
    ...(item.empilhavel ? { empilhavel: true as const } : {}),
    ...municoesParaDar(item, acervo),
    ...(item.luz !== undefined ? { luz: { ...item.luz } } : {}),
    ...efeitoParaDar(item),
  }
}

/** Fase 7: a vaga leva as peças (o host as lê) e a frase (o que o jogador recebe, decisão C8). */
export function efeitoParaDar(item: Pick<ItemDoCatalogo, 'efeito'>): Pick<ItemParaDar, 'efeito' | 'efeitoResumo'> {
  if (item.efeito === undefined) return {}
  const efeitoResumo = resumoDoEfeitoDoItem(item.efeito)
  return { efeito: { ...item.efeito, mecanica: structuredClone(item.efeito.mecanica) }, ...(efeitoResumo !== '' ? { efeitoResumo } : {}) }
}

function municoesParaDar(item: ItemDoCatalogo, acervo: readonly Pick<ItemDoCatalogo, 'id' | 'nome'>[]): { municoes?: MunicaoDaVaga[] } {
  if (item.municoes === undefined) return {}
  const nomes = new Map(acervo.map((outro) => [outro.id, outro.nome]))
  const municoes = item.municoes.flatMap((itemId) => {
    const nome = nomes.get(itemId)
    return nome === undefined ? [] : [{ itemId, nome }]
  })
  return municoes.length === 0 ? {} : { municoes }
}

async function pastaDoAcervo(): Promise<string> {
  return join(await appDataDir(), PASTA_DO_ACERVO)
}

function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  return /os error 5|denied|negado/i.test(texto) ? 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)' : texto
}

/** Lê o índice. Nunca lança: o erro vira `aviso`, e `lido: false` barra quem grava. */
export async function lerAcervoDeItens(): Promise<AcervoDeItensLido> {
  let caminho: string
  let texto: string
  try {
    caminho = await join(await pastaDoAcervo(), ARQUIVO_DO_INDICE)
    if (!(await exists(caminho))) return { acervo: acervoVazio(), aviso: null, lido: true }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { acervo: acervoVazio(), aviso: `${AVISO}: ${motivo(erro)}.`, lido: false }
  }
  const indice = indiceDoTexto(texto)
  // A peça de puzzle entra aqui, na leitura do disco, e não em `acervoDoTexto`: aquela segue devolvendo o índice com as migrações das versões 2 e 3 só.
  if (indice !== null) return { acervo: indice.versao < VERSAO_DA_PECA_DE_PUZZLE ? comAPecaDePuzzle(indice.acervo) : indice.acervo, aviso: null, lido: true }
  try {
    await writeTextFile(await join(await pastaDoAcervo(), ARQUIVO_INVALIDO), texto)
  } catch {
    // Sem a cópia, o acervo NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { acervo: acervoVazio(), aviso: `${AVISO}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, lido: false }
  }
  return {
    acervo: acervoVazio(),
    aviso: `${AVISO}: o arquivo estava ilegível. O acervo começa vazio, e o arquivo antigo ficou guardado como ${ARQUIVO_INVALIDO}, na mesma pasta.`,
    lido: true,
  }
}

let filaDoIndice: Promise<void> = Promise.resolve()

/** Uma gravação depois da outra: duas seguidas nunca leem a mesma lista e passam uma por cima da outra. */
function naFila<T>(operacao: () => Promise<T>): Promise<T> {
  const resultado = filaDoIndice.then(operacao)
  filaDoIndice = resultado.then(
    () => undefined,
    () => undefined,
  )
  return resultado
}

/**
 * Fase 7: o índice de antes da versão do efeito fica ao lado, UMA vez: a
 * cópia que já existe nunca é regravada (a 2ª gravação já veria o índice novo).
 */
async function guardarAntesDosEfeitos(pasta: string, antes: string): Promise<void> {
  const indice = indiceDoTexto(antes)
  if (indice === null || indice.versao >= VERSAO_DOS_EFEITOS) return
  const copia = await join(pasta, ARQUIVO_ANTES_DOS_EFEITOS)
  if (!(await exists(copia))) await writeTextFile(copia, antes)
}

/**
 * Armas numa fonte só (§4): antes da 1ª coisa que o Juntar as armas cria, o
 * índice de agora fica ao lado, UMA vez (a cópia que já existe nunca é
 * regravada). Sem índice no disco, nada a guardar. Lança: sem a cópia, quem
 * chamou não grava.
 */
export function guardarAcervoAntesDasArmas(): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDoAcervo()
      const caminho = await join(pasta, ARQUIVO_DO_INDICE)
      const copia = await join(pasta, ARQUIVO_ANTES_DAS_ARMAS)
      if ((await exists(caminho)) && !(await exists(copia))) await writeTextFile(copia, await readTextFile(caminho))
    } catch (erro) {
      throw new Error(`Não foi possível guardar a cópia do acervo de antes das armas: ${motivo(erro)}.`)
    }
  })
}

/** Grava o acervo INTEIRO. Lança com a frase pronta. */
export function gravarAcervoDeItens(acervo: AcervoDeItens): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDoAcervo()
      const caminho = await join(pasta, ARQUIVO_DO_INDICE)
      await ensureDir(pasta)
      // Cópia do de antes: melhor esforço — sem ela a gravação segue.
      let antes: string | null = null
      try {
        if (await exists(caminho)) {
          antes = await readTextFile(caminho)
          await writeTextFile(await join(pasta, ARQUIVO_ANTERIOR), antes)
        }
      } catch {
        // A cópia é a segunda linha de defesa; a primeira é a gravação segura logo abaixo.
      }
      // Fase 7: esta não é melhor esforço — sem a cópia de antes do efeito, nada se grava.
      if (antes !== null) await guardarAntesDosEfeitos(pasta, antes)
      await writeTextFileSafely(caminho, serializarAcervo(acervo))
    } catch (erro) {
      throw new Error(`Não foi possível gravar o acervo de itens: ${motivo(erro)}.`)
    }
  })
}
