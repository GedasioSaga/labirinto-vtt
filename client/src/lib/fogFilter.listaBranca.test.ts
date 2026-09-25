/**
 * FICHA POR LISTA BRANCA, lado do RECORTE. A ficha sai para o jogador numa
 * cópia montada campo a campo (`tokenForPlayer`), como o pino: campo que o
 * mapa trouxer e o recorte não conhece — versão futura do app, arquivo editado
 * à mão, a agenda ou a ronda do NPC que ainda vão existir — fica na máquina do
 * mestre por padrão, em vez de vazar por padrão.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Token } from '../types/map'
import { filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 700
const SEGREDO = 'o capataz trai o grupo na ponte'
const FOTO = 'data:image/png;base64,iVBORw0KGgo='

/**
 * Tudo o que a ficha PODE levar até a tela do jogador; qualquer outra chave é
 * vazamento. `contrato` só vai na ficha EMPRESTADA a quem a segura — neste
 * recorte não há empréstimo, então ele não pode aparecer (ver o teste dele).
 */
const CAMPOS_DO_JOGADOR = new Set(['id', 'characterId', 'name', 'x', 'y', 'size', 'image', 'imageData', 'rotation', 'color', 'conditions', 'health', 'alerta', 'secret', 'mochila'])

function ficha(id: string, name: string, x: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x, y: 100, size: 1, image: null, ...extra }
}

/** Ficha com um campo que o tipo não conhece — como chega de um arquivo mais novo ou editado à mão. */
function comSegredo(token: Token): Token {
  return Object.assign(token, { segredoDoMestre: SEGREDO })
}

function mapaCom(tokens: Token[]): MapData {
  return { ...createEmptyMap('m', 'Porto', 30, 10, 50), tokens }
}

/** Duda é dona de "arco"; o NPC está a 200 px dela, dentro da visão. */
const posse = { duda: ['arco'] }

function tokensDaDuda(tokens: Token[]): Token[] {
  return filterMapForPlayer(mapaCom(tokens), 'duda', posse, RAIO).map.tokens
}

function recebida(tokens: Token[], id: string): Token {
  const achada = tokensDaDuda(tokens).find((t) => t.id === id)
  if (achada === undefined) throw new Error(`a ficha ${id} não chegou ao recorte`)
  return achada
}

