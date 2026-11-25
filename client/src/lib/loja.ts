import type { LojaItem, MapData, Pin } from '../types/map'
import { dadosDoItemLidos, ehIdDeItemDoAcervo, ITEM_PRECO_MAX, semAsPecasDoEfeito } from './leituraDoItem'

/**
 * LOJA COM PREÇOS — a banca de um pino: mercadorias com nome, preço e estoque.
 * O jogador toca "Quero" no cartão e o pedido chega ao mestre, que vende (o
 * estoque cai um e a mercadoria vai para a mochila de quem comprou) ou não.
 * Aqui mora a parte pura: ler do disco (ou da rede), o que o jogador pode
 * receber e o efeito de vender. Sem DOM, sem store.
 */

/** Quantas mercadorias uma banca guarda (no disco, no painel e no recorte). */
export const LOJA_ITENS_MAX = 30
/**
 * Teto do nome da mercadoria: o mesmo `ITEM_NAME_MAX_LENGTH` do item da
 * mochila (`lib/items.ts`), para onde ela vai quando vendida. Repetido e não
 * importado: `lib/items.ts` importa este arquivo, e a constante lida na carga
 * de um ciclo de imports chegaria antes de existir. `loja.test.ts` confere.
 */
export const LOJA_NOME_MAX = 60
/** Teto do texto do preço antigo que não virou número ("uma vela"), guardado para o mestre conferir. */
export const LOJA_PRECO_MAX = 40
/** Maior estoque que o painel aceita. */
export const LOJA_ESTOQUE_MAX = 999

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Fase 5: a coisa do Acervo que a mercadoria vende, como veio de fora. Só
 * entra com o id do Acervo; o resto passa pela MESMA leitura do item no chão,
 * no baú e na mochila (`dadosDoItemLidos`, 18/11/2026): a luz da tocha e as
 * munições da arma voltam do disco, e a mercadoria não é pilha (sem
 * `quantidade`: a venda é de um). `undefined` = mercadoria digitada.
 */
function coisaDaMercadoria(value: unknown): LojaItem['acervo'] {
  if (!isRecord(value) || !ehIdDeItemDoAcervo(value.itemId)) return undefined
  const { quantidade: _umPorVenda, ...dados } = dadosDoItemLidos(value)
  return { ...dados, itemId: value.itemId }
}

/*
 * O PREÇO DA BANCA NUMA FONTE SÓ (levantamento de 25/11/2026, nº 2): antes o
 * jogador lia um texto livre e a venda cobrava o número do Acervo copiado na
 * escolha. Agora a fonte é o número, e `LojaItem.preco` guarda só uma de três
 * formas (o disco antigo é convertido por `precoLido`, na leitura):
 *
 *   ''          sem preço próprio: segue o Acervo de agora; a digitada sai grátis
 *   só dígitos  o preço próprio desta banca, em berries (0 = grátis)
 *   outro texto o preço antigo que não virou número ("uma vela"): o mestre
 *               confere e, até lá, a coisa do Acervo com preço vende por
 *               ele, e a outra não se vende (nada sai de graça em silêncio)
 */

/** O preço próprio da banca, como `precoLido` e o painel gravam. */
const SO_DIGITOS = /^\d+$/
/**
 * O preço antigo que vira número: "5", "3 moedas", "1.500 berries" (o
 * separador de milhar do Brasil, como o Acervo escrevia), "฿ 50". Número com
 * outra palavra ("2 velas") não é moeda: fica para o mestre conferir.
 */
const PRECO_ANTIGO = /^(?:฿\s*)?(\d{1,3}(?:\.\d{3})+|\d+)\s*(?:moedas?|berry|berries|beli|฿)?$/i
/** O preço antigo que já dizia grátis. */
const GRATIS_ANTIGO = /^(?:gr[aá]tis|de gra[cç]a)$/i

