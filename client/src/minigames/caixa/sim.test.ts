// @vitest-environment node
/**
 * Gráfico do movimento da caixa (METAS.md, seção 2): o estado amostrado sem
 * desenhar, e cada propriedade vira teste. As partidas são do robô humano e do
 * ruim, nas duas dificuldades, com sementes fixas; algumas regras usam uma
 * política de roteiro que lê o estado direto (é teste, não robô).
 */
import { describe, expect, it } from 'vitest'
import { simular } from '../abrir/simular'
import type { Partida } from '../abrir/simular'
import { DIFICULDADES, DT, LIMITE_S } from '../abrir/tipos'
import type { Dificuldade, Fim, Politica } from '../abrir/tipos'
import { JOGO_CAIXA } from './jogo'
import { roboHumano, roboRuim } from './robo'
import { DIF, DURACAO_ABRIR, ESTAGIOS, abertura, amostra, criar, faixaAtual, forcaNoTempo, passo, tempoDaForca } from './sim'
import type { AmostraDaCaixa, Estado } from './sim'

type Qual = 'humano' | 'ruim'
const QUAIS: readonly Qual[] = ['humano', 'ruim']
/** Partidas por dificuldade e robô: 30 x 2 x 2 = 120 partidas de até 20 s. */
const POR_GRUPO = 30

const roboDe = (qual: Qual, semente: string, dif: Dificuldade): Politica<Estado> =>
  qual === 'humano' ? roboHumano(semente, dif) : roboRuim(semente, dif)

/** Todas as partidas do gráfico, amostradas a cada 0,1 s (o simular da base comum). */
const PARTIDAS: { rotulo: string; p: Partida }[] = []
for (const dif of DIFICULDADES) {
  for (const qual of QUAIS) {
    for (let i = 0; i < POR_GRUPO; i++) {
      const semente = `grafico|caixa|${dif}|${qual}|${i}`
      PARTIDAS.push({ rotulo: semente, p: simular(JOGO_CAIXA, semente, dif, roboDe(qual, semente, dif)) })
    }
  }
}

const v = (a: { v: Readonly<Record<string, number>> }, chave: keyof AmostraDaCaixa): number => a.v[chave]

/** Um quadro por passo de 1/120 s: a amostra depois do passo e o fim. */
interface Quadro {
  a: AmostraDaCaixa
  fim: Fim | null
}

/**
 * Mais fino que 0,1 s quando a propriedade pede: a soltura acontece num passo
 * só, e a grade de 0,1 s pula por cima dela.
 */
function passoAPasso(semente: string, dif: Dificuldade, politica: Politica<Estado>): Quadro[] {
  const e = criar(semente, dif)
  const q: Quadro[] = [{ a: amostra(e), fim: null }]
  while (e.fim === null) {
    passo(e, politica(e))
    q.push({ a: amostra(e), fim: e.fim })
  }
  return q
}

const QUADROS: { rotulo: string; q: Quadro[] }[] = []
for (const dif of DIFICULDADES) {
  for (const qual of QUAIS) {
    for (let i = 0; i < 15; i++) {
      const semente = `fino|caixa|${dif}|${qual}|${i}`
      QUADROS.push({ rotulo: semente, q: passoAPasso(semente, dif, roboDe(qual, semente, dif)) })
    }
  }
}

/** Política de roteiro: segura até a força chegar ao alvo (lido direto do estado) e solta; depois segura de novo. */
const soltaEm = (alvo: (e: Readonly<Estado>) => number): Politica<Estado> =>
  (e) => ({ segurando: !(e.enchendo && e.forca >= alvo(e)), toque: -1 })
const noCentro = (e: Readonly<Estado>): number => {
  const [a, b] = faixaAtual(e)
  return (a + b) / 2
}
/** Nunca solta: só escorrega. */
const SEGURA_SEMPRE: Politica<Estado> = () => ({ segurando: true, toque: -1 })

