/**
 * INICIATIVA pela rede: o jogador recebe DE QUEM É A VEZ só quando a ficha da
 * vez está no recorte dele (`lib/fogFilter.ts`). Ficha secreta, atrás da
 * parede, fora da visão ou de outra cena: o campo nem vai — nem o id.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { turnForPlayer } from '../lib/fogFilter'
import type { TurnRef } from '../lib/initiative'
import type { MapData, Token, Wall } from '../types/map'
import { createHostSession } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

function ficha(id: string, x: number, y: number, secret = false): Token {
  const t: Token = { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
  return secret ? { ...t, secret: true } : t
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Herói (do jogador), goblin à vista, vulto SECRETO à vista, ladino atrás da parede em x=500. */
function ponte(): MapData {
  return {
    ...createEmptyMap('mapa-ponte', 'Ponte Velha', 1000, 1000, 40),
    walls: [parede('divisoria', 500, 0, 500, 1000)],
    tokens: [ficha('heroi', 200, 200), ficha('goblin', 320, 200), ficha('vulto', 260, 260, true), ficha('ladino', 800, 200)],
  }
}

function snapshotCom(turn: TurnRef | null, map: MapData = ponte()): Extract<HostMessage, { type: 'snapshot' }> {
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, getTurn: () => turn })
  const r = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, map)
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'heroi')
  const msg = s.broadcast(map).outbound.find((o) => o.clientId === 'c1')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
  return msg
}

describe('iniciativa no snapshot do jogador', () => {
  it('a vez de uma ficha à vista chega pelo id; a da própria ficha também', () => {
    expect(snapshotCom({ mapId: 'mapa-ponte', tokenId: 'goblin' }).turn).toBe('goblin')
    expect(snapshotCom({ mapId: 'mapa-ponte', tokenId: 'heroi' }).turn).toBe('heroi')
  })

  it('SEGURANÇA: na vez da ficha SECRETA o jogador não recebe o campo, nem o id, nem o nome', () => {
    const msg = snapshotCom({ mapId: 'mapa-ponte', tokenId: 'vulto' })
    expect('turn' in msg).toBe(false)
    const fio = JSON.stringify(msg)
    expect(fio).not.toContain('vulto')
    expect(fio).not.toContain('nome-vulto')
  })

  it('SEGURANÇA: ficha atrás da parede (fora da visão) não vira vez no jogador', () => {
    const msg = snapshotCom({ mapId: 'mapa-ponte', tokenId: 'ladino' })
    expect('turn' in msg).toBe(false)
    expect(JSON.stringify(msg)).not.toContain('ladino')
  })

  it('SEGURANÇA: a vez de outra cena (outro mapa) não vaza para quem está nesta, mesmo com id igual', () => {
    const msg = snapshotCom({ mapId: 'mapa-cripta', tokenId: 'goblin' })
    expect('turn' in msg).toBe(false)
  })

  it('sem vez nenhuma, o snapshot sai como sempre saiu', () => {
    expect('turn' in snapshotCom(null)).toBe(false)
  })
})

/**
 * Sala com Ana (herói) e Bruno (ladino, atrás da parede); a vez é lida a cada
 * chamada, como no mestre: `vez.atual` muda sem recriar a sessão.
 */
function sala(dono: { ladino: boolean } = { ladino: true }, map: MapData = ponte()) {
  const vez: { atual: TurnRef | null } = { atual: null }
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, getTurn: () => vez.atual })
  const entrar = (clientId: string, name: string, tokenId: string | null): void => {
    const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name }, map).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    if (tokenId !== null) s.assignToken(welcome.playerId, tokenId)
  }
  entrar('c1', 'Ana', 'heroi')
  entrar('c2', 'Bruno', dono.ladino ? 'ladino' : null)
  const mover = (clientId: string, tokenId: string, x: number, y: number) =>
    s.handleMessage(clientId, { type: 'token.move', reqId: 'r1', tokenId, x, y }, map)
  // A tela de cada conexão: o broadcast só manda quando ela muda, então a tela
  // é o último snapshot recebido. `enviado`: tudo o que saiu no último envio.
  const telas = new Map<string, Extract<HostMessage, { type: 'snapshot' }>>()
  let enviado = ''
  const snapshotDe = (clientId: string): Extract<HostMessage, { type: 'snapshot' }> => {
    const saida = s.broadcast(map).outbound
    enviado = JSON.stringify(saida)
    for (const o of saida) if (o.msg.type === 'snapshot') telas.set(o.clientId, o.msg)
    const msg = telas.get(clientId)
    if (msg === undefined) throw new Error('esperava snapshot')
    return msg
  }
  return { vez, mover, snapshotDe, ultimoEnvio: () => enviado }
}

