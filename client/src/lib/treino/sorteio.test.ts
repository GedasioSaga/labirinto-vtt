/**
 * O SORTEIO DO TREINO (LOBBY v2, fatia T2; aceite em
 * docs/planos/lobby-jogadores-2026-11-05.md §8.2): mesma semente = mesmos 50
 * d20, também depois de pausar em JSON e retomar; todo d20 é inteiro de 1 a
 * 20, e as 20 faces saem.
 */
import { describe, expect, it } from 'vitest'
import { criarSorteio, retomarSorteio, SEMENTE_MAX, type EstadoDoSorteio, type Sorteio } from './sorteio'

const JOGADAS = 50

function d20s(sorteio: Sorteio, quantos: number): number[] {
  return Array.from({ length: quantos }, () => sorteio.d20())
}

describe('sorteio do treino — mesma semente, mesma luta', () => {
  it('a semente 7 dá os mesmos 50 d20 duas vezes; a semente 8 dá outros', () => {
    const primeira = d20s(criarSorteio(7), JOGADAS)
    expect(d20s(criarSorteio(7), JOGADAS)).toEqual(primeira)
    expect(d20s(criarSorteio(8), JOGADAS)).not.toEqual(primeira)
  })

  it('pausada no 20º d20, gravada em JSON e retomada, a luta segue com os mesmos 30 d20', () => {
    const inteira = d20s(criarSorteio(7), JOGADAS)
    const pausada = criarSorteio(7)
    d20s(pausada, 20)
    // JSON.parse devolve any; quem confere os números na volta é o próprio retomarSorteio.
    const gravado: EstadoDoSorteio = JSON.parse(JSON.stringify(pausada.estado()))
    const retomada = retomarSorteio(gravado)
    expect(d20s(retomada, 30)).toEqual(inteira.slice(20))
    expect(retomada.estado()).toMatchObject({ semente: 7, jogadas: JOGADAS })
  })
})

describe('sorteio do treino — o d20', () => {
  it('10 mil d20 em 20 sementes (com 0 e a maior): todo valor é inteiro de 1 a 20, e as 20 faces saem', () => {
    const sementes = [0, 1, 7, SEMENTE_MAX, ...Array.from({ length: 16 }, (_, i) => 1_000 + i * 7_919)]
    const vistas = new Set<number>()
    for (const semente of sementes) {
      for (const valor of d20s(criarSorteio(semente), 500)) {
        expect(Number.isInteger(valor) && valor >= 1 && valor <= 20, `semente ${semente} deu ${valor}`).toBe(true)
        vistas.add(valor)
      }
    }
    expect([...vistas].sort((x, y) => x - y)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
  })
})
