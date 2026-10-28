import * as THREE from 'three'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { carregarPacoteDeAnimacoes, esquecerPacoteCarregado, type OrigemDoPacote } from '../../lib/pacoteDeAnimacoes'
import { criarCenaDaAbertura, listarAberturasDeBatalha } from '../../transicoes/aberturasDeBatalha'
import * as moduloDasEspadas from './espadas-cruzadas'
import meta from './espadas-cruzadas.json'

/**
 * Espadas cruzadas (aprovada em 27/10/2026): do índice do pacote até a cena.
 * A entrada `batalha` entra no registro das aberturas (e um tipo que o app não
 * conhece cai fora sem levar as outras), e o `nome` passado em `OpcoesDaCena`
 * é o texto que a cena pinta; sem nome, nenhum (pedido de 28/10/2026: antes
 * caía em "Royals").
 */

/** Os textos pintados no canvas 2D: é ali que o nome vira desenho. */
const textosPintados: string[] = []

/** jsdom não tem canvas 2D: um contexto que aceita tudo e anota os textos. */
function contextoFalso(): CanvasRenderingContext2D {
  const gradiente = { addColorStop: () => undefined }
  const anotar = (texto: string) => {
    textosPintados.push(texto)
  }
  const alvo: Record<string | symbol, unknown> = {
    getImageData: (_x: number, _y: number, largura: number, altura: number) => ({ data: new Uint8ClampedArray(largura * altura * 4) }),
    createRadialGradient: () => gradiente,
    createLinearGradient: () => gradiente,
    measureText: (texto: string) => ({ width: 50 * texto.length, actualBoundingBoxAscent: 70, actualBoundingBoxDescent: 10 }),
    fillText: anotar,
    strokeText: anotar,
  }
  // Proxy que responde a qualquer método do contexto 2D: o tipo inteiro não cabe num objeto literal de teste.
  return new Proxy(alvo, { get: (o, chave) => (chave in o ? o[chave] : () => undefined) }) as unknown as CanvasRenderingContext2D
}

const getContextOriginal = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'getContext')
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: contextoFalso, configurable: true, writable: true })
afterAll(() => {
  if (getContextOriginal) Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', getContextOriginal)
})
afterEach(() => {
  esquecerPacoteCarregado()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** jsdom também não tem `Path2D` (o contorno da lâmina): um caminho que aceita tudo. */
function Path2DFalso(): object {
  return new Proxy({}, { get: () => () => undefined })
}

const ARQUIVO = 'batalha-espadas-cruzadas.js'
const INDICE = JSON.stringify({
  formato: 1,
  versao: 1,
  motorMinimo: '0.5.3',
  arquivos: [{ nome: ARQUIVO, sha256: '0'.repeat(64), tamanho: 1 }],
  animacoes: [
    { id: 'espadas-cruzadas', tipo: 'batalha', ...meta, arquivo: ARQUIVO },
    { id: 'emboscada', tipo: 'tipo-de-um-app-mais-novo', nome: 'Emboscada', arquivo: ARQUIVO },
  ],
})
const origem: OrigemDoPacote = { lerIndice: () => Promise.resolve(INDICE), importar: () => Promise.resolve(moduloDasEspadas) }

describe('Espadas cruzadas no pacote', () => {
  it('o nome de OpcoesDaCena chega à cena; sem nome, nada é pintado', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.stubGlobal('Path2D', Path2DFalso)
    const carregado = await carregarPacoteDeAnimacoes(origem)
    expect(carregado.registradas.map((entrada) => `${entrada.tipo}/${entrada.id}`)).toEqual(['batalha/espadas-cruzadas'])
    expect(listarAberturasDeBatalha()).toEqual([{ id: 'espadas-cruzadas', nome: meta.nome, duracaoNaturalS: meta.duracaoNaturalS, quadroDaMiniaturaS: meta.quadroDaMiniaturaS, criar: expect.any(Function) }])
    const criar = criarCenaDaAbertura('espadas-cruzadas')
    if (criar === null) throw new Error('a abertura não entrou no registro')

    for (const [nome, esperado] of [
      ['Piratas do Leste', ['Piratas do Leste']],
      [undefined, []],
    ] as const) {
      textosPintados.length = 0
      const cena = criar(THREE, nome === undefined ? { reduzirMovimento: true } : { reduzirMovimento: true, nome })
      expect(new Set(textosPintados.filter((texto) => texto !== 'H'))).toEqual(new Set(esperado))
      expect(cena.atualizar(meta.duracaoNaturalS).fade).toBe(1)
      cena.descartar()
    }
  })
})
