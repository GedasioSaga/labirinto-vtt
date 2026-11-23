/**
 * REQUISITOS, fase C (docs/design/habilidades/REQUISITOS.md §6): os gastos dos requisitos que valem,
 * gravados na linha da ação (técnica, Atacar com arma, item, ligar a forma, Evoluir), depois do custo
 * normal. O combate muda por uma parte "combate" (acumulador, concentração, reação), a ficha pela mesa
 * (SP, HP) e a mochila pelo gasto do item; o Desfazer da linha volta tudo.
 */
import { acumuladoresDoPersonagem } from '../../lib/batalha/acumuladorNaBatalha'
import { combateVazio } from '../../lib/batalha/combate'
import type { MesaDaBatalha } from '../../lib/batalha/mesa'
import type { Reversao } from '../../lib/batalha/registro'
import type { Gasto } from '../../lib/batalha/requisitos/avaliar'
import { mesmaReferencia } from '../../lib/batalha/requisitos/contexto'
import { ajustesDoAliado, ajustesDosGastos, aplicarGastos, fraseDoPagoPeloAliado } from '../../lib/batalha/requisitos/gastos'
import type { AutorDaAcao, TurnosDaCena } from '../../lib/batalha/turnos'
import { quemNaFicha } from './cena'
import { gastarItemNaMesa, mexerNaFicha, reversaoDaFicha } from './naMesa'

/** O que os gastos deixaram: os turnos com o combate novo, as partes da linha e o texto ("gastou Polaridade 2"). */
export interface GastosGravados {
  turnos: TurnosDaCena
  partes: Reversao[]
  texto: string | null
}

/**
 * Grava os gastos de `personagemId` (a ficha da carta `tokenId`). `recusada` = a ficha ou a mochila não
 * aceitou (quem chama devolve o que a linha já mexeu e a ação não sai).
 */
export function gastarOsRequisitos(mesa: MesaDaBatalha, sceneKey: string, personagemId: string, tokenId: string, turnos: TurnosDaCena, gastos: readonly Gasto[], autor: AutorDaAcao): GastosGravados | 'recusada' {
  if (gastos.length === 0) return { turnos, partes: [], texto: null }
  const personagem = mesa.personagens().find((candidato) => candidato.id === personagemId)
  const definicoes = personagem === undefined ? [] : acumuladoresDoPersonagem(personagem)
  const antes = turnos.combate?.[personagemId]
  const base = antes ?? combateVazio()
  const aplicados = aplicarGastos(base, gastos, definicoes, turnos.rodada)
  const partes: Reversao[] = []
  let novos = turnos
  if (aplicados.combate !== base) {
    partes.push({ tipo: 'combate', personagemId, antes: antes ?? null, depois: aplicados.combate })
    novos = { ...novos, combate: { ...(novos.combate ?? {}), [personagemId]: aplicados.combate } }
  }
  if (aplicados.sp > 0 || aplicados.hp > 0) {
    const feito = mexerNaFicha(mesa, personagemId, (atual, sistema) => ajustesDosGastos(atual, sistema, aplicados), quemNaFicha(autor))
    if (feito === 'recusada') return 'recusada'
    partes.push(...reversaoDaFicha(personagemId, feito))
  }
  // F1 que gasta: um por um, da vaga do item (pelo id do Acervo ou da vaga; senão pelo nome).
  for (const { item, n } of aplicados.itens) {
    for (let vez = 0; vez < n; vez++) {
      const mochila = mesa.personagens().find((candidato) => candidato.id === personagemId)?.mochila ?? []
      const vaga = mochila.find((candidata) => (candidata.quantidade ?? 1) > 0 && mesmaReferencia({ id: candidata.itemId ?? candidata.id, nome: candidata.nome }, item))
      const parte = vaga === undefined ? null : gastarItemNaMesa(mesa, sceneKey, tokenId, personagemId, vaga.id)
      if (parte === null || parte === 'recusada') return 'recusada'
      partes.push(parte)
    }
  }
  // REQUISITOS E (G1 aceito): o aliado PAGA da ficha dele, na mesma linha (o Desfazer devolve os dois); nada entra em quem pediu.
  const pagos: string[] = []
  for (const { aliadoTokenId, de, n } of aplicados.doAliado) {
    const aliadoId = turnos.cartas.find((carta) => carta.tokenId === aliadoTokenId)?.personagemId ?? null
    const aliado = aliadoId === null ? undefined : mesa.personagens().find((candidato) => candidato.id === aliadoId)
    if (aliadoId === null || aliado === undefined) return 'recusada'
    const feito = mexerNaFicha(mesa, aliadoId, (atual, sistema) => ajustesDoAliado(atual, sistema, de, n), quemNaFicha(autor))
    if (feito === 'recusada') return 'recusada'
    partes.push(...reversaoDaFicha(aliadoId, feito))
    pagos.push(fraseDoPagoPeloAliado(aliado.nome.trim() || 'O aliado', de, n))
  }
  // Entre parênteses, como o "(com a ajuda de X)": a frase cola no fim da linha do golpe.
  const texto = pagos.length === 0 ? aplicados.texto : [aplicados.texto, `(${pagos.join(' e ')})`].filter((parte): parte is string => parte !== null).join(' ')
  return { turnos: novos, partes, texto }
}

/** A nota da linha: o que gastou e o que o portão disse ("(declarou: ...)", "(o mestre forçou: ...)"). */
export function notaDaLinha(...partes: readonly (string | null)[]): string | null {
  const ficam = partes.filter((parte): parte is string => parte !== null && parte !== '')
  return ficam.length === 0 ? null : ficam.join(' ')
}
