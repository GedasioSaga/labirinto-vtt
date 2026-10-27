import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import type { CriarCena, KitDeSom } from '../../transicoes/tipos'
import criarOriginal, { ROTEIRO_DO_CAMPO as R } from './campo-ensolarado'
import criarTresCasas from './campo-ensolarado-tres-casas'
import metaTresCasas from './campo-ensolarado-tres-casas.json'
import criarVila from './campo-ensolarado-vila'
import metaVila from './campo-ensolarado-vila.json'

/**
 * As variações do "Campo ensolarado" (três casas, vila): a mesma câmera, o
 * mesmo sol, o mesmo branco e o mesmo som da aprovada, quadro a quadro; só o
 * fundo muda, longe do sol, parado (fora a fumaça) e descartado inteiro.
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

/** O que o motor vê a cada quadro: câmera, fade, o branco e os raios do sol. */
function amostrar(criar: CriarCena, reduzirMovimento: boolean): number[][] {
  const cena = criar(THREE, { reduzirMovimento })
  cena.ajustarTela(16 / 9)
  const branco = cena.scene.getObjectByName('branco') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  const raios = cena.scene.getObjectByName('raios') as THREE.Sprite
  const amostras = Array.from({ length: Math.round(R.duracao * 100) + 1 }, (_, i) => {
    const { fade } = cena.atualizar(i / 100)
    const { position: p, rotation: r } = cena.camera
    return [p.x, p.y, p.z, r.x, r.y, r.z, cena.camera.fov, fade, branco.visible ? branco.material.opacity : 0, raios.material.opacity, raios.scale.x]
  })
  cena.descartar()
  return amostras
}

/** Passos do som pelo tempo da cena, num contexto de áudio de mentira (o mesmo molde do teste da aprovada). */
function passosDoSom(criar: CriarCena): number[] {
  let agora = 0
  const passos: number[] = []
  const nada = () => undefined
  const parametro = () => ({ value: 0, setValueAtTime: nada, linearRampToValueAtTime: nada, exponentialRampToValueAtTime: nada, setTargetAtTime: nada })
  const no = () => {
    const criado: { buffer: { grao?: boolean } | null; [chave: string]: unknown } = {
      buffer: null,
      connect: <T>(destino: T) => destino,
      start: (quando?: number) => {
        if (criado.buffer?.grao) passos.push(quando ?? agora)
      },
      stop: nada,
      gain: parametro(),
      frequency: parametro(),
      Q: parametro(),
      pan: parametro(),
    }
    return criado
  }
  const ctx = {
    get currentTime() {
      return agora
    },
    sampleRate: 48000,
    createGain: no,
    createBiquadFilter: no,
    createBufferSource: no,
    createOscillator: no,
    createStereoPanner: no,
    createBuffer: (_canais: number, tamanho: number) => {
      const dados = new Float32Array(tamanho)
      return { grao: true, getChannelData: () => dados }
    },
  }
  const kit: KitDeSom = { ctx: ctx as unknown as AudioContext, destino: no() as unknown as AudioNode, ruido: () => ({}) as AudioBuffer }
  const cena = criar(THREE, { reduzirMovimento: false })
  const pistas = cena.criarSom?.(kit)
  if (!pistas) throw new Error('cena sem som')
  for (let i = 0; i <= R.duracao * 100; i++) {
    agora = i / 100
    cena.atualizar(i / 100)
    pistas.atualizar(i / 100)
  }
  cena.descartar()
  return passos
}

const malhasDoFundo = (scene: THREE.Scene) => {
  const malhas: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = []
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.name.startsWith('paisagem-')) malhas.push(o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>)
  })
  return malhas
}

const ORIGINAL = { normal: amostrar(criarOriginal, false), reduzido: amostrar(criarOriginal, true), passos: passosDoSom(criarOriginal) }

/** Direção do sol vista da parada (azimute 0,21 rad, elevação 0,42 rad, como na cena). */
const SOL = new THREE.Vector3(Math.sin(0.21) * Math.cos(0.42), Math.sin(0.42), -Math.cos(0.21) * Math.cos(0.42))
const PARADA = new THREE.Vector3(0, R.olho, -5.52)

