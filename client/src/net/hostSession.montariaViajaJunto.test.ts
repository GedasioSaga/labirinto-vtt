import { describe, expect, it } from 'vitest'
import { applyGatherPlan, planGather } from '../lib/gatherParty'
import { createEmptyMap } from '../lib/mapFactory'
import { partyMembers } from '../lib/party'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS } from '../lib/pins'
import type { Pin, Token } from '../types/map'
import { createHostSession, type AppliedTransfer, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * MONTARIA E FAMILIAR VIAJAM COM O DONO: a viagem levava só uma ficha do
 * jogador, e o pônei e a coruja ficavam na estrada. Agora as outras fichas do
 * MESMO jogador a até 2 casas da que viaja vão junto, cada uma numa casa livre
 * em volta de onde ele chega. Ficha escondida pelo mestre não vai — e nada do
 * que o jogador não vê chega a ele pela rede.
 */

const CODE = 'AB12CD'
const ESTRADA = 'cena-estrada'
const VILA = 'cena-vila'
const GRADE = 50
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })
const PONTE_A = casa(10, 5)
const PONTE_B = casa(20, 5)

function ficha(id: string, p: { x: number; y: number }, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null, ...extra }
}

function ponte(id: string, p: { x: number; y: number }, sceneId: string, pinId: string): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description: id, image: null, destino: { sceneId, pinId } }
}

