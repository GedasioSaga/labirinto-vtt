// METAS DA FATIA F4 (o jogador não refaz a malha a cada pacote do mestre),
// plano docs/planos/otimizacao-200x200-2026-10-27.md. Base de 27/10/2026,
// mapa real, 1080, Meio-Termo: no cenário "jogador vê o mestre mover", o
// jogador gastava 428 ms/s de CPU e `andarDijkstra` era a função mais quente
// (29%). Arquivo à parte: o spec só chama `conferirMetasF4` no fim do caso.
import { expect } from '@playwright/test'

export const METAS_F4 = {
  caso: 'real-mt-1080',
  cenario: 'mesa-jogador-ve-mestre-mover-ficha',
  jogadorCpuMsPorS: 150,
  /** `andarDijkstra` não pode estar entre estas primeiras do perfil do jogador. */
  foraDasPrimeiras: 5,
  /**
   * O NPC só entra na vista do jogador quando o caso roda com perfil (a
   * passada extra inverte o rumo do arrasto). Sem pacote o cenário não mede
   * nada: aí a meta não vale, e o spec diz isso.
   */
  pacotesMinimos: 3,
}

interface MedidaDoCenario {
  cenario: string
  papel: string
  cpu_ms_por_s: number
  extra?: Record<string, unknown>
  perfil?: Array<{ funcao: string; onde: string }>
}

export function conferirMetasF4(id: string, cenarios: readonly MedidaDoCenario[]): void {
  if (id !== METAS_F4.caso) return
  const jogador = cenarios.find((c) => c.cenario === METAS_F4.cenario && c.papel === 'jogador')
  if (jogador === undefined) return
  const pacotes = Number(jogador.extra?.mensagens_do_mestre ?? 0)
  if (pacotes < METAS_F4.pacotesMinimos || jogador.perfil === undefined) {
    console.log(`METAS-F4 ${id}: cenário não reproduziu o caso (pacotes ${pacotes}, perfil ${jogador.perfil === undefined ? 'não' : 'sim'}); rode com perfil`)
    return
  }
  const primeiras = jogador.perfil.slice(0, METAS_F4.foraDasPrimeiras).map((q) => q.funcao)
  console.log(`METAS-F4 ${id} jogador cpu ${jogador.cpu_ms_por_s} ms/s (<= ${METAS_F4.jogadorCpuMsPorS}), ${pacotes} pacotes, mais quentes: ${primeiras.join(', ')}`)
  expect.soft(jogador.cpu_ms_por_s, `${id}: CPU do jogador vendo o mestre mover (ms/s)`).toBeLessThanOrEqual(METAS_F4.jogadorCpuMsPorS)
  expect.soft(primeiras, `${id}: andarDijkstra entre as ${METAS_F4.foraDasPrimeiras} mais quentes do jogador`).not.toContain('andarDijkstra')
}
