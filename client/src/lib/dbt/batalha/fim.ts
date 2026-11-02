import { epTotal } from './contas'
import { vitoriaAutomatica, type FichaLida } from './leitura'
import { escrever, type Trabalho } from './trabalho'
import { PCT_POR_USO, type CombatenteDBT, type IdDoCombatente, type Lado, type NucleoDBT } from './tipos'

/**
 * FIM DA BATALHA E AVISOS (docs/planos/dbt-batalha.md, seção 13 e 6.3).
 * O aviso nunca encerra sozinho: o mestre decide.
 */

/** Uma linha da tabela do fim, por personagem com ficha DBT (o mestre edita antes de aplicar). */
export interface LinhaDoFimDBT {
  personagemId: string
  nome: string
  pkMax: number
  /** O que a ficha já tinha bloqueado (batalhas anteriores, até o Descanso Longo). */
  pkBloqueadosAntes: number
  pctTecnicas: number
  pctInferiores: number
  /** 2º uso da forma máxima: bloqueado na hora (8.5.1.3). */
  kiBloqueadoNaBatalha: number
  novos: number
  /** min(pkMax, antes + novos). */
  pkBloqueados: number
  /** Somar ao contador da ficha. */
  usosTransfMaxima: number
  choqueUsado: boolean
  /** Para o mestre antes de aplicar (ex.: a ficha não tem espaço para os contadores). */
  aviso: string | null
}

const AVISO_SEM_ESPACO = 'A ficha está no limite de contadores: os usos da forma máxima e o Choque não serão gravados. Anote à mão ou apague um contador antes.'

/** O que gravar na ficha ao "Aplicar e encerrar". */
export interface MudancaDoFimDBT {
  personagemId: string
  pkBloqueados: number
  usosTransfMaxima: number
  choqueUsado: boolean
  /** max(0, pkMax - pkBloqueados); o PV fica como está. */
  pkAtual: number
}

function pctDosUsos(c: CombatenteDBT, exaustao: boolean): { tecnicas: number; inferiores: number } {
  if (!exaustao) return { tecnicas: 0, inferiores: 0 }
  return {
    tecnicas: PCT_POR_USO * c.usos.tecnicaDeRankMaximo,
    inferiores: c.usos.transfInferiores.reduce((soma, estagio) => soma + PCT_POR_USO * estagio, 0),
  }
}

/**
 * A tabela do fim (8.5.1): exemplo da p. 107, 6 usos de técnica C com 30 PK
 * bloqueiam 9. Personagem com mais de um token soma os usos de todos.
 */
export function resumoDoFim(nucleo: NucleoDBT, fichas: ReadonlyMap<string, FichaLida | null>): LinhaDoFimDBT[] {
  const porPersonagem = new Map<string, LinhaDoFimDBT>()
  for (const c of Object.values(nucleo.combatentes)) {
    if (c.personagemId === null) continue
    const f = fichas.get(c.personagemId) ?? null
    if (f === null) continue
    const pct = pctDosUsos(c, nucleo.opcoes.exaustao)
    const anterior = porPersonagem.get(c.personagemId)
    const pctTecnicas = (anterior?.pctTecnicas ?? 0) + pct.tecnicas
    const pctInferiores = (anterior?.pctInferiores ?? 0) + pct.inferiores
    const kiBloqueadoNaBatalha = (anterior?.kiBloqueadoNaBatalha ?? 0) + c.kiBloqueado
    const novos = Math.floor((f.pk.max * (pctTecnicas + pctInferiores)) / 100) + kiBloqueadoNaBatalha
    const usosTransfMaxima = (anterior?.usosTransfMaxima ?? 0) + c.usos.transfMaxima
    const choqueUsado = (anterior?.choqueUsado ?? false) || c.usos.choque
    porPersonagem.set(c.personagemId, {
      personagemId: c.personagemId,
      nome: f.nome,
      pkMax: f.pk.max,
      pkBloqueadosAntes: f.pkBloqueadosDaFicha,
      pctTecnicas,
      pctInferiores,
      kiBloqueadoNaBatalha,
      novos,
      pkBloqueados: Math.min(f.pk.max, f.pkBloqueadosDaFicha + novos),
      usosTransfMaxima,
      choqueUsado,
      aviso: f.semEspacoParaDesgaste && (usosTransfMaxima > 0 || choqueUsado) ? AVISO_SEM_ESPACO : null,
    })
  }
  return [...porPersonagem.values()]
}

