import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import type { CriarCena, KitDeSom } from '../../transicoes/tipos'
import criarSubindo from './escada-madeira'
import metaSubindo from './escada-madeira.json'
import criarDescendo from './escada-madeira-descendo'
import metaDescendo from './escada-madeira-descendo.json'
import { momentoDoApoio, ROTEIRO_DA_ESCADA_DE_MADEIRA as R } from './_escadaMadeira'

/**
 * O ritmo da "Escada de madeira" (subindo e descendo, transições do pacote):
 * o molde da escadaria de pedra, com a câmera vencendo um degrau por passo,
 * o peso assentando no apoio do pé e a passada na tábua nesse mesmo instante (só a passada, sem rangido).
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
  /** Fator da chama do lampião (1 = luz parada). */
  luz: number
  fade: number
}

/** Uma cena aberta, lida pelo que o motor vê: câmera, luz do lampião e o fade devolvido. */
function abrir(criar: CriarCena, reduzirMovimento: boolean) {
  const cena = criar(THREE, { reduzirMovimento })
  const luz = cena.scene.getObjectByName('lampiao') as THREE.SpotLight | undefined
  if (!luz) throw new Error('cena sem "lampiao"')
  const corBase = luz.color.r
  return {
    em(t: number): Amostra {
      const { fade } = cena.atualizar(t)
      const { position, rotation } = cena.camera
      return { t, x: position.x, y: position.y, z: position.z, rolagem: rotation.z, luz: luz.color.r / corBase, fade }
    },
    fechar: () => cena.descartar(),
  }
}

/** Roda a cena de 0,01 em 0,01 s, como o motor faria. */
function amostrar(criar: CriarCena, reduzirMovimento: boolean): Amostra[] {
  const cena = abrir(criar, reduzirMovimento)
  const amostras = Array.from({ length: Math.round(R.fim * 100) + 1 }, (_, i) => cena.em(i / 100))
  cena.fechar()
  return amostras
}

const entre = (amostras: Amostra[], de: number, ate: number) => amostras.filter((a) => a.t >= de - 1e-9 && a.t <= ate + 1e-9)
const inicioDoPasso = (k: number) => R.inicioDaCaminhada + k * R.duracaoDoPasso

/** Um `setTargetAtTime` pedido pela cena: o volume corre para `alvo` a partir de `em`. */
interface AlvoFalso {
  alvo: number
  em: number
  constante: number
}

/**
 * O valor de um parâmetro no instante `t`, refazendo a curva do Web Audio:
 * a cada `setTargetAtTime` ele se aproxima do alvo com e^(-Δt/constante).
 */
function valorDoParametro(alvos: AlvoFalso[], t: number): number {
  let [valor, alvo, desde, constante] = [0, 0, 0, 1]
  for (const e of alvos) {
    if (e.em > t) break
    valor = alvo + (valor - alvo) * Math.exp(-(e.em - desde) / constante)
    ;[alvo, desde, constante] = [e.alvo, e.em, e.constante]
  }
  return alvo + (valor - alvo) * Math.exp(-(t - desde) / constante)
}

/** Um nó criado pelo som: de qual fábrica do contexto veio e o que a cena ajustou nele. */
interface NoFalso {
  fabrica: string
  type?: string
  Q: { value: number }
  gain: { alvos: AlvoFalso[] }
  periodica: boolean
  parada?: number
}

/**
 * Contexto de áudio de mentira: cada nó aceita tudo, o `start` anota o instante
 * pedido e cada `createX` fica anotado em `nos` (é assim que o teste vê o que a
 * passada monta, e o que ela não monta mais: o rangido).
 */
function kitFalso() {
  let agora = 0
  const inicios: number[] = []
  const nos: NoFalso[] = []
  const ruidos: { em: number; duracao: number }[] = []
  const parametro = () => {
    const p = {
      value: 0,
      alvos: [] as AlvoFalso[],
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
      setTargetAtTime: (alvo: number, em: number, constante: number) => {
        p.alvos.push({ alvo, em, constante })
      },
    }
    return p
  }
  const no = (fabrica: string) => {
    const criado = {
      fabrica,
      periodica: false,
      parada: undefined as number | undefined,
      connect: <T>(destino: T) => destino,
      start: (quando?: number) => {
        inicios.push(quando ?? agora)
      },
      stop: (quando?: number) => {
        criado.parada = quando ?? agora
      },
      setPeriodicWave: () => {
        criado.periodica = true
      },
      gain: parametro(),
      frequency: parametro(),
      Q: parametro(),
      delayTime: parametro(),
    }
    nos.push(criado)
    return criado
  }
  const ctx = new Proxy({}, { get: (_alvo, chave) => (chave === 'currentTime' ? agora : () => no(String(chave))) })
  const ruido = (duracao: number) => {
    ruidos.push({ em: agora, duracao })
    return {} as AudioBuffer
  }
  const kit: KitDeSom = { ctx: ctx as unknown as AudioContext, destino: no('destino') as unknown as AudioNode, ruido }
  return {
    kit,
    inicios,
    nos: nos as NoFalso[],
    ruidos,
    avancar: (t: number) => {
      agora = t
    },
  }
}

