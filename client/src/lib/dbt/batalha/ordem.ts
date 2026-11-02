import { kiDaRecarga, modEfetivo } from './contas'
import { expirarNaRodada, expirarNoFim, expirarNoInicio, testesDoInicio } from './condicoes'
import { transformar } from './formas'
import { avisosDaRodada } from './fim'
import { pedirSalvaguarda, rolarSalvaguarda } from './morte'
import { maisProximo } from './posicao'
import {
  aliadosDe,
  combatente,
  envolver,
  escrever,
  fichaDe,
  foraDeCombate,
  mudarCombatente,
  PASSOS_MAX,
  pkDe,
  porPendencia,
  porRecurso,
  rolarD20,
  tipoDaLinha,
  type Trabalho,
} from './trabalho'
import type { IdDoCombatente, LadosDoDado, NucleoDBT, RolagemDeIniciativa, TurnoAtual } from './tipos'

/**
 * INICIATIVA E VEZ (docs/planos/dbt-batalha.md, seções 5 e 6.1-6.3).
 */

export interface EntradaDaOrdem {
  id: IdDoCombatente
  d20: number
  total: number
  /** DES bruta (o valor, não o modificador): desempata. */
  destreza: number
}

/** Ordena por chave decrescente; empatados na chave inteira re-rolam um d20 só entre eles. */
function ordenarGrupo(lista: readonly EntradaDaOrdem[], chave: (e: EntradaDaOrdem) => readonly number[], rolar: (lados: LadosDoDado) => number, desempates: Map<string, number>): IdDoCombatente[] {
  const contagem = new Map<string, number>()
  for (const entrada of lista) {
    const k = chave(entrada).join('|')
    contagem.set(k, (contagem.get(k) ?? 0) + 1)
  }
  for (const entrada of lista) if ((contagem.get(chave(entrada).join('|')) ?? 0) > 1) desempates.set(entrada.id, rolar(20))
  const comparar = (a: EntradaDaOrdem, b: EntradaDaOrdem): number => {
    const ka = chave(a)
    const kb = chave(b)
    for (let i = 0; i < ka.length; i += 1) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return (desempates.get(b.id) ?? 0) - (desempates.get(a.id) ?? 0)
  }
  return [...lista].sort(comparar).map((entrada) => entrada.id)
}

/**
 * Ordem da iniciativa (seção 5.3): primeiro os 20 naturais (entre eles, a
 * maior DES bruta); depois o resto pelo total, a DES bruta e, persistindo, a
 * re-rolagem só entre os empatados.
 */
export function ordenarIniciativa(entradas: readonly EntradaDaOrdem[], rolar: (lados: LadosDoDado) => number): { ordem: IdDoCombatente[]; desempates: Map<string, number> } {
  const desempates = new Map<string, number>()
  const vintes = entradas.filter((entrada) => entrada.d20 === 20)
  const resto = entradas.filter((entrada) => entrada.d20 !== 20)
  const ordem = [...ordenarGrupo(vintes, (e) => [e.destreza], rolar, desempates), ...ordenarGrupo(resto, (e) => [e.total, e.destreza], rolar, desempates)]
  return { ordem, desempates }
}

function d20Valido(valor: number | undefined): number | undefined {
  return valor === undefined || !Number.isFinite(valor) ? undefined : Math.min(20, Math.max(1, Math.trunc(valor)))
}

/**
 * Rola (ou recebe digitada) a iniciativa de cada um: `d20 + mod DES + EP
 * base + EP da forma declarada` (5.2). Ki inicial = recarga menos a forma
 * declarada (0 com 20 natural, 5.5). Sem ficha: o número digitado é o total.
 */
