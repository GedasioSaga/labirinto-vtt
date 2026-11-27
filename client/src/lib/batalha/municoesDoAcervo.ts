/**
 * AS MUNIÇÕES QUE A ARMA DO ACERVO ACEITA (pedido de 16/11/2026: "cada arma
 * pode usar certos de munição"): a lista `municoes` de cada arma do Acervo de
 * itens (`lib/acervoDeItens.ts`), com o nome de cada munição, para a leitura
 * da ficha (`armasDe`) mostrar cada uma como bala da arma ligada àquele item.
 *
 * O Acervo mora no disco do app do MESTRE: quem o lê (`stores/acervoDeItensStore.ts`)
 * põe a lista aqui a cada mudança. No mestre (e no host, que confere o tiro do
 * jogador) a arma tem as balas; no app do jogador a lista fica vazia, e o
 * host escolhe a munição do tiro dele (`balaDoPedido`, em `golpe.ts`).
 */

import type { AcervoDaMochila } from '../mochila/armaNaMochila'
import type { BlocosDoItem, EquipamentoDoItem, TipoDoItem } from '../itens/modelo'

export interface MunicaoAceita {
  itemId: string
  nome: string
}

/** O tiro que a munição do Acervo declara (`ItemDoCatalogo.tiro`): o dano e o efeito da bala. */
export interface TiroDoAcervo {
  dano: string
  efeito: string
}

/** O que a lista precisa de cada item do Acervo (o `ItemDoCatalogo` serve: tem o tipo e os blocos da regra). */
export interface ItemComMunicoes extends Pick<BlocosDoItem, 'ataque' | 'golpe' | 'pente' | 'bala' | 'arremesso' | 'equipamento' | 'aoAcertar'> {
  id: string
  nome: string
  municoes?: readonly string[]
  tiro?: TiroDoAcervo
  tipo?: TipoDoItem
}

/**
 * ITENS REFEITOS, E6a: o que a batalha lê do item do Acervo para montar a arma equipada (o tipo e os
 * blocos de regra). O Worker do Lobby e o app do jogador não têm o Acervo: lá vale a `regra` da vaga.
 */
export interface RegraNoAcervo {
  tipo?: TipoDoItem
  /**
   * `equipamento`: a roupa e os bônus dela (CA, Escudo), decisão 8. `aoAcertar`: a condição, o Dano extra e o
   * empurrão da arma e da bala (E6c). Conserto de 27/11/2026 (Bala de Prata): sem ele aqui, o Acervo vencia a
   * `regra` da vaga e o "Ao acertar" sumia no mestre (a Cura reduzida não pegava).
   */
  blocos: Pick<BlocosDoItem, 'ataque' | 'golpe' | 'pente' | 'bala' | 'arremesso' | 'equipamento' | 'aoAcertar'>
}

const NENHUMA: readonly MunicaoAceita[] = []
let porArma: ReadonlyMap<string, readonly MunicaoAceita[]> = new Map()
let tiros: ReadonlyMap<string, TiroDoAcervo> = new Map()
let nomesNoAcervo: ReadonlyMap<string, string> = new Map()
let regras: ReadonlyMap<string, RegraNoAcervo> = new Map()
let versao = 0

function regraDoItem(item: ItemComMunicoes): RegraNoAcervo {
  const blocos: RegraNoAcervo['blocos'] = {}
  if (item.ataque !== undefined) blocos.ataque = item.ataque
  if (item.golpe !== undefined) blocos.golpe = item.golpe
  if (item.pente !== undefined) blocos.pente = item.pente
  if (item.bala !== undefined) blocos.bala = item.bala
  if (item.arremesso !== undefined) blocos.arremesso = item.arremesso
  if (item.equipamento !== undefined) blocos.equipamento = item.equipamento
  if (item.aoAcertar !== undefined) blocos.aoAcertar = item.aoAcertar
  return item.tipo === undefined ? { blocos } : { tipo: item.tipo, blocos }
}

/** Troca a lista inteira pela do Acervo de agora. Munição que saiu do Acervo sai da arma. */
export function definirMunicoesDasArmas(itens: readonly ItemComMunicoes[]): void {
  const nomes = new Map(itens.map((item) => [item.id, item.nome]))
  const novo = new Map<string, readonly MunicaoAceita[]>()
  for (const item of itens) {
    const aceitas = (item.municoes ?? []).flatMap((itemId) => {
      const nome = nomes.get(itemId)
      return nome === undefined ? [] : [{ itemId, nome }]
    })
    if (aceitas.length > 0) novo.set(item.id, aceitas)
  }
  porArma = novo
  nomesNoAcervo = nomes
  const novosTiros = new Map<string, TiroDoAcervo>()
  for (const item of itens) if (item.tiro !== undefined) novosTiros.set(item.id, item.tiro)
  tiros = novosTiros
  regras = new Map(itens.map((item) => [item.id, regraDoItem(item)]))
  versao += 1
}

/** O tipo e os blocos de regra do item `itemId` no Acervo de agora. `undefined` = fora do Acervo, ou o app sem ele (Worker, jogador). */
export function regraNoAcervo(itemId: string | undefined): RegraNoAcervo | undefined {
  return itemId === undefined ? undefined : regras.get(itemId)
}

/**
 * O Acervo como a mochila o consulta na batalha (`AcervoDaMochila`), sem o disco: o tipo e o pente do
 * item de agora. Sem o item (Worker, jogador), as regras da mochila caem no tipo e na `regra` da vaga.
 * A recarga da batalha só põe no pente a bala da própria mochila, então ninguém volta pelo `paraDar`.
 */
export const ACERVO_DA_BATALHA: AcervoDaMochila = {
  item: (itemId) => {
    const regra = regras.get(itemId)
    if (regra === undefined) return undefined
    return { ...(regra.tipo === undefined ? {} : { tipo: regra.tipo }), ...(regra.blocos.pente === undefined ? {} : { pente: regra.blocos.pente }) }
  },
  paraDar: () => undefined,
}

/** Decisão 8 dos itens: a roupa do item do Acervo de agora (CA e Escudo), como a batalha a lê. Sem o item, vale a `regra` da vaga. */
export function equipamentoNoAcervo(itemId: string): EquipamentoDoItem | undefined {
  return regras.get(itemId)?.blocos.equipamento
}

/** As munições que a arma do Acervo `itemId` aceita; nenhuma = a arma não declara (ou não é do Acervo). */
export function municoesDaArma(itemId: string | undefined): readonly MunicaoAceita[] {
  return itemId === undefined ? NENHUMA : (porArma.get(itemId) ?? NENHUMA)
}

/**
 * MUNIÇÃO COMO FONTE ÚNICA (decisão do dono de 25/11/2026): o tiro que a munição `itemId` do Acervo
 * declara. `undefined` = o item não declara (ou não é do Acervo, ou é o app do jogador, que não o vê):
 * a bala fica com o dano e o efeito que tinha.
 */
export function tiroDaMunicao(itemId: string | undefined): TiroDoAcervo | undefined {
  return itemId === undefined ? undefined : tiros.get(itemId)
}

/**
 * O nome de AGORA do item `itemId` no Acervo (a vaga da mochila guarda o nome da hora em que foi dada).
 * `undefined` = fora do Acervo, ou o app do jogador, que não o vê.
 */
export function nomeNoAcervo(itemId: string | undefined): string | undefined {
  return itemId === undefined ? undefined : nomesNoAcervo.get(itemId)
}

/** Muda a cada `definirMunicoesDasArmas`: a leitura guardada das armas (`armasDe`) é refeita. */
export function versaoDasMunicoes(): number {
  return versao
}
