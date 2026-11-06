import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MensagemDoChat } from '../../lib/nuvem/chatDoLobby'
import type { NoticiaDoMural } from '../../lib/nuvem/muralDoLobby'
import type { MembroProjetado } from '../../lib/nuvem/tipos'
import type { ConversaDoChat } from '../dados/chatDaCampanha'
import type { Site } from '../dados/lobbyStore'
import { Conversa } from './chat/Conversa'
import { SiteContexto } from './contexto'
import { CartaoDaNoticia } from './mural/CartaoDaNoticia'

/**
 * XSS LITERAL no site do Lobby: o texto do chat e do mural é sempre filho de
 * texto do React, nunca HTML. Quem escreve `<img src=x onerror=...>` vê o que
 * escreveu, e nenhum elemento nasce dele (nem dentro de uma menção).
 */

const ATAQUES = ['<img src=x onerror="globalThis.__xssDoLobby=1">', '<script>globalThis.__xssDoLobby=2</script>', '<a href="javascript:globalThis.__xssDoLobby=3">clique</a>', '<svg onload="globalThis.__xssDoLobby=4"></svg>']

const NAMI: MembroProjetado = { contaId: 'conta_nami', nome: 'Nami', papel: 'jogador' } as MembroProjetado
const MESTRE: MembroProjetado = { contaId: 'mestre', nome: 'Mestre', papel: 'mestre' } as MembroProjetado

/** Só o que as duas telas chamam ao montar: sem chat nem mural ligados. */
// Teste: um Site falso com o mínimo que a tela usa ao desenhar.
const SITE_FALSO = { chat: () => null, mural: () => null, irPara: () => undefined } as unknown as Site

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  delete (globalThis as { __xssDoLobby?: number }).__xssDoLobby
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function noticia(texto: string): NoticiaDoMural {
  return { id: 1, autorContaId: 'mestre', autorNome: 'Mestre', texto, imagem: null, mencoes: [], fixada: false, versao: 1, criadaEm: 1_800_000_000_000, editadaEm: null, apagadaEm: null, reacoes: [], minhaReacao: null, lida: true }
}

function mensagem(id: number, texto: string): MensagemDoChat {
  return { id, autorContaId: 'conta_nami', autorNome: 'Nami', texto, mencoes: [], criadaEm: 1_800_000_000_000 + id, apagadaEm: null, mudou: id }
}

function conversa(mensagens: readonly MensagemDoChat[]): ConversaDoChat {
  // Teste: só os campos que a Conversa lê para desenhar as linhas.
  return { chave: 'sala', canal: 'sala', mensagens, pendentes: [], carregada: true, carregando: false, temMaisAntigas: false, ultimaId: mensagens.length, lidaAte: mensagens.length, naoLidas: 0, mencaoNaoLida: false, fechada: false, apagando: new Set<number>() } as unknown as ConversaDoChat
}

function semElementoInjetado(): void {
  expect(container.querySelector('img[src="x"], script, svg[onload], a[href^="javascript:"]')).toBeNull()
  for (const elemento of container.querySelectorAll('*')) {
    for (const atributo of elemento.getAttributeNames()) expect(atributo.startsWith('on'), `${elemento.tagName} ${atributo}`).toBe(false)
  }
  expect((globalThis as { __xssDoLobby?: number }).__xssDoLobby).toBeUndefined()
}

describe('o mural mostra o texto literal', () => {
  for (const ataque of ATAQUES) {
    it(`notícia com ${ataque.slice(0, 12)}… aparece como foi escrita, sem virar elemento`, () => {
      act(() => {
        root.render(
          <SiteContexto.Provider value={SITE_FALSO}>
            <CartaoDaNoticia noticia={noticia(ataque)} eu={NAMI} souMestre={false} membros={[NAMI, MESTRE]} pronto aCaminho={undefined} recusa={undefined} nova={false} campanhaId="camp" demo imagens={[]} agora={1_800_000_100_000} />
          </SiteContexto.Provider>,
        )
      })
      expect(container.textContent).toContain(ataque)
      semElementoInjetado()
    })
  }

  it('uma menção colada no HTML (@Nami dentro de <b>) vira menção de texto, e o resto continua literal', () => {
    act(() => {
      root.render(
        <SiteContexto.Provider value={SITE_FALSO}>
          <CartaoDaNoticia noticia={noticia('<b>@Nami</b><img src=x onerror=alert(1)>')} eu={NAMI} souMestre={false} membros={[NAMI, MESTRE]} pronto aCaminho={undefined} recusa={undefined} nova={false} campanhaId="camp" demo imagens={[]} agora={1_800_000_100_000} />
        </SiteContexto.Provider>,
      )
    })
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('.lo-chat__mencao')?.textContent).toBe('@Nami')
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
    semElementoInjetado()
  })
})

describe('o chat mostra o texto literal', () => {
  it('cada ataque aparece como foi escrito numa mensagem da sala, sem virar elemento', () => {
    const mensagens = ATAQUES.map((ataque, i) => mensagem(i + 1, ataque))
    act(() => {
      root.render(
        <SiteContexto.Provider value={SITE_FALSO}>
          <Conversa chave="sala" canal="sala" conversa={conversa(mensagens)} pronto eu={NAMI} membros={[NAMI, MESTRE]} titulo="Sala" descricao="" nomeDaMesa="Mesa" comAviso={false} bloqueado={null} coberta={false} />
        </SiteContexto.Provider>,
      )
    })
    for (const ataque of ATAQUES) expect(container.textContent).toContain(ataque)
    semElementoInjetado()
  })

  it('quebra de linha, tab e emoji passam literais (o encoding não muda o texto)', () => {
    const texto = 'linha 1\nlinha 2\tcom tab 🏴‍☠️ e ação — “aspas”'
    act(() => {
      root.render(
        <SiteContexto.Provider value={SITE_FALSO}>
          <Conversa chave="sala" canal="sala" conversa={conversa([mensagem(1, texto)])} pronto eu={NAMI} membros={[NAMI, MESTRE]} titulo="Sala" descricao="" nomeDaMesa="Mesa" comAviso={false} bloqueado={null} coberta={false} />
        </SiteContexto.Provider>,
      )
    })
    expect(container.textContent).toContain(texto)
  })
})
