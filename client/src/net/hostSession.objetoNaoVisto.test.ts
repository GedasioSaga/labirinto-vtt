/**
 * OBJETO QUE BARRA e que o jogador NÃO ESTÁ VENDO, no FIO (auditoria da
 * 0.5.60). O moinho barra visto ou não (é físico, como a parede que o jogador
 * também não vê), mas a recusa "objeto" ('Objeto no caminho') só sai quando o
 * moinho está na tela que ESTE jogador tem. Fora dela (névoa, escuro), a
 * recusa é `wall`, a mesma da parede que ele não vê: o texto não conta que ali
 * há um objeto. A prova é a sessão de verdade do mestre: o pacote que ela
 * entrega e a resposta dela ao passo.
 *
 * "A tela que ele tem" é a última que saiu para a conexão por QUALQUER caminho:
 * o broadcast, a ENTRADA (o `welcome` com o mapa atrás) e o "olhar por outra
 * ficha". A prova com clique de verdade pegou a entrada: com o moinho à vista,
 * o arrasto logo depois de entrar respondia `wall` até o mestre mexer no mapa.
 *
 * Geometria (px de mundo, mapa 1000 x 1000, grade 40, sem Chão e sem parede):
 * a ficha na casa (7, 11), centro (300, 460); o MOINHO (2 x 2 casas) com o
 * centro em (480, 480), a 140 px da ficha no ponto mais perto.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Prop, Token } from '../types/map'
import { createHostSession, type HostResult, type HostSession, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'
const GRADE = 40
/** Raio de visão que não chega ao moinho, e o que chega. */
const VISAO_CURTA = 60
const VISAO_LONGA = 700
const HEROI: Token = { id: 'heroi', characterId: null, name: 'heroi', x: 300, y: 460, size: 1, image: null }
const MOINHO: Prop = { id: 'moinho', src: '', x: 480, y: 480, width: 2 * GRADE, height: 2 * GRADE, linkedMapPath: null, mobilia: 'moinho' }
const DENTRO = { x: 480, y: 480 }
const DO_OUTRO_LADO = { x: 700, y: 460 }

const CENA: MapData = { ...createEmptyMap('m', 'M', 25, 25, GRADE), tokens: [HEROI], props: [MOINHO] }

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>

/** A tela inteira que saiu para a conexão neste resultado (o `welcome` e os cartões ficam de fora). */
function snapshotPara(r: HostResult, clientId: string): Snapshot {
  const achado = r.outbound.map((o) => (o.clientId === clientId && o.msg.type === 'snapshot' ? o.msg : null)).find((msg) => msg !== null)
  if (achado === undefined || achado === null) throw new Error(`esperava snapshot para ${clientId}`)
  return achado
}

function sessao(visionRadius: number, batalha: boolean): HostSession {
  let n = 0
  return createHostSession({ code: CODE, visionRadius, now: () => 0, randomId: () => `id-${(n += 1)}`, getBatalha: () => batalha })
}

/** A Ana entra pela conexão `clientId` e devolve o `welcome` dela. */
function entrar(s: HostSession, clientId: string, world: MapData | HostWorld, resume?: string): Extract<HostMessage, { type: 'welcome' }> {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: 'Ana', ...(resume === undefined ? {} : { resume }) }, world).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome
}

/** A mesa com a Ana na ficha e a tela dela entregue pelo BROADCAST. Devolve a sessão e os objetos que a tela dela tem. */
function mesa(visionRadius: number, batalha = false): { s: HostSession; objetosNaTela: string[] } {
  const s = sessao(visionRadius, batalha)
  s.assignToken(entrar(s, 'c1', CENA).playerId, 'heroi')
  return { s, objetosNaTela: snapshotPara(s.broadcast(CENA), 'c1').map.props.map((p) => p.id) }
}

/**
 * A Ana, já dona da ficha, ENTRA pela conexão `c2` (a volta com o `resume`): a
 * tela dela sai pela entrada, atrás do `welcome`, sem broadcast nenhum.
 */
function entrada(visionRadius: number, batalha = false): { s: HostSession; objetosNaTela: string[] } {
  const s = sessao(visionRadius, batalha)
  const welcome = entrar(s, 'c1', CENA)
  s.assignToken(welcome.playerId, 'heroi')
  s.disconnect('c1', 0)
  const volta = s.handleMessage('c2', { type: 'join', code: CODE, name: 'Ana', resume: welcome.resumeToken }, CENA)
  return { s, objetosNaTela: snapshotPara(volta, 'c2').map.props.map((p) => p.id) }
}

function andar(s: HostSession, para: { x: number; y: number }, clientId = 'c1', tokenId = 'heroi', world: MapData | HostWorld = CENA): HostMessage | undefined {
  return s.handleMessage(clientId, { type: 'token.move', reqId: 'r1', tokenId, x: para.x, y: para.y }, world).outbound[0]?.msg
}

