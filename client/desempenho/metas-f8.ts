// METAS DA FATIA F8 (pan, zoom e abrir no mapa grande; plano
// docs/planos/otimizacao-200x200-2026-10-27.md, seções F6 e "A confirmar").
//
// Ligadas só com `LAB_DES_METAS` contendo `f8` (as outras fatias rodam o mesmo
// harness sem estas metas):
//
//   LAB_DES_METAS=f8 node scripts/medir-desempenho.cjs --so real-linhas-1440-dpr15,... --sem-perfil --mapa-real <mapa>
//
// O que vale, em cada caso da lista (mapa real e sintético 200, linhas e
// Meio-Termo, 1440@1.5 e 1080), com mestre e jogador abertos:
//   - pan e zoom: CPU da thread principal <= 150 ms/s e nenhuma tarefa longa
//     (>= 50 ms), em quem mexe a câmera;
//   - chamadas de desenho por quadro no pan caem pelo menos à metade da base
//     (`DRAWS_NA_BASE`, medida antes do conserto, 27/10/2026);
//   - abrir o mapa: maior tarefa longa do mestre <= 300 ms.
import type { Page } from '@playwright/test'

export const CASOS_F8: readonly string[] = [
  'real-linhas-1440-dpr15',
  'real-linhas-1080',
  'real-mt-1440-dpr15',
  'real-mt-1080',
  'sint200-linhas-1440-dpr15',
  'sint200-linhas-1080',
  'sint200-mt-1440-dpr15',
  'sint200-mt-1080',
]

/** Cenários de câmera e quem mexe a câmera neles (é nesse papel que a meta vale). */
export const CENARIOS_DE_CAMERA_F8: ReadonlyArray<{ cenario: string; papel: 'mestre' | 'jogador' }> = [
  { cenario: 'pan-mapa-inteiro-3s', papel: 'mestre' },
  { cenario: 'zoom-roda-2s-dentro-2s-fora', papel: 'mestre' },
  { cenario: 'pan-perto-3s', papel: 'mestre' },
  { cenario: 'mesa-mestre-pan-3s', papel: 'mestre' },
  { cenario: 'mesa-mestre-zoom-2s-dentro-2s-fora', papel: 'mestre' },
  { cenario: 'mesa-jogador-pan-3s', papel: 'jogador' },
  { cenario: 'mesa-jogador-zoom-2s-dentro-2s-fora', papel: 'jogador' },
]

/** Cenários de PAN onde as chamadas de desenho por quadro têm de cair à metade. */
export const CENARIOS_DE_PAN_F8: readonly string[] = ['pan-perto-3s', 'mesa-mestre-pan-3s', 'mesa-jogador-pan-3s']

export const METAS_F8 = {
  cpuMaxMsPorS: 150,
  /** Tarefa longa = >= 50 ms (a sonda só conta as longas): nenhuma no gesto. */
  longasMax: 0,
  /** Fração máxima das chamadas de desenho da base no pan. */
  drawsFracaoMax: 0.5,
  abrirMaiorTarefaLongaMs: 300,
} as const

/**
 * Chamadas de desenho por quadro (p50) na BASE (v0.5.3, 6ec5c219), por
 * caso → cenário → papel. Rodada de base de 27/10/2026, antes do conserto
 * (RTX 3050 Laptop, Chromium, `--sem-perfil`).
 */
export const DRAWS_NA_BASE: Record<string, Record<string, Partial<Record<'mestre' | 'jogador', number>>>> = {
  'real-mt-1080': { 'pan-perto-3s': { mestre: 58 }, 'mesa-mestre-pan-3s': { mestre: 61 }, 'mesa-jogador-pan-3s': { jogador: 39 } },
  'real-linhas-1080': { 'pan-perto-3s': { mestre: 56 }, 'mesa-mestre-pan-3s': { mestre: 59 }, 'mesa-jogador-pan-3s': { jogador: 37 } },
  'real-mt-1440-dpr15': { 'pan-perto-3s': { mestre: 69 }, 'mesa-mestre-pan-3s': { mestre: 73 }, 'mesa-jogador-pan-3s': { jogador: 37 } },
  'real-linhas-1440-dpr15': { 'pan-perto-3s': { mestre: 64 }, 'mesa-mestre-pan-3s': { mestre: 67 }, 'mesa-jogador-pan-3s': { jogador: 37 } },
  'sint200-mt-1440-dpr15': { 'pan-perto-3s': { mestre: 126 }, 'mesa-mestre-pan-3s': { mestre: 127 }, 'mesa-jogador-pan-3s': { jogador: 24 } },
  'sint200-mt-1080': { 'pan-perto-3s': { mestre: 126 }, 'mesa-mestre-pan-3s': { mestre: 128 }, 'mesa-jogador-pan-3s': { jogador: 24 } },
  'sint200-linhas-1440-dpr15': { 'pan-perto-3s': { mestre: 108 }, 'mesa-mestre-pan-3s': { mestre: 110 }, 'mesa-jogador-pan-3s': { jogador: 24 } },
  'sint200-linhas-1080': { 'pan-perto-3s': { mestre: 108 }, 'mesa-mestre-pan-3s': { mestre: 110 }, 'mesa-jogador-pan-3s': { jogador: 24 } },
}

/**
 * DIAGNÓSTICO (`LAB_DES_F8_DIAG=1`): as instruções de desenho de cada grupo de
 * render do Pixi, com quem as gera e se está na tela. Diz o que quebra o lote
 * (máscara, filtro, Graphics grande demais para o lote) e o que é desenhado
 * fora da vista.
 */
