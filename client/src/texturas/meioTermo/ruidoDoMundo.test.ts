import { describe, expect, it } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from '../embutidas'
import { LADO_DO_LADRILHO, pixelsDoLadrilho } from '../ladrilhos'
import { blocosIguais, maiorAutocorrelacao, type Cinza } from './repeticao.testkit'
import { ESCALAS_DO_RUIDO, ruidoDeValor, ruidoDoMundo, SEMENTE_DAS_MANCHAS } from './ruidoDoMundo'

/**
 * RUÍDO SEM PERÍODO do chão do Meio-Termo (`meio.js:235-283`): 3 escalas
 * (230, 80 e 27 px), lido pela posição no mundo e não por ladrilho. Metas do
 * plano (seção 3), com o critério da prova (i) do protótipo:
 *   - 0 blocos iguais de 96 px numa amostra de 2048 x 2048;
 *   - autocorrelação do detalhe <= 0,3 de 16 a 384 px;
 *   - controle: o ladrilho antigo de grama, repetido, REPROVA nas duas.
 */

const LADO_DA_AMOSTRA = 2048
const BLOCO = 96
const AUTOCORRELACAO_MAXIMA = 0.3
/** A amostra começa em coordenada negativa: o ruído vale dos dois lados da origem. */
const ORIGEM = -1000
/** Digital de `digitalFina()` tirada da primeira implementação (23/10/2026). Mudou o núcleo do ruído, mudou o chão de todo mapa. */
const DIGITAL_FIXA = 3401096083

function byteDoRuido(n: number): number {
  return Math.round((n + 1) * 127.5)
}

function amostraDoRuido(): Cinza {
  const luz = new Uint8Array(LADO_DA_AMOSTRA * LADO_DA_AMOSTRA)
  for (let y = 0; y < LADO_DA_AMOSTRA; y += 1) {
    for (let x = 0; x < LADO_DA_AMOSTRA; x += 1) luz[y * LADO_DA_AMOSTRA + x] = byteDoRuido(ruidoDoMundo(ORIGEM + x + 0.5, ORIGEM + y + 0.5))
  }
  return { largura: LADO_DA_AMOSTRA, altura: LADO_DA_AMOSTRA, luz }
}

/** O controle: o ladrilho de grama de hoje (256 px) repetido no mesmo tamanho, em luz. */
function amostraDoLadrilhoAntigo(): Cinza {
  const grama = TEXTURAS_EMBUTIDAS.find((t) => t.id === 'grama')
  if (grama === undefined) throw new Error('a grama sumiu da biblioteca')
  const lado = LADO_DO_LADRILHO
  const rgba = pixelsDoLadrilho(grama.cor, lado)
  const luz = new Uint8Array(LADO_DA_AMOSTRA * LADO_DA_AMOSTRA)
  for (let y = 0; y < LADO_DA_AMOSTRA; y += 1) {
    for (let x = 0; x < LADO_DA_AMOSTRA; x += 1) {
      const i = ((y % lado) * lado + (x % lado)) * 4
      luz[y * LADO_DA_AMOSTRA + x] = Math.round(0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2])
    }
  }
  return { largura: LADO_DA_AMOSTRA, altura: LADO_DA_AMOSTRA, luz }
}

/** FNV-1a dos bytes: a digital da amostra (só conta inteira, igual em qualquer motor). */
function digital(bytes: Uint8Array): number {
  let h = 2166136261
  for (let i = 0; i < bytes.length; i += 1) h = Math.imul(h ^ bytes[i], 16777619)
  return h >>> 0
}

/** Grade de 64 x 64 pontos espalhados (passo 37,3 px), em milionésimos: pega a fração do ruído, não só o byte. */
function digitalFina(): number {
  let h = 2166136261
  for (let j = 0; j < 64; j += 1) {
    for (let i = 0; i < 64; i += 1) {
      const n = Math.round(ruidoDoMundo(ORIGEM + i * 37.3, ORIGEM + j * 37.3) * 1e6)
      h = Math.imul(h ^ (n & 0xffff), 16777619)
      h = Math.imul(h ^ ((n >>> 16) & 0xffff), 16777619)
    }
  }
  return h >>> 0
}

