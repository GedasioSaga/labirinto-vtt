import { afterEach, describe, expect, it, vi } from 'vitest'
import { oklabDoRgb } from './materiais'
import { blocosIguais, maiorAutocorrelacao } from './repeticao.testkit'
import { BIOMAS, chaoDe, cinzaDe, ladrilhoDe, pintarAntes, pintarRegiao, recortar, registrar, type Regiao } from './chaoNoMundo.testkit'
import { LADO_DO_PEDACO, comecarPedaco, mipDoPedaco, pintarLinhas, pintarPedaco, sementeDoChao, torcaoDaTextura, TORCAO_DO_ASSENTAMENTO, TORCAO_NATURAL } from './chaoNoMundo'
import { texturaDoCatalogo } from '../catalogo'

/**
 * CHÃO SEM REPETIÇÃO (MT7). As metas do plano (seção 3) e da regra 2 do
 * estilo, medidas nos BYTES PINTADOS (o pedaço que a tela recebe), não no
 * ruído cru: 0 blocos iguais de 96 px em 2048 x 2048 e autocorrelação do
 * detalhe <= 0,3 de 16 a 384 px. CONTROLE POSITIVO: o desenho de antes (o
 * ladrilho repetido) tem de reprovar nas MESMAS medidas, no mesmo mapa.
 */

const LADO_DA_PROVA = 2048
const PEDACOS_NA_PROVA = LADO_DA_PROVA / LADO_DO_PEDACO
const LADO_DA_AUTOCORRELACAO = 1024
const BLOCO = 96
const TETO_DA_AUTOCORRELACAO = 0.3

const pintados = new Map<string, Regiao>()
function depois(id: string): Regiao {
  let r = pintados.get(id)
  if (r === undefined) {
    r = pintarRegiao(chaoDe(id), 0, 0, PEDACOS_NA_PROVA, PEDACOS_NA_PROVA)
    pintados.set(id, r)
  }
  return r
}
const antigos = new Map<string, Regiao>()
function antes(id: string): Regiao {
  let r = antigos.get(id)
  if (r === undefined) {
    r = pintarAntes(ladrilhoDe(id), chaoDe(id).ladoNoMundo, LADO_DA_PROVA, LADO_DA_PROVA)
    antigos.set(id, r)
  }
  return r
}

function fnv(bytes: Uint8ClampedArray): number {
  let h = 2166136261
  for (let i = 0; i < bytes.length; i += 1) h = Math.imul(h ^ bytes[i], 16777619)
  return h >>> 0
}

