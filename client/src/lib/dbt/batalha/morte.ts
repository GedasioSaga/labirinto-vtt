import {
  combatente,
  efeito,
  envolver,
  escrever,
  fichaDe,
  mudarCombatente,
  porPendencia,
  porRecurso,
  pvDe,
  rolarD20,
  tipoDaLinha,
  type Trabalho,
} from './trabalho'
import { SALVAGUARDA_CD, SALVAGUARDAS_PARA_DECIDIR, type IdDoCombatente, type SituacaoDeMorte } from './tipos'

/**
 * Dano, cura, transformação que acaba e MORTE (docs/planos/dbt-batalha.md,
 * seção 12; 9.5.10, p. 119-120). O PV mora na ficha; a situação, aqui.
 */

const SEM_CONTADORES = { sucessos: 0, falhas: 0 }

export function acabarTransformacao(t: Trabalho, id: IdDoCombatente, motivo: string): void {
  const c = combatente(t, id)
  if (c === undefined || c.transformacao === null) return
  const nome = c.transformacao.nome
  mudarCombatente(t, id, (atual) => ({ ...atual, transformacao: null }))
  escrever(t, `${c.nome} sai da forma ${nome}: ${motivo}`)
  efeito(t, { tipo: 'transformacao', tokenIds: [id], d20: null, faixa: null, numero: null })
}

/** Zerou o Ki: a transformação acaba (p. 93). */
export function conferirKiZerado(t: Trabalho, id: IdDoCombatente, kiAgora: number): void {
  if (kiAgora <= 0) acabarTransformacao(t, id, 'zerou o Ki')
}

/**
 * Dano direto no PV da ficha (piso 0; o excedente vai só à linha). Devolve o
 * PV de agora. Combatente manual: só a linha (o mestre aplica à mão).
 */
export function sofrerDano(t: Trabalho, id: IdDoCombatente, dano: number, motivo: string, publico: string = motivo): number {
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  envolver(t, id)
  tipoDaLinha(t, 'dano')
  if (c === undefined || dano <= 0) return f === null ? 0 : pvDe(t, f)
  efeito(t, { tipo: 'dano', tokenIds: [id], d20: null, faixa: null, numero: dano })
  if (f === null) {
    escrever(t, `${c.nome} sofre ${dano} (${motivo}); sem ficha: o mestre aplica`, `${c.nome} sofre dano (${publico})`)
    return 0
  }
  const antes = pvDe(t, f)
  porRecurso(t, f, 'pv', antes - dano)
  const depois = pvDe(t, f)
  const excedente = dano - (antes - depois)
  escrever(t, `${c.nome} sofre ${dano} (${motivo}): PV ${antes} -> ${depois}${excedente > 0 ? `, ${excedente} além do 0` : ''}`, `${c.nome} sofre dano (${publico})`)
  if (depois <= 0) caiu(t, id, antes > 0)
  return depois
}

export function curar(t: Trabalho, id: IdDoCombatente, valor: number, motivo: string): void {
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  if (c === undefined || f === null || valor <= 0) return
  tipoDaLinha(t, 'cura')
  envolver(t, id)
  const antes = pvDe(t, f)
  porRecurso(t, f, 'pv', antes + valor)
  const depois = pvDe(t, f)
  escrever(t, `${c.nome} recupera ${depois - antes} PV (${motivo}): ${antes} -> ${depois}`, `${c.nome} recupera PV (${motivo})`)
  efeito(t, { tipo: 'cura', tokenIds: [id], d20: null, faixa: null, numero: depois - antes })
  if (depois > 0 && c.morte.situacao !== 'de-pe' && c.morte.situacao !== 'morto') {
    mudarCombatente(t, id, (atual) => ({ ...atual, morte: { ...SEM_CONTADORES, situacao: 'de-pe' } }))
    escrever(t, `${c.nome} volta à luta`)
  }
}

/**
 * PV chegou a 0 (seção 12). De pé: a transformação acaba; PJ (e NPC com a
 * opção) entra na salvaguarda com a 1ª rolagem já; NPC sem a opção fica
 * inconsciente. Inconsciente que sofre dano volta à salvaguarda zerada.
 */
export function caiu(t: Trabalho, id: IdDoCombatente, agora: boolean): void {
  const c = combatente(t, id)
  if (c === undefined) return
  tipoDaLinha(t, 'morte')
  if (c.morte.situacao === 'inconsciente' && !agora) {
    mudarCombatente(t, id, (atual) => ({ ...atual, morte: { ...SEM_CONTADORES, situacao: 'salvaguarda' } }))
    escrever(t, `${c.nome} sofre dano caído: volta à salvaguarda contra a morte`)
    return
  }
  if (c.morte.situacao !== 'de-pe') return
  acabarTransformacao(t, id, 'chegou a 0 PV')
  const comSalvaguarda = !c.npc || t.nucleo.opcoes.salvaguardaDeNpc
  if (!comSalvaguarda) {
    mudarCombatente(t, id, (atual) => ({ ...atual, morte: { ...SEM_CONTADORES, situacao: 'inconsciente' } }))
    escrever(t, `${c.nome} está fora de combate`)
    return
  }
  mudarCombatente(t, id, (atual) => ({ ...atual, morte: { ...SEM_CONTADORES, situacao: 'salvaguarda' } }))
  escrever(t, `${c.nome} caiu: salvaguarda contra a morte`)
  pedirSalvaguarda(t, id, true)
}

/** PJ: o jogador clica "Rolar" (pendência); NPC: o host rola na hora. */
export function pedirSalvaguarda(t: Trabalho, id: IdDoCombatente, naFrente: boolean): void {
  const c = combatente(t, id)
  if (c === undefined) return
  if (c.npc) {
    rolarSalvaguarda(t, id, null)
    return
  }
  porPendencia(t, { id: t.ctx.gerarId(), responde: { tipo: 'combatente', id }, tipo: 'salvaguarda', combatenteId: id }, naFrente)
}

/** d20 >= 10 sucesso, sem modificador; 3 sucessos = inconsciente; 3 falhas = morto. `d20` digitado pelo mestre vence. */
export function rolarSalvaguarda(t: Trabalho, id: IdDoCombatente, digitado: number | null): SituacaoDeMorte | null {
  const c = combatente(t, id)
  if (c === undefined || c.morte.situacao !== 'salvaguarda') return null
  tipoDaLinha(t, 'morte')
  envolver(t, id)
  const d20 = digitado ?? rolarD20(t)
  const sucesso = d20 >= SALVAGUARDA_CD
  const sucessos = c.morte.sucessos + (sucesso ? 1 : 0)
  const falhas = c.morte.falhas + (sucesso ? 0 : 1)
  let situacao: SituacaoDeMorte = 'salvaguarda'
  if (sucessos >= SALVAGUARDAS_PARA_DECIDIR) situacao = 'inconsciente'
  else if (falhas >= SALVAGUARDAS_PARA_DECIDIR) situacao = 'morto'
  mudarCombatente(t, id, (atual) => ({ ...atual, morte: { sucessos, falhas, situacao } }))
  efeito(t, { tipo: 'rolagem', tokenIds: [id], d20, faixa: null, numero: null })
  const fim = situacao === 'inconsciente' ? ': estabilizou, inconsciente' : situacao === 'morto' ? ': morreu' : ''
  escrever(t, `${c.nome}, salvaguarda contra a morte: d20 ${d20}, ${sucesso ? 'sucesso' : 'falha'} (${sucessos}/${falhas})${fim}`)
  return situacao
}
