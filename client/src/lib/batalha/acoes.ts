import { valorDoRank } from '../ajusteDaFicha'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { rankDoValor, type SistemaDeRpg } from '../sistemaDeRpg'
import { CARGA_MAX, type AcaoDaTecnica, type CombateDoPersonagem } from './combate'
import type { LeituraDoDano } from './formula'
import type { LeituraDoCusto, LeituraDoTempo } from './leituraDaFicha'
import type { AcoesExtras, GastoDaVez } from './turnos'

/**
 * ECONOMIA DA VEZ, F2 (seção 3.3 de docs/planos/batalha-one-piece-f2-plano.md;
 * decisões 6 e 8): quantas ações a carta tem e já gastou, o limite de blocos
 * do "Mov 2/4" e o motivo de cada técnica apagada no menu.
 *
 * Simples = 1 + extras; Movimento = 1 + extras; Bônus = só as extras (decisão
 * 8). Completa gasta 1 Simples + 1 Movimento. Limite de blocos = rank da
 * Agilidade × blocos por rank × Movimentos que sobraram (conta, não trava).
 *
 * FASE 0 (contrato): `tecnicasNoMenu` tem corpo provisório (lista vazia); a
 * fase 1 o troca sem mudar a assinatura. O resto já vale.
 *
 * Puro: sem store, sem rede.
 */

export interface Contagem {
  usadas: number
  total: number
}

export interface AcoesDaVez {
  simples: Contagem
  movimento: Contagem
  bonus: Contagem
  /** `limite` null = sistema sem rank de Agilidade ("Mov 3", sem teto). */
  blocos: { andados: number; limite: number | null }
}

const GASTO_ZERO: GastoDaVez = { simples: 0, movimento: 0, bonus: 0, blocos: 0 }

/** As ações da vez da carta, com o que já gastou e as extras do mestre. */
export function acoesDaVez(gasto: GastoDaVez | undefined, extras: AcoesExtras | undefined, rankDeAgilidade: number | null, blocosPorRank: number): AcoesDaVez {
  const gastas = gasto ?? GASTO_ZERO
  const movimento: Contagem = { usadas: gastas.movimento, total: 1 + (extras?.mov ?? 0) }
  const sobram = Math.max(0, movimento.total - movimento.usadas)
  return {
    simples: { usadas: gastas.simples, total: 1 + (extras?.simples ?? 0) },
    movimento,
    bonus: { usadas: gastas.bonus, total: extras?.bonus ?? 0 },
    blocos: { andados: gastas.blocos, limite: rankDeAgilidade === null ? null : rankDeAgilidade * blocosPorRank * sobram },
  }
}

/** O rank da Agilidade pela tabela do sistema; `null` = sistema sem o atributo ou sem tabela. */
export function rankDeAgilidade(personagem: Personagem, sistema: SistemaDeRpg): number | null {
  const atributo =
    sistema.atributos.find((candidato) => candidato.id === 'agilidade') ??
    sistema.atributos.find((candidato) => candidato.nome.trim().toLocaleLowerCase('pt-BR') === 'agilidade')
  if (atributo === undefined) return null
  return rankDoValor(atributo.rank, valorDoRank(personagem, atributo.id))
}

function sobra(contagem: Contagem): boolean {
  return contagem.usadas < contagem.total
}

/** A ação cabe no que sobrou da vez? */
export function cabeAcao(acoes: AcoesDaVez, acao: AcaoDaTecnica): boolean {
  switch (acao) {
    case 'simples':
      return sobra(acoes.simples)
    case 'completa':
      return sobra(acoes.simples) && sobra(acoes.movimento)
    case 'bonus':
      return sobra(acoes.bonus)
    case 'livre':
      return true
  }
}

/** O gasto com a ação somada. "livre": o MESMO gasto. */
export function gastarAcao(gasto: GastoDaVez, acao: AcaoDaTecnica): GastoDaVez {
  switch (acao) {
    case 'simples':
      return { ...gasto, simples: gasto.simples + 1 }
    case 'completa':
      return { ...gasto, simples: gasto.simples + 1, movimento: gasto.movimento + 1 }
    case 'bonus':
      return { ...gasto, bonus: gasto.bonus + 1 }
    case 'livre':
      return gasto
  }
}

/** Uma técnica como o menu a mostra; `motivo` presente = apagada, com a frase. */
export interface TecnicaNoMenu {
  cartao: CartaoDaFicha
  /** A transformação ligada de onde a técnica vem. */
  forma?: string
  custo: LeituraDoCusto
  acao: AcaoDaTecnica | 'passiva' | null
  tempo: LeituraDoTempo
  dano: LeituraDoDano
  overload: boolean
  /** Q4: o valor inicial do interruptor Perfurante. */
  perfurante: boolean
  motivo: string | null
}

/** As técnicas do menu com o motivo de cada apagada. Fase 0: nenhuma. */
export function tecnicasNoMenu(
  _personagem: Personagem,
  _sistema: SistemaDeRpg,
  _combate: CombateDoPersonagem | undefined,
  _acoes: AcoesDaVez | null,
  _arma: CartaoDaFicha | null,
): TecnicaNoMenu[] {
  return []
}

/**
 * Por que o Concentrar está apagado, ou `null` (pode). Gasta a Simples (ou a
 * Bônus, se só sobrou ela), uma vez por vez, carga até 3. `chaveDaVez` =
 * `chaveDaVez(rodada, cartaId)`.
 */
export function motivoDoConcentrar(combate: CombateDoPersonagem | undefined, acoes: AcoesDaVez, chaveDaVez: string): string | null {
  if (combate?.concentrouEm === chaveDaVez) return 'Já concentrou nesta vez'
  if ((combate?.carga ?? 0) >= CARGA_MAX) return 'Carga no máximo'
  if (!sobra(acoes.simples) && !sobra(acoes.bonus)) return 'A ação simples deste turno já foi usada'
  return null
}