/** Triângulos do fundo em coordenadas do mundo, menos a fumaça (que é um plano em pé, indexado). */
function triangulosDoFundo(scene: THREE.Scene): [THREE.Vector3, THREE.Vector3, THREE.Vector3][] {
  const tris: [THREE.Vector3, THREE.Vector3, THREE.Vector3][] = []
  for (const m of malhasDoFundo(scene)) {
    if (m.name.startsWith('paisagem-fumaca')) continue
    m.updateMatrixWorld()
    const pos = m.geometry.getAttribute('position')
    const indice = m.geometry.getIndex()
    const vertice = (k: number) => new THREE.Vector3().fromBufferAttribute(pos, indice ? indice.getX(k) : k).applyMatrix4(m.matrixWorld)
    const total = indice ? indice.count : pos.count
    for (let k = 0; k < total; k += 3) tris.push([vertice(k), vertice(k + 1), vertice(k + 2)])
  }
  return tris
}

/** Triângulo em pé (parede, empena, balcão): a normal quase não sobe. */
function emPe([a, b, c]: [THREE.Vector3, THREE.Vector3, THREE.Vector3]): boolean {
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize()
  return Math.abs(n.y) < 0.2
}

for (const [titulo, criar, meta, nome, perto, longe, larguraMinima] of [
  ['três casas', criarTresCasas, metaTresCasas, 'Campo ensolarado: três casas', 75, 125, 15],
  ['vila', criarVila, metaVila, 'Campo ensolarado: vila', 115, 180, 60],
] as const) {
  describe(`Campo ensolarado: ${titulo}`, () => {
    it('o fundo está lá: casas em pé de ponta a ponta, não só um chão', () => {
      const cena = criar(THREE, { reduzirMovimento: false })
      const tris = triangulosDoFundo(cena.scene)
      const xs = tris.flat().map((v) => v.x)
      expect(tris.filter(emPe).length).toBeGreaterThan(60)
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(larguraMinima)
      cena.descartar()
    })

    it('a meta bate com a aprovada, e a miniatura é da caminhada, com o fundo à vista', () => {
      expect(meta.nome).toBe(nome)
      expect(meta.duracaoNaturalS).toBe(7)
      expect(meta.quadroDaMiniaturaS).toBeGreaterThan(R.fadeEntrada)
      expect(meta.quadroDaMiniaturaS).toBeLessThan(R.inicioDaFreada)
    })

    it('câmera, fade, branco e sol iguais aos da aprovada em cada centésimo, normal e reduzido', () => {
      expect(amostrar(criar, false)).toEqual(ORIGINAL.normal)
      expect(amostrar(criar, true)).toEqual(ORIGINAL.reduzido)
    })

    it('o som é o mesmo: os passos caem nos mesmos instantes', () => {
      expect(passosDoSom(criar)).toEqual(ORIGINAL.passos)
    })

    it('o fundo fica no fundo, bem abaixo do sol, e a fumaça só do lado esquerdo', () => {
      const cena = criar(THREE, { reduzirMovimento: false })
      const malhas = malhasDoFundo(cena.scene)
      expect(malhas.length).toBeGreaterThan(3)
      const v = new THREE.Vector3()
      let maisPerto = Infinity
      let maisLonge = 0
      let maiorElevacao = -Infinity
      for (const m of malhas) {
        m.updateMatrixWorld()
        const pos = m.geometry.getAttribute('position')
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).sub(PARADA)
          const chao = Math.hypot(v.x, v.z)
          maisPerto = Math.min(maisPerto, chao)
          maisLonge = Math.max(maisLonge, chao)
          maiorElevacao = Math.max(maiorElevacao, Math.atan2(v.y, chao))
          if (m.name.startsWith('paisagem-fumaca')) expect(Math.atan2(v.x, -v.z)).toBeLessThan(0)
        }
      }
      expect(maisPerto).toBeGreaterThan(perto)
      expect(maisLonge).toBeLessThan(longe)
      // O sol está a 24°; nada do fundo passa de 9° (o alto da fumaça, que já some no degradê).
      expect(maiorElevacao).toBeLessThan((9 * Math.PI) / 180)
      expect(Math.asin(SOL.y)).toBeGreaterThan(maiorElevacao + 0.25)
      cena.descartar()
    })

    it('é sempre igual (semente própria) e só a fumaça se mexe, devagar', () => {
      const geometrias = (c: ReturnType<CriarCena>) => malhasDoFundo(c.scene).map((m) => [m.name, [...m.geometry.getAttribute('position').array], [...(m.geometry.getAttribute('color')?.array ?? [])]])
      const a = criar(THREE, { reduzirMovimento: false })
      const b = criar(THREE, { reduzirMovimento: false })
      expect(geometrias(a)).toEqual(geometrias(b))
      const antes = geometrias(a)
      const offsets = (t: number) => {
        a.atualizar(t)
        return malhasDoFundo(a.scene).map((m) => m.material.map?.offset.y ?? 0)
      }
      const comeco = offsets(0)
      const fim = offsets(R.duracao)
      expect(geometrias(a)).toEqual(antes)
      malhasDoFundo(a.scene).forEach((m, i) => {
        const andou = Math.abs(fim[i] - comeco[i])
        if (m.name.startsWith('paisagem-fumaca')) {
          expect(andou).toBeGreaterThan(0)
          expect(andou).toBeLessThan(0.6)
        } else expect(andou).toBe(0)
      })
      a.descartar()
      b.descartar()
    })

    it('descartar libera toda geometria, material e textura do fundo (todas pintadas em canvas)', () => {
      const cena = criar(THREE, { reduzirMovimento: false })
      const liberados = new Set<object>()
      const vigiar = (alvo: { dispose: () => void }) => {
        const original = alvo.dispose.bind(alvo)
        alvo.dispose = () => {
          liberados.add(alvo)
          original()
        }
        return alvo
      }
      const recursos = new Set<{ dispose: () => void }>()
      for (const m of malhasDoFundo(cena.scene)) {
        recursos.add(m.geometry)
        recursos.add(m.material)
        for (const tex of [m.material.map, m.material.alphaMap]) {
          if (!tex) continue
          expect((tex as THREE.CanvasTexture).isCanvasTexture).toBe(true)
          recursos.add(tex)
        }
      }
      expect(recursos.size).toBeGreaterThan(6)
      for (const r of recursos) vigiar(r)
      cena.descartar()
      expect([...recursos].filter((r) => !liberados.has(r))).toEqual([])
    })
  })
}

