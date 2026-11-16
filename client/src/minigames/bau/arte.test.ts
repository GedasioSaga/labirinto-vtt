// @vitest-environment node
/**
 * ARTE DO BAÚ SEM DOM: um contexto 2D falso (Proxy que grava cada chamada)
 * desenha todos os estados do jogo sem quebrar; o movimento reduzido não
 * treme nem dá tranco; os alvos de toque são generosos e a boca fica dentro
 * do baú aberto. Em Node não há tela fora da página, então a arte pinta
 * direto e cada retângulo aparece no registro.
 */
import { describe, expect, it } from 'vitest'
import { CENTRO_X, CHAO_Y } from '../abrir/cenario'
import { DIFICULDADES, DT, SEM_ENTRADA } from '../abrir/tipos'
import { BAU_W, BAU_X, BOCA, CORPO_Y, alvoEm, centroDoFecho, desenhar, desenharFecho } from './arte'
import { JOGO_BAU } from './jogo'
import { roboHumano } from './robo'
import { ABRIR_S, criar, passo } from './sim'
import type { Dificuldade, OpcoesDeDesenho } from '../abrir/tipos'
import type { Estado } from './sim'

type Chamada = readonly [string, ...unknown[]]

/** Contexto 2D falso: grava toda chamada e toda atribuição; o gradiente aceita paradas de cor. */
function telaFalsa(): { g: CanvasRenderingContext2D; log: Chamada[] } {
  const log: Chamada[] = []
  const alvo: Record<string | symbol, unknown> = {
    createRadialGradient: (...args: unknown[]) => {
      log.push(['createRadialGradient', ...args])
      return { addColorStop: () => undefined }
    },
  }
  const proxy = new Proxy(alvo, {
    get: (o, chave) => (chave in o ? o[chave] : (...args: unknown[]) => void log.push([String(chave), ...args])),
    set: (o, chave, valor) => {
      log.push(['=' + String(chave), valor])
      o[chave] = valor
      return true
    },
  })
  return { g: proxy as unknown as CanvasRenderingContext2D, log } // sem DOM: o Proxy grava o que a arte chama e aceita o resto
}

const NORMAL: OpcoesDeDesenho = { reduzido: false }
const REDUZIDO: OpcoesDeDesenho = { reduzido: true }

/** Partida do robô humano até `s` segundos (ou até o fim). */
function jogado(semente: string, dif: Dificuldade, s: number): Estado {
  const e = criar(semente, dif)
  const robo = roboHumano(semente, dif)
  for (let k = 0; k < s / DT && e.fim === null; k++) passo(e, robo(e))
  return e
}

/** Estado vencido, com a animação de abrir em `k` (0..1). */
function abrindo(k: number): Estado {
  const e = criar('abrindo', 'normal')
  for (const f of e.fechos) f.a = 0.9
  e.tampa = 1 - 1e-6
  passo(e, SEM_ENTRADA)
  for (let i = 0; i < Math.round((k * ABRIR_S) / DT); i++) passo(e, SEM_ENTRADA)
  return e
}

function emAviso(dif: Dificuldade, i: number): Estado {
  const e = jogado('aviso', dif, 1.5)
  e.avisoEm = i
  e.avisoResta = e.d.aviso * 0.5
  return e
}

function estados(): [string, Estado][] {
  const emperrado = jogado('emperrado', 'normal', 2)
  emperrado.fechos[1].preso = 0.5
  const esgotado = criar('esgotado', 'dificil')
  let fim = passo(esgotado, SEM_ENTRADA)
  while (fim === null) fim = passo(esgotado, SEM_ENTRADA)
  const tranco = jogado('tranco', 'normal', 3)
  tranco.tSolavanco = tranco.t - 0.05
  return [
    ['começo, tudo em 0', criar('comeco', 'normal')],
    ['começo do Difícil, 4 fechos', criar('comeco', 'dificil')],
    ['meio da partida', jogado('meio', 'normal', 6)],
    ['meio do Difícil', jogado('meio', 'dificil', 6)],
    ['emperrado', emperrado],
    ['aviso', emAviso('normal', 2)],
    ['logo depois do solavanco', tranco],
    ['abrindo, 0,25', abrindo(0.25)],
    ['abrindo, 0,5', abrindo(0.5)],
    ['aberto, 1', abrindo(1)],
    ['tempo esgotado', esgotado],
  ]
}

