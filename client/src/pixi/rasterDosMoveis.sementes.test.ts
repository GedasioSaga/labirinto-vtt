import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { G } from '../texturas/meioTermo/moveis/contexto'
import { escalaDoNivel, pintarMovel, type DesenhoDoMovel } from '../texturas/meioTermo/moveis'
import { medirImagem } from '../texturas/meioTermo/moveis/medidas.testkit'
import { chaveDoMovel, SEMENTES } from './rasterDosMoveis'

/**
 * O CONTORNO com a SEMENTE QUE O APP DÁ. O teste dos móveis
 * (`texturas/meioTermo/moveis/moveis.test.ts`) fixa a semente 7; o app usa o
 * hash do desenho (`chaveDoMovel`, 0 a 999). Antes do preto levantado, com a
 * semente real o contorno reprovava em produção: o baú de frente em madeira
 * velha e latão, semente 661, nível 3, chegava a 0,054; e 6 das 1000 sementes
 * tinham pixel abaixo de 0,06.
 *
 * A nogueira NÃO é o pior caso do contorno: a madeira velha (cinza, fria) com
 * latão ou ferro é. Aqui entram as duas, nos níveis 1, 2 e 3, e a varredura
 * das 1000 sementes no pior tipo no nível 3.
 */

const CONTORNO_MINIMO = 0.06
const LUMINANCIA_LINEAR_MINIMA = 0.03
/** Os tons oficiais (o que o painel grava nos campos de cor). */
const HEX = { velha: '#7b776e', nogueira: '#5f4532', carvalho: '#8b6b47', latao: '#9c8044', ferro: '#4c4e51' } as const

function movel(mobilia: 'bau' | 'barril', madeira: keyof typeof HEX, metal: keyof typeof HEX): Prop {
  const tamanho = mobilia === 'bau' ? { width: 50, height: 30 } : { width: 35, height: 35 }
  return { id: 'm', src: '', x: 0, y: 0, linkedMapPath: null, mobilia, mobiliaCor: HEX[madeira], mobiliaCorDaLinha: HEX[metal], ...tamanho }
}

/** O desenho que o app pediria para este móvel nesta câmera (nível = câmera x densidade). */
function desenhoDoApp(prop: Prop, nivel: number): DesenhoDoMovel {
  const chave = chaveDoMovel(prop, nivel, 1)
  if (chave === null) throw new Error('móvel sem desenho com textura')
  return chave.desenho
}

function medir(d: DesenhoDoMovel, nivel: number): ReturnType<typeof medirImagem> {
  const S = escalaDoNivel(nivel)
  const { limites, pixels } = pintarMovel(d, S)
  return medirImagem(pixels, limites.W, limites.H, d.casasW * G * S * (d.casasH * G * S))
}

const COMBINACOES: readonly [Prop, string][] = [
  [movel('bau', 'velha', 'latao'), 'baú velha+latão'],
  [movel('bau', 'velha', 'ferro'), 'baú velha+ferro'],
  [movel('bau', 'nogueira', 'latao'), 'baú nogueira+latão'],
  [movel('bau', 'carvalho', 'ferro'), 'baú carvalho+ferro'],
  [movel('barril', 'velha', 'ferro'), 'barril velha+ferro'],
  [movel('barril', 'velha', 'latao'), 'barril velha+latão'],
]

describe('contorno com a semente do app (o hash do desenho)', () => {
  for (const [prop, nome] of COMBINACOES) {
    for (const nivel of [1, 2, 3]) {
      it(`${nome} no nível ${nivel}: contorno ≥ ${CONTORNO_MINIMO} e luminância linear ≥ ${LUMINANCIA_LINEAR_MINIMA}`, () => {
        const d = desenhoDoApp(prop, nivel)
        const m = medir(d, nivel)
        expect(m.contornoMinimo, `semente ${d.semente}`).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
        expect(m.brilhoMinimo, `semente ${d.semente}`).toBeGreaterThanOrEqual(CONTORNO_MINIMO)
        expect(m.luminanciaLinearMinima, `semente ${d.semente}`).toBeGreaterThanOrEqual(LUMINANCIA_LINEAR_MINIMA)
      })
    }
  }
})

describe('as 1000 sementes no pior tipo (baú de frente, madeira velha e latão) no nível 3', () => {
  it(
    'nenhuma semente deixa pixel opaco abaixo do contorno mínimo ou do piso de luz',
    () => {
      const base = desenhoDoApp(movel('bau', 'velha', 'latao'), 3)
      const reprovadas: string[] = []
      for (let semente = 0; semente < SEMENTES; semente += 1) {
        const m = medir({ ...base, semente }, 3)
        if (m.contornoMinimo < CONTORNO_MINIMO || m.brilhoMinimo < CONTORNO_MINIMO || m.luminanciaLinearMinima < LUMINANCIA_LINEAR_MINIMA) {
          reprovadas.push(`${semente}: contorno ${m.contornoMinimo.toFixed(3)}, luz linear ${m.luminanciaLinearMinima.toFixed(4)}`)
        }
      }
      expect(reprovadas).toEqual([])
    },
    180_000,
  )
})
