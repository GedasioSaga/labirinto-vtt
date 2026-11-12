import { describe, expect, it } from 'vitest'
import { oklabDoHex } from '../../texturas/meioTermo/materiais'
import { MODELOS_DO_TETO, NOME_DO_MODELO, PALETA_DO_TETO, corDoTetoValida, corPadraoDoModelo, type ModeloDoTeto } from './paletas'

/**
 * OS MODELOS E AS PALETAS DO TELHADO (pedido de 12/11/2026: ardósia, metal e
 * tabuinhas, 6 cores cada). A régua de cor é a das paletas que já existiam
 * (telha e madeira): croma e luz OKLab dentro da faixa delas, para nenhum
 * telhado novo gritar mais que os de antes.
 */

const NOVOS: readonly ModeloDoTeto[] = ['ardosia', 'metal', 'tabuinhas']
const croma = (hex: string): number => {
  const [, a, b] = oklabDoHex(hex)
  return Math.hypot(a, b)
}
const luz = (hex: string): number => oklabDoHex(hex)[0]

describe('modelos e paletas do telhado', () => {
  it('seis modelos com nome; cada um com 6 cores válidas, ids e hex únicos, e a padrão é a primeira', () => {
    expect(MODELOS_DO_TETO).toEqual(['telhas', 'madeira', 'palha', 'ardosia', 'metal', 'tabuinhas'])
    expect(NOVOS.map((m) => NOME_DO_MODELO[m])).toEqual(['Ardósia', 'Metal', 'Tabuinhas'])
    for (const modelo of MODELOS_DO_TETO) {
      const paleta = PALETA_DO_TETO[modelo]
      expect(paleta, modelo).toHaveLength(6)
      expect(paleta.every((c) => corDoTetoValida(c.hex) && c.hex === c.hex.toLowerCase()), modelo).toBe(true)
      expect(new Set(paleta.map((c) => c.id)).size, modelo).toBe(6)
      expect(new Set(paleta.map((c) => c.hex)).size, modelo).toBe(6)
      expect(corPadraoDoModelo(modelo), modelo).toBe(paleta[0].hex)
    }
    // "Modelo Ardósia / Cor Ardósia" só nas Telhas: dentro do modelo Ardósia nenhuma cor se chama assim.
    expect(PALETA_DO_TETO.ardosia.some((c) => c.nome === 'Ardósia')).toBe(false)
    expect(PALETA_DO_TETO.telhas.some((c) => c.nome === 'Ardósia')).toBe(true)
  })

  it('as cores de ardósia, metal e tabuinhas ficam na faixa de croma e luz OKLab das de telha e madeira', () => {
    const regua = [...PALETA_DO_TETO.telhas, ...PALETA_DO_TETO.madeira].map((c) => c.hex)
    const cromaMaximo = Math.max(...regua.map(croma))
    const [luzMinima, luzMaxima] = [Math.min(...regua.map(luz)), Math.max(...regua.map(luz))]
    const fora = NOVOS.flatMap((m) =>
      PALETA_DO_TETO[m]
        .filter((c) => croma(c.hex) > cromaMaximo || luz(c.hex) < luzMinima || luz(c.hex) > luzMaxima)
        .map((c) => `${m}/${c.id}: croma ${croma(c.hex).toFixed(3)} luz ${luz(c.hex).toFixed(3)}`),
    )
    expect(fora).toEqual([])
  })
})
