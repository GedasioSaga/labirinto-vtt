/**
 * CONTAS DOS JOGADORES, lado da sessão: quem entra com a conta (já conferida
 * pela ponte) recebe as fichas dos personagens que o mestre deu à conta — só
 * as que ninguém segura —, volta a ser o mesmo jogador de outro aparelho, e
 * reencontra assento e notas pelo nome DA CONTA. PIN pela rede sem a ponte
 * não entra; "Só com conta" recusa quem só digita o nome; nada da conta
 * (nem o dono do personagem) vai ao jogador.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { PersonalNote } from '../lib/minhasNotas'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import type { SavedSeat, SavedSeatNotes } from '../lib/savedTable'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import type { ContasNaSala } from '../lib/contasDosJogadores'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'AB12CD'
const ANA = { id: 'conta_ana', nome: 'Ana' }
const BAU: PersonalNote = { id: 'n1', mapId: 'm-navio', x: 120, y: 140, text: 'baú trancado' }

function ficha(id: string, characterId: string | null, x: number): Token {
  return { id, characterId, name: `ficha-${id}`, x, y: 100, size: 1, image: null }
}

function personagem(id: string, nome: string, dono?: string): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', nome), id, ...(dono === undefined ? {} : { dono }) }
}

const PERSONAGENS = [personagem('pers_lirio', 'Lírio', ANA.id), personagem('pers_grog', 'Grog', ANA.id), personagem('pers_vela', 'Vela')]
const mundo: HostWorld = {
  open: {
    sceneId: 'cena-navio',
    name: 'Navio',
    map: { ...createEmptyMap('m-navio', 'Navio', 30, 10, 50), tokens: [ficha('lirio', 'pers_lirio', 100), ficha('grog', 'pers_grog', 200), ficha('vela', 'pers_vela', 300)] },
  },
  background: [],
  rpg: { sistema: SISTEMA_ONE_PIECE, personagens: PERSONAGENS },
}

interface Opcoes {
  contas?: ContasNaSala
  assentos?: SavedSeat[]
  notas?: SavedSeatNotes[]
}

function mesa(opcoes: Opcoes = {}) {
  let n = 0
  const contas = opcoes.contas
  const s = createHostSession({
    code: CODE,
    visionRadius: 700,
    now: () => 1_000 + n * 10_000,
    randomId: () => `id-${(n += 1)}`,
    restoreSeats: opcoes.assentos ?? [],
    restoreMyNotes: opcoes.notas ?? [],
    ...(contas === undefined ? {} : { contas: () => contas }),
  })
  const comConta = (clientId: string, conta = ANA) => s.joinWithAccount(clientId, { code: CODE, conta }, mundo)
  const soNome = (clientId: string, name: string, resume?: string) =>
    s.handleMessage(clientId, resume === undefined ? { type: 'join', code: CODE, name } : { type: 'join', code: CODE, name, resume }, mundo)
  return { s, comConta, soNome }
}

function welcomeDe(r: HostResult) {
  const welcome = r.outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  return welcome
}

describe('hostSession: entrar com a conta', () => {
  it('recebe as fichas dos personagens dados à conta e entra jogando; o mestre lê quem entrou e o quê', () => {
    const { s, comConta } = mesa()
    const r = comConta('c1')
    const welcome = welcomeDe(r)
    expect(welcome.name).toBe('Ana')
    const snapshot = r.outbound[1]?.msg
    if (snapshot?.type !== 'snapshot') throw new Error('com ficha, entra jogando')
    expect(snapshot.ownTokens).toEqual(['lirio', 'grog'])
    expect(r.contaEntrou).toEqual({ playerId: welcome.playerId, nome: 'Ana', tokenIds: ['lirio', 'grog'] })
    expect(s.listPlayers(mundo)[0]).toMatchObject({ name: 'Ana', status: 'playing', tokenIds: ['lirio', 'grog'] })
  })

  it('ficha que outro jogador segura não é tomada', () => {
    const { s, comConta, soNome } = mesa()
    const bruno = welcomeDe(soNome('c1', 'Bruno'))
    s.assignToken(bruno.playerId, 'grog')
    const r = comConta('c2')
    expect(r.contaEntrou?.tokenIds).toEqual(['lirio'])
    expect(s.listPlayers(mundo).find((p) => p.name === 'Bruno')?.tokenIds).toEqual(['grog'])
  })

  it('a conta que entra de outro aparelho é o MESMO jogador; a conexão antiga lê session.replaced', () => {
    const { comConta } = mesa()
    const primeira = welcomeDe(comConta('c1'))
    const r = comConta('c2')
    expect(welcomeDe(r).playerId).toBe(primeira.playerId)
    expect(r.replacedClientId).toBe('c1')
    expect(r.outbound).toContainEqual({ clientId: 'c1', msg: { type: 'session.replaced' } })
    // Já tinha as fichas: nada de novo a dar.
    expect(r.contaEntrou?.tokenIds).toEqual([])
  })

  it('código errado e conexão que já entrou são recusados como no join de sempre', () => {
    const { s, comConta } = mesa()
    expect(s.joinWithAccount('c1', { code: 'ZZ99ZZ', conta: ANA }, mundo).outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'bad_code' } }])
    comConta('c1')
    expect(comConta('c1').outbound).toEqual([{ clientId: 'c1', msg: { type: 'error', reason: 'already_joined' } }])
  })
})

describe('hostSession: PIN pela rede sem a ponte', () => {
  it('o join com PIN ou aparelho que chega direto à sessão é recusado e ninguém entra', () => {
    const { s } = mesa()
    const comPin = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana', pin: '1234' }, mundo)
    expect(comPin.outbound).toEqual([{ clientId: 'c1', msg: { type: 'account.refused', reason: 'unavailable' } }])
    const comAparelho = s.handleMessage('c2', { type: 'join', code: CODE, name: 'Ana', device: 'a'.repeat(43) }, mundo)
    expect(comAparelho.outbound).toEqual([{ clientId: 'c2', msg: { type: 'account.refused', reason: 'unavailable' } }])
    expect(s.listPlayers(mundo)).toEqual([])
  })
})

describe('hostSession: Só com conta', () => {
  it('quem só digita o nome é recusado; quem já estava volta pelo resume; a conta entra', () => {
    const contas = { soComConta: false, nomes: ['Ana'] }
    const { comConta, soNome } = mesa({ contas })
    const bia = welcomeDe(soNome('c1', 'Bia'))
    contas.soComConta = true
    expect(soNome('c2', 'Caio').outbound).toEqual([{ clientId: 'c2', msg: { type: 'error', reason: 'account_required' } }])
    // Resume que não bate é entrada nova: recusada também.
    expect(soNome('c3', 'Caio', 'resume-falso').outbound).toEqual([{ clientId: 'c3', msg: { type: 'error', reason: 'account_required' } }])
    expect(welcomeDe(soNome('c4', 'Bia', bia.resumeToken)).playerId).toBe(bia.playerId)
    expect(welcomeDe(comConta('c5')).name).toBe('Ana')
  })
})

describe('hostSession: o que é da conta fica com a conta', () => {
  const assentos: SavedSeat[] = [{ name: 'Ana', tokenIds: ['vela'], visionRadius: null, sceneKey: null }]
  const notas: SavedSeatNotes[] = [{ name: 'Ana', notes: [BAU] }]

  it('digitar "ana" sem a conta não leva o assento nem as notas guardadas; a conta, sim', () => {
    const { comConta, soNome } = mesa({ contas: { soComConta: false, nomes: ['Ana'] }, assentos, notas })
    const intrusa = soNome('c1', 'ana')
    expect(intrusa.reclaimed).toBeUndefined()
    expect(intrusa.outbound.some((o) => o.msg.type === 'mynotes.book')).toBe(false)
    const ana = comConta('c2')
    expect(ana.reclaimed).toMatchObject({ name: 'Ana', tokenIds: ['vela'] })
    expect(ana.outbound).toContainEqual({ clientId: 'c2', msg: { type: 'mynotes.book', notes: [BAU] } })
  })

  it('a conta que entra como "Ana (2)" guarda as notas no nome da conta', () => {
    const { s, comConta, soNome } = mesa({ contas: { soComConta: false, nomes: ['Ana'] } })
    soNome('c1', 'Ana')
    expect(welcomeDe(comConta('c2')).name).toBe('Ana (2)')
    s.handleMessage('c2', { type: 'mynotes.set', notes: [BAU] }, mundo)
    expect(s.savedMyNotes()).toEqual([{ name: 'Ana', notes: [BAU] }])
  })

  it('nada da conta vai ao jogador: o personagem chega sem o dono, e o id da conta não aparece', () => {
    const { comConta } = mesa()
    const r = comConta('c1')
    const personagens = r.outbound.find((o) => o.msg.type === 'personagens')?.msg
    if (personagens?.type !== 'personagens') throw new Error('esperava os personagens da Ana')
    expect(personagens.personagens.map((p) => p.nome)).toEqual(['Lírio', 'Grog'])
    expect(personagens.personagens.every((p) => !('dono' in p))).toBe(true)
    expect(JSON.stringify(r.outbound)).not.toContain(ANA.id)
    // O mundo do mestre continua com o dono: só a cópia que sai perde a chave.
    expect(PERSONAGENS[0].dono).toBe(ANA.id)
  })
})
