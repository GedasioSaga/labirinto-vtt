import type { CarriedItem, Token } from '../types/map'
import { chaveDaCondicao, fichaTemCondicao } from './condicaoPorNome'
import { carriedItemsOf, quantidadeDe } from './items'
import { lerPrazo, tirarCondicaoDaFicha } from './prazoDaCondicao'

/**
 * A CURA TIRA O VENENO (16/11/2026). O mestre decidiu, na pergunta "Turnos"
 * (PEDIDOS.md, 15/11): "o efeito some com cura ou quando o mestre tira". O
 * "quando o mestre tira" já existia (o "Tirar" de `PrazosDaFicha`); a cura é
 * daqui. A regra abaixo é DECISÃO DO CLAUDE, não do mestre:
 *
 *  - USAR UM CONSUMÍVEL QUE CURA tira o Envenenado (a pastilha e o prazo dele)
 *    de quem recebe o item, dentro e fora da batalha. Cura = o nome ou a
 *    descrição do item fala em curar ("Cura 2d6 de Vida", "Recupera 20 PV"),
 *    o item é um antídoto, um kit médico ou um remédio, ou é a Poção sem
 *    qualificativo (a de cura de todo RPG). Na batalha, o item que a técnica
 *    gasta para curar (o Kit Médico da Medicina) conta como cura.
 *  - O LENTO NÃO SAI com cura: é corpo travado (teia, cansaço), não ferida.
 *    Sai só no fim do prazo ou pelo "Tirar" do mestre.
 *  - O +PV À MÃO do mestre (ajuste rápido da ficha) não tira nada: é só
 *    número. Quer tirar o veneno sem item, o mestre usa o "Tirar".
 *  - O livro do Dragon Ball fica como está: as condições da batalha dele
 *    (`CondicaoAtiva`) têm a regra própria do livro, e a cura daqui só mexe na
 *    pastilha e no prazo da ficha do mapa (`Token`).
 *  - Na batalha One Piece o selo de mesmo nome sai JUNTO (levantamento das
 *    mecânicas duplicadas, Nº 3, decisão do dono "a cura que tira Envenenado
 *    tira o selo também"; `stores/batalha/golpe.ts`), e a pastilha com ele. O
 *    `seguradas` (sai só o prazo, a pastilha fica enquanto o selo a segurar)
 *    ficou de antes dessa decisão; a batalha não o passa mais.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** As condições que a cura tira. Só o veneno: o Lento e as outras ficam. */
export const CONDICOES_QUE_A_CURA_TIRA: readonly string[] = ['Envenenado']

/** A Poção sem qualificativo é a de cura ("Porção" é o mesmo item escrito como a mesa escreve). */
const POCOES_DE_CURA: ReadonlySet<string> = new Set(['pocao', 'porcao', 'pocao de cura', 'pocao de vida'])

/** Palavras que dizem cura no nome ou na descrição, já sem acento e em minúsculas (`chaveDaCondicao`). */
const SINAIS_DE_CURA = [
  /\b(cura|curam|curar|curou|curativo|curativa|curativos|curativas)\b/,
  /\bantidoto/,
  /\bkit medico\b/,
  /\bremedio/,
  /\brecupera\w*\b.*\b(vida|pv|hp)\b/,
]

/** O item cura (pelo nome ou pela descrição)? */
export function itemQueCura(item: Pick<CarriedItem, 'nome' | 'descricao'>): boolean {
  const nome = chaveDaCondicao(item.nome)
  if (POCOES_DE_CURA.has(nome)) return true
  const texto = `${nome} ${chaveDaCondicao(item.descricao ?? '')}`
  return SINAIS_DE_CURA.some((sinal) => sinal.test(texto))
}

/** O item se gasta ao usar: o que cura, ou o da categoria Consumível do acervo. */
export function itemQueSeUsa(item: Pick<CarriedItem, 'nome' | 'descricao' | 'categoria'>): boolean {
  return itemQueCura(item) || chaveDaCondicao(item.categoria ?? '') === 'consumivel'
}

