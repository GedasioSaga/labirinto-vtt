// METAS DA FATIA F5 (abrir o mapa mais rápido), plano
// docs/planos/otimizacao-200x200-2026-10-27.md. Base de 27/10/2026, mapa
// real, 1080, Meio-Termo: mestre interativo em 3,3 s com tarefa longa de
// 1053 ms; jogador em 1,5 s. Arquivo à parte para as outras fatias não
// esbarrarem: o spec só chama `conferirMetasF5` no fim de cada caso.
import { expect } from '@playwright/test'

export const METAS_F5 = {
  /** Os casos em que a meta vale: mapa real e sintético 200x200, 1920x1080, Meio-Termo. */
  casos: ['real-mt-1080', 'sint200-mt-1080'] as readonly string[],
  mestreInterativoMs: 2000,
  mestreMaiorTarefaLongaMs: 300,
  jogadorInterativoMs: 1200,
}

interface Abrir {
  interativo_ms: number
  longas: { max_ms: number }
}

/** Reprova o caso (soft: todas as metas aparecem) se o abrir passou do limite. Casos fora da lista passam direto. */
export function conferirMetasF5(id: string, registro: Record<string, unknown>): void {
  if (!METAS_F5.casos.includes(id)) return
  const mestre = registro.abrir_mestre as Abrir | undefined // as: o registro é montado pelo próprio spec
  const jogador = registro.abrir_jogador as Abrir | undefined // as: idem
  console.log(`METAS-F5 ${id} mestre ${mestre?.interativo_ms} ms (<= ${METAS_F5.mestreInterativoMs}), longa ${mestre?.longas.max_ms} ms (<= ${METAS_F5.mestreMaiorTarefaLongaMs}); jogador ${jogador?.interativo_ms} ms (<= ${METAS_F5.jogadorInterativoMs})`)
  expect.soft(mestre?.interativo_ms, `${id}: mestre interativo (ms)`).toBeLessThanOrEqual(METAS_F5.mestreInterativoMs)
  expect.soft(mestre?.longas.max_ms, `${id}: maior tarefa longa do mestre ao abrir (ms)`).toBeLessThanOrEqual(METAS_F5.mestreMaiorTarefaLongaMs)
  expect.soft(jogador?.interativo_ms, `${id}: jogador interativo (ms)`).toBeLessThanOrEqual(METAS_F5.jogadorInterativoMs)
}