describe('gráfico do movimento da caixa (amostra a cada 0,1 s)', () => {
  it('há vitórias e derrotas nas partidas do gráfico (o teste não é vazio)', () => {
    const fins = new Set(PARTIDAS.map(({ p }) => p.fim))
    expect(fins).toEqual(new Set(['abriu', 'tempo']))
  })

  it('a força só sobe enquanto a pessoa segura e volta a zero ao soltar', () => {
    const erros: string[] = []
    for (const { rotulo, p } of PARTIDAS) {
      for (let i = 1; i < p.amostras.length; i++) {
        const a = p.amostras[i - 1]
        const b = p.amostras[i]
        if (v(b, 'segurando') === 0 && v(b, 'forca') !== 0) erros.push(`${rotulo} t=${b.t}: solto com força ${v(b, 'forca')}`)
        if (v(b, 'forca') > v(a, 'forca') && v(b, 'segurando') !== 1) erros.push(`${rotulo} t=${b.t}: força subiu sem segurar`)
        // Duas amostras seguidas segurando são a mesma puxada: o reposicionar (>= 0,7 s) impede soltar e voltar em 0,1 s.
        if (v(a, 'segurando') === 1 && v(b, 'segurando') === 1 && v(b, 'forca') < v(a, 'forca')) erros.push(`${rotulo} t=${b.t}: força desceu segurando`)
      }
    }
    expect(erros).toEqual([])
  })

  it('a partida acaba em até 20 s', () => {
    for (const { p } of PARTIDAS) {
      expect(p.fim).not.toBeNull()
      expect(p.t).toBeLessThanOrEqual(LIMITE_S + 1e-9)
    }
  })

  it('são exatamente 3 estágios até abrir: racha 1, 2 e 3, em ordem, e o abriu junto do terceiro', () => {
    for (const { rotulo, p } of PARTIDAS) {
      const rachas = p.eventos.filter(([, n]) => n === 'racha')
      expect(rachas.map(([, , x]) => x), rotulo).toEqual(rachas.map((_, k) => k + 1))
      const abriu = p.eventos.filter(([, n]) => n === 'abriu')
      const ultima = p.amostras[p.amostras.length - 1]
      if (p.fim === 'abriu') {
        expect(rachas, rotulo).toHaveLength(ESTAGIOS)
        expect(abriu, rotulo).toHaveLength(1)
        expect(abriu[0][0], rotulo).toBe(rachas[ESTAGIOS - 1][0])
        expect(v(ultima, 'estagio'), rotulo).toBe(ESTAGIOS)
      } else {
        expect(rachas.length, rotulo).toBeLessThan(ESTAGIOS)
        expect(abriu, rotulo).toHaveLength(0)
        expect(p.eventos.filter(([, n]) => n === 'tempo'), rotulo).toHaveLength(1)
      }
    }
  })

  it('mesma semente dá as mesmas amostras; outra semente dá outras, nas duas dificuldades', () => {
    for (const dif of DIFICULDADES) {
      const um = simular(JOGO_CAIXA, 'det|a', dif, roboHumano('det|a', dif))
      const dois = simular(JOGO_CAIXA, 'det|a', dif, roboHumano('det|a', dif))
      const outra = simular(JOGO_CAIXA, 'det|b', dif, roboHumano('det|b', dif))
      expect(dois).toEqual(um)
      expect(outra.amostras).not.toEqual(um.amostras)
    }
  })
})

