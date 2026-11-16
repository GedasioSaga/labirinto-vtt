// @vitest-environment node
/**
 * Motor dos jogos de abrir sem navegador: canvas e relógio falsos, jogo de
 * mentira (o da vitrine aprovada, motor.test.ts). Confere as fases, que o
 * `venceu` sai uma vez só, que a armadilha só nasce com o recipiente aberto e
 * o desfecho na mão, que o susto sem jumpscare não treme e que o toque chega
 * ao jogo uma vez só.
 */
import { describe, expect, it } from 'vitest'
import { DT, LIMITE_S, type Entrada, type JogoDeAbrir } from '../tipos'
import { naTela } from './jogos'
import { MotorDeAbrir, type AmbienteDoMotor, type DesfechoNoMotor, type FaseDoMotor } from './motor'

interface Estado { t: number; toques: number[]; segurou: number; fim: 'abriu' | 'tempo' | null; tFim: number }

/** Abre no 3º toque; a animação de abrir leva 0,5 s. */
const FALSO: JogoDeAbrir<Estado> = {
  id: 'caixa', nome: 'teste', instrucao: '', objetivo: '', areaDaDica: [0, 0, 1, 1], teclas: { Space: 0 }, grafico: [], ganho: 1, boca: [120, 60], sequencia: [], duracaoSequencia: 0,
  criar: () => ({ t: 0, toques: [], segurou: 0, fim: null, tFim: 0 }),
  passo(e, ent: Readonly<Entrada>) {
    e.t += DT
    if (e.fim) {
      e.tFim += DT
      return e.fim
    }
    if (ent.toque >= 0) e.toques.push(ent.toque)
    if (ent.segurando) e.segurou++
    if (e.toques.length >= 3) e.fim = 'abriu'
    else if (e.t >= LIMITE_S) e.fim = 'tempo'
    return e.fim
  },
  eventos: () => [],
  tempo: (e) => e.t,
  fim: (e) => e.fim,
  progresso: (e) => e.toques.length / 3,
  abertura: (e) => Math.min(1, e.tFim / 0.5),
  amostra: (e) => ({ t: e.t }),
  desenhar: (_g, e) => {
    ultimoEstado = e
  },
  alvoEm: () => 0,
  tocar: () => undefined,
  roboHumano: () => () => ({ segurando: false, toque: 0 }),
  roboRuim: () => () => ({ segurando: false, toque: -1 }),
}

/** O estado que o motor mandou desenhar por último (o motor não expõe o estado do jogo). */
let ultimoEstado: Readonly<Estado> | null = null
const estado = (): Readonly<Estado> => {
  if (ultimoEstado === null) throw new Error('o motor ainda não desenhou')
  return ultimoEstado
}

/** Contexto falso que grava os translate (o tremor do susto). */
function telaFalsa(): { g: CanvasRenderingContext2D; translados: [number, number][] } {
  const translados: [number, number][] = []
  const g = new Proxy<Record<string, unknown>>({}, {
    get: (o, k: string) => (k === 'translate' ? (x: number, y: number) => translados.push([x, y]) : k in o ? o[k] : () => undefined),
    set: (o, k: string, v) => {
      o[k] = v
      return true
    },
  })
  return { g: g as unknown as CanvasRenderingContext2D, translados } // falso de teste: o motor só pinta; o resto da interface nunca é usado
}

/** Relógio de mentira: cada `quadros(n)` avança n quadros de 1/60 s. */
function relogio(): AmbienteDoMotor & { quadros(n: number): void } {
  let t = 0
  let pendente: ((t: number) => void) | null = null
  return {
    agora: () => t,
    quadro: (f) => {
      pendente = f
      return 1
    },
    cancelarQuadro: () => {
      pendente = null
    },
    quadros(n: number) {
      for (let i = 0; i < n; i++) {
        t += 1000 / 60
        const f = pendente
        pendente = null
        f?.(t)
      }
    },
  }
}

function montar(opcoes: { reduzido?: boolean } = {}) {
  const fases: FaseDoMotor[] = []
  let vitorias = 0
  let primeiras = 0
  const amb = relogio()
  const tela = telaFalsa()
  const motor = new MotorDeAbrir(naTela(FALSO), 'normal', 's', { ambiente: amb, reduzido: opcoes.reduzido })
  motor.ganchos = { som: () => undefined, fase: (f) => fases.push(f), venceu: () => vitorias++, primeiraEntrada: () => primeiras++ }
  motor.definirTela(tela.g)
  motor.iniciar()
  const abrir = (): void => {
    for (let k = 0; k < 3; k++) {
      motor.apertar(`k${k}`, 0)
      amb.quadros(2)
      motor.soltar(`k${k}`)
    }
  }
  return { motor, fases, amb, tela, abrir, vitorias: () => vitorias, primeiras: () => primeiras }
}