function welcomeOf(messages: { msg: HostMessage }[]): { playerId: string } {
  const first = messages[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first
}

/**
 * Estrada com a ponte. Bruno (c1) tem a ficha dele, o pônei colado, a coruja
 * a 2 casas na diagonal e o cão a 3 casas (longe demais). Ana (c2) está a 3
 * casas de Bruno, com o gato dela colado. `onde` diz em que cena cada ficha
 * está e onde; o integrador (`aplica`) move a ficha como a store faria.
 */
function mesa() {
  const onde: Record<string, { cena: string; x: number; y: number }> = {
    bruno: { cena: ESTRADA, ...casa(9, 6) },
    ponei: { cena: ESTRADA, ...casa(8, 6) },
    coruja: { cena: ESTRADA, ...casa(11, 8) },
    cao: { cena: ESTRADA, ...casa(6, 6) },
    ana: { cena: ESTRADA, ...casa(12, 6) },
    gato: { cena: ESTRADA, ...casa(13, 6) },
    guarda: { cena: VILA, ...casa(25, 9) },
  }
  /** O que o mestre mudou numa ficha (esconder, por exemplo). */
  const patch: Record<string, Partial<Token>> = {}
  const fichasEm = (cena: string) => Object.entries(onde).filter(([, p]) => p.cena === cena).map(([id, p]) => ficha(id, p, patch[id]))
  const world = (): HostWorld => ({
    open: {
      sceneId: ESTRADA,
      name: 'Estrada Real',
      map: { ...createEmptyMap('mapa-estrada', 'Aventura', 40, 12, GRADE), tokens: fichasEm(ESTRADA), pins: [ponte('ponte-a', PONTE_A, VILA, 'ponte-b')] },
    },
    background: [
      {
        sceneId: VILA,
        name: 'Vila Cinzenta',
        map: { ...createEmptyMap('mapa-vila', 'Planta', 40, 12, GRADE), tokens: fichasEm(VILA), pins: [ponte('ponte-b', PONTE_B, ESTRADA, 'ponte-a')] },
      },
    ],
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
  const ids: Record<string, string> = {}
  const entra = (clientId: string, name: string, tokenIds: string[]) => {
    ids[name] = welcomeOf(s.handleMessage(clientId, { type: 'join', code: CODE, name }, world()).outbound).playerId
    for (const tokenId of tokenIds) s.assignToken(ids[name], tokenId)
  }
  entra('c1', 'Bruno', ['bruno', 'ponei', 'coruja', 'cao'])
  entra('c2', 'Ana', ['ana', 'gato'])
  s.broadcast(world())
  const pedir = (clientId: string): string => {
    const r = s.handleMessage(clientId, { type: 'pin.travel.request', pinId: 'ponte-a' }, world())
    if (r.travelRequest === undefined) throw new Error(`o pedido de ${clientId} deveria valer`)
    return r.travelRequest.requestId
  }
  /** O que o integrador faz com `applyTransfer`: a ficha e o séquito dela mudam de cena. */
  const aplica = (transfer: AppliedTransfer | undefined) => {
    if (transfer === undefined) return
    onde[transfer.tokenId] = { cena: transfer.toSceneId, x: transfer.x, y: transfer.y }
    for (const junto of transfer.entourage ?? []) onde[junto.tokenId] = { cena: transfer.toSceneId, x: junto.x, y: junto.y }
  }
  return { s, onde, patch, world, ids, pedir, aplica }
}

/** Todo mapa (`snapshot` ou `delta`) que saiu para `clientId`. */
function mapasDe(outbound: readonly { clientId: string; msg: HostMessage }[], clientId: string) {
  return outbound.flatMap((o) => (o.clientId === clientId && (o.msg.type === 'snapshot' || o.msg.type === 'delta') ? [o.msg.map] : []))
}

const chave = (p: { x: number; y: number }) => `${p.x}|${p.y}`

/** Ficha de 1 casa em `p` não está na casa do pino nem encosta na cabeça dele: o pino continua tocável. */
const foraDoPino = (p: { x: number; y: number }, pino: { x: number; y: number }): boolean =>
  chave(p) !== chave(pino) && Math.hypot(p.x - pino.x, p.y - (pino.y - PIN_HEAD_OFFSET)) >= GRADE / 2 + PIN_HEAD_RADIUS

describe('hostSession: montaria e familiar viajam com o dono', () => {
  it('"Deixar ir": o pônei (colado) e a coruja (2 casas na diagonal) vão junto; o cão, a 3 casas, fica', () => {
    const t = mesa()
    const r = t.s.approveTravel(t.pedir('c1'), t.world())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'bruno', fromSceneId: ESTRADA, toSceneId: VILA })
    expect((r.applyTransfer?.entourage ?? []).map((e) => e.tokenId)).toEqual(['ponei', 'coruja'])
  })

  it('cada um numa casa livre DIFERENTE, colada à de Bruno na chegada, nunca em cima dele', () => {
    const t = mesa()
    const chegada = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    if (chegada === undefined) throw new Error('Bruno deveria passar')
    const junto = chegada.entourage ?? []
    expect(junto).toHaveLength(2)
    expect(new Set([chave(chegada), ...junto.map(chave)]).size).toBe(3)
    for (const e of junto) expect(Math.max(Math.abs(e.x - chegada.x), Math.abs(e.y - chegada.y))).toBe(GRADE)
  })

  it('ficha do mesmo dono escondida pelo mestre não vai, e ficha de OUTRO jogador colada não vai de carona', () => {
    const t = mesa()
    t.patch.coruja = { hidden: true }
    t.onde.gato = { cena: ESTRADA, ...casa(10, 6) }
    const chegada = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    expect((chegada?.entourage ?? []).map((e) => e.tokenId)).toEqual(['ponei'])
  })

  it('sozinho (nenhuma outra ficha dele perto): a chegada vem sem séquito, como antes', () => {
    const t = mesa()
    t.onde.ponei = { cena: ESTRADA, ...casa(3, 3) }
    t.onde.coruja = { cena: ESTRADA, ...casa(3, 9) }
    const chegada = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    expect(chegada).toMatchObject({ tokenId: 'bruno', toSceneId: VILA })
    expect(chegada?.entourage).toBeUndefined()
  })

  it('a casa do séquito ignora ficha escondida na chegada: o lugar onde o pônei senta não entrega o guarda oculto', () => {
    const semGuarda = mesa()
    delete semGuarda.onde.guarda
    const livre = semGuarda.s.approveTravel(semGuarda.pedir('c1'), semGuarda.world()).applyTransfer
    const t = mesa()
    t.patch.guarda = { hidden: true }
    // O guarda escondido fica exatamente na casa onde o pônei sentaria.
    const casaDoPonei = livre?.entourage?.[0]
    if (casaDoPonei === undefined) throw new Error('o pônei deveria sentar em algum lugar')
    t.onde.guarda = { cena: VILA, x: casaDoPonei.x, y: casaDoPonei.y }
    const comGuarda = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    expect(comGuarda?.entourage).toEqual(livre?.entourage)
  })

  it('"Deixar ir com quem está perto": o gato de Ana vai com ela, e as seis casas são todas diferentes', () => {
    const t = mesa()
    t.onde.ana = { cena: ESTRADA, ...casa(11, 6) }
    t.onde.gato = { cena: ESTRADA, ...casa(12, 6) }
    const resultados = t.s.approveTravelTogether(t.pedir('c1'), t.world())
    const chegadas = resultados.map((r) => r.applyTransfer).filter((a): a is AppliedTransfer => a !== undefined)
    expect(chegadas.map((a) => [a.tokenId, (a.entourage ?? []).map((e) => e.tokenId)])).toEqual([
      ['bruno', ['ponei', 'coruja']],
      ['ana', ['gato']],
    ])
    const casas = chegadas.flatMap((a) => [chave(a), ...(a.entourage ?? []).map(chave)])
    expect(casas).toHaveLength(5)
    expect(new Set(casas).size).toBe(5)
  })

  it('séquito de 3 fichas: nenhuma senta na casa do pino par nem cobre a cabeça dele (o jogador precisa tocá-lo para voltar)', () => {
    const t = mesa()
    // O cão colado a Bruno: agora são três no séquito, e o anel em volta da chegada passa pelo pino.
    t.onde.cao = { cena: ESTRADA, ...casa(9, 7) }
    const chegada = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    const junto = chegada?.entourage ?? []
    expect(junto.map((e) => e.tokenId)).toEqual(['ponei', 'coruja', 'cao'])
    for (const e of junto) expect(foraDoPino(e, PONTE_B)).toBe(true)
  })

  it('"Deixar ir com quem está perto": o séquito de 3 fichas de Ana também fica fora do pino par', () => {
    const t = mesa()
    t.onde.ana = { cena: ESTRADA, ...casa(11, 6) }
    t.onde.gato = { cena: ESTRADA, ...casa(12, 6) }
    t.onde.lince = { cena: ESTRADA, ...casa(11, 5) }
    t.onde.rato = { cena: ESTRADA, ...casa(12, 7) }
    t.s.assignToken(t.ids.Ana, 'lince')
    t.s.assignToken(t.ids.Ana, 'rato')
    const chegadas = t.s
      .approveTravelTogether(t.pedir('c1'), t.world())
      .map((r) => r.applyTransfer)
      .filter((a): a is AppliedTransfer => a !== undefined)
    const ana = chegadas.find((a) => a.tokenId === 'ana')
    expect((ana?.entourage ?? []).map((e) => e.tokenId).sort()).toEqual(['gato', 'lince', 'rato'])
    const sequitos = chegadas.flatMap((a) => a.entourage ?? [])
    expect(sequitos).toHaveLength(5)
    for (const e of sequitos) expect(foraDoPino(e, PONTE_B)).toBe(true)
  })

  it('"Mandar para…" do mestre leva o séquito também', () => {
    const t = mesa()
    const r = t.s.sendPlayer(t.ids.Bruno, VILA, 'ponte-b', t.world())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'bruno', toSceneId: VILA })
    expect((r.applyTransfer?.entourage ?? []).map((e) => e.tokenId)).toEqual(['ponei', 'coruja'])
  })

  it('"Desfazer" do diário devolve o séquito com ele', () => {
    const t = mesa()
    const ida = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    t.aplica(ida)
    const volta = t.s.returnPlayer(t.ids.Bruno, 'bruno', { sceneId: ESTRADA, ...casa(9, 6) }, t.world()).applyTransfer
    expect(volta).toMatchObject({ tokenId: 'bruno', toSceneId: ESTRADA })
    expect((volta?.entourage ?? []).map((e) => e.tokenId).sort()).toEqual(['coruja', 'ponei'])
  })

  it('pela rede: Bruno recebe a Vila com o pônei e a coruja; Ana, que ficou, não recebe nenhum dos três; nenhum nome de cena sai', () => {
    const t = mesa()
    const r = t.s.approveTravel(t.pedir('c1'), t.world())
    t.aplica(r.applyTransfer)
    const rede = t.s.broadcast(t.world()).outbound
    const fichasDe = (clientId: string) => mapasDe(rede, clientId).flatMap((m) => m.tokens.map((tok) => tok.id))
    expect(fichasDe('c1')).toEqual(expect.arrayContaining(['bruno', 'ponei', 'coruja']))
    expect(fichasDe('c1')).not.toContain('cao')
    expect(mapasDe(rede, 'c2').length).toBeGreaterThan(0)
    for (const id of ['bruno', 'ponei', 'coruja']) expect(fichasDe('c2')).not.toContain(id)
    expect(JSON.stringify([...r.outbound, ...rede])).not.toMatch(/Vila Cinzenta|Estrada Real/)
  })

  it('pela rede: a coruja escondida pelo mestre fica, e não chega a Bruno na Vila', () => {
    const t = mesa()
    t.patch.coruja = { hidden: true }
    t.aplica(t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer)
    expect(t.onde.coruja.cena).toBe(ESTRADA)
    const rede = t.s.broadcast(t.world()).outbound
    const fichas = mapasDe(rede, 'c1').flatMap((m) => m.tokens.map((tok) => tok.id))
    expect(fichas).toContain('ponei')
    expect(fichas).not.toContain('coruja')
  })
})

