import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TIPOS_MOBILIA } from '../lib/mobilia/tipos'
import { MobiliaIcon } from './icons'

/** O desenho do ícone sem o `<svg>` de fora: só os traços. */
function tracos(tipo: (typeof TIPOS_MOBILIA)[number]): string {
  return renderToStaticMarkup(<MobiliaIcon tipo={tipo} />).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
}

describe('MobiliaIcon: um desenho para cada tipo de objeto', () => {
  it('todo tipo do catálogo (os 11 de antes e as 9 peças novas da MT4) tem traços no ícone', () => {
    for (const tipo of TIPOS_MOBILIA) expect(tracos(tipo), tipo).toMatch(/<(path|rect|circle)/)
  })

  it('os 20 desenhos são diferentes entre si: a setinha não mostra dois objetos com o mesmo ícone', () => {
    const desenhos = TIPOS_MOBILIA.map(tracos)
    expect(new Set(desenhos).size).toBe(TIPOS_MOBILIA.length)
  })

  it('revisão da MT4: cada peça nova tem o traço que a separa da vizinha parecida no menu', () => {
    // Lápide de topo em arco (não o retângulo do baú), com o chão.
    expect(tracos('lapide')).toMatch(/d="M7.5 19.5V10a4.5 4.5/)
    // Mesa redonda: o tampo e as duas juntas longe do meio (não um sinal de menos).
    expect(tracos('mesaRedonda')).toMatch(/M4.8 8.5h14.4M4.8 15.5h14.4/)
    // Poço: o anel de 8 pedras (tracejado) e a trave com o sarilho (não o barril).
    expect(tracos('poco')).toMatch(/stroke-dasharray/)
    expect(tracos('poco')).toMatch(/M3 12h18/)
    // Quadro: dois papéis tortos e dois pés.
    expect(tracos('quadroDeAvisos')).toMatch(/M6.5 16.5v3.5M17.5 16.5v3.5/)
    // Barraca: os 3 gomos (arcos) sob o toldo e o balcão.
    expect((tracos('barraca').match(/a2.67 2.67/g) ?? []).length).toBe(3)
    // Carroça: a caixa, as 2 rodas e o varal.
    expect((tracos('carroca').match(/<circle/g) ?? []).length).toBe(2)
    // Lampião de perfil: a argola em cima, o chapéu e o vidro.
    expect(tracos('lampiao')).toMatch(/<circle cx="12" cy="3.8"/)
  })
})