/** O motivo da recusa, ou o tipo da mensagem que veio no lugar dela. */
function recusa(msg: HostMessage | undefined): string {
  return msg?.type === 'token.move.rejected' ? msg.reason : `não recusou: ${String(msg?.type)}`
}

describe('objeto que barra, fora do que o jogador está vendo, pela rede', () => {
  it('moinho fora da tela dele: barra, e a recusa é a da parede; moinho à vista: barra, e a recusa é "objeto"', () => {
    const noEscuro = mesa(VISAO_CURTA)
    expect(noEscuro.objetosNaTela).toEqual([])
    for (const para of [DO_OUTRO_LADO, DENTRO]) expect(recusa(andar(noEscuro.s, para))).toBe('wall')

    const aVista = mesa(VISAO_LONGA)
    expect(aVista.objetosNaTela).toEqual(['moinho'])
    expect(recusa(andar(aVista.s, DO_OUTRO_LADO))).toBe('objeto')
  })

  it('em batalha: o moinho fora da tela para a ficha antes dele, sem recusa; à vista, a casa dentro dele recusa com "objeto"', () => {
    const noEscuro = mesa(VISAO_CURTA, true)
    expect(noEscuro.objetosNaTela).toEqual([])
    const aceito = andar(noEscuro.s, DENTRO)
    expect(aceito?.type).toBe('token.move.accepted')
    // Parou fora da caixa do moinho (que começa em x = 440).
    if (aceito?.type === 'token.move.accepted') expect(aceito.x).toBeLessThan(440)

    const aVista = mesa(VISAO_LONGA, true)
    expect(aVista.objetosNaTela).toEqual(['moinho'])
    expect(recusa(andar(aVista.s, DENTRO))).toBe('objeto')
  })
})

describe('a tela que o jogador TEM vale desde a entrada, sem o mestre mexer em nada', () => {
  it('ENTRA com o moinho à vista e arrasta logo: "objeto" (também em batalha); entra com a visão curta: a recusa da parede', () => {
    const aVista = entrada(VISAO_LONGA)
    expect(aVista.objetosNaTela).toEqual(['moinho'])
    // O 1º e o 2º arrasto, como na prova com clique de verdade.
    for (const para of [DENTRO, DO_OUTRO_LADO]) expect(recusa(andar(aVista.s, para, 'c2'))).toBe('objeto')
    // Depois do broadcast seguinte (o mestre não mexeu em nada) a resposta continua a mesma.
    aVista.s.broadcast(CENA)
    expect(recusa(andar(aVista.s, DENTRO, 'c2'))).toBe('objeto')

    const emBatalha = entrada(VISAO_LONGA, true)
    expect(emBatalha.objetosNaTela).toEqual(['moinho'])
    expect(recusa(andar(emBatalha.s, DENTRO, 'c2'))).toBe('objeto')

    const noEscuro = entrada(VISAO_CURTA)
    expect(noEscuro.objetosNaTela).toEqual([])
    for (const para of [DENTRO, DO_OUTRO_LADO]) expect(recusa(andar(noEscuro.s, para, 'c2'))).toBe('wall')
  })

  it('TROCA DE CENA ("olhar por outra ficha") e arrasta logo: o moinho da cena nova, à vista, responde "objeto"', () => {
    // O Salão (aberto) não tem moinho; o Pátio (de fundo) tem, ao lado do batedor dela.
    const batedor: Token = { ...HEROI, id: 'batedor', name: 'batedor' }
    const salao: MapData = { ...createEmptyMap('m-salao', 'Salão', 25, 25, GRADE), tokens: [HEROI] }
    const patio: MapData = { ...createEmptyMap('m-patio', 'Pátio', 25, 25, GRADE), tokens: [batedor], props: [MOINHO] }
    const mundo: HostWorld = { open: { sceneId: 's-a', name: 'Salão', map: salao }, background: [{ sceneId: 's-b', name: 'Pátio', map: patio }] }
    const s = sessao(VISAO_LONGA, false)
    const ana = entrar(s, 'c1', mundo).playerId
    s.assignToken(ana, 'heroi')
    s.assignToken(ana, 'batedor')
    expect(snapshotPara(s.broadcast(mundo), 'c1').map.id).toBe('m-salao')

    const troca = snapshotPara(s.handleMessage('c1', { type: 'view.switch', tokenId: 'batedor' }, mundo), 'c1')
    expect(troca.map.id).toBe('m-patio')
    expect(troca.map.props.map((p) => p.id)).toEqual(['moinho'])
    expect(recusa(andar(s, DENTRO, 'c1', 'batedor', mundo))).toBe('objeto')
  })
})
