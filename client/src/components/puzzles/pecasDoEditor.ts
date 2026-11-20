import { useMemo } from 'react'
import { ACERVO_DE_ITENS_NAO_LIDO, idDoItemDaPeca, itemDaPecaDesenhada, novoItemDoCatalogo, pastaDaPecaDePuzzle, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { escolherImagemDoItem } from '../../lib/imagemDoItem'
import { IDS_DAS_PECAS_DESENHADAS, urlDaPeca } from '../../puzzles/arte/pecas'
import { guardarPecaDesenhada } from '../../puzzles/arte/rasterizar'
import { PECAS_DESENHADAS } from '../../puzzles/padroes'
import { CATEGORIA_DA_PECA_DE_PUZZLE, NOME_DA_PECA_MAX, type IdDaPecaDesenhada } from '../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import type { ResolverDeImagem } from '../../lib/midia'

/**
 * AS PEÇAS DO EDITOR (plano dos puzzles, §1.4; decisão do dono de 19/11: "a
 * biblioteca do editor é a pasta Peça de puzzle do acervo"). O encaixe aponta
 * o `itemId` de um item do acervo. A biblioteca mostra os itens da categoria
 * e, depois deles, as 13 peças desenhadas que ainda não estão lá: usar uma
 * delas põe a peça no acervo antes (o PNG na mídia, como o "+ Peça" do acervo).
 */
export interface PecaDoEditor {
  itemId: string
  nome: string
  descricao: string
  /** A referência `midia:` do item; `null` = sem imagem (ou a desenhada ainda fora do acervo). */
  imagem: string | null
  /** A peça desenhada de onde o item veio (ou virá), para a arte enquanto não está no acervo. */
  desenhada: IdDaPecaDesenhada | null
  noAcervo: boolean
  /** É da categoria "Peça de puzzle" (as outras do acervo também servem, mas vêm depois). */
  daCategoria: boolean
}

const DESENHADA_DO_ITEM: ReadonlyMap<string, IdDaPecaDesenhada> = new Map(IDS_DAS_PECAS_DESENHADAS.map((peca) => [idDoItemDaPeca(peca), peca]))

function ehDaCategoria(item: Pick<ItemDoCatalogo, 'categoria'>): boolean {
  return item.categoria.toLocaleLowerCase('pt-BR') === CATEGORIA_DA_PECA_DE_PUZZLE.toLocaleLowerCase('pt-BR')
}

function pecaDoItem(item: ItemDoCatalogo): PecaDoEditor {
  return { itemId: item.id, nome: item.nome, descricao: item.descricao, imagem: item.imagem, desenhada: DESENHADA_DO_ITEM.get(item.id) ?? null, noAcervo: true, daCategoria: ehDaCategoria(item) }
}

function pecaDesenhadaFora(peca: IdDaPecaDesenhada): PecaDoEditor {
  const { nome, descricao } = PECAS_DESENHADAS[peca]
  return { itemId: idDoItemDaPeca(peca), nome, descricao, imagem: null, desenhada: peca, noAcervo: false, daCategoria: true }
}

/** O `src` da peça: a imagem do item pela mídia da mesa, ou o desenho da peça que ainda não está no acervo. */
export function srcDaPeca(peca: PecaDoEditor | null, resolver: ResolverDeImagem): string | null {
  if (peca === null) return null
  const daMidia = resolver(peca.imagem)
  if (daMidia !== null) return daMidia
  return peca.desenhada !== null ? urlDaPeca(peca.desenhada) : null
}

export interface PecasDoEditor {
  /** A biblioteca: as da categoria no acervo e as desenhadas que faltam. */
  biblioteca: PecaDoEditor[]
  /** Os outros itens do acervo (uma chave, uma joia de outra categoria). */
  outras: PecaDoEditor[]
  /** A peça pelo id do item; `null` = o item não existe mais (apagado do acervo). */
  porId: (itemId: string | null) => PecaDoEditor | null
}

export function usePecasDoEditor(): PecasDoEditor {
  const itens = useAcervoDeItensStore((estado) => estado.itens)
  return useMemo(() => {
    const doAcervo = itens.map(pecaDoItem)
    const ids = new Set(itens.map((item) => item.id))
    const desenhadasFora = IDS_DAS_PECAS_DESENHADAS.filter((peca) => !ids.has(idDoItemDaPeca(peca))).map(pecaDesenhadaFora)
    const biblioteca = [...doAcervo.filter((peca) => peca.daCategoria), ...desenhadasFora]
    const outras = doAcervo.filter((peca) => !peca.daCategoria)
    const porItem = new Map([...doAcervo, ...desenhadasFora].map((peca) => [peca.itemId, peca]))
    return { biblioteca, outras, porId: (itemId) => (itemId === null ? null : (porItem.get(itemId) ?? null)) }
  }, [itens])
}

function exigirAcervo(): void {
  const loja = useAcervoDeItensStore.getState()
  if (!loja.podeGravar) throw new Error(loja.aviso ?? ACERVO_DE_ITENS_NAO_LIDO)
}

/** Pôr a peça desenhada no acervo, se ainda não está. Devolve o id do item; lança com a frase pronta. */
export async function garantirNoAcervo(peca: PecaDoEditor): Promise<string> {
  if (peca.noAcervo || peca.desenhada === null) return peca.itemId
  exigirAcervo()
  const imagem = await guardarPecaDesenhada(peca.desenhada)
  const loja = useAcervoDeItensStore.getState()
  // Gravou enquanto o desenho saía (dois toques): o item já está lá.
  if (loja.itens.some((item) => item.id === peca.itemId)) return peca.itemId
  const lugar = itemDaPecaDesenhada(peca.desenhada, imagem, loja.pastas)
  await loja.salvarItem(lugar.item, lugar.pastas)
  return lugar.item.id
}

/** "Subir peça": a imagem do computador vira um item novo da categoria, na pasta das peças. `null` = cancelou. */
export async function subirPecaPropria(): Promise<string | null> {
  exigirAcervo()
  const imagem = await escolherImagemDoItem()
  if (imagem === null) return null
  const loja = useAcervoDeItensStore.getState()
  const pasta = pastaDaPecaDePuzzle(loja.pastas)
  const base = novoItemDoCatalogo(CATEGORIA_DA_PECA_DE_PUZZLE)
  const item: ItemDoCatalogo = { ...base, nome: 'Peça nova', imagem, ...(pasta === undefined ? {} : { pasta: pasta.id }) }
  await loja.salvarItem(item)
  return item.id
}

/** Nome e descrição da peça (valem em todos os puzzles, porque moram no item do acervo). */
export async function renomearPeca(itemId: string, nome: string, descricao: string): Promise<void> {
  exigirAcervo()
  const loja = useAcervoDeItensStore.getState()
  const item = loja.itens.find((candidato) => candidato.id === itemId)
  if (item === undefined) return
  const limpo = nome.trim().slice(0, NOME_DA_PECA_MAX)
  const proximo = { ...item, nome: limpo === '' ? item.nome : limpo, descricao }
  if (proximo.nome === item.nome && proximo.descricao === item.descricao) return
  await loja.salvarItem(proximo)
}

/** Apagar a peça subida pelo mestre (as desenhadas voltam para a vitrine). */
export async function apagarPeca(itemId: string): Promise<void> {
  exigirAcervo()
  await useAcervoDeItensStore.getState().apagarItem(itemId)
}
