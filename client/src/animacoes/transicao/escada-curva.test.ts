import * as THREE from 'three'
import { afterAll, describe, expect, it } from 'vitest'
import type { CriarCena, KitDeSom } from '../../transicoes/tipos'
import criarSubindo from './escada-curva'
import metaSubindo from './escada-curva.json'
import criarDescendo from './escada-curva-descendo'
import metaDescendo from './escada-curva-descendo.json'
import { curvaDoTeto, instantesDasPisadas, JOELHO_DO_TETO, ROTEIRO_ESCADA_CURVA as R, TETO_DO_SOM } from './_escadaCurva'

/**
 * A "Escada curva" (subindo e descendo, transições do pacote): a câmera vence
 * um degrau por passo, o rumo gira com a curva (para a esquerda subindo, para
 * a direita descendo), a porta azul só existe lá embaixo e o passo soa uma vez
 * por pisada, no instante em que o pé assenta.
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
  y: number
  /** Distância da câmera ao centro da curva. */
  raio: number
  rumo: number
  inclinacao: number
  rolagem: number
  fade: number
}

function abrir(criar: CriarCena, reduzirMovimento: boolean) {
  const cena = criar(THREE, { reduzirMovimento })
  return {
    cena,
    em(t: number): Amostra {
      const { fade } = cena.atualizar(t)
      const { position: p, rotation: r } = cena.camera
      return { t, y: p.y, raio: Math.hypot(p.x, p.z), rumo: r.y, inclinacao: r.x, rolagem: r.z, fade }
    },
    fechar: () => cena.descartar(),
  }
}

const QUADRO = 1 / 60
const DURACAO = R.duracaoS

function amostrar(criar: CriarCena, reduzirMovimento: boolean): Amostra[] {
  const aberta = abrir(criar, reduzirMovimento)
  const n = Math.round(DURACAO / QUADRO)
  const lista = Array.from({ length: n + 1 }, (_, i) => aberta.em(Math.min(DURACAO, i * QUADRO)))
  aberta.fechar()
  return lista
}

/** Um contexto de áudio de mentira: registra cada ruído pedido ao kit (o estalo do salto é o de 0,12 s). */
function kitFalso() {
  let agora = 0
  const ruidos: { em: number; duracao: number }[] = []
  const parametro = () => ({
    value: 0,
    setValueAtTime: () => undefined,
    linearRampToValueAtTime: () => undefined,
    exponentialRampToValueAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  })
  const ligadosAoDestino: string[] = []
  const saidaDoKit = { saidaDoKit: true }
  const no = (tipo = '') => ({
    tipo,
    connect: <T>(destino: T) => {
      if (destino === saidaDoKit) ligadosAoDestino.push(tipo)
      return destino
    },
    start: () => undefined,
    stop: () => undefined,
    gain: parametro(),
    frequency: parametro(),
    Q: parametro(),
    pan: parametro(),
    delayTime: parametro(),
    threshold: parametro(),
    knee: parametro(),
    ratio: parametro(),
    attack: parametro(),
    release: parametro(),
    buffer: null as unknown,
    type: '',
  })
  const ctx = new Proxy(
    {},
    {
      get: (_alvo, chave) => {
        if (chave === 'currentTime') return agora
        if (chave === 'sampleRate') return 8000
        if (chave === 'createBuffer') return (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) })
        return () => no(String(chave))
      },
    },
  )
  const ruido = (duracao: number) => {
    ruidos.push({ em: agora, duracao })
    return {} as AudioBuffer
  }
  const kit: KitDeSom = { ctx: ctx as unknown as AudioContext, destino: saidaDoKit as unknown as AudioNode, ruido }
  return {
    kit,
    ruidos,
    ligadosAoDestino,
    avancar: (t: number) => {
      agora = t
    },
  }
}

const SENTIDOS = [
  { nome: 'subindo', criar: criarSubindo, meta: metaSubindo, sinal: 1 },
  { nome: 'descendo', criar: criarDescendo, meta: metaDescendo, sinal: -1 },
] as const

