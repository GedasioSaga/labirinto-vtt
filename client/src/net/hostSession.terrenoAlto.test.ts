import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { FloorPiece, MapData, Token, Wall } from '../types/map'
import { createHostSession, type HostResult, type HostSession } from './hostSession'
import type { HostMessage } from './protocol'
import { applyViewPatch, type PlayerViewContent } from './viewPatch'

/**
 * TERRENO ALTO (muralha, `lib/terrenoAlto.ts`) no host. 30x30 casas de 40 px.
 * A muralha é o 1º piso: uma passarela de ponta a ponta no alto do mapa
 * (y 160..240), uma torre no meio (520..680 x 420..580) e uma parede do 1º
 * piso em x = 900, que segura o olhar de quem está lá em cima. O guarda (Bia)
 * fica na passarela; o reino, no térreo, tem a Lia (Ana), um aldeão, uma
 * ficha oculta, uma ficha atrás da parede de cima e uma debaixo da passarela.
 */
const CODE = 'MURA01'
const RAIO = 700
const FOTO = `data:image/webp;base64,${'C'.repeat(20_000)}`

type Snapshot = Extract<HostMessage, { type: 'snapshot' }>
type Patch = Extract<HostMessage, { type: 'patch' }>

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number, extra: Partial<Wall> = {}): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null, ...extra }
}

function chao(id: string, cx: number, cy: number, w: number, h: number, extra: Partial<FloorPiece> = {}): FloorPiece {
  return { id, shape: { kind: 'rect', cx, cy, w, h }, op: 'add', modifiers: {}, ...extra }
}

function reino(extra: Partial<MapData> = {}, lia: Partial<Token> = {}, aldeao: Partial<Token> = {}): MapData {
  return {
    ...createEmptyMap('goa', 'Goa', 30, 30, 40),
    floor: [chao('passarela', 600, 200, 1200, 80, { piso: 1 }), chao('torre', 600, 500, 160, 160, { piso: 1 })],
    walls: [parede('parede-de-cima', 900, 0, 900, 1200, { piso: 1 })],
    tokens: [
      ficha('guarda', 600, 200, { piso: 1 }),
      ficha('lia', 600, 800, lia),
      ficha('aldeao', 300, 700, { imageData: FOTO, ...aldeao }),
      ficha('oculta', 800, 700, { hidden: true }),
      ficha('alem', 1000, 700),
      ficha('sob-passarela', 300, 200),
    ],
    ...extra,
  }
}

function sessao(): HostSession {
  let n = 0
  return createHostSession({ code: CODE, visionRadius: RAIO, now: () => 0, randomId: () => `id-${(n += 1)}`, patchMinSnapshotLength: 0 })
}

function entra(s: HostSession, clientId: string, nome: string, map: MapData, patch = false): string {
  const welcome = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, map).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  if (patch) s.handleMessage(clientId, { type: 'view.patches' }, map)
  return welcome.playerId
}

function para(r: HostResult, clientId: string): HostMessage {
  const msgs = r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
  const msg = msgs[0]
  if (msgs.length !== 1 || msg === undefined) throw new Error(`esperava uma mensagem para ${clientId}, veio ${JSON.stringify(msgs.map((m) => m.type))}`)
  return msg
}

function snapshotDe(r: HostResult, clientId: string): Snapshot {
  const msg = para(r, clientId)
  if (msg.type !== 'snapshot') throw new Error(`esperava snapshot, veio ${msg.type}`)
  return msg
}

/** A tela de um snapshot como o `contentOf` do host a monta, com o terreno alto. */
function telaDe(snap: Snapshot): PlayerViewContent {
  const tela: PlayerViewContent = {
    map: snap.map,
    vision: snap.vision,
    explored: snap.explored,
    ownTokens: snap.ownTokens,
    concealed: snap.concealed,
    porAtravessar: snap.porAtravessar ?? [],
    olhares: snap.olhares ?? [],
  }
  if (snap.alto !== undefined) tela.alto = snap.alto
  return tela
}

const peloFio = (valor: unknown): unknown => JSON.parse(JSON.stringify(valor))

const idsDe = (tokens: readonly Token[] | undefined): string[] => (tokens ?? []).map((t) => t.id).sort()

