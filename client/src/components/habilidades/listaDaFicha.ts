import { ABA_DAS_TECNICAS, CAMPO_DA_ACAO, CAMPO_DO_CUSTO, CAMPO_DO_EFEITO } from '../../lib/batalha/leituraDaFicha'
import { nomeDaAcao } from '../../lib/batalha/mecanica/categoria'
import { CAMPO_DA_DESCRICAO, ehLinhaDoConfira, guardarConvertida } from '../../lib/batalha/mecanica/conversao/comum'
import { formaDecididaPeloMestre } from '../../lib/batalha/mecanica/formaDoMestre'
import { lerMecanica, type MecanicaLida, type MecanicaV2 } from '../../lib/batalha/mecanica/modelo'
import { PECA_DE_PARTIDA } from '../../lib/batalha/mecanica/pecas'
import type { FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
import { fraseDoPapel, modificadoresDaPecaDaForma } from '../../lib/batalha/mecanica/textoGerado'
import { ocultasDaAba } from '../../lib/habilidadeOculta'
import { ABA_DAS_TRANSFORMACOES, ehMecanicaDeForma } from '../../lib/livros/catalogo'
import { cartoesDaAba, novoCartao, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import { abaDoSistema, type AbaDoSistema, type SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { QuemEditaNoEditor } from '../batalha/editor/gravarNoCartao'

/**
 * A LISTA DE HABILIDADES DA FICHA (rework das habilidades, E7; PLANO.md D5 e decisões 15 e 16 do
 * protótipo aprovado): as abas Habilidades e Transformações viram UMA lista, e Transformações vira um
 * filtro dela. A forma continua morando na aba Transformações (o app de antes, o site, a Arena e o
 * Worker leem dali); a lista só junta as duas. Pôr a peça Transformação numa habilidade a leva para a
 * aba das formas ao gravar (mesmo id); tirar, volta.
 *
 * Puro: sem React, sem store.
 */

/** O filtro da lista: tudo (Habilidades) ou só as formas (Transformações). */
export type FiltroDaLista = 'todas' | 'formas'

/** Uma linha da lista: o cartão e a aba onde ele mora. */
export interface LinhaDaLista {
  cartao: CartaoDaFicha
  abaId: string
}

/** Onde um cartão mora na lista: a aba e, no subcartão (técnica de dentro da forma), o cartão de fora. */
export interface LugarNaLista {
  abaId: string
  paiId: string | null
}

/** O que o Remover tirou, para o Desfazer devolver no mesmo lugar. */
export interface CartaoTirado {
  cartao: CartaoDaFicha
  lugar: LugarNaLista
  indice: number
}

/** As duas abas da lista única; sem uma delas no molde, a lista única não vale (cada aba segue sozinha, como antes). */
export function abasDaLista(sistema: SistemaDeRpg): { habilidades: AbaDoSistema; formas: AbaDoSistema | null } | null {
  const habilidades = abaDoSistema(sistema, ABA_DAS_TECNICAS)
  // D14: o sistema sem a aba Transformações também usa a lista única (sem o filtro das formas e sem o "Editar como texto").
  return habilidades === undefined ? null : { habilidades, formas: abaDoSistema(sistema, ABA_DAS_TRANSFORMACOES) ?? null }
}

/** A aba é uma das duas da lista única? Então a tela dela é a lista, com o filtro desta aba. */
export function filtroDaAba(sistema: SistemaDeRpg, abaId: string): FiltroDaLista | null {
  const abas = abasDaLista(sistema)
  if (abas === null) return null
  if (abaId === ABA_DAS_TECNICAS) return 'todas'
  return abaId === ABA_DAS_TRANSFORMACOES && abas.formas !== null ? 'formas' : null
}

/** A mecânica que vale tem a peça Transformação (a proposta do dono só conta quando o mestre aceitar). */
export function temPecaDeForma(cartao: Pick<CartaoDaFicha, 'mecanica'>): boolean {
  return ehMecanicaDeForma(cartao.mecanica)
}

/** É forma: mora na aba Transformações ou já tem a peça. */
export function ehForma(linha: LinhaDaLista): boolean {
  return linha.abaId === ABA_DAS_TRANSFORMACOES || temPecaDeForma(linha.cartao)
}

/** As linhas da lista: as habilidades e depois as formas, cada aba na ordem da ficha; o filtro Transformações só as formas. */
export function linhasDaLista(personagem: Personagem, filtro: FiltroDaLista): LinhaDaLista[] {
  const todas = [
    ...cartoesDaAba(personagem, ABA_DAS_TECNICAS).map((cartao) => ({ cartao, abaId: ABA_DAS_TECNICAS })),
    ...cartoesDaAba(personagem, ABA_DAS_TRANSFORMACOES).map((cartao) => ({ cartao, abaId: ABA_DAS_TRANSFORMACOES })),
  ]
  return filtro === 'todas' ? todas : todas.filter(ehForma)
}

/** Quantos cartões a lista mostra com o filtro (o número no botão da aba). */
export function quantosNaLista(personagem: Personagem, filtro: FiltroDaLista): number {
  return linhasDaLista(personagem, filtro).length
}

/** Os "???" que o mestre escondeu (Fatia C7) nas abas que a lista junta: as duas em Habilidades, só a das formas no filtro. */
export function ocultasDaLista(personagem: Pick<Personagem, 'ocultas'>, filtro: FiltroDaLista): number {
  const formas = ocultasDaAba(personagem, ABA_DAS_TRANSFORMACOES)
  return filtro === 'formas' ? formas : formas + ocultasDaAba(personagem, ABA_DAS_TECNICAS)
}

/**
 * A aba onde o cartão fica depois de gravado (D5): ganhou a peça Transformação, vai para as formas;
 * perdeu a peça, volta às habilidades. Sem mudança na peça, fica onde está (a forma de texto, que nunca
 * teve a peça, segue nas Transformações).
 */
export function abaAoGravar(antes: Pick<CartaoDaFicha, 'mecanica'>, depois: Pick<CartaoDaFicha, 'mecanica'>, abaAtual: string, comAbaDasFormas = true): string {
  const tinha = temPecaDeForma(antes)
  const tem = temPecaDeForma(depois)
  // Sem a aba das formas no sistema, a forma fica nas Habilidades (D5: "quando o sistema a tem").
  if (tem && !tinha) return comAbaDasFormas ? ABA_DAS_TRANSFORMACOES : abaAtual
  if (!tem && tinha) return ABA_DAS_TECNICAS
  return abaAtual
}

/** A ficha com a aba trocada. */
function comAba(personagem: Personagem, abaId: string, cartoes: CartaoDaFicha[]): Personagem {
  return { ...personagem, abas: { ...personagem.abas, [abaId]: cartoes } }
}

/** Onde o cartão `id` está nas duas abas (no topo ou como subcartão); `null` = não está na lista. */
export function lugarDoCartao(personagem: Personagem, id: string): LugarNaLista | null {
  for (const abaId of [ABA_DAS_TECNICAS, ABA_DAS_TRANSFORMACOES]) {
    for (const cartao of cartoesDaAba(personagem, abaId)) {
      if (cartao.id === id) return { abaId, paiId: null }
      if (cartao.subcartoes.some((sub) => sub.id === id)) return { abaId, paiId: cartao.id }
    }
  }
  return null
}

/** O cartão que está no lugar (o de cima ou o subcartão); `null` = saiu. */
export function cartaoNoLugar(personagem: Personagem, lugar: LugarNaLista, id: string): CartaoDaFicha | null {
  const cartoes = cartoesDaAba(personagem, lugar.abaId)
  if (lugar.paiId === null) return cartoes.find((cartao) => cartao.id === id) ?? null
  return cartoes.find((cartao) => cartao.id === lugar.paiId)?.subcartoes.find((sub) => sub.id === id) ?? null
}

/**
 * A ficha com o cartão gravado pelo editor. O de cima pode mudar de aba (`abaAoGravar`): sai de onde
 * estava e entra no fim da outra, com o mesmo id. O subcartão fica dentro da forma. Cartão que já não
 * está lá: a MESMA ficha (nada some, nada aparece em dobro).
 */
export function comOCartaoGravado(personagem: Personagem, lugar: LugarNaLista, novo: CartaoDaFicha, comAbaDasFormas = true): Personagem {
  const cartoes = cartoesDaAba(personagem, lugar.abaId)
  if (lugar.paiId !== null) {
    const paiId = lugar.paiId
    const pai = cartoes.find((cartao) => cartao.id === paiId)
    if (pai === undefined || !pai.subcartoes.some((sub) => sub.id === novo.id)) return personagem
    const comSub = { ...pai, subcartoes: pai.subcartoes.map((sub) => (sub.id === novo.id ? novo : sub)) }
    return comAba(personagem, lugar.abaId, cartoes.map((cartao) => (cartao.id === paiId ? comSub : cartao)))
  }
  const antes = cartoes.find((cartao) => cartao.id === novo.id)
  if (antes === undefined) return personagem
  const destino = abaAoGravar(antes, novo, lugar.abaId, comAbaDasFormas)
  if (destino === lugar.abaId) return comAba(personagem, lugar.abaId, cartoes.map((cartao) => (cartao.id === novo.id ? novo : cartao)))
  const semEle = comAba(personagem, lugar.abaId, cartoes.filter((cartao) => cartao.id !== novo.id))
  return comAba(semEle, destino, [...cartoesDaAba(semEle, destino), novo])
}

/** A ficha sem o cartão (o de cima ou o subcartão), e o que saiu, para o Desfazer. Não achou: `null`. */
export function semOCartao(personagem: Personagem, lugar: LugarNaLista, id: string): { personagem: Personagem; tirado: CartaoTirado } | null {
  const cartoes = cartoesDaAba(personagem, lugar.abaId)
  if (lugar.paiId === null) {
    const indice = cartoes.findIndex((cartao) => cartao.id === id)
    const cartao = cartoes[indice]
    if (cartao === undefined) return null
    return { personagem: comAba(personagem, lugar.abaId, cartoes.filter((atual) => atual.id !== id)), tirado: { cartao, lugar, indice } }
  }
  const paiId = lugar.paiId
  const pai = cartoes.find((cartao) => cartao.id === paiId)
  const indice = pai === undefined ? -1 : pai.subcartoes.findIndex((sub) => sub.id === id)
  const cartao = pai?.subcartoes[indice]
  if (pai === undefined || cartao === undefined) return null
  const semSub = { ...pai, subcartoes: pai.subcartoes.filter((sub) => sub.id !== id) }
  return { personagem: comAba(personagem, lugar.abaId, cartoes.map((atual) => (atual.id === paiId ? semSub : atual))), tirado: { cartao, lugar, indice } }
}

/** O Desfazer do Remover: o cartão volta ao mesmo lugar (ou ao fim, se a lista encolheu). O pai que saiu no meio: a MESMA ficha. */
export function comOCartaoDeVolta(personagem: Personagem, tirado: CartaoTirado): Personagem {
  const { lugar, cartao, indice } = tirado
  const cartoes = cartoesDaAba(personagem, lugar.abaId)
  const inserir = (lista: readonly CartaoDaFicha[]): CartaoDaFicha[] => {
    const nova = [...lista]
    nova.splice(Math.min(indice, nova.length), 0, cartao)
    return nova
  }
  if (lugar.paiId === null) return comAba(personagem, lugar.abaId, inserir(cartoes))
  const paiId = lugar.paiId
  if (!cartoes.some((atual) => atual.id === paiId)) return personagem
  return comAba(personagem, lugar.abaId, cartoes.map((atual) => (atual.id === paiId ? { ...atual, subcartoes: inserir(atual.subcartoes) } : atual)))
}

/** Sobe (-1) ou desce (+1) o cartão de cima dentro da aba dele; na ponta, a MESMA ficha. */
export function comOCartaoMovido(personagem: Personagem, abaId: string, id: string, delta: -1 | 1): Personagem {
  const cartoes = cartoesDaAba(personagem, abaId)
  const indice = cartoes.findIndex((cartao) => cartao.id === id)
  const alvo = indice + delta
  const deCa = cartoes[indice]
  const deLa = cartoes[alvo]
  if (indice < 0 || deCa === undefined || deLa === undefined) return personagem
  const novos = [...cartoes]
  novos[indice] = deLa
  novos[alvo] = deCa
  return comAba(personagem, abaId, novos)
}

/** A ficha com os cartões novos no fim da aba (o "+ Habilidade", o "Trazer", o "Escolher do livro"). */
export function comCartoesNovos(personagem: Personagem, abaId: string, novos: readonly CartaoDaFicha[]): Personagem {
  return comAba(personagem, abaId, [...cartoesDaAba(personagem, abaId), ...novos])
}

/** A aba de um cartão que acabou de chegar: com a peça Transformação, a das formas (D5); senão a pedida. */
export function abaDoCartaoNovo(cartao: Pick<CartaoDaFicha, 'mecanica'>, pedida: string, comAbaDasFormas = true): string {
  return temPecaDeForma(cartao) && comAbaDasFormas ? ABA_DAS_TRANSFORMACOES : pedida
}

/** Em quem usa, sem teste: a forma liga em si (o mesmo alvo dos modelos de forma). */
const MECANICA_DA_FORMA_NOVA: MecanicaV2 = {
  versao: 5,
  uso: 'manter',
  acao: 'livre',
  custos: [],
  limite: {},
  alvo: { quem: 'si', forma: { tipo: 'um' } },
  teste: { tipo: 'naoErra' },
  efeitos: [],
  pecas: [PECA_DE_PARTIDA.transformacao],
}

/**
 * O cartão do "+ Transformação" (protótipo, `novaHabilidade('ficha', 'transformacao')`): "Ligar e
 * manter" em si, com a peça Transformação de partida. O mestre grava a `mecanica`; o dono, a
 * `mecanicaProposta` (vai ao mestre). O texto do cartão sai das peças quando o editor grava.
 */
export function formaNova(nome: string, quemEdita: QuemEditaNoEditor): CartaoDaFicha {
  const cartao = novoCartao(nome)
  const mecanica = guardarConvertida(MECANICA_DA_FORMA_NOVA)
  if (mecanica === null) return cartao
  // D5: os atributos da peça são os modificadores do cartão (o mesmo que o Salvar do editor grava).
  const modificadores = modificadoresDaPecaDaForma(MECANICA_DA_FORMA_NOVA) ?? []
  return quemEdita === 'mestre' ? { ...cartao, modificadores, mecanica } : { ...cartao, mecanicaProposta: mecanica }
}

/** As técnicas da ficha (as habilidades e as de dentro das formas): o "Evolui para" e os requisitos do editor. */
export function tecnicasDaFicha(personagem: Personagem, sistema: SistemaDeRpg): CartaoDaFicha[] {
  const tecnicas = [...cartoesDaAba(personagem, ABA_DAS_TECNICAS)]
  for (const aba of sistema.abas) {
    if (aba.subcartoes?.aba !== ABA_DAS_TECNICAS) continue
    for (const cartao of cartoesDaAba(personagem, aba.id)) tecnicas.push(...cartao.subcartoes)
  }
  return tecnicas
}

/** O que a linha da lista diz do cartão: o nome da ação, o custo, uma frase e, se houver, o aviso. */
export interface ResumoDaLinha {
  acao: string | null
  custo: string | null
  frase: string
  aviso: string | null
}

/**
 * A linha do cartão na lista (protótipo, `cartaoDaFicha`: nome, ação, custo e resumo). Montado: a ação
 * e a frase saem das peças (a mesma frase do papel do editor). De texto: a Ação, o Custo e o Efeito
 * escritos. A forma do "o mestre decide os números" é de texto (a peça dela não é de habilidade).
 */
export function resumoDaLinha(cartao: CartaoDaFicha, ficha: FichaDaPrevia): ResumoDaLinha {
  const ler = (campo: string): string => (cartao.campos[campo] ?? '').trim()
  const custo = ler(CAMPO_DO_CUSTO) || null
  const lida: MecanicaLida = formaDecididaPeloMestre(cartao) ? { tipo: 'nenhuma' } : lerMecanica(cartao.mecanica)
  if (lida.tipo === 'pecas') return { acao: nomeDaAcao(lida.mecanica), custo, frase: fraseDoPapel(lida.mecanica, ficha), aviso: null }
  const frase = ler(CAMPO_DO_EFEITO) || primeiraLinha(ler(CAMPO_DA_DESCRICAO)) || 'Sem efeito escrito.'
  const aviso = lida.tipo === 'futura' ? 'Feita num app mais novo: atualize o app para editar.' : lida.tipo === 'invalida' ? `Mecânica que não se lê: ${lida.motivo}.` : null
  return { acao: ler(CAMPO_DA_ACAO) || null, custo, frase, aviso }
}

/** A primeira linha da Descrição que não é "Confira" (a frase da linha, quando não há Efeito). */
function primeiraLinha(descricao: string): string {
  return descricao.split('\n').find((linha) => linha.trim() !== '' && !ehLinhaDoConfira(linha))?.trim() ?? ''
}
