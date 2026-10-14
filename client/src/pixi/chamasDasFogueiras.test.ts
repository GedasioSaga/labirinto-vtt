import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Ticker } from 'pixi.js'
import {
  CICLO_DA_CHAMA_MS,
  createChamasDasFogueiras,
  faseDaFogueira,
  POSE_FIXA,
  poseDaChama,
  sincronizarChamas,
  type EstadoDasChamas,
  type PoseDaChama,
} from './chamasDasFogueiras'
import { createPropsRenderer } from './drawProps'
import { chamaDaFogueira } from '../lib/mobilia'
import type { Prop } from '../types/map'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `mocked://${path}`,
}))

/**
 * A CHAMA DAS FOGUEIRAS: a pose pura (faixas, período, sem salto na virada,
 * parada com menos movimento), o relógio que só roda com fogueira e movimento
 * normal, a chama que some com o móvel e que não gira com ele.
 */

const TELA = { cameraScale: 1 }
const ZOOM_1 = { cameraScale: 1, rendererResolution: 1 }

function fogueira(extra: Partial<Prop> = {}): Prop {
  return { id: 'fogo-1', src: '', x: 200, y: 100, width: 64, height: 64, linkedMapPath: null, mobilia: 'fogueira', ...extra }
}

function palco(opcoes: { reduzido?: boolean } = {}) {
  const ticker = new Ticker()
  let agora = 1_000_000
  let reduzido = opcoes.reduzido ?? false
  const estados: EstadoDasChamas[] = []
  const chamas = createChamasDasFogueiras({
    movimento: { ticker, reducedMotion: () => reduzido, agora: () => agora },
    aoMudar: (estado) => estados.push(estado),
  })
  return {
    chamas,
    ticker,
    estados,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
    reduzir(valor: boolean) {
      reduzido = valor
    },
  }
}

/** O filho da chama com o rótulo pedido (falha alto se não houver). */
function parte(no: Container, rotulo: string): Graphics {
  const achado = no.children.find((c): c is Graphics => c instanceof Graphics && c.label === rotulo)
  if (achado === undefined) throw new Error(`a chama devia ter ${rotulo}`)
  return achado
}

function chamasNo(container: Container): Container[] {
  return container.children.filter((c) => c.label.startsWith('chama:'))
}

