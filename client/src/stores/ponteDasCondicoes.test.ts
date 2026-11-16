/**
 * A PONTE DAS CONDIÇÕES LIGADA ÀS STORES DA MESA (Fase 3): a batalha One Piece
 * e a Dragon Ball de verdade mudam, e a pastilha do token no mapa aberto
 * acende e apaga sozinha, fora do Ctrl+Z do mestre. Dados inventados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SeloDaBatalha } from '../lib/batalha/combate'
import type { CondicaoPropria, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { chavesDaFichaNaBatalha, ligarPonteDasCondicoes } = await import('./ponteDasCondicoes')
const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useBatalhaStore } = await import('./batalhaStore')
const { useBatalhaDBTStore } = await import('./batalhaDBTStore')
const { useCondicoesPropriasStore } = await import('./condicoesPropriasStore')
const { createEmptyMap } = await import('../lib/mapFactory')

/** A chave da cena: mapa solto, então o id do mapa (a mesma regra do `App.tsx`). */
const CENA = 'vale'
const QUEIMANDO: CondicaoPropria = { id: 'cond_queimando', nome: 'Queimando', cor: '#ff7043', simbolo: 'chama' }

function ficha(id: string): Token {
  return { id, characterId: null, name: id, x: 96, y: 96, size: 1, image: null }
}

function fichaNoMapa(id: string): Token {
  const achada = useMapStore.getState().map.tokens.find((token) => token.id === id)
  if (achada === undefined) throw new Error(`ficha ${id} sumiu do mapa`)
  return achada
}

function selo(id: string, tokenId: string, nome: string): SeloDaBatalha {
  return { id, tokenId, nome, turnos: 2, total: 2 }
}

/** Troca os selos da cena One Piece como o golpe, o "Pôr selo…" e o fim da vez trocam (o estado que a ponte olha). */
function comSelos(selos: SeloDaBatalha[]): void {
  useBatalhaStore.setState((state) => {
    const cena = state.cenas[CENA]
    return { cenas: { ...state.cenas, [CENA]: { ...cena, turnos: { ...cena.turnos, selos } } } }
  })
}

let desligarAPonte: () => void = () => undefined

beforeEach(() => {
  useAdventureStore.getState().reset()
  useBatalhaStore.getState().reset()
  useBatalhaDBTStore.getState().reset()
  useCondicoesPropriasStore.setState({ catalogo: [QUEIMANDO] })
  useMapStore.getState().loadMap({ ...createEmptyMap(CENA, 'Vale', 30, 20, 64), tokens: [ficha('ilo'), ficha('lia')] })
  desligarAPonte = ligarPonteDasCondicoes()
})

afterEach(() => desligarAPonte())

describe('a ponte ligada à batalha da mesa', () => {
  it('One Piece: o selo acende a pastilha, a criada "Queimando" também, o Ctrl+Z do mestre não a desfaz e o fim da batalha apaga', () => {
    useBatalhaStore.getState().ligar(CENA)
    expect(useBatalhaStore.getState().ligada(CENA)).toBe(true)
    // Um passo do mestre no mapa, para o Ctrl+Z ter o que desfazer.
    useMapStore.getState().renameToken('lia', 'Lia')
    comSelos([selo('selo_1', 'ilo', 'Atordoado'), selo('selo_2', 'lia', 'Queimando')])
    expect(fichaNoMapa('ilo').conditions).toEqual(['atordoado'])
    expect(fichaNoMapa('lia').condicoesProprias).toEqual([QUEIMANDO])
    expect(chavesDaFichaNaBatalha(CENA, 'ilo')).toEqual(new Set(['atordoado']))

    useMapStore.getState().undo()
    expect(fichaNoMapa('lia').name).toBe('lia')
    expect(fichaNoMapa('lia').condicoesProprias).toEqual([QUEIMANDO])

    comSelos([selo('selo_2', 'lia', 'Queimando')])
    expect(fichaNoMapa('ilo').conditions).toBeUndefined()
    useBatalhaStore.getState().desligar(CENA)
    expect(fichaNoMapa('lia').condicoesProprias).toBeUndefined()
  })

  it('a batalha salva que volta do disco com selos abre como estava: nada acende e o mapa não muda', () => {
    // A batalha de antes da ponte: selo posto com ela desligada, guardada e fechada.
    desligarAPonte()
    useBatalhaStore.getState().ligar(CENA)
    comSelos([selo('selo_1', 'ilo', 'Atordoado')])
    const salva = useBatalhaStore.getState().cenas[CENA]
    useBatalhaStore.getState().reset()
    const mapaAntes = useMapStore.getState().map

    desligarAPonte = ligarPonteDasCondicoes()
    expect(useBatalhaStore.getState().retomar(CENA, salva)).toBe(true)
    expect(useMapStore.getState().map).toBe(mapaAntes)
    // O selo que já existia sai: a pastilha que nunca acendeu continua apagada, e o mapa é o mesmo.
    comSelos([])
    expect(useMapStore.getState().map).toBe(mapaAntes)
  })

  it('Dragon Ball: o "Pôr condição" do mestre acende o Envenenado e o "Tirar" apaga, pelo comando de verdade', () => {
    useBatalhaDBTStore.getState().ligar(CENA, {}, { entrantes: [{ tokenId: 'ilo', personagemId: null, nome: 'Ilo', lado: 'pj', npc: false }] })
    const pos = useBatalhaDBTStore.getState().comando(CENA, { tipo: 'mestre' }, { tipo: 'mestre', acao: { tipo: 'porCondicao', combatenteId: 'ilo', condicao: 'envenenado' } })
    expect(pos.ok).toBe(true)
    expect(fichaNoMapa('ilo').conditions).toEqual(['envenenado'])
    const ativa = useBatalhaDBTStore.getState().cenas[CENA].combatentes.ilo.condicoes[0]
    const tira = useBatalhaDBTStore.getState().comando(CENA, { tipo: 'mestre' }, { tipo: 'mestre', acao: { tipo: 'tirarCondicao', combatenteId: 'ilo', condicaoId: ativa.id } })
    expect(tira.ok).toBe(true)
    expect(fichaNoMapa('ilo').conditions).toBeUndefined()
    expect(fichaNoMapa('lia')).toEqual(ficha('lia'))
  })
})
