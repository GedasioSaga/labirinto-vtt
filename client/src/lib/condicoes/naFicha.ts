import type { CondicaoPropria } from '../../types/map'
import { N_DA_CURA_MAX, N_DA_VIDA_MAX } from '../condicoesProprias'
import { CONDICOES_NA_FICHA_MAX, condicoesDaFichaLidas } from '../itens/leitura'
import type { CondicaoNaFicha, GatilhoDaCondicao } from '../itens/modelo'
import type { Personagem } from '../personagem'
import { condicaoDoCatalogo, type CondicaoDoCatalogo } from './catalogo'

/**
 * AS CONDIÇÕES NA FICHA (sistema de itens refeito, PLANO §1.5; etapa E4a). Uma fonte só: a
 * condição de alguém mora em `Personagem.condicoes` (jogador: a ficha; NPC: a cópia daquele
 * token), nunca no token com ficha. Aqui estão as regras que todo mundo usa, fora e dentro da
 * batalha:
 *  - PÔR: a mesma condição de novo RENOVA (prazo e número novos, o mesmo id), não soma outra;
 *  - TIRAR: pelo id da posta ou pelo `condId`;
 *  - FIM DA VEZ de quem está com ela: a "por N turnos" desconta 1 e sai ao chegar a 0; a "até o
 *    fim da batalha" e a "até alguém tirar" não contam;
 *  - COMEÇO DA VEZ: a de regra `vida` vira um PENDENTE (quanto tira); quem chama aplica ou pula
 *    (decisão 10: "Aplicar ou Pular"). Fora da batalha, o "Passar turno" aplica todos;
 *  - CURA: a de regra `cura` corta a cura recebida (D7: dois cortes multiplicam, como na batalha);
 *  - FIM DA BATALHA: saem as que têm prazo e as "até o fim da batalha"; a "até alguém tirar" fica
 *    (decisão 11).
 *
 * Só o mestre escreve (decisão 18). Puro: devolve a ficha nova, e a MESMA ficha quando nada muda
 * (quem chama não grava à toa).
 */

/** Por quanto tempo: N turnos (os da vez de quem está com ela), até o fim da batalha, ou até alguém tirar. */
export type DuracaoDaCondicao = number | 'fim' | 'tirar'

/** Teto dos turnos pedidos: o mesmo do leitor da ficha (`condicoesDaFichaLidas`). */
export const TURNOS_DA_CONDICAO_MAX = 999

export function duracaoDe(condicao: CondicaoNaFicha): DuracaoDaCondicao {
  if (condicao.turnos !== null) return condicao.turnos
  return condicao.ateOFimDaBatalha === true ? 'fim' : 'tirar'
}

/** As condições postas na ficha (o leitor do disco já as limpou). */
export function condicoesDe(personagem: Pick<Personagem, 'condicoes'>): readonly CondicaoNaFicha[] {
  return personagem.condicoes ?? []
}

/**
 * A ficha com exatamente estas condições, já passadas pelo leitor do disco (`condicoesDaFichaLidas`,
 * o mesmo juiz do fio e do Worker): o que fica na memória é o que o arquivo guardaria. Lista vazia
 * APAGA o campo (a ficha volta a ser a de antes).
 */
export function comCondicoesNaFicha(personagem: Personagem, condicoes: readonly CondicaoNaFicha[]): Personagem {
  const { condicoes: _antigas, ...sem } = personagem
  const lidas = condicoesDaFichaLidas(condicoes)
  return lidas === undefined ? sem : { ...sem, condicoes: lidas }
}

/** O que se pede ao pôr: a condição do catálogo, por quanto tempo e, se quiser, o número próprio e quem pôs. */
export interface PedidoDeCondicao {
  condId: string
  duracao: DuracaoDaCondicao
  /** Vida por vez ou % da cura; ausente = o do catálogo. Ignorado na de regra `narra`. */
  n?: number
  /** O nome da técnica ou do item que pôs ("Bala de Prata"). */
  origem?: string
  /** O "depois de X turnos" da peça que pôs (vence o do catálogo). Renovar zera a conta. */
  gatilho?: GatilhoDaCondicao
}

