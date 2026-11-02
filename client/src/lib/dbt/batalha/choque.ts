import { epTotal, modEfetivo, rolarComVantagem, temCondicao } from './contas'
import type { TecnicaLida } from './leitura'
import { conferirKiZerado, sofrerDano } from './morte'
import {
  combatente,
  envolver,
  escrever,
  fichaDe,
  indiceDoRank,
  mudarCombatente,
  pkDe,
  porPendencia,
  porRecurso,
  tecnicaDe,
  tipoDaLinha,
  tirarPendencia,
  trocarPendencia,
  type Trabalho,
} from './trabalho'
import { KI_POR_PONTO_DE_CHOQUE, PONTOS_DO_CHOQUE, type AtaqueResolvido, type ChoqueEmCurso, type IdDoCombatente, type Pendencia } from './tipos'

/**
 * CHOQUE DE PODER (docs/planos/dbt-batalha.md, seção 9; 9.5.6, p. 116-117).
 * O apoio de aliados (EP menor) fica com o mestre no v1: a opção aparece com
 * o motivo "falta +N EP".
 */

/** Técnica de ação que serve ao Choque: ofensiva (tem dano) e não defensiva, barreira ou cura. */
export function tecnicaOfensiva(tecnica: TecnicaLida): boolean {
  return tecnica.dano.completo > 0 && !tecnica.defensiva && tecnica.barreira === 0 && !tecnica.cura
}

/** 2 x Ki da técnica de ação usada; Reativa paga 1x e não gera débito (ambiguidade 25). */
export function custoDoChoque(tecnica: TecnicaLida): number {
  return tecnica.reativa ? tecnica.ki : 2 * tecnica.ki
}

/** Por que o defensor não pode chocar com esta técnica; null = pode (seção 9.1). */
export function bloqueioDoChoque(t: Trabalho, ataque: AtaqueResolvido, reatorId: IdDoCombatente, tecnica: TecnicaLida): string | null {
  const defensor = combatente(t, reatorId)
  const atacante = combatente(t, ataque.atacanteId)
  const fd = fichaDe(t, defensor)
  if (defensor === undefined || atacante === undefined || fd === null) return 'Sem ficha'
  if (reatorId !== ataque.alvoId) return 'Só o alvo choca'
  if (ataque.tecnica.tipo !== 'ki' && ataque.tecnica.tipo !== 'fisica') return 'Só contra técnica física ou de Ki'
  if (!tecnicaOfensiva(tecnica) || tecnica.uso === 'reacao') return 'Precisa de técnica de ação'
  if (indiceDoRank(tecnica.rank) < indiceDoRank(ataque.tecnica.rank)) return `Rank abaixo de ${ataque.tecnica.rank}`
  if (!fd.choqueDisponivel || defensor.usos.choque) return 'Choque já usado desde o Descanso Longo'
  const diferenca = epTotal(atacante, fichaDe(t, atacante)) - epTotal(defensor, fd)
  if (diferenca > 0) return `Falta +${diferenca} EP (apoio com o mestre)`
  if (diferenca < 0) return 'EP diferente do atacante'
  if (tecnica.reativa && pkDe(t, fd) < custoDoChoque(tecnica)) return 'Ki insuficiente'
  return null
}

/** O defensor paga (o que faltar vira débito, salvo Reativa) e o Choque substitui o ataque. */
export function abrirChoque(t: Trabalho, ataque: AtaqueResolvido, defensorId: IdDoCombatente, tecnica: TecnicaLida): void {
  const defensor = combatente(t, defensorId)
  const fd = fichaDe(t, defensor)
  if (defensor === undefined || fd === null) return
  tipoDaLinha(t, 'choque')
  envolver(t, defensorId, ataque.atacanteId)
  const custo = custoDoChoque(tecnica)
  const antes = pkDe(t, fd)
  const falta = Math.max(0, custo - antes)
  porRecurso(t, fd, 'pk', antes - custo)
  mudarCombatente(t, defensorId, (atual) => ({ ...atual, kiDebito: atual.kiDebito + (tecnica.reativa ? 0 : falta), usos: { ...atual.usos, choque: true } }))
  escrever(t, `${defensor.nome} responde com Choque de Poder (${tecnica.nome}): Ki ${antes} -> ${pkDe(t, fd)}${falta > 0 && !tecnica.reativa ? `, ${falta} de débito` : ''}`, `${defensor.nome} responde com Choque de Poder (${tecnica.nome})`)
  conferirKiZerado(t, defensorId, pkDe(t, fd))
  const choque: ChoqueEmCurso = {
    ataqueId: ataque.id,
    atacanteId: ataque.atacanteId,
    defensorId,
    tecnicaAtacante: ataque.tecnica.id,
    tecnicaDefensor: tecnica.id,
    bonusDefensor: 0,
    placar: { atacante: 0, defensor: 0 },
    apostas: { atacante: null, defensor: null },
    rolagens: [],
    ataque,
  }
  porPendencia(t, { id: t.ctx.gerarId(), responde: { tipo: 'mestre' }, tipo: 'choque', choque }, true)
}

