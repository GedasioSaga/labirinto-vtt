/**
 * BARRA DE VIDA — o que sai pelo FIO (fatia 10). A vida vem da ficha do
 * sistema ligada ao token; a sessão do host inteira: a jogadora entra, recebe
 * a ficha dela, e o `broadcast` manda a cena. Ela vê a barra da ficha de
 * jogador (só a proporção) e não vê a do NPC — nem como número solto. O dano
 * que ela digita na própria ficha muda a barra no próximo snapshot.
 */
import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { personagemDoArquivo, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import type { Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

const CODE = 'VIDA01'
const HEROI = 'tok-lu'
const MONSTRO = 'tok-og'
const OCULTA = { atual: 173, maximo: 419 }

function personagem(id: string, tipo: 'jogador' | 'npc', atual: number, maximo: number): Personagem {
  const lido = personagemDoArquivo({ id, tipo, nome: id, recursos: { hp: atual }, maximos: { hp: maximo } })
  if (lido === null) throw new Error(`personagem ${id} inválido`)
  return lido
}

function ficha(id: string, x: number, characterId: string | null): Token {
  return { id, characterId, name: id, x, y: 300, size: 1, image: null }
}

/** A mesa: Lu (ficha de jogador, 6/10) é da Ana; Og (NPC, 173/419) está na visão dela. */
function mesa(ligado = true) {
  const tokens = [ficha(HEROI, 400, ligado ? 'p-lu' : null), ficha(MONSTRO, 550, ligado ? 'p-og' : null)]
  let personagens: readonly Personagem[] = [personagem('p-lu', 'jogador', 6, 10), personagem('p-og', 'npc', OCULTA.atual, OCULTA.maximo)]
  const mundo = (): HostWorld => ({
    open: { sceneId: 'cena-1', name: 'Sala do Ogro', map: { ...createEmptyMap('m-vida', 'Sala do Ogro', 20, 12, 50), tokens } },
    background: [],
    rpg: { sistema: SISTEMA_ONE_PIECE, personagens },
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 700, now: () => 1_000, randomId: () => `id-${(n += 1)}` })
  const entrou = s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, mundo())
  const welcome = entrou.outbound.find((o) => o.msg.type === 'welcome')?.msg
  if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
  s.assignToken(welcome.playerId, HEROI)
  /** A jogadora digita na própria ficha; o integrador grava o que voltou aceito (como o `hostBridge`). */
  const ajustar = (valor: number): HostResult => {
    const r = s.handleMessage('c1', { type: 'personagem.ajustar', reqId: `a${valor}`, personagemId: 'p-lu', ajustes: [{ parte: 'recurso', chave: 'hp', valor }] }, mundo())
    const aplicado = r.applyPersonagem
    if (aplicado !== undefined) personagens = personagens.map((p) => (p.id === aplicado.personagem.id ? aplicado.personagem : p))
    return r
  }
  return { broadcast: () => s.broadcast(mundo()), ajustar }
}

/** Os frames que a jogadora recebeu, como texto — o que o fio entrega. */
function framesPara(r: HostResult, clientId: string): string[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => JSON.stringify(o.msg))
}

/** Mesma varredura da régua: objeto que fala do monstro e carrega 173 ou 419. */
function vazou(frames: string[]): boolean {
  const proibidos = new Set([OCULTA.atual, OCULTA.maximo])
  const temNumero = (v: unknown): boolean => {
    if (typeof v === 'number') return proibidos.has(v)
    if (typeof v === 'string') return proibidos.has(Number(v))
    if (Array.isArray(v)) return v.some(temNumero)
    if (v !== null && typeof v === 'object') return Object.values(v).some(temNumero)
    return false
  }
  const procurar = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.some(procurar)
    if (v === null || typeof v !== 'object') return false
    const valores: unknown[] = Object.values(v)
    if (valores.some((x) => x === MONSTRO) && temNumero(v)) return true
    return valores.some(procurar)
  }
  return frames.some((f) => procurar(JSON.parse(f)))
}

function tokenNoSnapshot(r: HostResult, id: string): Token | undefined {
  for (const o of r.outbound) if (o.clientId === 'c1' && o.msg.type === 'snapshot') return o.msg.map.tokens.find((t) => t.id === id)
  return undefined
}

describe('broadcast da cena com a barra de vida da ficha do sistema', () => {
  it('a barra do NPC não viaja; a da ficha de jogador chega como proporção', () => {
    const r = mesa().broadcast()
    expect(tokenNoSnapshot(r, MONSTRO), 'Og está na visão da Ana: a ficha dele tem de chegar').toBeDefined()
    expect(tokenNoSnapshot(r, MONSTRO)?.health).toBeUndefined()
    expect(vazou(framesPara(r, 'c1'))).toBe(false)
    expect(tokenNoSnapshot(r, HEROI)?.health).toEqual({ current: 60, max: 100, shownToPlayers: true })
  })

  it('dano digitado pela sala: a Ana tira 4 da própria ficha e o snapshot seguinte já leva a barra menor', () => {
    const t = mesa()
    t.broadcast()
    const r = t.ajustar(2)
    expect(r.applyPersonagem?.personagem.recursos.hp, 'o host deveria aceitar o ajuste da dona da ficha').toBe(2)
    expect(tokenNoSnapshot(t.broadcast(), HEROI)?.health).toEqual({ current: 20, max: 100, shownToPlayers: true })
  })

  it('sem ficha ligada, nenhum token sai com barra', () => {
    const r = mesa(false).broadcast()
    expect(tokenNoSnapshot(r, HEROI)?.health).toBeUndefined()
    expect(tokenNoSnapshot(r, MONSTRO)?.health).toBeUndefined()
  })
})
