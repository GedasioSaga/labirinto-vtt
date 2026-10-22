import { describe, expect, it, vi } from 'vitest'
import { Container, Graphics, Ticker } from 'pixi.js'
import { createAnimadorDePortas, type MovimentoDasPortas } from './animadorDePortas'
import type { EventoDeSomDaPorta } from '../portas/somDePorta'
import { drawDoors } from './drawDoors'
import { DESLIZAR_DURACAO_MS, GIRAR_DURACAO_MS, GIRAR_FECHAR_DURACAO_MS } from '../portas/animacoesDePorta'
import { easeOutCubic } from '../transicoes/curvas'
import type { DoorState, Wall } from '../types/map'

/** Onde a folha está no meio do tempo: a curva de saída já andou 7/8 do caminho. */
const NO_MEIO_DO_TEMPO = easeOutCubic(0.5)

/**
 * PORTA ANIMADA NO MAPA: a porta que troca `open` anda de um estado ao outro
 * no relógio; no fim o desenho é IDÊNTICO ao de sempre. Sem animação, com
 * reduzir movimento ou na primeira carga, vai direto ao estado final.
 */
function porta(door: Partial<DoorState> = {}, id = 'p'): Wall {
  return { id, x1: 0, y1: 0, x2: 100, y2: 0, blocksLight: true, blocksMove: true, door: { open: false, locked: false, kind: 'normal', animacao: 'deslizar', ...door } }
}

type Instruction = Graphics['context']['instructions'][number]

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

/** A folha é o último preenchimento da porta: a sombra do meio do caminho vem antes, por baixo. */
function folhaDe(g: Graphics): Instruction {
  const todas = fills(g)
  const ultima = todas[todas.length - 1]
  if (ultima === undefined) throw new Error('sem folha')
  return ultima
}

function pontos(instruction: Instruction): number[] {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') throw new Error('instrução sem path')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  if (poly === undefined || poly.action !== 'poly') throw new Error('sem poly')
  const [flat] = poly.data
  if (!Array.isArray(flat)) throw new Error('poly sem lista de números')
  return flat.filter((v): v is number => typeof v === 'number')
}

function faixa(instruction: Instruction, eixo: 'x' | 'y'): { min: number; max: number } {
  const valores = pontos(instruction).filter((_, i) => i % 2 === (eixo === 'x' ? 0 : 1))
  return { min: Math.min(...valores), max: Math.max(...valores) }
}

/** O desenho inteiro, comparável: ação + pontos de cada instrução. */
function desenho(g: Graphics): { acao: string; pontos: number[] }[] {
  return g.context.instructions.map((i) => ({ acao: i.action, pontos: i.action === 'fill' || i.action === 'stroke' ? pontos(i) : [] }))
}

/** Também para o que não é poly (o cadeado tem arco, retângulo e círculo): cada passo do path, com a cor. */
function desenhoCompleto(g: Graphics): string {
  return JSON.stringify(g.context.instructions.map((i) => (i.action === 'fill' || i.action === 'stroke' ? [i.action, i.data.style.color, i.data.style.alpha, i.data.path.instructions.map((p) => [p.action, p.data])] : [i.action])))
}

function referencia(wall: Wall): ReturnType<typeof desenho> {
  const g = new Graphics()
  drawDoors(g, [wall])
  return desenho(g)
}

/** Relógio de mentira: `quadro(ms)` anda o tempo e emite um quadro do Ticker real do Pixi (molde de tokensRenderer.iniciativa.test.ts). */
function relogio(reduzido = false) {
  const ticker = new Ticker()
  let agora = 1000
  const movimento: MovimentoDasPortas = { ticker, reducedMotion: () => reduzido, now: () => agora }
  return {
    ticker,
    movimento,
    quadro(ms: number) {
      agora += ms
      ticker.update(agora)
    },
  }
}

describe('animadorDePortas — quando anima', () => {
  it('primeira carga não anima: a porta já aberta sai aberta e o relógio fica parado', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    createAnimadorDePortas(movimento).desenhar(g, [porta({ open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
    expect(ticker.count).toBe(0)
  })

  it('sem animação escolhida: troca na hora, igual a hoje, sem relógio', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: undefined })])
    animador.desenhar(g, [porta({ animacao: undefined, open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ animacao: undefined, open: true })))
    expect(ticker.count).toBe(0)
  })

  it('id que o app não conhece (pacote não baixado) = sem animação', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'nao-instalada' })])
    animador.desenhar(g, [porta({ animacao: 'nao-instalada', open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'nao-instalada', open: true })))
    expect(ticker.count).toBe(0)
  })

  it('reduzir movimento: estado final na hora', () => {
    const { movimento, ticker } = relogio(true)
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
    expect(ticker.count).toBe(0)
  })

  it('sem relógio (exportação de imagem, testes antigos): nunca anima', () => {
    const g = new Graphics()
    const animador = createAnimadorDePortas()
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
  })

  it('porta secreta não anima: aberta ou fechada ela é a mesma tracejada', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ secret: true })])
    animador.desenhar(g, [porta({ secret: true, open: true })])
    expect(desenho(g)).toEqual(referencia(porta({ secret: true, open: true })))
    expect(ticker.count).toBe(0)
  })
})

