import { describe, expect, it } from 'vitest'
import type { Prop } from '../types/map'
import { escalaDoNivel } from '../texturas/meioTermo/moveis'
import { BYTES_DE_TRABALHO_POR_PIXEL, pintarCenaEmPassos } from '../texturas/meioTermo/moveis/motor'
import { chaveDoMovel, LADO_MAXIMO_DA_IMAGEM, PASSO_DAS_CASAS, RasterDosMoveis, textoDaChave } from './rasterDosMoveis'

/**
 * O raster com PASSADA POR DONO (revisão de correção e desempenho da MT2):
 * a fila pula o que nenhum dono pediu na última passada, a imagem pronta chama
 * o dono para se repintar, a imagem que sai do cache só é destruída quando
 * ninguém mais a cola, o cache conta as duas cópias e o buffer de trabalho, e
 * a pegada arredonda de 0,1 em 0,1 casa só na chave.
 */

const CARVALHO = '#8b6b47'
const NOGUEIRA = '#5f4532'
const VELHA = '#7b776e'
const PINHO = '#a3875f'

function barril(cor: string): Prop {
  return { id: 'b', src: '', x: 100, y: 100, width: 35, height: 35, linkedMapPath: null, mobilia: 'barril', mobiliaCor: cor }
}

/** O baú padrão tem 1 x 0,6 casa (`lib/mobilia.ts`); a altura muda para cair (ou não) na mesma chave. */
function bau(altura: number): Prop {
  return { id: 'u', src: '', x: 0, y: 0, width: 50, height: altura, linkedMapPath: null, mobilia: 'bau', mobiliaCor: NOGUEIRA }
}

function filaControlada(): { agendar: (fatia: () => void) => void; rodarTudo: () => void; rodarUma: () => void } {
  const fatias: (() => void)[] = []
  return {
    agendar: (fatia) => fatias.push(fatia),
    rodarTudo: () => {
      while (fatias.length > 0) fatias.shift()?.()
    },
    rodarUma: () => fatias.shift()?.(),
  }
}

/** Um dono (o `Graphics`, aqui só um objeto) que conta as vezes em que foi chamado para se repintar. */
function dono(): { id: object; repintadas: () => number; repintar: () => void } {
  let n = 0
  return { id: {}, repintadas: () => n, repintar: () => (n += 1) }
}

function chave(prop: Prop, nivel = 1): string {
  const c = chaveDoMovel(prop, nivel, 1)
  if (c === null) throw new Error('móvel sem chave')
  return textoDaChave(c)
}

/** Os bytes da imagem de um barril no nível 1 (as duas cópias), para montar tetos pequenos. */
function bytesDeUmBarril(): number {
  const medida = new RasterDosMoveis({ agendar: () => undefined })
  medida.imagemDoMovel(barril(CARVALHO), 1, 1)
  return medida.bytes
}

describe('pegada de 0,1 em 0,1 casa só na chave', () => {
  it('o baú padrão sai 1 x 0,6 (não 1 x 0,5): o desenho usa a pegada exata', () => {
    const c = chaveDoMovel(bau(30), 1, 1)
    expect(c?.desenho.casasW).toBe(1)
    expect(c?.desenho.casasH).toBe(0.6)
    expect(PASSO_DAS_CASAS).toBe(0.1)
  })

  it('0,5, 0,6, 0,7 e 0,8 casa dão chaves diferentes; 0,59 e 0,61 caem na de 0,6, com a mesma semente', () => {
    expect(new Set([25, 30, 35, 40].map((h) => chave(bau(h)))).size).toBe(4)
    expect(chave(bau(29.5))).toBe(chave(bau(30)))
    expect(chave(bau(30.5))).toBe(chave(bau(30)))
    expect(chaveDoMovel(bau(29.5), 1, 1)?.desenho.semente).toBe(chaveDoMovel(bau(30), 1, 1)?.desenho.semente)
  })
})