describe('poseDaChama — a pose pura', () => {
  /** A pose a cada `passoMs` num ciclo inteiro, fase 0. */
  function umCiclo(passoMs: number): PoseDaChama[] {
    const poses: PoseDaChama[] = []
    for (let t = 0; t < CICLO_DA_CHAMA_MS; t += passoMs) poses.push(poseDaChama(t, 0, false))
    return poses
  }

  it('escala e alpha nas faixas da ESPEC (medidas a cada 1 ms num ciclo)', () => {
    const poses = umCiclo(1)
    const faixa = (valores: number[]) => [Math.min(...valores), Math.max(...valores)]
    const [minY, maxY] = faixa(poses.map((p) => p.escalaY))
    const [minX, maxX] = faixa(poses.map((p) => p.escalaX))
    const [minA, maxA] = faixa(poses.map((p) => p.alpha))
    expect(minY).toBeCloseTo(0.905, 2)
    expect(maxY).toBeCloseTo(1.104, 2)
    expect(minX).toBeCloseTo(0.954, 2)
    expect(maxX).toBeCloseTo(1.058, 2)
    expect(minA).toBeCloseTo(0.72, 2)
    expect(maxA).toBeLessThanOrEqual(1)
    expect(maxA).toBeCloseTo(0.996, 2)
  })

  it('sempre 3 fagulhas, no máximo 2 acesas ao mesmo tempo, subindo da ponta até 1,4 H', () => {
    for (const pose of umCiclo(5)) {
      expect(pose.fagulhas).toHaveLength(3)
      expect(pose.fagulhas.filter((f) => f.alpha > 0.01).length).toBeLessThanOrEqual(2)
      for (const f of pose.fagulhas) {
        expect(f.alpha).toBeGreaterThanOrEqual(0)
        expect(f.alpha).toBeLessThanOrEqual(1)
        expect(f.y).toBeLessThanOrEqual(-0.9)
        expect(f.y).toBeGreaterThanOrEqual(-1.4)
      }
    }
  })

  it('periódica: t e t + 1 ciclo dão a mesma pose (fagulha comparada por alpha·y)', () => {
    for (const t of [0, 137, 600, 1199, 2000, 2399]) {
      const a = poseDaChama(t, 0.3, false)
      const b = poseDaChama(t + CICLO_DA_CHAMA_MS, 0.3, false)
      expect(b.escalaX).toBeCloseTo(a.escalaX, 9)
      expect(b.escalaY).toBeCloseTo(a.escalaY, 9)
      expect(b.alpha).toBeCloseTo(a.alpha, 9)
      b.fagulhas.forEach((f, i) => {
        expect(f.alpha).toBeCloseTo(a.fagulhas[i].alpha, 6)
        expect(f.alpha * f.y).toBeCloseTo(a.fagulhas[i].alpha * a.fagulhas[i].y, 6)
      })
    }
  })

  it('sem salto na virada do ciclo: o passo de 1 ms ali é do tamanho dos outros', () => {
    const maiorPasso = (de: number) => {
      const a = poseDaChama(de, 0, false)
      const b = poseDaChama(de + 1, 0, false)
      return Math.max(Math.abs(a.escalaY - b.escalaY), Math.abs(a.escalaX - b.escalaX), Math.abs(a.alpha - b.alpha))
    }
    const tipico = Math.max(...umCiclo(1).map((_, t) => maiorPasso(t)))
    expect(maiorPasso(CICLO_DA_CHAMA_MS - 0.5)).toBeLessThanOrEqual(tipico)
    expect(tipico).toBeLessThan(0.005)
  })

  it('reduzir = a pose fixa, sempre o mesmo objeto, com as fagulhas apagadas', () => {
    expect(poseDaChama(0, 0, true)).toBe(POSE_FIXA)
    expect(poseDaChama(1234, 0.7, true)).toBe(POSE_FIXA)
    expect(POSE_FIXA.escalaX).toBe(1)
    expect(POSE_FIXA.escalaY).toBe(1)
    expect(POSE_FIXA.alpha).toBe(0.9)
    expect(POSE_FIXA.fagulhas.map((f) => f.alpha)).toEqual([0, 0, 0])
  })

  it('a fase vem do id: em [0, 1), a mesma para o mesmo id, outra para outro id', () => {
    const fases = ['fogo-1', 'fogo-2', 'abc', 'prop-1791600000000'].map(faseDaFogueira)
    for (const fase of fases) {
      expect(fase).toBeGreaterThanOrEqual(0)
      expect(fase).toBeLessThan(1)
    }
    expect(new Set(fases).size).toBe(fases.length)
    expect(faseDaFogueira('fogo-1')).toBe(fases[0])
  })
})