describe('só quem está na vez move', () => {
  it('na vez de outra ficha desta cena, o movimento volta com not_your_turn e nada se aplica', () => {
    const { vez, mover } = sala()
    vez.atual = { mapId: 'mapa-ponte', tokenId: 'goblin' }
    const r = mover('c1', 'heroi', 240, 200)
    expect(r.applyMove).toBeUndefined()
    expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'not_your_turn' } }])
  })

  it('na vez da própria ficha o movimento é aceito; a do outro jogador continua presa', () => {
    const { vez, mover } = sala()
    vez.atual = { mapId: 'mapa-ponte', tokenId: 'heroi' }
    const ana = mover('c1', 'heroi', 240, 200)
    expect(ana.applyMove).toMatchObject({ tokenId: 'heroi' })
    const bruno = mover('c2', 'ladino', 840, 200)
    expect(bruno.applyMove).toBeUndefined()
    expect(bruno.outbound[0]?.msg).toMatchObject({ type: 'token.move.rejected', reason: 'not_your_turn' })
  })

  it('sem iniciativa, ou com a vez em OUTRA cena, todo mundo move como antes', () => {
    const { vez, mover } = sala()
    expect(mover('c1', 'heroi', 240, 200).applyMove).toMatchObject({ tokenId: 'heroi' })
    vez.atual = { mapId: 'mapa-cripta', tokenId: 'goblin' }
    expect(mover('c1', 'heroi', 260, 200).applyMove).toMatchObject({ tokenId: 'heroi' })
  })

  it('na vez de ficha que ele NÃO vê, recusa igual: a resposta não diz de quem é a vez', () => {
    const { vez, mover } = sala()
    for (const tokenId of ['vulto', 'ladino']) {
      vez.atual = { mapId: 'mapa-ponte', tokenId }
      const r = mover('c1', 'heroi', 240, 200)
      expect(r.applyMove).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'not_your_turn' } }])
    }
  })

  it('a ficha da vez SAIU da cena (apagada ou viajou): a vez obsoleta não prende ninguém', () => {
    const vez: { atual: TurnRef | null } = { atual: { mapId: 'mapa-ponte', tokenId: 'goblin' } }
    const semGoblin: MapData = { ...ponte(), tokens: ponte().tokens.filter((t) => t.id !== 'goblin') }
    const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, getTurn: () => vez.atual })
    const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, semGoblin).outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, 'heroi')
    const r = s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'heroi', x: 240, y: 200 }, semGoblin)
    expect(r.outbound[0]?.msg).toMatchObject({ type: 'token.move.accepted', reqId: 'r1' })
    expect(r.applyMove).toMatchObject({ tokenId: 'heroi' })
  })

  it('com "Fichas ocupam espaço" ligado: fora da vez a recusa é not_your_turn; na vez, a ocupação continua valendo', () => {
    // As duas regras chegam ao host juntas (movimento-contado + iniciativa): nenhuma pode apagar a outra.
    const ocupada: MapData = { ...ponte(), movement: { tokensOccupy: true } }
    const { vez, mover } = sala({ ladino: true }, ocupada)

    vez.atual = { mapId: 'mapa-ponte', tokenId: 'goblin' }
    const foraDaVez = mover('c1', 'heroi', 240, 200)
    expect(foraDaVez.applyMove).toBeUndefined()
    expect(foraDaVez.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'not_your_turn' } }])

    vez.atual = { mapId: 'mapa-ponte', tokenId: 'heroi' }
    // Em cima do goblin (320,200), que Ana vê: "Lugar ocupado".
    const emCima = mover('c1', 'heroi', 320, 200)
    expect(emCima.applyMove).toBeUndefined()
    expect(emCima.outbound[0]?.msg).toMatchObject({ type: 'token.move.rejected', reason: 'occupied' })
    // Casa livre, na vez dela: anda.
    expect(mover('c1', 'heroi', 240, 200).applyMove).toMatchObject({ tokenId: 'heroi', x: 240, y: 200 })
  })

  it('ficha que não é dele continua recusada como not_owner, mesmo na vez dela', () => {
    const { vez, mover } = sala()
    vez.atual = { mapId: 'mapa-ponte', tokenId: 'goblin' }
    expect(mover('c1', 'goblin', 340, 200).outbound[0]?.msg).toMatchObject({ type: 'token.move.rejected', reason: 'not_owner' })
  })
})

