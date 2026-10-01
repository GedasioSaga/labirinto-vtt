import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CHAVE_DA_PREFERENCIA_DE_SOM,
  PREFERENCIA_DE_SOM_PADRAO,
  criarSomStore,
  gravarPreferenciaDeSom,
  lerPreferenciaDeSom,
  useSomStore,
  type ArmazemDeSom,
} from './somStore'

function armazemFalso(gravado?: string) {
  const dados = new Map<string, string>()
  if (gravado !== undefined) dados.set(CHAVE_DA_PREFERENCIA_DE_SOM, gravado)
  const armazem = {
    getItem: vi.fn((chave: string) => dados.get(chave) ?? null),
    setItem: vi.fn((chave: string, valor: string) => {
      dados.set(chave, valor)
    }),
  } satisfies ArmazemDeSom
  return { armazem, dados }
}

/** Janela anônima / dado do site bloqueado: ler e gravar lançam. */
const armazemQuebrado: ArmazemDeSom = {
  getItem: () => {
    throw new Error('bloqueado')
  },
  setItem: () => {
    throw new Error('cheio')
  },
}

const ler = (gravado: unknown) => lerPreferenciaDeSom(armazemFalso(JSON.stringify(gravado)).armazem)

function gravadoEm(dados: Map<string, string>): unknown {
  const texto = dados.get(CHAVE_DA_PREFERENCIA_DE_SOM)
  if (texto === undefined) throw new Error('nada gravado em lb-som')
  return JSON.parse(texto)
}

describe('lerPreferenciaDeSom', () => {
  it('sem storage, vazio, corrompido ou que lança: volume baixo (0.35) e som ligado', () => {
    expect(CHAVE_DA_PREFERENCIA_DE_SOM).toBe('lb-som')
    expect(PREFERENCIA_DE_SOM_PADRAO).toEqual({ volume: 0.35, mudo: false })
    expect(lerPreferenciaDeSom(null)).toEqual(PREFERENCIA_DE_SOM_PADRAO)
    expect(lerPreferenciaDeSom(armazemFalso().armazem)).toEqual(PREFERENCIA_DE_SOM_PADRAO)
    expect(lerPreferenciaDeSom(armazemFalso('{volume:').armazem)).toEqual(PREFERENCIA_DE_SOM_PADRAO)
    expect(lerPreferenciaDeSom(armazemFalso('null').armazem)).toEqual(PREFERENCIA_DE_SOM_PADRAO)
    expect(lerPreferenciaDeSom(armazemFalso('"alto"').armazem)).toEqual(PREFERENCIA_DE_SOM_PADRAO)
    expect(lerPreferenciaDeSom(armazemQuebrado)).toEqual(PREFERENCIA_DE_SOM_PADRAO)
  })

  it('volume fora da faixa é limitado a 0..1; campo de tipo errado volta ao padrão sozinho', () => {
    expect(ler({ volume: -1, mudo: true })).toEqual({ volume: 0, mudo: true })
    expect(ler({ volume: 7, mudo: false })).toEqual({ volume: 1, mudo: false })
    expect(ler({ volume: 'x', mudo: true })).toEqual({ volume: 0.35, mudo: true })
    expect(ler({ volume: 0.6, mudo: 'sim' })).toEqual({ volume: 0.6, mudo: false })
    // JSON.parse('1e999') dá Infinity: número, mas não um volume.
    expect(lerPreferenciaDeSom(armazemFalso('{"volume":1e999,"mudo":true}').armazem)).toEqual({ volume: 0.35, mudo: true })
  })

  it('o que foi gravado volta igual; setItem que lança não sobe', () => {
    const { armazem } = armazemFalso()
    gravarPreferenciaDeSom(armazem, { volume: 0.2, mudo: true })
    expect(armazem.setItem).toHaveBeenCalledWith('lb-som', expect.any(String))
    expect(lerPreferenciaDeSom(armazem)).toEqual({ volume: 0.2, mudo: true })
    expect(() => gravarPreferenciaDeSom(armazemQuebrado, { volume: 0.2, mudo: true })).not.toThrow()
    expect(() => gravarPreferenciaDeSom(null, { volume: 0.2, mudo: true })).not.toThrow()
  })
})

describe('somStore', () => {
  afterEach(() => {
    localStorage.removeItem(CHAVE_DA_PREFERENCIA_DE_SOM)
  })

  it('nasce com o que está gravado no aparelho', () => {
    const store = criarSomStore(armazemFalso(JSON.stringify({ volume: 0.8, mudo: true })).armazem)
    expect(store.getState()).toMatchObject({ volume: 0.8, mudo: true })
  })

  it('setVolume limita a 0..1 e grava em lb-som; valor que não é número é ignorado', () => {
    const { armazem, dados } = armazemFalso()
    const store = criarSomStore(armazem)
    store.getState().setVolume(0.2)
    expect(store.getState().volume).toBe(0.2)
    expect(gravadoEm(dados)).toEqual({ volume: 0.2, mudo: false })
    store.getState().setVolume(-3)
    expect(store.getState().volume).toBe(0)
    store.getState().setVolume(9)
    expect(store.getState().volume).toBe(1)
    store.getState().setVolume(Number.NaN)
    expect(store.getState().volume).toBe(1)
    expect(gravadoEm(dados)).toEqual({ volume: 1, mudo: false })
  })

  it('alternarMudo inverte e grava, sem mexer no volume', () => {
    const { armazem, dados } = armazemFalso(JSON.stringify({ volume: 0.5, mudo: false }))
    const store = criarSomStore(armazem)
    store.getState().alternarMudo()
    expect(store.getState()).toMatchObject({ volume: 0.5, mudo: true })
    expect(gravadoEm(dados)).toEqual({ volume: 0.5, mudo: true })
    store.getState().alternarMudo()
    expect(store.getState().mudo).toBe(false)
  })

  it('storage que lança não quebra: nasce no padrão e a escolha vale em memória', () => {
    const store = criarSomStore(armazemQuebrado)
    expect(store.getState()).toMatchObject(PREFERENCIA_DE_SOM_PADRAO)
    expect(() => store.getState().setVolume(0.5)).not.toThrow()
    expect(store.getState().volume).toBe(0.5)
    expect(() => store.getState().alternarMudo()).not.toThrow()
    expect(store.getState().mudo).toBe(true)
  })

  it('o store do app guarda no localStorage do navegador', () => {
    useSomStore.getState().setVolume(0.5)
    expect(JSON.parse(localStorage.getItem(CHAVE_DA_PREFERENCIA_DE_SOM) ?? 'null')).toEqual({ volume: 0.5, mudo: false })
  })
})
