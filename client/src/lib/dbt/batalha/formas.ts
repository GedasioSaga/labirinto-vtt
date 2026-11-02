import type { TransformacaoLida } from './leitura'
import { conferirKiZerado } from './morte'
import { combatente, efeito, envolver, escrever, fichaDe, mudarCombatente, pkDe, porRecurso, tipoDaLinha, type Trabalho } from './trabalho'
import type { IdDoCombatente } from './tipos'

/**
 * TRANSFORMAR na batalha (6.2; 7.0-7.1; exaustão 8.5.1.3). A forma ativa da
 * luta mora no combatente (o Desfazer a volta); a ficha não muda até o fim.
 */

/**
 * Liga a forma pagando `custo` (0 com 20 natural no 1º turno). Conta o uso
 * para a exaustão: a máxima a partir do 2º uso desde o Descanso Longo
 * bloqueia na hora o Ki pago; as inferiores somam % no fim.
 */
export function transformar(t: Trabalho, id: IdDoCombatente, forma: TransformacaoLida, custo: number): void {
  const c = combatente(t, id)
  const f = fichaDe(t, c)
  if (c === undefined || f === null) return
  tipoDaLinha(t, 'transformacao')
  envolver(t, id)
  const antes = pkDe(t, f)
  if (custo > 0) porRecurso(t, f, 'pk', antes - custo)
  const segundoUsoDaMaxima = forma.maxima && f.usosTransfMaximaDesdeDescanso + c.usos.transfMaxima >= 1
  const bloqueia = t.nucleo.opcoes.exaustao && segundoUsoDaMaxima ? custo : 0
  mudarCombatente(t, id, (atual) => ({
    ...atual,
    transformacao: { id: forma.id, nome: forma.nome, estagio: forma.estagio, epBonus: forma.epBonus, maxima: forma.maxima, desdeRodada: t.nucleo.ordem.rodada },
    kiBloqueado: atual.kiBloqueado + bloqueia,
    usos: forma.maxima
      ? { ...atual.usos, transfMaxima: atual.usos.transfMaxima + 1 }
      : { ...atual.usos, transfInferiores: [...atual.usos.transfInferiores, forma.estagio] },
  }))
  const ki = custo > 0 ? `, Ki ${antes} -> ${pkDe(t, f)}` : ', sem custo'
  escrever(t, `${c.nome} se transforma: ${forma.nome} (EP +${forma.epBonus})${ki}${bloqueia > 0 ? `; ${bloqueia} Ki bloqueados (2º uso da forma máxima)` : ''}`, `${c.nome} se transforma: ${forma.nome}`)
  efeito(t, { tipo: 'transformacao', tokenIds: [id], d20: null, faixa: null, numero: null })
  if (custo > 0) conferirKiZerado(t, id, pkDe(t, f))
}

/** Destransformar: 0 Ki (6.2). */
export function destransformar(t: Trabalho, id: IdDoCombatente): void {
  const c = combatente(t, id)
  if (c === undefined || c.transformacao === null) return
  tipoDaLinha(t, 'transformacao')
  envolver(t, id)
  escrever(t, `${c.nome} volta à forma normal`)
  mudarCombatente(t, id, (atual) => ({ ...atual, transformacao: null }))
}
