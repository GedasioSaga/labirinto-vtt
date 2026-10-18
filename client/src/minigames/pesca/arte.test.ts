import { afterAll, describe, expect, it } from 'vitest'
import { corMedidor, criarSpriteDoPeixe, desenharInstr, desenharLago, desenharNpc, desenharPlaca, DUR, mascaraDoPeixe, spriteDoPeixe } from './arte'
import type { CenaDaPesca, FaseDaPesca, ResultadoNaCena } from './arte'
import { novaPuxada, passo, PEIXES, peixePorId } from './sim'
import type { Peixe } from './sim'

/**
 * jsdom não tem canvas 2D: um contexto falso que grava cada pintura
 * (fillStyle + fillRect) e aceita o resto sem fazer nada.
 */

type Chamada = readonly [string, ...unknown[]]

const gravacoes = new WeakMap<HTMLCanvasElement, Chamada[]>()

function contextoFalso(this: HTMLCanvasElement): CanvasRenderingContext2D {
  const log: Chamada[] = []
  gravacoes.set(this, log)
  const alvo: Record<string | symbol, unknown> = {
    createRadialGradient: () => ({ addColorStop: () => undefined }),
  }
  const proxy = new Proxy(alvo, {
    get: (o, chave) => (chave in o ? o[chave] : (...args: unknown[]) => void log.push([String(chave), ...args])),
    set: (o, chave, valor) => {
      log.push(['=' + String(chave), valor])
      o[chave] = valor
      return true
    },
  })
  // Só os métodos que a arte da pesca chama existem de fato; o resto devolve um gravador.
  return proxy as unknown as CanvasRenderingContext2D
}

// Na carga do arquivo, antes de qualquer canvas ser criado (o fundo e os sprites ficam em cache no módulo).
const getContextOriginal = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: contextoFalso, configurable: true, writable: true })
afterAll(() => {
  if (getContextOriginal) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextOriginal)
})

function tela(): { g: CanvasRenderingContext2D; log: Chamada[] } {
  const c = document.createElement('canvas')
  const g = c.getContext('2d')
  const log = gravacoes.get(c)
  if (!g || !log) throw new Error('contexto falso não instalado')
  return { g, log }
}

function peixe(id: string): Peixe {
  const p = peixePorId(id)
  if (!p) throw new Error(id)
  return p
}

/** Tamanho pela fórmula do protótipo: L + ox + 1 por A + 2 + topo (+2 do bigode). */
const TAMANHOS: Record<string, readonly [number, number]> = {
  'carpa-runa': [18, 9], enguia: [24, 6], lume: [11, 10], piaba: [13, 7], bagre: [21, 10],
  truta: [17, 7], linguado: [15, 10], lampreia: [24, 6], esturjao: [24, 8], coroa: [24, 14],
}

describe('peixes em pixel art', () => {
  it('os 10 peixes têm o tamanho esperado', () => {
    expect(PEIXES).toHaveLength(10)
    for (const p of PEIXES) {
      const { w, h, m } = mascaraDoPeixe(p.arte)
      expect([w, h], p.id).toEqual(TAMANHOS[p.id])
      expect(m.length).toBe(w * h)
      const sp = criarSpriteDoPeixe(p)
      expect([sp.w, sp.h, sp.c.width, sp.c.height], p.id).toEqual([w, h, w, h])
    }
  })

  it('máscara determinística, com contorno, olho e só índices da paleta', () => {
    for (const p of PEIXES) {
      const a = mascaraDoPeixe(p.arte)
      const b = mascaraDoPeixe(p.arte)
      expect(Array.from(b.m)).toEqual(Array.from(a.m))
      expect(a.m.includes(1), p.id).toBe(true)
      expect(a.m.includes(7), p.id).toBe(true)
      for (const v of a.m) expect(v === 0 || a.pal[v] !== null).toBe(true)
    }
    expect(mascaraDoPeixe(peixe('coroa').arte).m.includes(8)).toBe(true)
  })

  it('a pintura é a mesma a cada vez: um fillRect por pixel cheio', () => {
    for (const p of PEIXES) {
      const um = gravacoes.get(criarSpriteDoPeixe(p).c)
      const dois = gravacoes.get(criarSpriteDoPeixe(p).c)
      expect(dois).toEqual(um)
      const cheios = Array.from(mascaraDoPeixe(p.arte).m).filter((v) => v !== 0).length
      expect(um?.filter(([n]) => n === 'fillRect')).toHaveLength(cheios)
    }
  })

  it('spriteDoPeixe guarda em cache por peixe', () => {
    expect(spriteDoPeixe(peixe('truta'))).toBe(spriteDoPeixe(peixe('truta')))
  })
})

