import type { CarriedItem, Token } from '../../types/map'
import { ITEM_QUANTIDADE_MAX, quantidadeDe } from '../items'
import type { Personagem } from '../personagem'
import { MOEDAS_MAX, moedasDe } from '../troca'
import { bonecoComAFicha, mostraAFicha } from './espelho'
import { fichaComMochila, pilhaDe } from './juncao'

/**
 * MOCHILA NA FICHA — os bonecos de uma ficha MUDARAM num mapa (correção C1 de
 * docs/planos/lobby-jogadores-2026-11-05.md; decisões do usuário de 05/11/2026).
 * Ligar um boneco a uma ficha (pelo painel, pela ficha, pela batalha, pelo
 * jogador da sala), desligar, apagar, duplicar, colar, Ctrl+Z e Ctrl+Y: a
 * regra vale POR CENA (decisão do usuário de 05/11/2026: o aviso diz "nesta cena").
 *
 * - Ficha com UM boneco na cena: ele mostra a mochila e a bolsa da ficha.
 *   O que era DELE (o boneco que chegou carregando coisas, ou o último de
 *   vários) entra na ficha, SOMANDO: a pilha do mesmo item do acervo soma, o
 *   resto abre vaga, as moedas somam. O mestre fica sabendo (`entradas`).
 * - Ficha com VÁRIOS bonecos na cena: cada um tem a sua mochila, como NPC sem
 *   ficha; a da ficha fica guardada nela e volta quando ficar um só. O boneco
 *   que até agora mostrava a ficha deixa de mostrá-la — fica com o que é dele,
 *   nada (`separadas`): senão, quando voltasse a ser um só, a mochila da ficha
 *   somaria nela mesma.
 * - Boneco que mostrava a ficha e deixa de ser dela (desligado, ou ligado a
 *   outra): fica sem nada; a mochila continua na ficha (`saidas`). Senão o
 *   Ctrl+Z de um "ligar" deixaria a Poção na ficha e no boneco.
 *
 * O que é DO BONECO sai de `antes`: o Ctrl+Z não desfaz item (`applyItemsInScene`
 * reaplica a mudança no desfazer), então um passo que volta não traz de volta
 * a mochila velha. Boneco que não estava em `antes` (duplicado, que chegou de
 * outra cena, que voltou num Ctrl+Z) e mostra a ficha INTEIRA — a mesma
 * mochila, vaga por vaga, e a mesma bolsa — é cópia do espelho: não traz
 * nada. A cópia velha que volta por colar ou por "Guardar ficha" sai do mapa
 * já sem nada (`mapaSemOEspelho`). NPC sem ficha (ou de ficha que não está
 * na lista) que nada disso tocou fica como está. Pura: nada de store nem
 * disco (a vaga nova vem de `novoId`).
 *
 * A vaga (`id`) do item NÃO diz se ele já está na ficha: o Ctrl+D e o Ctrl+V
 * copiam a mochila sem trocar as vagas, então dois Marujos duplicados têm a
 * mesma vaga e cada um a sua Poção. Tudo o que é do boneco SOMA; o que entra
 * numa vaga nova da ficha ganha vaga nova — senão a cópia de um Marujo
 * passaria a "mostrar a ficha" e a Poção dele sumiria.
 */

/** A mochila e a bolsa de um lugar. */
type Conteudo = Pick<Token, 'mochila' | 'moedas'>

const NADA: Conteudo = {}

/** O que era de um boneco e entrou na ficha: a linha do aviso ao mestre. */
export interface EntradaNaFicha {
  personagemId: string
  /** Nome da ficha. */
  personagem: string
  /** Nome do boneco. */
  boneco: string
  itens: CarriedItem[]
  moedas: number
  /** Moedas que passaram do teto da bolsa (`MOEDAS_MAX`) e não couberam na ficha: o aviso diz quantas. */
  moedasDeFora: number
}

