import type { CarriedItem, LojaItem } from '../../types/map'
import { cleanItemName, quantidadeDe, type ItemParaDar } from '../items'
import { precoEmBerries, precoEmMoedas } from '../loja'
import type { Personagem } from '../personagem'
import { MOEDAS_MAX, moedasDe } from '../troca'
import { mochilaComOPenteDevolvido, type AcervoDaMochila, type Recusa } from './armaNaMochila'
import { darAVarias, desfazerDarAVarias, type RecebidoNaFicha } from './darAVarias'
import { fichaComMochila } from './juncao'

/**
 * A BANCA DO MESTRE (docs/design/itens-rework/PLANO.md, etapa E3; decisão 16): o mestre escolhe quem
 * compra e compra pela ficha, ou vende à banca. O preço que aparece é o preço cobrado
 * (`precoEmMoedas`, o mesmo do cartão do jogador); a banca paga metade do preço dela; a arma
 * equipada precisa ser guardada antes, e as balas do pente voltam à mochila antes de a arma sair
 * (A8). Puras: quem chama grava a ficha e o estoque do pino juntos, com o Desfazer.
 */

/** A compra que deu: a ficha nova, quantos entraram, quanto pagou e as vagas (para o Desfazer). */
export interface Compra {
  personagem: Personagem
  entraram: number
  pago: number
  recebido: RecebidoNaFicha
}

/** Como a mercadoria vai para a mochila: a coisa do Acervo inteira, ou a digitada só com o nome (empilha, para caber "2"). */
function mercadoriaParaDar(mercadoria: LojaItem, quantidade: number): ItemParaDar {
  const nome = cleanItemName(mercadoria.nome)
  if (mercadoria.acervo !== undefined) return { ...mercadoria.acervo, nome }
  return quantidade > 1 ? { nome, empilhavel: true } : { nome }
}

/** COMPRAR `quantidade` da mercadoria para a ficha: tira o preço que a banca mostra vezes o que entrou. */
export function comprarNaBanca(personagem: Personagem, mercadoria: LojaItem, quantidade: number, novoId: () => string): Compra | Recusa {
  const nome = cleanItemName(mercadoria.nome)
  const preco = precoEmMoedas(mercadoria)
  if (nome === '') return { recusa: 'A mercadoria não tem nome.' }
  if (preco === null) return { recusa: `${nome} ainda não tem preço em berries: confira o preço na banca.` }
  if (!Number.isSafeInteger(quantidade) || quantidade < 1) return { recusa: 'Diga quantos.' }
  if (mercadoria.estoque !== undefined && quantidade > mercadoria.estoque) return { recusa: mercadoria.estoque === 0 ? `${nome} acabou na banca.` : `Só há ${mercadoria.estoque} ${nome} na banca.` }
  const moedas = moedasDe(personagem)
  const total = preco * quantidade
  if (total > moedas) return { recusa: `${personagem.nome} tem ${precoEmBerries(moedas)}; ${quantidade} ${nome} custam ${precoEmBerries(total)}. Faltam ${precoEmBerries(total - moedas)}.` }
  const dado = darAVarias([personagem], [personagem.id], mercadoriaParaDar(mercadoria, quantidade), quantidade, novoId)
  const recebido = dado.recebidos[0]
  const comItem = dado.personagens[0]
  if (recebido === undefined || comItem === undefined) return { recusa: `${personagem.nome} já carrega o máximo de ${nome}.` }
  // A pilha no teto recebe menos que o pedido: cobra só o que entrou.
  const pago = preco * recebido.entraram
  return { personagem: fichaComMochila(comItem, comItem.mochila ?? [], moedas - pago), entraram: recebido.entraram, pago, recebido }
}

/** O Desfazer da compra, sobre a ficha de AGORA: o que entrou sai (o que já foi usado fica) e o pago volta à bolsa. */
export function desfazerCompra(personagem: Personagem, compra: Pick<Compra, 'recebido' | 'pago'>): Personagem {
  const semOItem = desfazerDarAVarias(personagem, [compra.recebido])
  return fichaComMochila(semOItem, semOItem.mochila ?? [], Math.min(moedasDe(semOItem) + compra.pago, MOEDAS_MAX))
}

