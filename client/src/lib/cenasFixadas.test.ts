import { describe, expect, it } from 'vitest'
import { alternarFixada, lembrarRecente, lerListaDeIds, MAX_FIXADAS, recentesAVista } from './cenasFixadas'

describe('Hoje na sessão: fixadas e recentes', () => {
  it('fixa no fim, na ordem de quem fixou; tira; a sexta não entra e a lista volta igual', () => {
    let fixadas: string[] = []
    for (const id of ['praca', 'clareira', 'porao', 'capela', 'banhos']) fixadas = alternarFixada(fixadas, id).fixadas
    expect(fixadas).toEqual(['praca', 'clareira', 'porao', 'capela', 'banhos'])
    expect(fixadas).toHaveLength(MAX_FIXADAS)
    const sexta = alternarFixada(fixadas, 'mercado')
    expect(sexta).toEqual({ fixadas: ['praca', 'clareira', 'porao', 'capela', 'banhos'], cheia: true })
    const semPorao = alternarFixada(fixadas, 'porao')
    expect(semPorao).toEqual({ fixadas: ['praca', 'clareira', 'capela', 'banhos'], cheia: false })
    // Com a vaga aberta, a nova entra no fim.
    expect(alternarFixada(semPorao.fixadas, 'mercado').fixadas).toEqual(['praca', 'clareira', 'capela', 'banhos', 'mercado'])
  })

  it('recentes: a mais nova na frente, sem repetir; à vista sem fixadas, sem a aberta e sem apagada; lixo guardado vira lista vazia', () => {
    let recentes: string[] = []
    for (const id of ['capela', 'banhos', 'mercado', 'capela', 'praca']) recentes = lembrarRecente(recentes, id)
    expect(recentes).toEqual(['praca', 'capela', 'mercado', 'banhos'])
    const existem = new Set(['praca', 'capela', 'mercado', 'banhos', 'clareira'])
    expect(recentesAVista(recentes, ['capela'], 'praca', existem)).toEqual(['mercado', 'banhos'])
    expect(recentesAVista(['sumiu', ...recentes], [], null, existem)).toEqual(['praca', 'capela', 'mercado'])
    for (const lixo of [null, '', 'não é json', '{"a":1}', '42', '[1, null, ""]']) expect(lerListaDeIds(lixo)).toEqual([])
    expect(lerListaDeIds('["praca", 3, "capela"]')).toEqual(['praca', 'capela'])
  })
})
