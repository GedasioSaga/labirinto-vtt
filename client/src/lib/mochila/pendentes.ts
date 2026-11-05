import type { CarriedItem, Token } from '../../types/map'
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
 * "Só o boneco tem" (`sobraDoItem`, `sobraDaBolsa`): a VAGA é a identidade do
 * item. O item do boneco numa vaga que a ficha não tem é dele inteiro, mesmo
 * com os mesmos dados de um item da ficha (a Poção do acervo nas duas, em
 * vagas diferentes, são duas Poções). A vaga que a ficha tem é a cópia do
 * espelho: conta só a pilha que cresceu por cima dela. Poção ×2 numa vaga do
 * boneco e ×1 noutra vaga da ficha = o pendente "Poção ×2" (trazer deixa ×3).
 * A bolsa não tem vaga: o boneco que tem alguma vaga da ficha veio do espelho e
 * conta só o que passa da bolsa da ficha; sem vaga em comum não há como saber
 * se a bolsa é cópia, e ela conta inteira (melhor o mestre ignorar do que
 * sumir calado).
 *
 * A regra é POR CENA, como o espelho: ficha com vários bonecos na
 * mesma cena (três Marinheiros da mesma ficha) não gera pendente — cada boneco
 * fica com a sua mochila. Boneco sem ficha (NPC) ou de ficha que a pasta não
 * tem também não: o espelho não toca nele. Pura: nada de disco nem store.
 */

/**
 * `trazido` e `ignorado`: o mestre escolheu. `incerto`: o mestre tirou o aviso
 * de um "Trazer" que caiu no meio, com a ficha mudada depois — não dá para
 * saber se a soma entrou, e a ficha ficou como estava. `saiu`: o mapa saiu da
 * pasta com o item ainda no boneco (é do boneco de novo, fora do espelho
 * dela); se o mapa voltar, ele é conferido como novo.
 */
export type DecisaoDoPendente = 'trazido' | 'ignorado' | 'incerto' | 'saiu'

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

function comQuantidade(item: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antiga, ...semQuantidade } = item
  return quantidade > 1 ? { ...semQuantidade, quantidade } : semQuantidade
}

/**
 * O que do item do boneco a ficha não tem (ver o comentário do arquivo): vaga
 * que a ficha não tem, o item inteiro; a mesma vaga, só a pilha que passa da
 * dela (menor ou igual = o boneco gastou ou é a cópia, e a ficha vence).
 */
function sobraDoItem(item: CarriedItem, naFicha: CarriedItem | undefined): CarriedItem | null {
  if (naFicha === undefined) return item
  const sobra = quantidadeDe(item) - quantidadeDe(naFicha)
  return sobra > 0 ? comQuantidade(item, sobra) : null
}

/** O que dos itens de `doBoneco` a ficha não tem; cada vaga da ficha casa com um só item do boneco. */
function itensQueAFichaNaoTem(daFicha: readonly CarriedItem[], doBoneco: readonly CarriedItem[]): CarriedItem[] {
  const vagasDaFicha = new Map(daFicha.map((item) => [item.id, item]))
  const sobras: CarriedItem[] = []
  for (const item of doBoneco) {
    const sobra = sobraDoItem(item, vagasDaFicha.get(item.id))
    vagasDaFicha.delete(item.id)
    if (sobra !== null) sobras.push(sobra)
  }
  return sobras
}

/** As moedas do boneco que a ficha não tem (ver o comentário do arquivo). */
function sobraDaBolsa(boneco: Pick<Token, 'mochila' | 'moedas'>, ficha: Pick<Personagem, 'mochila' | 'moedas'>): number {
  const moedas = moedasDe(boneco)
  if (moedas <= 0) return 0
  const vagasDaFicha = new Set((ficha.mochila ?? []).map((item) => item.id))
  const veioDoEspelho = (boneco.mochila ?? []).some((item) => vagasDaFicha.has(item.id))
  return veioDoEspelho ? Math.max(0, moedas - moedasDe(ficha)) : moedas
}

