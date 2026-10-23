import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DE_OBRA_MEIO_TERMO, meioTermoLigado, obraPedidaNaUrl, trocarObraNoTeste, versaoDoEstilo } from './estiloDoMapa'

/**
 * A CHAVE DE OBRA do Meio-Termo: desligada por padrão (o golden de pixels
 * tem de dar igual em toda fatia até a fase 3 das camadas fechar). Liga pela
 * URL só no servidor de desenvolvimento, ou pelo próprio teste.
 */

afterEach(() => {
  trocarObraNoTeste(false)
  vi.unstubAllEnvs()
  window.history.replaceState(null, '', '/')
  vi.resetModules()
})

/** O módulo de novo, do zero: a URL é lida uma vez por carga do módulo. */
async function moduloNovo(): Promise<typeof import('./estiloDoMapa')> {
  vi.resetModules()
  return import('./estiloDoMapa')
}

describe('meioTermoLigado', () => {
  it('desligada por padrão: a constante é false e nada liga sozinho', () => {
    expect(CHAVE_DE_OBRA_MEIO_TERMO).toBe(false)
    expect(meioTermoLigado()).toBe(false)
  })

  it('o teste liga a obra', () => {
    trocarObraNoTeste(true)
    expect(meioTermoLigado()).toBe(true)
  })

  it('e o afterEach desliga de novo (o teste anterior ligou)', () => {
    expect(meioTermoLigado()).toBe(false)
  })

  it('?obra=meio-termo liga no servidor de desenvolvimento', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=meio-termo')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(true)
  })

  it('?obra=meio-termo é IGNORADO fora do desenvolvimento (build de produção)', async () => {
    vi.stubEnv('DEV', false)
    window.history.replaceState(null, '', '/?obra=meio-termo')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(false)
  })

  it('outra obra na URL não liga o Meio-Termo', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=outra-coisa')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(false)
  })

  it('a URL é lida uma vez só: trocar a URL depois não muda a resposta', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=meio-termo')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(true)
    window.history.replaceState(null, '', '/')
    expect(estilo.meioTermoLigado()).toBe(true)
  })
})

describe('obraPedidaNaUrl', () => {
  it('só com desenvolvimento E o parâmetro exato', () => {
    expect(obraPedidaNaUrl(true, '?obra=meio-termo')).toBe(true)
    expect(obraPedidaNaUrl(true, '?x=1&obra=meio-termo')).toBe(true)
    expect(obraPedidaNaUrl(false, '?obra=meio-termo')).toBe(false)
    expect(obraPedidaNaUrl(true, '')).toBe(false)
    expect(obraPedidaNaUrl(true, '?obra=MEIO-TERMO')).toBe(false)
  })
})

describe('versaoDoEstilo', () => {
  it('muda quando a obra liga: as chaves de cache não misturam os dois desenhos', () => {
    const desligada = versaoDoEstilo()
    trocarObraNoTeste(true)
    const ligada = versaoDoEstilo()
    expect(ligada).not.toBe(desligada)
    trocarObraNoTeste(false)
    expect(versaoDoEstilo()).toBe(desligada)
  })
})