const COBRA: DesfechoNoMotor = { armadilha: 'cobra', jumpscare: true }

describe('motor dos jogos de abrir', () => {
  it('sem armadilha e com o desfecho na mão: jogando, abrindo, abriu; venceu uma vez só', () => {
    const { motor, fases, amb, abrir, vitorias } = montar()
    motor.comecar('s|1')
    motor.definirDesfecho({ armadilha: null, jumpscare: true })
    amb.quadros(2)
    abrir()
    amb.quadros(120)
    expect(fases).toEqual(['jogando', 'abrindo', 'abriu'])
    expect(vitorias()).toBe(1)
    expect(motor.lerInstantaneo()).toMatchObject({ fase: 'abriu', progresso: 100 })
  })

  it('o desfecho atrasado deixa o motor aguardando; a cobra só sai com o recipiente aberto', () => {
    const { motor, fases, amb, abrir, vitorias } = montar()
    motor.comecar('s|1')
    amb.quadros(2)
    abrir()
    amb.quadros(120)
    expect(fases).toEqual(['jogando', 'abrindo', 'aguardando'])
    expect(estado().tFim).toBeGreaterThanOrEqual(0.5)
    motor.definirDesfecho(COBRA)
    amb.quadros(1)
    expect(motor.faseAtual).toBe('susto')
    amb.quadros(60)
    expect(fases).toEqual(['jogando', 'abrindo', 'aguardando', 'susto', 'abriu'])
    expect(vitorias()).toBe(1)
  })

  it('a cobra treme a tela; sem jumpscare (ou no movimento reduzido), nada treme', () => {
    const casos: [DesfechoNoMotor, boolean, boolean][] = [
      [COBRA, false, true],
      [{ armadilha: 'cobra', jumpscare: false }, false, false],
      [COBRA, true, false],
    ]
    for (const [desfecho, reduzido, treme] of casos) {
      const { motor, amb, abrir, tela } = montar({ reduzido })
      motor.comecar('s|1')
      motor.definirDesfecho(desfecho)
      amb.quadros(2)
      abrir()
      amb.quadros(31)
      expect(motor.faseAtual).toBe('susto')
      tela.translados.length = 0
      amb.quadros(20)
      expect(tela.translados.some(([x, y]) => x !== 0 || y !== 0)).toBe(treme)
    }
  })

  it('um toque chega ao jogo uma vez só, mesmo segurando; três no mesmo quadro chegam todos; a dica some no primeiro', () => {
    const { motor, amb, primeiras } = montar()
    motor.comecar('s|1')
    amb.quadros(1)
    expect(primeiras()).toBe(0)
    motor.apertar('p1', 0)
    amb.quadros(10)
    expect(estado().toques).toEqual([0])
    expect(estado().segurou).toBeGreaterThan(10)
    motor.soltarTudo()
    motor.apertar('kDigit1', 0)
    motor.soltar('kDigit1')
    motor.apertar('kDigit2', 1)
    motor.soltar('kDigit2')
    amb.quadros(2)
    expect(estado().toques).toEqual([0, 0, 1])
    expect(primeiras()).toBe(1)
  })

  it('sem ninguém jogando, acaba por tempo sem vencer; tentar de novo começa outra tentativa', () => {
    const { motor, fases, amb, vitorias } = montar()
    motor.comecar('s|1')
    amb.quadros(Math.ceil(LIMITE_S * 60) + 10)
    expect(fases).toEqual(['jogando', 'naoAbriu'])
    expect(vitorias()).toBe(0)
    expect(motor.lerInstantaneo()).toMatchObject({ fase: 'naoAbriu', restaS: 0 })
    motor.comecar('s|2')
    amb.quadros(3)
    expect(motor.faseAtual).toBe('jogando')
    expect(estado().t).toBeLessThan(0.1)
    expect(motor.lerInstantaneo().restaS).toBe(LIMITE_S)
  })

  it('aba escondida para o relógio do jogo', () => {
    const { motor, amb } = montar()
    motor.comecar('s|1')
    amb.quadros(30)
    const t = estado().t
    motor.pausar()
    amb.quadros(120)
    expect(estado().t).toBeCloseTo(t, 9)
    motor.retomar()
    amb.quadros(30)
    expect(estado().t).toBeGreaterThan(t + 0.4)
  })
})
