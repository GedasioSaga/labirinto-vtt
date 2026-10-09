import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import criar, { PORTAO_ABERTO_RAD, ROTEIRO_DO_PORTAO as T } from '../animacoes/transicao/portao-pesado'
import meta from '../animacoes/transicao/portao-pesado.json'

/**
 * O ritmo do "Portão pesado" (transição do pacote): o portão tem de PARECER
 * difícil de abrir. Mora aqui, e não ao lado da fonte, porque o script do
 * pacote trata todo `.ts` de `animacoes/transicao/` como uma animação.
 */

/** jsdom não tem canvas 2D: um contexto que aceita tudo basta para montar as texturas. */
function contextoFalso(): CanvasRenderingContext2D {
  const gradiente = { addColorStop: () => undefined }
  const alvo: Record<string | symbol, unknown> = {
    getImageData: (_x: number, _y: number, largura: number, altura: number) => ({ data: new Uint8ClampedArray(largura * altura * 4) }),
    createRadialGradient: () => gradiente,
    createLinearGradient: () => gradiente,
  }
  return new Proxy(alvo, { get: (o, chave) => (chave in o ? o[chave] : () => undefined) }) as unknown as CanvasRenderingContext2D
}

// Já na carga do arquivo: as amostras são tiradas na coleta do `describe`, antes de qualquer `beforeAll`.
const getContextOriginal = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: contextoFalso, configurable: true, writable: true })
afterAll(() => {
  if (getContextOriginal) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextOriginal)
})

interface Amostra {
  t: number
  esquerda: number
  direita: number
  x: number
  y: number
  z: number
  quaternion: number[]
  luz: number
  fade: number
}

/** Roda a cena de 0,01 em 0,01 s, como o motor faria, e lê o estado pelos nomes dos objetos. */
function amostrar(reduzirMovimento: boolean): Amostra[] {
  const cena = criar(THREE, { reduzirMovimento })
  const objeto = (nome: string) => {
    const achado = cena.scene.getObjectByName(nome)
    if (!achado) throw new Error(`cena sem "${nome}"`)
    return achado
  }
  const esquerda = objeto('folha-esquerda')
  const direita = objeto('folha-direita')
  const olho = objeto('olho')
  const luz = objeto('luz') as THREE.SpotLight
  const amostras: Amostra[] = []
  for (let i = 0; i <= Math.round(T.fadeOutFim * 100); i++) {
    const t = i / 100
    const { fade } = cena.atualizar(t)
    amostras.push({ t, esquerda: esquerda.rotation.y, direita: -direita.rotation.y, x: olho.position.x, y: olho.position.y, z: olho.position.z, quaternion: olho.quaternion.toArray(), luz: luz.intensity, fade })
  }
  cena.descartar()
  return amostras
}

const entre = (amostras: Amostra[], de: number, ate: number) => amostras.filter((a) => a.t >= de - 1e-9 && a.t <= ate + 1e-9)
const maior = (valores: number[]) => Math.max(...valores)
const GRAU = Math.PI / 180

