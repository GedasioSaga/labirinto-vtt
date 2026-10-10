/**
 * PACOTE DE ANIMAÇÕES — o tipo `textura`: a textura nova da ferramenta Texturas
 * chega pelo mesmo índice assinado, sem instalador. Entrada com a escala do
 * ladrilho; id da biblioteca fica de fora (a embutida ganha); o módulo entra
 * no catálogo de texturas e sai dele quando o pacote é esquecido.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listarTexturas, texturaDoCatalogo } from '../texturas/catalogo'
import { carregarPacoteDeAnimacoes, esquecerPacoteCarregado, lerEntradaDoPacote, type OrigemDoPacote } from './pacoteDeAnimacoes'

const ARQUIVOS = new Set(['textura-cerrado.js'])
const CERRADO = { id: 'cerrado', tipo: 'textura', nome: 'Cerrado', arquivo: 'textura-cerrado.js', escala: 40 }

function indice(animacoes: unknown[]): string {
  return JSON.stringify({ formato: 1, versao: 2, motorMinimo: '0.4.21', arquivos: [...ARQUIVOS].map((nome) => ({ nome, sha256: 'a'.repeat(64), tamanho: 10 })), animacoes })
}

function origem(modulo: unknown): OrigemDoPacote {
  return { lerIndice: async () => indice([CERRADO]), importar: async () => modulo }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  esquecerPacoteCarregado()
  vi.restoreAllMocks()
})

describe('pacote — tipo textura', () => {
  it('lê a entrada com a escala do ladrilho; escala fora da faixa e id da biblioteca ficam de fora', () => {
    expect(lerEntradaDoPacote(CERRADO, ARQUIVOS)).toEqual({ entrada: CERRADO })
    expect('motivo' in lerEntradaDoPacote({ ...CERRADO, escala: 3 }, ARQUIVOS)).toBe(true)
    expect('motivo' in lerEntradaDoPacote({ ...CERRADO, escala: 'grande' }, ARQUIVOS)).toBe(true)
    expect(lerEntradaDoPacote({ ...CERRADO, id: 'floresta' }, ARQUIVOS)).toEqual({ motivo: 'floresta: id de animação embutida' })
  })

  it('o módulo entra no catálogo com a cor dele, e sai quando o pacote é esquecido', async () => {
    const resultado = await carregarPacoteDeAnimacoes(origem({ default: (u: number, v: number) => (u < 0.5 ? 0x112233 : 0x445566) + (v > 2 ? 1 : 0) }))
    expect(resultado.registradas.map((e) => e.id)).toEqual(['cerrado'])
    const cerrado = texturaDoCatalogo('cerrado')
    expect(cerrado).toMatchObject({ nome: 'Cerrado', escala: 40, origem: 'pacote' })
    expect(cerrado?.cor(0.1, 0.1)).toBe(0x112233)
    expect(listarTexturas().map((t) => t.id)).toContain('cerrado')
    esquecerPacoteCarregado()
    expect(texturaDoCatalogo('cerrado')).toBeNull()
    expect(listarTexturas().some((t) => t.origem === 'pacote')).toBe(false)
  })

  it('cor de fora que devolve lixo vira preto, não erro', async () => {
    await carregarPacoteDeAnimacoes(origem({ default: () => 'verde' }))
    expect(texturaDoCatalogo('cerrado')?.cor(0.2, 0.2)).toBe(0)
  })

  it('módulo sem função fica de fora; as embutidas seguem', async () => {
    const resultado = await carregarPacoteDeAnimacoes(origem({ default: 42 }))
    expect(resultado.registradas).toEqual([])
    expect(texturaDoCatalogo('floresta')?.origem).toBe('embutida')
  })
})
