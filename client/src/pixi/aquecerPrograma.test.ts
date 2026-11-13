/**
 * COMPILAR CEDO, SEM TRAVAR (FX-DESEMPENHO-062): a primeira chuva e a primeira
 * água travavam a tela esperando o shader compilar (262 e 517 ms no Goa). Com
 * `KHR_parallel_shader_compile`, a página só pergunta se terminou; a leitura
 * que trava (`LINK_STATUS`) vem depois de a placa dizer que acabou. Placa de
 * mentira: conta as perguntas.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlProgram, type Renderer } from 'pixi.js'
import { aquecerPrograma, programaPronto } from './aquecerPrograma'

const LINK_STATUS = 0x8b82
const COMPLETION_STATUS_KHR = 0x91b1

/** Um contexto WebGL de mentira: a ligação termina depois de `perguntasAteTerminar` perguntas; `liga` diz se ligou. */
function placa(perguntasAteTerminar: number, liga: boolean) {
  const lidas: number[] = []
  let perguntas = 0
  let programas = 0
  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    LINK_STATUS,
    isContextLost: () => false,
    getExtension: (nome: string) => (nome === 'KHR_parallel_shader_compile' ? {} : null),
    createShader: () => ({}),
    createProgram: () => {
      programas += 1
      return {}
    },
    shaderSource: () => {},
    compileShader: () => {},
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: (_p: unknown, nome: number) => {
      lidas.push(nome)
      if (nome === COMPLETION_STATUS_KHR) {
        perguntas += 1
        return perguntas > perguntasAteTerminar
      }
      return nome === LINK_STATUS ? liga : null
    },
    getShaderInfoLog: () => '',
    getProgramInfoLog: () => 'falha de mentira',
    deleteProgram: () => {},
    deleteShader: () => {},
  }
  // Só o `gl` do renderer é usado aqui; o resto do Renderer do Pixi não entra no aquecimento.
  const renderer = { gl } as unknown as Renderer
  return { renderer, lidas, programasCriados: () => programas }
}

const programa = () => new GlProgram({ vertex: 'void main() {}', fragment: 'void main() {}', name: 'teste-aquecer' })

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('aquecerPrograma', () => {
  it('com a extensão, só lê LINK_STATUS depois de a placa terminar, e a segunda vez não compila de novo', async () => {
    vi.useFakeTimers()
    const { renderer, lidas, programasCriados } = placa(3, true)
    const p = programa()
    const pronto = aquecerPrograma(renderer, p, '[teste]')
    expect(programaPronto(renderer, p)).toBeUndefined()
    await vi.advanceTimersByTimeAsync(500)
    await expect(pronto).resolves.toBe(true)
    // Três "ainda não", um "acabou" e só então a leitura que trava.
    expect(lidas).toEqual([COMPLETION_STATUS_KHR, COMPLETION_STATUS_KHR, COMPLETION_STATUS_KHR, COMPLETION_STATUS_KHR, LINK_STATUS])
    expect(programaPronto(renderer, p)).toBe(true)
    await expect(aquecerPrograma(renderer, p, '[teste]')).resolves.toBe(true)
    expect(programasCriados()).toBe(1)
  })

  it('a placa que não liga resolve false e avisa uma vez só', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { renderer } = placa(0, false)
    const p = programa()
    await expect(aquecerPrograma(renderer, p, '[teste] não compilou')).resolves.toBe(false)
    await expect(aquecerPrograma(renderer, p, '[teste] não compilou')).resolves.toBe(false)
    expect(programaPronto(renderer, p)).toBe(false)
    expect(aviso).toHaveBeenCalledTimes(1)
    expect(String(aviso.mock.calls[0][0])).toContain('[teste] não compilou')
  })
})
