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

// O dedo do jogador não solta no pixel exato: a ficha cai onde ele soltou,
// arredondada, sem encaixe no centro da casa. Soltar 1 px para dentro faz o
// traço cortar a parede a 1 px da ponta — isso ainda é raspar a ponta.
describe('passar rente à quina: soltura fora do pixel exato', () => {
  const grade = 64

  it('soltar 1 px para dentro da diagonal ainda passa', () => {
    const solto = { x: 95, y: 31 }
    expect(resolveTokenMove(abaixoDaQuina, solto, [pontaSolta], grade)).toEqual(solto)
    expect(findTokenPath(abaixoDaQuina, solto, [pontaSolta], grade)).toEqual([abaixoDaQuina, solto])
  })

  it('qualquer soltura a até 8 px do centro da casa diagonal passa', () => {
    const recusadas: string[] = []
    for (let dx = -8; dx <= 8; dx += 1) {
      for (let dy = -8; dy <= 8; dy += 1) {
        const solto = { x: acimaDaQuina.x + dx, y: acimaDaQuina.y + dy }
        if (findTokenPath(abaixoDaQuina, solto, [pontaSolta], grade) === null) recusadas.push(`${solto.x},${solto.y}`)
      }
    }
    expect(recusadas).toEqual([])
  })

  it('com a parede continuando depois da quina, nenhuma dessas solturas passa', () => {
    const continuacao = wall('continua', 64, 64, 64, 128)
    const aceitas: string[] = []
    for (let dx = -8; dx <= 8; dx += 1) {
      for (let dy = -8; dy <= 8; dy += 1) {
        const solto = { x: acimaDaQuina.x + dx, y: acimaDaQuina.y + dy }
        if (findTokenPath(abaixoDaQuina, solto, [pontaSolta, continuacao], grade) !== null) aceitas.push(`${solto.x},${solto.y}`)
      }
    }
    expect(aceitas).toEqual([])
  })

  it('canto de sala: sair pela quina desviando 1 px para qualquer lado continua bloqueado', () => {
    const baixo = wall('baixo', 0, 64, 64, 64)
    const dentro = { x: 32, y: 32 }
    for (const solto of [{ x: 97, y: 95 }, { x: 95, y: 97 }, { x: 96, y: 96 }]) {
      expect(resolveTokenMove(dentro, solto, [pontaSolta, baixo], grade)).toEqual(dentro)
    }
  })

  it('por fora do L, desviando 1 px para dentro, passa', () => {
    const baixo = wall('baixo', 0, 64, 64, 64)
    const solto = { x: 95, y: 31 }
    expect(resolveTokenMove(abaixoDaQuina, solto, [pontaSolta, baixo], grade)).toEqual(solto)
  })

  it('cortar a parede longe da ponta (mais de 1/4 da casa) continua bloqueado', () => {
    // Cruza x = 64 em y ≈ 42,7: 21 px acima da ponta.
    expect(resolveTokenMove(abaixoDaQuina, { x: 80, y: 16 }, [pontaSolta], grade)).toEqual(abaixoDaQuina)
    // Cruza x = 64 em y = 48: 16 px da ponta, exatamente a folga — ainda raspa.
    expect(resolveTokenMove(abaixoDaQuina, { x: 96, y: 0 }, [pontaSolta], grade)).toEqual({ x: 96, y: 0 })
  })

  it('toquinho de parede curto não vira passagem: cruzar o meio dele bloqueia', () => {
    const toco = wall('toco', 64, 56, 64, 72)
    expect(resolveTokenMove({ x: 32, y: 64 }, { x: 96, y: 64 }, [toco], grade)).toEqual({ x: 32, y: 64 })
  })

  it('terminar o passo em cima da parede, perto da ponta, continua bloqueado', () => {
    expect(resolveTokenMove(abaixoDaQuina, { x: 64, y: 60 }, [pontaSolta], grade)).toEqual(abaixoDaQuina)
  })
})