export function diagF8Ligado(): boolean {
  return process.env.LAB_DES_F8_DIAG === '1'
}

export async function diagnosticoDeDesenhoF8(page: Page, chave: 'appMestre' | 'appJogador'): Promise<unknown> {
  return page.evaluate((k) => {
    type No = { label?: string; constructor: { name: string }; parent?: No | null; getBounds?: () => { x: number; y: number; width: number; height: number }; renderGroup?: Grupo | null }
    type Instrucao = { renderPipeId: string; action?: string; elements?: unknown[]; size?: number } & Partial<No>
    type Grupo = { root: No; instructionSet: { instructions: Instrucao[]; instructionSize: number }; renderGroupChildren: Grupo[] }
    const app = (window as unknown as Record<string, Record<string, unknown> | undefined>).__labSonda?.[k] as { stage: No & { renderGroup: Grupo }; screen: { width: number; height: number } } | undefined // as: o Application do Pixi pendurado pela sonda
    if (app === undefined) return null
    const caminho = (n: No | null | undefined): string => {
      const partes: string[] = []
      for (let p = n, i = 0; p && i < 4; p = p.parent, i++) partes.push(p.label || p.constructor.name)
      return partes.join('<')
    }
    const grupos: unknown[] = []
    const andar = (g: Grupo) => {
      const resumo: Record<string, { n: number; fora: number }> = {}
      for (let i = 0; i < g.instructionSet.instructionSize; i++) {
        const ins = g.instructionSet.instructions[i]
        let quem = ins.renderPipeId
        let fora = false
        if (ins.renderPipeId !== 'batch' && typeof ins.getBounds === 'function') {
          quem = `${ins.renderPipeId}:${caminho(ins as No)}`
          const b = ins.getBounds()
          fora = b.x > app.screen.width || b.y > app.screen.height || b.x + b.width < 0 || b.y + b.height < 0
        } else if (ins.action) {
          const dono = (ins as { mask?: { mask?: No } }).mask?.mask
          quem = `${ins.renderPipeId}:${ins.action}${dono ? ` ${caminho(dono)}` : ''}`
        }
        resumo[quem] ??= { n: 0, fora: 0 }
        resumo[quem].n += 1
        if (fora) resumo[quem].fora += 1
      }
      grupos.push({ grupo: caminho(g.root), instrucoes: g.instructionSet.instructionSize, por_tipo: resumo })
      for (const f of g.renderGroupChildren) andar(f)
    }
    andar(app.stage.renderGroup)
    return grupos
  }, chave)
}

export function metasF8Ligadas(): boolean {
  return (process.env.LAB_DES_METAS ?? '').split(',').includes('f8')
}

interface MedidaF8 {
  cenario: string
  papel: 'mestre' | 'jogador'
  cpu_ms_por_s: number
  longas_n: number
  longas_max_ms: number
  draws_por_quadro_p50: number
}

/** O que reprova no caso. Lista vazia = passou. Cenário que não mediu também reprova. */
export function conferirMetasF8({ caso, registro, cenarios }: { caso: { id: string }; registro: Record<string, unknown>; cenarios: readonly MedidaF8[] }): string[] {
  if (!CASOS_F8.includes(caso.id)) return []
  const reprovas: string[] = []
  const id = caso.id
  for (const { cenario, papel } of CENARIOS_DE_CAMERA_F8) {
    const m = cenarios.find((c) => c.cenario === cenario && c.papel === papel)
    if (m === undefined) {
      reprovas.push(`${id} ${papel} ${cenario}: não mediu`)
      continue
    }
    if (m.cpu_ms_por_s > METAS_F8.cpuMaxMsPorS) reprovas.push(`${id} ${papel} ${cenario}: CPU ${m.cpu_ms_por_s} ms/s > ${METAS_F8.cpuMaxMsPorS}`)
    if (m.longas_n > METAS_F8.longasMax) reprovas.push(`${id} ${papel} ${cenario}: ${m.longas_n} tarefa(s) longa(s), maior ${m.longas_max_ms} ms`)
    const base = DRAWS_NA_BASE[id]?.[cenario]?.[papel]
    if (CENARIOS_DE_PAN_F8.includes(cenario)) {
      if (base === undefined) reprovas.push(`${id} ${papel} ${cenario}: sem chamadas de desenho da base`)
      else if (m.draws_por_quadro_p50 > base * METAS_F8.drawsFracaoMax) reprovas.push(`${id} ${papel} ${cenario}: ${m.draws_por_quadro_p50} chamadas/quadro > ${METAS_F8.drawsFracaoMax} x ${base} da base`)
    }
  }
  const abrir = registro.abrir_mestre as { longas?: { max_ms: number } } | undefined // as: o registro é montado pelo próprio spec
  if (abrir?.longas === undefined) reprovas.push(`${id}: abrir do mestre não mediu`)
  else if (abrir.longas.max_ms > METAS_F8.abrirMaiorTarefaLongaMs) reprovas.push(`${id}: maior tarefa longa ao abrir ${abrir.longas.max_ms} ms > ${METAS_F8.abrirMaiorTarefaLongaMs}`)
  console.log(`METAS-F8 ${id}: ${reprovas.length === 0 ? 'PASSOU' : `REPROVOU em ${reprovas.length}`}`)
  for (const r of reprovas) console.log(`  REPROVA ${r}`)
  return reprovas
}
