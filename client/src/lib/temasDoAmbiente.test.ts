/**
 * TEMA DO AMBIENTE por mapa e por piso (pedido de 17/11/2026): o resolvedor
 * (o tema do piso vence o do mapa), a conta com o período (o tema substitui a
 * tinta da tarde e da noite; Normal deixa a noite como está) e a leitura do
 * que viaja ao jogador (o fator das luzes e a tinta do piso de baixo).
 */
import { describe, expect, it } from 'vitest'
import { corDaTinta, tintaDaCena, tintaDoJogador } from '../pixi/mapaDeLuz'
import type { MapData } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { AMBIENTE_PADRAO, lerLuzDoJogador, luzDoPisoDeBaixo, luzParaJogador } from './periodo'
import { comTemaDoMapa, comTemaDoPiso, temaDoPiso } from './temasDoAmbiente'

function mapa(extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('tema', 'Castelo', 20, 20, 64), ...extra }
}

describe('temaDoPiso (o resolvedor)', () => {
  it('o tema do piso vence o do mapa; Normal no piso é o piso sem tema; piso sem entrada segue o mapa', () => {
    const castelo = mapa({ tema: { id: 'tocha' }, temasDosPisos: [{ piso: 2, tema: { id: 'escuro' } }, { piso: 1, tema: { id: 'normal' } }] })
    expect(temaDoPiso(castelo, 0)).toEqual({ id: 'tocha' })
    expect(temaDoPiso(castelo, 2)).toEqual({ id: 'escuro' })
    expect(temaDoPiso(castelo, 1)).toEqual({ id: 'normal' })
    expect(temaDoPiso(mapa(), 3)).toBeUndefined()
  })

  it('gravar: Normal no mapa e "Do mapa" no piso tiram o campo; a mesma escolha devolve o mesmo mapa', () => {
    const comTocha = comTemaDoMapa(mapa(), { id: 'tocha', forca: 0.8 })
    expect(comTocha.tema).toEqual({ id: 'tocha', forca: 0.8 })
    expect(comTemaDoMapa(comTocha, { id: 'tocha', forca: 0.8 })).toBe(comTocha)
    expect('tema' in comTemaDoMapa(comTocha, { id: 'normal' })).toBe(false)
    const comPiso = comTemaDoPiso(comTocha, 2, { id: 'escuro' })
    expect(comPiso.temasDosPisos).toEqual([{ piso: 2, tema: { id: 'escuro' } }])
    expect('temasDosPisos' in comTemaDoPiso(comPiso, 2, undefined)).toBe(false)
  })
})

describe('o tema com o período', () => {
  it('cena interior de dia com Escuro: a tinta do tema e as luzes inteiras; sem tema, nada (como antes)', () => {
    const interior = mapa({ tema: { id: 'escuro' } })
    expect(luzParaJogador(interior, 'dia')).toEqual({ periodo: 'dia', cor: '#1c1f26', forca: 0.55, fatorDaLuz: 1 })
    const tinta = tintaDaCena(interior, 'dia', 1, temaDoPiso(interior, 0))
    expect(tinta).toEqual({ periodo: 'dia', rgb: corDaTinta({ cor: '#1c1f26', forca: 0.55 }), alfa: 1, fatorDaLuz: 1 })
    expect(tintaDoJogador(luzParaJogador(interior, 'dia'))).toEqual(tinta)
    expect(luzParaJogador(mapa(), 'dia')).toBeNull()
  })

  it('à noite: Normal mantém a noite sem campo novo; Tocha substitui a cor e as luzes ficam no maior fator (1)', () => {
    const externa = mapa({ externa: true, temasDosPisos: [{ piso: 1, tema: { id: 'tocha' } }] })
    expect(luzParaJogador(externa, 'noite', 0)).toEqual({ periodo: 'noite', ...AMBIENTE_PADRAO.noite })
    expect(luzParaJogador(externa, 'noite', 1)).toEqual({ periodo: 'noite', cor: '#d9742c', forca: 0.65, fatorDaLuz: 1 })
    // De dia, a Tocha fica discreta: as luzes entram a 0,3 (decisão do mestre).
    expect(luzParaJogador(externa, 'dia', 1)?.fatorDaLuz).toBe(0.3)
  })
})

describe('o que viaja ao jogador', () => {
  it('lerLuzDoJogador: o fator das luzes entre 0 e 1 passa; fora disso a mensagem cai; ausente fica ausente', () => {
    expect(lerLuzDoJogador({ periodo: 'dia', cor: '#d9742c', forca: 0.65, fatorDaLuz: 0.3 })).toEqual({ periodo: 'dia', cor: '#d9742c', forca: 0.65, fatorDaLuz: 0.3 })
    expect(lerLuzDoJogador({ periodo: 'noite', cor: '#465a92', forca: 0.85, fatorDaLuz: 1.5 })).toBeNull()
    expect(lerLuzDoJogador({ periodo: 'noite', cor: '#465a92', forca: 0.85 })).toEqual({ periodo: 'noite', cor: '#465a92', forca: 0.85 })
  })

  it('luzDoPisoDeBaixo: igual à do piso dele = nada a mais; embaixo sem tinta e em cima com tema = o branco', () => {
    const semTema = mapa({ externa: true })
    expect(luzDoPisoDeBaixo(semTema, 'noite', 1)).toBeUndefined()
    const muralha = mapa({ temasDosPisos: [{ piso: 1, tema: { id: 'escuro' } }] })
    expect(luzDoPisoDeBaixo(muralha, 'dia', 1)).toEqual({ periodo: 'dia', cor: '#ffffff', forca: 0 })
    expect(tintaDoJogador(luzDoPisoDeBaixo(muralha, 'dia', 1))).toBeNull()
  })
})
