// @vitest-environment node
/**
 * Arte da caixa sem DOM: um contexto 2D falso (Proxy) que grava cada chamada
 * desenha todos os estados do jogo, nas duas versões (normal e movimento
 * reduzido). Em Node não há tela fora da página, então tudo é pintado direto
 * e cada pixel aparece no registro.
 */
import { describe, expect, it } from 'vitest'
import { COR } from '../abrir/desenho'
import type { Politica } from '../abrir/tipos'
import { BOCA, PASSOU_TOTAL, TABUA_A, TABUA_L, TABUA_X, TABUA_Y, alvoEm, corDoNivel, desenhar, poseDoPe, tremorDoRacha } from './arte'
import type { PoseDoPe } from './arte'
import { DURACAO_ABRIR, abertura, criar, faixaAtual, passo, pronto } from './sim'
import type { Estado } from './sim'

type Chamada = readonly [string, ...unknown[]]

function telaFalsa(): { g: CanvasRenderingContext2D; log: Chamada[] } {
  const log: Chamada[] = []
  // O gradiente grava as paradas de cor no mesmo registro (a luz do lampião tremula com o tempo).
  const gradiente = { addColorStop: (...args: unknown[]) => void log.push(['addColorStop', ...args]) }
  const alvo: Record<string | symbol, unknown> = {
    createRadialGradient: (...args: unknown[]) => {
      log.push(['createRadialGradient', ...args])
      return gradiente
    },
  }
  const proxy = new Proxy(alvo, {
    get: (o, chave) => (chave in o ? o[chave] : (...args: unknown[]) => void log.push([String(chave), ...args])),
    set: (o, chave, valor) => {
      // Tinta que não é texto é o gradiente (já gravado acima): vira um rótulo, para dois registros poderem ser comparados.
      log.push(['=' + String(chave), typeof valor === 'string' ? valor : '<gradiente>'])
      o[chave] = valor
      return true
    },
  })
  return { g: proxy as unknown as CanvasRenderingContext2D, log } // falso: o Proxy grava qualquer método chamado; a arte só pinta

}

function registro(e: Readonly<Estado>, reduzido: boolean): Chamada[] {
  const { g, log } = telaFalsa()
  desenhar(g, e, { reduzido })
  return log
}

const SEGURA: Politica<Estado> = () => ({ segurando: true, toque: -1 })
const SOLTO: Politica<Estado> = () => ({ segurando: false, toque: -1 })
const soltaEm = (alvo: (e: Readonly<Estado>) => number): Politica<Estado> =>
  (e) => ({ segurando: !(e.enchendo && e.forca >= alvo(e)), toque: -1 })
const noCentro = soltaEm((e) => (faixaAtual(e)[0] + faixaAtual(e)[1]) / 2)

/** Joga até a condição valer (ou 30 s) e depois mais `extra` passos com a mesma política. */
function jogar(e: Estado, p: Politica<Estado>, ate: (e: Estado) => boolean, extra = 0): Estado {
  for (let i = 0; i < 30 * 120 && !ate(e); i++) passo(e, p(e))
  for (let i = 0; i < extra; i++) passo(e, p(e))
  return e
}

const ESTADOS: [string, () => Estado][] = [
  ['parado, nenhum tranco ainda (campos opcionais ausentes)', () => criar('arte', 'normal')],
  ['segurando no meio', () => jogar(criar('arte', 'normal'), SEGURA, (e) => e.forca >= 0.55)],
  ['segurando acima da faixa', () => jogar(criar('arte', 'normal'), SEGURA, (e) => e.forca >= 0.95)],
  ['racha 1, tremendo', () => jogar(criar('arte', 'normal'), noCentro, (e) => e.estagio === 1, 3)],
  ['racha 2, tremendo', () => jogar(criar('arte', 'normal'), noCentro, (e) => e.estagio === 2, 3)],
  ['fraco, reposicionando', () => jogar(criar('arte', 'normal'), soltaEm((e) => faixaAtual(e)[0] - 0.1), (e) => e.ultimoTranco === 'fraco', 6)],
  ['escorregão', () => jogar(criar('arte', 'dificil'), SEGURA, (e) => e.ultimoTranco === 'escorregou', 12)],
  ['quebrou (abertura 0)', () => jogar(criar('arte', 'normal'), noCentro, (e) => e.fim !== null)],
  ['abrindo, abertura 0,5', () => jogar(criar('arte', 'normal'), noCentro, (e) => abertura(e) >= 0.5)],
  ['aberta, abertura 1', () => jogar(criar('arte', 'normal'), noCentro, (e) => abertura(e) >= 1)],
  ['tempo esgotado', () => jogar(criar('arte', 'dificil'), SOLTO, (e) => e.fim !== null, 30)],
]

