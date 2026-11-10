import { afterEach, describe, expect, it, vi } from 'vitest'
import { ESPERA_DA_CENA_MAX_MS, aguardarCenaPronta } from './motor'

/**
 * `pronta` (opcional) da CenaTransicao: a cena que carrega imagem avisa quando
 * terminou, e o motor espera isso antes de compilar e ligar o relógio. Cena sem
 * `pronta` segue como antes; `pronta` que falha ou nunca chega não trava a transição.
 */

afterEach(() => {
  vi.useRealTimers()
})

describe('motor e a promessa pronta da cena', () => {
  it('cena sem pronta: segue na hora, sem armar o teto da espera', async () => {
    // Com relógio falso: se o motor esperasse o teto (4 s) por uma cena antiga, `seguiu` ficaria falso.
    vi.useFakeTimers()
    let seguiu = false
    const esperando = aguardarCenaPronta({}).then(() => {
      seguiu = true
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(seguiu).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await esperando
  })

  it('cena com pronta: espera ela resolver', async () => {
    let terminar: () => void = () => undefined
    const pronta = new Promise<void>((resolver) => {
      terminar = resolver
    })
    let seguiu = false
    const esperando = aguardarCenaPronta({ pronta }).then(() => {
      seguiu = true
    })
    await Promise.resolve()
    expect(seguiu).toBe(false)
    terminar()
    await esperando
    expect(seguiu).toBe(true)
  })

  it('pronta que falha não derruba a transição', async () => {
    await expect(aguardarCenaPronta({ pronta: Promise.reject(new Error('imagem não carregou')) })).resolves.toBeUndefined()
  })

  it('pronta que nunca chega: segue no teto da espera', async () => {
    vi.useFakeTimers()
    let seguiu = false
    const esperando = aguardarCenaPronta({ pronta: new Promise<void>(() => undefined) }).then(() => {
      seguiu = true
    })
    await vi.advanceTimersByTimeAsync(ESPERA_DA_CENA_MAX_MS - 1)
    expect(seguiu).toBe(false)
    await vi.advanceTimersByTimeAsync(2)
    await esperando
    expect(seguiu).toBe(true)
  })
})