/** Ficha que passou a ter vários bonecos na cena, e algum deixou de mostrar a mochila dela. */
export interface FichaSeparada {
  personagemId: string
  personagem: string
  bonecos: number
  /** Os bonecos que deixaram de mostrar a ficha (ficaram só com o que é deles): o jogador dono de um deles também recebe o aviso. */
  tokenIds: string[]
}

/** Boneco que mostrava a ficha e deixou de ser dela. */
export interface BonecoQueSaiu {
  personagemId: string
  personagem: string
  boneco: string
}

export interface AcertoDosBonecos {
  /** As fichas, na mesma ordem; nenhuma mudando, a MESMA lista. */
  personagens: readonly Personagem[]
  /** Os bonecos de `depois` como devem ficar; nenhum mudando, a MESMA lista. */
  tokens: readonly Token[]
  entradas: EntradaNaFicha[]
  separadas: FichaSeparada[]
  saidas: BonecoQueSaiu[]
}

function conteudoDe(boneco: Conteudo): Conteudo {
  return { ...(boneco.mochila === undefined ? {} : { mochila: boneco.mochila }), ...(boneco.moedas === undefined ? {} : { moedas: boneco.moedas }) }
}

function vazio(conteudo: Conteudo): boolean {
  return (conteudo.mochila ?? []).length === 0 && moedasDe(conteudo) === 0
}

/** Os mesmos bonecos, na mesma ordem, cada um ligado à mesma ficha: nenhuma ficha ganhou nem perdeu boneco. */
function mesmasLigacoes(antes: readonly Token[], depois: readonly Token[]): boolean {
  return antes.length === depois.length && antes.every((boneco, i) => boneco.id === depois[i].id && boneco.characterId === depois[i].characterId)
}

/** Os bonecos de cada ficha da lista (por id da ficha). */
function bonecosPorFicha(bonecos: readonly Token[], porId: ReadonlyMap<string, Personagem>): Map<string, Token[]> {
  const porFicha = new Map<string, Token[]>()
  for (const boneco of bonecos) {
    if (boneco.characterId === null || !porId.has(boneco.characterId)) continue
    const lista = porFicha.get(boneco.characterId)
    if (lista === undefined) porFicha.set(boneco.characterId, [boneco])
    else lista.push(boneco)
  }
  return porFicha
}

/** O mesmo conjunto de bonecos (a ordem não importa: trazer para frente não liga nem desliga ninguém). */
function mesmoConjunto(a: readonly Token[], b: readonly Token[] | undefined): boolean {
  if (b === undefined || a.length !== b.length) return false
  const ids = new Set(b.map((boneco) => boneco.id))
  return a.every((boneco) => ids.has(boneco.id))
}

function comQuantidade(item: CarriedItem, quantidade: number): CarriedItem {
  const { quantidade: _antiga, ...semQuantidade } = item
  return quantidade > 1 ? { ...semQuantidade, quantidade } : semQuantidade
}

/**
 * `chegando` somado em `mochila`, nada descontado. A pilha do mesmo item do
 * acervo soma na vaga da ficha; o que passa do teto da pilha, e todo o resto,
 * entra no fim numa vaga NOVA (`novoId`): ver o comentário do arquivo.
 */
function somarItens(mochila: readonly CarriedItem[], chegando: readonly CarriedItem[], novoId: () => string): CarriedItem[] {
  const soma = [...mochila]
  for (const item of chegando) {
    const pilha = pilhaDe(item)
    const naPilha = pilha === undefined ? -1 : soma.findIndex((naFicha) => pilhaDe(naFicha) === pilha)
    if (naPilha < 0) {
      soma.push({ ...item, id: novoId() })
      continue
    }
    const total = quantidadeDe(soma[naPilha]) + quantidadeDe(item)
    const cabe = Math.min(total, ITEM_QUANTIDADE_MAX)
    soma[naPilha] = comQuantidade(soma[naPilha], cabe)
    if (total > cabe) soma.push(comQuantidade({ ...item, id: novoId() }, total - cabe))
  }
  return soma
}