describe('animadorDePortas — o caminho', () => {
  it('"Deslizar" ao abrir: parte da fechada, no meio do tempo metade da folha entrou na parede, no fim é a aberta de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    const parada = new Graphics()
    drawDoors(parada, [porta()])
    const fechada = faixa(fills(parada)[0], 'x')

    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(ticker.count).toBe(1)
    // Começo: a folha inteira no vão, por cima do batente — a cara da fechada.
    expect(fills(g)).toHaveLength(1)
    expect(faixa(fills(g)[0], 'x').min).toBeCloseTo(fechada.min, 9)
    expect(faixa(fills(g)[0], 'x').max).toBeCloseTo(fechada.max, 9)

    // Meio do tempo: a curva de saída responde na hora e já andou 7/8 — sobra
    // 1/8 da folha preso à ponta de (x2,y2).
    quadro(DESLIZAR_DURACAO_MS / 2)
    const meio = faixa(folhaDe(g), 'x')
    expect(meio.max).toBeCloseTo(fechada.max, 9)
    expect(meio.min).toBeCloseTo(fechada.min + (fechada.max - fechada.min) * NO_MEIO_DO_TEMPO, 9)

    quadro(DESLIZAR_DURACAO_MS / 2)
    expect(desenho(g)).toEqual(referencia(porta({ open: true })))
    expect(ticker.count).toBe(0)
  })

  it('"Deslizar" ao fechar: o caminho ao contrário, e o fim é a fechada de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ open: true })])
    animador.desenhar(g, [porta()])
    // Começo do fechar = aberta: só o batente, folha nenhuma.
    expect(fills(g)).toHaveLength(0)
    quadro(DESLIZAR_DURACAO_MS)
    expect(desenho(g)).toEqual(referencia(porta()))
    expect(ticker.count).toBe(0)
  })

  it('"Girar na dobradiça": no começo a folha sai da linha da parede; no fim é a aberta de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    quadro(GIRAR_DURACAO_MS / 5)
    // A 1/5 do tempo a curva de saída já andou ~49% (~34°), antes de a folha
    // começar a recolher: a de 60 cobre ~33 de altura; parada, só a espessura (5).
    const altura = faixa(folhaDe(g), 'y')
    expect(altura.max - altura.min).toBeGreaterThan(30)
    quadro(GIRAR_DURACAO_MS * (4 / 5))
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar', open: true })))
    expect(ticker.count).toBe(0)
  })

  it('"Girar na dobradiça" fecha mais depressa do que abre: 260 ms contra 300', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    quadro(GIRAR_FECHAR_DURACAO_MS - 1)
    expect(ticker.count).toBe(1)
    quadro(1)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar' })))
    expect(ticker.count).toBe(0)
  })

  it('"Girar" invertido no meio do abrir volta no tempo de FECHAR que falta, sem quique', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    quadro(GIRAR_DURACAO_MS / 2)
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    // Faltam 7/8 do caminho de volta, no ritmo de fechar (260 ms o caminho inteiro).
    quadro(GIRAR_FECHAR_DURACAO_MS * NO_MEIO_DO_TEMPO - 1)
    expect(ticker.count).toBe(1)
    quadro(1)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar' })))
    expect(ticker.count).toBe(0)
  })

  it('inverter no meio: fecha DE ONDE ESTAVA, no tempo que falta', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    quadro(DESLIZAR_DURACAO_MS / 2)
    const noMeio = faixa(folhaDe(g), 'x')

    animador.desenhar(g, [porta()])
    // Sem salto: a folha continua onde estava no quadro da inversão.
    expect(faixa(folhaDe(g), 'x').min).toBeCloseTo(noMeio.min, 9)
    // Faltavam 7/8 do caminho: 7/8 da duração bastam para chegar.
    quadro(DESLIZAR_DURACAO_MS * NO_MEIO_DO_TEMPO)
    expect(desenho(g)).toEqual(referencia(porta()))
    expect(ticker.count).toBe(0)
  })

  it('porta que some no meio esquece o estado: o relógio solta e, de volta, ela não anima', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(ticker.count).toBe(1)

    animador.desenhar(g, [])
    expect(ticker.count).toBe(0)
    expect(g.context.instructions).toHaveLength(0)

    // Volta já fechada (o mestre fechou enquanto ela estava fora): primeira vez de novo, sem animar.
    animador.desenhar(g, [porta()])
    expect(desenho(g)).toEqual(referencia(porta()))
    expect(ticker.count).toBe(0)
  })

  it('só a porta que mudou anda; a vizinha fica parada no desenho de sempre', () => {
    const { movimento, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    const vizinha = { ...porta({}, 'v'), x1: 200, x2: 300 }
    animador.desenhar(g, [porta(), vizinha])
    animador.desenhar(g, [porta({ open: true }), vizinha])
    quadro(DESLIZAR_DURACAO_MS / 4)
    const fillsDaVizinha = fills(g).filter((f) => faixa(f, 'x').min >= 200)
    expect(fillsDaVizinha).toHaveLength(1)
    const sozinha = new Graphics()
    drawDoors(sozinha, [vizinha])
    expect(pontos(fillsDaVizinha[0])).toEqual(pontos(fills(sozinha)[0]))
  })

  it('cancelar (desmonte) solta o relógio no meio do caminho', () => {
    const { movimento, ticker } = relogio()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    animador.desenhar(g, [porta()])
    animador.desenhar(g, [porta({ open: true })])
    expect(ticker.count).toBe(1)
    animador.cancelar()
    expect(ticker.count).toBe(0)
  })
})

