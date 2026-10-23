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
})
