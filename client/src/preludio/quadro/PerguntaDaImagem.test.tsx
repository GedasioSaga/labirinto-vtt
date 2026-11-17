import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verbeteNovo } from '../../lib/preparo/enciclopedia'
import type { TipoDeVerbete, Verbete } from '../../lib/preparo/tipos'
import { mudancaDaImagem, nomeDaImagem, PerguntaDaImagem, type DestinoDaImagem, type PerguntaDaImagemProps } from './PerguntaDaImagem'

// Fora do app não há a pasta do Prelúdio: as miniaturas mostram a inicial.
vi.mock('../midia', () => ({ useRaizDaMidia: () => null, urlDaMidia: () => null }))

let conteiner: HTMLDivElement
let raiz: Root
let contador = 0
const gerarId = (prefixo: string) => `${prefixo}-${(contador += 1)}`
const verbete = (tipo: TipoDeVerbete, titulo: string, campanhas: string[] = ['cp-mar']): Verbete => verbeteNovo(tipo, titulo, { campanhas }, gerarId)
const naLixeira = (de: Verbete): Verbete => Object.assign(de, { lixeira: '2026-11-17T10:00:00.000Z' })

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  conteiner = document.createElement('div')
  document.body.appendChild(conteiner)
  raiz = createRoot(conteiner)
})

afterEach(() => {
  act(() => raiz.unmount())
  conteiner.remove()
})

function montar(props: Partial<PerguntaDaImagemProps>) {
  const completas: PerguntaDaImagemProps = { sugestao: '', bloqueio: null, candidatos: [], jaRetrato: [], aoCriar: async () => null, aoDispensar: () => {}, ...props }
  act(() => raiz.render(<PerguntaDaImagem {...completas} />))
}

