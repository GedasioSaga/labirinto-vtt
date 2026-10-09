import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { novoPersonagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { PersonagensSection, resumoDaImportacao, type PersonagensSectionProps } from './PersonagensSection'
import { SistemasDialog } from './SistemasDialog'

/**
 * "Personagens" na aba Jogo e a grade de sistemas que "Sistema de RPG" (na
 * janela Configurações do mapa) abre.
 */

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

function botao(raiz: ParentNode, nome: string): HTMLButtonElement {
  const achado = Array.from(raiz.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => candidato.textContent?.trim() === nome || candidato.getAttribute('aria-label') === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

describe('PersonagensSection', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function montar(props: Partial<PersonagensSectionProps> = {}) {
    const chamadas = { onAbrirFicha: vi.fn(), onCriar: vi.fn(), onApagar: vi.fn() }
    act(() =>
      root.render(
        <PersonagensSection
          sistema={SISTEMA_ONE_PIECE}
          sistemaId="one-piece"
          personagens={[novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira'), { ...novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Smoker'), id: 'p-smoker' }]}
          onImportar={async () => null}
          {...chamadas}
          {...props}
        />,
      ),
    )
    // A seção nasce fechada (como a Agenda): abre para ver a lista.
    const titulo = Array.from(container.querySelectorAll('button')).find((candidato) => candidato.textContent?.startsWith('Personagens'))
    act(() => titulo?.click())
    return chamadas
  }

  it('a lista com selo, sem o botão do sistema (mora em Configurações do mapa); tocar abre a ficha', () => {
    const { onAbrirFicha } = montar()
    expect(container.textContent).not.toContain('Sistema de RPG')
    expect(Array.from(container.querySelectorAll('.lb-rpg__abrir')).map((linha) => linha.textContent)).toEqual(['AAiraJogador', 'SSmokerNPC'])
    act(() => container.querySelectorAll<HTMLButtonElement>('.lb-rpg__abrir')[1].click())
    expect(onAbrirFicha).toHaveBeenCalledWith('p-smoker')
  })

  it('apagar pede confirmação na própria linha', () => {
    const { onApagar } = montar()
    act(() => botao(container, 'Apagar Smoker').click())
    expect(onApagar).not.toHaveBeenCalled()
    act(() => botao(container, 'Manter').click())
    act(() => botao(container, 'Apagar Smoker').click())
    act(() => botao(container, 'Apagar').click())
    expect(onApagar).toHaveBeenCalledWith('p-smoker')
  })

  it('sem sistema: diz o que falta e não deixa criar nem importar', () => {
    montar({ sistema: undefined, sistemaId: undefined, personagens: [] })
    expect(container.textContent).toContain('Nenhum personagem ainda.')
    expect(botao(container, '+ Personagem').disabled).toBe(true)
    expect(botao(container, 'Importar personagens…').disabled).toBe(true)
    expect(container.textContent).toContain('Escolha o sistema de RPG em Configurações do mapa')
  })

  it('sistema gravado que não está neste computador: diz qual e onde importar', () => {
    montar({ sistema: undefined, sistemaId: 'casa', personagens: [] })
    expect(container.textContent).toContain('O sistema casa não está neste computador: importe-o em Configurações do mapa')
  })

  it('importar mostra quantos entraram, com os nomes, e os avisos', async () => {
    const aira = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira')
    montar({ onImportar: async () => ({ personagens: [aira], npcsIgnorados: 6, avisos: ['Kian: a imagem não entrou.'] }) })
    await act(async () => botao(container, 'Importar personagens…').click())
    const estado = container.querySelector('.lb-rpg__estado')
    expect(estado?.getAttribute('role')).toBe('status')
    expect(estado?.textContent).toContain('1 personagem entrou: Aira. 6 NPCs ficaram de fora.')
    expect(estado?.textContent).toContain('Kian: a imagem não entrou.')
  })

  it('importação que falha vira alerta com a razão', async () => {
    montar({ onImportar: async () => Promise.reject(new Error('o arquivo não é JSON válido')) })
    await act(async () => botao(container, 'Importar personagens…').click())
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('o arquivo não é JSON válido')
  })

  it('resumoDaImportacao: plural, singular e nada', () => {
    const p = (nome: string) => novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome)
    expect(resumoDaImportacao({ personagens: [p('Aira'), p('Vagn')], npcsIgnorados: 0, avisos: [] })).toBe('2 personagens entraram: Aira, Vagn.')
    expect(resumoDaImportacao({ personagens: [], npcsIgnorados: 1, avisos: [] })).toBe('Nenhum personagem entrou. 1 NPC ficou de fora.')
  })
})

