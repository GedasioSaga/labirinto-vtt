import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventoDaFaixa } from '../som'

/** O agendador só escolhe QUANDO agendar; o som de cada ataque é do `som.ts` (aqui, um espião). */
const tocados: { t: number; e: EventoDaFaixa }[] = []
vi.mock('../som', async (original) => ({
  ...(await original<typeof import('../som')>()),
  saidasDaFaixa: () => () => ({}) as AudioNode,
  tocarEvento: (_ctx: BaseAudioContext, _out: AudioNode, t: number, e: EventoDaFaixa) => void tocados.push({ t, e }),
}))

const { criarAgendadorDaFaixa, JANELA_DO_AGENDADOR_S, PASSO_DO_AGENDADOR_MS } = await import('./agendadorDaFaixa')
const { eventosDaDemo, DURACAO_DEMO } = await import('../som')

const CTX = {} as BaseAudioContext
const DESTINO = {} as AudioNode

describe('agendador ao vivo da faixa demo', () => {
  beforeEach(() => {
    tocados.length = 0
  })

  it('a cada passo de 250 ms agenda só a janela à frente, e a faixa inteira sai uma vez, na ordem e no tempo certo', () => {
    const lista = eventosDaDemo()
    const t0 = 3
    const ag = criarAgendadorDaFaixa(CTX, DESTINO, lista, t0)
    for (let agora = 0; agora < t0 + DURACAO_DEMO + 2; agora += PASSO_DO_AGENDADOR_MS / 1000) {
      const antes = tocados.length
      ag.agendarAte(agora + JANELA_DO_AGENDADOR_S, agora)
      // Nada além da janela; nada no passado.
      for (const { t } of tocados.slice(antes)) {
        expect(t).toBeLessThan(agora + JANELA_DO_AGENDADOR_S)
        expect(t).toBeGreaterThanOrEqual(agora)
      }
    }
    expect(tocados.length).toBe(lista.length)
    expect(tocados.map(({ e }) => e)).toEqual(lista)
    expect(tocados.every(({ t, e }) => Math.abs(t - (t0 + e.t)) < 1e-9)).toBe(true)
    expect(ag.restantes).toBe(0)
    expect(ag.pulados).toBe(0)
  })

  it('depois de uma trava maior que a janela, pula o que ficou para trás em vez de tocar tudo junto', () => {
    const lista: EventoDaFaixa[] = [0, 0.5, 1, 1.5, 2, 2.5].map((t) => ({ t, c: 0, p: 0, inst: 'bumbo', v: 1 }))
    const ag = criarAgendadorDaFaixa(CTX, DESTINO, lista, 10)
    ag.agendarAte(11.6, 10)
    expect(tocados.map(({ t }) => t)).toEqual([10, 10.5, 11, 11.5])
    // A página travou 2 s: o ataque de 12 s já passou; o de 12,5 entra na janela.
    ag.agendarAte(13.6, 12.1)
    expect(tocados.map(({ t }) => t)).toEqual([10, 10.5, 11, 11.5, 12.5])
    expect(ag.pulados).toBe(1)
  })

  it('um ataque um pouco atrasado (dentro da tolerância) sai agora, sem perder o começo', () => {
    const ag = criarAgendadorDaFaixa(CTX, DESTINO, [{ t: 0, c: 0, p: 0, inst: 'caixa', v: 1 }], 5)
    ag.agendarAte(6.5, 5.02)
    expect(tocados.map(({ t }) => t)).toEqual([5.02])
  })
})