/** O número do preço antigo em berries; `null` = não é um preço que se leia (o mestre confere). */
function numeroDoPrecoAntigo(texto: string): number | null {
  if (GRATIS_ANTIGO.test(texto)) return 0
  const achado = PRECO_ANTIGO.exec(texto)
  if (achado === null) return null
  const numero = Number(achado[1].replaceAll('.', ''))
  return Number.isSafeInteger(numero) && numero <= ITEM_PRECO_MAX ? numero : null
}

/**
 * O preço como veio do disco (ou da rede), já numa das três formas de hoje.
 * O texto que a escolha da coisa copiava do Acervo ("50 berries" com a coisa
 * de 50) volta a ser vazio: era a cópia, não um preço do mestre, e assim a
 * banca passa a seguir o Acervo. Só dígitos é sempre preço próprio, mesmo
 * igual ao do Acervo.
 */
function precoLido(texto: string, acervo: LojaItem['acervo']): string {
  const limpo = texto.trim()
  if (limpo === '') return ''
  const numero = numeroDoPrecoAntigo(limpo)
  if (numero === null) return limpo.slice(0, LOJA_PRECO_MAX)
  const copiaDoAcervo = acervo !== undefined && numero === acervo.preco && !SO_DIGITOS.test(limpo)
  return copiaDoAcervo ? '' : String(numero)
}

/*
 * As leituras abaixo passam pelo `precoLido` de novo: a loja que chegou sem
 * passar pelo disco (ainda com "3 moedas") dá o mesmo número que a lida.
 */

/** O preço próprio da banca, em berries; `null` = não tem (segue o Acervo) ou o texto antigo espera o mestre. */
export function precoProprio(item: Pick<LojaItem, 'preco' | 'acervo'>): number | null {
  const lido = precoLido(item.preco, item.acervo)
  return SO_DIGITOS.test(lido) ? Number(lido) : null
}

/** O texto antigo que não virou número, para o mestre conferir; `null` = nada a conferir. */
export function precoAConferir(item: Pick<LojaItem, 'preco' | 'acervo'>): string | null {
  const lido = precoLido(item.preco, item.acervo)
  return lido === '' || SO_DIGITOS.test(lido) ? null : lido
}

/**
 * O PREÇO DO ACERVO DE AGORA: a mercadoria sem preço próprio cobra o que o
 * Acervo diz hoje, e não a cópia da escolha. O Acervo mora no disco do app do
 * MESTRE: o store do Acervo (`stores/acervoDeItensStore.ts`) põe os preços
 * aqui a cada mudança, junto das munições (`lib/batalha/municoesDoAcervo.ts`).
 * No app do jogador fica vazio: ele recebe o preço já resolvido no recorte
 * (`lojaParaJogador`), que a sala reenvia quando um preço do Acervo muda.
 */
let precosDoAcervo: ReadonlyMap<string, number | null> = new Map()

type PrecoDoAcervo = { id: string; preco: number | null }

/** Troca os preços pelos do Acervo de agora (`null` = a coisa não tem preço). */
export function definirPrecosDoAcervo(itens: readonly PrecoDoAcervo[]): void {
  precosDoAcervo = new Map(itens.map((item) => [item.id, item.preco]))
}

/** Algum preço do Acervo mudou (coisa nova, apagada ou com outro preço): o recorte dos jogadores precisa sair de novo. */
export function precosDoAcervoMudaram(antes: readonly PrecoDoAcervo[], agora: readonly PrecoDoAcervo[]): boolean {
  if (antes.length !== agora.length) return true
  const precoAntes = new Map(antes.map((item) => [item.id, item.preco]))
  return agora.some((item) => precoAntes.get(item.id) !== item.preco)
}

/** O preço da coisa: o do Acervo de agora; a coisa que saiu do Acervo (ou o Acervo ainda não lido) fica com a cópia. `null` = sem preço. */
function precoDaCoisa(coisa: NonNullable<LojaItem['acervo']>): number | null {
  const agora = precosDoAcervo.get(coisa.itemId)
  if (agora !== undefined) return agora
  return coisa.preco ?? null
}