/** A tecla no que tem o foco, como o teclado faria. */
function teclar(key: string) {
  const alvo = document.activeElement ?? document.body
  act(() => {
    alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

function digitar(campo: HTMLInputElement, texto: string) {
  const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    definir?.call(campo, texto)
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

const botao = (texto: string) => [...conteiner.querySelectorAll('button')].find((cada) => cada.textContent?.trim() === texto)
const emFoco = () => document.activeElement as HTMLInputElement

describe('PerguntaDaImagem (Espaço numa imagem do quadro)', () => {
  it('Lugar dentro de outro: 2 e 2, o de perto vem primeiro (sem a Lixeira), Enter escolhe, o nome nasce "Pai: " e Criar manda o pai', async () => {
    const goa = verbete('lugar', 'Reino de Goa')
    const ilha = verbete('lugar', 'Ilha Distante')
    const ruina = naLixeira(verbete('lugar', 'Ruína Esquecida'))
    const aoCriar = vi.fn(async (_destino: DestinoDaImagem) => null)
    montar({ sugestao: 'tldrawFile', candidatos: [ilha, ruina, goa], perto: new Map([[ruina.id, 10], [goa.id, 50]]), aoCriar })

    teclar('2')
    teclar('2')
    expect(emFoco().getAttribute('role')).toBe('combobox')
    const achados = [...conteiner.querySelectorAll('[role="option"]')].map((opcao) => opcao.querySelector('.pr-transformar__achado-nome')?.textContent)
    expect(achados).toEqual(['Reino de Goa', 'Ilha Distante'])

    teclar('Enter')
    expect(conteiner.textContent).toContain('Nasce como sub-cenário de “Reino de Goa”')
    expect(emFoco().value).toBe('Reino de Goa: ')
    digitar(emFoco(), 'Reino de Goa: Taverna')
    await act(async () => botao('Criar')?.click())
    expect(aoCriar).toHaveBeenCalledWith({ t: 'novo', tipo: 'lugar', nome: 'Reino de Goa: Taverna', paiId: goa.id })
  })

  it('o que se digita manda mais que a posição: "goa" traz o Reino antes do filho mais perto, e "taverna" só o filho', () => {
    const goa = verbete('lugar', 'Reino de Goa')
    const taverna = verbete('lugar', 'Reino de Goa: Taverna')
    montar({ candidatos: [taverna, goa], perto: new Map([[taverna.id, 10], [goa.id, 400]]) })

    teclar('2')
    teclar('2')
    const nomes = () => [...conteiner.querySelectorAll('[role="option"]')].map((opcao) => opcao.querySelector('.pr-transformar__achado-nome')?.textContent)
    expect(nomes()).toEqual(['Reino de Goa: Taverna', 'Reino de Goa'])
    digitar(emFoco(), 'goa')
    expect(nomes()).toEqual(['Reino de Goa', 'Reino de Goa: Taverna'])
    digitar(emFoco(), 'taverna')
    expect(nomes()).toEqual(['Reino de Goa: Taverna'])
  })

  it('Item quebrado: 3 e 2, Enter escolhe o item, o nome pronto "Quebrado" e Criar manda a forma nova', async () => {
    const espada = verbete('item', 'Espada Longa')
    const aoCriar = vi.fn(async (_destino: DestinoDaImagem) => null)
    montar({ sugestao: 'espada rachada', candidatos: [espada, verbete('lugar', 'Reino de Goa')], aoCriar })

    teclar('3')
    teclar('2')
    teclar('Enter')
    expect(emFoco().value).toBe('espada rachada')
    act(() => botao('Quebrado')?.click())
    expect(emFoco().value).toBe('Quebrado')
    await act(async () => botao('Criar')?.click())
    expect(aoCriar).toHaveBeenCalledWith({ t: 'forma', verbeteId: espada.id, nome: 'Quebrado' })
  })

  it('a imagem colada (tldrawFile) começa sem nome, com o foco no campo; Criar sem nome não cria e diz o que falta', async () => {
    const aoCriar = vi.fn(async (_destino: DestinoDaImagem) => null)
    montar({ sugestao: 'tldrawFile', aoCriar })

    teclar('4')
    expect(emFoco().value).toBe('')
    expect(emFoco().labels?.[0]?.textContent).toBe('Nome da facção')
    await act(async () => botao('Criar')?.click())
    expect(aoCriar).not.toHaveBeenCalled()
    expect(conteiner.textContent).toContain('Escreva o nome.')
  })

  it('Backspace fora de um campo volta ao passo 1 com o foco no tipo, Esc fecha, e nenhuma tecla chega aos atalhos do quadro', () => {
    const aoDispensar = vi.fn()
    const naPagina = vi.fn()
    document.body.addEventListener('keydown', naPagina)
    montar({ aoDispensar })

    teclar('1')
    expect(conteiner.textContent).toContain('Passo 2 de 2')
    teclar('Backspace')
    expect(conteiner.textContent).toContain('Passo 1 de 2')
    expect(document.activeElement?.getAttribute('data-tipo')).toBe('personagem')
    teclar('Escape')
    expect(aoDispensar).toHaveBeenCalledTimes(1)
    expect(naPagina).not.toHaveBeenCalled()
    document.body.removeEventListener('keydown', naPagina)
  })
})

describe('mudancaDaImagem e nomeDaImagem', () => {
  it('o lugar de dentro nasce com o pai e as campanhas dele; a versão é forma nova com a imagem; o pai na Lixeira é recusado', () => {
    const goa = verbete('lugar', 'Reino de Goa', ['cp-goa'])
    const contexto = { verbetes: new Map([[goa.id, goa]]), soLeitura: new Map<string, string>(), campanha: 'cp-quadro' }
    const imagem = 'midia/abcdef12.png'

    const dentro = mudancaDaImagem({ t: 'novo', tipo: 'lugar', nome: 'Reino de Goa: Taverna', paiId: goa.id }, imagem, contexto, gerarId)
    expect(dentro.t === 'criar' && { pai: dentro.verbete.paiId, campanhas: dentro.verbete.campanhas, retrato: dentro.verbete.formas[0]?.retrato }).toEqual({ pai: goa.id, campanhas: ['cp-goa'], retrato: imagem })
    const solto = mudancaDaImagem({ t: 'novo', tipo: 'personagem', nome: 'Kuro' }, imagem, contexto, gerarId)
    expect(solto.t === 'criar' && { pai: solto.verbete.paiId, campanhas: solto.verbete.campanhas }).toEqual({ pai: undefined, campanhas: ['cp-quadro'] })
    const versao = mudancaDaImagem({ t: 'forma', verbeteId: goa.id, nome: 'Noite' }, imagem, contexto, gerarId)
    expect(versao.t === 'forma' && { nome: versao.forma.nome, retrato: versao.forma.retrato, secoes: versao.forma.secoes.length }).toEqual({ nome: 'Noite', retrato: imagem, secoes: goa.formas[0]?.secoes.length })

    naLixeira(goa)
    expect(mudancaDaImagem({ t: 'novo', tipo: 'lugar', nome: 'Taverna', paiId: goa.id }, imagem, contexto, gerarId).t).toBe('recusa')
  })

  it('nome que não diz nada (tldrawFile, image, data, hash) vira vazio; nome de verdade fica', () => {
    expect(['tldrawFile', 'image', 'IMG 20231012 123456', 'Captura de tela 2026 11 17 101500', 'Screenshot 2026 11 17 at 10.15.00', 'a3f9c2e1b7d4', '  '].map(nomeDaImagem)).toEqual(['', '', '', '', '', '', ''])
    expect(['taverna do porto', 'Reino de Goa noite', 'foto do Bruce', 'cafe'].map(nomeDaImagem)).toEqual(['taverna do porto', 'Reino de Goa noite', 'foto do Bruce', 'cafe'])
  })
})
