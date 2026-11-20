import type { CarriedItem, ConteudoDoObjeto, MapData, Prop, Token } from '../types/map'
import { aplicarAjuste } from '../lib/ajusteDaFicha'
import { conteudoVazio, fraseDaArmadilha, itemParaAMochila, MINIGAME_DO_OBJETO, NOME_DO_OBJETO, objetoAberto, oQueLevou, type MobiliaComConteudo } from '../lib/conteudoDoObjeto'
import { distanciaAoObjeto } from '../lib/itemNoMapa'
import { ITEM_REACH_CELLS, mochilaComItemDoAcervo } from '../lib/items'
import { darNaFicha } from '../lib/mochila/darNaFicha'
import { fichaComMochila } from '../lib/mochila/juncao'
import type { Personagem } from '../lib/personagem'
import { mudarFichaNoMapa, porCondicaoNaFicha } from '../lib/prazoDaCondicao'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { moedasDe } from '../lib/troca'
import { recursoDeVida, vidaDoPersonagem } from '../lib/vidaDaFicha'
import { tokenRadiusOf } from '../lib/doorReach'
import type { AlcancePeloObjeto } from '../lib/tipoDoAlcancePeloObjeto'
import { avisosDosDocumentos, darDocumentos } from '../documentos/naFicha'
import type { DesfechoDoObjetoNoFio } from './protocoloDoObjeto'
import type { DocumentoDaBiblioteca } from './puzzleNoHost'

/**
 * BAÚ, CAIXA E BARRIL NO HOST (Fase C do pedido de 15/11/2026): as contas
 * puras da abertura. A sessão (`hostSession.ts`) valida quem pediu e chama
 * daqui; a ponte (`hostBridge.ts` → `playerChanges.ts`) grava o resultado no
 * mapa do mestre, fora do Ctrl+Z dele, como o "Pegar" do item.
 *
 * Ao vencer, na ordem: os itens vão para a mochila da FICHA DE PERSONAGEM do
 * token (a porta da Fase 1, `darNaFicha`; token sem ficha: a mochila do
 * token), as moedas para a bolsa da ficha, a picada tira vida pela ficha
 * (`aplicarAjuste` no recurso de vida) e a pastilha acende com o prazo
 * (`porCondicaoNaFicha`). O objeto fica marcado aberto; a caixa e o barril
 * viram destroços (`objetoAberto`).
 */

/** Uma abertura em jogo na tela de um jogador: o que o `objeto.venceu` tem de casar. */
export interface ObjetoEmJogo {
  sessao: string
  propId: string
  /** A cena do objeto (`sceneKey` da sessão). */
  cena: string
  /** A ficha dele que encostou: é ela que recebe. */
  tokenId: string
}

/** O que a abertura deixou, para a página Jogos e o aviso do mestre. */
export interface RegistroDoObjetoAberto {
  propId: string
  jogo: MobiliaComConteudo
  /** "Brann abriu o Baú" (o nome do jogador e do objeto). */
  titulo: string
  /** "Levou Poção ×2 e 35 moedas." / "Não tinha nada." */
  levou: string
  /** A linha da armadilha, ou "Sem armadilha.". */
  armadilha: string
  /** O que não deu para entregar (ficha sem vida, token sem ficha). */
  avisos: string[]
  em: number
}

/** A abertura validada, pronta para o mapa do mestre (`playerChanges.applyObjetoAberto`). */
export interface AppliedObjetoAberto {
  /** Cena de fundo; ausente = a aberta. */
  sceneId?: string
  propId: string
  por: string
  em: number
  tokenId: string
  /** A pastilha com prazo que a armadilha acende; `null` = nenhuma. */
  efeito: { nome: string; turnos: number; porVez: number } | null
  /** Token sem ficha de personagem: a mochila dele com os itens (o resto do caminho é da ficha). */
  mochilaDoToken?: CarriedItem[]
  /** A ficha de personagem depois de receber e de levar a picada; `null` = token sem ficha. */
  personagem: Personagem | null
  registro: RegistroDoObjetoAberto
}