/** O que a mercadoria cobra sem preço próprio: o da coisa do Acervo; a digitada (ou a coisa sem preço) sai grátis. */
export function precoSemOProprio(item: Pick<LojaItem, 'acervo'>): number {
  return item.acervo === undefined ? 0 : (precoDaCoisa(item.acervo) ?? 0)
}

/**
 * O que a venda cobra da bolsa, em berries, e o que o jogador lê: o preço
 * próprio da banca; sem ele, o da coisa do Acervo; sem nenhum, 0 (grátis).
 * Com o preço antigo esperando o mestre (`precoAConferir`, a marca dele fica),
 * a coisa do Acervo com preço segue vendendo por ele, como vendia antes do
 * preço da banca virar número; `null` = a digitada ou a coisa sem preço: não
 * se vende até ele conferir (nada sai de graça em silêncio).
 */
export function precoEmMoedas(item: Pick<LojaItem, 'preco' | 'acervo'>): number | null {
  if (precoAConferir(item) !== null) return item.acervo === undefined ? null : precoDaCoisa(item.acervo)
  return precoProprio(item) ?? precoSemOProprio(item)
}

/** "120 berries" com o separador de milhar do Brasil. */
export function precoEmBerries(preco: number): string {
  return `${preco.toLocaleString('pt-BR')} ${preco === 1 ? 'berry' : 'berries'}`
}

/** O preço da mercadoria em texto, como o jogador lê e a Caixa do mestre mostra; `null` = o mestre ainda confere o preço antigo. */
export function textoDoPrecoDaBanca(preco: number | null): string {
  if (preco === null) return 'Preço a conferir'
  return preco === 0 ? 'Grátis' : precoEmBerries(preco)
}

/** Estoque de verdade: inteiro de 0 ao teto. Qualquer outra coisa não é estoque. */
export function isEstoque(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= LOJA_ESTOQUE_MAX
}

/**
 * A loja como veio de fora (disco, ou o mapa que chega pela rede). Item sem
 * `id` ou sem `nome` em texto cai (os bons ficam); id repetido fica só o
 * primeiro — o "Quero" acharia o item errado; preço que não é texto vira
 * vazio, o texto livre antigo vira número quando dá (`precoLido`); estoque
 * fora da forma volta ausente. Nome e preço são cortados no
 * teto, a lista no máximo de itens. LISTA DO QUE VAI: campo que o item trouxer
 * e o app não conhece nunca é copiado. Nada que preste = ausente: mapa antigo
 * não ganha o campo.
 */
export function lerLojaDoArquivo(value: unknown): LojaItem[] | undefined {
  if (!Array.isArray(value)) return undefined
  const itens: LojaItem[] = []
  for (const bruto of value) {
    if (itens.length >= LOJA_ITENS_MAX) break
    if (!isRecord(bruto)) continue
    const { id, nome, preco, estoque } = bruto
    if (typeof id !== 'string' || id === '' || typeof nome !== 'string') continue
    if (itens.some((item) => item.id === id)) continue
    const acervo = coisaDaMercadoria(bruto.acervo)
    const item: LojaItem = { id, nome: nome.slice(0, LOJA_NOME_MAX), preco: typeof preco === 'string' ? precoLido(preco, acervo) : '' }
    if (isEstoque(estoque)) item.estoque = estoque
    if (acervo !== undefined) item.acervo = acervo
    itens.push(item)
  }
  return itens.length === 0 ? undefined : itens
}

/**
 * O que o JOGADOR recebe da banca: cada mercadoria com nome escrito, só com
 * id, nome, preço e estoque. Mercadoria sem nome (o mestre ainda escrevendo)
 * não sai; pino de viagem, alavanca e minigame não são banca. `null` = nada a mostrar.
 *
 * Quem chama responde por o jogador PODER ver o pino: o recorte da névoa
 * (`lib/fogFilter.ts`) só chama isto para pino que já passou. O cartão do
 * jogador chama de novo sobre o que chegou pela rede: o mapa do snapshot não
 * é conferido campo a campo, e item torto não pode quebrar a tela.
 */
