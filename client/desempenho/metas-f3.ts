// METAS DA FATIA F3 (otimização 200x200, docs/planos/otimizacao-200x200-2026-10-27.md).
//
// Cenário: "jogador vê o mestre mover a ficha" (`mesa-jogador-ve-mestre-mover-ficha`)
// no caso `real-mt-1080`. Ligadas só com `LAB_DES_METAS` contendo `f3`
// (as outras fatias rodam o mesmo harness sem estas metas):
//
//   LAB_DES_METAS=f3 node scripts/medir-desempenho.cjs --so real-mt-1080 --sem-perfil --mapa-real <mapa>
//
// `LAB_DES_F3_PROVA=1` liga a PROVA: conta, no mestre, quais desenhos do Pixi
// são reconstruídos (o `updateGpuContext` que roda `buildLine`) durante o
// cenário, com o rótulo do Graphics e a pilha de quem desenhou. Pesa um pouco:
// fica fora da rodada que confere as metas.
import type { Page } from '@playwright/test'

export const CENARIO_F3 = 'mesa-jogador-ve-mestre-mover-ficha'
export const CASO_F3 = 'real-mt-1080'

/** Bytes de patch da linha de base de 27/10/2026 nesse cenário (6 patches, `linha-de-base-2026-10-27.json`). */
const BYTES_DE_PATCH_NA_BASE = 836_671

export const METAS_F3 = {
  fpsMin: 55,
  p95MaxMs: 33,
  /** Nenhuma tarefa longa >= 100 ms. */
  longaTetoMs: 100,
  bytesDePatchMax: Math.floor(BYTES_DE_PATCH_NA_BASE / 4),
  /**
   * CPU do mestre no cenário, em ms por segundo. Com o harness corrigido (o
   * mestre arrasta o NPC, não um laço de seleção com a ficha do jogador), a
   * base de 27/10 já passa nas quatro metas do plano: 56 fps, p95 16,9 ms,
   * maior tarefa 82 ms, 1,4 KB de patch. O custo que sobra é a CPU do
   * recorte: 251,8 ms/s na base. Meta posta ANTES de medir o conserto:
   * 25% a menos (decisão do Claude, 27/10/2026).
   */
  cpuMaxMsPorS: 190,
} as const

export function metasF3Ligadas(): boolean {
  return (process.env.LAB_DES_METAS ?? '').split(',').includes('f3')
}

export function provaF3Ligada(): boolean {
  return process.env.LAB_DES_F3_PROVA === '1'
}

interface MedidaF3 {
  cenario: string
  papel: 'mestre' | 'jogador'
  fps: number
  quadro_p95_ms: number
  longas_max_ms: number
  cpu_ms_por_s: number
  mensagens: Record<string, { n: number; bytes: number }>
  extra?: Record<string, unknown>
}

/**
 * O que reprova no registro do caso. Lista vazia = passou. O cenário também
 * REPROVA quando a ficha não andou ou nenhum patch saiu: sem patch não há o
 * custo que a meta mede, e a comparação não vale (no 1440 e no modo linhas da
 * linha de base o arrasto não pegou a ficha e saíram 0 patches).
 */
export function conferirMetasF3(registro: { caso: { id: string }; cenarios?: MedidaF3[] }): string[] {
  if (registro.caso.id !== CASO_F3) return []
  const doCenario = (registro.cenarios ?? []).filter((c) => c.cenario === CENARIO_F3)
  const mestre = doCenario.find((c) => c.papel === 'mestre')
  if (mestre === undefined) return [`cenário ${CENARIO_F3} não rodou`]
  const falhas: string[] = []
  const andou = Number(mestre.extra?.ficha_andou_px ?? 0)
  if (!Number.isFinite(andou) || andou === 0) falhas.push(`a ficha não andou (ficha_andou_px=${String(mestre.extra?.ficha_andou_px)})`)
  const patch = mestre.mensagens.patch ?? { n: 0, bytes: 0 }
  if (patch.n === 0) falhas.push('nenhum patch saiu para o jogador: o cenário não mediu o custo do recorte')
  if (mestre.fps < METAS_F3.fpsMin) falhas.push(`mestre ${mestre.fps} fps < ${METAS_F3.fpsMin}`)
  if (mestre.quadro_p95_ms > METAS_F3.p95MaxMs) falhas.push(`mestre p95 ${mestre.quadro_p95_ms} ms > ${METAS_F3.p95MaxMs}`)
  if (mestre.cpu_ms_por_s > METAS_F3.cpuMaxMsPorS) falhas.push(`mestre CPU ${mestre.cpu_ms_por_s} ms/s > ${METAS_F3.cpuMaxMsPorS}`)
  if (mestre.longas_max_ms >= METAS_F3.longaTetoMs) falhas.push(`mestre tarefa longa ${mestre.longas_max_ms} ms >= ${METAS_F3.longaTetoMs}`)
  if (patch.bytes > METAS_F3.bytesDePatchMax) falhas.push(`bytes de patch ${patch.bytes} > ${METAS_F3.bytesDePatchMax}`)
  return falhas
}

