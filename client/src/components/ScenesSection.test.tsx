import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { ScenePeople } from '../lib/party'
import type { SceneListItem } from '../stores/adventureStore'
import { ScenesSection } from './ScenesSection'

const CENAS: SceneListItem[] = [
  { id: 's-a', name: 'Salao', active: true, available: true, renamable: true, tokenCount: 2 },
  { id: 's-b', name: 'Cripta', active: false, available: true, renamable: false, tokenCount: 0 },
]

const nada = () => undefined

function html(people?: ReadonlyMap<string, ScenePeople>): string {
  return renderToStaticMarkup(<ScenesSection scenes={CENAS} onSelect={nada} onCreate={nada} onRename={nada} people={people} />)
}

/** O pedaço do HTML de um item da lista, do `<li>` da cena até o próximo. */
function item(markup: string, nome: string): string {
  const inicio = markup.indexOf(`>${nome}</button>`)
  const fim = markup.indexOf('</li>', inicio)
  return markup.slice(inicio, fim)
}

describe('ScenesSection: quem está em cada cena', () => {
  it('bolinha com nome no rótulo e no título, na cor da ficha, e o selo só na cena de quem pediu', () => {
    const people = new Map<string, ScenePeople>([['s-a', { people: [{ playerId: 'ana', name: 'Ana', color: '#3cff00' }], pendingRequests: 1 }]])
    const markup = html(people)
    const salao = item(markup, 'Salao')
    expect(salao).toContain('aria-label="Ana"')
    expect(salao).toContain('title="Ana"')
    expect(salao).toContain('background:#3cff00')
    expect(salao).toContain('1 pedido')
    expect(item(markup, 'Cripta')).not.toContain('pedido')
  })

  it('sem sala (sem `people`), a linha fica só com o nome e a contagem', () => {
    expect(html()).not.toContain('lb-cenas__gente')
    expect(html(new Map())).not.toContain('lb-cenas__gente')
  })
})