describe('createChamasDasFogueiras — o relógio', () => {
  it('só entra no relógio com fogueira e sai quando a última some', () => {
    const { chamas, ticker, estados } = palco()
    expect(chamas.colocar(fogueira({ mobilia: 'barril' }), TELA)).toBeNull()
    chamas.podar(new Set())
    expect(ticker.count).toBe(0)

    const no = chamas.colocar(fogueira(), TELA)
    expect(no).not.toBeNull()
    chamas.podar(new Set(['fogo-1']))
    expect(ticker.count).toBe(1)
    // Outra passada com a mesma fogueira não inscreve de novo.
    chamas.colocar(fogueira(), TELA)
    chamas.podar(new Set(['fogo-1']))
    expect(ticker.count).toBe(1)

    chamas.podar(new Set())
    expect(ticker.count).toBe(0)
    expect(no?.destroyed).toBe(true)
    expect(estados).toEqual([
      { chamas: 0, animando: false },
      { chamas: 1, animando: true },
      { chamas: 0, animando: false },
    ])
  })

  it('por quadro só mexe em números: a borda pulsa, as formas são as mesmas e nada é criado', () => {
    const { chamas, quadro } = palco()
    const no = chamas.colocar(fogueira(), TELA)
    if (no === null) throw new Error('fogueira devia ter chama')
    chamas.podar(new Set(['fogo-1']))
    const borda = parte(no, 'borda')
    const contexto = borda.context
    const filhos = [...no.children]
    const escalas = new Set<number>()
    for (let i = 0; i < 20; i += 1) {
      quadro(50)
      escalas.add(borda.scale.y)
    }
    expect(escalas.size).toBeGreaterThan(5)
    expect(borda.context).toBe(contexto)
    expect(no.children).toEqual(filhos)
    expect(no.children.every((c) => c.visible)).toBe(true)
  })

  it('as chamas de duas fogueiras dividem as mesmas formas', () => {
    const { chamas } = palco()
    const a = chamas.colocar(fogueira(), TELA)
    const b = chamas.colocar(fogueira({ id: 'fogo-2', x: 400 }), TELA)
    if (a === null || b === null) throw new Error('fogueiras deviam ter chama')
    expect(parte(a, 'borda').context).toBe(parte(b, 'borda').context)
    expect(parte(a, 'miolo').context).toBe(parte(b, 'miolo').context)
  })

  it('com menos movimento, a chama fica na pose fixa e o relógio não entra', () => {
    const { chamas, ticker } = palco({ reduzido: true })
    const no = chamas.colocar(fogueira(), TELA)
    if (no === null) throw new Error('fogueira devia ter chama')
    chamas.podar(new Set(['fogo-1']))
    expect(ticker.count).toBe(0)
    expect(parte(no, 'miolo').alpha).toBe(POSE_FIXA.alpha)
    expect(no.children.filter((c) => c.label === 'fagulha').map((f) => f.alpha)).toEqual([0, 0, 0])
  })

  it('passou a pedir menos movimento com a chama viva: em até 1 s ela para na pose fixa e sai do relógio', () => {
    const { chamas, ticker, quadro, reduzir } = palco()
    const no = chamas.colocar(fogueira(), TELA)
    if (no === null) throw new Error('fogueira devia ter chama')
    chamas.podar(new Set(['fogo-1']))
    quadro(16)
    reduzir(true)
    quadro(1000)
    expect(ticker.count).toBe(0)
    const altura = chamaDaFogueira(64, 64)?.altura ?? Number.NaN
    expect(parte(no, 'borda').scale.y).toBeCloseTo(altura / 256, 9)
    expect(parte(no, 'miolo').alpha).toBe(POSE_FIXA.alpha)
    // Voltou o movimento: a próxima passada religa.
    reduzir(false)
    chamas.podar(new Set(['fogo-1']))
    expect(ticker.count).toBe(1)
  })

  it('destruir sai do relógio e destrói as chamas', () => {
    const { chamas, ticker } = palco()
    const no = chamas.colocar(fogueira(), TELA)
    chamas.podar(new Set(['fogo-1']))
    chamas.destruir()
    expect(ticker.count).toBe(0)
    expect(no?.destroyed).toBe(true)
  })
})

describe('createChamasDasFogueiras — a chama fica em pé', () => {
  it('de cima, girada: a chama não gira e fica sempre no mesmo ponto abaixo do centro', () => {
    const { chamas } = palco()
    const desvio = chamaDaFogueira(64, 64)?.desvio ?? Number.NaN
    for (const rotation of [0, 37, 90, 180, 270]) {
      const no = chamas.colocar(fogueira({ rotation }), TELA)
      if (no === null) throw new Error('fogueira devia ter chama')
      expect(no.rotation).toBe(0)
      expect(no.position.x).toBeCloseTo(200, 9)
      expect(no.position.y).toBeCloseTo(100 + desvio, 9)
      // Escala positiva nos dois eixos: a chama não vira de ponta-cabeça.
      expect(parte(no, 'borda').scale.y).toBeGreaterThan(0)
      expect(parte(no, 'borda').scale.x).toBeGreaterThan(0)
    }
  })

  it('de lado, girada 90°: a base anda com a lenha (sentido horário), a chama continua em pé', () => {
    const { chamas } = palco()
    const no = chamas.colocar(fogueira({ mobiliaVista: 'lado', width: 64, height: 80, rotation: 90 }), TELA)
    if (no === null) throw new Error('fogueira devia ter chama')
    const base = (0.68 - 0.5) * 80
    // Horário na tela (y para baixo): (0, v) vira (−v, 0).
    expect(no.position.x).toBeCloseTo(200 - base, 9)
    expect(no.position.y).toBeCloseTo(100, 9)
    expect(no.rotation).toBe(0)
  })

  it('fagulha nunca menor que 1,2 px de tela, nem que 0,022 do lado menor', () => {
    const { chamas } = palco()
    const raio = (no: Container) => parte(no, 'fagulha').scale.x * 16
    const perto = chamas.colocar(fogueira(), { cameraScale: 4 })
    if (perto === null) throw new Error('fogueira devia ter chama')
    expect(raio(perto)).toBeCloseTo(0.022 * 64, 9)
    const longe = chamas.colocar(fogueira(), { cameraScale: 0.1 })
    if (longe === null) throw new Error('fogueira devia ter chama')
    expect(raio(longe)).toBeCloseTo(1.2 / 0.1, 9)
  })
})

