import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import { DURACAO } from './_roteiroDoPinheiral'
import criarDia from './trilha-do-pinheiral'
import criarChamas from './trilha-do-pinheiral-em-chamas'

/**
 * Trilha do pinheiral (aprovada em 27/10/2026), as duas variações: montam a
 * cena do contrato, o fade fica entre 0 e 1 e fecha a tela no fim, e o
 * descarte libera toda geometria, material e textura da cena.
 */

/** jsdom não tem canvas 2D: um contexto que aceita tudo basta para pintar as texturas. */
function contextoFalso(): CanvasRenderingContext2D {
  const gradiente = { addColorStop: () => undefined }
  const alvo: Record<string | symbol, unknown> = {
    getImageData: (_x: number, _y: number, largura: number, altura: number) => ({ data: new Uint8ClampedArray(largura * altura * 4) }),
    createRadialGradient: () => gradiente,
    createLinearGradient: () => gradiente,
  }
  // Proxy que responde a qualquer método do contexto 2D: o tipo inteiro não cabe num objeto literal de teste.
  return new Proxy(alvo, { get: (o, chave) => (chave in o ? o[chave] : () => undefined) }) as unknown as CanvasRenderingContext2D
}

const getContextOriginal = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: contextoFalso, configurable: true, writable: true })
afterAll(() => {
  if (getContextOriginal) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextOriginal)
})

describe.each([
  ['dia', criarDia],
  ['em chamas', criarChamas],
])('Trilha do pinheiral (%s)', (_variante, criar) => {
  it.each([false, true])('monta, toca e libera tudo no descarte (movimento reduzido: %s)', (reduzirMovimento) => {
    const cena = criar(THREE, { reduzirMovimento })
    expect(cena.scene).toBeInstanceOf(THREE.Scene)
    expect(cena.camera).toBeInstanceOf(THREE.PerspectiveCamera)
    cena.ajustarTela(9 / 16)
    cena.ajustarTela(16 / 9)
    for (let t = 0; t <= DURACAO; t += 0.25) {
      const { fade } = cena.atualizar(t)
      expect(fade).toBeGreaterThanOrEqual(0)
      expect(fade).toBeLessThanOrEqual(1)
    }
    expect(cena.atualizar(DURACAO).fade).toBe(1)

    const recursos = new Set<{ dispose: () => void }>()
    cena.scene.traverse((objeto) => {
      if (!(objeto instanceof THREE.Mesh || objeto instanceof THREE.Points || objeto instanceof THREE.Sprite || objeto instanceof THREE.Line)) return
      recursos.add(objeto.geometry)
      for (const material of Array.isArray(objeto.material) ? objeto.material : [objeto.material]) {
        recursos.add(material)
        if ('map' in material && material.map instanceof THREE.Texture) recursos.add(material.map)
      }
    })
    expect(recursos.size).toBeGreaterThan(5)
    const liberados = new Set<object>()
    for (const recurso of recursos) {
      const original = recurso.dispose.bind(recurso)
      recurso.dispose = () => {
        liberados.add(recurso)
        original()
      }
    }
    cena.descartar()
    expect([...recursos].filter((recurso) => !liberados.has(recurso))).toEqual([])
  })
})