/** A ficha sem o prazo de `chave`; a pastilha fica. A MESMA ficha quando não havia prazo. Cru como em `tirarCondicaoDaFicha`: o mapa do disco chega sem guarda. */
function semOPrazo(token: Token, chave: string): Token {
  const prazos = Array.isArray(token.prazosDasCondicoes) ? token.prazosDasCondicoes : []
  const ficam = prazos.filter((prazo) => chaveDaCondicao(lerPrazo(prazo)?.nome ?? '') !== chave)
  if (ficam.length === prazos.length) return token
  const { prazosDasCondicoes: _antigos, ...sem } = token
  return ficam.length === 0 ? sem : { ...sem, prazosDasCondicoes: ficam }
}

/**
 * A cura na ficha: tira cada condição de `CONDICOES_QUE_A_CURA_TIRA`, a
 * pastilha e o prazo. `seguradas` = chaves que um selo da batalha ainda segura
 * na ficha: ali sai só o prazo. Nada a tirar = a MESMA ficha.
 */
export function curarPeloItem(token: Token, seguradas: ReadonlySet<string> = new Set()): Token {
  let ficha = token
  for (const nome of CONDICOES_QUE_A_CURA_TIRA) {
    const chave = chaveDaCondicao(nome)
    ficha = seguradas.has(chave) ? semOPrazo(ficha, chave) : tirarCondicaoDaFicha(ficha, nome)
  }
  return ficha
}

/** O uso de um item da mochila (`usarItemNaFicha`). */
export interface UsoDoItem {
  /** O item como estava antes do uso. */
  item: CarriedItem
  /** A mochila depois do uso: 1 a menos na vaga; a última sai. */
  mochila: CarriedItem[]
  /** A ficha inteira depois do uso: a mochila nova e, se o item cura, sem o veneno. */
  token: Token
  /** As condições que a cura tirou ("Envenenado"); vazio = nenhuma. */
  curou: string[]
}

/**
 * FORA DA BATALHA: a ficha usa 1 do item da vaga `vagaId` (o "Usar" do mestre
 * no inventário da ficha). A vaga perde 1; a última sai. Se o item cura, a
 * cura tira o veneno (`curarPeloItem`, com as `seguradas` da batalha da
 * cena). `null` = a vaga não está na mochila.
 */
export function usarItemNaFicha(token: Token, vagaId: string, seguradas?: ReadonlySet<string>): UsoDoItem | null {
  const mochilaAntes = carriedItemsOf(token)
  const item = mochilaAntes.find((vaga) => vaga.id === vagaId)
  if (item === undefined) return null
  const sobram = quantidadeDe(item) - 1
  const mochila = sobram <= 0 ? mochilaAntes.filter((vaga) => vaga !== item) : mochilaAntes.map((vaga) => (vaga === item ? comQuantidade(vaga, sobram) : vaga))
  const comMochila: Token = { ...token, mochila }
  const curada = itemQueCura(item) ? curarPeloItem(comMochila, seguradas) : comMochila
  const curou = condicoesQueACuraTirou(comMochila, curada)
  if (mochila.length > 0) return { item, mochila, token: curada, curou }
  // Mochila vazia some do token (ausente === vazia), como em `applyItemChange`.
  const { mochila: _vazia, ...semMochila } = curada
  return { item, mochila, token: semMochila, curou }
}

/** A vaga com `quantidade` (1 tira o campo: ausente = 1). */
function comQuantidade(vaga: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antes, ...sem } = vaga
  return quantidade > 1 ? { ...sem, quantidade } : sem
}

/** Os nomes que a cura apagou: a pastilha acesa antes e apagada depois. O prazo que saiu sozinho (pastilha segurada pela batalha) não conta. */
export function condicoesQueACuraTirou(antes: Token, depois: Token): string[] {
  return CONDICOES_QUE_A_CURA_TIRA.filter((nome) => fichaTemCondicao(antes, nome) && !fichaTemCondicao(depois, nome))
}
