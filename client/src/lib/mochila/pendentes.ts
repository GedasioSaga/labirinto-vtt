import type { CarriedItem } from '../../types/map'
import { quantidadeDe } from '../items'
import type { Personagem } from '../personagem'
import { MOEDAS_MAX, moedasDe } from '../troca'
import { fichasDeVariosBonecos, itensIguais, type CenaDaJuncao } from './juncao'
import { fichaSomada, itemNoAviso } from './transicao'

/**
 * MOCHILA NA FICHA — o MAPA QUE ENTRA numa pasta já convertida (correção C2 de
 * docs/planos/lobby-jogadores-2026-11-05.md; decisão do usuário de 05/11/2026).
 *
 * O mapa movido ("Mover…" do Carregar Mapa) ou importado para dentro de uma
 * pasta que já mora na ficha não passa pela migração (a pasta já tem o
 * marcador). Ao abrir, o espelho faz a ficha vencer o boneco, e o que só o
 * boneco desse mapa carregava sumiria calado. Antes disso, cada item (e a
 * bolsa) que o boneco tem e a ficha não tem vira um PENDENTE: o mestre escolhe
 * "Trazer para a ficha" (soma, como o boneco ligado a uma ficha, `transicao.ts`)
 * ou "Ignorar" (sai do aviso e continua anotado no relatório da pasta).
 *
 * "Só o boneco tem": o item do boneco que a ficha não tem IGUAL (mesmos dados e
 * a mesma quantidade, `itensIguais`), cada item da ficha casando com um só do
 * boneco. Poção ×2 no boneco e ×1 na ficha = o pendente "Poção ×2" (trazer
 * deixa ×3). A bolsa: o que o boneco tem, quando é diferente da ficha.
 *
 * A regra é POR MAPA (por cena), como o espelho: ficha com vários bonecos na
 * mesma cena (três Marinheiros da mesma ficha) não gera pendente — cada boneco
 * fica com a sua mochila. Boneco sem ficha (NPC) ou de ficha que a pasta não
 * tem também não: o espelho não toca nele. Pura: nada de disco nem store.
 */

export type DecisaoDoPendente = 'trazido' | 'ignorado'

interface PendenteComum {
  id: string
  /** A pasta do mapa em `<appData>/maps`: o mapa que entrou. */
  chave: string
  /** Nome do mapa (ou da aventura). */
  mapa: string
  /** Nome da cena; vazio no mapa solto. */
  cena: string
  personagemId: string
  /** Nome da ficha. */
  personagem: string
  /** Nome do boneco. */
  boneco: string
  /** Quando o pendente foi anotado, em ms desde a época. */
  entrouEm: number
  /** Ausente = ainda esperando o mestre. */
  decisao?: DecisaoDoPendente
  decididoEm?: number
}

export type ItemPendente = (PendenteComum & { tipo: 'item'; item: CarriedItem }) | (PendenteComum & { tipo: 'moedas'; moedas: number })

/** O que conta para dizer que dois pendentes são o mesmo: o mapa, a ficha e o que o boneco carrega. */
type ConteudoDoPendente = Pick<PendenteComum, 'chave' | 'personagemId'> & ({ tipo: 'item'; item: CarriedItem } | { tipo: 'moedas'; moedas: number })

/**
 * O mesmo pendente: o mesmo mapa, a mesma ficha e o mesmo item (a mesma vaga,
 * com os mesmos dados) ou a mesma bolsa. A cena fica de fora: a aventura que já
 * morava nas próprias fichas mostra a mesma Poção em toda cena, e é uma Poção só.
 */
export function mesmoPendente(a: ConteudoDoPendente, b: ConteudoDoPendente): boolean {
  if (a.chave !== b.chave || a.personagemId !== b.personagemId) return false
  if (a.tipo === 'item') return b.tipo === 'item' && a.item.id === b.item.id && itensIguais(a.item, b.item)
  return b.tipo === 'moedas' && a.moedas === b.moedas
}

/** Os itens de `doBoneco` que `daFicha` não tem iguais; cada item da ficha casa com um só do boneco. */
function itensQueAFichaNaoTem(daFicha: readonly CarriedItem[], doBoneco: readonly CarriedItem[]): CarriedItem[] {
  const sobra = [...daFicha]
  return doBoneco.filter((item) => {
    const igual = sobra.findIndex((naFicha) => itensIguais(naFicha, item))
    if (igual < 0) return true
    sobra.splice(igual, 1)
    return false
  })
}

/**
 * Os pendentes do mapa `chave` que entrou: ver o comentário do arquivo.
 * `registrados` são os que o relatório já tem (decididos ou não): o mesmo
 * item conferido de novo — o mapa reaberto, movido duas vezes — não volta.
 */
