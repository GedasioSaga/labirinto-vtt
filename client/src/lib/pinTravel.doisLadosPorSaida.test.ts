import { describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { backPassageOf, exitPassageOf, extrasFollowingMain } from './pinTravel'

/**
 * "Trancar os dois lados" numa encruzilhada com MODO POR SAÍDA: o botão vale
 * para o pino inteiro, então a extra com modo próprio volta a seguir a
 * principal; e o "já está tudo trancado" do painel olha a saída do par que
 * volta até aqui, que pode ser uma extra com modo próprio.
 */

const AQUI = { sceneId: 'vale', pinId: 'a' }

function viagem(extra: Partial<Pin> = {}): Pin {
  return { id: 'p', x: 0, y: 0, kind: 'viagem', description: '', image: null, ...extra }
}

describe('extrasFollowingMain', () => {
  it('tira o modo próprio de toda extra; a que não tinha fica a mesma', () => {
    const semModo = { id: 's3', rotulo: 'Ponte', destino: { sceneId: 'e', pinId: 'e' } }
    const pin = viagem({
      passagem: 'trancada',
      saidas: [{ id: 's2', rotulo: 'Escada', destino: { sceneId: 'c', pinId: 'c' }, passagem: 'livre' }, semModo],
    })
    const saidas = extrasFollowingMain(pin)
    expect(saidas).toEqual([{ id: 's2', rotulo: 'Escada', destino: { sceneId: 'c', pinId: 'c' } }, semModo])
    expect(saidas?.[1]).toBe(semModo)
    expect(exitPassageOf({ ...pin, saidas }, 's2')).toBe('trancada')
  })

  it('só as extras escolhidas: a que leva a outro lugar guarda o modo', () => {
    const pin = viagem({
      saidas: [
        { id: 'volta', rotulo: '', destino: AQUI, passagem: 'livre' },
        { id: 'outra', rotulo: '', destino: { sceneId: 'x', pinId: 'x' }, passagem: 'livre' },
      ],
    })
    const saidas = extrasFollowingMain(pin, (saida) => saida.destino.pinId === AQUI.pinId)
    expect(saidas?.map((saida) => saida.passagem)).toEqual([undefined, 'livre'])
  })

  it('pino sem extras, ou sem modo próprio em nenhuma: nada a gravar', () => {
    expect(extrasFollowingMain(viagem())).toBeUndefined()
    expect(extrasFollowingMain(viagem({ saidas: [{ id: 's2', rotulo: '', destino: AQUI }] }))).toBeUndefined()
  })
})

describe('backPassageOf', () => {
  it('par que volta pela principal: o modo do par', () => {
    expect(backPassageOf(viagem({ destino: AQUI, passagem: 'trancada' }), AQUI)).toBe('trancada')
    expect(backPassageOf(viagem({ destino: AQUI }), AQUI)).toBe('pede')
  })

  it('par que volta por uma extra livre: livre, mesmo com o pino par trancado', () => {
    const par = viagem({
      passagem: 'trancada',
      destino: { sceneId: 'x', pinId: 'x' },
      saidas: [{ id: 'volta', rotulo: 'Escada', destino: AQUI, passagem: 'livre' }],
    })
    expect(backPassageOf(par, AQUI)).toBe('livre')
  })

  it('só é trancada quando TODA saída de volta está trancada', () => {
    const par = viagem({
      passagem: 'trancada',
      destino: AQUI,
      saidas: [{ id: 'volta', rotulo: '', destino: AQUI, passagem: 'pede' }],
    })
    expect(backPassageOf(par, AQUI)).toBe('pede')
    expect(backPassageOf({ ...par, saidas: [{ id: 'volta', rotulo: '', destino: AQUI }] }, AQUI)).toBe('trancada')
  })

  it('par sem saída de volta: o modo do pino par', () => {
    expect(backPassageOf(viagem({ passagem: 'livre' }), AQUI)).toBe('livre')
  })
})