/** A linha (talvez editada pelo mestre) vira a mudança; números fora da faixa são presos. */
export function mudancaDoFim(linha: LinhaDoFimDBT): MudancaDoFimDBT {
  const pkMax = Math.max(0, Math.trunc(linha.pkMax))
  const pkBloqueados = Math.min(pkMax, Math.max(0, Math.trunc(linha.pkBloqueados)))
  return {
    personagemId: linha.personagemId,
    pkBloqueados,
    usosTransfMaxima: Math.max(0, Math.trunc(linha.usosTransfMaxima)),
    choqueUsado: linha.choqueUsado,
    pkAtual: Math.max(0, pkMax - pkBloqueados),
  }
}

export interface VitoriaAutomaticaDBT {
  vencedorId: IdDoCombatente
  perdedorId: IdDoCombatente
}

/** Pares de lados opostos, de pé, em que um tem EP >= 2x o outro (com o menor >= 1). */
export function vitoriasAutomaticas(nucleo: NucleoDBT, fichas: ReadonlyMap<string, FichaLida | null>): VitoriaAutomaticaDBT[] {
  const dePe = Object.values(nucleo.combatentes).filter((c) => c.morte.situacao === 'de-pe')
  const fichaDo = (c: CombatenteDBT): FichaLida | null => (c.personagemId === null ? null : (fichas.get(c.personagemId) ?? null))
  const vitorias: VitoriaAutomaticaDBT[] = []
  for (let i = 0; i < dePe.length; i += 1) {
    for (let j = i + 1; j < dePe.length; j += 1) {
      const a = dePe[i]
      const b = dePe[j]
      if (a.lado === b.lado) continue
      const fa = fichaDo(a)
      const fb = fichaDo(b)
      if (fa === null || fb === null) continue
      const epA = epTotal(a, fa)
      const epB = epTotal(b, fb)
      if (Math.min(epA, epB) < 1) continue
      const quem = vitoriaAutomatica(epA, epB)
      if (quem === 'a') vitorias.push({ vencedorId: a.id, perdedorId: b.id })
      else if (quem === 'b') vitorias.push({ vencedorId: b.id, perdedorId: a.id })
    }
  }
  return vitorias
}

/** Lados sem ninguém de pé (salvaguarda, inconsciente ou morto). */
export function ladosDerrotados(nucleo: NucleoDBT): Lado[] {
  const lados = new Map<Lado, boolean>()
  for (const c of Object.values(nucleo.combatentes)) lados.set(c.lado, (lados.get(c.lado) ?? false) || c.morte.situacao === 'de-pe')
  return [...lados.entries()].filter(([, algumDePe]) => !algumDePe).map(([lado]) => lado)
}

/** Avisos do fim da rodada (6.3), só ao mestre. */
export function avisosDaRodada(t: Trabalho): void {
  for (const { vencedorId, perdedorId } of vitoriasAutomaticas(t.nucleo, t.ctx.fichas)) {
    const vencedor = t.nucleo.combatentes[vencedorId]
    const perdedor = t.nucleo.combatentes[perdedorId]
    escrever(t, `Vitória automática possível: ${vencedor.nome} tem 2x a EP de ${perdedor.nome} (o mestre decide)`, '')
  }
  const lados = new Set(Object.values(t.nucleo.combatentes).map((c) => c.lado))
  const derrotados = ladosDerrotados(t.nucleo)
  if (lados.size > 1 && derrotados.length > 0) escrever(t, `Lado sem ninguém de pé (${derrotados.join(', ')}): encerrar a batalha?`, '')
}