const GRAUS_40 = (40 * Math.PI) / 180
const RAIO_DO_OLHO = { subindo: R.raioAndar + R.afastamentoDoOlho[1], descendo: R.raioAndar + R.afastamentoDoOlho[-1] }

describe.each(SENTIDOS)('escada curva $nome', ({ nome, criar, meta, sinal }) => {
  const quadros = amostrar(criar, false)
  const primeiro = quadros[0]
  const ultimo = quadros[quadros.length - 1]

  it('o .json traz a duração do roteiro e um quadro de miniatura dentro dela', () => {
    expect(meta.duracaoNaturalS).toBeCloseTo(R.duracaoS, 5)
    expect(meta.quadroDaMiniaturaS).toBeGreaterThan(R.fadeEntradaS)
    expect(meta.quadroDaMiniaturaS).toBeLessThan(R.fadeSaidaInicioS)
  })

  it('abre e fecha no preto (fade 1) e fica visível no meio (fade 0)', () => {
    expect(primeiro.fade).toBe(1)
    expect(ultimo.fade).toBeCloseTo(1, 5)
    const meio = quadros.find((q) => q.t >= DURACAO / 2)
    expect(meio?.fade).toBe(0)
  })

  it(`${nome === 'subindo' ? 'sobe' : 'desce'} 1,6 m (oito espelhos de 20 cm) sem nunca voltar atrás`, () => {
    expect(ultimo.y - primeiro.y).toBeCloseTo(sinal * 8 * R.espelho, 3)
    for (let i = 1; i < quadros.length; i++) expect(sinal * (quadros[i].y - quadros[i - 1].y)).toBeGreaterThanOrEqual(-1e-9)
  })

  it('o rumo gira mais de 40° com a curva, para o lado certo (esquerda subindo, direita descendo)', () => {
    const giro = ultimo.rumo - primeiro.rumo
    expect(sinal * giro).toBeGreaterThan(GRAUS_40)
    // Gira sempre para o mesmo lado: a curva não volta.
    for (let i = 1; i < quadros.length; i++) expect(sinal * (quadros[i].rumo - quadros[i - 1].rumo)).toBeGreaterThanOrEqual(-1e-9)
  })

  it('um degrau por passo: dois passos no patamar, depois um espelho a cada passo', () => {
    const y0 = primeiro.y
    const aberta = abrir(criar, false)
    for (let k = 0; k < R.totalPassos; k++) {
      // Fim do passo k: o corpo já parou no degrau seguinte.
      const t = R.inicioAndarS + (k + 1) * R.durPassoS - 0.01
      const degraus = Math.max(0, k + 1 - R.passosNoPatamar)
      expect(aberta.em(t).y - y0).toBeCloseTo(sinal * degraus * R.espelho, 4)
    }
    aberta.fechar()
  })

  it('a 60 quadros por segundo nada salta de um quadro para o outro', () => {
    let maiorY = 0
    let maiorRaio = 0
    let maiorRumo = 0
    let maiorInclinacao = 0
    let maiorRolagem = 0
    for (let i = 1; i < quadros.length; i++) {
      const [a, b] = [quadros[i - 1], quadros[i]]
      maiorY = Math.max(maiorY, Math.abs(b.y - a.y))
      maiorRaio = Math.max(maiorRaio, Math.abs(b.raio - a.raio))
      maiorRumo = Math.max(maiorRumo, Math.abs(b.rumo - a.rumo))
      maiorInclinacao = Math.max(maiorInclinacao, Math.abs(b.inclinacao - a.inclinacao))
      maiorRolagem = Math.max(maiorRolagem, Math.abs(b.rolagem - a.rolagem))
    }
    expect(maiorY).toBeLessThan(0.02)
    expect(maiorRaio).toBeLessThan(0.005)
    expect(maiorRumo).toBeLessThan(0.01)
    expect(maiorInclinacao).toBeLessThan(0.01)
    expect(maiorRolagem).toBeLessThan(0.003)
  })

  it('com "reduzir movimento" não há balanço nem rolagem, e a altura segue a rampa', () => {
    const calmos = amostrar(criar, true)
    for (const q of calmos) {
      // Descendo, o espelho do sentido dá -0: zero do mesmo jeito.
      expect(Math.abs(q.rolagem)).toBe(0)
      expect(q.raio).toBeCloseTo(RAIO_DO_OLHO[nome], 6)
    }
    const fim = calmos[calmos.length - 1]
    expect(fim.y - calmos[0].y).toBeCloseTo(sinal * 8 * R.espelho, 3)
  })

  it('tem a parede de pedra; a porta azul só existe lá embaixo, na descida', () => {
    const aberta = abrir(criar, false)
    expect(aberta.cena.scene.getObjectByName('parede')).toBeDefined()
    expect(aberta.cena.scene.getObjectByName('arandela-0')).toBeDefined()
    expect(aberta.cena.scene.getObjectByName('porta') !== undefined).toBe(nome === 'descendo')
    aberta.fechar()
  })

  it('o passo soa dez vezes, cada uma no quadro em que o pé assenta', () => {
    const aberta = abrir(criar, false)
    const { kit, ruidos, avancar } = kitFalso()
    const som = aberta.cena.criarSom?.(kit)
    expect(som).toBeDefined()
    const n = Math.round(DURACAO / QUADRO)
    for (let i = 0; i <= n; i++) {
      const t = i * QUADRO
      avancar(t)
      som?.atualizar(t)
    }
    const saltos = ruidos.filter((r) => r.duracao === 0.12).map((r) => r.em)
    const esperados = instantesDasPisadas()
    expect(saltos).toHaveLength(R.totalPassos)
    for (const [k, em] of saltos.entries()) {
      expect(em).toBeGreaterThanOrEqual(esperados[k] - 1e-9)
      expect(em - esperados[k]).toBeLessThan(QUADRO + 1e-9)
    }
    // Ritmo constante: o mesmo intervalo entre todas as pisadas.
    for (let k = 1; k < esperados.length; k++) expect(esperados[k] - esperados[k - 1]).toBeCloseTo(R.durPassoS, 9)
    aberta.fechar()
  })
})

