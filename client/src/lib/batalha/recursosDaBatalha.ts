import { maximoComposto, temMaximo, type Ajuste } from '../ajusteDaFicha'
import { numeroDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { CombateDoPersonagem } from './combate'
import { recursoDoCusto, recursoDoEscudo } from './leituraDaFicha'

/**
 * RECURSOS DA BATALHA (conserto das fichas F1, fatia S3 de
 * docs/planos/conserto-fichas-2026-11-08.md; regras do sistema em
 * docs/auditoria-fichas/respostas-do-grilling.md): o SP que volta no começo
 * da vez, o Escudo cheio a cada batalha e o cansaço do Overload (os
 * atributos base pela metade até o fim da batalha). A store aplica pela mesa.
 *
 * Puro: sem store, sem rede.
 */

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

/**
 * Overload (respostas do Jimboy e da Ryoko): depois dele, os atributos BASE
 * (a ficha sem forma: valor + modificador; os cartões ligados ficam de fora
 * e somam por cima) ficam pela METADE, para baixo (51 → 25), até o fim da
 * batalha. Devolve os ajustes do modificador e quanto saiu de cada atributo
 * (`cansaco`, para devolver no fim). Atributo em 0 ou abaixo fica como está.
 */
export function cansacoDoOverload(personagem: Personagem, sistema: SistemaDeRpg): { ajustes: Ajuste[]; cansaco: Record<string, number> } {
  const ajustes: Ajuste[] = []
  const cansaco: Record<string, number> = {}
  for (const atributo of sistema.atributos) {
    const modificador = numeroDaFicha(personagem.modificadoresDosAtributos, atributo.id)
    const semForma = numeroDaFicha(personagem.atributos, atributo.id) + modificador
    if (semForma <= 0) continue
    const sai = semForma - Math.floor(semForma / 2)
    ajustes.push({ parte: 'modAtributo', chave: atributo.id, valor: modificador - sai })
    cansaco[atributo.id] = sai
  }
  return { ajustes, cansaco }
}

/** O fim da batalha: o que o Overload tirou de cada modificador volta (por diferença: o que mudou depois fica). */
export function ajustesDoFimDoCansaco(personagem: Personagem, cansaco: Readonly<Record<string, number>>): Ajuste[] {
  return Object.entries(cansaco).map(([atributoId, saiu]): Ajuste => ({ parte: 'modAtributo', chave: atributoId, valor: numeroDaFicha(personagem.modificadoresDosAtributos, atributoId) + saiu }))
}
