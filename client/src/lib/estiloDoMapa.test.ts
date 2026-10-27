import { afterEach, describe, expect, it, vi } from 'vitest'
import { CHAVE_DE_OBRA_MEIO_TERMO, meioTermoLigado, obraDaUrl, trocarObraNoTeste, versaoDoEstilo } from './estiloDoMapa'

/**
 * A CHAVE DE OBRA do Meio-Termo. O padrão do produto é a constante (MT12:
 * ligada para todo mundo). O teste força ligada ou desligada; a URL liga ou
 * desliga SÓ no servidor de desenvolvimento.
 */

afterEach(() => {
  trocarObraNoTeste()
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
  it('MT12: a constante é true, o Meio-Termo ligado para todo mundo', () => {
    expect(CHAVE_DE_OBRA_MEIO_TERMO).toBe(true)
  })

  it('sem teste nem URL, vale a constante (o padrão do produto)', () => {
    expect(meioTermoLigado()).toBe(CHAVE_DE_OBRA_MEIO_TERMO)
  })

  it('o teste liga a obra', () => {
    trocarObraNoTeste(true)
    expect(meioTermoLigado()).toBe(true)
  })

  it('o teste DESLIGA a obra: false vence a constante', () => {
    trocarObraNoTeste(false)
    expect(meioTermoLigado()).toBe(false)
  })

  it('e o afterEach volta ao padrão (o teste anterior forçou)', () => {
    expect(meioTermoLigado()).toBe(CHAVE_DE_OBRA_MEIO_TERMO)
  })

  it('false do teste vence também a URL que liga', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=meio-termo')
    const estilo = await moduloNovo()
    estilo.trocarObraNoTeste(false)
    expect(estilo.meioTermoLigado()).toBe(false)
  })

  it('?obra=meio-termo liga no servidor de desenvolvimento', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=meio-termo')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(true)
  })

  it('?obra=linhas DESLIGA no servidor de desenvolvimento', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=linhas')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(false)
  })

  it('a URL é IGNORADA fora do desenvolvimento (build de produção): vale a constante', async () => {
    vi.stubEnv('DEV', false)
    for (const url of ['/?obra=meio-termo', '/?obra=linhas']) {
      window.history.replaceState(null, '', url)
      const estilo = await moduloNovo()
      expect(estilo.meioTermoLigado()).toBe(estilo.CHAVE_DE_OBRA_MEIO_TERMO)
    }
  })

  it('outra obra na URL não muda nada', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=outra-coisa')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(estilo.CHAVE_DE_OBRA_MEIO_TERMO)
  })

  it('a URL é lida uma vez só: trocar a URL depois não muda a resposta', async () => {
    vi.stubEnv('DEV', true)
    window.history.replaceState(null, '', '/?obra=linhas')
    const estilo = await moduloNovo()
    expect(estilo.meioTermoLigado()).toBe(false)
    window.history.replaceState(null, '', '/?obra=meio-termo')
    expect(estilo.meioTermoLigado()).toBe(false)
  })
})

describe('obraDaUrl', () => {
  it('só com desenvolvimento E o valor exato', () => {
    expect(obraDaUrl(true, '?obra=meio-termo')).toBe(true)
    expect(obraDaUrl(true, '?x=1&obra=meio-termo')).toBe(true)
    expect(obraDaUrl(true, '?obra=linhas')).toBe(false)
    expect(obraDaUrl(false, '?obra=meio-termo')).toBeUndefined()
    expect(obraDaUrl(false, '?obra=linhas')).toBeUndefined()
    expect(obraDaUrl(true, '')).toBeUndefined()
    expect(obraDaUrl(true, '?obra=MEIO-TERMO')).toBeUndefined()
  })
})

describe('versaoDoEstilo', () => {
  it('muda quando a obra liga: as chaves de cache não misturam os dois desenhos', () => {
    trocarObraNoTeste(false)
    const desligada = versaoDoEstilo()
    trocarObraNoTeste(true)
    const ligada = versaoDoEstilo()
    expect(ligada).not.toBe(desligada)
    trocarObraNoTeste(false)
    expect(versaoDoEstilo()).toBe(desligada)
  })
})
