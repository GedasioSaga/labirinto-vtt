import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { appDataDir, join } from '@tauri-apps/api/path'
import { cleanItemName, ITEM_CATEGORIA_MAX, ITEM_DESCRICAO_MAX, ITEM_PRECO_MAX, type ItemParaDar } from './items'
import { ehRefDeMidia } from './midia'
import { ensureDir, writeTextFileSafely } from './mapFileIO'

/**
 * ACERVO DE ITENS (entrega 4 dos sistemas de RPG) — a espada, a poção, a Gomu
 * Gomu no Mi que o mestre cadastra uma vez e dá a qualquer personagem, em
 * qualquer aventura. É do APP, como o acervo de tokens (`lib/tokenLibrary.ts`):
 * mora em `appDataDir()/itens`, irmã de `tokens`, e aparece logo abaixo dos
 * tokens no painel do mestre (`AcervoDeItensPanel`).
 *
 * O que fica no disco:
 *   <appData>/itens/itens.json   índice: categorias + itens (com a referência da imagem)
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
const VERSAO_DO_INDICE = 1

/** As categorias de um acervo novo. A lista é do mestre: ele tira e põe. */
export const CATEGORIAS_PADRAO: readonly string[] = ['Arma', 'Armadura', 'Consumível', 'Fruta', 'Chave', 'Tesouro']
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
}

export interface AcervoDeItens {
  itens: ItemDoCatalogo[]
  categorias: string[]
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
  return { itens: [], categorias: [...CATEGORIAS_PADRAO] }
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
  }
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
  return { itens, categorias: categoriasLidas(bruto.categorias) }
}

export function serializarAcervo(acervo: AcervoDeItens): string {
  return `${JSON.stringify({ version: VERSAO_DO_INDICE, categorias: acervo.categorias, itens: acervo.itens }, null, 2)}\n`
}

/** O que vai para a mochila quando o item é dado (`darDoAcervoChange`). */
export function itemParaDar(item: ItemDoCatalogo): ItemParaDar {
  return {
    nome: item.nome,
    itemId: item.id,
    ...(item.imagem !== null ? { imagem: item.imagem } : {}),
    ...(item.descricao.trim() !== '' ? { descricao: item.descricao } : {}),
    ...(item.categoria !== '' ? { categoria: item.categoria } : {}),
    ...(item.preco !== null ? { preco: item.preco } : {}),
    ...(item.empilhavel ? { empilhavel: true as const } : {}),
  }
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
  const acervo = acervoDoTexto(texto)
  if (acervo !== null) return { acervo, aviso: null, lido: true }
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

/** Grava o acervo INTEIRO. Lança com a frase pronta. */
export function gravarAcervoDeItens(acervo: AcervoDeItens): Promise<void> {
  return naFila(async () => {
    try {
      const pasta = await pastaDoAcervo()
      const caminho = await join(pasta, ARQUIVO_DO_INDICE)
      await ensureDir(pasta)
      // Cópia do de antes: melhor esforço — sem ela a gravação segue.
      try {
        if (await exists(caminho)) await writeTextFile(await join(pasta, ARQUIVO_ANTERIOR), await readTextFile(caminho))
      } catch {
        // A cópia é a segunda linha de defesa; a primeira é a gravação segura logo abaixo.
      }
      await writeTextFileSafely(caminho, serializarAcervo(acervo))
    } catch (erro) {
      throw new Error(`Não foi possível gravar o acervo de itens: ${motivo(erro)}.`)
    }
  })
}