/**
 * O teto do som. O compressor sozinho deixava o pico verdadeiro variar de -1,8
 * a +0,7 dBTP entre renders (o ruído do kit muda a cada render); a curva fixa
 * no fim da cadeia garante que nenhuma amostra passe de TETO_DO_SOM. O pico
 * verdadeiro e o volume (LUFS) só se medem renderizando: scripts/conferir-som.cjs.
 */
describe('escada curva: teto do som', () => {
  const curva = curvaDoTeto(4097)

  it('o teto fica abaixo de -3 dBFS, folga para o pico verdadeiro não passar de -1 dBTP', () => {
    expect(20 * Math.log10(TETO_DO_SOM)).toBeLessThan(-3)
    let maior = 0
    for (const v of curva) maior = Math.max(maior, Math.abs(v))
    expect(maior).toBeLessThan(TETO_DO_SOM)
  })

  it('abaixo do joelho o som passa intacto; acima, sobe sempre, sem degrau (sem clique)', () => {
    for (let i = 0; i < curva.length; i++) {
      const x = (i / (curva.length - 1)) * 2 - 1
      if (Math.abs(x) <= JOELHO_DO_TETO) expect(curva[i]).toBeCloseTo(x, 6)
      if (i > 0) {
        expect(curva[i]).toBeGreaterThanOrEqual(curva[i - 1])
        // Passo da curva nunca maior que o passo da entrada: derivada <= 1.
        expect(curva[i] - curva[i - 1]).toBeLessThanOrEqual(2 / (curva.length - 1) + 1e-6)
      }
    }
    // Simétrica: o lado negativo é o espelho do positivo.
    for (let i = 0; i < curva.length; i++) expect(curva[i]).toBeCloseTo(-curva[curva.length - 1 - i], 6)
  })

  it.each(SENTIDOS)('$nome: tudo sai pelo teto, nada chega à saída por fora dele', ({ criar }) => {
    const aberta = abrir(criar, false)
    const { kit, ligadosAoDestino } = kitFalso()
    aberta.cena.criarSom?.(kit)
    expect(ligadosAoDestino).toEqual(['createWaveShaper'])
    aberta.fechar()
  })
})