function numeroDaRegra(condicao: CondicaoDoCatalogo, pedido: number | undefined): number | null {
  if (condicao.regra === 'narra') return null
  const n = pedido ?? condicao.n
  const teto = condicao.regra === 'vida' ? N_DA_VIDA_MAX : N_DA_CURA_MAX
  return Number.isInteger(n) && n >= 0 && n <= teto ? n : null
}

function prazoDoPedido(duracao: DuracaoDaCondicao): Pick<CondicaoNaFicha, 'turnos' | 'ateOFimDaBatalha'> | null {
  if (duracao === 'tirar') return { turnos: null }
  if (duracao === 'fim') return { turnos: null, ateOFimDaBatalha: true }
  return Number.isInteger(duracao) && duracao >= 1 && duracao <= TURNOS_DA_CONDICAO_MAX ? { turnos: duracao } : null
}

function novoIdDeCondicao(): string {
  return `cnd_${crypto.randomUUID()}`
}

/**
 * PÕE a condição na ficha. A mesma `condId` já posta é RENOVADA no lugar (o mesmo id, prazo e
 * número novos). Devolve a MESMA ficha quando não dá: condição fora do catálogo, prazo ou número
 * torto, ou a ficha no teto (`CONDICOES_NA_FICHA_MAX`).
 */
export function porCondicao(personagem: Personagem, pedido: PedidoDeCondicao, criadas: readonly CondicaoPropria[], novoId: () => string = novoIdDeCondicao): Personagem {
  const doCatalogo = condicaoDoCatalogo(pedido.condId, criadas)
  if (doCatalogo === null) return personagem
  const prazo = prazoDoPedido(pedido.duracao)
  const n = numeroDaRegra(doCatalogo, pedido.n)
  if (prazo === null || (doCatalogo.regra !== 'narra' && n === null)) return personagem
  const atuais = condicoesDe(personagem)
  const antiga = atuais.find((condicao) => condicao.condId === pedido.condId)
  if (antiga === undefined && atuais.length >= CONDICOES_NA_FICHA_MAX) return personagem
  const origem = pedido.origem?.trim() ?? ''
  const posta: CondicaoNaFicha = {
    id: antiga?.id ?? novoId(),
    condId: pedido.condId,
    ...prazo,
    ...(n === null ? {} : { n }),
    ...(origem === '' ? {} : { origem }),
    ...(pedido.gatilho === undefined ? {} : { gatilho: pedido.gatilho }),
  }
  const lista = antiga === undefined ? [...atuais, posta] : atuais.map((condicao) => (condicao === antiga ? posta : condicao))
  return comCondicoesNaFicha(personagem, lista)
}

/** TIRA a condição: a posta com este id, ou toda posta com este `condId`. A MESMA ficha quando não havia. */
export function tirarCondicao(personagem: Personagem, idOuCondId: string): Personagem {
  const atuais = condicoesDe(personagem)
  const ficam = atuais.filter((condicao) => condicao.id !== idOuCondId && condicao.condId !== idOuCondId)
  return ficam.length === atuais.length ? personagem : comCondicoesNaFicha(personagem, ficam)
}

/** O que o fim da vez (ou da batalha) fez: a ficha nova e as condições que saíram, como estavam antes. */
export interface CondicoesQueAcabaram {
  personagem: Personagem
  acabaram: CondicaoNaFicha[]
}

/**
 * FIM DA VEZ de quem tem a ficha (ou do turno, fora da batalha): toda "por N turnos" desconta 1;
 * a que tinha 1 sai. As outras não contam. Nada com prazo = a MESMA ficha.
 */