describe('chama no editor (createPropsRenderer) e no jogador (sincronizarChamas)', () => {
  it('editor: a chama fica logo acima do desenho da fogueira e some com ela', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(container, [fogueira(), fogueira({ id: 'mesa', mobilia: 'mesa' })], null, ZOOM_1)
    const [chama] = chamasNo(container)
    expect(chama?.label).toBe('chama:fogo-1')
    const desenhos = container.children.filter((c) => c.label === 'mobilia')
    expect(desenhos).toHaveLength(2)
    // Logo acima do desenho da própria fogueira (o primeiro posto, que desce ao fundo com o segundo).
    const indiceDaChama = container.getChildIndex(chama)
    expect(container.children[indiceDaChama - 1]?.label).toBe('mobilia')

    // Camada oculta, borracha ou desfazer: o móvel não vem mais, e a chama vai junto.
    renderer.draw(container, [fogueira({ id: 'mesa', mobilia: 'mesa' })], null, ZOOM_1)
    expect(chamasNo(container)).toEqual([])
    expect(chama?.destroyed).toBe(true)
    renderer.destruir()
  })

  it('editor: virou outro tipo, a chama sai; oculto no editor, a chama é fantasma como o móvel', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(container, [fogueira({ hidden: true })], null, ZOOM_1)
    const [chama] = chamasNo(container)
    const [desenho] = container.children.filter((c) => c.label === 'mobilia')
    expect(chama?.alpha).toBe(desenho?.alpha)
    expect(chama?.alpha).toBeLessThan(1)

    renderer.draw(container, [fogueira({ mobilia: 'barril' })], null, ZOOM_1)
    expect(chamasNo(container)).toEqual([])
    renderer.destruir()
  })

  it('editor: arrastar a fogueira leva a chama junto', () => {
    const container = new Container()
    const renderer = createPropsRenderer()
    renderer.draw(container, [fogueira()], null, ZOOM_1)
    renderer.draw(container, [fogueira({ x: 500 })], null, ZOOM_1)
    const [chama] = chamasNo(container)
    expect(chama?.position.x).toBeCloseTo(500, 9)
    renderer.destruir()
  })

  it('jogador: uma camada com a chama de cada fogueira na visão; a que sai da visão leva a chama', () => {
    const { chamas, ticker } = palco()
    const camada = new Container()
    expect(sincronizarChamas(chamas, camada, [fogueira(), fogueira({ id: 'fogo-2', x: 400 }), fogueira({ id: 'b', mobilia: 'barril' })], TELA)).toBe(2)
    expect(chamasNo(camada).map((c) => c.label)).toEqual(['chama:fogo-1', 'chama:fogo-2'])
    expect(ticker.count).toBe(1)

    expect(sincronizarChamas(chamas, camada, [fogueira({ id: 'fogo-2', x: 400 })], TELA)).toBe(1)
    expect(chamasNo(camada).map((c) => c.label)).toEqual(['chama:fogo-2'])

    expect(sincronizarChamas(chamas, camada, [], TELA)).toBe(0)
    expect(camada.children).toEqual([])
    expect(ticker.count).toBe(0)
  })

  it('objeto com o campo opcional ausente (sem giro, sem vista, sem cor) e tamanho torto não derrubam', () => {
    const { chamas } = palco()
    const camada = new Container()
    const minimo: Prop = { id: 'f', src: '', x: 10, y: 10, width: 64, height: 64, linkedMapPath: null, mobilia: 'fogueira' }
    expect(sincronizarChamas(chamas, camada, [minimo], TELA)).toBe(1)
    expect(sincronizarChamas(chamas, camada, [{ ...minimo, width: Number.NaN }], TELA)).toBe(0)
    expect(sincronizarChamas(chamas, camada, [{ ...minimo, x: Number.POSITIVE_INFINITY }], TELA)).toBe(0)
    expect(camada.children).toEqual([])
  })
})