describe('gráfico do movimento da caixa (passo a passo, 1/120 s)', () => {
  it('o estágio só sobe numa soltura dentro da faixa verde, e toda soltura dentro dela sobe um estágio', () => {
    const erros: string[] = []
    for (const { rotulo, q } of QUADROS) {
      for (let k = 1; k < q.length; k++) {
        const a = q[k - 1].a
        const b = q[k].a
        const soltou = a.segurando === 1 && b.segurando === 0
        const naFaixa = a.forca >= a.faixaMin && a.forca <= a.faixaMax
        if (b.estagio > a.estagio) {
          if (b.estagio !== a.estagio + 1) erros.push(`${rotulo} passo ${k}: pulou estágio`)
          if (!soltou || !naFaixa) erros.push(`${rotulo} passo ${k}: subiu sem soltura na faixa (força ${a.forca}, faixa ${a.faixaMin}..${a.faixaMax})`)
        }
        // O tempo acabando no meio da puxada também solta, mas sem tranco: fica de fora.
        if (soltou && naFaixa && q[k].fim !== 'tempo' && b.estagio !== a.estagio + 1) erros.push(`${rotulo} passo ${k}: soltou na faixa e não rachou`)
      }
    }
    expect(erros).toEqual([])
  })

  it('a faixa não se mexe enquanto a pessoa segura', () => {
    const erros: string[] = []
    for (const { rotulo, q } of QUADROS) {
      for (let k = 1; k < q.length; k++) {
        const a = q[k - 1].a
        const b = q[k].a
        if (a.segurando === 1 && b.segurando === 1 && (a.faixaMin !== b.faixaMin || a.faixaMax !== b.faixaMax)) erros.push(`${rotulo} passo ${k}`)
      }
    }
    expect(erros).toEqual([])
  })
})