/**
 * Os pendentes do mapa `chave` que entrou: ver o comentário do arquivo.
 * `registrados` são os que o relatório já tem (esperando, trazidos ou
 * ignorados): o mesmo item conferido de novo — o mapa reaberto, movido duas
 * vezes — não volta. O que saiu com o mapa (`saiu`) não conta: o mapa que
 * volta é conferido como novo.
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
  const valendo = registrados.filter((registrado) => registrado.decisao !== 'saiu')
  const jaAnotado = (conteudo: ConteudoDoPendente): boolean => valendo.some((outro) => mesmoPendente(outro, conteudo)) || novos.some((outro) => mesmoPendente(outro, conteudo))
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
      const moedas = sobraDaBolsa(boneco, ficha)
      if (moedas > 0 && !jaAnotado({ chave, personagemId: ficha.id, tipo: 'moedas', moedas })) {
        novos.push({ ...comum, id: novoId(), tipo: 'moedas', moedas })
      }
    }
  }
  return novos
}

/**
 * O pendente que o boneco AINDA carrega: conferido o mapa de novo
 * (`pendentesDoMapaQueEntrou` sem registrados, contra as fichas de agora), a
 * mesma ficha ainda tem sobra na mesma vaga (ou na bolsa). Para o mapa que
 * saiu da pasta: o que o boneco ainda tem fica com ele (`saiu`); o que o
 * espelho já tirou dele só existe no pendente, e o pendente continua.
 */
export function bonecoAindaTem(pendente: ItemPendente, conferidos: readonly ItemPendente[]): boolean {
  return conferidos.some(
    (conferido) =>
      conferido.personagemId === pendente.personagemId &&
      (pendente.tipo === 'item' ? conferido.tipo === 'item' && conferido.item.id === pendente.item.id : conferido.tipo === 'moedas'),
  )
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

/** O "Trazer" que somou na ficha, mas o relatório da pasta não gravou: a soma ficou, e o próximo "Trazer" só anota. */
export function textoDoTrazidoSemAnotar(pendente: ItemPendente, moedasDeFora: number, motivo: string): string {
  return `${textoDoTrazido(pendente, moedasDeFora)} Mas não deu para anotar isso no relatório da pasta (${motivo}): o aviso continua, e "Trazer para a ficha" de novo só anota, sem somar outra vez.`
}

/** O "Trazer" recusado: um "Trazer" de antes caiu no meio e a ficha mudou depois. Nada foi somado. */
export function textoDoIncerto(pendente: ItemPendente): string {
  const lugar = pendente.tipo === 'item' ? `na mochila de ${pendente.personagem}` : `na bolsa de ${pendente.personagem}`
  return `Não dá para saber se ${oQueCarregava(pendente)} do boneco ${pendente.boneco} já ${umSo(pendente) ? 'está' : 'estão'} ${lugar}: um "Trazer" de antes caiu no meio e a ficha mudou depois. Nada foi somado agora. Confira a ficha de ${pendente.personagem}; o aviso continua, e "Ignorar" o tira sem mexer nela.`
}

/** O aviso depois do "Ignorar": nada some calado. */
export function textoDoIgnorado(pendente: ItemPendente): string {
  return `${oQueCarregava(pendente)} do boneco ${pendente.boneco} ${umSo(pendente) ? 'ficou' : 'ficaram'} fora da ficha de ${pendente.personagem}: a linha continua no relatório da pasta.`
}

/** O "Ignorar" de um "Trazer" que caiu no meio, com a ficha mudada depois: não diz que ficou fora, porque pode ter entrado. */
export function textoDoIgnoradoSemSaber(pendente: ItemPendente): string {
  const lugar = pendente.tipo === 'item' ? `a mochila de ${pendente.personagem}` : `a bolsa de ${pendente.personagem}`
  return `O aviso de ${oQueCarregava(pendente)} do boneco ${pendente.boneco} saiu da lista, e a ficha de ${pendente.personagem} ficou como estava. Um "Trazer" de antes caiu no meio, e não dá para saber se a soma entrou: confira ${lugar}. A linha continua no relatório da pasta.`
}

/** O "Trazer" recusado: o mapa saiu da pasta e o boneco ainda tem o item. */
export function textoDoQueSaiu(pendente: ItemPendente): string {
  return `${oQueCarregava(pendente)} ${umSo(pendente) ? 'continua' : 'continuam'} com o boneco ${pendente.boneco}: o mapa ${pendente.mapa} saiu da pasta. A linha continua no relatório da pasta.`
}
