import { act, createRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLivroDoMestreStore, type PaginaDoMestre } from '../../stores/livroDoMestreStore'
import { theme } from '../../theme'
import { NOVO_TOKEN_CAMPO_ID } from '../NovoTokenForm'
import { FolhaDoLivro } from './FolhaDoLivro'
import { LivroDoMestre, type AcoesDoArquivo, type LivroDoMestreProps } from './LivroDoMestre'

/*
 * O LIVRO DO MESTRE (fatia 2 do design consolidado): a lombada com os quatro
 * marcadores, o recolher, o ponto da Ficha e o topo com a antiga barra de
 * ações (Desfazer, Refazer, Salvar, o menu Arquivo, os atalhos, o "+ Token",
 * Procurar). O que cada botão faz não mudou: o livro só chama o mesmo handler.
 */

const PAGINAS: readonly PaginaDoMestre[] = ['ficha', 'cena', 'aventura', 'acervo']

function arquivo(extra: Partial<AcoesDoArquivo> = {}): AcoesDoArquivo {
  return {
    onAbrir: vi.fn(),
    onImportarPasta: vi.fn(),
    onExportarPasta: vi.fn(),
    onExportarImagem: vi.fn(),
    temImagemDeFundo: false,
    onImportarFundo: vi.fn(),
    onChaoDoFundo: vi.fn(),
    onLinhasDoFundo: vi.fn(),
    onRecriarMinimapa: vi.fn(),
    onInicio: vi.fn(),
    ...extra,
  }
}

function props(extra: Partial<LivroDoMestreProps> = {}): Omit<LivroDoMestreProps, 'children'> {
  return {
    temSelecao: false,
    onDesfazer: vi.fn(),
    onRefazer: vi.fn(),
    podeDesfazer: true,
    podeRefazer: false,
    onSalvar: vi.fn(),
    arquivo: arquivo(),
    onAtalhos: vi.fn(),
    atalhosAbertos: false,
    onProcurar: vi.fn(),
    configuracoes: <button type="button" aria-label="Configurações do mapa" />,
    ...extra,
  }
}

