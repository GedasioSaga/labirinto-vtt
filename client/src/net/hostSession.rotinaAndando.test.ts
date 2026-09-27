/**
 * ROTINA ANDANDO pela rede. A Gabi enxerga a Capela inteira; o Irmão Tobias
 * anda sozinho, passo a passo, do posto da Aurora até o da Brasa, que fica
 * dentro da "Cripta Secreta 99", uma zona oculta. A cada passo o host manda o
 * snapshot de sempre: a Gabi recebe o Tobias no lugar em que ele está AGORA,
 * com as mesmas chaves de uma ficha parada, e nada do relógio (destino, espera,
 * rotina, estado, turno), da zona nem do posto escondido.
 */
import { describe, expect, it } from 'vitest'
import type { EstadoDoMundo } from '../lib/estadoDoMundo'
import { createEmptyMap } from '../lib/mapFactory'
import { darPassoDaRotina, ligarRotina, PASSO_DA_ROTINA_MS, type RotinasAndando } from '../lib/rotinaAndando'
import { moverNaCena } from '../lib/rotinaDoNpc'
import type { ConcealZone, MapData, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'ANDA01'
const APITO = 'estado_apito_secreto'
const ESTADOS: EstadoDoMundo[] = [{ id: APITO, nome: 'Apito', valores: ['AuroraSecreta', 'BrasaSecreta'], atual: 'AuroraSecreta' }]
/** Visão que cobre a Capela toda: só a zona esconde o Tobias. */
const VISAO_TOTAL = 2000
/** Ida da Aurora (200) à Brasa (1200), a volta e mais uns passos. */
const TIQUES = 180

const tobias: Token = {
  id: 'tobias',
  characterId: null,
  name: 'Irmão Tobias',
  x: 200,
  y: 100,
  size: 1,
  image: null,
  npc: true,
  rotina: {
    estadoId: APITO,
    postos: [
      { valor: 'AuroraSecreta', sceneId: 's-capela', x: 200, y: 100 },
      { valor: 'BrasaSecreta', sceneId: 's-capela', x: 1200, y: 100 },
    ],
  },
}
/** Ficha parada sem rotina: o molde do que um NPC leva ao jogador. */
const guarda: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 300, y: 300, size: 1, image: null, npc: true }
const gabi: Token = { id: 'gabi', characterId: null, name: 'Gabi', x: 100, y: 100, size: 1, image: null }
const cripta: ConcealZone = {
  id: 'zona_cripta_secreta',
  name: 'Cripta Secreta 99',
  revealed: false,
  points: [
    { x: 800, y: 0 },
    { x: 1400, y: 0 },
    { x: 1400, y: 500 },
    { x: 800, y: 500 },
  ],
}

function capela(tokens: Token[]): MapData {
  return { ...createEmptyMap('m-capela', 'Capela', 30, 10, 50), tokens, concealZones: [cripta] }
}

function mesaCom(world: HostWorld) {
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: VISAO_TOTAL, now: () => 0, randomId: () => `id-${(n += 1)}` })
  const welcome = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Gabi' }, world).outbound[0]?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, 'gabi')
  return s
}

function snapshotDa(r: HostResult) {
  const msg = r.outbound.find((o) => o.clientId === 'c1' && o.msg.type === 'snapshot')?.msg
  return msg?.type === 'snapshot' ? msg : undefined
}

/** Um tique do relógio aplicado ao mundo do host, como o editor aplica (`useRotinaAndandoStore.darPasso`). */
function tique(world: HostWorld, andando: RotinasAndando, now: number): { world: HostWorld; andando: RotinasAndando } {
  const cenas = [{ sceneId: world.open.sceneId ?? '', map: world.open.map }]
  const passo = darPassoDaRotina(cenas, andando, ESTADOS, now)
  return { world: { ...world, open: { ...world.open, map: moverNaCena(world.open.map, passo.movimentos) } }, andando: passo.andando }
}

function tobiasNoHost(world: HostWorld): Token {
  const achado = world.open.map.tokens.find((t) => t.id === 'tobias')
  if (achado === undefined) throw new Error('o Tobias sumiu do host')
  return achado
}

describe('hostSession: a rotina andando só leva ao jogador a ficha onde ela está', () => {
  it('passo a passo, ida e volta: posição de agora, chaves de ficha parada, nada do relógio, da zona ou do posto', () => {
    let world: HostWorld = { open: { sceneId: 's-capela', name: 'Capela', map: capela([gabi, guarda, tobias]) }, background: [] }
    const s = mesaCom(world)
    let andando = ligarRotina(new Map(), [{ sceneId: 's-capela', map: world.open.map }], 'tobias', ESTADOS, 0)
    const vistos = new Set<number>()
    let escondidos = 0
    let foiNaCripta = false

    for (let i = 1; i <= TIQUES; i += 1) {
      const agora = i * PASSO_DA_ROTINA_MS
      ;({ world, andando } = tique(world, andando, agora))
      const noHost = tobiasNoHost(world)
      const r = s.broadcast(world)

      const texto = JSON.stringify(r.outbound.filter((o) => o.clientId === 'c1'))
      for (const segredo of ['rotina', 'destino', 'esperaAte', APITO, 'AuroraSecreta', 'BrasaSecreta', 'Cripta Secreta 99', 'zona_cripta_secreta']) {
        expect(texto, `tique ${i}`).not.toContain(segredo)
      }

      const snap = snapshotDa(r)
      if (snap === undefined) continue
      const visto = snap.map.tokens.find((t) => t.id === 'tobias')
      const naCripta = noHost.x >= 800 && noHost.x <= 1400
      foiNaCripta ||= naCripta
      if (naCripta) {
        // Dentro da zona oculta o Tobias não chega ao jogador, nem o posto da Brasa.
        expect(visto, `tique ${i}: Tobias em ${noHost.x}`).toBeUndefined()
        escondidos += 1
      } else {
        // Fora dela, só o lugar de agora: nunca o próximo passo nem o posto.
        expect(visto, `tique ${i}`).toEqual(expect.objectContaining({ x: noHost.x, y: noHost.y }))
        const molde = snap.map.tokens.find((t) => t.id === 'guarda')
        expect(Object.keys(visto ?? {}).sort()).toEqual(Object.keys(molde ?? {}).sort())
        vistos.add(noHost.x)
      }
      expect(snap.map.tokens.some((t) => t.x === 1200 && t.y === 100)).toBe(false)
    }

    // O loop andou de verdade: foi à cripta, sumiu lá dentro e voltou à vista em vários pontos.
    expect(foiNaCripta).toBe(true)
    expect(escondidos).toBeGreaterThan(0)
    expect(vistos.size).toBeGreaterThan(20)
    expect(andando.has('tobias')).toBe(true)
  })
})
