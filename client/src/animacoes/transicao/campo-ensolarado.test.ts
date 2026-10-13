import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import type { KitDeSom } from '../../transicoes/tipos'
import criar, { momentoDoPasso, ROTEIRO_DO_CAMPO as R } from './campo-ensolarado'
import meta from './campo-ensolarado.json'

/**
 * O movimento do "Campo ensolarado" (transição do pacote): anda pela estrada
 * com o balanço do passo, para, ergue o olhar ao sol e o sol cresce até o
 * branco; o preto do fim é o fade devolvido ao motor.
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
  x: number
  y: number
  z: number
  rolagem: number
  inclinacao: number
  fade: number
  /** Opacidade do plano branco dentro da cena (0 quando escondido). */
  branco: number
  raios: number
  giroDosRaios: number
}

/** Uma cena aberta, lida pelo que o motor vê: câmera, o plano branco, os raios do sol e o fade devolvido. */
function abrir(reduzirMovimento: boolean) {
  const cena = criar(THREE, { reduzirMovimento })
  cena.ajustarTela(16 / 9)
  const branco = cena.scene.getObjectByName('branco') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | undefined
  const raios = cena.scene.getObjectByName('raios') as THREE.Sprite | undefined
  if (!branco || !raios) throw new Error('cena sem "branco" ou sem "raios"')
  return {
    em(t: number): Amostra {
      const { fade } = cena.atualizar(t)
      const { position, rotation } = cena.camera
      return {
        t,
        x: position.x,
        y: position.y,
        z: position.z,
        rolagem: rotation.z,
        inclinacao: rotation.x,
        fade,
        branco: branco.visible ? branco.material.opacity : 0,
        raios: raios.material.opacity,
        giroDosRaios: raios.material.rotation,
      }
    },
    fechar: () => cena.descartar(),
  }
}

/** Roda a cena de 0,01 em 0,01 s, como o motor faria. */
function amostrar(reduzirMovimento: boolean): Amostra[] {
  const cena = abrir(reduzirMovimento)
  const amostras = Array.from({ length: Math.round(R.duracao * 100) + 1 }, (_, i) => cena.em(i / 100))
  cena.fechar()
  return amostras
}

const NORMAL = amostrar(false)
const REDUZIDO = amostrar(true)
const entre = (amostras: Amostra[], de: number, ate: number) => amostras.filter((a) => a.t >= de - 1e-9 && a.t <= ate + 1e-9)
const em = (amostras: Amostra[], t: number) => amostras[Math.round(t * 100)]

/**
 * Contexto de áudio de mentira: cada nó aceita tudo, o `start` de um grão de
 * passo (buffer criado pela cena) anota o instante. O relógio anda com o tempo
 * da cena, como no motor.
 */
function kitFalso() {
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
  return {
    kit,
    passos,
    avancar: (t: number) => {
      agora = t
    },
  }
}

