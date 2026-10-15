import * as THREE from 'three'
import { afterAll, describe, expect, it, vi } from 'vitest'
import criar, { anguloDaFolha, anguloDoTrinco, estadoDaCamera, fadeDoPortao, PORTAO_DE_FERRO_ABERTO_RAD as ABERTO, ROTEIRO_DO_PORTAO_DE_FERRO as R } from './portao-de-ferro'
import meta from './portao-de-ferro.json'

/**
 * O "Portão de ferro" (transição do pacote): chega pela laje, sobe o degrau,
 * o trinco solta, as folhas abrem devagar numa curva só (sem trancos: isso é o
 * "Portão pesado"), balançam e assentam; a câmera atravessa para a neblina.
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

const getContextOriginal = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: contextoFalso, configurable: true, writable: true })
afterAll(() => {
  if (getContextOriginal) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextOriginal)
})

const PASSO = 0.02
const tempos = (a: number, b: number) => Array.from({ length: Math.round((b - a) / PASSO) + 1 }, (_, i) => a + i * PASSO)
const graus = (rad: number) => (rad * 180) / Math.PI

/** Uma cena aberta, lida pelo que o motor vê: folhas, trinco, câmera e o fade devolvido. */
function abrir(reduzirMovimento: boolean) {
  const cena = criar(THREE, { reduzirMovimento })
  cena.ajustarTela(16 / 9)
  const olho = cena.scene.getObjectByName('olho')
  const esquerda = cena.scene.getObjectByName('folha-esquerda')
  const direita = cena.scene.getObjectByName('folha-direita')
  const trinco = cena.scene.getObjectByName('trinco')
  if (!olho || !esquerda || !direita || !trinco) throw new Error('cena sem olho, folhas ou trinco')
  return {
    cena,
    em(t: number) {
      const { fade } = cena.atualizar(t)
      return { fade, esq: esquerda.rotation.y, dir: -direita.rotation.y, trinco: -trinco.rotation.z, x: olho.position.x, y: olho.position.y, z: olho.position.z }
    },
  }
}

describe('roteiro do Portão de ferro', () => {
  it('a duração do .json é a do roteiro e a miniatura mostra o portão fechado e já visível', () => {
    expect(meta.duracaoNaturalS).toBe(R.duracao)
    expect(meta.quadroDaMiniaturaS).toBeGreaterThan(R.fadeInFim)
    expect(meta.quadroDaMiniaturaS).toBeLessThan(R.trinco)
    expect(fadeDoPortao(meta.quadroDaMiniaturaS)).toBe(0)
    expect(anguloDaFolha(meta.quadroDaMiniaturaS, 'direita', false)).toBe(0)
  })

  it('as marcas seguem a ordem do roteiro: chega, sobe, trinco, abre, atravessa, neblina, preto', () => {
    const ordem = [R.fadeInFim, R.degrau, R.patamar, R.chegadaFim, R.trinco, R.aberturaInicio, R.travessiaInicio, R.aberturaFim, R.neblinaInicio, R.fadeOutInicio, R.travessiaFim, R.fadeOutFim]
    for (let i = 1; i < ordem.length; i++) expect(ordem[i]).toBeGreaterThanOrEqual(ordem[i - 1])
    expect(R.fadeOutFim).toBe(R.duracao)
    expect(R.fadeOutFim - R.fadeOutInicio).toBeCloseTo(0.5, 5)
    expect(R.trinco).toBeCloseTo(3, 1)
    expect(R.aberturaFim - R.aberturaInicio).toBeGreaterThan(3)
    expect(R.passos).toContain(R.degrau)
    expect(R.passos).toContain(R.patamar)
  })

  it('fade: preto em 0, visível do fim da entrada até o começo da saída, preto no fim', () => {
    expect(fadeDoPortao(0)).toBe(1)
    for (const t of tempos(R.fadeInFim, R.fadeOutInicio)) expect(fadeDoPortao(t)).toBe(0)
    expect(fadeDoPortao(R.duracao)).toBe(1)
    for (const t of tempos(R.fadeOutInicio, R.fadeOutFim - PASSO)) expect(fadeDoPortao(t + PASSO)).toBeGreaterThanOrEqual(fadeDoPortao(t))
  })
})