describe('hostSession: "Reunir o grupo aqui" leva montaria e familiar', () => {
  /** O mestre abriu a Vila: é nela o pino da reunião, e Bruno está na Estrada. */
  const naVila = (w: HostWorld): HostWorld => ({ open: w.background[0], background: [w.open] })

  it('Bruno na Estrada com o pônei e a coruja; a reunião num pino da Vila traz os três, e o cão, a 3 casas, fica', () => {
    const t = mesa()
    const mundo = naVila(t.world())
    const membros = partyMembers(t.s.listPlayers(mundo), mundo).filter((m) => m.name === 'Bruno')
    const plano = planGather(membros, mundo, PONTE_B)
    const falhou = applyGatherPlan(plano, {
      sceneId: VILA,
      bringFromOtherScene: (playerId, sceneId, at) => {
        const r = t.s.sendPlayer(playerId, sceneId, null, naVila(t.world()), at)
        t.aplica(r.applyTransfer)
        return r.applyTransfer !== undefined
      },
      placeInScene: () => undefined,
    })
    expect(falhou).toEqual([])
    expect([t.onde.bruno.cena, t.onde.ponei.cena, t.onde.coruja.cena, t.onde.cao.cena]).toEqual([VILA, VILA, VILA, ESTRADA])
    const casas = ['bruno', 'ponei', 'coruja'].map((id) => chave(t.onde[id]))
    expect(new Set(casas).size).toBe(3)
    expect(casas).not.toContain(chave(PONTE_B))
  })

  it('a sessão só aceita do plano o séquito de verdade: ficha de outro jogador, longe demais ou escondida não vai de carona', () => {
    const t = mesa()
    t.patch.coruja = { hidden: true }
    const mundo = naVila(t.world())
    const at = {
      ...casa(19, 5),
      entourage: [
        { tokenId: 'ponei', ...casa(18, 5) },
        { tokenId: 'gato', ...casa(18, 4) },
        { tokenId: 'cao', ...casa(18, 6) },
        { tokenId: 'coruja', ...casa(19, 4) },
      ],
    }
    const r = t.s.sendPlayer(t.ids.Bruno, VILA, null, mundo, at)
    expect(r.applyTransfer).toMatchObject({ tokenId: 'bruno', toSceneId: VILA, x: at.x, y: at.y })
    expect(r.applyTransfer?.entourage).toEqual([{ tokenId: 'ponei', ...casa(18, 5) }])
  })

  it('reunião sem séquito no plano: só a ficha dele vem, como antes', () => {
    const t = mesa()
    const r = t.s.sendPlayer(t.ids.Bruno, VILA, null, naVila(t.world()), casa(19, 5))
    expect(r.applyTransfer).toMatchObject({ tokenId: 'bruno', toSceneId: VILA })
    expect(r.applyTransfer?.entourage).toBeUndefined()
  })
})