describe('Campo ensolarado', () => {
  it('a meta bate com o roteiro, e a miniatura mostra a caminhada com a cena visível', () => {
    expect(meta.nome).toBe('Campo ensolarado')
    expect(meta.duracaoNaturalS).toBe(R.duracao)
    expect(meta.duracaoNaturalS).toBe(7)
    const miniatura = em(NORMAL, meta.quadroDaMiniaturaS)
    expect(miniatura.fade).toBe(0)
    expect(miniatura.branco).toBe(0)
    expect(miniatura.z).toBeLessThan(-1)
    expect(meta.quadroDaMiniaturaS).toBeLessThan(R.inicioDaFreada)
  })

  it('sai do preto já andando e termina no preto (fade 1 nas duas pontas)', () => {
    expect(NORMAL[0].fade).toBe(1)
    expect(em(NORMAL, R.duracao).fade).toBe(1)
    expect(em(NORMAL, 0.25).z).toBeLessThan(-0.3)
    for (const a of entre(NORMAL, R.fadeEntrada, R.inicioDoEscuro)) expect(a.fade).toBe(0)
    const saida = entre(NORMAL, R.inicioDoEscuro, R.duracao)
    for (let i = 1; i < saida.length; i++) expect(saida[i].fade).toBeGreaterThanOrEqual(saida[i - 1].fade)
  })

  it('o olhar só sobe depois de parar, e sobe sem tranco até o sol', () => {
    for (const a of entre(NORMAL, 0, R.parada - 0.01)) expect(a.inclinacao).toBeCloseTo(R.inclinacaoAndando, 12)
    const andando = entre(NORMAL, 0, R.parada)
    for (let i = 1; i < andando.length; i++) expect(andando[i].z).toBeLessThan(andando[i - 1].z)
    const parado = entre(NORMAL, R.parada, R.duracao)
    for (const a of parado) expect(a.z).toBeCloseTo(parado[0].z, 12)
    for (let i = 1; i < parado.length; i++) expect(parado[i].inclinacao).toBeGreaterThanOrEqual(parado[i - 1].inclinacao - 1e-12)
    // Começa e termina devagar: nos primeiros e últimos 50 ms quase não anda.
    expect(em(NORMAL, R.parada + 0.05).inclinacao - R.inclinacaoAndando).toBeLessThan(0.01)
    expect(R.inclinacaoFinal - em(NORMAL, R.fimDoOlhar - 0.05).inclinacao).toBeLessThan(0.01)
    expect(em(NORMAL, R.fimDoOlhar).inclinacao).toBeCloseTo(R.inclinacaoFinal, 9)
    // A freada também não tem tranco: o último centímetro leva mais de 0,1 s.
    const fim = em(NORMAL, R.parada).z
    const ultimoCentimetro = entre(NORMAL, R.inicioDaFreada, R.parada).filter((a) => a.z - fim < 0.01)
    expect(ultimoCentimetro.length).toBeGreaterThan(10)
  })

  it('o branco toma a tela no pico do sol, e o preto do fade vem por cima dele', () => {
    for (const a of entre(NORMAL, 0, R.inicioDoBranco)) expect(a.branco).toBe(0)
    for (const a of entre(NORMAL, R.brancoTotal, R.duracao)) expect(a.branco).toBe(1)
    for (const a of entre(NORMAL, R.brancoTotal, R.inicioDoEscuro)) expect(a.fade).toBe(0)
    const subida = entre(NORMAL, R.inicioDoBranco, R.brancoTotal)
    for (let i = 1; i < subida.length; i++) expect(subida[i].branco).toBeGreaterThanOrEqual(subida[i - 1].branco)
  })

  it('reduzir movimento: sem balanço, olhar mais curto e mais lento, raios sem piscar nem girar', () => {
    for (const a of REDUZIDO) {
      expect(Math.abs(a.x)).toBeLessThan(1e-12)
      expect(Math.abs(a.rolagem)).toBeLessThan(1e-12)
      expect(a.y).toBeCloseTo(R.olho, 12)
    }
    expect(Math.max(...NORMAL.map((a) => Math.abs(a.y - R.olho)))).toBeGreaterThan(0.01)
    const finalNormal = em(NORMAL, R.duracao).inclinacao
    const finalReduzido = em(REDUZIDO, R.duracao).inclinacao
    expect(finalReduzido).toBeLessThan(finalNormal - 0.08)
    const chegou = (amostras: Amostra[], alvo: number) => amostras.find((a) => a.inclinacao >= alvo - 0.002)?.t ?? Infinity
    expect(chegou(REDUZIDO, finalReduzido)).toBeGreaterThan(chegou(NORMAL, finalNormal) + 0.3)
    const clarao = entre(REDUZIDO, R.parada, R.brancoTotal)
    for (let i = 1; i < clarao.length; i++) {
      expect(clarao[i].raios).toBeGreaterThanOrEqual(clarao[i - 1].raios - 1e-12)
      expect(clarao[i].giroDosRaios).toBe(clarao[0].giroDosRaios)
    }
    // Sem reduzir, os raios tremem (o teste acima pegaria o pisca).
    const normal = entre(NORMAL, R.fimDoOlhar, R.brancoTotal)
    expect(normal.some((a, i) => i > 0 && a.raios < normal[i - 1].raios)).toBe(true)
  })

  it('cada passo soa no instante em que o pé assenta, no vale do balanço, e nenhum depois de parar', () => {
    const { kit, passos, avancar } = kitFalso()
    const cena = criar(THREE, { reduzirMovimento: false })
    const pistas = cena.criarSom?.(kit)
    if (!pistas) throw new Error('cena sem som')
    for (let i = 0; i <= R.duracao * 100; i++) {
      avancar(i / 100)
      cena.atualizar(i / 100)
      pistas.atualizar(i / 100)
    }
    expect(passos).toHaveLength(R.passos)
    passos.forEach((t, i) => {
      // O motor dispara a pista no primeiro quadro depois do apoio.
      expect(t - momentoDoPasso(i + 1)).toBeGreaterThanOrEqual(0)
      expect(t - momentoDoPasso(i + 1)).toBeLessThan(0.0101)
    })
    expect(Math.max(...passos)).toBeLessThan(R.parada)
    const leitor = abrir(false)
    for (let k = 1; k <= R.passos; k++) {
      const apoio = momentoDoPasso(k)
      const yNoApoio = leitor.em(apoio).y
      const vizinhos = Array.from({ length: 25 }, (_, j) => leitor.em(apoio - 0.12 + j * 0.01).y)
      expect(yNoApoio - Math.min(...vizinhos)).toBeLessThan(0.0015)
      if (k < R.passos) expect(yNoApoio).toBeCloseTo(R.olho - R.balancoVertical, 9)
    }
    leitor.fechar()
    // Recomeçar (a prévia em repetição) toca os passos de novo.
    pistas.reiniciar()
    avancar(10)
    pistas.atualizar(1)
    expect(passos.length).toBeGreaterThan(R.passos)
    cena.descartar()
  })
})
