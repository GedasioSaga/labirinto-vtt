import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TRANSICOES_EMBUTIDAS,
  assinarTransicoes,
  criarCenaDeFora,
  duracaoEfetivaS,
  esquecerTransicoesDeFora,
  isTransicaoId,
  listarTransicoes,
  parseTransicao,
  registrarTransicao,
  transicaoInfo,
  type TransicaoInfo,
} from './catalogo'
import { PORTA_FIM_S } from './cenas/porta'
import { ESCADA_PEDRA_FIM_S } from './cenas/escadaPedra'

function info(id: string): TransicaoInfo {
  const achada = transicaoInfo(id)
  if (achada === undefined) throw new Error(`sem a transição ${id}`)
  return achada
}

const deFora = (extra: Record<string, unknown> = {}) => ({ id: 'tunel', nome: 'Túnel', duracaoNaturalS: 5, quadroDaMiniaturaS: 1, criar: () => ({}), ...extra })

afterEach(() => {
  esquecerTransicoesDeFora()
})

describe('catálogo de transições', () => {
  it('a duração natural de cada embutida bate com o fim da cena', () => {
    expect(info('porta').duracaoNaturalS).toBeCloseTo(PORTA_FIM_S)
    expect(info('escada-pedra').duracaoNaturalS).toBeCloseTo(ESCADA_PEDRA_FIM_S)
    expect(info('escada-pedra-descendo').duracaoNaturalS).toBeCloseTo(ESCADA_PEDRA_FIM_S)
  })

  it('cada id aparece uma vez só', () => {
    const ids = TRANSICOES_EMBUTIDAS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('isTransicaoId confere a FORMA do id, não se o app tem a transição', () => {
    expect(isTransicaoId('porta')).toBe(true)
    expect(isTransicaoId('tunel-de-pedra')).toBe(true)
    expect(isTransicaoId('Porta')).toBe(false)
    expect(isTransicaoId('com espaco')).toBe(false)
    expect(isTransicaoId('a'.repeat(41))).toBe(false)
    expect(isTransicaoId('')).toBe(false)
    expect(isTransicaoId(42)).toBe(false)
  })

  it('parseTransicao lê o que vem do disco e descarta o resto', () => {
    expect(parseTransicao({ id: 'porta' })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: 5 })).toEqual({ id: 'porta', duracaoS: 5 })
    expect(parseTransicao({ id: 'porta', duracaoS: 1 })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: 31 })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: Number.NaN })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'porta', duracaoS: '5' })).toEqual({ id: 'porta' })
    expect(parseTransicao({ id: 'Helicoptero!' })).toBeUndefined()
    expect(parseTransicao('porta')).toBeUndefined()
    expect(parseTransicao(null)).toBeUndefined()
  })

  it('parseTransicao guarda id no padrão que este app não conhece (o pacote dele pode chegar depois)', () => {
    expect(parseTransicao({ id: 'helicoptero', duracaoS: 6 })).toEqual({ id: 'helicoptero', duracaoS: 6 })
    expect(transicaoInfo('helicoptero')).toBeUndefined()
  })

  it('duracaoEfetivaS usa a escolhida ou a natural', () => {
    expect(duracaoEfetivaS({ id: 'porta', duracaoS: 4 }, info('porta'))).toBe(4)
    expect(duracaoEfetivaS({ id: 'porta' }, info('porta'))).toBe(info('porta').duracaoNaturalS)
  })
})

describe('transições de fora (pacote)', () => {
  it('registrada, entra no catálogo depois das embutidas e avisa quem assina', () => {
    const ouvinte = vi.fn()
    const cancelar = assinarTransicoes(ouvinte)
    expect(registrarTransicao(deFora())).toBe(true)
    cancelar()
    expect(ouvinte).toHaveBeenCalledTimes(1)
    expect(listarTransicoes().map((t) => t.id)).toEqual(['porta', 'escada-pedra', 'escada-pedra-descendo', 'tunel'])
    expect(transicaoInfo('tunel')).toMatchObject({ id: 'tunel', nome: 'Túnel', duracaoNaturalS: 5, quadroDaMiniaturaS: 1 })
    expect(criarCenaDeFora('tunel')).toBeTypeOf('function')
    expect(criarCenaDeFora('porta')).toBeNull()
  })

  it('id de embutida é recusado: a embutida ganha', () => {
    expect(registrarTransicao(deFora({ id: 'porta', nome: 'Porta falsa' }))).toBe(false)
    expect(info('porta').nome).toBe('Porta rangendo')
  })

  it('forma errada é recusada', () => {
    expect(registrarTransicao(null)).toBe(false)
    expect(registrarTransicao(deFora({ id: 'Tunel' }))).toBe(false)
    expect(registrarTransicao(deFora({ nome: '  ' }))).toBe(false)
    expect(registrarTransicao(deFora({ nome: 'x'.repeat(61) }))).toBe(false)
    expect(registrarTransicao(deFora({ duracaoNaturalS: 1 }))).toBe(false)
    expect(registrarTransicao(deFora({ quadroDaMiniaturaS: 9 }))).toBe(false)
    expect(registrarTransicao(deFora({ criar: 'não é função' }))).toBe(false)
    expect(listarTransicoes()).toBe(TRANSICOES_EMBUTIDAS)
  })

  it('o mesmo id de novo substitui; esquecer volta às embutidas', () => {
    registrarTransicao(deFora())
    registrarTransicao(deFora({ nome: 'Túnel novo' }))
    expect(listarTransicoes().filter((t) => t.id === 'tunel').map((t) => t.nome)).toEqual(['Túnel novo'])
    esquecerTransicoesDeFora()
    expect(listarTransicoes()).toBe(TRANSICOES_EMBUTIDAS)
    expect(transicaoInfo('tunel')).toBeUndefined()
  })

  it('a cena de fora é conferida: sem scene do three recebido, o criar lança (o motor cai para onFim)', async () => {
    // O `three` de verdade: `Scene` e `PerspectiveCamera` não pedem WebGL.
    const THREE = await import('three')
    const boa = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), atualizar: () => ({ fade: 2 }), ajustarTela: () => undefined, descartar: () => undefined }
    registrarTransicao(deFora({ criar: () => boa }))
    const criar = criarCenaDeFora('tunel')
    if (criar === null) throw new Error('sem fábrica')
    const cena = criar(THREE, { reduzirMovimento: false })
    expect(cena.scene).toBe(boa.scene)
    // fade fora de 0..1 é preso, não repassado.
    expect(cena.atualizar(1)).toEqual({ fade: 1 })
    registrarTransicao(deFora({ criar: () => ({ ...boa, scene: {} }) }))
    const quebrada = criarCenaDeFora('tunel')
    expect(() => quebrada?.(THREE, { reduzirMovimento: false })).toThrow(/sem scene/)
  })
})
