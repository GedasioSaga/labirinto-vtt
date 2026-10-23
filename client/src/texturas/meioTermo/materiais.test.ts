import { describe, expect, it } from 'vitest'
import type { TipoMobilia } from '../../lib/mobilia/tipos'
import { TIPOS_MOBILIA } from '../../lib/mobilia/tipos'
import { ehMaterial, LUGARES_DE_MATERIAL, MATERIAIS, materialMaisPerto, oklabDoHex, type LugarDeMaterial } from './materiais'

/**
 * MATERIAIS no lugar da cor livre (`docs/design/objetos/README.md:44-58`).
 * O painel vai gravar o hex OFICIAL do material nos campos de cor que já
 * existem; o desenho pega o material mais perto em OKLab dentro da lista do
 * lugar. Assim o mapa antigo migra no desenho, sem regravar o arquivo.
 *
 * Os 3 exemplos do plano, escritos antes do código:
 *   #8b6b47 (madeira do barril)   -> carvalho
 *   #6d3337 (cobertor da cama)    -> lã vinho
 *   #000000 (qualquer lugar)      -> o material mais escuro daquele lugar
 */

function lugar(tipo: TipoMobilia, id: string): LugarDeMaterial {
  const achado = LUGARES_DE_MATERIAL[tipo].find((l) => l.id === id)
  if (achado === undefined) throw new Error(`lugar ${tipo}.${id} sumiu`)
  return achado
}

describe('materialMaisPerto (os 3 exemplos do plano)', () => {
  it('#8b6b47 vira carvalho na madeira do barril', () => {
    expect(materialMaisPerto('#8b6b47', lugar('barril', 'madeira'))).toBe('carvalho')
  })

  it('#6d3337 vira lã vinho no cobertor da cama', () => {
    expect(materialMaisPerto('#6d3337', lugar('catre', 'cobertor'))).toBe('vinho')
  })

  it('#000000 vira o mais escuro do lugar', () => {
    expect(materialMaisPerto('#000000', lugar('barril', 'madeira'))).toBe('nogueira')
    expect(materialMaisPerto('#000000', lugar('catre', 'cobertor'))).toBe('vinho')
    expect(materialMaisPerto('#000000', lugar('fogueira', 'pedras'))).toBe('ardosia')
    expect(materialMaisPerto('#000000', lugar('barril', 'aros'))).toBe('ferro')
    expect(materialMaisPerto('#000000', lugar('fogueira', 'lenha'))).toBe('lenhaCarvalho')
  })

  it('em todo lugar de todo móvel, o preto vira a opção de menor luz (L do OKLab)', () => {
    for (const tipo of TIPOS_MOBILIA) {
      for (const l of LUGARES_DE_MATERIAL[tipo]) {
        const reais = l.opcoes.filter(ehMaterial)
        const maisEscuro = reais.reduce((a, b) => (oklabDoHex(MATERIAIS[b].hex)[0] < oklabDoHex(MATERIAIS[a].hex)[0] ? b : a))
        expect(materialMaisPerto('#000000', l), `${tipo}.${l.id}`).toBe(maisEscuro)
      }
    }
  })

  it('o hex oficial de cada material volta a ele mesmo em todo lugar que o oferece', () => {
    for (const tipo of TIPOS_MOBILIA) {
      for (const l of LUGARES_DE_MATERIAL[tipo]) {
        for (const id of l.opcoes.filter(ehMaterial)) expect(materialMaisPerto(MATERIAIS[id].hex, l), `${tipo}.${l.id}.${id}`).toBe(id)
      }
    }
  })

  it('maiúscula vale igual; cor ausente ou lixo vira o padrão do lugar', () => {
    expect(materialMaisPerto('#8B6B47', lugar('barril', 'madeira'))).toBe('carvalho')
    expect(materialMaisPerto(undefined, lugar('barril', 'madeira'))).toBe('carvalho')
    expect(materialMaisPerto('', lugar('caixa', 'madeira'))).toBe('pinho')
    expect(materialMaisPerto('#abc', lugar('tapete', 'tecido'))).toBe('azul')
    expect(materialMaisPerto('vermelho', lugar('cerca', 'ligacao'))).toBe('varas')
  })

  it('opção que usa a madeira do próprio móvel (mesma, varas) não entra na conta de cor', () => {
    expect(materialMaisPerto('#000000', lugar('cadeira', 'assento'))).toBe('palha')
    expect(materialMaisPerto('#8b6b47', lugar('cerca', 'ligacao'))).toBe('corda')
  })
})