describe('animadorDePortas — extremos, reduzido e trancada', () => {
  it.each([undefined, '#3a7bd5', '#5e8c4a', '#7a4a6e'])('cor %s: girar e deslizar terminam o abrir e o fechar no desenho da porta parada', (cor) => {
    for (const animacao of ['girar', 'deslizar']) {
      const { movimento, ticker, quadro } = relogio()
      const g = new Graphics()
      const animador = createAnimadorDePortas(movimento)
      animador.desenhar(g, [porta({ animacao, cor })])
      animador.desenhar(g, [porta({ animacao, cor, open: true })])
      quadro(GIRAR_DURACAO_MS)
      expect(desenho(g)).toEqual(referencia(porta({ animacao, cor, open: true })))
      animador.desenhar(g, [porta({ animacao, cor })])
      quadro(GIRAR_DURACAO_MS)
      expect(desenho(g)).toEqual(referencia(porta({ animacao, cor })))
      expect(ticker.count).toBe(0)
    }
  })

  it('fechar e trancar juntos (cor própria): anda e termina na trancada com cadeado, igual à parada', () => {
    const { movimento, ticker, quadro } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'girar', cor: '#3a7bd5', open: true })])
    animador.desenhar(g, [porta({ animacao: 'girar', cor: '#3a7bd5', locked: true })])
    expect(ticker.count).toBe(1)
    quadro(GIRAR_FECHAR_DURACAO_MS)
    const parada = new Graphics()
    drawDoors(parada, [porta({ animacao: 'girar', cor: '#3a7bd5', locked: true })])
    expect(desenhoCompleto(g)).toBe(desenhoCompleto(parada))
    expect(ticker.count).toBe(0)
  })

  it('trancada tem a mesma cara aberta ou fechada (cheia): trocar `open` não anima', () => {
    const { movimento, ticker } = relogio()
    const g = new Graphics()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, [porta({ animacao: 'girar', locked: true })])
    animador.desenhar(g, [porta({ animacao: 'girar', locked: true, open: true })])
    expect(ticker.count).toBe(0)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar', locked: true, open: true })))
  })

  it('movimento reduzido ligado no meio do caminho: no quadro seguinte a porta já está no estado final', () => {
    let reduzido = false
    let agora = 1000
    const ticker = new Ticker()
    const animador = createAnimadorDePortas({ ticker, reducedMotion: () => reduzido, now: () => agora })
    const g = new Graphics()
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    agora += 40
    ticker.update(agora)
    expect(desenho(g)).not.toEqual(referencia(porta({ animacao: 'girar', open: true })))
    reduzido = true
    agora += 16
    ticker.update(agora)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar', open: true })))
    expect(ticker.count).toBe(0)
  })
})

