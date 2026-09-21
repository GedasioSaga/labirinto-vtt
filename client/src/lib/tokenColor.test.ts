import { describe, expect, it } from 'vitest'
import type { Token } from '../types/map'
import { TOKEN_COLOR_DEFAULT, TOKEN_COLOR_OPTIONS, parseHexColor, selectedTokenColor, tokenColorName, tokenFillColor } from './tokenColor'

/** Ficha crua, do jeito que um mapa salvo ANTES deste campo devolve: sem `color` nenhum. */
const fichaDeAntes: Token = { id: 't1', characterId: null, name: 'Herói', x: 0, y: 0, size: 1, image: null }

describe('cor da ficha — o que a tela pinta', () => {
  it('ficha salva antes desta feature continua no azul de sempre', () => {
    expect(tokenFillColor(fichaDeAntes)).toBe(TOKEN_COLOR_DEFAULT)
    expect(tokenFillColor({ color: null })).toBe(TOKEN_COLOR_DEFAULT)
  })

  it('cor escolhida pelo mestre vira o número que o Pixi pinta', () => {
    expect(tokenFillColor({ color: '#35b24a' })).toBe(0x35b24a)
  })

  it('cor podre do disco cai no default em vez de virar NaN', () => {
    // Sem isto, `fill({ color: NaN })` pinta preto e a ficha some no chão
    // escuro — falha silenciosa, sem erro em lugar nenhum.
    for (const podre of ['', '#ggghhh', '#35b24', 'verde', 'rgb(0,0,0)', 42, {}, undefined, null]) {
      expect(parseHexColor(podre), `"${String(podre)}" não podia virar cor`).toBeNull()
    }
    expect(tokenFillColor({ color: '#ggghhh' })).toBe(TOKEN_COLOR_DEFAULT)
  })

  it('CONTROLE POSITIVO: a varredura acima tem dente — a cor BOA passa', () => {
    // Um `parseHexColor` que devolvesse null sempre deixaria o caso de cima
    // verde sem provar nada.
    expect(parseHexColor('#35b24a')).toBe(0x35b24a)
  })
})

describe('cor da ficha — o que o painel marca', () => {
  it('ficha sem cor não marca botão nenhum', () => {
    expect(selectedTokenColor(fichaDeAntes)).toBeNull()
  })

  it('cor em MAIÚSCULA, vinda de mapa editado à mão, marca o mesmo botão', () => {
    expect(selectedTokenColor({ color: '#35B24A' })).toBe('#35b24a')
  })

  it('toda opção do punhado é `#rrggbb` minúsculo, que é o que o painel compara', () => {
    for (const opcao of TOKEN_COLOR_OPTIONS) expect(selectedTokenColor({ color: opcao.value })).toBe(opcao.value)
  })

  it('o nome acessível leva o papel de mesa quando ele existe', () => {
    expect(TOKEN_COLOR_OPTIONS.map(tokenColorName)).toContain('Verde — aliado')
    expect(TOKEN_COLOR_OPTIONS.map(tokenColorName)).toContain('Vermelho — inimigo')
    expect(tokenColorName({ value: '#9a5fd0', label: 'Roxo', role: null })).toBe('Roxo')
  })
})
