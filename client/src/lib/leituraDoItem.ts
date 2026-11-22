import type { DadosDoItem, EfeitoDoItem, PecasDoEfeito } from '../types/map'
import { luzDoItemLida } from './luzDoItem'
import { ehRefDeMidia } from './midia'

/**
 * O LEITOR DO ITEM (18/11/2026, análise Fable: "luz e munições em todas as
 * portas do item"). Uma leitura só dos dados do acervo que um item leva — a
 * do chão e da estrela (`readPinItem`), a do baú (`conteudoDoObjeto`), a da
 * mercadoria da loja (`lib/loja.ts`) e a da mochila (`readCarriedItems`).
 * Antes, a loja tinha a leitura dela, sem a luz nem as munições: a tocha
 * comprada depois de reabrir o mapa não iluminava, e a arma que passava pelo
 * chão, pelo baú ou pela loja chegava à mochila sem as munições que aceita.
 *
 * Arquivo à parte, sem importar `lib/items.ts` nem `lib/loja.ts`: `items.ts`
 * importa a loja, e a loja lê por aqui sem ciclo. Puro: sem DOM, sem store.
 */

/** Teto do nome do item, em unidades UTF-16: é texto que o jogador lê no cartão e na mochila. */
export const ITEM_NAME_MAX_LENGTH = 60
/** Teto da descrição do item: texto que o jogador lê no detalhe do inventário. */
export const ITEM_DESCRICAO_MAX = 2000
/** Teto do nome da categoria ("Consumível"). */
export const ITEM_CATEGORIA_MAX = 40
/** Teto do preço em berries: cabe com folga em `Number.isSafeInteger`, e a tela não desenha "1e+21". */
export const ITEM_PRECO_MAX = 1_000_000_000_000
/** Teto da pilha numa vaga. */
export const ITEM_QUANTIDADE_MAX = 9999
/** Teto de munições que uma arma aceita (a lista do item vira rolagem sem fim); vale no Acervo e na vaga. */
export const MUNICOES_POR_ARMA_MAX = 20
/** Id do item do acervo (`item_<uuid>` tem 41). */
const ITEM_ID_MAX = 80
const FORMA_DO_ITEM_ID = /^[A-Za-z0-9_-]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** O id com a forma dos do Acervo. */
export function ehIdDeItemDoAcervo(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.length <= ITEM_ID_MAX && FORMA_DO_ITEM_ID.test(value)
}

/** Nome aparado e cortado no teto. Não deixa meia letra: surrogate alto sozinho no fim sai. */
export function cleanItemName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length <= ITEM_NAME_MAX_LENGTH) return trimmed
  const cut = trimmed.slice(0, ITEM_NAME_MAX_LENGTH)
  const last = cut.charCodeAt(cut.length - 1)
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut
}

/** Corta em `max` unidades UTF-16 sem deixar meio emoji no fim. */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

function inteiroEntre(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max ? value : null
}

/** A munição que a vaga declara (`DadosDoItem.municoes`). */
export type MunicaoDaVaga = NonNullable<DadosDoItem['municoes']>[number]

/**
 * As munições lidas de fora: id com a forma dos do Acervo e nome limpo, sem
 * repetir o id, no teto. Entrada torta sai sozinha; lista vazia = sem o campo
 * (o item de antes abre igual).
 */
export function municoesDaVagaLidas(value: unknown): { municoes?: MunicaoDaVaga[] } {
  if (!Array.isArray(value)) return {}
  const vistas = new Set<string>()
  const municoes: MunicaoDaVaga[] = []
  for (const bruta of value) {
    if (!isRecord(bruta) || !ehIdDeItemDoAcervo(bruta.itemId)) continue
    const nome = typeof bruta.nome === 'string' ? cleanItemName(bruta.nome) : ''
    if (nome === '' || vistas.has(bruta.itemId)) continue
    vistas.add(bruta.itemId)
    municoes.push({ itemId: bruta.itemId, nome })
    if (municoes.length >= MUNICOES_POR_ARMA_MAX) break
  }
  return municoes.length === 0 ? {} : { municoes }
}

/**
 * Os dados do acervo que um item traz (`DadosDoItem`), lidos de fora: do
 * disco, do recorte do jogador, do snapshot. Campo torto SAI sozinho e o item
 * fica (com id e nome ele ainda é item); imagem só como referência de mídia —
 * a embutida engordaria todo snapshot e o caminho de disco não sai do mestre.
 */