describe('Campo ensolarado: vila sem muro (pedido de 27/10/2026)', () => {
  /** A fileira da frente do casario começa em z = -126 (beiral a -125,6); o muro ficava em -122. */
  const FRENTE_DO_CASARIO = -125
  /** A fachada mais comprida do casario (os dois salões de quatro águas): 18 m. Um muro passava de 20. */
  const MAIOR_FACHADA = 18

  it('nada em pé entre a estrada e o casario: nem muro, nem guarita, nem portão', () => {
    const cena = criarVila(THREE, { reduzirMovimento: false })
    const naFrente = triangulosDoFundo(cena.scene).filter((t) => emPe(t) && Math.max(...t.map((v) => v.z)) > FRENTE_DO_CASARIO)
    expect(naFrente).toEqual([])
    cena.descartar()
  })

  it('nenhuma parede mais comprida que a maior fachada, e nenhuma malha de muro ou portão', () => {
    const cena = criarVila(THREE, { reduzirMovimento: false })
    const comprimento = (t: [THREE.Vector3, THREE.Vector3, THREE.Vector3]) =>
      Math.max(...t.flatMap((a) => t.map((b) => Math.hypot(a.x - b.x, a.z - b.z))))
    const maior = Math.max(...triangulosDoFundo(cena.scene).filter(emPe).map(comprimento))
    expect(maior).toBeGreaterThan(MAIOR_FACHADA - 0.01)
    expect(maior).toBeLessThan(MAIOR_FACHADA + 0.01)
    const nomes = malhasDoFundo(cena.scene).map((m) => m.name)
    expect(nomes.filter((n) => /muro|portao|guarita|tabuasEmPe/.test(n))).toEqual([])
    cena.descartar()
  })
})

describe('Campo ensolarado (aprovada) depois da divisão', () => {
  it('não ganhou fundo nenhum', () => {
    const cena = criarOriginal(THREE, { reduzirMovimento: false })
    expect(malhasDoFundo(cena.scene)).toHaveLength(0)
    expect(cena.scene.getObjectByName('paisagem-tres-casas')).toBeUndefined()
    expect(cena.scene.getObjectByName('paisagem-vila')).toBeUndefined()
    cena.descartar()
  })
})