describe('ruidoDoMundo', () => {
  it('as 3 escalas do protótipo: 230, 80 e 27 px, pesos 0,5, 0,32 e 0,18', () => {
    expect(ESCALAS_DO_RUIDO.map((e) => [e.lado, e.peso])).toEqual([
      [230, 0.5],
      [80, 0.32],
      [27, 0.18],
    ])
  })

  it('fica entre -1 e 1 e varia de verdade', () => {
    let menor = Infinity
    let maior = -Infinity
    for (let y = 0; y < 400; y += 3) {
      for (let x = 0; x < 400; x += 3) {
        const n = ruidoDoMundo(ORIGEM + x * 5.1, ORIGEM + y * 5.1)
        menor = Math.min(menor, n)
        maior = Math.max(maior, n)
      }
    }
    expect(menor).toBeGreaterThanOrEqual(-1)
    expect(maior).toBeLessThanOrEqual(1)
    expect(maior - menor).toBeGreaterThan(0.5)
  })

  it('é determinístico: mesma entrada, mesma saída, e a digital fixa não muda', () => {
    const primeira = digitalFina()
    expect(digitalFina()).toBe(primeira)
    expect(ruidoDoMundo(12.5, -40.25)).toBe(ruidoDoMundo(12.5, -40.25))
    // Digital tirada da primeira implementação; só conta inteira e IEEE no núcleo, então vale em qualquer motor.
    expect(primeira).toBe(DIGITAL_FIXA)
  })

  it('sem repetição em 2048 x 2048: 0 blocos iguais de 96 px e autocorrelação do detalhe <= 0,3 de 16 a 384 px', () => {
    const amostra = amostraDoRuido()
    const repeticao = blocosIguais(amostra, BLOCO)
    expect(repeticao.blocos).toBe(441)
    expect(repeticao.iguais).toBe(0)
    const pico = maiorAutocorrelacao(amostra)
    expect(pico.r).toBeLessThanOrEqual(AUTOCORRELACAO_MAXIMA)
    // E a amostra inteira tem uma digital estável (a mesma imagem em duas aberturas).
    expect(digital(amostra.luz)).toBe(digital(amostraDoRuido().luz))
  }, 60_000)

  it('sem período longo: deslocar 256, 1024 ou 65536 casas do ruído muda o valor (a amostra acima só vê até 384 px)', () => {
    const PERIODOS = [256, 1024, 65536]
    const PONTOS = 32
    for (const P of PERIODOS) {
      let iguais = 0
      for (let k = 0; k < PONTOS; k += 1) {
        const i = k * 7 + 0.37
        const j = k * 3 - 11.61
        if (ruidoDeValor(i + P, j, SEMENTE_DAS_MANCHAS) === ruidoDeValor(i, j, SEMENTE_DAS_MANCHAS)) iguais += 1
        if (ruidoDeValor(i, j + P, SEMENTE_DAS_MANCHAS) === ruidoDeValor(i, j, SEMENTE_DAS_MANCHAS)) iguais += 1
      }
      expect(iguais, `período ${P}`).toBe(0)
    }
  })

  it('controle: o ladrilho antigo de grama, repetido, REPROVA nas duas medidas', () => {
    const amostra = amostraDoLadrilhoAntigo()
    expect(blocosIguais(amostra, BLOCO).iguais).toBeGreaterThan(0)
    const pico = maiorAutocorrelacao(amostra)
    expect(pico.r).toBeGreaterThan(AUTOCORRELACAO_MAXIMA)
    expect(pico.atraso).toBe(LADO_DO_LADRILHO)
  }, 60_000)
})
