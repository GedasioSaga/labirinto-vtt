import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import {
  comAparenciaDoMovel,
  criarMovel,
  movelComOutroTipo,
  normalizarCorDeTecido,
  PALETA_DE_TECIDO,
  propMobiliaFromFile,
  regioesDaCama,
} from './mobilia'

/**
 * CAMA EM TRÊS CORES, sem tela: a "Cor" fica na madeira; travesseiro e
 * cobertor têm cor própria, só na cama e só `#rrggbb`, pela mesma porta no
 * painel, no disco e na troca de tipo.
 */

const GRADE = 40
const CAMA: Prop = criarMovel('catre', { x: 300, y: 200 }, GRADE, 'c1')

describe('cama — cores de tecido', () => {
  it('a porta: só na cama, só cor de verdade; #ABC vira #aabbcc', () => {
    expect(normalizarCorDeTecido('catre', '#ABC')).toBe('#aabbcc')
    expect(normalizarCorDeTecido('catre', '#9a3f36')).toBe('#9a3f36')
    for (const torto of ['red', 'url(x)', ' #9a3f36', 0x9a3f36, null, undefined]) expect(normalizarCorDeTecido('catre', torto), String(torto)).toBeUndefined()
    expect(normalizarCorDeTecido('mesa', '#9a3f36')).toBeUndefined()
    expect(normalizarCorDeTecido(undefined, '#9a3f36')).toBeUndefined()
  })

  it('painel: a cor entra normalizada, a torta é ignorada (fica a de antes), null tira o campo', () => {
    const pintada = comAparenciaDoMovel(CAMA, { corDoTravesseiro: '#E6E1D6' })
    expect(pintada.mobiliaCorDoTravesseiro).toBe('#e6e1d6')
    expect(comAparenciaDoMovel(pintada, { corDoTravesseiro: 'nada' }).mobiliaCorDoTravesseiro).toBe('#e6e1d6')
    expect(comAparenciaDoMovel(pintada, { corDoTravesseiro: null })).toEqual(CAMA)
    const coberta = comAparenciaDoMovel(CAMA, { corDoCobertor: '#46638a' })
    expect(coberta).toEqual({ ...CAMA, mobiliaCorDoCobertor: '#46638a' })
    // Em outro tipo o pedido não muda nada.
    const mesa = criarMovel('mesa', { x: 0, y: 0 }, GRADE, 'm1')
    expect(comAparenciaDoMovel(mesa, { corDoCobertor: '#46638a' })).toEqual(mesa)
  })

  it('disco: cor torta some, cor fora da cama some, a boa fica no mesmo objeto', () => {
    const boa = { ...CAMA, mobiliaCorDoTravesseiro: '#e6e1d6', mobiliaCorDoCobertor: '#46638a' }
    expect(propMobiliaFromFile(boa)).toBe(boa)
    const torta = propMobiliaFromFile({ ...CAMA, mobiliaCorDoTravesseiro: 'url(javascript:x)', mobiliaCorDoCobertor: '#A50' })
    expect(torta).not.toHaveProperty('mobiliaCorDoTravesseiro')
    expect(torta.mobiliaCorDoCobertor).toBe('#aa5500')
    const naMesa = propMobiliaFromFile({ ...criarMovel('mesa', { x: 0, y: 0 }, GRADE, 'm1'), mobiliaCorDoCobertor: '#46638a' })
    expect(naMesa).not.toHaveProperty('mobiliaCorDoCobertor')
  })

  it('trocar o tipo tira as cores de tecido; a "Cor" fica', () => {
    const pintada = { ...CAMA, mobiliaCor: '#7a5838', mobiliaCorDoTravesseiro: '#e6e1d6', mobiliaCorDoCobertor: '#46638a' }
    const mesa = movelComOutroTipo(pintada, 'mesa', GRADE)
    expect(mesa.mobiliaCor).toBe('#7a5838')
    expect(mesa).not.toHaveProperty('mobiliaCorDoTravesseiro')
    expect(mesa).not.toHaveProperty('mobiliaCorDoCobertor')
  })

  it('a paleta: 8 tons de tecido, todos #rrggbb e contidos (saturação HSL abaixo de 50%)', () => {
    expect(PALETA_DE_TECIDO.map((t) => t.nome)).toEqual(['Branco', 'Creme', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Roxo', 'Castanho'])
    for (const { cor } of PALETA_DE_TECIDO) {
      expect(normalizarCorDeTecido('catre', cor)).toBe(cor)
      const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(cor.slice(i, i + 2), 16) / 255)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const luz = (max + min) / 2
      const saturacao = max === min ? 0 : (max - min) / (1 - Math.abs(2 * luz - 1))
      expect(saturacao, cor).toBeLessThan(0.5)
    }
  })
})

describe('cama — áreas de tecido', () => {
  it('sem cor própria, nenhuma área: a cama sai como hoje', () => {
    expect(regioesDaCama(40, 80, false, false)).toEqual([])
    expect(regioesDaCama(0, 80, true, true)).toEqual([])
  })

  it('o travesseiro é o retângulo do glifo; o cobertor vai da dobra ao pé, com a madeira à vista (0,07 do lado menor)', () => {
    const [cobertor, travesseiro] = regioesDaCama(40, 80, true, true)
    expect(cobertor?.tom).toBe('cobertor')
    const beira = 40 * 0.07
    expect(cobertor?.pontos).toEqual([
      { x: -20 + beira, y: -40 + 80 * 0.42 },
      { x: 20 - beira, y: -40 + 80 * 0.42 },
      { x: 20 - beira, y: 40 - beira },
      { x: -20 + beira, y: 40 - beira },
    ])
    expect(travesseiro?.tom).toBe('travesseiro')
    const recuo = 40 * 0.12
    expect(travesseiro?.pontos[0]).toEqual({ x: -20 + recuo, y: -40 + recuo })
    expect(travesseiro?.pontos[2]).toEqual({ x: 20 - recuo, y: -40 + recuo + 80 * 0.18 })
  })
})