export function lojaParaJogador(pin: Pick<Pin, 'kind' | 'loja'>): LojaItem[] | null {
  if (pin.kind === 'viagem' || pin.kind === 'alavanca' || pin.kind === 'minigame') return null
  const itens = (lerLojaDoArquivo(pin.loja) ?? []).filter((item) => item.nome.trim() !== '')
  return itens.length === 0 ? null : itens.map(mercadoriaParaJogador)
}

/**
 * Uma mercadoria como o jogador a recebe. O preço vai já resolvido, como preço
 * próprio: o app do jogador não tem o Acervo, e assim o que ele lê é o que a
 * venda cobra (lido de novo lá, dá o mesmo número). O texto a conferir vai
 * como está.
 */
function mercadoriaParaJogador(item: LojaItem): LojaItem {
  const preco = precoEmMoedas(item)
  const resolvida = preco === null ? item : { ...item, preco: String(preco) }
  // EFEITO DO ITEM (Fase 7, decisão C8): a mercadoria do Acervo vai ao jogador com a frase do efeito, sem as peças.
  if (resolvida.acervo?.efeito === undefined) return resolvida
  return { ...resolvida, acervo: { ...semAsPecasDoEfeito(resolvida.acervo), itemId: resolvida.acervo.itemId } }
}

/** A mercadoria `itemId` que se pode pedir agora: existe no que o jogador recebe, não acabou e tem preço em número (a do preço a conferir espera o mestre). */
export function itemAVenda(pin: Pin, itemId: string): LojaItem | null {
  const item = (lojaParaJogador(pin) ?? []).find((i) => i.id === itemId)
  return item === undefined || item.estoque === 0 || precoEmMoedas(item) === null ? null : item
}

/** O estoque dito ao jogador; `null` = sem conta (não se diz nada). */
export function textoDoEstoque(item: LojaItem): string | null {
  if (item.estoque === undefined) return null
  if (item.estoque === 0) return 'Acabou'
  return `${item.estoque} em estoque`
}

/**
 * "Vender": tira um do estoque da mercadoria `itemId` do pino `pinId`. Item
 * sem conta de estoque, já esgotado, pino ou item que sumiu: o mesmo `map`
 * (nada a mudar). Pura e reaplicável — entra também nos passos do desfazer
 * (`applyItemChange`, `lib/items.ts`).
 */
export function venderItem(map: MapData, pinId: string, itemId: string): MapData {
  const pin = map.pins.find((p) => p.id === pinId)
  const item = pin?.loja?.find((i) => i.id === itemId)
  if (pin === undefined || item === undefined || item.estoque === undefined || item.estoque === 0) return map
  const restante = item.estoque - 1
  const loja = (pin.loja ?? []).map((i) => (i.id === itemId ? { ...i, estoque: restante } : i))
  return { ...map, pins: map.pins.map((p) => (p.id === pinId ? { ...p, loja } : p)) }
}

/** As duas lojas são a mesma? `undefined` só é igual a `undefined`. */
export function sameLoja(a: readonly LojaItem[] | undefined, b: readonly LojaItem[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return (
    a.length === b.length &&
    a.every((item, i) => {
      const outro = b[i]
      return (
        outro !== undefined &&
        item.id === outro.id &&
        item.nome === outro.nome &&
        item.preco === outro.preco &&
        item.estoque === outro.estoque &&
        // Fase 5: trocar a coisa do Acervo da mercadoria também é mudança (objeto pequeno e já limpo pela leitura).
        JSON.stringify(item.acervo) === JSON.stringify(outro.acervo)
      )
    })
  )
}

/** A mercadoria em branco que o painel acrescenta (sem preço próprio: digitada, sai grátis até o mestre escrever um). */
export function novaMercadoria(id: string): LojaItem {
  return { id, nome: '', preco: '' }
}