describe('medidor e durações', () => {
  it('cor do medidor: vermelho vazio, âmbar no meio, verde cheio', () => {
    expect(corMedidor(0)).toBe('rgb(226,100,90)')
    expect(corMedidor(0.5)).toBe('rgb(224,164,74)')
    expect(corMedidor(1)).toBe('rgb(127,180,138)')
  })

  it('movimento reduzido encurta o voo e o final', () => {
    expect([DUR.voo(false), DUR.voo(true), DUR.final(false), DUR.final(true)]).toEqual([0.55, 0.2, 1.2, 0.5])
  })
})

function cena(fase: FaseDaPesca, extra: Partial<CenaDaPesca> = {}): CenaDaPesca {
  return {
    fase, dif: 'normal', n: 0, t: 1.3, tFase: 0.2, carregando: false, forca: 0, dist: 0,
    beliscou: -9, giro: 0, reduzido: false, puxada: null, resultado: null, ...extra,
  }
}

describe('cenas: toda fase desenha sem quebrar', () => {
  const puxada = novaPuxada('extremo', peixe('coroa'), 'cena')
  for (let i = 0; i < 300; i++) passo(puxada, i % 3 === 0)
  const pegou: ResultadoNaCena = { tipo: 'pegou', peixe: peixe('lume') }
  const escapou: ResultadoNaCena = { tipo: 'escapou', peixe: peixe('bagre') }
  const fugiu: ResultadoNaCena = { tipo: 'fugiu', peixe: null }

  const casos: [string, CenaDaPesca][] = [
    ['convite, tudo ausente', cena('convite')],
    ['lance carregando', cena('lance', { carregando: true, forca: 0.7 })],
    ['voo', cena('voo', { dist: 0.9 })],
    ['espera com beliscada', cena('espera', { beliscou: 0.1, dist: 0.5 })],
    ['cedo', cena('cedo')],
    ['fisgada no Extremo', cena('fisgada', { dif: 'extremo', tFase: 0.05 })],
    ['puxada', cena('puxada', { puxada, dif: 'extremo' })],
    ['final pegou', cena('final', { puxada: { ...puxada, fim: 'pegou' }, resultado: pegou, tFase: 0.3 })],
    ['resultado pegou', cena('resultado', { puxada: { ...puxada, fim: 'pegou' }, resultado: pegou })],
    ['final escapou', cena('final', { puxada: { ...puxada, fim: 'escapou' }, resultado: escapou })],
    ['final fugiu, sem puxada', cena('final', { resultado: fugiu, tFase: 0.4 })],
    ['resultado sem puxada nem resultado', cena('resultado')],
    ['puxada reduzida', cena('puxada', { puxada, reduzido: true })],
  ]

  for (const [nome, J] of casos) {
    it(nome, () => {
      const lago = tela()
      const instr = tela()
      desenharLago(lago.g, J, true)
      desenharInstr(instr.g, J)
      expect(lago.log.some(([n]) => n === 'drawImage')).toBe(true)
      expect(instr.log.filter(([n]) => n === 'fillRect').length).toBeGreaterThan(10)
    })
  }

  it('placa: peixe pego, silhueta do que escapou, anéis sem peixe', () => {
    for (const r of [pegou, escapou, fugiu, null]) {
      const { g, log } = tela()
      desenharPlaca(g, r)
      expect(log.some(([n]) => n === 'drawImage')).toBe(r === pegou || r === escapou)
    }
  })

  it('retrato do barqueiro', () => {
    const { g, log } = tela()
    desenharNpc(g)
    expect(log.filter(([n]) => n === 'fillRect').length).toBeGreaterThan(100)
  })
})