describe('tabela de materiais (objetos/README.md:44-58)', () => {
  it('os tons oficiais da linha 58', () => {
    const oficiais = Object.fromEntries(Object.values(MATERIAIS).map((m) => [m.id, m.hex]))
    expect(oficiais).toMatchObject({
      carvalho: '#8b6b47', nogueira: '#5f4532', pinho: '#a3875f', velha: '#7b776e', cerejeira: '#7c4b37',
      ferro: '#4c4e51', latao: '#9c8044', linho: '#c1b59c', vinho: '#6d3337', azul: '#41526a', musgo: '#5a6344', ocre: '#977842',
      granito: '#7e7b76', arenito: '#9a8669', ardosia: '#585d61',
    })
  })

  it('cada móvel com os lugares e o padrão (em negrito na tabela)', () => {
    const padroes = Object.fromEntries(TIPOS_MOBILIA.map((tipo) => [tipo, LUGARES_DE_MATERIAL[tipo].map((l) => `${l.id}:${l.padrao}`)]))
    expect(padroes).toEqual({
      barril: ['madeira:carvalho', 'aros:ferro'],
      caixa: ['madeira:pinho'],
      bau: ['madeira:nogueira', 'ferragens:latao'],
      catre: ['madeira:carvalho', 'cobertor:vinho', 'travesseiro:linho'],
      mesa: ['madeira:carvalho'],
      cadeira: ['madeira:carvalho', 'assento:palha'],
      cerca: ['madeira:carvalho', 'ligacao:varas'],
      armario: ['madeira:pinho', 'puxadores:ferro'],
      aparador: ['madeira:nogueira', 'puxadores:latao'],
      fogueira: ['pedras:granito', 'lenha:lenhaCarvalho'],
      tapete: ['tecido:azul'],
    })
  })

  it('o padrão de cada lugar está entre as opções dele', () => {
    for (const tipo of TIPOS_MOBILIA) for (const l of LUGARES_DE_MATERIAL[tipo]) expect(l.opcoes, `${tipo}.${l.id}`).toContain(l.padrao)
  })

  it('os tons do Meio-Termo (meio.js, tabela TROCA): mais claros e quentes, com os acertos da revisão de design da MT2', () => {
    // carvalho x 0,91 e velha (granito) x 0,78 no móvel: com o tom do token sumiam no chão do app
    expect(MATERIAIS.carvalho.tom).toBe('#92704a')
    expect(MATERIAIS.velha.tom).toBe('#78756c')
    // tons próprios: a cerejeira deixa de ser "nogueira x 1,12" e a lã azul de ser a telha azul
    expect(MATERIAIS.cerejeira.tom).toBe('#926149')
    expect(MATERIAIS.azul.tom).toBe('#4b648e')
    expect(MATERIAIS.nogueira.tom).toBe('#775739')
    for (const m of Object.values(MATERIAIS)) expect(m.tom, m.id).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('a lã azul fica com croma 0,075 (a telha azul tinha 0,096) e a mesma luz', () => {
    const [L, a, b] = oklabDoHex(MATERIAIS.azul.tom)
    const [Lt] = oklabDoHex('#43639a')
    expect(Math.hypot(a, b)).toBeCloseTo(0.075, 2)
    expect(Math.abs(L - Lt)).toBeLessThan(0.005)
  })
})

describe('materialMaisPerto: a conta é em OKLab, não em RGB', () => {
  it('cor livre em que o mais perto em OKLab e o mais perto em RGB são madeiras DIFERENTES: vale o OKLab', () => {
    const madeiras = lugar('barril', 'madeira')
    const cor = '#2828a3'
    const reais = madeiras.opcoes.filter(ehMaterial)
    const canais = (hex: string): number[] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    const emRgb = (hex: string): number => Math.hypot(...canais(hex).map((c, i) => c - canais(cor)[i]))
    const maisPertoEmRgb = reais.reduce((x, y) => (emRgb(MATERIAIS[y].hex) < emRgb(MATERIAIS[x].hex) ? y : x))
    expect(maisPertoEmRgb).toBe('velha')
    expect(materialMaisPerto(cor, madeiras)).toBe('nogueira')
  })
})

describe('oklabDoHex', () => {
  it('branco tem L 1 e o preto L 0, ambos sem cor', () => {
    const [Lb, ab, bb] = oklabDoHex('#ffffff')
    expect(Lb).toBeCloseTo(1, 3)
    expect(ab).toBeCloseTo(0, 3)
    expect(bb).toBeCloseTo(0, 3)
    expect(oklabDoHex('#000000')).toEqual([0, 0, 0])
  })
})
