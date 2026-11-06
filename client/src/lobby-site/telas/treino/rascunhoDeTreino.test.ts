import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Personagem } from '../../../lib/personagem'
import { ze } from '../../../lib/treino/fichasDeTreino.testkit'
import { apagarRascunho, comRascunho, guardarRascunho, lerRascunho, NUMERO_DO_RASCUNHO_MAX, rascunhoMuda, rascunhoVazio, type RascunhoDeTreino } from './rascunhoDeTreino'

/**
 * O rascunho de treino do site (T7, achado Tr6): os números e as técnicas que
 * a pessoa experimenta numa CÓPIA da ficha, só neste navegador. A ficha de
 * verdade nunca muda; o rascunho de uma mesa não vaza para outra nem para a demo.
 */

const CAMPANHA = 'camp_1'

function congeladaFundo<T>(valor: T): T {
  if (typeof valor === 'object' && valor !== null) {
    for (const filho of Object.values(valor)) congeladaFundo(filho)
    Object.freeze(valor)
  }
  return valor
}

function rascunhoCheio(fichaId: string): RascunhoDeTreino {
  return {
    ...rascunhoVazio(fichaId),
    atributos: { forca: 999 },
    maximos: { hp: 5000 },
    recursos: { escudo: 40 },
    tecnicas: [{ id: 't1', nome: 'Golpe de treino', acao: 'simples', dano: 'Força + 10', custo: 10, recarga: 0 }],
    salvoEm: 1_800_000_000_000,
  }
}

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('comRascunho: a ficha de verdade nunca é tocada', () => {
  it('a ficha congelada até o fundo passa pelo rascunho cheio sem erro e sem mudar', () => {
    // Arrange: qualquer escrita na ficha recebida lançaria (objeto congelado em modo estrito).
    const real: Personagem = congeladaFundo(structuredClone(ze(60)))
    const antes = structuredClone(real)

    // Act
    const copia = comRascunho(real, rascunhoCheio(real.id))

    // Assert
    expect(real).toEqual(antes)
    expect(copia).not.toBe(real)
    expect(copia.atributos.forca).toBe(999)
    expect(copia.maximos.hp).toBe(5000)
    expect(copia.abas.habilidades?.some((cartao) => cartao.id === 'treino_tec_t1')).toBe(true)
    expect(real.abas.habilidades?.some((cartao) => cartao.id === 'treino_tec_t1')).toBe(false)
  })

  it('rascunho vazio ou nulo devolve a MESMA ficha (nada a copiar)', () => {
    const real = ze(60)
    expect(comRascunho(real, null)).toBe(real)
    expect(comRascunho(real, rascunhoVazio(real.id))).toBe(real)
    expect(rascunhoMuda(rascunhoVazio(real.id))).toBe(false)
  })

  it('o que o rascunho não muda fica o da ficha (Agilidade, SP)', () => {
    const real = ze(60)
    const copia = comRascunho(real, rascunhoCheio(real.id))
    expect(copia.atributos.agilidade).toBe(real.atributos.agilidade)
    expect(copia.maximos.sp).toBe(real.maximos.sp)
  })
})

describe('guardar e ler: só neste navegador, por mesa e por ficha', () => {
  it('guardado volta igual na mesma mesa e na mesma ficha', () => {
    const rascunho = rascunhoCheio('pers_ze')
    expect(guardarRascunho(CAMPANHA, rascunho, false)).toBe(true)
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toEqual(rascunho)
  })

  it('outra mesa, a demo ou outra ficha não leem o rascunho', () => {
    guardarRascunho(CAMPANHA, rascunhoCheio('pers_ze'), false)
    expect(lerRascunho('camp_2', 'pers_ze', false)).toBeNull()
    expect(lerRascunho(CAMPANHA, 'pers_ze', true)).toBeNull()
    expect(lerRascunho(CAMPANHA, 'pers_lia', false)).toBeNull()
  })

  it('apagar tira só o daquela ficha', () => {
    guardarRascunho(CAMPANHA, rascunhoCheio('pers_ze'), false)
    guardarRascunho(CAMPANHA, rascunhoCheio('pers_lia'), false)
    apagarRascunho(CAMPANHA, 'pers_ze', false)
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toBeNull()
    expect(lerRascunho(CAMPANHA, 'pers_lia', false)).not.toBeNull()
  })

  it('o guardado com o fichaId de outra ficha (chave trocada à mão) não abre', () => {
    window.localStorage.setItem(`labirinto.lobby.rascunhoDeTreino.${CAMPANHA}.pers_ze`, JSON.stringify(rascunhoCheio('pers_lia')))
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toBeNull()
  })

  it('número negativo, fracionário, acima do teto ou em texto descarta o rascunho inteiro', () => {
    const chave = `labirinto.lobby.rascunhoDeTreino.${CAMPANHA}.pers_ze`
    for (const forca of [-1, 1.5, NUMERO_DO_RASCUNHO_MAX + 1, '60', null]) {
      window.localStorage.setItem(chave, JSON.stringify({ ...rascunhoCheio('pers_ze'), atributos: { forca } }))
      expect(lerRascunho(CAMPANHA, 'pers_ze', false), String(forca)).toBeNull()
    }
  })

  it('JSON quebrado ou versão desconhecida não abre e não lança', () => {
    const chave = `labirinto.lobby.rascunhoDeTreino.${CAMPANHA}.pers_ze`
    window.localStorage.setItem(chave, '{"versao":2,')
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toBeNull()
    window.localStorage.setItem(chave, JSON.stringify({ ...rascunhoCheio('pers_ze'), versao: 3 }))
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toBeNull()
  })

  it('o rascunho da versão 1 (sem Escudo nem técnicas) ainda abre, sem técnicas', () => {
    const chave = `labirinto.lobby.rascunhoDeTreino.${CAMPANHA}.pers_ze`
    window.localStorage.setItem(chave, JSON.stringify({ versao: 1, fichaId: 'pers_ze', atributos: { forca: 80 }, maximos: {}, salvoEm: 1 }))
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toMatchObject({ versao: 2, atributos: { forca: 80 }, recursos: {}, tecnicas: [] })
  })

  it('armazenamento bloqueado (modo privado): guardar diz false, ler diz null, apagar não lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cheio', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    expect(guardarRascunho(CAMPANHA, rascunhoCheio('pers_ze'), false)).toBe(false)
    expect(lerRascunho(CAMPANHA, 'pers_ze', false)).toBeNull()
    expect(() => apagarRascunho(CAMPANHA, 'pers_ze', false)).not.toThrow()
  })
})
