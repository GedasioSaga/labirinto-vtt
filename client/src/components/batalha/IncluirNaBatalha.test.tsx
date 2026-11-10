import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { motivoDoTetoDeDano } from '../../lib/batalha/mecanicasAMao'
import { combatentesIniciais } from '../../lib/batalha/turnos'
import { createEmptyMap } from '../../lib/mapFactory'
import { novoPersonagem, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { personagensAtivos, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { IncluirNaBatalha } from './IncluirNaBatalha'

/**
 * Segunda auditoria da batalha (09/11/2026, achado 5): o aviso "N fichas fora
 * da ordem" contava o token de jogador sem ficha, que a lista do Incluir não
 * mostra (5 no aviso, 4 na lista); a lista trocava a ferramenta para
 * Selecionar e não devolvia; e a recusa de uma cura com alvos demais dizia
 * "dá dano em no máximo N inimigos". Dados inventados; no máximo 2 testes.
 */

const CENA = 'cena_do_incluir'

function fichaDeTeste(tipo: Personagem['tipo'], nome: string): Personagem {
  const base = novoPersonagem(SISTEMA_ONE_PIECE, tipo, nome)
  return { ...base, recursos: { ...base.recursos, hp: 300, sp: 60, escudo: 0 }, maximos: { hp: 300, sp: 60 } }
}

const CURA_DE_TESTE: CartaoDaFicha = {
  id: 'cart_cura_do_incluir',
  nome: 'Cura de Teste',
  campos: {},
  extras: [],
  atributos: [],
  imagem: null,
  modificadores: [],
  subcartoes: [],
  mecanica: { versao: 1, acao: 'simples', alvo: { quem: 'aliados', forma: { tipo: 'varios', max: 2 } }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 50 }, emQuem: 'alvo' }] },
}

let container: HTMLDivElement
let root: Root

const texto = (): string => container.querySelector('.bt-texto')?.textContent ?? ''
const linhasDaLista = (): number => container.querySelectorAll('.gr-entra').length

function botao(comeco: string): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => (candidato.textContent ?? '').startsWith(comeco))
  if (achado === undefined) throw new Error(`sem o botão "${comeco}"`)
  return achado
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useBatalhaStore.getState().reset()
  const aventura = useAdventureStore.getState()
  aventura.virarAventura(null)
  aventura.setSistemaDeRpg('one-piece')
  const capita = fichaDeTeste('jogador', 'Capitã de Teste')
  const ursos = [fichaDeTeste('npc', 'Urso de Teste'), fichaDeTeste('npc', 'Urso de Teste')]
  if (!useAdventureStore.getState().adicionarPersonagens([capita, ...ursos])) throw new Error('a aventura de teste não guardou as fichas')
  const mapa = useMapStore.getState()
  mapa.loadMap(createEmptyMap('mapa-do-incluir', 'Clareira de Teste', 20, 20, 50))
  mapa.addToken({ id: 'tok_capita', characterId: capita.id, name: 'Capitã de Teste', x: 100, y: 100, size: 1, image: null })
  mapa.addToken({ id: 'tok_urso_1', characterId: ursos[0]?.id ?? null, name: 'Urso de Teste', x: 200, y: 100, size: 1, image: null, npc: true })
  mapa.addToken({ id: 'tok_urso_2', characterId: ursos[1]?.id ?? null, name: 'Urso de Teste', x: 300, y: 100, size: 1, image: null, npc: true })
  mapa.addToken({ id: 'tok_bicho', characterId: null, name: 'Bicho sem Ficha', x: 400, y: 100, size: 1, image: null, npc: true })
  mapa.addToken({ id: 'tok_avulso', characterId: null, name: 'Jogador sem Ficha', x: 500, y: 100, size: 1, image: null })
  // Só a Capitã e o primeiro Urso começam na ordem: ficam de fora o outro Urso, o Bicho e o token de jogador sem ficha.
  const combatentes = combatentesIniciais(useMapStore.getState().map.tokens, personagensAtivos(useAdventureStore.getState()), SISTEMA_ONE_PIECE, new Set(['tok_capita', 'tok_urso_1']))
  useBatalhaStore.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('o "Incluir na batalha" e os avisos da segunda auditoria', () => {
  it('o aviso diz na própria linha por que a lista mostra menos fichas; a lista devolve a ferramenta que o mestre usava ao fechar', () => {
    useMapStore.getState().setActiveTool('wall')
    act(() => root.render(<IncluirNaBatalha sceneKey={CENA} />))
    expect(texto()).toBe('3 fichas da cena estão fora da ordem. A lista mostra 2: 1 token de jogador sem ficha fica de fora.')
    act(() => botao('Incluir na batalha').click())
    expect(linhasDaLista()).toBe(2)
    expect(useMapStore.getState().activeTool).toBe('select')
    act(() => botao('Cancelar').click())
    expect(useMapStore.getState().activeTool).toBe('wall')
  })

  it('a cura com alvos demais não diz "dá dano em inimigos": diz em quantos alvos ela vale', () => {
    expect(motivoDoTetoDeDano(CURA_DE_TESTE, 'Cura de Teste', ['pers_a', 'pers_b', 'pers_c'], new Set())).toBe('Cura de Teste vale em no máximo 2 alvos')
  })
})
