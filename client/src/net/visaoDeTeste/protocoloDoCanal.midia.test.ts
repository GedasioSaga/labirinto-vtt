/**
 * VISÃO DE JOGADOR e MÍDIA DA MESA: a janela de teste não tem sala para buscar
 * `/media`, então o mestre manda na `config` de onde ela busca as imagens —
 * e a janela só aceita a ponte de arquivos do Tauri, nunca uma URL de fora.
 */
import { describe, expect, it } from 'vitest'
import { lerMensagemDoHost } from './protocoloDoCanal'

const SESSAO = 'sessao-de-teste-1'
const FICHA = { id: 'tok', nome: 'Luffy', retrato: null, cor: '#35b24a', dono: null, npc: false }

function config(midia?: unknown) {
  return { de: 'host', tipo: 'config', sessao: SESSAO, geracao: 1, codigo: 'ABC234', nome: 'Luffy', ficha: FICHA, fichas: [FICHA], fichaSelecionadaId: 'tok', ...(midia === undefined ? {} : { midia }) }
}

describe('config da janela de teste com a base da mídia', () => {
  it('a base da ponte de arquivos atravessa', () => {
    const lida = lerMensagemDoHost(config('http://asset.localhost/C%3A%5Cmidia%5C'), SESSAO)
    expect(lida?.tipo === 'config' ? lida.midia : 'outra').toBe('http://asset.localhost/C%3A%5Cmidia%5C')
  })

  it('URL de fora sai calada, e a config continua valendo', () => {
    const lida = lerMensagemDoHost(config('https://espiao.example/'), SESSAO)
    expect(lida?.tipo).toBe('config')
    expect(lida !== null && 'midia' in lida).toBe(false)
  })

  it('config de antes (sem base) continua valendo', () => {
    const lida = lerMensagemDoHost(config(), SESSAO)
    expect(lida?.tipo).toBe('config')
    expect(lida !== null && 'midia' in lida).toBe(false)
  })
})
