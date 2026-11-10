import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyMap } from '../../lib/mapFactory'
import { EMPTY_SELECTION, selectionOfItem } from '../../lib/selectionModel'
import { novoPersonagem, type Personagem } from '../../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import { lerQuemPodeEntrar } from './fichasDeQuemEntra'

/**
 * Segunda auditoria da batalha (09/11/2026, achado 1): só o token de um
 * JOGADOR selecionado no mapa (o estado normal depois de o mestre mover uma
 * ficha) abria a lista com todo NPC desmarcado: Shift+B e Enter iniciavam a
 * batalha sem inimigo. A seleção só pré-filtra quando tem pelo menos um NPC.
 * Dados inventados; no máximo 2 testes.
 */

function fichaDeTeste(tipo: Personagem['tipo'], nome: string): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, tipo, nome)
  return { ...base, recursos: { ...base.recursos, hp: 300, sp: 60, escudo: 0 }, maximos: { hp: 300, sp: 60 } }
}

const TODOS = ['tok_capita', 'tok_urso_1', 'tok_urso_2']

/** Quem a lista abre marcado: sem `marcadosDePartida`, todos com ficha de combate. */
function marcadosAoAbrir(): string[] {
  const lista = lerQuemPodeEntrar()
  const marcados = lista.marcadosDePartida
  return lista.candidatos.filter((candidato) => (marcados === undefined ? candidato.situacao === 'combate' : marcados.has(candidato.tokenId))).map((candidato) => candidato.tokenId)
}

beforeEach(() => {
  const aventura = useAdventureStore.getState()
  aventura.virarAventura(null)
  aventura.setSistemaDeRpg('one-piece')
  const capita = fichaDeTeste('jogador', 'Capitã de Teste')
  const ursos = [fichaDeTeste('npc', 'Urso de Teste'), fichaDeTeste('npc', 'Urso de Teste')]
  if (!useAdventureStore.getState().adicionarPersonagens([capita, ...ursos])) throw new Error('a aventura de teste não guardou as fichas')
  const mapa = useMapStore.getState()
  mapa.loadMap(createEmptyMap('mapa-de-teste', 'Clareira de Teste', 20, 20, 50))
  mapa.addToken({ id: 'tok_capita', characterId: capita.id, name: 'Capitã de Teste', x: 100, y: 100, size: 1, image: null })
  mapa.addToken({ id: 'tok_urso_1', characterId: ursos[0]?.id ?? null, name: 'Urso de Teste', x: 200, y: 100, size: 1, image: null, npc: true })
  mapa.addToken({ id: 'tok_urso_2', characterId: ursos[1]?.id ?? null, name: 'Urso de Teste', x: 300, y: 100, size: 1, image: null, npc: true })
  mapa.setSelection(EMPTY_SELECTION)
})

describe('lerQuemPodeEntrar: a seleção do mapa na lista do Iniciar', () => {
  it('só a ficha de um jogador selecionada no mapa: a lista abre com TODOS marcados, sem o aviso da seleção', () => {
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: 'tok_capita' }))
    expect(marcadosAoAbrir()).toEqual(TODOS)
    expect(lerQuemPodeEntrar().avisoDaSelecao).toBeNull()
  })

  it('um Urso selecionado no mapa: vêm marcados o Urso e os jogadores, e a lista avisa que a seleção filtrou', () => {
    useMapStore.getState().setSelection(selectionOfItem({ kind: 'token', id: 'tok_urso_2' }))
    expect(marcadosAoAbrir()).toEqual(['tok_capita', 'tok_urso_2'])
    expect(lerQuemPodeEntrar().avisoDaSelecao).toBe('Só as fichas selecionadas no mapa vieram marcadas, com os jogadores.')
  })
})
