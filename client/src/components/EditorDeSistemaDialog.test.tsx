/**
 * A janela do EDITOR DE SISTEMA (entrega 6): o Salvar recusa com a razão na
 * seção certa, a prévia do rank acompanha a digitação, a prévia do livro
 * desenha a marcação sem nunca virar HTML, a ficha de exemplo usa a ficha de
 * verdade — e mudar um sistema em uso não apaga nada das fichas.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { rascunhoDoSistema, rascunhoEmBranco, sistemaDoRascunho, type RascunhoDoSistema } from '../lib/editorDeSistema'
import { novoCartao, novoPersonagem, type Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { EditorDeSistemaDialog } from './EditorDeSistemaDialog'
import { FichaDePersonagemDialog } from './FichaDePersonagemDialog'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => (candidato.getAttribute('aria-label') ?? candidato.textContent?.trim()) === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

/** A seção pelo nome na barra da esquerda (o selo de problemas fica fora do nome). */
function secao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.lb-sistema-editor__secao')).find((candidato) => candidato.firstElementChild?.textContent === nome)
  if (achado === undefined) throw new Error(`seção "${nome}" não está na barra`)
  return achado
}

/** O N-ésimo campo com esse rótulo (as linhas de uma lista repetem os rótulos). */
function campo(rotulo: string, indice = 0): HTMLInputElement | HTMLTextAreaElement {
  const rotulos = Array.from(document.body.querySelectorAll<HTMLLabelElement>('label')).filter((label) => label.textContent === rotulo)
  const alvo = rotulos[indice] === undefined ? null : document.getElementById(rotulos[indice].htmlFor)
  if (!(alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement)) throw new Error(`campo "${rotulo}" #${indice} não está na tela`)
  return alvo
}

