/**
 * "ONDE ESTOU": o mestre pode dar a cada cena um nome para os jogadores. O
 * snapshot de quem está numa cena com nome público leva `sceneName` com ESSE
 * nome, e só o da cena onde ele está. Cena sem nome público: o campo nem
 * existe. O nome interno (o que o mestre lê na lista de cenas) nunca viaja.
 *
 * Aceite do backlog (mansão): '1º andar' preenchido, Porão vazio — o selo
 * muda Térreo / 1º andar e some no Porão; nenhum pacote traz nome interno.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostScene, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

const CODE = 'AB12CD'

const INTERNOS = ['Terreo do cofre', 'Andar do vilao', 'Porao do culto']

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, tokens: Token[]): MapData {
  // O nome do MAPA é o nome interno da cena, como a aventura cria.
  return { ...createEmptyMap(id, INTERNOS[['m-t', 'm-1', 'm-p'].indexOf(id)] ?? id, 30, 10, 50), tokens }
}

/** A mansão com cada ficha na cena pedida (`t` térreo, `1` primeiro andar, `p` porão). */
function mansao(onde: Record<string, 't' | '1' | 'p'>, porao: { publicName?: string } = {}): HostWorld {
  const fichasEm = (cena: 't' | '1' | 'p') =>
    Object.entries(onde)
      .filter(([, lugar]) => lugar === cena)
      .map(([id]) => ficha(id, 100, 100))
  const terreo: HostScene = { sceneId: 's-t', name: 'Terreo do cofre', publicName: 'Térreo', map: mapa('m-t', fichasEm('t')) }
  const andar: HostScene = { sceneId: 's-1', name: 'Andar do vilao', publicName: '1º andar', map: mapa('m-1', fichasEm('1')) }
  const poraoCena: HostScene = { sceneId: 's-p', name: 'Porao do culto', ...porao, map: mapa('m-p', fichasEm('p')) }
  return { open: terreo, background: [andar, poraoCena] }
}

function mesa(world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const entra = (clientId: string, nome: string, tokenId: string): string => {
    const r = s.handleMessage(clientId, { type: 'join', code: CODE, name: nome }, world)
    const welcome = r.outbound[0]?.msg
    if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
    s.assignToken(welcome.playerId, tokenId)
    return welcome.playerId
  }
  entra('c-ana', 'Ana', 'ana')
  entra('c-bia', 'Bia', 'bia')
  return s
}

function snapshotDe(r: HostResult, clientId: string): Extract<HostMessage, { type: 'snapshot' }> {
  const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
  if (msg?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return msg
}

function fio(r: HostResult): string {
  return JSON.stringify(r.outbound)
}

describe('nome da cena para o jogador', () => {
  it('cada jogador recebe só o nome público da cena onde ELE está', () => {
    const s = mesa(mansao({ ana: 't', bia: '1' }))
    const r = s.broadcast(mansao({ ana: 't', bia: '1' }))
    expect(snapshotDe(r, 'c-ana').sceneName).toBe('Térreo')
    expect(snapshotDe(r, 'c-bia').sceneName).toBe('1º andar')
    // O nome da outra cena não chega a quem não está lá.
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-ana'))).not.toContain('1º andar')
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId === 'c-bia'))).not.toContain('Térreo')
  })

  it('o selo acompanha a ficha: Térreo, 1º andar e some no Porão sem nome público', () => {
    const s = mesa(mansao({ ana: 't', bia: 't' }))
    expect(snapshotDe(s.broadcast(mansao({ ana: 't', bia: 't' })), 'c-ana').sceneName).toBe('Térreo')

    const noAndar = snapshotDe(s.broadcast(mansao({ ana: '1', bia: 't' })), 'c-ana')
    expect(noAndar.map.id).toBe('m-1')
    expect(noAndar.sceneName).toBe('1º andar')

    const noPorao = snapshotDe(s.broadcast(mansao({ ana: 'p', bia: 't' })), 'c-ana')
    expect(noPorao.map.id).toBe('m-p')
    expect('sceneName' in noPorao).toBe(false)

    // Nome público só com espaço conta como vazio: a tela da Ana sai igual à
    // do Porão sem nome (nada novo sai), e a que ela tem não traz o campo.
    const espacos = s.broadcast(mansao({ ana: 'p', bia: 't' }, { publicName: '   ' }))
    expect(espacos.outbound.filter((o) => o.clientId === 'c-ana')).toEqual([])
    expect('sceneName' in noPorao).toBe(false)
  })

  it('nenhum pacote, de ninguém, traz o nome interno de cena nenhuma', () => {
    const s = mesa(mansao({ ana: 't', bia: 'p' }))
    const pacotes = [
      s.broadcast(mansao({ ana: 't', bia: 'p' })),
      s.broadcast(mansao({ ana: '1', bia: 'p' })),
      s.broadcast(mansao({ ana: 'p', bia: '1' })),
    ]
    expect(pacotes.every((r) => r.outbound.length > 0)).toBe(true)
    for (const r of pacotes) {
      for (const interno of INTERNOS) expect(fio(r)).not.toContain(interno)
    }
  })

  it('mapa solto não tem nome de cena para o jogador', () => {
    const solto = mapa('m-t', [ficha('ana', 100, 100), ficha('bia', 200, 100)])
    const s = mesa({ open: { sceneId: null, name: 'Terreo do cofre', map: solto }, background: [] })
    const r = s.broadcast(solto)
    expect('sceneName' in snapshotDe(r, 'c-ana')).toBe(false)
    expect(fio(r)).not.toContain('Terreo do cofre')
  })
})
