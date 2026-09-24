/// <reference types="vite/client" />
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mainSource from './main.tsx?raw'
import type { MarcaNoLugar } from '../types/map'
import { bilheteAberto, PlayerMarkCard, type PlayerMarkCardProps } from './PlayerMarkCard'

/**
 * BILHETE NO LUGAR, a leitura: o bilhete que o jogador tocou no mapa
 * (`PlayerView.bilhete.test.tsx` prova o toque) abre o cartão "Bilhete deixado
 * aqui" com o recado. Um cartão de cada vez: com recado do mestre ou texto de
 * Sala na tela, o bilhete espera. O mestre apagou com o cartão aberto: some.
 */

const BILHETE: MarcaNoLugar = { id: 'b-escada', tipo: 'bilhete', x: 300, y: 300, texto: 'Fui pela escada' }
const OUTRO: MarcaNoLugar = { id: 'b-poco', tipo: 'bilhete', x: 600, y: 300, texto: '<b>não</b> desça no poço' }
const SETA: MarcaNoLugar = { id: 's-leste', tipo: 'seta', x: 700, y: 300, rumo: 'l' }

describe('bilheteAberto', () => {
  it('acha o bilhete pelo id; a seta, o id que sumiu, a lista ausente e o "nenhum" dão null', () => {
    expect(bilheteAberto([SETA, BILHETE], BILHETE.id)).toBe(BILHETE)
    expect(bilheteAberto([SETA, BILHETE], SETA.id)).toBeNull()
    expect(bilheteAberto([SETA], BILHETE.id)).toBeNull()
    expect(bilheteAberto(undefined, BILHETE.id)).toBeNull()
    expect(bilheteAberto([BILHETE], null)).toBeNull()
  })
})

describe('PlayerMarkCard', () => {
  let container: HTMLDivElement
  let root: Root
  let onClose: ReturnType<typeof vi.fn<() => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onClose = vi.fn<() => void>()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(props: Partial<PlayerMarkCardProps> = {}): void {
    act(() =>
      root.render(<PlayerMarkCard marcas={[SETA, BILHETE, OUTRO]} openMarkId={BILHETE.id} aguardando={false} onClose={onClose} escapeCloses {...props} />),
    )
  }

  function titulo(): string | null {
    return container.querySelector('h2')?.textContent ?? null
  }

  function recado(): string | null {
    return container.querySelector('.pp-note__text')?.textContent ?? null
  }

  it('o bilhete tocado aparece com o título "Bilhete deixado aqui" e o recado inteiro', () => {
    render()
    expect(titulo()).toBe('Bilhete deixado aqui')
    expect(recado()).toBe('Fui pela escada')
  })

  it('o recado vai como texto: HTML de outro jogador aparece literal, sem virar marcação', () => {
    render({ openMarkId: OUTRO.id })
    expect(recado()).toBe('<b>não</b> desça no poço')
    expect(container.querySelector('.pp-note__text b')).toBeNull()
  })

  it('com recado do mestre ou texto de Sala na tela, o bilhete espera; ao fecharem, aparece', () => {
    render({ aguardando: true })
    expect(container.querySelector('.pp-note')).toBeNull()
    render({ aguardando: false })
    expect(recado()).toBe('Fui pela escada')
  })

  it('o mestre apagou com o cartão aberto: o cartão some junto', () => {
    render()
    expect(recado()).toBe('Fui pela escada')
    render({ marcas: [SETA, OUTRO] })
    expect(container.querySelector('.pp-note')).toBeNull()
  })

  it('nada tocado, seta tocada ou mapa sem o campo de marcas: nenhum cartão', () => {
    render({ openMarkId: null })
    expect(container.querySelector('.pp-note')).toBeNull()
    render({ openMarkId: SETA.id })
    expect(container.querySelector('.pp-note')).toBeNull()
    render({ marcas: undefined })
    expect(container.querySelector('.pp-note')).toBeNull()
  })

  it('"Fechar" e Escape fecham; com outro cartão dono do Escape, só o botão', () => {
    render()
    const fechar = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Fechar')
    expect(fechar).toBeDefined()
    act(() => fechar?.click())
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(2)

    render({ escapeCloses: false })
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('trocar de bilhete com o cartão aberto mostra o novo recado', () => {
    render()
    render({ openMarkId: OUTRO.id })
    expect(recado()).toBe('<b>não</b> desça no poço')
  })
})

/**
 * A costura na tela do jogador (`player/main.tsx`), que não se monta em teste
 * (ela chama `createRoot` ao carregar): o toque no mapa guarda o id tocado, e
 * esse id, as marcas do recorte e a espera pelos outros cartões chegam ao
 * cartão. Se alguém desligar uma ponta, a leitura some sem erro nenhum.
 */
describe('player/main.tsx liga o toque ao cartão do bilhete', () => {
  const semEspacos = mainSource.replace(/\s+/g, ' ')

  it('o toque no bilhete (onMarkOpen da PlayerView) guarda o id aberto', () => {
    expect(semEspacos).toContain('onMarkOpen={setOpenMarkId}')
    expect(semEspacos).toContain('const [openMarkId, setOpenMarkId] = useState<string | null>(null)')
  })

  it('o cartão recebe as marcas do recorte, o id aberto, a espera pelo recado e pelo texto de Sala, e o fechar', () => {
    expect(semEspacos).toContain(
      '<PlayerMarkCard marcas={state.map.marcas} openMarkId={openMarkId} aguardando={Boolean(state.note) || Boolean(state.roomText)} onClose={closeMark}',
    )
    expect(semEspacos).toContain('const closeMark = useCallback(() => setOpenMarkId(null), [])')
  })
})