describe('animadorDePortas — só repinta o que anda', () => {
  /** 50 portas lado a lado, 200 de passo: a `i` fica entre x = 200i e 200i + 100. */
  function cinquenta(abertas: ReadonlySet<number> = new Set()): Wall[] {
    return Array.from({ length: 50 }, (_, i) => ({ ...porta({ open: abertas.has(i) }, `p${i}`), x1: i * 200, x2: i * 200 + 100 }))
  }

  function montarCena() {
    const cena = new Container()
    const embaixo = new Graphics()
    const g = new Graphics()
    const emCima = new Graphics()
    cena.addChild(embaixo, g, emCima)
    return { cena, embaixo, g, emCima }
  }

  it('abrir 1 porta entre 50: as outras 49 não são repintadas a cada quadro, só a que anda, num Graphics logo acima', () => {
    const { movimento, ticker, quadro } = relogio()
    const { cena, embaixo, g, emCima } = montarCena()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, cinquenta())
    const limpezas = vi.spyOn(g, 'clear')
    animador.desenhar(g, cinquenta(new Set([0])))
    // Começo: as paradas são repintadas UMA vez, já sem a que anda.
    expect(limpezas).toHaveBeenCalledTimes(1)
    expect(fills(g)).toHaveLength(49)
    const camada = cena.getChildAt(cena.getChildIndex(g) + 1)
    if (!(camada instanceof Graphics) || camada === emCima) throw new Error('a camada das que andam não está logo acima')
    const porQuadro: number[] = []
    for (let i = 0; i < 10; i += 1) {
      quadro(DESLIZAR_DURACAO_MS / 20)
      porQuadro.push(camada.context.instructions.length)
    }
    // Dez quadros e as 49 paradas intocadas; a camada tem só a porta 0 (x de 0 a 100).
    expect(limpezas).toHaveBeenCalledTimes(1)
    expect(Math.max(...porQuadro)).toBeLessThanOrEqual(4)
    for (const f of fills(camada)) expect(faixa(f, 'x').max).toBeLessThan(110)
    quadro(DESLIZAR_DURACAO_MS)
    // Fim: a porta volta às paradas (repintadas uma vez, as 50) e a camada sai da cena.
    expect(limpezas).toHaveBeenCalledTimes(2)
    const todas = new Graphics()
    drawDoors(todas, cinquenta(new Set([0])))
    expect(desenho(g)).toEqual(desenho(todas))
    expect(cena.children).toEqual([embaixo, g, emCima])
    expect(ticker.count).toBe(0)
  })

  it('a segunda porta a andar entra na mesma camada; as paradas são repintadas só na entrada dela', () => {
    const { movimento, quadro } = relogio()
    const { g } = montarCena()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, cinquenta())
    const limpezas = vi.spyOn(g, 'clear')
    animador.desenhar(g, cinquenta(new Set([0])))
    quadro(DESLIZAR_DURACAO_MS / 4)
    animador.desenhar(g, cinquenta(new Set([0, 1])))
    expect(fills(g)).toHaveLength(48)
    quadro(16)
    quadro(16)
    expect(limpezas).toHaveBeenCalledTimes(2)
  })

  it('a camada segue a das paradas: escondida junto (camada oculta) e no mesmo lugar', () => {
    const { movimento, quadro } = relogio()
    const { cena, g } = montarCena()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, cinquenta())
    animador.desenhar(g, cinquenta(new Set([3])))
    g.visible = false
    g.position.set(12, 34)
    quadro(16)
    const camada = cena.getChildAt(cena.getChildIndex(g) + 1)
    expect(camada.visible).toBe(false)
    expect([camada.position.x, camada.position.y]).toEqual([12, 34])
  })

  it('cancelar no meio destrói a camada e tira da cena', () => {
    const { movimento } = relogio()
    const { cena, g } = montarCena()
    const animador = createAnimadorDePortas(movimento)
    animador.desenhar(g, cinquenta())
    animador.desenhar(g, cinquenta(new Set([0])))
    expect(cena.children).toHaveLength(4)
    animador.cancelar()
    expect(cena.children).toHaveLength(3)
  })
})