describe('cena da caixa: todo estado desenha sem quebrar', () => {
  for (const [nome, fazer] of ESTADOS) {
    for (const reduzido of [false, true]) {
      it(`${nome}${reduzido ? ', movimento reduzido' : ''}`, () => {
        const log = registro(fazer(), reduzido)
        expect(log.filter(([n]) => n === 'fillRect').length).toBeGreaterThan(300)
        // Contorno nunca preto puro (regra do Meio-Termo): nenhuma tinta preta.
        const tintas = log.filter(([n]) => n === '=fillStyle').map(([, cor]) => cor)
        for (const preto of ['#000000', '#000', 'black', 'rgb(0,0,0)']) expect(tintas).not.toContain(preto)
      })
    }
  }

  it('os estados de abrir são os que o nome diz', () => {
    const aberturas = ESTADOS.filter(([n]) => n.startsWith('abrindo') || n.startsWith('aberta')).map(([, f]) => abertura(f()))
    // Pode cair um passo depois de 0,5 pelo arredondamento do relógio.
    expect(aberturas[0]).toBeGreaterThanOrEqual(0.5)
    expect(aberturas[0]).toBeLessThan(0.52)
    expect(aberturas[1]).toBe(1)
  })
})

describe('movimento reduzido: a informação fica, o tremor e o pulo saem', () => {
  it('a tábua não treme no racha (o registro é igual ao de uma tábua parada)', () => {
    const e = jogar(criar('treme', 'normal'), noCentro, (x) => x.estagio === 1, 3)
    const parada: Estado = { ...e, tRacha: -Infinity }
    expect(tremorDoRacha(e, true)).toBe(0)
    expect(tremorDoRacha(e, false)).not.toBe(0)
    expect(registro(e, true)).toEqual(registro(parada, true))
    expect(registro(e, false)).not.toEqual(registro(parada, false))
  })

  it('escorregão: no reduzido o pé de cabra troca de posição sem pulo; no normal, pula e volta', () => {
    const e = jogar(criar('pula', 'normal'), SEGURA, (x) => x.ultimoTranco === 'escorregou')
    const reduzidas: PoseDoPe[] = []
    const normais: PoseDoPe[] = []
    while (!pronto(e)) {
      reduzidas.push(poseDoPe(e, true))
      normais.push(poseDoPe(e, false))
      passo(e, SOLTO(e))
    }
    const assentado = poseDoPe(e, true)
    expect(new Set(reduzidas.map((p) => JSON.stringify(p))).size).toBe(1)
    expect(reduzidas[0]).not.toEqual(assentado)
    expect(new Set(normais.map((p) => p.x)).size).toBeGreaterThanOrEqual(3)
    // Sem salto de ângulo de um quadro para o outro (o recuo do cabo emenda com o pulo para fora).
    for (let k = 1; k < normais.length; k++) expect(Math.abs(normais[k].ang - normais[k - 1].ang)).toBeLessThan(0.12)
  })

  it('a tábua quebrada não cai no reduzido: já aparece no chão (abertura 0,5 desenha igual a 1)', () => {
    const meio = jogar(criar('cai', 'normal'), noCentro, (x) => abertura(x) >= 0.5)
    const fim = jogar(criar('cai', 'normal'), noCentro, (x) => abertura(x) >= 1)
    expect(abertura(meio)).toBeLessThan(1)
    expect(fim.t - meio.t).toBeGreaterThan(DURACAO_ABRIR / 3)
    expect(registro(meio, true)).toEqual(registro(fim, true))
    expect(registro(meio, false)).not.toEqual(registro(fim, false))
  })
})

describe('medidor, toque e boca', () => {
  it('o nível vai de âmbar a brasa quando passa da faixa', () => {
    expect(corDoNivel(0.4, 0.7)).toBe(COR.ambar)
    expect(corDoNivel(0.7, 0.7)).toBe(COR.ambar)
    const meio = corDoNivel(0.7 + PASSOU_TOTAL / 2, 0.7)
    expect([COR.ambar, COR.brasa]).not.toContain(meio)
    expect(corDoNivel(0.7 + PASSOU_TOTAL, 0.7)).toBe(COR.brasa)
    expect(corDoNivel(1, 0.7)).toBe(COR.brasa)
  })

  it('a tela toda segura o pé de cabra; fora dela, nada', () => {
    const e = criar('toque', 'normal')
    for (const [x, y] of [[0, 0], [240, 135], [120, 67], [230, 10], [10, 130]]) expect(alvoEm(x, y, e)).toBe(0)
    for (const [x, y] of [[-1, 50], [241, 50], [50, -1], [50, 136]]) expect(alvoEm(x, y, e)).toBe(-1)
  })

  it('a boca fica no buraco que a tábua da frente deixa', () => {
    expect(BOCA[0]).toBeGreaterThan(TABUA_X)
    expect(BOCA[0]).toBeLessThan(TABUA_X + TABUA_L)
    expect(BOCA[1]).toBeGreaterThan(TABUA_Y)
    expect(BOCA[1]).toBeLessThan(TABUA_Y + TABUA_A)
  })
})
