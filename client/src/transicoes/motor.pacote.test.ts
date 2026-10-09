import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { esquecerTransicoesDeFora, marcarCarregamentoDeFora, registrarTransicao } from './catalogo'
import { resolverFabricaDaCena, tocarTransicao } from './motor'

/** TRANSIÇÃO DO PACOTE no motor: resolve pelo registro; desconhecida = `onFim` na hora. */

const tunel = (criar: () => unknown) => ({ id: 'tunel', nome: 'Túnel', duracaoNaturalS: 5, quadroDaMiniaturaS: 1, criar })

beforeEach(() => {
  // Com "WebGL", o motor passa da primeira porta e chega à resolução da cena.
  vi.stubGlobal('WebGLRenderingContext', class {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  esquecerTransicoesDeFora()
})

describe('motor e o pacote de animações', () => {
  it('id do pacote resolve para a fábrica registrada (que chama o criar de fora)', async () => {
    const criarDeFora = vi.fn(() => ({}))
    registrarTransicao(tunel(criarDeFora))
    const criar = await resolverFabricaDaCena('tunel')
    expect(criar).toBeTypeOf('function')
    const THREE = await import('three')
    // A cena de mentira não tem a forma do contrato: a conferência lança, mas o criar de fora foi chamado.
    expect(() => criar?.(THREE, { reduzirMovimento: true })).toThrow()
    expect(criarDeFora).toHaveBeenCalledWith(THREE, { reduzirMovimento: true })
  })

  it('embutida continua pelo switch', async () => {
    const { criarCenaPorta } = await import('./cenas/porta')
    expect(await resolverFabricaDaCena('porta')).toBe(criarCenaPorta)
  })

  it('desconhecida resolve para null', async () => {
    expect(await resolverFabricaDaCena('helicoptero')).toBeNull()
  })

  it('espera o pacote que está chegando antes de dizer "desconhecida"', async () => {
    let terminar: () => void = () => undefined
    const chegando = new Promise<void>((resolver) => {
      terminar = resolver
    })
    marcarCarregamentoDeFora(chegando)
    const resolvendo = resolverFabricaDaCena('tunel')
    registrarTransicao(tunel(() => ({})))
    terminar()
    expect(await resolvendo).toBeTypeOf('function')
  })

  it('tocar uma desconhecida chama onFim na hora e devolve um controle que não quebra', async () => {
    const onFim = vi.fn()
    const canvas = document.createElement('canvas')
    const controle = await tocarTransicao({ canvas, escolha: { id: 'helicoptero' }, volume: 0, reduzirMovimento: true, onFim })
    expect(onFim).toHaveBeenCalledTimes(1)
    expect(() => {
      controle.parar()
      controle.definirVolume(1)
    }).not.toThrow()
  })
})