/** "Importar arquivo…" do "+" da grade: o "+" abre as três saídas (em branco, cópia, arquivo) e esta importa. */
function importarPeloMais(): HTMLButtonElement {
  const mais = document.body.querySelector<HTMLButtonElement>('.lb-sistema--mais')
  if (mais === null) throw new Error('o "+" da grade deveria existir')
  act(() => mais.click())
  const importar = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.lb-sistema-novo button')).find((botao) => botao.textContent === 'Importar arquivo…')
  if (importar === undefined) throw new Error('o "+" aberto deveria oferecer "Importar arquivo…"')
  return importar
}

/** As ações dos cartões (entrega 6), que estes testes não usam: `SistemasDialog.test.tsx` as cobre. */
const SEM_ACOES = { onEditar: vi.fn(), onDuplicar: vi.fn(), onExportar: vi.fn(), onApagar: vi.fn(), ehEmbutido: (id: string) => id === 'one-piece' }

describe('SistemasDialog', () => {
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

  it('um cartão por sistema e o "+"; tocar escolhe para a aventura e fecha', () => {
    const onEscolher = vi.fn()
    const onClose = vi.fn()
    act(() => root.render(<SistemasDialog sistemas={[SISTEMA_ONE_PIECE]} escolhidoId={undefined} avisos={[]} onEscolher={onEscolher} onImportar={async () => null} onClose={onClose} {...SEM_ACOES} />))
    const cartoes = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.lb-sistema'))
    expect(cartoes.map((cartao) => cartao.querySelector('.lb-sistema__nome')?.textContent)).toEqual(['One Piece', 'Novo sistema…'])
    expect(cartoes[0].getAttribute('aria-pressed')).toBe('false')
    act(() => cartoes[0].click())
    expect(onEscolher).toHaveBeenCalledWith('one-piece')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('o sistema em uso vem marcado; o "+" diz o que entrou, ou a razão de não entrar', async () => {
    const importado = { ...SISTEMA_ONE_PIECE, id: 'casa', nome: 'Sistema da Casa' }
    const onImportar = vi.fn<() => Promise<typeof importado | null>>().mockResolvedValueOnce(importado).mockRejectedValueOnce(new Error('Esse arquivo não é um sistema de RPG: o sistema não tem nome.'))
    act(() => root.render(<SistemasDialog sistemas={[SISTEMA_ONE_PIECE]} escolhidoId="one-piece" avisos={['quebrado.json: JSON inválido.']} onEscolher={vi.fn()} onImportar={onImportar} onClose={vi.fn()} {...SEM_ACOES} />))
    expect(document.body.querySelector('.lb-sistema[aria-pressed="true"] .lb-sistema__uso')?.textContent).toBe('Em uso')
    expect(document.body.textContent).toContain('quebrado.json: JSON inválido.')
    const importar = importarPeloMais()
    await act(async () => importar.click())
    expect(document.body.querySelector('[role="status"]')?.textContent).toContain('Sistema da Casa entrou na biblioteca')
    const importarDeNovo = importarPeloMais()
    await act(async () => importarDeNovo.click())
    expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('o sistema não tem nome')
  })
})
