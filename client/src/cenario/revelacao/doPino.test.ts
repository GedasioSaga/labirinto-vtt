import { describe, expect, it } from 'vitest'
import type { Pin } from '../../types/map'
import { CENARIO_PADRAO, type CenarioDoPino } from '../catalogo'
import { revelacaoDoPino } from './doPino'

const IMAGEM = 'data:image/png;base64,AAAA'
const base: Pin = { id: 'forte', x: 1, y: 1, kind: 'exclamacao', description: ' Muralhas brancas. ', image: null, nome: 'Base da Marinha' }

describe('revelacaoDoPino', () => {
  it('"!" com imagem e animação: a imagem com o cenário, o nome e a descrição aparada', () => {
    const cenario: CenarioDoPino = { ...CENARIO_PADRAO, quando: 'sempre' }
    expect(revelacaoDoPino({ ...base, image: IMAGEM, cenario })).toEqual({
      imagem: { src: IMAGEM, cenario },
      nome: 'Base da Marinha',
      descricao: 'Muralhas brancas.',
      quando: 'sempre',
    })
  })

  it('"!" com imagem e "Não, só o cartão": nada de revelação', () => {
    expect(revelacaoDoPino({ ...base, image: IMAGEM })).toBeNull()
  })

  it('"!" sem imagem: o painel sozinho, da primeira vez', () => {
    expect(revelacaoDoPino(base)).toEqual({ imagem: null, nome: 'Base da Marinha', descricao: 'Muralhas brancas.', quando: 'primeira' })
  })

  it('"!" de item sem imagem: só o cartão com "Pegar", sem revelação na frente', () => {
    expect(revelacaoDoPino({ ...base, item: { nome: 'Chave velha' } as Pin['item'] })).toBeNull()
  })

  it('pino longe (sem texto, sem nome) ou de outro tipo: só o cartão', () => {
    expect(revelacaoDoPino({ ...base, description: '', nome: undefined, longe: true })).toBeNull()
    expect(revelacaoDoPino({ ...base, kind: 'interrogacao' })).toBeNull()
  })

  it('pino sem nome (mapa antigo): sem título, mas com o texto', () => {
    expect(revelacaoDoPino({ ...base, nome: undefined })?.nome).toBe('')
  })
})
