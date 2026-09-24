import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import type { MapData, Pin, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'
import type { HostMessage } from './protocol'

/**
 * PINO SÓ DE PERTO no host: a carta "ler a 1 casa" vai no pacote da Ana como
 * pino, mas o texto só atravessa a rede quando a ficha dela chega ao lado da
 * mesa. O pacote de antes (na porta) não leva a descrição, e o "Revelar
 * planta" do mestre não entrega as pistas da cena. O Templo marco chega a quem
 * nunca foi lá.
 */

const CODE = 'AB12CD'
const RADIUS = 300
const CENA = 'cena-taverna'
const TEXTO_DA_CARTA = 'Encontrem-me no cais ao anoitecer'
const TEXTO_DO_TEMPLO = 'Templo de Pelor, portas de bronze'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

const CARTA: Pin = { id: 'carta', x: 400, y: 200, kind: 'interrogacao', description: TEXTO_DA_CARTA, image: null, lerDePerto: 1 }
/** Outra pista "só de perto", no fundo do mapa, que só o "Revelar planta" alcançaria. */
const DIARIO: Pin = { id: 'diario', x: 1800, y: 1800, kind: 'exclamacao', description: 'Diário do capitão', image: null, lerDePerto: 1 }
const TEMPLO: Pin = { id: 'templo', x: 1500, y: 300, kind: 'exclamacao', description: TEXTO_DO_TEMPLO, image: null, marco: true }

function taverna(anaX: number, anaY: number): MapData {
  return {
    ...createEmptyMap('mapa-taverna', 'Taverna', 2000, 2000, 50),
    tokens: [token('ficha-ana', anaX, anaY)],
    pins: [CARTA, DIARIO, TEMPLO],
  }
}

const mundo = (anaX: number, anaY: number): HostWorld => ({ open: { sceneId: CENA, name: 'Taverna', map: taverna(anaX, anaY) }, background: [] })

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function pinosDa(result: HostResult): Pin[] {
  const msg: HostMessage | undefined = result.outbound.find((o) => o.clientId === 'c-ana')?.msg
  if (msg?.type !== 'snapshot') throw new Error('esperava snapshot para a Ana')
  return msg.map.pins
}

const pacoteDa = (result: HostResult): string => JSON.stringify(result.outbound.filter((o) => o.clientId === 'c-ana'))

function mesa() {
  let n = 0
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const ana = welcomeOf(s.handleMessage('c-ana', { type: 'join', code: CODE, name: 'Ana' }, mundo(200, 200)))
  s.assignToken(ana, 'ficha-ana')
  return { s, ana }
}

describe('hostSession: pino só de perto e pino marco', () => {
  it('Ana na porta: a carta chega marcada longe e o pacote NÃO leva o texto', () => {
    const { s } = mesa()
    const r = s.broadcast(mundo(200, 200))
    expect(pinosDa(r).find((p) => p.id === 'carta')).toMatchObject({ description: '', longe: true })
    expect(pacoteDa(r)).not.toContain(TEXTO_DA_CARTA)
  })

  it('Ana anda até o lado da mesa: o próximo pacote já leva o texto; ao se afastar, o texto sai de novo', () => {
    const { s } = mesa()
    expect(pacoteDa(s.broadcast(mundo(200, 200)))).not.toContain(TEXTO_DA_CARTA)
    const aoLado = s.broadcast(mundo(350, 200))
    expect(pinosDa(aoLado).find((p) => p.id === 'carta')?.description).toBe(TEXTO_DA_CARTA)
    const deVolta = s.broadcast(mundo(200, 200))
    expect(pacoteDa(deVolta)).not.toContain(TEXTO_DA_CARTA)
  })

  it('"Revelar planta" não entrega as pistas da cena: a carta e o diário aparecem sem texto', () => {
    const { s, ana } = mesa()
    const w = mundo(200, 200)
    s.broadcast(w)
    s.revealPlan(ana, w)
    const r = s.broadcast(w)
    const pinos = pinosDa(r)
    expect(pinos.find((p) => p.id === 'diario')).toMatchObject({ description: '', longe: true })
    expect(pacoteDa(r)).not.toContain('Diário do capitão')
    expect(pacoteDa(r)).not.toContain(TEXTO_DA_CARTA)
  })

  it('Templo marco: chega à Ana, que nunca foi lá, com o texto', () => {
    const { s } = mesa()
    const templo = pinosDa(s.broadcast(mundo(200, 200))).find((p) => p.id === 'templo')
    expect(templo?.description).toBe(TEXTO_DO_TEMPLO)
  })
})