describe('LivroDoMestre — lombada, recolher e topo', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useLivroDoMestreStore.setState({ pagina: 'ficha', recolhido: false, novoTokenAberto: false })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(extra: Partial<LivroDoMestreProps> = {}): void {
    act(() =>
      root.render(
        <LivroDoMestre {...props(extra)}>
          {PAGINAS.map((pagina) => (
            <FolhaDoLivro key={pagina} pagina={pagina}>
              <p>{`Conteúdo de ${pagina}`}</p>
            </FolhaDoLivro>
          ))}
        </LivroDoMestre>,
      ),
    )
  }

  const livro = () => container.querySelector<HTMLElement>('aside[aria-label="Livro do mestre"]')
  const aba = (nome: string) => Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => b.textContent === nome) ?? null
  const botao = (nome: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.getAttribute('aria-label') === nome) ?? null
  const folhaAberta = () => Array.from(container.querySelectorAll<HTMLElement>('.gr-folha')).filter((f) => !f.hidden).map((f) => f.dataset.pagina)
  const itensDoMenu = () => Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"]')).map((item) => item.textContent)

  it('a lombada tem os quatro marcadores, que trocam a página aberta', () => {
    render()
    const marcadores = container.querySelector('[role="tablist"]')
    expect(marcadores?.getAttribute('aria-label')).toBe('Páginas do livro do mestre')
    expect(Array.from(marcadores?.querySelectorAll('[role="tab"]') ?? []).map((b) => b.textContent)).toEqual(['Ficha', 'Cena', 'Aventura', 'Acervo'])
    expect(folhaAberta()).toEqual(['ficha'])
    act(() => aba('Aventura')?.click())
    expect(useLivroDoMestreStore.getState().pagina).toBe('aventura')
    expect(aba('Aventura')?.getAttribute('aria-selected')).toBe('true')
    expect(folhaAberta()).toEqual(['aventura'])
    // Cada marcador controla o mesmo painel, que diz qual página está aberta.
    const painel = document.getElementById(aba('Aventura')?.getAttribute('aria-controls') ?? 'sem-id')
    expect(painel?.getAttribute('role')).toBe('tabpanel')
  })

  it('recolher guarda a página dentro da lombada; um marcador a traz de volta', () => {
    render()
    const recolher = botao('Recolher a página')
    expect(recolher?.getAttribute('aria-expanded')).toBe('true')
    act(() => recolher?.click())
    expect(livro()?.classList.contains('gr-e-recolhido')).toBe(true)
    expect(container.querySelector('.gr-pagina-trilho')?.hasAttribute('inert')).toBe(true)
    expect(botao('Abrir a página')?.getAttribute('aria-expanded')).toBe('false')
    act(() => aba('Cena')?.click())
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'cena', recolhido: false })
    expect(container.querySelector('.gr-pagina-trilho')?.hasAttribute('inert')).toBe(false)
  })

  it('o que o livro tapa do mapa: o livro inteiro aberto, só a lombada recolhido', () => {
    const obstaculo = createRef<HTMLElement>()
    render({ obstaculoRef: obstaculo })
    expect(obstaculo.current).toBe(livro())
    act(() => useLivroDoMestreStore.getState().setRecolhido(true))
    expect(obstaculo.current?.classList.contains('gr-lombada')).toBe(true)
  })

  it('com algo selecionado e outra página aberta, o marcador Ficha ganha o ponto', () => {
    render({ temSelecao: true })
    const ponto = () => aba('Ficha')?.querySelector('.gr-marcador__ponto')
    expect(ponto()?.classList.contains('gr-vis')).toBe(false)
    act(() => aba('Acervo')?.click())
    expect(ponto()?.classList.contains('gr-vis')).toBe(true)
    render({ temSelecao: false })
    expect(ponto()?.classList.contains('gr-vis')).toBe(false)
  })

  it('o topo chama os mesmos handlers da antiga barra de ações', () => {
    const p = props()
    render(p)
    act(() => botao('Desfazer')?.click())
    act(() => botao('Salvar')?.click())
    act(() => botao('Atalhos do teclado')?.click())
    expect(p.onDesfazer).toHaveBeenCalledTimes(1)
    expect(p.onSalvar).toHaveBeenCalledTimes(1)
    expect(p.onAtalhos).toHaveBeenCalledTimes(1)
    // Sem nada para refazer, o botão fica no lugar, desligado.
    expect(botao('Refazer')?.disabled).toBe(true)
    expect(botao('Atalhos do teclado')?.getAttribute('aria-haspopup')).toBe('dialog')
  })

  it('o menu Arquivo junta abrir, importar, exportar, a imagem de fundo e o início', () => {
    const acoes = arquivo()
    render({ arquivo: acoes })
    const gatilho = botao('Arquivo')
    expect(gatilho?.getAttribute('aria-haspopup')).toBe('menu')
    act(() => gatilho?.click())
    expect(gatilho?.getAttribute('aria-expanded')).toBe('true')
    // Sem imagem de fundo, só importar uma: as conversões precisam dela.
    expect(itensDoMenu()).toEqual([
      'Abrir…',
      'Importar mapa (pasta)…',
      'Exportar mapa (pasta)…',
      'Exportar imagem (PNG)…',
      'Importar imagem de fundo…',
      'Voltar ao início',
    ])
    const item = (nome: string) => Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent === nome)
    act(() => item('Exportar imagem (PNG)…')?.click())
    expect(acoes.onExportarImagem).toHaveBeenCalledTimes(1)
    expect(gatilho?.getAttribute('aria-expanded')).toBe('false')
  })

  it('o selo no alto da lombada volta ao início, o mesmo "Voltar ao início" do menu Arquivo', () => {
    const acoes = arquivo()
    render({ arquivo: acoes })
    const selo = container.querySelector<HTMLButtonElement>('.gr-lombada__selo')
    expect(selo?.tagName).toBe('BUTTON')
    expect(selo?.getAttribute('aria-label')).toBe('Voltar ao início')
    act(() => selo?.click())
    expect(acoes.onInicio).toHaveBeenCalledTimes(1)
  })

  it('com imagem de fundo, o menu Arquivo troca a imagem e oferece as três conversões', () => {
    const acoes = arquivo({ temImagemDeFundo: true })
    render({ arquivo: acoes })
    act(() => botao('Arquivo')?.click())
    expect(itensDoMenu()).toEqual(
      expect.arrayContaining(['Trocar imagem de fundo…', 'Chão a partir da imagem', 'Linhas e portas a partir da imagem', 'Recriar minimapa completo']),
    )
    expect(itensDoMenu()).not.toContain('Importar imagem de fundo…')
    const item = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')).find((b) => b.textContent === 'Recriar minimapa completo')
    act(() => item?.click())
    expect(acoes.onRecriarMinimapa).toHaveBeenCalledTimes(1)
  })

  it('o "+ Token" abre a Ficha (mesmo recolhida ou em outra página) com o campo do nome', () => {
    render()
    act(() => useLivroDoMestreStore.setState({ pagina: 'acervo', recolhido: true }))
    act(() => botao('Adicionar token')?.click())
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', recolhido: false, novoTokenAberto: true })
  })

  it('com o campo do nome já aberto, o "+ Token" de outra página traz a Ficha e põe o cursor no campo', () => {
    useLivroDoMestreStore.setState({ pagina: 'cena', recolhido: true, novoTokenAberto: true })
    act(() =>
      root.render(
        <LivroDoMestre {...props()}>
          {PAGINAS.map((pagina) => (
            <FolhaDoLivro key={pagina} pagina={pagina}>
              {pagina === 'ficha' ? <input id={NOVO_TOKEN_CAMPO_ID} aria-label="Nome do novo token" /> : <p>{pagina}</p>}
            </FolhaDoLivro>
          ))}
        </LivroDoMestre>,
      ),
    )
    act(() => botao('Adicionar token')?.click())
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'ficha', recolhido: false, novoTokenAberto: true })
    expect(document.activeElement?.id).toBe(NOVO_TOKEN_CAMPO_ID)
  })

  it('o App renderizar de novo (arrastar token, pincelada) não reposiciona a fita: nada de layout forçado por quadro', () => {
    render()
    const fita = container.querySelector<HTMLElement>('.gr-fita')
    expect(fita).not.toBeNull()
    if (fita === null) return
    // Marca a posição à mão: se o efeito rodar de novo, ele a sobrescreve.
    fita.style.transform = 'translateY(999px)'
    render({ podeDesfazer: false })
    render({ podeRefazer: true })
    expect(fita.style.transform).toBe('translateY(999px)')
  })

  it('Procurar chama o mesmo caminho do Ctrl+K', () => {
    const p = props()
    render(p)
    const procurar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Procurar')
    act(() => procurar?.click())
    expect(p.onProcurar).toHaveBeenCalledTimes(1)
  })

  it('só a troca pelo ponteiro anima a fita e a folha; pelo teclado (setas) troca na hora', () => {
    render()
    const marcadores = container.querySelector<HTMLElement>('.gr-lombada__marcadores')
    act(() => {
      aba('Cena')?.dispatchEvent(new Event('pointerdown', { bubbles: true }))
      aba('Cena')?.click()
    })
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'cena', trocaAnimada: true })
    act(() => aba('Cena')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })))
    expect(useLivroDoMestreStore.getState()).toMatchObject({ pagina: 'aventura', trocaAnimada: false })
    expect(marcadores).not.toBeNull()
  })

  it('o espaço que o livro ocupa da borda é a margem mais a lombada e a página (a barra de ferramentas começa depois dele)', () => {
    expect(parseFloat(theme.layout.livroDoMestre)).toBe(12 + parseFloat(theme.gr.larguraLombada) + parseFloat(theme.gr.larguraPagina))
  })
})