export function pendentesDoMapaQueEntrou(
  personagens: readonly Personagem[],
  chave: string,
  cenas: readonly CenaDaJuncao[],
  registrados: readonly ItemPendente[],
  agoraMs: number,
  novoId: () => string,
): ItemPendente[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const novos: ItemPendente[] = []
  const jaAnotado = (conteudo: ConteudoDoPendente): boolean => registrados.some((outro) => mesmoPendente(outro, conteudo)) || novos.some((outro) => mesmoPendente(outro, conteudo))
  for (const { origem, bonecos } of cenas) {
    const deVarios = fichasDeVariosBonecos(bonecos)
    for (const boneco of bonecos) {
      if (boneco.characterId === null || deVarios.has(boneco.characterId)) continue
      const ficha = porId.get(boneco.characterId)
      if (ficha === undefined) continue
      const comum = { chave, mapa: origem.mapa, cena: origem.cena, personagemId: ficha.id, personagem: ficha.nome, boneco: boneco.name ?? '', entrouEm: agoraMs }
      for (const item of itensQueAFichaNaoTem(ficha.mochila ?? [], boneco.mochila ?? [])) {
        if (!jaAnotado({ chave, personagemId: ficha.id, tipo: 'item', item })) novos.push({ ...comum, id: novoId(), tipo: 'item', item })
      }
      const moedas = moedasDe(boneco)
      if (moedas > 0 && moedas !== moedasDe(ficha) && !jaAnotado({ chave, personagemId: ficha.id, tipo: 'moedas', moedas })) {
        novos.push({ ...comum, id: novoId(), tipo: 'moedas', moedas })
      }
    }
  }
  return novos
}

/**
 * "Trazer para a ficha": as fichas com o pendente SOMADO na dele (a pilha do
 * mesmo item do acervo soma; o resto abre vaga nova, `novoId`; as moedas somam
 * até o teto da bolsa). `null` = a ficha não está mais na lista.
 */
export function fichasComOPendente(personagens: readonly Personagem[], pendente: ItemPendente, novoId: () => string): { personagens: Personagem[]; moedasDeFora: number } | null {
  const ficha = personagens.find((personagem) => personagem.id === pendente.personagemId)
  if (ficha === undefined) return null
  const chegando = pendente.tipo === 'item' ? { mochila: [pendente.item] } : { moedas: pendente.moedas }
  const somada = fichaSomada(ficha, chegando, novoId)
  return { personagens: personagens.map((personagem) => (personagem === ficha ? somada.ficha : personagem)), moedasDeFora: somada.moedasDeFora }
}

/** "Arquipélago › Praia": onde o boneco estava. */
function ondeEstava(pendente: ItemPendente): string {
  return pendente.cena === '' ? pendente.mapa : `${pendente.mapa} › ${pendente.cena}`
}

/** "Poção ×2" ou "45 moedas": o que o boneco carregava. */
function oQueCarregava(pendente: ItemPendente): string {
  return pendente.tipo === 'item' ? itemNoAviso(pendente.item) : `${pendente.moedas} moedas`
}

/** Um item só, sem pilha: "foi"; senão "foram". */
function umSo(pendente: ItemPendente): boolean {
  return pendente.tipo === 'item' && quantidadeDe(pendente.item) === 1
}

/** A pergunta ao mestre, com os botões "Trazer para a ficha" e "Ignorar". */
export function textoDoPendente(pendente: ItemPendente): string {
  const lugar = pendente.tipo === 'item' ? `na mochila de ${pendente.personagem}` : `na bolsa de ${pendente.personagem}`
  return `${oQueCarregava(pendente)} do boneco ${pendente.boneco} (${ondeEstava(pendente)}) ${umSo(pendente) ? 'não está' : 'não estão'} ${lugar}.`
}

/** O aviso depois do "Trazer para a ficha". */
export function textoDoTrazido(pendente: ItemPendente, moedasDeFora: number): string {
  const lugar = pendente.tipo === 'item' ? `a mochila de ${pendente.personagem}` : `a bolsa de ${pendente.personagem}`
  const teto = moedasDeFora > 0 ? ` A bolsa chegou ao teto de ${MOEDAS_MAX} moedas: ${moedasDeFora} não couberam.` : ''
  return `${oQueCarregava(pendente)} do boneco ${pendente.boneco} ${umSo(pendente) ? 'foi' : 'foram'} para ${lugar}.${teto}`
}

/** O aviso depois do "Ignorar": nada some calado. */
export function textoDoIgnorado(pendente: ItemPendente): string {
  return `${oQueCarregava(pendente)} do boneco ${pendente.boneco} ${umSo(pendente) ? 'ficou' : 'ficaram'} fora da ficha de ${pendente.personagem}: a linha continua no relatório da pasta.`
}
