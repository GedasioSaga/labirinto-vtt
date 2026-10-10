/**
 * PACOTE DE ANIMAÇÕES — o tipo `carimbo`: o objeto novo da ferramenta Carimbos
 * chega pelo mesmo índice assinado, sem instalador. Entrada com o tamanho
 * natural e o jeito da sombra; id da biblioteca fica de fora (o embutido
 * ganha); o módulo entra no catálogo de carimbos e sai quando o pacote é esquecido.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carimboDoCatalogo, listarCarimbos } from '../carimbos/catalogo'
import { carregarPacoteDeAnimacoes, esquecerPacoteCarregado, lerEntradaDoPacote, type OrigemDoPacote } from './pacoteDeAnimacoes'

const ARQUIVOS = new Set(['carimbo-cacto.js'])
const CACTO = { id: 'cacto', tipo: 'carimbo', nome: 'Cacto', arquivo: 'carimbo-cacto.js', tamanho: 10, sombra: 'em-pe' }

function indice(animacoes: unknown[]): string {
  return JSON.stringify({ formato: 1, versao: 2, motorMinimo: '0.4.21', arquivos: [...ARQUIVOS].map((nome) => ({ nome, sha256: 'a'.repeat(64), tamanho: 10 })), animacoes })
}

function origem(modulo: unknown): OrigemDoPacote {
  return { lerIndice: async () => indice([CACTO]), importar: async () => modulo }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  esquecerPacoteCarregado()
  vi.restoreAllMocks()
})

describe('pacote — tipo carimbo', () => {
  it('lê a entrada com o tamanho e a sombra; fora da faixa, sombra estranha e id da biblioteca ficam de fora', () => {
    expect(lerEntradaDoPacote(CACTO, ARQUIVOS)).toEqual({ entrada: CACTO })
    expect(lerEntradaDoPacote({ ...CACTO, tamanho: 1 }, ARQUIVOS)).toEqual({ motivo: 'cacto: tamanho' })
    expect(lerEntradaDoPacote({ ...CACTO, tamanho: 'grande' }, ARQUIVOS)).toEqual({ motivo: 'cacto: tamanho' })
    expect(lerEntradaDoPacote({ ...CACTO, sombra: 'comprida' }, ARQUIVOS)).toEqual({ motivo: 'cacto: sombra' })
    expect(lerEntradaDoPacote({ ...CACTO, id: 'pinheiro' }, ARQUIVOS)).toEqual({ motivo: 'pinheiro: id de animação embutida' })
  })

  it('o módulo entra no catálogo com o desenho dele, e sai quando o pacote é esquecido', async () => {
    const chamadas: Array<[number, number]> = []
    const resultado = await carregarPacoteDeAnimacoes(origem({ default: (_g: unknown, giro: number, semente: number) => chamadas.push([giro, semente]) }))
    expect(resultado.registradas.map((e) => e.id)).toEqual(['cacto'])
    const cacto = carimboDoCatalogo('cacto')
    expect(cacto).toMatchObject({ nome: 'Cacto', tamanho: 10, sombra: 'em-pe', origem: 'pacote' })
    cacto?.desenhar({} as CanvasRenderingContext2D, 1.5, 3)
    expect(chamadas).toEqual([[1.5, 3]])
    expect(listarCarimbos().map((c) => c.id)).toContain('cacto')
    esquecerPacoteCarregado()
    expect(carimboDoCatalogo('cacto')).toBeNull()
    expect(listarCarimbos().some((c) => c.origem === 'pacote')).toBe(false)
  })

  it('módulo sem função fica de fora; os embutidos seguem', async () => {
    const resultado = await carregarPacoteDeAnimacoes(origem({ default: 42 }))
    expect(resultado.registradas).toEqual([])
    expect(carimboDoCatalogo('pinheiro')?.origem).toBe('embutido')
  })
})