/**
 * SEGURANÇA: a vez de quem o jogador NÃO vê não pode deixar rastro nenhum no
 * snapshot. "Vez do mestre" ou "vez de outro jogador" contaria que existe um
 * combatente escondido na ordem, e que ele está agindo agora — exatamente o que
 * o mestre esconde. O snapshot sai IGUAL ao de "ninguém na vez".
 */
describe('vez de quem o jogador não vê', () => {
  /** O fio sem o `rev`, que avança a cada broadcast e não diz nada sobre a vez. */
  const semRev = (msg: Extract<HostMessage, { type: 'snapshot' }>) => ({ ...msg, rev: 0 })

  it('ficha SECRETA na vez: o snapshot é idêntico ao de ninguém na vez', () => {
    const { vez, snapshotDe, ultimoEnvio } = sala()
    const ninguem = semRev(snapshotDe('c1'))
    vez.atual = { mapId: 'mapa-ponte', tokenId: 'vulto' }
    const msg = snapshotDe('c1')
    expect(semRev(msg)).toEqual(ninguem)
    expect(JSON.stringify(msg)).not.toContain('vulto')
    expect(ultimoEnvio()).not.toContain('vulto')
  })

  it('ficha fora da visão na vez, com dono ou sem dono: idêntico ao de ninguém na vez', () => {
    for (const ladino of [true, false]) {
      const { vez, snapshotDe } = sala({ ladino })
      const ninguem = semRev(snapshotDe('c1'))
      vez.atual = { mapId: 'mapa-ponte', tokenId: 'ladino' }
      expect(semRev(snapshotDe('c1'))).toEqual(ninguem)
    }
  })

  it('o snapshot não ganha campo novo de vez escondida (só "turn", e só à vista)', () => {
    const { vez, snapshotDe } = sala()
    const campos = Object.keys(snapshotDe('c1')).sort()
    for (const tokenId of ['vulto', 'ladino']) {
      vez.atual = { mapId: 'mapa-ponte', tokenId }
      expect(Object.keys(snapshotDe('c1')).sort()).toEqual(campos)
    }
    vez.atual = { mapId: 'mapa-ponte', tokenId: 'goblin' }
    expect(Object.keys(snapshotDe('c1')).sort()).toEqual([...campos, 'turn'].sort())
  })
})

describe('turnForPlayer (recorte)', () => {
  const recorte = { ...ponte(), tokens: [ficha('heroi', 200, 200), ficha('goblin', 320, 200)] }

  it('só devolve o id quando a ficha está no recorte e a vez é deste mapa', () => {
    expect(turnForPlayer(recorte, { mapId: 'mapa-ponte', tokenId: 'goblin' })).toBe('goblin')
    expect(turnForPlayer(recorte, { mapId: 'mapa-ponte', tokenId: 'vulto' })).toBeNull()
    expect(turnForPlayer(recorte, { mapId: 'outro', tokenId: 'goblin' })).toBeNull()
    expect(turnForPlayer(recorte, null)).toBeNull()
  })
})