const SENTIDOS = [
  ['subindo', criarSubindo, 1],
  ['descendo', criarDescendo, -1],
] as const

describe('Escada de madeira', () => {
  it('as metas batem com o roteiro: a mesma duração da pedra e a miniatura com a cena visível', () => {
    expect(metaSubindo.nome).toBe('Escada de madeira subindo')
    expect(metaDescendo.nome).toBe('Escada de madeira descendo')
    for (const [meta, criar] of [
      [metaSubindo, criarSubindo],
      [metaDescendo, criarDescendo],
    ] as const) {
      expect(meta.duracaoNaturalS).toBe(R.fim)
      expect(meta.duracaoNaturalS).toBe(11.7)
      const cena = abrir(criar, false)
      expect(cena.em(meta.quadroDaMiniaturaS).fade).toBe(0)
      cena.fechar()
    }
  })

  it.each(SENTIDOS)('%s: 2 passos no patamar e depois um degrau por passo, sempre no mesmo sentido', (_nome, criar, sentido) => {
    const cena = abrir(criar, false)
    const marcos = Array.from({ length: R.passos + 1 }, (_, k) => cena.em(inicioDoPasso(k)))
    cena.fechar()
    for (let k = 0; k < R.passos; k++) {
      expect(marcos[k + 1].y - marcos[k].y).toBeCloseTo(k < R.passosNoPatamar ? 0 : sentido * R.espelho, 6)
      expect(marcos[k + 1].z - marcos[k].z).toBeCloseTo(-R.piso, 6)
    }
    expect(marcos[R.passos].y - marcos[0].y).toBeCloseTo(sentido * (R.passos - R.passosNoPatamar) * R.espelho, 6)
  })

  it.each(SENTIDOS)('%s: o peso assenta logo depois do apoio do pé (é aí que soa a passada) e não afunda mais que o assento', (_nome, criar) => {
    const amostras = amostrar(criar, false)
    for (let k = 0; k < R.passos; k++) {
      const apoio = momentoDoApoio(k)
      const noApoio = amostras[Math.round(apoio * 100)]
      const fundo = Math.min(...entre(amostras, apoio, apoio + 0.4).map((a) => a.y))
      expect(noApoio.y - fundo).toBeGreaterThan(0.02)
      expect(noApoio.y - fundo).toBeLessThanOrEqual(R.assento)
    }
  })

  it.each(SENTIDOS)('%s: balanço regular, o lado troca a cada passo, com a mesma amplitude e o pico no meio do passo', (_nome, criar) => {
    const amostras = amostrar(criar, false)
    const picos = Array.from({ length: R.passos }, (_, k) =>
      entre(amostras, inicioDoPasso(k), inicioDoPasso(k + 1)).reduce((maior, a) => (Math.abs(a.x) > Math.abs(maior.x) ? a : maior)),
    )
    picos.forEach((pico, k) => {
      expect(Math.sign(pico.x)).toBe(k % 2 === 0 ? 1 : -1)
      expect(Math.sign(pico.rolagem)).toBe(Math.sign(pico.x))
      expect(Math.abs(pico.x)).toBeCloseTo(Math.abs(picos[0].x), 3)
      expect(pico.t).toBeCloseTo(inicioDoPasso(k) + R.duracaoDoPasso / 2, 1)
    })
  })

  it.each(SENTIDOS)('%s, reduzir movimento: sem balanço, sem sobe-e-desce e sem tremer a chama; a câmera só segue em frente', (_nome, criar, sentido) => {
    const reduzido = amostrar(criar, true)
    reduzido.forEach((a, i) => {
      expect(a.x).toBe(0)
      expect(a.rolagem).toBe(0)
      expect(a.luz).toBe(1)
      if (i === 0) return
      expect(a.z).toBeLessThanOrEqual(reduzido[i - 1].z + 1e-12)
      expect(sentido * (a.y - reduzido[i - 1].y)).toBeGreaterThanOrEqual(-1e-12)
    })
    const normal = amostrar(criar, false)
    expect(reduzido[reduzido.length - 1].y).toBeCloseTo(normal[normal.length - 1].y, 6)
    expect(reduzido[reduzido.length - 1].z).toBeCloseTo(normal[normal.length - 1].z, 6)
  })

  it('a chama do lampião treme de verdade, mas pouco, e nunca apaga', () => {
    const luzes = amostrar(criarSubindo, false).map((a) => a.luz)
    expect(Math.min(...luzes)).toBeGreaterThan(0.8)
    expect(Math.max(...luzes)).toBeLessThan(1.2)
    expect(Math.max(...luzes) - Math.min(...luzes)).toBeGreaterThan(0.1)
  })

  it.each(SENTIDOS)('%s: preto nas pontas, a cena inteira visível no meio', (_nome, criar) => {
    const amostras = amostrar(criar, false)
    expect(amostras[0].fade).toBe(1)
    expect(amostras[amostras.length - 1].fade).toBe(1)
    for (const a of entre(amostras, R.fadeEntradaFim, R.fadeSaidaInicio)) expect(a.fade).toBe(0)
  })

  it.each(SENTIDOS)('%s: nada salta entre quadros: câmera, giro, luz e cortina andam aos poucos', (_nome, criar) => {
    // A 0,01 s por amostra: 2 cm de câmera (2 m/s, bem acima do passo), 0,01 rad de giro,
    // 5% de chama e 1,5% de cortina (o fade mais curto, 1,1 s, anda 0,9% por amostra).
    const amostras = amostrar(criar, false)
    for (let i = 1; i < amostras.length; i++) {
      const [a, b] = [amostras[i - 1], amostras[i]]
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.02)
      expect(Math.abs(b.rolagem - a.rolagem)).toBeLessThan(0.01)
      expect(Math.abs(b.luz - a.luz)).toBeLessThan(0.05)
      expect(Math.abs(b.fade - a.fade)).toBeLessThan(0.015)
    }
  })

  it.each(SENTIDOS)('%s: a cortina só abre no começo e só fecha no fim, sem piscar no meio', (_nome, criar) => {
    const amostras = amostrar(criar, false)
    for (let i = 1; i < amostras.length; i++) {
      const delta = amostras[i].fade - amostras[i - 1].fade
      if (amostras[i].t <= R.fadeEntradaFim) expect(delta).toBeLessThanOrEqual(1e-12)
      else expect(delta).toBeGreaterThanOrEqual(-1e-12)
    }
  })

  it.each(SENTIDOS)('%s: cada passo dispara só a passada (batida + estalo) no apoio do pé, nem antes nem depois, nenhum rangido, e o ar sai antes da cortina', (_nome, criar) => {
    const cena = criar(THREE, { reduzirMovimento: false })
    const { kit, inicios, nos, ruidos, avancar } = kitFalso()
    const som = cena.criarSom?.(kit)
    if (!som) throw new Error('cena sem som')
    const quadro = 1 / 60
    const volta = () => {
      const disparos: { t: number; inicios: number[]; nos: NoFalso[] }[] = []
      for (let i = 0; i * quadro <= R.fim; i++) {
        const t = i * quadro
        avancar(t)
        const [antes, nosAntes] = [inicios.length, nos.length]
        som.atualizar(t)
        // O ar da casa liga no primeiro quadro; passo nenhum cai no t = 0.
        if (inicios.length > antes && t > 0) disparos.push({ t, inicios: inicios.slice(antes), nos: nos.slice(nosAntes) })
      }
      return disparos
    }
    const primeira = volta()
    // O ar da casa: o único volume que a cena conduz por setTargetAtTime. Lido só na 1ª volta (o tempo recomeça na 2ª).
    const comAlvo = nos.filter((n) => n.gain.alvos.length > 0)
    expect(comAlvo).toHaveLength(1)
    const alvosDoAr = [...comAlvo[0].gain.alvos]
    const arEm = (t: number) => valorDoParametro(alvosDoAr, t)
    const arNoMeio = arEm(R.fim / 2)
    // O ar existe de verdade no meio (não passa por estar mudo) ...
    expect(arNoMeio).toBeGreaterThan(0.1)
    // ... e sai antes da cortina: 30 dB abaixo do próprio nível 0,15 s antes do motor fechar o áudio,
    // 40 dB abaixo no fim. Sem a antecipação ele ainda estaria a ~-15 dB ali, e o motor o cortaria seco.
    expect(arEm(R.fim - 0.15) / arNoMeio, `ar a ${(R.fim - 0.15).toFixed(2)} s`).toBeLessThan(10 ** (-30 / 20))
    expect(arEm(R.fim) / arNoMeio, `ar no fim, ${R.fim.toFixed(2)} s`).toBeLessThan(10 ** (-40 / 20))
    for (const disparos of [primeira, (som.reiniciar(), volta())]) {
      expect(disparos).toHaveLength(R.passos)
      disparos.forEach((d, k) => {
        expect(d.t).toBeGreaterThanOrEqual(momentoDoApoio(k) - 1e-9)
        expect(d.t).toBeLessThanOrEqual(momentoDoApoio(k) + quadro + 1e-9)
        // Só a passada: a batida (1 oscilador) e o estalo (1 ruído), os dois no instante do apoio.
        expect(d.inicios).toEqual([d.t, d.t])
        expect(d.nos.filter((n) => n.fabrica === 'createOscillator')).toHaveLength(1)
        expect(d.nos.filter((n) => n.fabrica === 'createBufferSource')).toHaveLength(1)
        // O rangido era um trem de pulsos (onda periódica) em passa-faixas estreitos (Q 8 a 11).
        expect(d.nos.some((n) => n.periodica)).toBe(false)
        const filtros = d.nos.filter((n) => n.fabrica === 'createBiquadFilter')
        expect(filtros).toHaveLength(1)
        for (const f of filtros) expect(f.Q.value).toBeLessThan(3)
      })
    }
    expect(nos.some((n) => n.fabrica === 'createPeriodicWave')).toBe(false)
    // O fim chega a silêncio: o último som do último passo acaba bem antes do motor fechar o áudio.
    const ultimaParada = Math.max(...nos.map((n) => n.parada ?? 0), ...ruidos.map((r) => r.em + r.duracao))
    expect(ultimaParada).toBeLessThan(R.fim - 0.2)
    cena.descartar()
  })

  it('metas fixas, escritas à mão (não saem do roteiro): 10 apoios em 1,651 + k·1,05 s e o lance vence pelo menos 8 × 0,18 m', () => {
    expect(R.passos).toBe(10)
    for (let k = 0; k < 10; k++) expect(momentoDoApoio(k)).toBeCloseTo(1.651 + k * 1.05, 6)
    for (const [criar, sentido] of [
      [criarSubindo, 1],
      [criarDescendo, -1],
    ] as const) {
      const amostras = amostrar(criar, false)
      const [primeira, ultima] = [amostras[0], amostras[amostras.length - 1]]
      expect(sentido * (ultima.y - primeira.y)).toBeGreaterThanOrEqual(8 * 0.18)
      expect(ultima.z).toBeLessThan(primeira.z - 9 * 0.25)
    }
  })

  it.each(SENTIDOS)('%s: paredes de madeira dos dois lados ao longo de todo o caminho da câmera (THREE real)', (_nome, criar) => {
    const cena = criar(THREE, { reduzirMovimento: false })
    const amostras = amostrar(criar, false)
    const zs = amostras.map((a) => a.z)
    const ys = amostras.map((a) => a.y)
    const [zMin, zMax, yMin, yMax] = [Math.min(...zs), Math.max(...zs), Math.min(...ys), Math.max(...ys)]
    cena.scene.updateMatrixWorld(true)
    const caixas: THREE.Box3[] = []
    cena.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) caixas.push(new THREE.Box3().setFromObject(o))
    })
    for (const lado of [-1, 1]) {
      // Uma parede: chapa inteira além de 0,7 m do eixo, cobrindo o caminho todo em z e a altura do olho.
      const parede = caixas.find(
        (c) =>
          (lado === 1 ? c.min.x > 0.7 : c.max.x < -0.7) &&
          c.min.z <= zMin &&
          c.max.z >= zMax &&
          c.min.y <= yMin &&
          c.max.y >= yMax,
      )
      expect(parede, `parede do lado ${lado}`).toBeDefined()
    }
    cena.descartar()
  })
})