describe('hostSession — terreno alto (muralha)', () => {
  it('cena SEM pisos: o snapshot do jogador sai igual ao de antes, sem `alto` nem `alturaDosPisos`', () => {
    // O mesmo reino achatado num piso só, e com uma `alturaDosPisos` esquecida no arquivo: nada disso viaja.
    const semPisos: MapData = {
      ...createEmptyMap('plano', 'Plano', 30, 30, 40),
      floor: [chao('praca', 600, 600, 1200, 1200)],
      walls: [parede('muro', 900, 0, 900, 1200)],
      tokens: [ficha('lia', 600, 800), ficha('aldeao', 300, 700, { imageData: FOTO })],
      alturaDosPisos: [{ piso: 1, altura: 'alta' }],
    }
    const s = sessao()
    s.assignToken(entra(s, 'c1', 'Ana', semPisos), 'lia')
    const snap = snapshotDe(s.broadcast(semPisos), 'c1')
    expect(snap.alto).toBeUndefined()
    expect('alto' in snap).toBe(false)
    expect(JSON.stringify(snap)).not.toContain('alturaDosPisos')
    // A mesma cena sem a lista esquecida dá o MESMO recorte, byte a byte (fora o `rev`).
    const s2 = sessao()
    const { alturaDosPisos: _esquecida, ...limpo } = semPisos
    s2.assignToken(entra(s2, 'c1', 'Ana', limpo), 'lia')
    const snapLimpo = snapshotDe(s2.broadcast(limpo), 'c1')
    expect(JSON.stringify({ ...snap, rev: 0 })).toBe(JSON.stringify({ ...snapLimpo, rev: 0 }))
  })

  it('de cima da muralha: vê o reino com as fichas na visão, sem a oculta, sem o que a parede de cima tapa e sem o que a passarela cobre; a altura vem do piso dele', () => {
    const s = sessao()
    const map = reino()
    s.assignToken(entra(s, 'c2', 'Bia', map), 'guarda')
    const snap = snapshotDe(s.broadcast(map), 'c2')
    const abaixo = snap.alto?.abaixo
    expect(abaixo?.altura).toBe('media')
    expect(idsDe(abaixo?.map.tokens)).toEqual(['aldeao', 'lia'])
    // O chão e a parede DELE não vão no piso de baixo; o mapa de cima não leva o reino.
    expect(JSON.stringify(abaixo?.map)).not.toContain('"id":"passarela"')
    expect(idsDe(snap.map.tokens)).toEqual(['guarda'])

    const alta = reino({ alturaDosPisos: [{ piso: 1, altura: 'alta' }] })
    const s2 = sessao()
    s2.assignToken(entra(s2, 'c2', 'Bia', alta), 'guarda')
    const snapAlta = snapshotDe(s2.broadcast(alta), 'c2')
    expect(snapAlta.alto?.abaixo?.altura).toBe('alta')
    expect(JSON.stringify(snapAlta)).not.toContain('alturaDosPisos')
  })

  it('de baixo: vê o guarda na muralha (sem o chão dela); debaixo da torre, não', () => {
    const s = sessao()
    const map = reino()
    s.assignToken(entra(s, 'c1', 'Ana', map), 'lia')
    const snap = snapshotDe(s.broadcast(map), 'c1')
    expect(idsDe(snap.alto?.acima)).toEqual(['guarda'])
    expect(snap.alto?.abaixo).toBeUndefined()
    // O chão da muralha (passarela, torre) não vem: nem no mapa dele, nem em lugar nenhum do pacote.
    const texto = JSON.stringify(snap)
    expect(texto).not.toContain('"id":"passarela"')
    expect(texto).not.toContain('"id":"torre"')

    const naTorre = reino({}, { x: 600, y: 500 })
    const s2 = sessao()
    s2.assignToken(entra(s2, 'c1', 'Ana', naTorre), 'lia')
    expect(snapshotDe(s2.broadcast(naTorre), 'c1').alto).toBeUndefined()
  })

  it('o aldeão anda lá embaixo: quem está na muralha recebe patch com o x dele, sem foto, e a tela montada é a do snapshot inteiro', () => {
    const comPatch = sessao()
    const semPatch = sessao()
    const antes = reino()
    comPatch.assignToken(entra(comPatch, 'c2', 'Bia', antes, true), 'guarda')
    semPatch.assignToken(entra(semPatch, 'c2', 'Bia', antes), 'guarda')
    const primeiro = snapshotDe(comPatch.broadcast(antes), 'c2')
    semPatch.broadcast(antes)
    expect(JSON.stringify(primeiro.alto)).toContain('data:image')

    const depois = reino({}, {}, { x: 340 })
    const msg = para(comPatch.broadcast(depois), 'c2')
    if (msg.type !== 'patch') throw new Error(`esperava patch, veio ${msg.type}`)
    const patch: Patch = msg
    expect(patch.alto?.inteiro).toBeUndefined()
    expect(patch.alto?.mapaDeBaixo?.tokens?.change).toEqual([{ id: 'aldeao', set: { x: 340 } }])
    expect(JSON.stringify(patch)).not.toContain('data:image')
    const montada = applyViewPatch(telaDe(primeiro), patch)
    expect(peloFio(montada)).toEqual(peloFio(telaDe(snapshotDe(semPatch.broadcast(depois), 'c2'))))
  })
})