export function contarFimDaVez(personagem: Personagem): CondicoesQueAcabaram {
  const atuais = condicoesDe(personagem)
  if (!atuais.some((condicao) => condicao.turnos !== null)) return { personagem, acabaram: [] }
  const acabaram: CondicaoNaFicha[] = []
  const ficam: CondicaoNaFicha[] = []
  for (const condicao of atuais) {
    if (condicao.turnos === null) ficam.push(condicao)
    else if (condicao.turnos <= 1) acabaram.push(condicao)
    else ficam.push({ ...condicao, turnos: condicao.turnos - 1 })
  }
  return { personagem: comCondicoesNaFicha(personagem, ficam), acabaram }
}

/** Uma condição de regra `vida` no começo da vez: quanto ela tira. Quem chama aplica ou pula. */
export interface PendenteDaVez {
  /** O id da condição posta. */
  condicaoId: string
  condId: string
  nome: string
  dano: number
}

/**
 * COMEÇO DA VEZ: as condições que tiram vida agora, na ordem da ficha. Não mexe na ficha (o
 * desconto é do fim da vez). A criada que foi apagada do catálogo não tira nada.
 */
export function pendentesDoComecoDaVez(personagem: Pick<Personagem, 'condicoes'>, criadas: readonly CondicaoPropria[]): PendenteDaVez[] {
  return condicoesDe(personagem).flatMap((condicao) => {
    const doCatalogo = condicaoDoCatalogo(condicao.condId, criadas)
    if (doCatalogo === null || doCatalogo.regra !== 'vida') return []
    const dano = condicao.n ?? doCatalogo.n
    return dano > 0 ? [{ condicaoId: condicao.id, condId: condicao.condId, nome: doCatalogo.nome, dano }] : []
  })
}

/** A vida que os pendentes escolhidos tiram, somada. */
export function danoDosPendentes(pendentes: readonly PendenteDaVez[]): number {
  return pendentes.reduce((soma, pendente) => soma + pendente.dano, 0)
}

/** Uma cura depois das condições de regra `cura`: o que chega e o corte que valeu (0 = nenhum). */
export interface CuraCortada {
  cura: number
  corte: number
  /** O nome da condição que cortou; `null` = nenhuma. */
  nome: string | null
}

/**
 * A cura `cura` que chega em quem tem a ficha, depois das de regra `cura`. Rework das condições (D7): dois cortes
 * de condições diferentes MULTIPLICAM, como a batalha (`curaComOsSelos`); cada corte arredonda para baixo, um
 * depois do outro (um corte só dá o mesmo de antes). `corte` = o corte junto, em %; `nome` = o da que mais cortou.
 */
export function curaComAsCondicoes(cura: number, personagem: Pick<Personagem, 'condicoes'>, criadas: readonly CondicaoPropria[]): CuraCortada {
  let maior = 0
  let nome: string | null = null
  let chega = cura
  let fica = 1
  for (const condicao of condicoesDe(personagem)) {
    const doCatalogo = condicaoDoCatalogo(condicao.condId, criadas)
    if (doCatalogo === null || doCatalogo.regra !== 'cura') continue
    const n = Math.min(N_DA_CURA_MAX, condicao.n ?? doCatalogo.n)
    if (!(n > 0)) continue
    chega = Math.floor((chega * (100 - n)) / 100)
    fica = (fica * (100 - n)) / 100
    if (n > maior) {
      maior = n
      nome = doCatalogo.nome
    }
  }
  return { cura: maior === 0 ? cura : chega, corte: maior === 0 ? 0 : Math.round(100 * (1 - fica)), nome }
}

/** FIM DA BATALHA (decisão 11): saem as que têm prazo e as "até o fim da batalha"; a "até alguém tirar" fica. */
export function tirarNoFimDaBatalha(personagem: Personagem): CondicoesQueAcabaram {
  const atuais = condicoesDe(personagem)
  const acabaram = atuais.filter((condicao) => duracaoDe(condicao) !== 'tirar')
  if (acabaram.length === 0) return { personagem, acabaram }
  return { personagem: comCondicoesNaFicha(personagem, atuais.filter((condicao) => duracaoDe(condicao) === 'tirar')), acabaram }
}