/** A ficha com `chegando` somado; as moedas acima do teto da bolsa ficam de fora (e o aviso diz quantas). Também o "Trazer para a ficha" do mapa que entrou (`pendentes.ts`). */
export function fichaSomada(ficha: Personagem, chegando: Conteudo, novoId: () => string): { ficha: Personagem; moedasDeFora: number } {
  const total = moedasDe(ficha) + moedasDe(chegando)
  const moedas = Math.min(total, MOEDAS_MAX)
  return { ficha: fichaComMochila(ficha, somarItens(ficha.mochila ?? [], chegando.mochila ?? [], novoId), moedas), moedasDeFora: total - moedas }
}

/**
 * As transições: ver o comentário do arquivo. `personagens` são as fichas
 * donas da mochila (depois da migração); `novoId` dá a vaga do item que entra
 * na ficha numa vaga nova.
 */
export function acertarBonecosDasFichas(
  personagens: readonly Personagem[],
  antes: readonly Token[],
  depois: readonly Token[],
  novoId: () => string,
): AcertoDosBonecos {
  const nada: AcertoDosBonecos = { personagens, tokens: depois, entradas: [], separadas: [], saidas: [] }
  if (antes === depois || personagens.length === 0 || mesmasLigacoes(antes, depois)) return nada
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const antesPorFicha = bonecosPorFicha(antes, porId)
  const depoisPorFicha = bonecosPorFicha(depois, porId)
  const mexidas = new Set<string>()
  for (const [id, bonecos] of depoisPorFicha) if (!mesmoConjunto(bonecos, antesPorFicha.get(id))) mexidas.add(id)
  for (const id of antesPorFicha.keys()) if (!depoisPorFicha.has(id)) mexidas.add(id)
  if (mexidas.size === 0) return nada

  const bonecoDeAntes = new Map(antes.map((boneco) => [boneco.id, boneco]))
  /** O boneco mostrava uma ficha em `antes`: ligado a ela, e o único dela no mapa. */
  const mostravaUmaFicha = (boneco: Token): boolean => boneco.characterId !== null && antesPorFicha.get(boneco.characterId)?.length === 1
  /** O que é do boneco, e não da ficha que ele mostrava. */
  const proprioDe = (boneco: Token, ficha: Personagem): Conteudo => {
    const deAntes = bonecoDeAntes.get(boneco.id)
    if (deAntes === undefined) return mostraAFicha(boneco, ficha) ? NADA : conteudoDe(boneco)
    return mostravaUmaFicha(deAntes) ? NADA : conteudoDe(deAntes)
  }

  const fichas = new Map(porId)
  const trocados = new Map<string, Token>()
  const entradas: EntradaNaFicha[] = []
  const separadas: FichaSeparada[] = []
  const saidas: BonecoQueSaiu[] = []

  for (const id of mexidas) {
    const bonecos = depoisPorFicha.get(id) ?? []
    const ficha = fichas.get(id)
    if (ficha === undefined || bonecos.length === 0) continue
    if (bonecos.length === 1) {
      const [boneco] = bonecos
      const proprio = proprioDe(boneco, ficha)
      let atual = ficha
      if (!vazio(proprio)) {
        const somada = fichaSomada(ficha, proprio, novoId)
        atual = somada.ficha
        fichas.set(id, atual)
        entradas.push({ personagemId: id, personagem: ficha.nome, boneco: boneco.name, itens: [...(proprio.mochila ?? [])], moedas: moedasDe(proprio), moedasDeFora: somada.moedasDeFora })
      }
      const espelhado = bonecoComAFicha(boneco, atual)
      if (espelhado !== boneco) trocados.set(boneco.id, espelhado)
      continue
    }
    const deixaramDeMostrar: string[] = []
    for (const boneco of bonecos) {
      const soOSeu = bonecoComAFicha(boneco, proprioDe(boneco, ficha))
      if (soOSeu === boneco) continue
      trocados.set(boneco.id, soOSeu)
      deixaramDeMostrar.push(boneco.id)
    }
    if (deixaramDeMostrar.length > 0) separadas.push({ personagemId: id, personagem: ficha.nome, bonecos: bonecos.length, tokenIds: deixaramDeMostrar })
  }

  // Quem mostrava uma ficha e saiu dela para nenhuma (desligado, ou ligado a ficha fora da lista). Ligado a outra da lista, já foi acertado acima.
  for (const boneco of depois) {
    const deAntes = bonecoDeAntes.get(boneco.id)
    if (deAntes === undefined || deAntes.characterId === null || deAntes.characterId === boneco.characterId || !mexidas.has(deAntes.characterId)) continue
    if (boneco.characterId !== null && porId.has(boneco.characterId)) continue
    if (!mostravaUmaFicha(deAntes)) continue
    const semNada = bonecoComAFicha(boneco, NADA)
    if (semNada === boneco) continue
    trocados.set(boneco.id, semNada)
    const ficha = porId.get(deAntes.characterId)
    if (ficha !== undefined) saidas.push({ personagemId: ficha.id, personagem: ficha.nome, boneco: boneco.name })
  }

  const fichasMudaram = personagens.some((personagem) => fichas.get(personagem.id) !== personagem)
  return {
    personagens: fichasMudaram ? personagens.map((personagem) => fichas.get(personagem.id) ?? personagem) : personagens,
    tokens: trocados.size === 0 ? depois : depois.map((boneco) => trocados.get(boneco.id) ?? boneco),
    entradas,
    separadas,
    saidas,
  }
}

