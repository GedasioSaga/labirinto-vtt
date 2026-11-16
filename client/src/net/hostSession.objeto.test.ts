import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { deserializeMap, serializeMap } from '../lib/mapFile'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { recursoDeVida, vidaDoPersonagem } from '../lib/vidaDaFicha'
import { armadilhaPadrao } from '../lib/conteudoDoObjeto'
import type { MapData, PinItem, Prop, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import { mapaComObjetoAberto } from './objetoNoHost'

/**
 * BAÚ, CAIXA E BARRIL no host (Fase C, 15/11/2026). Diego encosta no baú com
 * 2 itens e a cobra, joga e vence: os itens vão para a mochila da ficha de
 * personagem, a picada tira 8 PV, o Envenenado acende com 3 turnos x 4 PV e o
 * baú fica aberto. Nada do conteúdo chega ao jogador antes da vitória.
 */

const CODE = 'AB12CD'
const GRID = 40
const POCAO: PinItem = { nome: 'Poção de cura', itemId: 'item_pocao', categoria: 'Consumível', empilhavel: true }
const CHAVE: PinItem = { nome: 'Chave de bronze', itemId: 'item_chave', categoria: 'Chave' }

function token(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function bau(extra: Partial<Prop> = {}): Prop {
  return {
    id: 'bau-1',
    src: '',
    x: 220,
    y: 180,
    width: 40,
    height: 40,
    linkedMapPath: null,
    mobilia: 'bau',
    conteudo: { itens: [{ item: POCAO, quantidade: 2 }, { item: CHAVE, quantidade: 1 }], moedas: 35, armadilha: armadilhaPadrao('cobra') },
    ...extra,
  }
}

function brann(): Personagem {
  const lido = personagemDoArquivo({ id: 'p-diego', tipo: 'jogador', nome: 'Brann', recursos: { hp: 60 } })
  if (lido === null) throw new Error('personagem inválido')
  return lido
}

function mesa(map: MapData) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1000, randomId: () => `id-${(n += 1)}` })
  let world: HostWorld = { open: { sceneId: 'cena', name: 'Armazém', map }, background: [], rpg: { sistema: SISTEMA_ONE_PIECE, personagens: [brann()] } }
  const joined = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Diego' }, world).outbound[0]?.msg
  if (joined?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(joined.playerId, 'diego')
  const inicial = s.broadcast(world)
  return {
    s,
    inicial,
    get world() {
      return world
    },
    trocarMapa(novo: MapData) {
      world = { ...world, open: { ...world.open, map: novo } }
    },
  }
}

function mapa(diego: Token, props: Prop[] = [bau()]): MapData {
  return { ...createEmptyMap('mapa', 'Armazém', 1000, 1000, GRID), props, tokens: [diego] }
}

function msgPara(result: HostResult, clientId = 'c1') {
  return result.outbound.find((o) => o.clientId === clientId)?.msg
}

