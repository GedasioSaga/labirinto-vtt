import { condicaoDoCatalogo } from '../lib/condicoes/catalogo'
import { comCondicoesNaFicha, condicoesDe, porCondicao, tirarCondicao, type PedidoDeCondicao } from '../lib/condicoes/naFicha'
import type { CondicaoNaFicha } from '../lib/itens/modelo'
import type { Personagem } from '../lib/personagem'
import { personagensAtivos, useAdventureStore } from './adventureStore'
import { useCondicoesPropriasStore } from './condicoesPropriasStore'
import { useToastStore } from './toastStore'

/**
 * O MESTRE PÕE E TIRA CONDIÇÃO NA FICHA (sistema de itens refeito, PLANO §1.5; etapa E4b): o menu
 * do token ("Condições ›"), o painel do token e a ficha gravam por aqui, na ficha da aventura (o
 * jogador: a ficha dele; o NPC: a cópia daquele token, então o Zumbi 1 não acende o Zumbi 2). A
 * regra é a pura de `lib/condicoes/naFicha.ts`; aqui só se grava (`ajustarPersonagens`, tudo ou
 * nada) e se avisa, com Desfazer.
 *
 * O Desfazer volta as condições de antes só na ficha que ainda está como ficou: se a ficha mudou de
 * novo no meio (o fim da vez descontou um turno), ela fica como está e o aviso diz.
 */

type CondicoesPorFicha = ReadonlyMap<string, readonly CondicaoNaFicha[]>

function mesmasCondicoes(a: readonly CondicaoNaFicha[], b: readonly CondicaoNaFicha[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function fichasDe(ids: readonly string[]): Personagem[] {
  const lista = personagensAtivos(useAdventureStore.getState())
  return ids.flatMap((id) => lista.find((personagem) => personagem.id === id) ?? [])
}

function nomeDe(personagem: Personagem): string {
  return personagem.nome.trim() || 'Personagem sem nome'
}

function juntarNomes(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? ''
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** Grava `mudar` nas fichas e devolve, de cada uma que mudou, as condições de antes e as de depois. `null` = não gravou. */
function gravarCondicoes(ids: readonly string[], mudar: (atual: Personagem) => Personagem): { antes: CondicoesPorFicha; depois: CondicoesPorFicha; mudaram: Personagem[] } | null {
  const antes = new Map<string, readonly CondicaoNaFicha[]>()
  const depois = new Map<string, readonly CondicaoNaFicha[]>()
  const mudaram: Personagem[] = []
  const gravou = useAdventureStore.getState().ajustarPersonagens(ids, (atual) => {
    const nova = mudar(atual)
    if (nova !== atual) {
      antes.set(atual.id, condicoesDe(atual))
      depois.set(atual.id, condicoesDe(nova))
      mudaram.push(nova)
    }
    return nova
  })
  return gravou ? { antes, depois, mudaram } : null
}

function desfazer(antes: CondicoesPorFicha, depois: CondicoesPorFicha): void {
  const ids = [...antes.keys()]
  let ficaram = 0
  const gravou = useAdventureStore.getState().ajustarPersonagens(ids, (atual) => {
    const esperadas = depois.get(atual.id)
    const voltam = antes.get(atual.id)
    if (esperadas === undefined || voltam === undefined) return atual
    if (!mesmasCondicoes(condicoesDe(atual), esperadas)) {
      ficaram += 1
      return atual
    }
    return comCondicoesNaFicha(atual, voltam)
  })
  const toasts = useToastStore.getState()
  if (!gravou) toasts.push('error', 'Não deu para desfazer: a ficha não gravou.')
  else if (ficaram > 0) toasts.push('info', ficaram === 1 ? 'Uma ficha mudou depois e ficou como está.' : `${ficaram} fichas mudaram depois e ficaram como estão.`)
}

/**
 * PÕE a condição nas fichas `personagemIds` (a mesma já posta é renovada). Devolve `false` quando
 * nenhuma mudou (condição fora do catálogo, ficha cheia, número torto) ou a gravação foi recusada;
 * o aviso já saiu.
 */
export function porCondicaoNasFichas(personagemIds: readonly string[], pedido: PedidoDeCondicao): boolean {
  const criadas = useCondicoesPropriasStore.getState().catalogo
  const condicao = condicaoDoCatalogo(pedido.condId, criadas)
  const toasts = useToastStore.getState()
  if (condicao === null) {
    toasts.push('error', 'Essa condição não está mais no catálogo.')
    return false
  }
  if (fichasDe(personagemIds).length === 0) {
    toasts.push('error', 'Ligue uma ficha primeiro: a condição mora na ficha.')
    return false
  }
  const feito = gravarCondicoes(personagemIds, (atual) => porCondicao(atual, pedido, criadas))
  if (feito === null) return false
  if (feito.mudaram.length === 0) {
    toasts.push('error', `Não deu para pôr ${condicao.nome}: a ficha já está com condições demais, ou o número não vale.`)
    return false
  }
  toasts.push('info', `${condicao.nome} em ${juntarNomes(feito.mudaram.map(nomeDe))}.`, undefined, {
    actions: [{ label: 'Desfazer', run: () => desfazer(feito.antes, feito.depois) }],
  })
  return true
}

/** TIRA da ficha a condição posta `idOuCondId` (o id da posta, ou todas de um `condId`). `false` = não havia, ou não gravou. */
export function tirarCondicaoDasFichas(personagemIds: readonly string[], idOuCondId: string, nome: string): boolean {
  const feito = gravarCondicoes(personagemIds, (atual) => tirarCondicao(atual, idOuCondId))
  if (feito === null || feito.mudaram.length === 0) return false
  useToastStore.getState().push('info', `${nome} saiu de ${juntarNomes(feito.mudaram.map(nomeDe))}.`, undefined, {
    actions: [{ label: 'Desfazer', run: () => desfazer(feito.antes, feito.depois) }],
  })
  return true
}