/** Saturação HSV p95, croma OKLab médio e a menor luz OKLab da região (1 pixel a cada 7, para andar rápido). */
function cores(r: Regiao): { saturacaoP95: number; cromaMedio: number; menorLuz: number } {
  const saturacoes: number[] = []
  let croma = 0
  let menorLuz = Infinity
  let n = 0
  for (let i = 0; i < r.largura * r.altura; i += 7) {
    const R = r.rgba[i * 4]
    const G = r.rgba[i * 4 + 1]
    const B = r.rgba[i * 4 + 2]
    const max = Math.max(R, G, B)
    saturacoes.push(max === 0 ? 0 : (max - Math.min(R, G, B)) / max)
    const [L, a, b] = oklabDoRgb(R, G, B)
    croma += Math.hypot(a, b)
    menorLuz = Math.min(menorLuz, L)
    n += 1
  }
  saturacoes.sort((x, y) => x - y)
  return { saturacaoP95: saturacoes[Math.floor(saturacoes.length * 0.95)], cromaMedio: croma / n, menorLuz }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('o chão pintado não repete (MT7)', { timeout: 120_000 }, () => {
  it.each(BIOMAS)('%s: 0 blocos iguais de 96 px em 2048 x 2048, e o ladrilho de antes repete (controle)', (id) => {
    const novo = blocosIguais(cinzaDe(depois(id)), BLOCO)
    const velho = blocosIguais(cinzaDe(antes(id)), BLOCO)
    registrar(`[medida] ${id}: blocos de 96 iguais, depois ${novo.iguais} de ${novo.blocos}; antes ${velho.iguais} de ${velho.blocos}`)
    expect(novo.blocos).toBe(441)
    expect(novo.iguais).toBe(0)
    expect(velho.iguais, 'controle: o ladrilho de antes tem de repetir blocos').toBeGreaterThan(100)
  })

  it.each(BIOMAS)('%s: autocorrelação do detalhe <= 0,3 de 16 a 384 px, e a do ladrilho de antes passa de 0,3 (controle)', (id) => {
    const novo = maiorAutocorrelacao(cinzaDe(recortar(depois(id), 0, 0, LADO_DA_AUTOCORRELACAO, LADO_DA_AUTOCORRELACAO)))
    const velho = maiorAutocorrelacao(cinzaDe(recortar(antes(id), 0, 0, LADO_DA_AUTOCORRELACAO, LADO_DA_AUTOCORRELACAO)))
    registrar(`[medida] ${id}: pico da autocorrelação, depois ${novo.r.toFixed(3)} (${novo.atraso} px em ${novo.eixo}); antes ${velho.r.toFixed(3)} (${velho.atraso} px em ${velho.eixo})`)
    expect(novo.r).toBeLessThanOrEqual(TETO_DA_AUTOCORRELACAO)
    expect(velho.r, 'controle: o ladrilho de antes tem de ter pico acima do teto').toBeGreaterThan(TETO_DA_AUTOCORRELACAO)
  })

  it.each(BIOMAS)('%s, mutação: SEM a torção (só manchas e grão) a autocorrelação reprova — é a torção que tira a repetição', (id) => {
    const semTorcao = { ...chaoDe(id), torcao: 0 }
    const r = maiorAutocorrelacao(cinzaDe(pintarRegiao(semTorcao, 0, 0, 4, 4)))
    registrar(`[medida] ${id} sem torção: pico ${r.r.toFixed(3)} (${r.atraso} px em ${r.eixo})`)
    expect(r.r).toBeGreaterThan(TETO_DA_AUTOCORRELACAO)
  })

  it.each(BIOMAS)('%s: cor contida (saturação p95 e croma médio no máximo os de antes, com folga mínima) e sem preto novo', (id) => {
    const novo = cores(depois(id))
    const velho = cores(antes(id))
    registrar(
      `[medida] ${id}: saturação p95 ${novo.saturacaoP95.toFixed(3)} (antes ${velho.saturacaoP95.toFixed(3)}); croma médio ${novo.cromaMedio.toFixed(4)} (antes ${velho.cromaMedio.toFixed(4)}); menor luz ${novo.menorLuz.toFixed(3)} (antes ${velho.menorLuz.toFixed(3)})`,
    )
    expect(novo.saturacaoP95).toBeLessThanOrEqual(velho.saturacaoP95 + 0.02)
    expect(novo.cromaMedio).toBeLessThanOrEqual(velho.cromaMedio + 0.004)
    // A sombra das manchas escurece até 13% (a do protótipo): o mais escuro de depois fica no máximo 13% abaixo do de antes, nunca vira contorno preto.
    expect(novo.menorLuz).toBeGreaterThanOrEqual(velho.menorLuz * (1 - 0.13))
    expect(novo.menorLuz).toBeGreaterThan(0.06)
  })
})

describe('o pedaço (MT7)', () => {
  it('mesma entrada, mesmos bytes; pintar em fatias de linhas dá os mesmos bytes de pintar de uma vez', () => {
    const chao = chaoDe('grama')
    const pedaco = { i: 3, j: 5, nivel: 0 }
    const inteiro = pintarPedaco(chao, pedaco)
    expect(fnv(pintarPedaco(chao, pedaco))).toBe(fnv(inteiro))
    const emFatias = comecarPedaco(chao, pedaco)
    for (const ate of [1, 2, 9, 64, 65, 200, 256]) pintarLinhas(chao, pedaco, emFatias, ate)
    expect(fnv(emFatias.pixels)).toBe(fnv(inteiro))
  })

  it('sem emenda: a diferença entre a última coluna de um pedaço e a primeira do vizinho é a de dentro do pedaço', () => {
    const regiao = pintarRegiao(chaoDe('terra'), 0, 0, 2, 2)
    const { luz, largura } = cinzaDe(regiao)
    const salto = (x: number) => {
      let s = 0
      for (let y = 0; y < regiao.altura; y += 1) s += Math.abs(luz[y * largura + x + 1] - luz[y * largura + x])
      return s / regiao.altura
    }
    let dentro = 0
    for (let x = 100; x < 140; x += 1) dentro += salto(x)
    dentro /= 40
    const naEmenda = salto(LADO_DO_PEDACO - 1)
    registrar(`[medida] salto médio de luz na emenda ${naEmenda.toFixed(2)}, dentro do pedaço ${dentro.toFixed(2)}`)
    expect(naEmenda).toBeLessThanOrEqual(dentro * 1.5)
  })

  it('o nível afastado tem a mesma cor média do nível 0 na mesma área (sem salto de tom ao trocar de nível)', () => {
    const chao = chaoDe('floresta')
    // O pedaço (0, 0) do nível 2 cobre os 4 x 4 pedaços do nível 0.
    const perto = pintarRegiao(chao, 0, 0, 4, 4, 0)
    const longe = pintarPedaco(chao, { i: 0, j: 0, nivel: 2 })
    expect(mipDoPedaco(chao, 2)).toBeGreaterThan(0)
    for (let k = 0; k < 3; k += 1) {
      let a = 0
      for (let i = k; i < perto.rgba.length; i += 4) a += perto.rgba[i]
      let b = 0
      for (let i = k; i < longe.length; i += 4) b += longe[i]
      const mediaPerto = a / (perto.rgba.length / 4)
      const mediaLonge = b / (longe.length / 4)
      expect(Math.abs(mediaPerto - mediaLonge), `canal ${k}: ${mediaPerto.toFixed(1)} contra ${mediaLonge.toFixed(1)}`).toBeLessThan(3)
    }
  })

  it('sem Math.random: a pintura é só conta', () => {
    const sorteio = vi.spyOn(Math, 'random')
    pintarPedaco(chaoDe('terra'), { i: 0, j: 0, nivel: 1 })
    expect(sorteio).not.toHaveBeenCalled()
  })

  it('semente do app: o id da textura, a mesma sempre e diferente entre texturas', () => {
    expect(sementeDoChao('grama')).toBe(sementeDoChao('grama'))
    expect(sementeDoChao('grama')).not.toBe(sementeDoChao('terra'))
    expect(chaoDe('grama').semente).toBe(sementeDoChao('grama'))
  })

  it('as de assentamento em casas não torcem (a junta fica reta); as naturais torcem', () => {
    expect(torcaoDaTextura(texturaDoCatalogo('lajotas'))).toBe(TORCAO_DO_ASSENTAMENTO)
    expect(torcaoDaTextura(texturaDoCatalogo('conves'))).toBe(TORCAO_DO_ASSENTAMENTO)
    expect(torcaoDaTextura(texturaDoCatalogo('grama'))).toBe(TORCAO_NATURAL)
    expect(torcaoDaTextura(null)).toBe(TORCAO_NATURAL)
  })

  it('tempo: um pedaço de 256 x 256 no nível 0 (registrado; o teto folgado da suíte é 60 ms em Node)', () => {
    const chao = chaoDe('floresta')
    pintarPedaco(chao, { i: 40, j: 40, nivel: 0 })
    const tempos: number[] = []
    for (let k = 0; k < 7; k += 1) {
      const t0 = performance.now()
      pintarPedaco(chao, { i: 41 + k, j: 40, nivel: 0 })
      tempos.push(performance.now() - t0)
    }
    tempos.sort((a, b) => a - b)
    registrar(`[medida] pedaço de 256 x 256 no nível 0: mediana ${tempos[3].toFixed(1)} ms, pior ${tempos[6].toFixed(1)} ms`)
    expect(tempos[3]).toBeLessThan(60)
  })
})