export function rolarIniciativas(t: Trabalho, digitados: Readonly<Record<string, number>> = {}): void {
  tipoDaLinha(t, 'iniciativa')
  const entradas: EntradaDaOrdem[] = []
  const rolagens = new Map<string, RolagemDeIniciativa>()
  for (const id of t.nucleo.ordem.cartas) {
    const c = combatente(t, id)
    if (c === undefined) continue
    const f = fichaDe(t, c)
    const digitado = Object.hasOwn(digitados, id) ? digitados[id] : undefined
    if (f === null) {
      const total = digitado !== undefined && Number.isFinite(digitado) ? Math.trunc(digitado) : rolarD20(t)
      rolagens.set(id, { d20: 0, total, destreza: 0, desempate: null, transformou: null, digitada: digitado !== undefined })
      entradas.push({ id, d20: 0, total, destreza: 0 })
      continue
    }
    const d20 = d20Valido(digitado) ?? rolarD20(t)
    const total = d20 + modEfetivo(c, f, 'des') + f.epBase + (c.transformacao?.epBonus ?? 0)
    rolagens.set(id, { d20, total, destreza: f.atributos.des, desempate: null, transformou: c.transformacao?.id ?? null, digitada: digitado !== undefined })
    entradas.push({ id, d20, total, destreza: f.atributos.des })
  }
  const { ordem, desempates } = ordenarIniciativa(entradas, (lados) => {
    t.comD20 = true
    return t.ctx.rolar(lados)
  })
  for (const id of ordem) {
    const rolagem = rolagens.get(id)
    if (rolagem === undefined) continue
    const iniciativa: RolagemDeIniciativa = { ...rolagem, desempate: desempates.get(id) ?? null }
    mudarCombatente(t, id, (atual) => ({ ...atual, iniciativa, natural20: rolagem.d20 === 20, natural1: rolagem.d20 === 1 }))
    const c = combatente(t, id)
    const f = fichaDe(t, c)
    const desempate = iniciativa.desempate === null ? '' : ` (desempate ${iniciativa.desempate})`
    escrever(t, `${c?.nome ?? id}: iniciativa ${rolagem.total}${rolagem.d20 > 0 ? ` (d20 ${rolagem.d20})` : ''}${desempate}`)
    if (c === undefined || f === null) continue
    // Ki inicial: a recarga normal; a forma declarada entra agora (de graça com 20 natural).
    porRecurso(t, f, 'pk', kiDaRecarga(c, f))
    const declarada = c.transformacao === null ? undefined : f.transformacoes.find((forma) => forma.id === c.transformacao?.id)
    if (declarada !== undefined) {
      mudarCombatente(t, id, (atual) => ({ ...atual, transformacao: null }))
      transformar(t, id, declarada, rolagem.d20 === 20 ? 0 : Math.min(declarada.ki, pkDe(t, f)))
    }
  }
  t.nucleo = { ...t.nucleo, ordem: { ...t.nucleo.ordem, cartas: ordem }, pendencias: t.nucleo.pendencias.filter((pendencia) => pendencia.tipo !== 'declaracao') }
}

function turnoNovo(id: IdDoCombatente): TurnoAtual {
  return { combatenteId: id, basicosUsados: 0, basicosAnunciados: null, tecnicasUsadas: [], andou: 0, casasCobradas: 0, desengajouDe: [], barreiraUsada: false, semTecnicas: false }
}

/** "Turno N/M": a posição da vez e o total de cartas. */
export function turnoNoM(nucleo: NucleoDBT): { n: number; m: number } {
  const n = nucleo.ordem.vez === null ? 0 : nucleo.ordem.cartas.indexOf(nucleo.ordem.vez) + 1
  return { n, m: nucleo.ordem.cartas.length }
}

/** Começa o combate: rodada 1, a vez na primeira carta (seção 4). */
export function comecar(t: Trabalho): void {
  const primeira = t.nucleo.ordem.cartas[0]
  t.nucleo = { ...t.nucleo, fase: 'combate', ordem: { ...t.nucleo.ordem, rodada: 1, vez: null }, turno: null }
  tipoDaLinha(t, 'inicio')
  escrever(t, 'O combate começa: rodada 1')
  if (primeira !== undefined) iniciarTurno(t, primeira)
}