function rolarLado(t: Trabalho, id: IdDoCombatente, tecnicaId: string, aposta: number, bonus: number): number {
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  const tecnica = tecnicaDe(t, id, tecnicaId)
  if (c === undefined) return 0
  t.comD20 = true
  const { d20 } = rolarComVantagem(temCondicao(c, 'envenenado') ? -1 : 0, t.ctx.rolar)
  return d20 + (tecnica === undefined ? 0 : modEfetivo(c, f, tecnica.atributoDeAcerto)) + epTotal(c, f) + aposta + bonus
}

/** Fim do Choque: o perdedor sofre completo(vencedor) + metade do completo(perdedor), sem CA e sem janela (9.5). */
function fecharChoque(t: Trabalho, pendencia: Pendencia, choque: ChoqueEmCurso, venceuAtacante: boolean): void {
  tirarPendencia(t, pendencia.id)
  const vencedorId = venceuAtacante ? choque.atacanteId : choque.defensorId
  const perdedorId = venceuAtacante ? choque.defensorId : choque.atacanteId
  const doVencedor = tecnicaDe(t, vencedorId, venceuAtacante ? choque.tecnicaAtacante : choque.tecnicaDefensor)
  const doPerdedor = tecnicaDe(t, perdedorId, venceuAtacante ? choque.tecnicaDefensor : choque.tecnicaAtacante)
  const dano = (doVencedor?.dano.completo ?? 0) + Math.floor((doPerdedor?.dano.completo ?? 0) / 2)
  escrever(t, `${combatente(t, vencedorId)?.nome ?? '?'} vence o Choque de Poder`)
  sofrerDano(t, perdedorId, dano, 'Choque de Poder', 'Choque de Poder')
}

/**
 * Aposta de um lado (0 a N pontos de +1, 5 Ki cada, pagos na hora). Com as
 * duas apostas na mesa, a rodada rola; o primeiro a 3 vence; empate não
 * pontua. Devolve o motivo da recusa, ou null.
 */
export function apostarNoChoque(t: Trabalho, pendencia: Pendencia, combatenteId: IdDoCombatente, aposta: number): string | null {
  if (pendencia.tipo !== 'choque') return 'Não é um Choque'
  const choque = pendencia.choque
  const lado = combatenteId === choque.atacanteId ? 'atacante' : combatenteId === choque.defensorId ? 'defensor' : null
  if (lado === null) return 'Fora do Choque'
  if (choque.apostas[lado] !== null) return 'Já apostou nesta rodada'
  const pontos = Math.max(0, Math.trunc(aposta))
  const c = combatente(t, combatenteId)
  const f = fichaDe(t, c)
  const custo = pontos * KI_POR_PONTO_DE_CHOQUE
  if (custo > 0) {
    if (f === null || pkDe(t, f) < custo) return 'Ki insuficiente para a aposta'
    porRecurso(t, f, 'pk', pkDe(t, f) - custo)
  }
  tipoDaLinha(t, 'choque')
  const apostas = { ...choque.apostas, [lado]: pontos }
  if (apostas.atacante === null || apostas.defensor === null) {
    trocarPendencia(t, { ...pendencia, choque: { ...choque, apostas } })
    escrever(t, `${c?.nome ?? '?'} aposta no Choque`)
    return null
  }
  const atacante = rolarLado(t, choque.atacanteId, choque.tecnicaAtacante, apostas.atacante, 0)
  const defensor = rolarLado(t, choque.defensorId, choque.tecnicaDefensor, apostas.defensor, choque.bonusDefensor)
  const placar = {
    atacante: choque.placar.atacante + (atacante > defensor ? 1 : 0),
    defensor: choque.placar.defensor + (defensor > atacante ? 1 : 0),
  }
  escrever(t, `Choque: ${atacante} x ${defensor}${atacante === defensor ? ', empate' : ''} (placar ${placar.atacante} x ${placar.defensor})`)
  const novo: ChoqueEmCurso = { ...choque, placar, apostas: { atacante: null, defensor: null }, rolagens: [...choque.rolagens, { atacante, defensor }] }
  if (placar.atacante >= PONTOS_DO_CHOQUE || placar.defensor >= PONTOS_DO_CHOQUE) {
    fecharChoque(t, pendencia, novo, placar.atacante >= PONTOS_DO_CHOQUE)
    return null
  }
  trocarPendencia(t, { ...pendencia, choque: novo })
  return null
}