describe('imagem grande demais', () => {
  it('um móvel enorme ganha menos pixels por px, nunca uma imagem maior que o lado máximo', () => {
    const mesa: Prop = { id: 'm', src: '', x: 0, y: 0, width: 1500, height: 750, linkedMapPath: null, mobilia: 'mesa', mobiliaCor: CARVALHO }
    const raster = new RasterDosMoveis({ agendar: () => undefined })
    const imagem = raster.imagemDoMovel(mesa, 3, 1)
    if (imagem === null) throw new Error('mesa sem imagem')
    expect(Math.max(imagem.limites.W, imagem.limites.H)).toBeLessThanOrEqual(LADO_MAXIMO_DA_IMAGEM)
    expect(imagem.S).toBeLessThan(escalaDoNivel(3))
    // As duas cópias (CPU e placa) entram na conta do cache.
    expect(raster.bytes).toBe(imagem.limites.W * imagem.limites.H * 4 * 2)
  })
})

describe('contas do cache e composição em passos', () => {
  it('o buffer de trabalho conta enquanto a imagem é pintada e sai quando ela fica pronta', () => {
    let relogio = 0
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar, agora: () => (relogio += 1) })
    const imagem = raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    if (imagem === null) throw new Error('barril sem imagem')
    const pronta = imagem.limites.W * imagem.limites.H * 4 * 2
    expect(raster.bytes).toBe(pronta)
    fila.rodarUma()
    expect(imagem.pronta).toBe(false)
    expect(raster.bytes).toBe(pronta + imagem.limites.W * imagem.limites.H * BYTES_DE_TRABALHO_POR_PIXEL)
    fila.rodarTudo()
    expect(imagem.pronta).toBe(true)
    expect(raster.bytes).toBe(pronta)
  })

  it('a composição anda uma linha por passo: uma cena vazia leva exatamente H passos', () => {
    const limites = { x0: 0, y0: 0, W: 7, H: 5 }
    const passos = pintarCenaEmPassos({ partes: [], sombras: [] }, 1, limites, new Uint8ClampedArray(7 * 5 * 4), true)
    let n = 0
    while (passos.next().done !== true) n += 1
    expect(n).toBe(limites.H)
  })
})