describe('Portão pesado', () => {
  const normal = amostrar(false)
  const reduzido = amostrar(true)
  const em = (amostras: Amostra[], t: number) => amostras[Math.round(t * 100)]

  it('a meta bate com o roteiro: duração natural no fim do fade e miniatura com a cena visível', () => {
    expect(meta.duracaoNaturalS).toBe(T.fadeOutFim)
    expect(meta.duracaoNaturalS).toBeGreaterThanOrEqual(9)
    expect(meta.duracaoNaturalS).toBeLessThanOrEqual(12)
    expect(em(normal, meta.quadroDaMiniaturaS).fade).toBe(0)
    expect(em(normal, meta.quadroDaMiniaturaS).esquerda).toBe(0)
  })

  it('1º empurrão: as folhas mal se mexem (entre 0,5° e 1,5°) e o portão devolve quase tudo', () => {
    const antes = entre(normal, 0, T.esforco - 0.01)
    const pico = maior(antes.map((a) => Math.max(a.esquerda, a.direita)))
    expect(pico).toBeGreaterThan(0.5 * GRAU)
    expect(pico).toBeLessThan(1.5 * GRAU)
    expect(em(normal, T.esforco - 0.05).direita).toBeLessThan(0.5 * GRAU)
  })

  it('o baque treme a câmera e a lâmpada', () => {
    const base = em(normal, T.empurrao1 - 0.1)
    const choque = entre(normal, T.empurrao1, T.empurrao1 + 0.4)
    expect(maior(choque.map((a) => Math.abs(a.x - base.x)))).toBeGreaterThan(0.004)
    expect(Math.min(...choque.map((a) => a.luz))).toBeLessThan(base.luz * 0.9)
  })

  it('pausa: depois do baque assentar, nada se mexe até o esforço', () => {
    const pausa = entre(normal, T.empurrao1 + 1.1, T.esforco - 0.02)
    const primeira = pausa[0]
    for (const a of pausa) {
      expect(Math.abs(a.esquerda - primeira.esquerda)).toBeLessThan(1e-4)
      expect(Math.abs(a.direita - primeira.direita)).toBeLessThan(1e-4)
      expect(a.x).toBeCloseTo(0.02, 6)
    }
  })

  it('2º empurrão: cada tranco cede de uma vez e as folhas param de novo antes do próximo', () => {
    T.trancos.forEach((tk, k) => {
      const salto = em(normal, tk + 0.2).direita - em(normal, tk).direita
      expect(salto).toBeGreaterThan(0.04)
      const proximo = k + 1 < T.trancos.length ? T.trancos[k + 1] : T.aberturaInicio
      const parado = entre(normal, proximo - 0.25, proximo - 0.02).map((a) => a.direita)
      expect(maior(parado) - Math.min(...parado)).toBeLessThan(0.004)
    })
  })

  it('abertura final: só avança, sai devagar e termina no ângulo de aberto', () => {
    const final = entre(normal, T.aberturaInicio + 0.25, T.aberturaFim)
    for (let i = 1; i < final.length; i++) {
      expect(final[i].esquerda).toBeGreaterThanOrEqual(final[i - 1].esquerda - 1e-9)
      expect(final[i].direita).toBeGreaterThanOrEqual(final[i - 1].direita - 1e-9)
    }
    const arranque = em(normal, T.aberturaInicio + 0.5).direita - em(normal, T.aberturaInicio).direita
    expect(arranque).toBeLessThan(0.12)
    expect(em(normal, T.aberturaFim).esquerda).toBeCloseTo(PORTAO_ABERTO_RAD, 6)
    expect(em(normal, T.aberturaFim).direita).toBeCloseTo(PORTAO_ABERTO_RAD, 6)
  })

  it('fade: preto no começo e no fim, cena toda visível no meio', () => {
    expect(normal[0].fade).toBe(1)
    expect(normal[normal.length - 1].fade).toBe(1)
    for (const a of entre(normal, T.fadeInFim, T.fadeOutInicio)) expect(a.fade).toBe(0)
  })

  it('a câmera atravessa o vão no fim (passa da soleira antes de a tela fechar)', () => {
    expect(em(normal, T.chegadaInicio).z).toBeGreaterThan(7)
    expect(em(normal, T.fadeOutFim).z).toBeLessThan(0)
  })

  it('reduzir movimento: câmera parada, sem tremor, e as folhas cedem em rampas suaves', () => {
    const inicio = reduzido[0]
    for (const a of reduzido) {
      expect(a.x).toBe(inicio.x)
      expect(a.y).toBe(inicio.y)
      expect(a.z).toBe(inicio.z)
      a.quaternion.forEach((q, i) => expect(q).toBeCloseTo(inicio.quaternion[i], 9))
    }
    const velocidade = (amostras: Amostra[]) => maior(entre(amostras, 0.01, T.aberturaInicio).map((a, i, lista) => (i === 0 ? 0 : Math.abs(a.direita - lista[i - 1].direita) / 0.01)))
    expect(velocidade(reduzido)).toBeLessThan(0.5)
    expect(velocidade(normal)).toBeGreaterThan(1)
    expect(em(reduzido, T.aberturaFim).direita).toBeCloseTo(PORTAO_ABERTO_RAD, 6)
  })
})