/** A ficha alcança o objeto: a régua do item no chão (`ITEM_REACH_CELLS` além da borda dela, até o contorno do objeto). */
export function fichaAlcancaObjeto(token: Pick<Token, 'x' | 'y' | 'size' | 'piso'>, prop: Prop, grid: number, pelosObjetos?: AlcancePeloObjeto): boolean {
  const alcance = tokenRadiusOf(token, grid) + grid * ITEM_REACH_CELLS
  if (distanciaAoObjeto(prop, token) <= alcance) return true
  return pelosObjetos !== undefined && pelosObjetos(token, { x: prop.x, y: prop.y }, alcance)
}

/** A semente do minigame: 32 bits, do sorteio do host. */
export function sementeDoObjeto(sorteio: () => number = Math.random): number {
  return Math.floor(sorteio() * 0x100000000) >>> 0
}

interface Abertura {
  prop: Prop
  jogo: MobiliaComConteudo
  token: Token
  personagem: Personagem | null
  sistema: SistemaDeRpg | null
  nomeDoJogador: string
  em: number
  semJumpscare: boolean
  novoId: () => string
  /** Os documentos do conteúdo saem da biblioteca de agora (o título e o papel que vão à lista). */
  documentoDaBiblioteca: DocumentoDaBiblioteca
}

/** A conta inteira da vitória: o que a tela do jogador recebe e o que o mapa do mestre grava. */
export function abrirObjeto({ prop, jogo, token, personagem, sistema, nomeDoJogador, em, semJumpscare, novoId, documentoDaBiblioteca }: Abertura): {
  desfecho: DesfechoDoObjetoNoFio
  aplicado: Omit<AppliedObjetoAberto, 'sceneId'>
} {
  const conteudo: ConteudoDoObjeto = prop.conteudo ?? conteudoVazio()
  const avisos: string[] = []
  let ficha = personagem
  let mochilaDoToken: CarriedItem[] | undefined
  for (const { item, quantidade } of conteudo.itens) {
    if (ficha !== null) {
      ficha = darNaFicha(ficha, itemParaAMochila(item), quantidade, novoId())?.personagem ?? ficha
      continue
    }
    const recebeu = mochilaComItemDoAcervo(mochilaDoToken ?? token.mochila ?? [], itemParaAMochila(item), quantidade, novoId())
    if (recebeu !== null) mochilaDoToken = recebeu.mochila
  }
  if (conteudo.moedas > 0) {
    if (ficha !== null) ficha = fichaComMochila(ficha, ficha.mochila ?? [], moedasDe(ficha) + conteudo.moedas)
    else avisos.push(`${token.name} não tem ficha de personagem: as ${conteudo.moedas} moedas ficaram no ${NOME_DO_OBJETO[jogo].toLowerCase()}.`)
  }
  const nomeDoObjeto = prop.playerLabel?.trim() || NOME_DO_OBJETO[jogo]
  // Os documentos vão à lista da ficha de personagem, com o "novo" (o "de" é o nome que o jogador vê no objeto).
  const docIds = conteudo.documentos ?? []
  let documentos: string[] = []
  if (docIds.length > 0 && ficha === null) {
    avisos.push(`${token.name} não tem ficha de personagem: ${docIds.length === 1 ? 'o documento ficou' : `os ${docIds.length} documentos ficaram`} no ${NOME_DO_OBJETO[jogo].toLowerCase()}.`)
  } else if (docIds.length > 0 && ficha !== null) {
    const dados = darDocumentos(ficha, docIds, documentoDaBiblioteca, 'objeto', nomeDoObjeto, em)
    ficha = dados.personagem
    documentos = dados.entraram
    avisos.push(...avisosDosDocumentos(dados, ficha.nome))
  }
  const armadilha = conteudo.armadilha
  if (armadilha !== null && armadilha.dano > 0) {
    const recurso = recursoDeVida(sistema)
    const vida = ficha === null || recurso === null ? null : vidaDoPersonagem(ficha, recurso)
    if (ficha !== null && sistema !== null && recurso !== null && vida !== null) {
      ficha = aplicarAjuste(ficha, sistema, { parte: 'recurso', chave: recurso.id, valor: vida.atual - armadilha.dano })
    } else {
      avisos.push(`${token.name} não tem vida numa ficha de personagem: os ${armadilha.dano} PV da picada não foram tirados.`)
    }
  }
  const levou = oQueLevou(conteudo, documentos)
  const verbo = jogo === 'bau' ? 'abriu' : 'quebrou'
  const artigo = jogo === 'caixa' ? 'a' : 'o'
  const registro: RegistroDoObjetoAberto = {
    propId: prop.id,
    jogo,
    titulo: `${nomeDoJogador} ${verbo} ${artigo} ${nomeDoObjeto}`,
    levou: levou === '' ? 'Não tinha nada.' : `Levou ${levou}.`,
    armadilha: armadilha === null ? 'Sem armadilha.' : fraseDaArmadilha(armadilha),
    avisos,
    em,
  }
  const desfecho: DesfechoDoObjetoNoFio = {
    armadilha: armadilha?.tipo ?? null,
    jumpscare: !semJumpscare,
    itens: conteudo.itens.map(({ item, quantidade }) => ({ nome: item.nome, quantidade })),
    moedas: conteudo.moedas,
    // Só com documento: o desfecho de sempre não muda de forma (`documentos` ausente = nenhum).
    ...(documentos.length > 0 ? { documentos } : {}),
    dano: armadilha?.dano ?? 0,
    efeito: armadilha !== null && armadilha.turnos > 0 ? armadilha.efeito : null,
    turnos: armadilha?.turnos ?? 0,
  }
  return {
    desfecho,
    aplicado: {
      propId: prop.id,
      por: nomeDoJogador,
      em,
      tokenId: token.id,
      efeito: armadilha !== null && armadilha.turnos > 0 ? { nome: armadilha.efeito, turnos: armadilha.turnos, porVez: armadilha.porVez } : null,
      ...(mochilaDoToken === undefined ? {} : { mochilaDoToken }),
      personagem: ficha === personagem ? null : ficha,
      registro,
    },
  }
}