/** Início do Turno de Ação (6.1), na ordem do livro. A vez que se perde passa sozinha. */
export function iniciarTurno(t: Trabalho, id: IdDoCombatente): void {
  t.passos += 1
  if (t.passos > PASSOS_MAX) return
  const inicio = combatente(t, id)
  if (inicio === undefined) return
  tipoDaLinha(t, 'vez')
  envolver(t, id)
  // 1. Conta o turno.
  mudarCombatente(t, id, (atual) => ({ ...atual, turnosJogados: atual.turnosJogados + 1 }))
  t.nucleo = { ...t.nucleo, turno: turnoNovo(id), ordem: { ...t.nucleo.ordem, vez: id } }
  escrever(t, `Vez de ${inicio.nome}`)
  // 2. Expira o que vence no início.
  expirarNoInicio(t, id)
  // 3. Recarga do Ki (a armadura e o débito do Choque saem dela).
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  if (c !== undefined && f !== null) {
    const antes = pkDe(t, f)
    const recarga = kiDaRecarga(c, f)
    if (recarga !== antes) {
      porRecurso(t, f, 'pk', recarga)
      escrever(t, `${c.nome}: Ki ${antes} -> ${recarga}`, `${c.nome} recarrega o Ki`)
    }
    if (c.kiDebito > 0) mudarCombatente(t, id, (atual) => ({ ...atual, kiDebito: 0 }))
  }
  // 4. Morte: salvaguarda rola e a vez passa; fora de combate, passa direto.
  const agora = combatente(t, id)
  if (agora === undefined) return
  if (agora.morte.situacao === 'salvaguarda') {
    if (agora.npc) {
      rolarSalvaguarda(t, id, null)
      passarAVez(t)
    } else pedirSalvaguarda(t, id, false)
    return
  }
  if (foraDeCombate(agora)) {
    passarAVez(t)
    return
  }
  // 5. Testes de início.
  const testes = testesDoInicio(t, id)
  // 6. Perde a vez.
  const depois = combatente(t, id)
  if (depois === undefined) return
  const rodada = t.nucleo.ordem.rodada
  const motivo = depois.perdeProximoTurno?.motivo ?? (depois.natural1 && rodada === 1 ? '1 natural na iniciativa' : testes.perdeAVez)
  if (depois.perdeProximoTurno !== null) mudarCombatente(t, id, (atual) => ({ ...atual, perdeProximoTurno: null }))
  if (motivo !== null) {
    escrever(t, `${depois.nome} perde a vez (${motivo})`)
    passarAVez(t)
    return
  }
  if (testes.ataqueForcado) {
    const alvoSugerido = maisProximo(t.ctx.posicoes, id, aliadosDe(t, id))
    porPendencia(t, { id: t.ctx.gerarId(), responde: { tipo: 'mestre' }, tipo: 'ataqueForcado', combatenteId: id, alvoSugerido }, false)
  }
  // 7. Escolhas de início (Rajada mantida, carga, agarrão).
  const escolhas: ('manterRajada' | 'continuarCarga' | 'tentarSoltar')[] = []
  if (depois.mantendo !== null) escolhas.push('manterRajada')
  if (depois.carga !== null) escolhas.push('continuarCarga')
  if (depois.agarrado !== null) escolhas.push('tentarSoltar')
  if (escolhas.length > 0) porPendencia(t, { id: t.ctx.gerarId(), responde: depois.npc ? { tipo: 'mestre' } : { tipo: 'combatente', id }, tipo: 'inicioDoTurno', combatenteId: id, escolhas }, false)
}

/** Fim do Turno de Ação (6.3). */
export function terminarTurno(t: Trabalho, id: IdDoCombatente): void {
  expirarNoFim(t, id)
  t.nucleo = { ...t.nucleo, turno: null }
}

/** Fim da rodada (6.3): x2 do Atordoado, Ação Oculta vencida, rodada + 1. */
export function terminarRodada(t: Trabalho): void {
  expirarNaRodada(t)
  const rodada = t.nucleo.ordem.rodada
  for (const c of Object.values(t.nucleo.combatentes)) {
    if (c.acaoOculta === null || c.acaoOculta.ateRodada > rodada) continue
    mudarCombatente(t, c.id, (atual) => ({ ...atual, acaoOculta: null }))
    escrever(t, `${c.nome}: a Ação Oculta não usada se perdeu`, '')
  }
  t.nucleo = { ...t.nucleo, ordem: { ...t.nucleo.ordem, rodada: rodada + 1 } }
  escrever(t, `Rodada ${rodada + 1}`)
  avisosDaRodada(t)
}

/** A próxima carta que joga depois de `de` (inconsciente e morto não recebem a vez). Deu a volta: fim da rodada. */
export function proximaVez(t: Trabalho, de: IdDoCombatente | null): IdDoCombatente | null {
  const cartas = t.nucleo.ordem.cartas
  if (cartas.length === 0) return null
  let indice = de === null ? -1 : cartas.indexOf(de)
  for (let volta = 0; volta < cartas.length; volta += 1) {
    indice += 1
    if (indice >= cartas.length) {
      indice = 0
      terminarRodada(t)
    }
    const candidato = combatente(t, cartas[indice])
    if (candidato !== undefined && !foraDeCombate(candidato)) return candidato.id
  }
  return null
}

/** Passa a vez: fecha o turno de quem está e abre o do próximo. */
export function passarAVez(t: Trabalho): void {
  const vez = t.nucleo.ordem.vez
  if (vez !== null) terminarTurno(t, vez)
  const proxima = proximaVez(t, vez)
  if (proxima === null) {
    t.nucleo = { ...t.nucleo, ordem: { ...t.nucleo.ordem, vez: null }, turno: null }
    escrever(t, 'Ninguém de pé para jogar')
    return
  }
  iniciarTurno(t, proxima)
}

/** Combatente incluído no meio: entra na posição do total (5.6). */
export function inserirNaOrdem(t: Trabalho, id: IdDoCombatente, total: number): void {
  const cartas = t.nucleo.ordem.cartas.filter((carta) => carta !== id)
  const posicao = cartas.findIndex((carta) => (combatente(t, carta)?.iniciativa?.total ?? Number.NEGATIVE_INFINITY) < total)
  const novas = posicao < 0 ? [...cartas, id] : [...cartas.slice(0, posicao), id, ...cartas.slice(posicao)]
  t.nucleo = { ...t.nucleo, ordem: { ...t.nucleo.ordem, cartas: novas } }
}