describe('recorte: a ficha sai por lista branca', () => {
  it('o campo segredoDoMestre da ficha de OUTRO não chega ao jogador', () => {
    const tokens = [ficha('arco', 'Arco', 100), comSegredo(ficha('npc', 'Capataz', 300))]
    const recebidas = tokensDaDuda(tokens)
    expect(recebidas.map((t) => t.id).sort()).toEqual(['arco', 'npc'])
    expect(recebidas.every((t) => !('segredoDoMestre' in t))).toBe(true)
    expect(JSON.stringify(recebidas)).not.toContain(SEGREDO)
  })

  it('o campo segredoDoMestre da PRÓPRIA ficha também não chega ao dono', () => {
    const recebidas = tokensDaDuda([comSegredo(ficha('arco', 'Arco', 100))])
    expect(recebidas.map((t) => t.id)).toEqual(['arco'])
    expect('segredoDoMestre' in recebidas[0]).toBe(false)
    expect(JSON.stringify(recebidas)).not.toContain(SEGREDO)
  })

  it('nenhuma ficha do recorte leva chave fora da lista do jogador', () => {
    const cheia = comSegredo(
      ficha('npc', 'Capataz', 300, {
        locked: true,
        npc: true,
        publicName: 'Estivador',
        vigia: { direcao: 0, abertura: 90, alcance: 3 },
        mochila: [{ id: 'chave', nome: 'Chave da ponte' }],
        rotation: 90,
        color: '#35b24a',
        patrulha: { pontos: [{ x: 300, y: 100 }, { x: 900, y: 100 }], atual: 0 },
        rotina: { estadoId: 'apito', postos: [{ valor: 'Brasa', sceneId: 'cena-ponte', x: 40, y: 40 }] },
        levadoPor: 'arco',
        playerCharacter: true,
        contrato: { tarefa: 'vigiar a ponte', ate: null, visao: true },
        hidden: false,
      }),
    )
    const recebidas = tokensDaDuda([comSegredo(ficha('arco', 'Arco', 100, { locked: true, npc: true, playerCharacter: true })), cheia])
    const chaves = recebidas.flatMap((t) => Object.keys(t))
    expect(chaves.length).toBeGreaterThan(0)
    expect(chaves.filter((k) => !CAMPOS_DO_JOGADOR.has(k))).toEqual([])
  })

  it('a trava de edição e o vínculo de personagem do mestre ficam com ele', () => {
    const npc = recebida([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz', 300, { locked: true, characterId: 'personagem-capataz' })], 'npc')
    expect('locked' in npc).toBe(false)
    expect(npc.characterId).toBeNull()
  })

  it('cor que não é #rrggbb não viaja; a válida viaja como o mestre gravou', () => {
    const tokens = [ficha('arco', 'Arco', 100, { color: '#35B24A' }), ficha('npc', 'Capataz', 300, { color: `vermelho ${SEGREDO}` })]
    expect(recebida(tokens, 'arco').color).toBe('#35B24A')
    const npc = recebida(tokens, 'npc')
    expect('color' in npc).toBe(false)
    expect(JSON.stringify(npc)).not.toContain(SEGREDO)
  })

  it('a mochila do dono chega item a item só com id e nome', () => {
    const item = Object.assign({ id: 'chave', nome: 'Chave da ponte' }, { notaDoMestre: SEGREDO })
    const arco = recebida([ficha('arco', 'Arco', 100, { mochila: [item] })], 'arco')
    expect(arco.mochila).toEqual([{ id: 'chave', nome: 'Chave da ponte' }])
    expect(JSON.stringify(arco)).not.toContain(SEGREDO)
  })

  it('o que a tela do jogador desenha continua chegando na própria ficha', () => {
    const arco = recebida(
      [
        ficha('arco', 'Arco', 100, {
          rotation: 0,
          color: '#35b24a',
          imageData: FOTO,
          image: 'C:/mestre/fotos/arco.png',
          conditions: ['envenenado'],
          health: { current: 5, max: 10, shownToPlayers: true },
          secret: true,
          mochila: [{ id: 'chave', nome: 'Chave da ponte' }],
        }),
      ],
      'arco',
    )
    expect(arco).toEqual({
      id: 'arco',
      characterId: null,
      name: 'Arco',
      x: 100,
      y: 100,
      size: 1,
      image: null,
      imageData: FOTO,
      rotation: 0,
      color: '#35b24a',
      conditions: ['envenenado'],
      health: { current: 50, max: 100, shownToPlayers: true },
      secret: true,
      mochila: [{ id: 'chave', nome: 'Chave da ponte' }],
    })
  })

  it('ficha mínima (sem nenhum campo opcional) chega só com o essencial', () => {
    const tokens = [ficha('arco', 'Arco', 100), ficha('npc', 'Capataz', 300)]
    expect(recebida(tokens, 'arco')).toEqual({ id: 'arco', characterId: null, name: 'Arco', x: 100, y: 100, size: 1, image: null })
    expect(recebida(tokens, 'npc')).toEqual({ id: 'npc', characterId: null, name: 'Capataz', x: 300, y: 100, size: 1, image: null })
  })

  it('a ficha EMPRESTADA leva o acordo da sessão e o nome público; o resto do mestre fica', () => {
    const npc = comSegredo(
      ficha('npc', 'Capataz traidor', 300, {
        publicName: 'Estivador',
        rotina: { estadoId: 'apito', postos: [{ valor: 'Brasa', sceneId: 'cena-ponte', x: 40, y: 40 }] },
        patrulha: { pontos: [{ x: 300, y: 100 }], atual: 0 },
        contrato: { tarefa: SEGREDO, ate: null, visao: true },
      }),
    )
    const acordo = { tarefa: 'levar o recado', ate: null, visao: false }
    const loans = new Map([['npc', acordo]])
    const tokens = filterMapForPlayer(mapaCom([ficha('arco', 'Arco', 100), npc]), 'duda', { duda: ['arco', 'npc'] }, RAIO, undefined, undefined, undefined, undefined, loans).map.tokens
    const recebidaNpc = tokens.find((t) => t.id === 'npc')
    expect(recebidaNpc).toEqual({ id: 'npc', characterId: null, name: 'Estivador', x: 300, y: 100, size: 1, image: null, contrato: acordo })
    expect(JSON.stringify(tokens)).not.toContain(SEGREDO)
  })

  it('o contrato gravado no mapa do mestre não sai sem empréstimo na sessão', () => {
    const npc = recebida([ficha('arco', 'Arco', 100), ficha('npc', 'Capataz', 300, { contrato: { tarefa: SEGREDO, ate: null, visao: true } })], 'npc')
    expect('contrato' in npc).toBe(false)
    expect(npc.name).toBe('Capataz')
  })

  it('o mapa do mestre não é tocado pelo recorte', () => {
    const npc = comSegredo(ficha('npc', 'Capataz', 300, { locked: true }))
    const mapa = mapaCom([ficha('arco', 'Arco', 100), npc])
    filterMapForPlayer(mapa, 'duda', posse, RAIO)
    expect(mapa.tokens[1]).toBe(npc)
    expect(Object.keys(npc)).toContain('segredoDoMestre')
  })
})
