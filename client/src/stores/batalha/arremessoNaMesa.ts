import { quandoAcabaAEspera } from '../../lib/batalha/leituraDaFicha'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import { acaoDaRecarga, textoDoGastoDaRecarga } from '../../lib/batalha/penteNaBatalha'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import { gastarItemNaMesa } from './naMesa'
import { armaNaMesa, cabeNaVez, esperaNaArma, gastarNaVez, type RecargaNaMesa, type VezDaRecarga } from './recargaDoPente'

/**
 * O ARREMESSO NA MESA DA BATALHA (docs/design/itens-rework/PLANO.md, etapa E6b; decisão 7). Depois do
 * Atacar com uma arma de Arremesso equipada:
 *
 * - sem "Volta para a mão": 1 sai da pilha da mochila (a mesma reversão do "Usar": o Desfazer da linha
 *   devolve a unidade, ou a vaga com 1). O "Tempo de recarga" é a espera até o próximo estar na mão;
 *   a ação dele gasta agora se cabe na vez, senão o próximo chega no começo da próxima vez;
 * - com "Volta para a mão" (o boomerang): nada sai da mochila; fica fora da mão pelo "Tempo de
 *   recarga" (1 = volta no começo da próxima vez de quem jogou).
 *
 * A espera mora em `combate.recargas` da arma (desce no começo de cada vez do dono, como a do pente) e
 * some com a batalha: no fim dela o boomerang está de volta.
 */
export function arremessoDepoisDoAtaque(mesa: MesaDaBatalha, sceneKey: string, vez: VezDaRecarga, turnos: TurnosDaCena, armaId: string): RecargaNaMesa | 'recusada' {
  const { carta, chaveDoGasto } = vez
  const nada: RecargaNaMesa = { turnos, partes: [], texto: null }
  const personagemId = carta.personagemId
  if (personagemId === null) return nada
  const arma = armaNaMesa(mesa, sceneKey, carta.tokenId, personagemId, armaId)
  const arremesso = arma?.arremesso
  if (arma === undefined || arremesso === undefined) return nada
  const nome = arma.nome.trim() || 'O item'
  const { recarga } = arremesso
  if (arremesso.volta) {
    const dono = mesa.personagens().find((candidato) => candidato.id === personagemId)?.nome.trim() || 'quem jogou'
    const espera = esperaNaArma(turnos, personagemId, arma.id, recarga.rodadas)
    const texto = recarga.rodadas < 1 ? `${nome} voltou para a mão` : `${nome} volta para a mão de ${dono} ${quandoAcabaAEspera(recarga.rodadas)} dele`
    return { turnos: espera.turnos, partes: espera.partes, texto }
  }
  // O `podeAgir` já recusou a pilha vazia: sem a vaga aqui, a mochila mudou no meio, e o golpe não sai.
  const parte = gastarItemNaMesa(mesa, sceneKey, carta.tokenId, personagemId, arremesso.vagaId)
  if (parte === null || parte === 'recusada') return 'recusada'
  const sobram = Math.max(0, arremesso.quantos - 1)
  const naMochila = `${nome} na mochila: ${arremesso.quantos} → ${sobram}`
  if (sobram < 1) return { turnos, partes: [parte], texto: `${naMochila}, era o último` }
  const acao = acaoDaRecarga(recarga)
  // A Livre, ou a ação que ainda cabe nesta vez: o próximo vai para a mão agora (a espera conta daqui).
  if (acao === 'livre' || (turnos.vez === carta.id && cabeNaVez(mesa, vez, turnos, acao))) {
    const gasto = gastarNaVez(turnos, chaveDoGasto, acao)
    const espera = esperaNaArma(gasto.turnos, personagemId, arma.id, recarga.rodadas)
    const comoVai = acao === 'livre' ? '' : ` (${textoDoGastoDaRecarga(recarga)})`
    const proximo = recarga.rodadas < 1 ? (acao === 'livre' ? '' : `; o próximo já está na mão${comoVai}`) : `; o próximo chega à mão ${quandoAcabaAEspera(recarga.rodadas)}${comoVai}`
    return { turnos: espera.turnos, partes: [parte, ...gasto.partes, ...espera.partes], texto: `${naMochila}${proximo}` }
  }
  // A ação de pôr o próximo na mão já foi gasta nesta vez: ele chega no começo da próxima.
  const rodadas = Math.max(1, recarga.rodadas)
  const espera = esperaNaArma(turnos, personagemId, arma.id, rodadas)
  return { turnos: espera.turnos, partes: [parte, ...espera.partes], texto: `${naMochila}; o próximo chega à mão ${quandoAcabaAEspera(rodadas)} (${recarga.acao})` }
}