describe('folhas e trinco', () => {
  it('fechadas até a abertura começar; o trinco solta antes', () => {
    for (const t of tempos(0, R.aberturaInicio)) {
      expect(anguloDaFolha(t, 'direita', false)).toBe(0)
      expect(anguloDaFolha(t, 'esquerda', false)).toBe(0)
    }
    expect(anguloDoTrinco(R.trinco - 0.2)).toBe(0)
    expect(anguloDoTrinco(R.aberturaInicio)).toBeGreaterThan(0.5)
  })

  it('abrem numa curva só, sempre para longe, sem tranco (velocidade sem saltos)', () => {
    for (const lado of ['esquerda', 'direita'] as const) {
      let anterior = anguloDaFolha(R.aberturaInicio, lado, false)
      let velAnterior = 0
      let maiorSaltoDeVelocidade = 0
      for (const t of tempos(R.aberturaInicio + PASSO, R.aberturaFim)) {
        const a = anguloDaFolha(t, lado, false)
        expect(a).toBeGreaterThanOrEqual(anterior)
        const vel = (a - anterior) / PASSO
        maiorSaltoDeVelocidade = Math.max(maiorSaltoDeVelocidade, Math.abs(vel - velAnterior))
        anterior = a
        velAnterior = vel
      }
      // Um tranco aparece como salto de velocidade entre amostras vizinhas.
      expect(maiorSaltoDeVelocidade).toBeLessThan(0.08)
    }
    expect(graus(anguloDaFolha(R.aberturaFim, 'direita', false))).toBeGreaterThan(80)
    expect(graus(anguloDaFolha(R.aberturaFim, 'esquerda', false))).toBeGreaterThan(80)
  })

  it('no fim passam um pouco do ponto, voltam e assentam (balanço pequeno que morre)', () => {
    const depois = tempos(R.aberturaFim, R.duracao).map((t) => anguloDaFolha(t, 'direita', false) - ABERTO)
    expect(Math.max(...depois)).toBeGreaterThan(0.005)
    expect(Math.min(...depois)).toBeLessThan(-0.002)
    expect(Math.max(...depois.map(Math.abs))).toBeLessThan(0.03)
    expect(Math.abs(anguloDaFolha(R.duracao, 'direita', false) - ABERTO)).toBeLessThan(0.002)
  })

  it('a cena gira as folhas para longe da câmera e ergue o trinco', () => {
    const v = abrir(false)
    const meio = v.em((R.aberturaInicio + R.aberturaFim) / 2)
    expect(meio.esq).toBeGreaterThan(0.3)
    expect(meio.dir).toBeGreaterThan(0.3)
    expect(meio.trinco).toBeGreaterThan(0.5)
    // A borda do meio da folha direita foi para trás do plano do portão (z < 0).
    const direita = v.cena.scene.getObjectByName('folha-direita')
    const borda = new THREE.Vector3(-1.1, 1, 0)
    direita?.updateMatrixWorld(true)
    direita?.localToWorld(borda)
    expect(borda.z).toBeLessThan(-0.5)
    v.cena.descartar()
  })
})

describe('câmera', () => {
  it('chega andando, sobe o degrau e a laje (+0,3 m) e para diante do portão', () => {
    const z = tempos(0, R.chegadaFim).map((t) => estadoDaCamera(t, false).z)
    for (let i = 1; i < z.length; i++) expect(z[i]).toBeLessThanOrEqual(z[i - 1] + 1e-9)
    const yAntes = estadoDaCamera(R.degrau - 0.3, false).y
    const yDepois = estadoDaCamera(R.chegadaFim + 0.4, false).y
    expect(yDepois - yAntes).toBeGreaterThan(0.25)
    for (const t of tempos(R.chegadaFim, R.travessiaInicio)) expect(estadoDaCamera(t, false).z).toBeCloseTo(estadoDaCamera(R.chegadaFim, false).z, 6)
  })

  it('atravessa o portão (z passa de 0) com as folhas já abertas além de 70°', () => {
    const passa = tempos(R.travessiaInicio, R.travessiaFim).find((t) => estadoDaCamera(t, false).z < 0.2)
    expect(passa).toBeDefined()
    expect(graus(anguloDaFolha(passa ?? 0, 'direita', false))).toBeGreaterThan(70)
    expect(graus(anguloDaFolha(passa ?? 0, 'esquerda', false))).toBeGreaterThan(70)
    expect(estadoDaCamera(R.travessiaFim, false).z).toBeLessThan(-1)
  })

  it('reduzir movimento: câmera parada e mais perto, sem giro; folhas sem balanço', () => {
    const v = abrir(true)
    const inicio = v.em(0)
    for (const t of tempos(0, R.duracao)) {
      const c = estadoDaCamera(t, true)
      expect(c.giro).toBe(0)
      const q = v.em(t)
      expect(q.x).toBe(inicio.x)
      expect(q.y).toBe(inicio.y)
      expect(q.z).toBe(inicio.z)
    }
    expect(inicio.z).toBeLessThan(estadoDaCamera(0, false).z)
    for (const t of tempos(R.aberturaFim, R.duracao)) expect(anguloDaFolha(t, 'direita', true)).toBe(ABERTO)
    v.cena.descartar()
  })
})

describe('descarte', () => {
  it('libera cada geometria, material e textura da cena e a imagem pequena', () => {
    const cena = criar(THREE, { reduzirMovimento: false })
    cena.ajustarTela(16 / 9)
    cena.atualizar(5)
    const pendentes = new Set<{ addEventListener: (tipo: 'dispose', f: () => void) => void }>()
    cena.scene.traverse((obj) => {
      const malha = obj as THREE.Mesh
      if (malha.geometry) pendentes.add(malha.geometry)
      const materiais = Array.isArray(malha.material) ? malha.material : malha.material ? [malha.material] : []
      for (const m of materiais) {
        pendentes.add(m)
        const mapa = (m as THREE.MeshBasicMaterial).map
        if (mapa) pendentes.add(mapa)
      }
    })
    expect(pendentes.size).toBeGreaterThan(20)
    const liberados = new Set<unknown>()
    for (const p of pendentes) p.addEventListener('dispose', () => liberados.add(p))
    const alvo = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    cena.descartar()
    expect(liberados.size).toBe(pendentes.size)
    expect(alvo).toHaveBeenCalledTimes(1)
    alvo.mockRestore()
  })
})