describe('hostSession: "Trazer" a ficha que ficou em outra cena', () => {
  it('traz a Faísca da Vila para a casa livre colada a Bruno, sem mudar a cena dele nem mandar nome de cena', () => {
    const t = mesa()
    t.onde.ponei = { cena: VILA, ...casa(30, 2) }
    const r = t.s.bringToken(t.ids.Bruno, 'ponei', t.world())
    expect(r.applyTransfer).toMatchObject({ tokenId: 'ponei', playerId: t.ids.Bruno, fromSceneId: VILA, toSceneId: ESTRADA })
    const bruno = t.onde.bruno
    const chegada = r.applyTransfer
    if (chegada === undefined) throw new Error('a Faísca deveria vir')
    expect(chave(chegada)).not.toBe(chave(bruno))
    expect(Math.max(Math.abs(chegada.x - bruno.x), Math.abs(chegada.y - bruno.y))).toBe(GRADE)
    // Bruno não trocou de cena: nada de "Você chegou", e nenhum nome de cena.
    expect(r.outbound).toEqual([])
    t.aplica(chegada)
    const rede = t.s.broadcast(t.world()).outbound
    expect(mapasDe(rede, 'c1').flatMap((m) => m.tokens.map((tok) => tok.id))).toContain('ponei')
    expect(mapasDe(rede, 'c1').every((m) => m.id === 'mapa-estrada')).toBe(true)
    expect(JSON.stringify(rede)).not.toMatch(/Vila Cinzenta/)
  })

  it('Bruno acabou de chegar pela ponte com o cão: o pônei e a coruja trazidos não sentam no pino par nem cobrem a cabeça dele', () => {
    const t = mesa()
    // Só o cão vai colado; o pônei e a coruja ficam longe e são trazidos depois.
    t.onde.cao = { cena: ESTRADA, ...casa(9, 7) }
    t.onde.ponei = { cena: ESTRADA, ...casa(3, 3) }
    t.onde.coruja = { cena: ESTRADA, ...casa(3, 9) }
    const chegada = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
    expect((chegada?.entourage ?? []).map((e) => e.tokenId)).toEqual(['cao'])
    t.aplica(chegada)
    const trazidos: AppliedTransfer[] = []
    for (const tokenId of ['ponei', 'coruja']) {
      const r = t.s.bringToken(t.ids.Bruno, tokenId, t.world())
      if (r.applyTransfer === undefined) throw new Error(`${tokenId} deveria vir`)
      expect(r.applyTransfer).toMatchObject({ tokenId, fromSceneId: ESTRADA, toSceneId: VILA })
      t.aplica(r.applyTransfer)
      trazidos.push(r.applyTransfer)
    }
    const bruno = t.onde.bruno
    for (const p of trazidos) {
      expect(foraDoPino(p, PONTE_B)).toBe(true)
      expect(Math.max(Math.abs(p.x - bruno.x), Math.abs(p.y - bruno.y))).toBe(GRADE)
    }
    // Ninguém empilhado: Bruno, o cão e os dois trazidos em quatro casas diferentes.
    expect(new Set([bruno, t.onde.cao, ...trazidos].map(chave)).size).toBe(4)
  })

  it('pino de viagem secreto não desvia a ficha trazida: o lugar onde ela senta não entrega o pino que o jogador não vê', () => {
    /** Bruno passa sozinho pela ponte; o pônei ficou longe, na Estrada. */
    const naVila = () => {
      const t = mesa()
      t.onde.ponei = { cena: ESTRADA, ...casa(3, 3) }
      t.onde.coruja = { cena: ESTRADA, ...casa(3, 9) }
      const chegada = t.s.approveTravel(t.pedir('c1'), t.world()).applyTransfer
      expect(chegada?.entourage).toBeUndefined()
      t.aplica(chegada)
      return t
    }
    const semPino = naVila()
    const livre = semPino.s.bringToken(semPino.ids.Bruno, 'ponei', semPino.world()).applyTransfer
    if (livre === undefined) throw new Error('o pônei deveria vir')
    const t = naVila()
    const mundo = t.world()
    // Pino de viagem secreto exatamente na casa onde o pônei sentaria.
    const vila = mundo.background[0]
    if (vila === undefined) throw new Error('a Vila deveria existir')
    vila.map.pins.push({ ...ponte('passagem-secreta', { x: livre.x, y: livre.y }, ESTRADA, 'ponte-a'), secret: true })
    const r = t.s.bringToken(t.ids.Bruno, 'ponei', mundo).applyTransfer
    expect(r).toMatchObject({ tokenId: 'ponei', toSceneId: VILA, x: livre.x, y: livre.y })
  })

  it('nada: ficha de outro jogador, ficha que já está na cena dele, ficha que não existe', () => {
    const t = mesa()
    t.onde.gato = { cena: VILA, ...casa(30, 2) }
    expect(t.s.bringToken(t.ids.Bruno, 'gato', t.world())).toEqual({ outbound: [] })
    expect(t.s.bringToken(t.ids.Bruno, 'ponei', t.world())).toEqual({ outbound: [] })
    expect(t.s.bringToken(t.ids.Bruno, 'nao-existe', t.world())).toEqual({ outbound: [] })
    expect(t.s.bringToken('ninguem', 'ponei', t.world())).toEqual({ outbound: [] })
  })
})