describe('regras da caixa', () => {
  it('curva da força: começa devagar, acelera, chega a 1 em `encher` s; tempoDaForca é o inverso', () => {
    for (const dif of DIFICULDADES) {
      const d = DIF[dif]
      expect(forcaNoTempo(0, d)).toBe(0)
      expect(forcaNoTempo(d.encher, d)).toBe(1)
      expect(forcaNoTempo(d.encher * 2, d)).toBe(1)
      // Expoente > 1: na metade do tempo, a força ainda não chegou à metade.
      expect(forcaNoTempo(d.encher / 2, d)).toBeLessThan(0.5)
      for (let t = 0.05; t <= d.encher; t += 0.05) expect(tempoDaForca(forcaNoTempo(t, d), d)).toBeCloseTo(t, 9)
    }
  })

  it('faixas: três centros por partida, em ordem crescente, dentro do sorteio da dificuldade', () => {
    for (const dif of DIFICULDADES) {
      const d = DIF[dif]
      for (let i = 0; i < 200; i++) {
        const e = criar(`faixa|${i}`, dif)
        expect(e.centros).toHaveLength(ESTAGIOS)
        expect([...e.centros].sort((a, b) => a - b)).toEqual(e.centros)
        for (const c of e.centros) {
          expect(c).toBeGreaterThanOrEqual(d.centro[0])
          expect(c).toBeLessThanOrEqual(d.centro[1])
        }
        const [min, max] = faixaAtual(e)
        expect(max - min).toBeCloseTo(d.largura, 12)
      }
    }
  })

  it('soltar no centro da faixa abre em 3 puxadas, com o reposicionar entre elas', () => {
    for (const dif of DIFICULDADES) {
      const e = criar('roteiro', dif)
      const politica = soltaEm(noCentro)
      const rachas: number[] = []
      const inicios: number[] = []
      while (e.fim === null) {
        const antes = e.enchendo
        passo(e, politica(e))
        if (!antes && e.enchendo) inicios.push(e.t)
        for (const ev of e.ev) if (ev.nome === 'racha') rachas.push(e.t)
      }
      expect(e.fim).toBe('abriu')
      expect(rachas).toHaveLength(ESTAGIOS)
      // Quem segura durante o reposicionar começa a encher assim que o pé de cabra assenta, nem antes nem depois.
      for (let k = 1; k < inicios.length; k++) expect(inicios[k] - rachas[k - 1]).toBeCloseTo(DIF[dif].reposicionar, 9)
    }
  })

  it('soltar abaixo da faixa dá fraco e não racha; acima, escorrega e espera mais', () => {
    const fraco = criar('fraco', 'normal')
    const pFraco = soltaEm((e) => faixaAtual(e)[0] - 0.05)
    const pForte = soltaEm((e) => faixaAtual(e)[1] + 0.03)
    const nomes = (e: Estado, p: Politica<Estado>): string[] => {
      const vistos: string[] = []
      for (let i = 0; i < 4 * 120; i++) {
        passo(e, p(e))
        for (const ev of e.ev) if (ev.nome !== 'tensao') vistos.push(ev.nome)
      }
      return vistos
    }
    expect(new Set(nomes(fraco, pFraco))).toEqual(new Set(['fraco']))
    expect(fraco.estagio).toBe(0)
    const forte = criar('forte', 'normal')
    expect(new Set(nomes(forte, pForte))).toEqual(new Set(['escorregou']))
    expect(forte.estagio).toBe(0)
    expect(forte.livreEm - forte.tSolta).toBeCloseTo(DIF.normal.escorregao, 9)
  })

  it('segurar sem soltar: escorrega sozinho depois de 0,25 s com a força no máximo, e o tempo acaba sem abrir', () => {
    const d = DIF.normal
    const e = criar('teimoso', 'normal')
    const escorregoes: [number, number | undefined][] = []
    const inicios: number[] = []
    while (e.fim === null) {
      const antes = e.enchendo
      passo(e, SEGURA_SEMPRE(e))
      if (!antes && e.enchendo) inicios.push(e.t)
      for (const ev of e.ev) if (ev.nome === 'escorregou') escorregoes.push([e.t, ev.v])
    }
    expect(e.fim).toBe('tempo')
    expect(escorregoes.length).toBeGreaterThan(3)
    const [t0, forca] = escorregoes[0]
    expect(forca).toBe(1)
    // Chega ao máximo em `encher` s e escorrega quando completa `topo` s lá em cima (no passo, não antes).
    expect(t0 - inicios[0]).toBeGreaterThanOrEqual(d.encher + d.topo - 1e-9)
    expect(t0 - inicios[0]).toBeLessThanOrEqual(d.encher + d.topo + DT + 1e-9)
    // Continua segurando: volta a encher quando o pé de cabra assenta de novo.
    expect(inicios[1] - t0).toBeCloseTo(d.escorregao, 9)
  })

  it('tensão: um rangido no aperto e um a cada ~0,09 s segurando, com v = força do passo', () => {
    const e = criar('tensao', 'normal')
    const tempos: number[] = []
    for (let i = 0; i < 1.2 * 120; i++) {
      passo(e, SEGURA_SEMPRE(e))
      for (const ev of e.ev) {
        if (ev.nome !== 'tensao') continue
        expect(ev.v).toBe(e.forca)
        tempos.push(e.t)
      }
    }
    expect(tempos[0]).toBeCloseTo(DT, 9)
    for (let k = 1; k < tempos.length; k++) {
      expect(tempos[k] - tempos[k - 1]).toBeGreaterThanOrEqual(0.09 - DT)
      expect(tempos[k] - tempos[k - 1]).toBeLessThanOrEqual(0.09 + DT)
    }
  })

  it('depois do fim: o relógio anda, a entrada não conta, o fim é o mesmo e a abertura vai de 0 a 1 em 0,5 s', () => {
    const e = criar('fim', 'normal')
    const politica = soltaEm(noCentro)
    while (e.fim === null) passo(e, politica(e))
    const tFim = e.t
    expect(abertura(e)).toBe(0)
    const passosAteAbrir = Math.round(DURACAO_ABRIR / DT)
    for (let i = 1; i <= passosAteAbrir + 30; i++) {
      expect(passo(e, { segurando: i % 2 === 0, toque: 0 })).toBe('abriu')
      expect(e.ev).toEqual([])
      expect(e.forca).toBe(0)
      expect(e.estagio).toBe(ESTAGIOS)
      if (i === passosAteAbrir / 2) expect(abertura(e)).toBeCloseTo(0.5, 9)
    }
    expect(e.t).toBeCloseTo(tFim + (passosAteAbrir + 30) * DT, 9)
    expect(abertura(e)).toBe(1)
  })

  it('tempo esgotado: abertura fica em 0', () => {
    const e = criar('parado', 'dificil')
    while (e.fim === null) passo(e, { segurando: false, toque: -1 })
    expect(e.fim).toBe('tempo')
    expect(e.t).toBeCloseTo(LIMITE_S, 9)
    passo(e, { segurando: true, toque: 0 })
    expect(abertura(e)).toBe(0)
  })
})