describe('hostSession: baú, caixa e barril', () => {
  it('encostado e vencendo: itens, moedas, picada e Envenenado na ficha; o baú fica aberto e o conteúdo só sai no desfecho', () => {
    const m = mesa(mapa(token('diego', 180, 200, { characterId: 'p-diego' })))
    // O recorte do jogador leva só "fechado": nem item, nem moeda, nem a cobra.
    const snapshot = JSON.stringify(m.inicial.outbound.find((o) => o.clientId === 'c1')?.msg) ?? ''
    expect(snapshot).toContain('"abrivel":"fechado"')
    expect(snapshot).not.toContain('Poção')
    expect(snapshot).not.toContain('cobra')
    expect(snapshot).not.toContain('conteudo')

    const jogo = msgPara(m.s.handleMessage('c1', { type: 'objeto.abrir', propId: 'bau-1' }, m.world))
    if (jogo?.type !== 'objeto.jogo') throw new Error(`esperava objeto.jogo, veio ${JSON.stringify(jogo)}`)
    expect(jogo.jogo).toBe('bau')
    expect(JSON.stringify(jogo)).not.toContain('Poção')

    const venceu = m.s.handleMessage('c1', { type: 'objeto.venceu', sessao: jogo.sessao, propId: 'bau-1' }, m.world)
    const desfecho = msgPara(venceu)
    if (desfecho?.type !== 'objeto.desfecho') throw new Error('esperava objeto.desfecho')
    expect(desfecho.desfecho).toEqual({
      armadilha: 'cobra',
      jumpscare: true,
      itens: [
        { nome: 'Poção de cura', quantidade: 2 },
        { nome: 'Chave de bronze', quantidade: 1 },
      ],
      moedas: 35,
      dano: 8,
      efeito: 'Envenenado',
      turnos: 3,
    })
    const aplicado = venceu.applyObjetoAberto
    if (aplicado === undefined || aplicado.personagem === null) throw new Error('esperava a ficha de personagem nova')
    const recurso = recursoDeVida(SISTEMA_ONE_PIECE)
    if (recurso === null) throw new Error('o sistema tem vida')
    expect(vidaDoPersonagem(aplicado.personagem, recurso)?.atual).toBe(52)
    expect((aplicado.personagem.mochila ?? []).map((item) => [item.nome, item.quantidade ?? 1, item.itemId])).toEqual([
      ['Poção de cura', 2, 'item_pocao'],
      ['Chave de bronze', 1, 'item_chave'],
    ])
    expect(aplicado.personagem.moedas).toBe(35)
    expect(aplicado.registro.titulo).toBe('Diego abriu o Baú')
    expect(aplicado.registro.armadilha).toBe('A cobra picou: -8 PV. Envenenado por 3 turnos.')

    // No mapa do mestre: o baú aberto (ainda baú) e a gota acesa com o prazo de 3 x 4.
    const depois = mapaComObjetoAberto(m.world.open.map, aplicado)
    expect(depois.props[0].mobilia).toBe('bau')
    expect(depois.props[0].conteudo?.aberto).toEqual({ por: 'Diego', em: 1000 })
    expect(depois.tokens[0].conditions).toContain('envenenado')
    expect(depois.tokens[0].prazosDasCondicoes).toEqual([{ nome: 'Envenenado', turnos: 3, porVez: 4 }])
    // Aberto, o próximo pedido é recusado.
    m.trocarMapa(depois)
    expect(msgPara(m.s.handleMessage('c1', { type: 'objeto.abrir', propId: 'bau-1' }, m.world))).toEqual({ type: 'objeto.recusado', propId: 'bau-1', motivo: 'aberto' })
  })

  it('longe não abre; caixa sem ficha de personagem: os itens vão à mochila do token, vira destroços e o mapa antigo abre igual', () => {
    const caixa = bau({ id: 'caixa-1', mobilia: 'caixa', conteudo: { itens: [{ item: POCAO, quantidade: 1 }], moedas: 0, armadilha: null } })
    const longe = mesa(mapa(token('diego', 420, 200), [caixa]))
    expect(msgPara(longe.s.handleMessage('c1', { type: 'objeto.abrir', propId: 'caixa-1' }, longe.world))).toEqual({ type: 'objeto.recusado', propId: 'caixa-1', motivo: 'longe' })

    const m = mesa(mapa(token('diego', 180, 200), [caixa]))
    const jogo = msgPara(m.s.handleMessage('c1', { type: 'objeto.abrir', propId: 'caixa-1' }, m.world))
    if (jogo?.type !== 'objeto.jogo') throw new Error('esperava objeto.jogo')
    // Sessão errada morre calada.
    expect(m.s.handleMessage('c1', { type: 'objeto.venceu', sessao: 'outra', propId: 'caixa-1' }, m.world).outbound).toEqual([])
    const venceu = m.s.handleMessage('c1', { type: 'objeto.venceu', sessao: jogo.sessao, propId: 'caixa-1' }, m.world)
    const aplicado = venceu.applyObjetoAberto
    if (aplicado === undefined) throw new Error('esperava applyObjetoAberto')
    expect(aplicado.personagem).toBeNull()
    const depois = mapaComObjetoAberto(m.world.open.map, aplicado)
    // A caixa vira a caixa quebrada (16/11/2026), no mesmo centro, maior (0,8 casa para 1,2), guardando o tamanho dela.
    expect(depois.props[0].mobilia).toBe('caixaQuebrada')
    expect(depois.props[0].conteudo?.aberto?.quebradoDe).toBe('caixa')
    expect(depois.props[0].conteudo?.aberto?.pegadaDeAntes).toEqual({ width: caixa.width, height: caixa.height })
    expect([depois.props[0].x, depois.props[0].y, depois.props[0].width, depois.props[0].height]).toEqual([caixa.x, caixa.y, caixa.width * 1.5, caixa.height * 1.5])
    expect(depois.tokens[0].mochila?.map((item) => item.nome)).toEqual(['Poção de cura'])
    // O disco guarda o conteúdo e a quebra; o campo de fio `abrivel` nunca entra.
    const lido = deserializeMap(serializeMap({ ...depois, props: [{ ...depois.props[0], abrivel: 'aberto' }] }))
    expect(lido.props[0].conteudo).toEqual(depois.props[0].conteudo)
    expect(lido.props[0].abrivel).toBeUndefined()
    // Mapa antigo: o barril sem conteúdo é lido sem campo novo (e, vazio, fica sem minigame: teste abaixo).
    const antigo = deserializeMap(JSON.stringify({ id: 'velho', props: [{ id: 'b', src: '', x: 0, y: 0, width: 40, height: 40, mobilia: 'barril' }] }))
    expect(antigo.props[0].conteudo).toBeUndefined()
    expect(antigo.semJumpscare).toBeUndefined()
  })

  it('minigame desligado (16/11/2026): o recorte não leva abrivel nem o conteúdo e o host recusa; o barril novo, vazio, também; ligado, abre', () => {
    const comCobra = { itens: [{ item: POCAO, quantidade: 1 }], moedas: 35, armadilha: armadilhaPadrao('cobra') }
    const novo = bau({ id: 'barril-novo', mobilia: 'barril', x: 140, y: 180, conteudo: undefined })
    const m = mesa(mapa(token('diego', 180, 200), [bau({ conteudo: { ...comCobra, minigame: false } }), novo]))
    // Os dois chegam à tela dele (ele vê o baú e o barril), mas sem `abrivel`: o toque não pede nada e não há selo.
    const snapshot = JSON.stringify(m.inicial.outbound.find((o) => o.clientId === 'c1')?.msg) ?? ''
    expect(snapshot).toContain('"id":"bau-1"')
    expect(snapshot).toContain('"id":"barril-novo"')
    expect(snapshot).not.toContain('abrivel')
    expect(snapshot).not.toContain('conteudo')
    expect(snapshot).not.toContain('Poção')
    for (const propId of ['bau-1', 'barril-novo']) {
      expect(msgPara(m.s.handleMessage('c1', { type: 'objeto.abrir', propId }, m.world))).toEqual({ type: 'objeto.recusado', propId, motivo: 'indisponivel' })
    }
    // O mestre liga o do baú: o mesmo toque abre o jogo.
    m.trocarMapa(mapa(token('diego', 180, 200), [bau({ conteudo: { ...comCobra, minigame: true } }), novo]))
    expect(msgPara(m.s.handleMessage('c1', { type: 'objeto.abrir', propId: 'bau-1' }, m.world))?.type).toBe('objeto.jogo')
  })
})