describe('animadorDePortas — som', () => {
  function comSom(reduzido = false) {
    const r = relogio(reduzido)
    const som = vi.fn<(evento: EventoDeSomDaPorta) => void>()
    r.movimento.som = som
    return { ...r, som }
  }

  it('abrir com "Girar" pede o rangido no começo do caminho, com a duração dele', () => {
    const { movimento, som } = comSom()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    expect(som).not.toHaveBeenCalled()
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    expect(som).toHaveBeenCalledTimes(1)
    expect(som).toHaveBeenCalledWith({ tipo: 'abrir', som: 'rangido', duracaoMs: GIRAR_DURACAO_MS })
  })

  it('fechar com "Deslizar" pede só o trinco, no tempo de fechar', () => {
    const { movimento, som } = comSom()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    animador.desenhar(g, [porta({ open: true })])
    animador.desenhar(g, [porta()])
    expect(som).toHaveBeenCalledWith({ tipo: 'fechar', som: 'trinco', duracaoMs: DESLIZAR_DURACAO_MS })
  })

  it('inverter no meio pede o som do sentido novo, com o tempo que falta', () => {
    const { movimento, som, quadro } = comSom()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    quadro(GIRAR_DURACAO_MS / 2)
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    expect(som).toHaveBeenCalledTimes(2)
    const [evento] = som.mock.calls[1]
    if (!('som' in evento)) throw new Error('esperava o evento do caminho')
    expect(evento.tipo).toBe('fechar')
    expect(evento.duracaoMs).toBeCloseTo(GIRAR_FECHAR_DURACAO_MS * NO_MEIO_DO_TEMPO, 6)
  })

  it('sem caminho, sem som: primeira carga, sem animação, pacote não baixado, secreta, trancada e reduzido', () => {
    const casos: [Partial<DoorState>, boolean][] = [
      [{ animacao: undefined }, false],
      [{ animacao: 'nao-instalada' }, false],
      [{ animacao: 'girar', secret: true }, false],
      [{ animacao: 'girar', locked: true }, false],
      [{ animacao: 'girar' }, true],
    ]
    for (const [door, reduzido] of casos) {
      const { movimento, som } = comSom(reduzido)
      const animador = createAnimadorDePortas(movimento)
      const g = new Graphics()
      animador.desenhar(g, [porta({ ...door, open: true })])
      animador.desenhar(g, [porta(door)])
      animador.desenhar(g, [porta({ ...door, open: true })])
      expect(som).not.toHaveBeenCalled()
    }
  })

  it('trancar e destrancar pedem a tranca; porta sem som de animação fica muda', () => {
    const { movimento, som } = comSom()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    const muda = (locked: boolean): Wall => ({ ...porta({ animacao: undefined, locked }, 'muda'), x1: 200, x2: 300 })
    animador.desenhar(g, [porta(), muda(false)])
    animador.desenhar(g, [porta({ locked: true }), muda(true)])
    animador.desenhar(g, [porta(), muda(true)])
    expect(som.mock.calls.map(([evento]) => evento)).toEqual([{ tipo: 'trancar' }, { tipo: 'destrancar' }])
  })

  it('podeSoar recusa: a porta anda até o fim de sempre, sem som do caminho nem da tranca', () => {
    const { movimento, som, ticker, quadro } = comSom()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    const mudo = () => false
    animador.desenhar(g, [porta({ animacao: 'girar' })], null, 1, 1, undefined, mudo)
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })], null, 1, 1, undefined, mudo)
    expect(ticker.count).toBe(1)
    quadro(GIRAR_DURACAO_MS)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar', open: true })))
    animador.desenhar(g, [porta({ animacao: 'girar', open: true, locked: true })], null, 1, 1, undefined, mudo)
    expect(som).not.toHaveBeenCalled()
  })

  it('podeSoar recebe a porta do desenho anterior e a de agora, e só é perguntado na troca que soaria', () => {
    const { movimento, som } = comSom()
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    const podeSoar = vi.fn<(antes: Wall, agora: Wall) => boolean>(() => true)
    const fechada = porta({ animacao: 'girar' })
    const aberta = { ...porta({ animacao: 'girar', open: true }), x2: 120 }
    const semAnimacao = { ...porta({ animacao: undefined }, 'plana'), x1: 200, x2: 300 }
    animador.desenhar(g, [fechada, semAnimacao], null, 1, 1, undefined, podeSoar)
    animador.desenhar(g, [aberta, { ...semAnimacao, door: { open: true, locked: false, kind: 'normal' } }], null, 1, 1, undefined, podeSoar)
    expect(podeSoar.mock.calls).toEqual([[fechada, aberta]])
    expect(som).toHaveBeenCalledTimes(1)
  })

  it('quem toca lançar não quebra a porta: o caminho segue e termina na de sempre', () => {
    const { movimento, ticker, quadro } = relogio()
    movimento.som = () => {
      throw new Error('sem áudio')
    }
    const animador = createAnimadorDePortas(movimento)
    const g = new Graphics()
    animador.desenhar(g, [porta({ animacao: 'girar' })])
    animador.desenhar(g, [porta({ animacao: 'girar', open: true })])
    expect(ticker.count).toBe(1)
    quadro(GIRAR_DURACAO_MS)
    expect(desenho(g)).toEqual(referencia(porta({ animacao: 'girar', open: true })))
  })
})
