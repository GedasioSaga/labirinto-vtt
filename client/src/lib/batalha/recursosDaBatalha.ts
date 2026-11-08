import { maximoComposto, temMaximo, type Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { MODS_POR_SELO_MAX, type CombateDoPersonagem, type ModDoSelo, type SeloDaBatalha } from './combate'
import { recursoDoCusto, recursoDoEscudo } from './leituraDaFicha'
import { comSeloNovo, criarSelo, ondeNaVez, selosDoToken } from './selos'
import type { TurnosDaCena } from './turnos'

/**
 * RECURSOS DA BATALHA (conserto das fichas F1, fatia S3 de
 * docs/planos/conserto-fichas-2026-11-08.md; regras do sistema em
 * docs/auditoria-fichas/respostas-do-grilling.md): o SP que volta no começo
 * da vez, o Escudo cheio a cada batalha e o cansaço do Overload (os
 * atributos base pela metade até o fim da batalha). A store aplica pela mesa.
 *
 * Puro: sem store, sem rede.
 */

/** O nome do selo do cansaço do Overload (cabe no teto do nome do selo). */
export const NOME_DO_CANSACO = 'Cansaço do Overload'
/** A origem do selo do cansaço: com o nome, é como a batalha o reconhece (o Revigorar da F2 tira por aqui). */
export const ORIGEM_DO_CANSACO = 'Overload'

/** É um selo do cansaço do Overload. */
export function ehSeloDoCansaco(selo: Pick<SeloDaBatalha, 'nome' | 'origem'>): boolean {
  return selo.nome === NOME_DO_CANSACO && selo.origem === ORIGEM_DO_CANSACO
}

/**
 * Overload (respostas do Jimboy e da Ryoko): depois dele, os atributos BASE
 * (a ficha sem forma: valor + modificador; os cartões ligados ficam de fora
 * e somam por cima) ficam pela METADE, para baixo (51 → 25), até o fim da
 * batalha. Os mods do selo: quanto sai de cada atributo (FOR 51 → -26).
 * Atributo em 0 ou abaixo fica de fora.
 */
export function modsDoCansaco(personagem: Personagem, sistema: SistemaDeRpg): ModDoSelo[] {
  const mods: ModDoSelo[] = []
  for (const atributo of sistema.atributos) {
    const semForma = numeroDaFicha(personagem.atributos, atributo.id) + numeroDaFicha(personagem.modificadoresDosAtributos, atributo.id)
    if (semForma <= 0) continue
    mods.push({ alvo: atributo.id, delta: -(semForma - Math.floor(semForma / 2)) })
  }
  return mods
}

/**
 * O cansaço mora na BATALHA, nunca na ficha (achado da revisão S3: gravado na
 * ficha, um app fechado no meio deixava os atributos pela metade para sempre).
 * São selos "Cansaço do Overload" sem turnos, com os mods de `modsDoCansaco`
 * em grupos de `MODS_POR_SELO_MAX` (o One Piece tem 8 atributos = 2 selos):
 * somam pelo `bonusDaBatalha` e somem com a batalha. Marcados `ajuste`: na
 * carta de NPC os números não saem a quem não é da ficha (o delta entrega o
 * atributo). Já cansado, ou nada a cortar = `null`. Grupo que não cabe no
 * teto de selos da ficha fica de fora.
 */
export function comOCansaco(turnos: TurnosDaCena, tokenId: string, mods: readonly ModDoSelo[], novoId: () => string): { turnos: TurnosDaCena; selos: SeloDaBatalha[] } | null {
  if (mods.length === 0 || selosDoToken(turnos.selos, tokenId).some(ehSeloDoCansaco)) return null
  const onde = { rodada: turnos.rodada, ...ondeNaVez(turnos), origem: ORIGEM_DO_CANSACO }
  let lista = turnos.selos
  const novos: SeloDaBatalha[] = []
  for (let inicio = 0; inicio < mods.length; inicio += MODS_POR_SELO_MAX) {
    const selo: SeloDaBatalha = { ...criarSelo(tokenId, { nome: NOME_DO_CANSACO, turnos: null, mods: mods.slice(inicio, inicio + MODS_POR_SELO_MAX), natureza: 'debuff' }, { id: novoId(), ...onde }), ajuste: true }
    const cabe = comSeloNovo(lista, selo)
    if (cabe === null) break
    lista = cabe
    novos.push(selo)
  }
  return novos.length === 0 ? null : { turnos: { ...turnos, selos: lista }, selos: novos }
}

/** Resposta do Vincent: "+X SP no começo da vez de quem não usou SP na vez anterior", X = 10. */
export const SP_POR_VEZ_SEM_GASTAR = 10

/**
 * O personagem ganha os +10 SP no começo desta vez? `combateAntes` = o
 * combate dele ANTES de a vez começar: já teve uma vez (a primeira da batalha
 * não ganha) e não gastou SP desde ela.
 */
export function ganhaSpNaVez(combateAntes: CombateDoPersonagem | undefined): boolean {
  return combateAntes?.jaJogou === true && combateAntes.gastouSp !== true
}

/** O ajuste dos +10 SP (o `aplicarAjuste` limita no máximo); `null` = sem SP no sistema ou já cheio. */
export function ajusteDoSpDaVez(personagem: Personagem, sistema: SistemaDeRpg): Ajuste | null {
  const recurso = recursoDoCusto(sistema, 'sp')
  if (recurso === null) return null
  const atual = numeroDaFicha(personagem.recursos, recurso.id)
  if (temMaximo(sistema, recurso.id) && atual >= maximoComposto(personagem, recurso.id).total) return null
  return { parte: 'recurso', chave: recurso.id, valor: atual + SP_POR_VEZ_SEM_GASTAR }
}

/**
 * Resposta do Vincent ("o Escudo volta cheio a cada batalha; grava o
 * máximo"): o cheio do Escudo fica em `maximos` (o Escudo é um número só no
 * sistema, sem campo de máximo). No começo da batalha: sem cheio gravado, ou
 * com o Escudo acima dele (o mestre subiu), o de agora vira o cheio; abaixo,
 * o Escudo volta ao cheio. `null` = nada a mudar (ou o sistema não tem
 * Escudo). Devolve o máximo a gravar e o ajuste do atual, separados: o
 * máximo do Escudo não passa pelo `aplicarAjuste` (ele ignora o máximo de
 * recurso sem máximo).
 */
export function escudoNoComeco(personagem: Personagem, sistema: SistemaDeRpg): { escudoId: string; cheio: number; ajuste: Ajuste | null } | null {
  const escudo = recursoDoEscudo(sistema)
  if (escudo === null || temMaximo(sistema, escudo.id)) return null
  const atual = numeroDaFicha(personagem.recursos, escudo.id)
  const gravado = personagem.maximos[escudo.id]
  if (gravado === undefined || atual > gravado) return atual > 0 ? { escudoId: escudo.id, cheio: atual, ajuste: null } : null
  if (atual === gravado) return null
  return { escudoId: escudo.id, cheio: gravado, ajuste: { parte: 'recurso', chave: escudo.id, valor: gravado } }
}

