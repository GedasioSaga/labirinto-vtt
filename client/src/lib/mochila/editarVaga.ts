import type { CarriedItem } from '../../types/map'
import { cleanItemName, dadosDoItemLidos, ITEM_PRECO_MAX, ITEM_QUANTIDADE_MAX, quantidadeDe } from '../items'

/**
 * O MESTRE EDITA A MOCHILA DO JOGADOR (pedido de 16/11/2026 11h03: "quero que
 * seja possível eu adicionar e editar itens no inventário dos jogadores"):
 * as contas da vaga editada e do Desfazer, sobre uma mochila qualquer — a da
 * ficha (a dona) ou a do boneco (o caminho dos itens, que leva à ficha).
 * Puras: quem grava é a tela (`components/MochilaDoMestre.tsx`).
 */

/** O que o "Editar" da vaga muda. Preço `null` = sem preço. */
export interface MudancaNaVaga {
  nome: string
  descricao: string
  categoria: string
  preco: number | null
  quantidade: number
}

/** A quantidade que a vaga aceita: inteira, de 1 a `ITEM_QUANTIDADE_MAX`. `null` = torta. */
export function quantidadeValida(valor: number): number | null {
  return Number.isSafeInteger(valor) && valor >= 1 && valor <= ITEM_QUANTIDADE_MAX ? valor : null
}

/** O preço que a vaga aceita: inteiro de 0 a `ITEM_PRECO_MAX`, ou `null` (sem preço). `undefined` = torto. */
export function precoValido(valor: number | null): number | null | undefined {
  if (valor === null) return null
  return Number.isSafeInteger(valor) && valor >= 0 && valor <= ITEM_PRECO_MAX ? valor : undefined
}

/**
 * A vaga `vagaId` com os campos do "Editar". Os textos passam pela mesma
 * leitura do disco (`dadosDoItemLidos`: aparados, nos tetos); a imagem e o
 * item do Acervo ficam. Quantidade acima de 1 faz a vaga empilhar (é o que o
 * número da vaga quer dizer). `null` = nada a gravar: a vaga sumiu, o nome
 * ficou vazio, a quantidade ou o preço estão tortos.
 */
export function mochilaComAVagaEditada(mochila: readonly CarriedItem[], vagaId: string, mudanca: MudancaNaVaga): CarriedItem[] | null {
  const vaga = mochila.find((item) => item.id === vagaId)
  const nome = cleanItemName(mudanca.nome)
  const quantidade = quantidadeValida(mudanca.quantidade)
  const preco = precoValido(mudanca.preco)
  if (vaga === undefined || nome === '' || quantidade === null || preco === undefined) return null
  const lidos = dadosDoItemLidos({ descricao: mudanca.descricao, categoria: mudanca.categoria, ...(preco === null ? {} : { preco }) })
  const editada: CarriedItem = {
    id: vaga.id,
    nome,
    ...(vaga.itemId === undefined ? {} : { itemId: vaga.itemId }),
    ...(vaga.imagem === undefined ? {} : { imagem: vaga.imagem }),
    ...lidos,
    ...(quantidade > 1 ? { quantidade } : {}),
    ...(vaga.empilhavel === true || quantidade > 1 ? { empilhavel: true as const } : {}),
    // O "Editar" não mexe nas munições da arma: a Garrucha renomeada continua atirando as mesmas balas.
    ...(vaga.municoes === undefined ? {} : { municoes: vaga.municoes }),
    // Nem na luz: o Lampião renomeado continua iluminando, e aceso se estava.
    ...(vaga.luz === undefined ? {} : { luz: vaga.luz }),
    ...(vaga.acesa === true && vaga.luz !== undefined ? { acesa: true as const } : {}),
  }
  return mochila.map((item) => (item === vaga ? editada : item))
}

/** A vaga `vagaId` com outra quantidade (o − e o + do "Editar"), no teto e no piso. Mesma regra do "Editar". */
export function quantidadeSomada(vaga: Pick<CarriedItem, 'quantidade'>, delta: number): number {
  return Math.min(Math.max(quantidadeDe(vaga) + delta, 1), ITEM_QUANTIDADE_MAX)
}

/**
 * O DESFAZER do "Editar" e do "+ Adicionar": a vaga `vagaId` volta a ser
 * `antes` (no mesmo lugar); `antes` `null` = a vaga nasceu agora e sai. Sobre
 * a mochila de AGORA: o resto do que mudou depois fica. A vaga que já não
 * está lá, com `antes`, volta no fim.
 */
export function mochilaSemAMudanca(mochila: readonly CarriedItem[], vagaId: string, antes: CarriedItem | null): CarriedItem[] {
  const existe = mochila.some((item) => item.id === vagaId)
  if (antes === null) return mochila.filter((item) => item.id !== vagaId)
  return existe ? mochila.map((item) => (item.id === vagaId ? antes : item)) : [...mochila, antes]
}