/** A vaga com outra quantidade; 1 tira o campo (ausente === 1). */
function comQuantidade(item: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antes, ...semQuantidade } = item
  return quantidade > 1 ? { ...semQuantidade, quantidade } : semQuantidade
}

/** O preço que a banca cobra pelo item da vaga (a mercadoria do mesmo `itemId`), senão o do Acervo. `null` = sem preço. */
export function precoDaBancaPara(vaga: Pick<CarriedItem, 'itemId' | 'preco'>, loja: readonly LojaItem[], precoDoAcervo: (itemId: string) => number | null | undefined): number | null {
  const daBanca = vaga.itemId === undefined ? undefined : loja.find((mercadoria) => mercadoria.acervo?.itemId === vaga.itemId)
  const naBanca = daBanca === undefined ? null : precoEmMoedas(daBanca)
  if (naBanca !== null) return naBanca
  const doAcervo = vaga.itemId === undefined ? undefined : precoDoAcervo(vaga.itemId)
  if (doAcervo !== undefined) return doAcervo
  return vaga.preco ?? null
}

/** A banca paga metade do preço dela (decisão 16), para baixo. */
export function precoDeVenda(precoDaBanca: number): number {
  return Math.floor(precoDaBanca / 2)
}

/** A venda que deu: a ficha nova, quanto recebeu e quantas balas do pente voltaram. */
export interface Venda {
  personagem: Personagem
  recebeu: number
  devolvidas: number
  /** A mercadoria da banca que vende o mesmo item: o estoque dela sobe 1. */
  mercadoriaId: string | null
}

/** VENDER 1 do item da vaga `vagaId` à banca. A arma equipada recusa: guarde antes. */
export function venderABanca(personagem: Personagem, vagaId: string, loja: readonly LojaItem[], acervo: Pick<AcervoDaMochila, 'paraDar'>, precoDoAcervo: (itemId: string) => number | null | undefined, freshId: string): Venda | Recusa {
  const mochila = personagem.mochila ?? []
  const vaga = mochila.find((item) => item.id === vagaId)
  if (vaga === undefined) return { recusa: 'O item já não está na mochila.' }
  if (vaga.equipado === true) return { recusa: `Guarde ${vaga.nome} antes de vender.` }
  const precoBanca = precoDaBancaPara(vaga, loja, precoDoAcervo)
  if (precoBanca === null) return { recusa: `${vaga.nome} não tem preço: a banca não compra.` }
  const recebeu = precoDeVenda(precoBanca)
  const devolvido = mochilaComOPenteDevolvido(mochila, vagaId, acervo, freshId)
  const resta = quantidadeDe(vaga) - 1
  const semUm = devolvido.mochila.flatMap((item): CarriedItem[] => (item.id !== vagaId ? [item] : resta >= 1 ? [comQuantidade(item, resta)] : []))
  const mercadoria = vaga.itemId === undefined ? undefined : loja.find((candidata) => candidata.acervo?.itemId === vaga.itemId)
  return {
    personagem: fichaComMochila(personagem, semUm, Math.min(moedasDe(personagem) + recebeu, MOEDAS_MAX)),
    recebeu,
    devolvidas: devolvido.devolvidas,
    mercadoriaId: mercadoria?.id ?? null,
  }
}

/** A loja com o estoque da mercadoria `mercadoriaId` mudado em `delta` (sem conta de estoque: a MESMA loja). */
export function lojaComEstoque(loja: readonly LojaItem[], mercadoriaId: string, delta: number): LojaItem[] {
  return loja.map((mercadoria) => (mercadoria.id !== mercadoriaId || mercadoria.estoque === undefined ? mercadoria : { ...mercadoria, estoque: Math.max(0, mercadoria.estoque + delta) }))
}