// ---------------------------------------------------------------- prova: o que o Pixi reconstrói

interface JanelaDaProva {
  __labSonda?: Record<string, unknown>
  __f3?: { desligar: () => void; ler: () => unknown }
}

/** Liga, no mestre, a contagem de reconstruções de desenho do Pixi (por contexto, com rótulo e pilha). */
export async function ligarProvaF3(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as JanelaDaProva // as: campos nossos no window
    w.__f3?.desligar()
    type Ctx = { uid: number; dirty: boolean; instructions?: Array<{ action: string; data?: { path?: { shapePath?: { shapePrimitives?: unknown[] } } } }> }
    type No = { label?: string; constructor: { name: string }; children?: No[]; context?: Ctx; parent?: No | null }
    const app = w.__labSonda?.appMestre as { renderer: { graphicsContext: { updateGpuContext: (c: Ctx) => unknown; _gpuContextHash: Record<number, unknown> } }; stage: No } // as: o Application do Pixi pendurado pela sonda
    const sistema = app.renderer.graphicsContext
    const original = sistema.updateGpuContext
    const reconstrucoes = new Map<Ctx, { n: number; tracos: number; pilha: string }>()
    const pilhaDe = (): string =>
      (new Error().stack ?? '')
        .split('\n')
        .slice(3)
        .map((l) => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\/assets\//, '').replace(/\)$/, ''))
        .filter((l) => !/pixi|eventemitter|GraphicsContext|Graphics\.|ViewContainer|collectRenderables|RenderGroup|render(er)?\b/i.test(l))
        .slice(0, 4)
        .join(' < ')
    sistema.updateGpuContext = function (this: unknown, ctx: Ctx) {
      if (ctx.dirty || sistema._gpuContextHash[ctx.uid] === undefined) {
        const r = reconstrucoes.get(ctx) ?? { n: 0, tracos: 0, pilha: '' }
        r.n += 1
        r.tracos = (ctx.instructions ?? []).filter((i) => i.action === 'stroke').length
        reconstrucoes.set(ctx, r)
      }
      return original.call(this, ctx)
    }
    // Quem DESENHOU (a pilha do primeiro `onUpdate` de cada contexto depois de ligar).
    let proto: { onUpdate: () => void } | null = null
    const achar = (no: No): void => {
      if (proto !== null) return
      if (no.context !== undefined && typeof (no.context as unknown as { onUpdate?: unknown }).onUpdate === 'function') proto = Object.getPrototypeOf(no.context) as { onUpdate: () => void }
      for (const f of no.children ?? []) achar(f)
    }
    achar(app.stage)
    const quemDesenhou = new Map<unknown, string>()
    const onUpdateOriginal = proto === null ? null : (proto as { onUpdate: () => void }).onUpdate
    if (proto !== null && onUpdateOriginal !== null) {
      ;(proto as { onUpdate: () => void }).onUpdate = function (this: unknown) {
        if (!quemDesenhou.has(this)) quemDesenhou.set(this, pilhaDe())
        return onUpdateOriginal.call(this)
      }
    }
    const rotulo = (no: No): string => {
      const partes: string[] = []
      for (let n: No | null | undefined = no; n; n = n.parent) partes.unshift(n.label !== undefined && n.label !== '' ? n.label : n.constructor.name)
      return partes.slice(-4).join('/')
    }
    w.__f3 = {
      desligar: () => {
        sistema.updateGpuContext = original
        if (proto !== null && onUpdateOriginal !== null) (proto as { onUpdate: () => void }).onUpdate = onUpdateOriginal
        delete w.__f3
      },
      ler: () => {
        const dono = new Map<Ctx, string>()
        const andar = (no: No): void => {
          if (no.context !== undefined) dono.set(no.context, rotulo(no))
          for (const f of no.children ?? []) andar(f)
        }
        andar(app.stage)
        const porChave = new Map<string, { reconstrucoes: number; contextos: number; tracos: number }>()
        for (const [ctx, r] of reconstrucoes) {
          const chave = `${dono.get(ctx) ?? '(fora do palco)'} :: ${quemDesenhou.get(ctx) ?? '(sem onUpdate)'}`
          const a = porChave.get(chave) ?? { reconstrucoes: 0, contextos: 0, tracos: 0 }
          a.reconstrucoes += r.n
          a.contextos += 1
          a.tracos += r.tracos * r.n
          porChave.set(chave, a)
        }
        return [...porChave.entries()].map(([chave, v]) => ({ chave, ...v })).sort((a, b) => b.tracos - a.tracos || b.reconstrucoes - a.reconstrucoes).slice(0, 12)
      },
    }
  })
}

/** Lê e desliga a contagem. */
export async function lerProvaF3(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const w = window as unknown as JanelaDaProva // as: campos nossos no window
    const r = w.__f3?.ler() ?? null
    w.__f3?.desligar()
    return r
  })
}