describe('passada por dono', () => {
  it('zoom que cruza os níveis 1, 2 e 3 numa passada cada: a fila gera só o 3 e chama o dono para se repintar', () => {
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar })
    const d = dono()
    for (const nivel of [1, 2, 3]) {
      raster.abrirPassada(d.id, d.repintar)
      raster.imagemDoMovel(barril(CARVALHO), nivel, 1)
      raster.fecharPassada()
    }
    expect(raster.geradas).toBe(3)
    fila.rodarTudo()
    expect(raster.prontas).toBe(1)
    expect(raster.puladas).toBe(2)
    expect(raster.destruidas).toBe(2)
    expect(raster.guardada(chave(barril(CARVALHO), 3))).toBe(true)
    expect(d.repintadas()).toBe(1)
  })

  it('a poda não tira a imagem da passada aberta nem a que um dono ainda pede; tira a pronta que ninguém usa', () => {
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar, tetoDeBytes: bytesDeUmBarril() * 1.5 })
    const d = dono()
    raster.abrirPassada(d.id, d.repintar)
    for (const cor of [CARVALHO, NOGUEIRA, VELHA]) raster.imagemDoMovel(barril(cor), 1, 1)
    raster.fecharPassada()
    // As três na mesma passada: nenhuma sai, mesmo acima do teto.
    expect([CARVALHO, NOGUEIRA, VELHA].every((cor) => raster.guardada(chave(barril(cor))))).toBe(true)
    expect(raster.bytes).toBeGreaterThan(raster.teto)
    fila.rodarTudo()
    // O dono agora só pede a velha: carvalho e nogueira, prontas e sem uso, saem na próxima imagem nova.
    raster.abrirPassada(d.id, d.repintar)
    raster.imagemDoMovel(barril(VELHA), 1, 1)
    raster.fecharPassada()
    raster.imagemDoMovel(barril(PINHO), 1, 1)
    expect(raster.guardada(chave(barril(CARVALHO)))).toBe(false)
    expect(raster.guardada(chave(barril(NOGUEIRA)))).toBe(false)
    expect(raster.guardada(chave(barril(VELHA)))).toBe(true)
    expect(raster.destruidas).toBe(2)
  })

  it('a poda não tira a imagem que está sendo pintada', () => {
    let relogio = 0
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar, agora: () => (relogio += 1), tetoDeBytes: 1 })
    raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    fila.rodarUma()
    raster.imagemDoMovel(barril(NOGUEIRA), 1, 1)
    expect(raster.guardada(chave(barril(CARVALHO)))).toBe(true)
    fila.rodarTudo()
    expect(raster.prontas).toBe(2)
  })

  it('a imagem que sai do cache só é destruída quando o dono que a cola se repinta sem ela', () => {
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar, tetoDeBytes: bytesDeUmBarril() * 1.5 })
    const d = dono()
    raster.abrirPassada(d.id, d.repintar)
    raster.imagemParaDesenhar(barril(CARVALHO), 1, 1)
    raster.fecharPassada()
    fila.rodarTudo()
    // Pronta: o dono se repinta e cola a imagem.
    raster.abrirPassada(d.id, d.repintar)
    const colada = raster.imagemParaDesenhar(barril(CARVALHO), 1, 1)?.mostrar
    if (colada == null) throw new Error('a imagem pronta não veio para colar')
    raster.marcarColada(colada)
    raster.fecharPassada()
    let destruida = 0
    colada.textura.on('destroy', () => (destruida += 1))
    // O dono passa a pedir outra coisa e um segundo dono pede outra imagem: a do carvalho sai do cache, mas segue colada.
    raster.abrirPassada(d.id, d.repintar)
    raster.marcarColada(colada)
    raster.fecharPassada()
    const outro = dono()
    raster.abrirPassada(outro.id, outro.repintar)
    raster.imagemDoMovel(barril(NOGUEIRA), 1, 1)
    raster.fecharPassada()
    expect(raster.guardada(chave(barril(CARVALHO)))).toBe(false)
    expect(destruida).toBe(0)
    // O dono se repinta sem ela: agora sim.
    raster.abrirPassada(d.id, d.repintar)
    raster.fecharPassada()
    expect(destruida).toBe(1)
    expect(raster.destruidas).toBe(1)
  })

  it('o dono destruído deixa de contar: a imagem que só ele pedia é pulada pela fila', () => {
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar })
    const d = dono()
    raster.abrirPassada(d.id, d.repintar)
    raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    raster.fecharPassada()
    raster.soltarDono(d.id)
    fila.rodarTudo()
    expect(raster.prontas).toBe(0)
    expect(raster.puladas).toBe(1)
    expect(d.repintadas()).toBe(0)
  })

  it('na troca de nível, a imagem pronta do nível vizinho vale enquanto a nova não fica pronta', () => {
    const fila = filaControlada()
    const raster = new RasterDosMoveis({ agendar: fila.agendar })
    const d = dono()
    raster.abrirPassada(d.id, d.repintar)
    raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    raster.fecharPassada()
    fila.rodarTudo()
    raster.abrirPassada(d.id, d.repintar)
    const troca = raster.imagemParaDesenhar(barril(CARVALHO), 2, 1)
    raster.fecharPassada()
    expect(troca?.pedida.pronta).toBe(false)
    expect(troca?.pedida.nivel).toBe(2)
    expect(troca?.mostrar?.nivel).toBe(1)
    expect(troca?.mostrar?.pronta).toBe(true)
  })
})