/** "Poção ×2": o item como a mochila mostra. */
export function itemNoAviso(item: CarriedItem): string {
  const quantos = quantidadeDe(item)
  return quantos > 1 ? `${item.nome} ×${quantos}` : item.nome
}

/** "A, B e C". */
function emLista(partes: readonly string[]): string {
  return partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}`
}

/** Até quantos itens o aviso nomeia; o resto vira "mais N itens". */
const ITENS_NO_AVISO = 4

/** A ficha com vários bonecos na cena: o mesmo texto ao mestre e ao jogador dono do boneco que ficou vazio. A regra é por CENA. */
export function textoDaFichaSeparada(separada: Pick<FichaSeparada, 'personagem' | 'bonecos'>): string {
  return `${separada.personagem} tem ${separada.bonecos} bonecos nesta cena: cada um tem a sua mochila. A mochila e a bolsa da ficha continuam nela e voltam quando ficar um boneco só.`
}

/** Os avisos ao mestre, um por acontecimento, para o toast: nada some calado. */
export function avisosDoAcerto(acerto: Pick<AcertoDosBonecos, 'entradas' | 'separadas' | 'saidas'>): string[] {
  const avisos: string[] = []
  for (const entrada of acerto.entradas) {
    const nomeados = entrada.itens.slice(0, ITENS_NO_AVISO).map(itemNoAviso)
    const resto = entrada.itens.length - nomeados.length
    const partes = [...nomeados, ...(resto > 0 ? [`mais ${resto} ${resto === 1 ? 'item' : 'itens'}`] : []), ...(entrada.moedas > 0 ? [`${entrada.moedas} moedas`] : [])]
    const umSo = partes.length === 1 && entrada.moedas === 0 && entrada.itens.length === 1 && quantidadeDe(entrada.itens[0]) === 1
    const teto = entrada.moedasDeFora > 0 ? ` A bolsa chegou ao teto de ${MOEDAS_MAX} moedas: ${entrada.moedasDeFora} não couberam.` : ''
    avisos.push(`${emLista(partes)} do boneco ${entrada.boneco} ${umSo ? 'foi' : 'foram'} para a mochila de ${entrada.personagem}.${teto}`)
  }
  for (const separada of acerto.separadas) avisos.push(textoDaFichaSeparada(separada))
  for (const saida of acerto.saidas) {
    avisos.push(`O boneco ${saida.boneco} não mostra mais a ficha de ${saida.personagem}: a mochila e a bolsa continuam na ficha.`)
  }
  return avisos
}