/**
 * A abertura no mapa (pura e reaplicável, para o passo do desfazer da cena):
 * o objeto aberto ou quebrado, e na ficha a pastilha com o prazo e, sem ficha
 * de personagem, a mochila nova. Objeto já aberto ou ficha que sumiu: o resto vale.
 */
export function mapaComObjetoAberto(map: MapData, aberto: Pick<AppliedObjetoAberto, 'propId' | 'por' | 'em' | 'tokenId' | 'efeito' | 'mochilaDoToken'>): MapData {
  const props = map.props.map((prop) => (prop.id === aberto.propId ? objetoAberto(prop, aberto.por, aberto.em) : prop))
  const comObjeto = props.some((prop, i) => prop !== map.props[i]) ? { ...map, props } : map
  const { efeito, mochilaDoToken } = aberto
  if (efeito === null && mochilaDoToken === undefined) return comObjeto
  return mudarFichaNoMapa(comObjeto, aberto.tokenId, (token) => {
    const comMochila = mochilaDoToken === undefined ? token : { ...token, mochila: mochilaDoToken }
    return efeito === null ? comMochila : porCondicaoNaFicha(comMochila, efeito.nome, [], { turnos: efeito.turnos, porVez: efeito.porVez })
  })
}

/** O nome do minigame, para o título do overlay quando o mestre não deu rótulo. */
export function nomeDoJogoDoObjeto(prop: Prop, jogo: MobiliaComConteudo): string {
  return prop.playerLabel?.trim() || MINIGAME_DO_OBJETO[jogo]
}