function digitar(alvo: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  const prototipo = alvo instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set
  act(() => {
    setter?.call(alvo, valor)
    alvo.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('EditorDeSistemaDialog', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function abrir(inicial: RascunhoDoSistema) {
    const onSalvar = vi.fn<(sistema: SistemaDeRpg) => Promise<void>>(async () => undefined)
    const onClose = vi.fn()
    act(() => root.render(<EditorDeSistemaDialog inicial={inicial} idsDaBiblioteca={new Set([SISTEMA_ONE_PIECE.id])} onSalvar={onSalvar} onClose={onClose} />))
    return { onSalvar, onClose }
  }

  it('o Salvar recusa o sistema em branco dizendo o quê e onde; corrigido, grava com o id que saiu do nome', async () => {
    const { onSalvar } = abrir(rascunhoEmBranco())
    // Sistema novo começa pelo nome (não pela cor, o primeiro campo da seção).
    expect(document.activeElement).toBe(campo('Nome'))
    await act(async () => botao('Salvar').click())
    expect(onSalvar).not.toHaveBeenCalled()
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe('3 problemas impedem salvar: veja as seções marcadas.')
    expect(document.body.querySelector('.lb-sistema-editor__erros')?.textContent).toBe('O sistema precisa de um nome.')
    expect(secao('Atributos').querySelector('.lb-sistema-editor__selo')?.getAttribute('aria-label')).toBe('2 problemas')

    digitar(campo('Nome'), 'Sistema da Casa')
    act(() => secao('Atributos').click())
    expect(Array.from(document.body.querySelectorAll('.lb-sistema-editor__erros li')).map((erro) => erro.textContent)).toEqual([
      'O atributo 1 está sem nome.',
      'Atributo 1: falta a abreviação (o rótulo curto dos chips, como FOR).',
    ])
    digitar(campo('Nome'), 'Força')
    digitar(campo('Abreviação'), 'FOR')
    await act(async () => botao('Salvar').click())
    expect(onSalvar).toHaveBeenCalledTimes(1)
    const salvo = onSalvar.mock.calls[0][0]
    expect({ id: salvo.id, nome: salvo.nome, atributos: salvo.atributos }).toEqual({ id: 'sistema-da-casa', nome: 'Sistema da Casa', atributos: [{ id: 'forca', nome: 'Força', abreviacao: 'FOR' }] })
    expect(document.body.querySelector('[role="status"]')?.textContent).toBe('Sistema da Casa salvo na biblioteca.')
    // Salvo, o id trava: é a chave do valor nas fichas.
    expect(campo('Id').readOnly).toBe(true)
  })

  it('a prévia do rank acompanha a digitação: Força 60 → R2', () => {
    abrir(rascunhoDoSistema(SISTEMA_ONE_PIECE))
    act(() => secao('Atributos').click())
    const previa = () => document.body.querySelector('.lb-sistema-editor__previa-rank')?.textContent
    expect(previa()).toBe('valor 40 → R2')
    digitar(campo('Testar valor'), '60')
    expect(previa()).toBe('valor 60 → R2')
    digitar(campo('Testar valor'), '39')
    expect(previa()).toBe('valor 39 → R1')
    digitar(campo('Limiares'), '40, 30')
    expect(previa()).toBe('corrija a tabela')
  })

  it('a prévia do capítulo desenha a marcação só com texto: <script> aparece escrito e nunca roda', () => {
    abrir(rascunhoDoSistema(SISTEMA_ONE_PIECE))
    act(() => secao('Livro').click())
    digitar(campo('Texto'), '# Regras\n**forte** e <script>alert(1)</script> <img src=x onerror=alert(1)>')
    const previa = document.body.querySelector('.lb-sistema-editor__previa-livro')
    expect(previa?.querySelector('h3:not(.lb-sistema-editor__previa-titulo)')?.textContent).toBe('Regras')
    expect(previa?.querySelector('strong')?.textContent).toBe('forte')
    expect(previa?.textContent).toContain('<script>alert(1)</script>')
    expect(previa?.querySelector('script, img')).toBeNull()
  })

  it('a prévia da ficha é a ficha de verdade, com o personagem de exemplo', () => {
    abrir(rascunhoDoSistema(SISTEMA_ONE_PIECE))
    act(() => secao('Prévia da ficha').click())
    const previa = document.body.querySelector('.lb-sistema-editor__previa')
    expect(previa?.textContent).toContain('Personagem de exemplo')
    expect(Array.from(previa?.querySelectorAll('.lb-ficha__atributo-nome') ?? []).map((nome) => nome.textContent)).toEqual(SISTEMA_ONE_PIECE.atributos.map((atributo) => atributo.nome))
  })

  it('fechar com mudança não salva pergunta antes', () => {
    const { onClose } = abrir(rascunhoDoSistema(SISTEMA_ONE_PIECE))
    act(() => botao('Fechar').click())
    expect(onClose).toHaveBeenCalledTimes(1)
    digitar(campo('Nome'), 'One Piece da Mesa')
    act(() => botao('Cancelar').click())
    expect(document.body.textContent).toContain('O sistema tem mudanças que não foram salvas.')
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => botao('Descartar e fechar').click())
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('mudar um sistema em uso não apaga nada das fichas', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  /** O One Piece editado: sem Agilidade, sem a escolha Raça, sem o campo Ação da técnica; Força virou "Poder". */
  function onePieceEditado(): SistemaDeRpg {
    const rascunho = rascunhoDoSistema(SISTEMA_ONE_PIECE)
    const editado: RascunhoDoSistema = {
      ...rascunho,
      escolhas: rascunho.escolhas.filter((escolha) => escolha.id !== 'raca'),
      atributos: rascunho.atributos.filter((atributo) => atributo.id !== 'agilidade').map((atributo) => (atributo.id === 'forca' ? { ...atributo, nome: 'Poder' } : atributo)),
      abas: rascunho.abas.map((aba) => (aba.id === 'habilidades' ? { ...aba, campos: aba.campos.filter((campoDaAba) => campoDaAba.id !== 'acao') } : aba)),
    }
    const resultado = sistemaDoRascunho(editado, new Set())
    if (!resultado.ok) throw new Error(resultado.erros.map((erro) => erro.texto).join(' | '))
    return resultado.sistema
  }

  function luffy(): Personagem {
    const base = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy')
    return {
      ...base,
      escolhas: { raca: 'Humano', oficio: 'Navegador' },
      atributos: { ...base.atributos, forca: 60, agilidade: 33 },
      abas: { ...base.abas, habilidades: [{ ...novoCartao('Habilidade'), id: 'cart_gomu', nome: 'Gomu Gomu', campos: { acao: 'Padrão', descricao: 'Estica.' } }] },
    }
  }

  it('o removido some da tela e continua guardado; o renomeado só troca o rótulo; salvar a ficha não perde nada', () => {
    const onSalvar = vi.fn<(personagem: Personagem) => void>()
    const sistema = onePieceEditado()
    act(() =>
      root.render(
        <FichaDePersonagemDialog
          personagem={luffy()}
          sistema={sistema}
          sistemaId={sistema.id}
          editandoNoInicio={false}
          onSalvar={onSalvar}
          onClose={vi.fn()}
          escolherImagem={async () => null}
          tokens={[]}
          onLigarToken={vi.fn()}
        />,
      ),
    )
    const nomes = Array.from(document.body.querySelectorAll('.lb-ficha__atributo-nome')).map((nome) => nome.textContent)
    expect(nomes).toContain('Poder')
    expect(nomes).not.toContain('Força')
    expect(nomes).not.toContain('Agilidade')
    expect(document.body.textContent).not.toContain('Humano')

    act(() => botao('Editar').click())
    digitar(campo('Poder'), '70')
    act(() => botao('Salvar').click())
    expect(onSalvar).toHaveBeenCalledTimes(1)
    const salvo = onSalvar.mock.calls[0][0]
    expect(salvo.atributos.forca).toBe(70)
    expect(salvo.atributos.agilidade).toBe(33)
    expect(salvo.escolhas.raca).toBe('Humano')
    expect(salvo.abas.habilidades[0].campos).toEqual({ acao: 'Padrão', descricao: 'Estica.' })
  })
})