describe('a cena desenha todo estado sem quebrar', () => {
  for (const [nome, e] of estados()) {
    for (const op of [NORMAL, REDUZIDO]) {
      it(`${nome}${op.reduzido ? ' (reduzido)' : ''}`, () => {
        const { g, log } = telaFalsa()
        desenhar(g, e, op)
        expect(log.filter(([n]) => n === 'fillRect').length).toBeGreaterThan(150)
        expect(log.some(([n]) => n === 'fillText' || n === 'strokeText')).toBe(false)
        // Contorno nunca preto puro (regra do Meio-Termo).
        expect(log.filter(([n, v]) => n === '=fillStyle' && v === '#000000')).toEqual([])
      })
    }
  }

  it('com abertura 1 a boca escura aparece e a tampa fica em pé atrás dela', () => {
    expect(JOGO_BAU.abertura(abrindo(1))).toBe(1)
    expect(JOGO_BAU.abertura(abrindo(0.5))).toBeCloseTo(0.5, 6)
    // Contorno da face de dentro da tampa em pé: 108 x 24 px, de y 30 até a dobradiça (y 54).
    const dentroEmPe = (log: Chamada[]): boolean =>
      log.some(([n, x, y, w, h]) => n === 'fillRect' && x === 66 && y === 30 && w === 108 && h === 24)
    for (const op of [NORMAL, REDUZIDO]) {
      const aberto = telaFalsa()
      desenhar(aberto.g, abrindo(1), op)
      expect(dentroEmPe(aberto.log)).toBe(true)
      const fechado = telaFalsa()
      desenhar(fechado.g, criar('fechado', 'normal'), op)
      expect(dentroEmPe(fechado.log)).toBe(false)
    }
    // No reduzido a tampa não gira: já aparece aberta no primeiro passo da animação.
    const meio = telaFalsa()
    desenhar(meio.g, abrindo(0.1), REDUZIDO)
    expect(dentroEmPe(meio.log)).toBe(true)
  })
})

describe('movimento reduzido', () => {
  /** Registro do fecho `i` desenhado em vários instantes. */
  function registros(e: Estado, i: number, op: OpcoesDeDesenho): string[] {
    const t0 = e.t
    return [0, 0.013, 0.031, 0.047, 0.07].map((dt) => {
      e.t = t0 + dt
      const { g, log } = telaFalsa()
      desenharFecho(g, e, i, op)
      return JSON.stringify(log)
    })
  }

  it('o fecho em aviso não treme no reduzido (mesma pintura em todo instante) e treme fora dele', () => {
    for (const dif of DIFICULDADES) {
      const e = emAviso(dif, 1)
      expect(new Set(registros(e, 1, REDUZIDO)).size).toBe(1)
      expect(new Set(registros(e, 1, NORMAL)).size).toBeGreaterThan(1)
    }
  })

  it('o solavanco não dá tranco no reduzido', () => {
    const e = jogado('tranco', 'normal', 3)
    e.tSolavanco = -1
    const sem = registros(e, 0, REDUZIDO)[0]
    e.tSolavanco = e.t - 0.03
    expect(registros(e, 0, REDUZIDO)[0]).toBe(sem)
    expect(registros(e, 0, NORMAL)[0]).not.toBe(sem)
  })

  it('no reduzido a informação continua: o aviso ainda ganha brilho e contorno brasa', () => {
    const { g, log } = telaFalsa()
    desenharFecho(g, emAviso('normal', 0), 0, REDUZIDO)
    expect(log.some(([n]) => n === 'createRadialGradient')).toBe(true)
    expect(log.some(([n, v]) => n === '=fillStyle' && v === '#e2645a')).toBe(true)
  })
})

describe('alvos de toque e boca', () => {
  it('cada fecho tem uma coluna de pelo menos 27 px, da tampa ao chão, sem tocar a vela', () => {
    for (const dif of DIFICULDADES) {
      const e = criar('alvo', dif)
      const n = e.fechos.length
      for (let i = 0; i < n; i++) {
        let largura = 0
        for (let x = 0; x < 240; x++) if (alvoEm(x + 0.5, 80, e) === i) largura++
        expect(largura).toBeGreaterThanOrEqual(27)
        const cx = centroDoFecho(i, n)
        for (const y of [36, 50, 67, 90, CHAO_Y, 130]) expect(alvoEm(cx, y, e)).toBe(i)
      }
      expect(alvoEm(CENTRO_X, 5, e)).toBe(-1)
      expect(alvoEm(222, 20, e)).toBe(-1)
      expect(alvoEm(20, 80, e)).toBe(-1)
    }
  })

  it('depois do fim não há alvo', () => {
    expect(alvoEm(CENTRO_X, 80, abrindo(1))).toBe(-1)
  })

  it('a boca fica no meio do baú, logo acima do corpo', () => {
    expect(JOGO_BAU.boca).toEqual(BOCA)
    expect(BOCA[0]).toBe(CENTRO_X)
    expect(BOCA[0]).toBeGreaterThan(BAU_X)
    expect(BOCA[0]).toBeLessThan(BAU_X + BAU_W)
    expect(BOCA[1]).toBeLessThan(CORPO_Y)
    expect(BOCA[1]).toBeGreaterThan(CORPO_Y - 10)
  })
})
