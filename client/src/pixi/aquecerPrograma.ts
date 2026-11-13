import type { GlProgram, Renderer } from 'pixi.js'

/**
 * COMPILAR CEDO, SEM TRAVAR: o Pixi compila o shader na hora do primeiro
 * desenho e espera a placa terminar (a leitura de `LINK_STATUS` trava a página
 * até o fim). Shader grande custa de 100 a 500 ms numa tarefa só: no Goa, ligar
 * a chuva travou 262 ms (o chão molhado) e pôr a água, 517 ms (FX-DESEMPENHO-062).
 *
 * Aqui o mesmo texto que o Pixi vai compilar (o já processado pelo `GlProgram`)
 * compila EM SEGUNDO PLANO (`KHR_parallel_shader_compile`): a página só
 * pergunta se terminou, sem esperar, a cada `ESPERA_DA_COMPILACAO_MS`. Depois
 * o Pixi compila de novo o mesmo texto e o navegador reaproveita o que a placa
 * já ligou (poucos ms). Sem a extensão, compila na primeira folga do navegador.
 * Uma vez por renderer e por programa.
 */

const ESPERA_DA_COMPILACAO_MS = 50
/** `COMPLETION_STATUS_KHR` da extensão `KHR_parallel_shader_compile`. */
const COMPLETION_STATUS_KHR = 0x91b1

/** Por renderer e por programa: o erro (`null` = compilou) ou a promessa enquanto compila. */
const compilacoes = new WeakMap<object, WeakMap<GlProgram, string | null | Promise<string | null>>>()

/** O que já se sabe: `true` compilou, `false` não compila nesta placa, `undefined` ainda compilando (ou nem começou). */
export function programaPronto(renderer: Renderer, programa: GlProgram): boolean | undefined {
  const sabido = compilacoes.get(renderer)?.get(programa)
  return sabido === undefined || sabido instanceof Promise ? undefined : sabido === null
}

/**
 * Compila `programa` em segundo plano neste renderer. Resolve `true` quando
 * compilou; `false` = a placa não compila (avisa uma vez no console, com
 * `aviso` e o erro): quem usa fica sem esse desenho, o resto do mapa segue.
 */
export function aquecerPrograma(renderer: Renderer, programa: GlProgram, aviso: string): Promise<boolean> {
  let porPrograma = compilacoes.get(renderer)
  if (porPrograma === undefined) {
    porPrograma = new WeakMap()
    compilacoes.set(renderer, porPrograma)
  }
  const sabido = porPrograma.get(programa)
  if (sabido !== undefined) return sabido instanceof Promise ? sabido.then((erro) => erro === null) : Promise.resolve(sabido === null)
  const guardar = porPrograma
  const promessa = new Promise<string | null>((resolver) => {
    const terminar = (erro: string | null): void => {
      guardar.set(programa, erro)
      if (erro !== null) console.warn(`${aviso} (${erro})`)
      resolver(erro)
    }
    if (!('gl' in renderer)) {
      terminar('o renderer não é WebGL')
      return
    }
    const gl = renderer.gl
    const comecar = (): void => {
      if (gl.isContextLost()) return terminar('contexto perdido')
      const paralela = gl.getExtension('KHR_parallel_shader_compile') !== null
      const { vertex, fragment } = programa
      if (vertex === undefined || fragment === undefined) return terminar('sem fonte')
      const vs = gl.createShader(gl.VERTEX_SHADER)
      const fs = gl.createShader(gl.FRAGMENT_SHADER)
      const p = gl.createProgram()
      if (vs === null || fs === null || p === null) return terminar('o contexto não criou o shader')
      gl.shaderSource(vs, vertex)
      gl.compileShader(vs)
      gl.shaderSource(fs, fragment)
      gl.compileShader(fs)
      gl.attachShader(p, vs)
      gl.attachShader(p, fs)
      gl.linkProgram(p)
      const conferir = (): void => {
        if (gl.isContextLost()) return terminar('contexto perdido')
        if (paralela && gl.getProgramParameter(p, COMPLETION_STATUS_KHR) !== true) {
          setTimeout(conferir, ESPERA_DA_COMPILACAO_MS)
          return
        }
        const ligou = gl.getProgramParameter(p, gl.LINK_STATUS) === true
        const erro = ligou ? null : `${gl.getShaderInfoLog(vs) ?? ''} ${gl.getShaderInfoLog(fs) ?? ''} ${gl.getProgramInfoLog(p) ?? ''}`.trim()
        gl.deleteProgram(p)
        gl.deleteShader(vs)
        gl.deleteShader(fs)
        terminar(erro)
      }
      conferir()
    }
    // Sem a extensão, a conferência trava até o fim: que trave numa folga, não num clique.
    if (gl.getExtension('KHR_parallel_shader_compile') !== null) comecar()
    else if (typeof requestIdleCallback === 'function') requestIdleCallback(comecar, { timeout: 2000 })
    else setTimeout(comecar, 0)
  })
  porPrograma.set(programa, promessa)
  return promessa.then((erro) => erro === null)
}
