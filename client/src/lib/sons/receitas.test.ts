import { describe, expect, it } from 'vitest'
import { RECEITAS, type Voz } from './receitas'
import { SEGUNDOS_DE_RUIDO, curvaDeAltura } from './sintetizador'

/** O pedido: sons curtos. Nenhum chega a isso, contando a cauda. */
const DURACAO_MAXIMA_S = 1.2
/** Antes do volume da mesa: som de fundo, nunca alarme. */
const PICO_MAXIMO = 0.35
/** Acima disso o filtro não serve para nada (e perto de 24 kHz o navegador recusa). */
const FILTRO_MAXIMO_HZ = 20000

const receitas = Object.entries(RECEITAS)
const vozes = receitas.flatMap(([id, lista]) => lista.map((voz) => ({ id, voz })))
const fimDe = (lista: readonly Voz[]) => Math.max(...lista.map((voz) => voz.inicio + voz.duracao))

describe('receitas dos sons de clima', () => {
  it('os 7 sons existem, cada um com ao menos uma voz, e todos acabam antes de 1,2 s', () => {
    expect(Object.keys(RECEITAS).sort()).toEqual(['aviso', 'dado', 'item', 'passagem', 'portaAbre', 'portaFecha', 'trancada'])
    for (const [id, lista] of receitas) {
      expect(lista.length, id).toBeGreaterThan(0)
      expect(fimDe(lista), id).toBeLessThan(DURACAO_MAXIMA_S)
    }
  })

  it('todo pico fica em (0, 0.35]', () => {
    for (const { id, voz } of vozes) {
      expect(voz.pico, id).toBeGreaterThan(0)
      expect(voz.pico, id).toBeLessThanOrEqual(PICO_MAXIMO)
    }
  })

  it('envelope sem clique: a voz começa em t >= 0, sobe em tempo > 0 e a subida (com o patamar) acaba antes do fim', () => {
    for (const { id, voz } of vozes) {
      expect(voz.inicio, id).toBeGreaterThanOrEqual(0)
      expect(voz.ataque, id).toBeGreaterThan(0)
      expect(voz.sustentar ?? 0, id).toBeGreaterThanOrEqual(0)
      expect(voz.ataque + (voz.sustentar ?? 0), id).toBeLessThan(voz.duracao)
    }
  })

  it('altura positiva do começo ao fim, mesmo com o vibrato; filtro dentro do audível', () => {
    for (const { id, voz } of vozes) {
      if (voz.filtro !== undefined) {
        expect(voz.filtro.hz, id).toBeGreaterThan(0)
        expect(voz.filtro.hz, id).toBeLessThan(FILTRO_MAXIMO_HZ)
        if (voz.filtro.q !== undefined) expect(voz.filtro.q, id).toBeGreaterThan(0)
      }
      if (voz.fonte !== 'osc') continue
      expect(voz.hzIni, id).toBeGreaterThan(0)
      // Rampa exponencial não aceita 0 nem troca de sinal.
      if (voz.hzFim !== undefined) expect(voz.hzFim, id).toBeGreaterThan(0)
      expect(Math.min(...curvaDeAltura(voz)), id).toBeGreaterThan(0)
    }
  })

  it('voz de ruído cabe no buffer de ruído (senão a fonte acaba antes do envelope e estala)', () => {
    for (const { id, voz } of vozes) {
      if (voz.fonte === 'ruido') expect(voz.duracao, id).toBeLessThanOrEqual(SEGUNDOS_DE_RUIDO)
    }
  })

  it('passagem (rangido + baque) dura mais que abrir uma porta', () => {
    expect(fimDe(RECEITAS.passagem)).toBeGreaterThan(fimDe(RECEITAS.portaAbre))
  })

  it('item é um sino de duas notas subindo, com 4 parciais senoidais em cada', () => {
    const item = RECEITAS.item
    expect(item).toHaveLength(8)
    const inicios = [...new Set(item.map((voz) => voz.inicio))]
    expect(inicios).toHaveLength(2)
    const [primeira, segunda] = inicios.map((inicio) => item.filter((voz) => voz.inicio === inicio))
    expect(primeira).toHaveLength(4)
    expect(segunda).toHaveLength(4)
    const fundamental = (nota: readonly Voz[]) => Math.min(...nota.map((voz) => (voz.fonte === 'osc' && voz.forma === 'sine' ? voz.hzIni : Infinity)))
    expect(fundamental(segunda)).toBeGreaterThan(fundamental(primeira))
  })
})
