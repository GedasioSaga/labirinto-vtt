import { describe, expect, it } from 'vitest'
import type { PinceladaDeNeblina } from '../types/map'
import {
  comNeblina,
  densidadeDaPincelada,
  densidadeDoMapaInteiro,
  dividirPincelada,
  intensidadeDoMapaInteiro,
  lerNeblina,
  lerNeblinaPintada,
  neblinaParaJogador,
  PINCELADAS_MAX,
  PONTOS_MAX,
  somarPinceladaDeNeblina,
  temNeblina,
} from './neblina'
import { createEmptyMap } from './mapFactory'
import { LADO_DO_RUIDO, pixelsDoRuido } from '../pixi/drawNeblina'

const pincel = (id: string, x0: number, x1: number): PinceladaDeNeblina => ({
  id,
  tipo: 'pincel',
  forca: 0.6,
  raio: 20,
  pontos: [
    { x: x0, y: 50 },
    { x: x1, y: 50 },
  ],
})

describe('neblina', () => {
  it('mapa antigo abre sem neblina; o arquivo torto cai fora; o jogador só recebe a pintada que encosta no que conhece', () => {
    // Sem os campos: nada a desenhar.
    expect(lerNeblina(undefined)).toBeUndefined()
    expect(lerNeblinaPintada(undefined)).toBeUndefined()
    expect(temNeblina({})).toBe(false)
    // Chave lida e presa em 0..100; desligada não cobre.
    expect(lerNeblina({ ligada: true, intensidade: 250 })).toEqual({ ligada: true, intensidade: 100 })
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: false, intensidade: 80 } })).toBe(0)
    expect(intensidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 40 } })).toBeCloseTo(0.4)
    // Passo sem pontos ou de tipo desconhecido sai; o bom fica.
    const lidos = lerNeblinaPintada([pincel('a', 0, 100), { id: 'b', tipo: 'balde', forca: 1, raio: 5, pontos: [{ x: 0, y: 0 }] }, { ...pincel('c', 0, 1), pontos: [] }])
    expect(lidos?.map((p) => p.id)).toEqual(['a'])
    // Recorte: o jogador conhece só x < 300. A pincelada lá longe (x 1000..1200) não vai; a de perto vai.
    const conhece = (p: { x: number }) => p.x < 300
    const recorte = neblinaParaJogador([pincel('perto', 0, 100), pincel('longe', 1000, 1200)], conhece, () => false)
    expect(recorte?.some((p) => p.id.startsWith('perto'))).toBe(true)
    expect(recorte?.some((p) => p.id.startsWith('longe'))).toBe(false)
    // Borracha num piso sem neblina pintada não vira passo.
    expect(somarPinceladaDeNeblina([], { ...pincel('x', 0, 10), tipo: 'borracha' }).resultado).toBe('sem-neblina')
  })

  it('densidade: mapa antigo abre na de antes (50); a chave e o pincel guardam a deles, e o jogador recebe a do pincel', () => {
    // Sem o campo: a densidade de antes do controle.
    expect(densidadeDoMapaInteiro({ neblina: { ligada: true, intensidade: 40 } })).toBe(0.5)
    expect(densidadeDaPincelada({})).toBe(0.5)
    // Lida e presa em 0..100; torta sai (vale a padrão).
    expect(lerNeblina({ ligada: true, intensidade: 40, densidade: 250 })).toEqual({ ligada: true, intensidade: 40, densidade: 100 })
    expect(lerNeblina({ ligada: true, intensidade: 40, densidade: 'muita' })).toEqual({ ligada: true, intensidade: 40 })
    // Só a densidade mudou: mapa novo (passo no desfazer); o mesmo valor (50 = ausente): o MESMO mapa.
    const mapa = { ...createEmptyMap('m', 'M', 10, 10, 50), neblina: { ligada: true, intensidade: 40 } }
    expect(comNeblina(mapa, { ligada: true, intensidade: 40, densidade: 50 })).toBe(mapa)
    expect(comNeblina(mapa, { ligada: true, intensidade: 40, densidade: 80 }).neblina).toEqual({ ligada: true, intensidade: 40, densidade: 80 })
    // Pincel guarda a dele; na borracha a densidade não é lida (ela só tira).
    const lidos = lerNeblinaPintada([{ ...pincel('a', 0, 100), densidade: 0.2 }, { ...pincel('b', 0, 100), tipo: 'borracha', densidade: 0.9 }])
    expect(lidos?.map((p) => p.densidade)).toEqual([0.2, undefined])
    // O recorte do jogador leva a densidade em cada pedaço.
    const recorte = neblinaParaJogador([{ ...pincel('perto', 0, 100), densidade: 0.9 }], () => true, () => false)
    expect(recorte?.every((p) => p.densidade === 0.9)).toBe(true)
  })

  it('limites: a gravação divide o traço longo e recusa o mapa cheio; a leitura corta os pontos e fica com as mais novas', () => {
    const longo: PinceladaDeNeblina = { ...pincel('longo', 0, 0), pontos: Array.from({ length: PONTOS_MAX * 2 + 5 }, (_, i) => ({ x: i, y: 0 })) }
    const pedacos = dividirPincelada(longo)
    expect(pedacos.length).toBe(3)
    expect(pedacos.every((p) => p.pontos.length <= PONTOS_MAX)).toBe(true)
    // Cada pedaço começa onde o anterior parou (o traço não abre) e o último termina no fim.
    for (let i = 1; i < pedacos.length; i += 1) expect(pedacos[i].pontos[0]).toEqual(pedacos[i - 1].pontos[PONTOS_MAX - 1])
    expect(pedacos[pedacos.length - 1].pontos.at(-1)).toEqual(longo.pontos.at(-1))
    // Tudo o que a gravação deixa passar a leitura devolve inteiro.
    expect(lerNeblinaPintada(pedacos)?.map((p) => p.pontos.length)).toEqual(pedacos.map((p) => p.pontos.length))
    // Mapa no teto: nada entra; um a menos com um traço de 3 pedaços também não.
    expect(somarPinceladaDeNeblina([pincel('a', 0, 10)], pincel('b', 0, 10), PINCELADAS_MAX).resultado).toBe('cheio')
    expect(somarPinceladaDeNeblina([pincel('a', 0, 10)], longo, PINCELADAS_MAX - 2).resultado).toBe('cheio')
    expect(somarPinceladaDeNeblina([pincel('a', 0, 10)], longo, 1).lista.length).toBe(4)
    // Arquivo escrito à mão: o traço acima do teto perde só a sobra; acima de N pinceladas ficam as N mais novas.
    expect(lerNeblinaPintada([longo])?.[0].pontos.length).toBe(PONTOS_MAX)
    const muitas = Array.from({ length: PINCELADAS_MAX + 2 }, (_, i) => pincel(`p${i}`, 0, 10))
    const lidas = lerNeblinaPintada(muitas)
    expect(lidas?.length).toBe(PINCELADAS_MAX)
    expect(lidas?.[0].id).toBe('p2')
    expect(lidas?.at(-1)?.id).toBe(`p${PINCELADAS_MAX + 1}`)
  })

  it('o ruído da bruma repete sem emenda: a última coluna e a última linha encostam na primeira', () => {
    const px = pixelsDoRuido()
    const lado = LADO_DO_RUIDO
    const r = (x: number, y: number) => px[(y * lado + x) * 4]
    let maiorSalto = 0
    let saltoNaEmenda = 0
    for (let y = 0; y < lado; y += 1) {
      for (let x = 0; x < lado - 1; x += 1) maiorSalto = Math.max(maiorSalto, Math.abs(r(x + 1, y) - r(x, y)))
      saltoNaEmenda = Math.max(saltoNaEmenda, Math.abs(r(0, y) - r(lado - 1, y)), Math.abs(r(y, 0) - r(y, lado - 1)))
    }
    // A emenda não pula mais do que o maior passo de dentro do ladrilho.
    expect(saltoNaEmenda).toBeLessThanOrEqual(maiorSalto)
    // E o ruído usa a faixa toda (contraste para os novelos aparecerem).
    expect(Math.min(...Array.from({ length: lado * lado }, (_, i) => px[i * 4]))).toBe(0)
    expect(Math.max(...Array.from({ length: lado * lado }, (_, i) => px[i * 4]))).toBe(255)
  })
})
