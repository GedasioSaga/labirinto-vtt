import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Prop } from '../types/map'
import { chaveDoMovel, nivelDeResolucao, RasterDosMoveis, tetoDeBytesDoAparelho, textoDaChave, TETO_NO_COMPUTADOR, TETO_NO_TOQUE } from './rasterDosMoveis'

/** Barril de 0,7 casa na grade padrão (50 px), com a cor oficial de uma madeira. */
function barril(cor: string, extra: Partial<Prop> = {}): Prop {
  return { id: 'b', src: '', x: 100, y: 100, width: 35, height: 35, linkedMapPath: null, mobilia: 'barril', mobiliaCor: cor, ...extra }
}

const CARVALHO = '#8b6b47'
const NOGUEIRA = '#5f4532'
const VELHA = '#7b776e'
const PINHO = '#a3875f'

/** Fila controlada: as fatias ficam guardadas até o teste mandar rodar. */
function filaControlada(): { agendar: (fatia: () => void) => void; rodarTudo: () => number } {
  const fatias: (() => void)[] = []
  return {
    agendar: (fatia) => fatias.push(fatia),
    rodarTudo: () => {
      let rodadas = 0
      while (fatias.length > 0) {
        const fatia = fatias.shift()
        if (fatia !== undefined) fatia()
        rodadas += 1
      }
      return rodadas
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rasterDosMoveis: chave da imagem', () => {
  it('nível = min(3, ceil(câmera x densidade)), nunca abaixo de 1', () => {
    expect(nivelDeResolucao(0.3, 1)).toBe(1)
    expect(nivelDeResolucao(1, 1)).toBe(1)
    expect(nivelDeResolucao(1.2, 1)).toBe(2)
    expect(nivelDeResolucao(1, 2)).toBe(2)
    expect(nivelDeResolucao(2, 2)).toBe(3)
    expect(nivelDeResolucao(Number.NaN, 1)).toBe(1)
  })

  it('cor antiga vira o material mais perto; pegada de 0,25 em 0,25 casa; a semente não depende do nível', () => {
    const perto = chaveDoMovel(barril('#8a6a46'), 1, 1)
    const exato = chaveDoMovel(barril(CARVALHO), 2, 1)
    expect(perto?.desenho.materiais).toEqual(['carvalho', 'ferro'])
    expect(perto?.desenho.casasW).toBe(0.75)
    expect(perto?.desenho.semente).toBe(exato?.desenho.semente)
    expect(chaveDoMovel(barril(CARVALHO, { mobilia: 'cerca' }), 1, 1)).toBeNull()
  })

  it('a cama lê os 3 campos de hoje: madeira, cobertor e travesseiro', () => {
    const cama = chaveDoMovel({ ...barril(NOGUEIRA), mobilia: 'catre', width: 50, height: 100, mobiliaCorDoCobertor: '#41526a', mobiliaCorDoTravesseiro: '#5a6344' }, 1, 1)
    expect(cama?.desenho.materiais).toEqual(['nogueira', 'azul', 'musgo'])
  })
})

describe('rasterDosMoveis: cache e fila', () => {
  it('a segunda chamada com a mesma chave não gera de novo; a imagem sai pronta depois das fatias, com os bytes no lugar', () => {
    const fila = filaControlada()
    let relogio = 0
    const raster = new RasterDosMoveis({ agendar: fila.agendar, agora: () => (relogio += 1) })
    const primeira = raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    const segunda = raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    expect(raster.geradas).toBe(1)
    expect(segunda).toBe(primeira)
    expect(primeira?.pronta).toBe(false)
    let subidas = 0
    primeira?.textura.source.on('update', () => (subidas += 1))
    const fatias = fila.rodarTudo()
    // Relógio de 1 ms por leitura e fatia de 8 ms: a imagem precisou de várias fatias.
    expect(fatias).toBeGreaterThan(1)
    expect(primeira?.pronta).toBe(true)
    expect(raster.prontas).toBe(1)
    expect(subidas).toBe(1)
    const bytes = primeira?.textura.source.resource
    expect(bytes instanceof Uint8ClampedArray && bytes.some((b) => b > 0)).toBe(true)
    expect(raster.geradas).toBe(1)
  })

  it('LRU: passando do teto de bytes, sai a imagem usada há mais tempo', () => {
    const fila = filaControlada()
    const medida = new RasterDosMoveis({ agendar: fila.agendar })
    const uma = medida.imagemDoMovel(barril(CARVALHO), 1, 1)
    const bytesDeUma = medida.bytes
    expect(uma).not.toBeNull()
    const raster = new RasterDosMoveis({ agendar: fila.agendar, tetoDeBytes: bytesDeUma * 2.5 })
    const chave = (cor: string): string => {
      const c = chaveDoMovel(barril(cor), 1, 1)
      if (c === null) throw new Error('barril sem chave')
      return textoDaChave(c)
    }
    raster.imagemDoMovel(barril(CARVALHO), 1, 1)
    raster.imagemDoMovel(barril(NOGUEIRA), 1, 1)
    raster.imagemDoMovel(barril(VELHA), 1, 1)
    expect(raster.guardada(chave(CARVALHO))).toBe(false)
    expect(raster.guardada(chave(NOGUEIRA))).toBe(true)
    expect(raster.bytes).toBeLessThanOrEqual(raster.teto)
    // Nogueira usada de novo: agora a mais antiga é a velha.
    raster.imagemDoMovel(barril(NOGUEIRA), 1, 1)
    raster.imagemDoMovel(barril(PINHO), 1, 1)
    expect(raster.guardada(chave(VELHA))).toBe(false)
    expect(raster.guardada(chave(NOGUEIRA))).toBe(true)
    expect(raster.guardada(chave(PINHO))).toBe(true)
    // A que saiu antes de ficar pronta não é gerada: a fila termina só as que ficaram.
    fila.rodarTudo()
    expect(raster.prontas).toBe(2)
  })

  it('com dedo (pointer: coarse) o teto é 24 MB; no computador, 64 MB', () => {
    expect(tetoDeBytesDoAparelho()).toBe(TETO_NO_COMPUTADOR)
    expect(new RasterDosMoveis().teto).toBe(64 * 1024 * 1024)
    vi.stubGlobal('matchMedia', (consulta: string) => ({ matches: consulta === '(pointer: coarse)' }))
    expect(tetoDeBytesDoAparelho()).toBe(TETO_NO_TOQUE)
    expect(new RasterDosMoveis().teto).toBe(24 * 1024 * 1024)
  })
})