export function dadosDoItemLidos(value: Record<string, unknown>): DadosDoItem {
  const dados: DadosDoItem = {}
  if (ehIdDeItemDoAcervo(value.itemId)) dados.itemId = value.itemId
  if (ehRefDeMidia(value.imagem)) dados.imagem = value.imagem
  if (typeof value.descricao === 'string' && value.descricao.trim() !== '') dados.descricao = cortado(value.descricao, ITEM_DESCRICAO_MAX)
  if (typeof value.categoria === 'string' && value.categoria.trim() !== '') dados.categoria = cortado(value.categoria.trim(), ITEM_CATEGORIA_MAX)
  const preco = inteiroEntre(value.preco, 0, ITEM_PRECO_MAX)
  if (preco !== null) dados.preco = preco
  const quantidade = inteiroEntre(value.quantidade, 1, ITEM_QUANTIDADE_MAX)
  // 1 é o ausente: a mochila gravada continua igual à de antes do campo.
  if (quantidade !== null && quantidade > 1) dados.quantidade = quantidade
  if (value.empilhavel === true) dados.empilhavel = true
  // ITEM QUE ILUMINA: a luz torta sai sozinha, e o item fica (só não ilumina).
  const luz = luzDoItemLida(value.luz)
  if (luz !== undefined) dados.luz = luz
  // MUNIÇÃO: a arma leva as munições que aceita por toda porta (chão, baú, loja, mochila).
  const { municoes } = municoesDaVagaLidas(value.municoes)
  if (municoes !== undefined) dados.municoes = municoes
  // EFEITO DO ITEM (Fase 7): as peças por toda porta do item; torto sai sozinho (o item fica, sem efeito).
  const efeito = efeitoDoItemLido(value.efeito)
  if (efeito !== undefined) dados.efeito = efeito
  const resumo = efeitoResumoLido(value.efeitoResumo)
  if (resumo !== undefined) dados.efeitoResumo = resumo
  return dados
}

/** Teto da frase do efeito na vaga (SISTEMA.md §5.1). */
export const EFEITO_RESUMO_MAX = 200
/** Teto das peças guardadas do efeito, em letras de JSON: o mesmo da mecânica do cartão (`lib/personagem.ts`). */
const MECANICA_DO_ITEM_MAX = 16_000
const GASTOS_DO_ITEM: readonly EfeitoDoItem['gasta'][] = ['um', 'nada']
const ONDES_DO_ITEM: readonly EfeitoDoItem['onde'][] = ['sempre', 'soNaBatalha', 'soFora']

/**
 * O efeito lido de fora. As peças ficam OPACAS (uma cópia JSON, no teto):
 * quem usa relê por `lerMecanica`, que diz "atualize o app" ou "inválida"
 * sem perder nada. `undefined` = sem efeito, ou forma torta.
 */
export function efeitoDoItemLido(value: unknown): EfeitoDoItem | undefined {
  if (!isRecord(value) || !isRecord(value.mecanica)) return undefined
  const gasta = GASTOS_DO_ITEM.find((opcao) => opcao === value.gasta)
  const onde = ONDES_DO_ITEM.find((opcao) => opcao === value.onde)
  if (gasta === undefined || onde === undefined) return undefined
  let texto: string
  try {
    texto = JSON.stringify(value.mecanica)
  } catch {
    return undefined
  }
  if (texto.length > MECANICA_DO_ITEM_MAX) return undefined
  const copia = pecasDoTexto(texto)
  return copia === null ? undefined : { mecanica: copia, gasta, onde }
}

/** As peças guardadas como JSON puro (a cópia que a vaga leva); `null` = não é peça, ou passa do teto. */
export function pecasDoEfeito(mecanica: Readonly<Record<string, unknown>>): PecasDoEfeito | null {
  let texto: string
  try {
    texto = JSON.stringify(mecanica)
  } catch {
    return null
  }
  return texto.length > MECANICA_DO_ITEM_MAX ? null : pecasDoTexto(texto)
}

function pecasDoTexto(texto: string): PecasDoEfeito | null {
  const copia: unknown = JSON.parse(texto)
  return isRecord(copia) ? (copia as PecasDoEfeito) : null // saiu de JSON.stringify: todo valor de dentro já é JSON, por construção
}

/** A frase do efeito: uma linha, aparada, no teto (sem meio emoji). */
export function efeitoResumoLido(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const linha = value.replace(/\s+/g, ' ').trim()
  return linha === '' ? undefined : cortado(linha, EFEITO_RESUMO_MAX)
}

/**
 * O item como vai ao JOGADOR (decisão C8): sem as peças do efeito, só a
 * frase. O host lê o efeito da cópia DELE; o pacote fica leve e ninguém
 * forja efeito. Sem efeito, a mesma referência.
 */
export function semAsPecasDoEfeito<T extends DadosDoItem>(item: T): Omit<T, 'efeito'> {
  if (item.efeito === undefined) return item
  const { efeito: _doMestre, ...semPecas } = item
  return semPecas
}
