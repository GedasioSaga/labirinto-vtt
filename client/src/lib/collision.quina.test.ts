import { describe, expect, it } from 'vitest'
import { findTokenPath, resolveTokenMove } from './collision'
import type { Wall } from '../types/map'

// Grade de 64 px, fichas no centro da célula: o passo em diagonal entre duas
// células vizinhas passa EXATAMENTE pela quina da grade, que é onde as paredes
// começam e terminam. Só a ponta de uma parede não fecha a passagem; duas
// paredes que se encontram na quina, uma de cada lado do passo, fecham.

function wall(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

// Parede vertical entre as células de cima (x=64, y 0..64); a ponta de baixo fica na quina (64, 64).
const pontaSolta = wall('ponta', 64, 0, 64, 64)
const abaixoDaQuina = { x: 32, y: 96 }
const acimaDaQuina = { x: 96, y: 32 }

describe('passar rente à quina', () => {
  it('diagonal que raspa a ponta solta de uma parede passa', () => {
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta])).toEqual(acimaDaQuina)
    expect(findTokenPath(abaixoDaQuina, acimaDaQuina, [pontaSolta])).toEqual([abaixoDaQuina, acimaDaQuina])
  })

  it('passa nos dois sentidos e com a parede desenhada ao contrário', () => {
    const invertida = wall('invertida', 64, 64, 64, 0)
    expect(resolveTokenMove(acimaDaQuina, abaixoDaQuina, [pontaSolta])).toEqual(abaixoDaQuina)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [invertida])).toEqual(acimaDaQuina)
    // A outra diagonal pela mesma quina, cruzando para o lado de lá da ponta.
    expect(resolveTokenMove({ x: 96, y: 96 }, { x: 32, y: 32 }, [pontaSolta])).toEqual({ x: 32, y: 32 })
  })

  it('parede que continua depois da quina (dois pedaços emendados) bloqueia', () => {
    const continuacao = wall('continua', 64, 64, 64, 128)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, continuacao])).toEqual(abaixoDaQuina)
    expect(findTokenPath(abaixoDaQuina, acimaDaQuina, [pontaSolta, continuacao])).toBeNull()
  })

  it('canto de sala (duas paredes em L) bloqueia quem tenta sair pela quina', () => {
    const baixo = wall('baixo', 0, 64, 64, 64)
    expect(resolveTokenMove({ x: 32, y: 32 }, { x: 96, y: 96 }, [pontaSolta, baixo])).toEqual({ x: 32, y: 32 })
    expect(resolveTokenMove({ x: 96, y: 96 }, { x: 32, y: 32 }, [pontaSolta, baixo])).toEqual({ x: 96, y: 96 })
  })

  it('por fora do L, raspando a quina externa, passa', () => {
    const baixo = wall('baixo', 0, 64, 64, 64)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, baixo])).toEqual(acimaDaQuina)
  })

  it('andar ao longo da linha da parede continua bloqueado', () => {
    expect(resolveTokenMove({ x: 64, y: 100 }, { x: 64, y: -20 }, [pontaSolta])).toEqual({ x: 64, y: 100 })
  })

  it('cruzar a parede no meio continua bloqueado', () => {
    expect(resolveTokenMove({ x: 32, y: 32 }, { x: 96, y: 32 }, [pontaSolta])).toEqual({ x: 32, y: 32 })
  })

  it('terminar o passo em cima da ponta continua bloqueado', () => {
    expect(resolveTokenMove(abaixoDaQuina, { x: 64, y: 64 }, [pontaSolta])).toEqual(abaixoDaQuina)
  })

  it('emenda com porta: fechada, trancada ou secreta fecha a quina; aberta deixa raspar', () => {
    const porta = (door: Wall['door']): Wall => wall('porta', 64, 64, 64, 128, { door })
    const fechada = porta({ open: false, locked: false, kind: 'normal' })
    const trancada = porta({ open: true, locked: true, kind: 'normal' })
    const secreta = porta({ open: true, locked: false, kind: 'normal', secret: true })
    const aberta = porta({ open: true, locked: false, kind: 'normal' })
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, fechada])).toEqual(abaixoDaQuina)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, trancada])).toEqual(abaixoDaQuina)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, secreta])).toEqual(abaixoDaQuina)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, aberta])).toEqual(acimaDaQuina)
  })

  it('emenda com parede decorativa (não barra movimento) deixa raspar', () => {
    const decorativa = wall('deco', 64, 64, 64, 128, { blocksMove: false })
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, decorativa])).toEqual(acimaDaQuina)
  })

  it('raspar a ponta não abre atalho por outra parede que cruza o traço', () => {
    const outra = wall('outra', 0, 90, 128, 90)
    expect(resolveTokenMove(abaixoDaQuina, acimaDaQuina, [pontaSolta, outra])).toEqual(abaixoDaQuina)
  })
})
