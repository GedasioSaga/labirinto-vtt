import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { pinCardForPlayer } from '../lib/fogFilter'
import type { MapData, Pin, Region, Token } from '../types/map'
import { createHostSession, type HostResult, type HostWorld } from './hostSession'

/**
 * "MOSTRAR AGORA A…" no host: o mestre entrega a pista na hora, mesmo com o
 * jogador longe do pino. Só o escolhido recebe o cartão (`pin.show`); quem
 * está na mesma sala não recebe nada. O cartão passa pelo recorte
 * (`pinCardForPlayer`): sem posição, sem destino, sem campo do mestre, e
 * imagem só em data URL. Pino de outra cena, oculto ou de viagem não sai.
 */

const CODE = 'AB12CD'
const RADIUS = 700
const SALAO = 'cena-salao'
const CRIPTA = 'cena-cripta'
const TEXTO_DA_CARTA = 'Carta rasgada: encontre-me na capela'
const TEXTO_DA_CRIPTA = 'Inscrição na lápide da cripta'
const FOTO = 'data:image/png;base64,AAAA'

function token(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

/** Carta "só de perto" (1 casa) e longe de todo mundo: sem o "Mostrar agora", ninguém leria. */
const CARTA: Pin = { id: 'carta', x: 1900, y: 450, kind: 'exclamacao', description: TEXTO_DA_CARTA, image: FOTO, lerDePerto: 1, marco: true, icon: 'chave' }
const SEGREDO: Pin = { id: 'segredo', x: 300, y: 200, kind: 'interrogacao', description: 'Só o mestre sabe', image: null, secret: true }
const ALCAPAO: Pin = { id: 'alcapao', x: 400, y: 200, kind: 'viagem', description: 'Alçapão', image: null, destino: { sceneId: CRIPTA, pinId: 'fundo' }, passagem: 'livre' }

function salao(): MapData {
  return {
    ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
    tokens: [token('ficha-gabi', 200, 200), token('ficha-diego', 250, 200)],
    pins: [CARTA, SEGREDO, ALCAPAO],
  }
}

function mundo(): HostWorld {
  return {
    open: { sceneId: SALAO, name: 'Salão', map: salao() },
    background: [
      {
        sceneId: CRIPTA,
        name: 'Cripta',
        map: {
          ...createEmptyMap('mapa-cripta', 'Cripta', 40, 10, 50),
          tokens: [token('ficha-rui', 300, 300)],
          pins: [
            { id: 'fundo', x: 1000, y: 250, kind: 'viagem', description: 'Fundo', image: null, destino: { sceneId: SALAO, pinId: 'alcapao' } },
            { id: 'lapide', x: 500, y: 250, kind: 'exclamacao', description: TEXTO_DA_CRIPTA, image: null },
          ],
        },
      },
    ],
  }
}

function welcomeOf(result: HostResult): string {
  const first = result.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

function mesa() {
  let n = 0
  const w = mundo()
  const s = createHostSession({
    code: CODE,
    visionRadius: RADIUS,
    now: () => 1_000_000,
    randomId: () => {
      n += 1
      return `id-${n}`
    },
  })
  const gabi = welcomeOf(s.handleMessage('c-gabi', { type: 'join', code: CODE, name: 'Gabi' }, w))
  const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, w))
  const rui = welcomeOf(s.handleMessage('c-rui', { type: 'join', code: CODE, name: 'Rui' }, w))
  s.assignToken(gabi, 'ficha-gabi')
  s.assignToken(diego, 'ficha-diego')
  s.assignToken(rui, 'ficha-rui')
  s.broadcast(w)
  return { s, w, gabi, diego, rui }
}

describe('hostSession: "Mostrar agora a…"', () => {
  it('"Mostrar agora a Gabi": só Gabi recebe o cartão, com o texto e a imagem, mesmo longe do pino "só de perto"', () => {
    const { s, w, gabi } = mesa()
    const r = s.showPin(gabi, 'carta', w)
    expect(r.outbound.map((o) => o.clientId)).toEqual(['c-gabi', 'c-gabi'])
    const msg = r.outbound.find((o) => o.msg.type === 'pin.show')?.msg
    if (msg?.type !== 'pin.show') throw new Error('esperava pin.show')
    expect(msg.pin).toEqual({ id: 'carta', kind: 'exclamacao', icon: 'chave', description: TEXTO_DA_CARTA, image: FOTO })
  })

  it('o cartão mostrado entra no caderno de Gabi (MINHAS PISTAS) e conta como recebido no painel Pistas', () => {
    const { s, w, gabi } = mesa()
    const r = s.showPin(gabi, 'carta', w)
    const added = r.outbound.find((o) => o.msg.type === 'clue.added')?.msg
    if (added?.type !== 'clue.added') throw new Error('esperava clue.added')
    expect(added.clue.text).toBe(TEXTO_DA_CARTA)
    expect(added.clue.image).toBe(FOTO)
    expect(s.pinClues().carta?.received).toEqual([gabi])
  })

  it('Diego, na mesma sala, não recebe nada: nem o cartão, nem o texto', () => {
    const { s, w, gabi } = mesa()
    const r = s.showPin(gabi, 'carta', w)
    const paraDiego = r.outbound.filter((o) => o.clientId === 'c-diego')
    expect(paraDiego).toEqual([])
    expect(JSON.stringify(r.outbound.filter((o) => o.clientId !== 'c-gabi'))).not.toContain(TEXTO_DA_CARTA)
  })

  it('o cartão não leva posição, destino nem regra do mestre (lerDePerto, marco)', () => {
    const { s, w, gabi } = mesa()
    const pacote = JSON.stringify(s.showPin(gabi, 'carta', w).outbound)
    expect(pacote).toContain(TEXTO_DA_CARTA)
    for (const campo of ['"x"', '"y"', 'lerDePerto', 'marco', 'destino', 'longe']) expect(pacote).not.toContain(campo)
  })

  it('pino com "Só estes": mostrar a Gabi marca Gabi em "Quem vê"; o próximo snapshot do Diego continua sem o pino', () => {
    const { s, w, gabi, diego } = mesa()
    s.setPinAudience('carta', [])
    s.showPin(gabi, 'carta', w)
    expect(s.pinAudience('carta')).toEqual([gabi])
    const r = s.broadcast(w)
    const doDiego = r.outbound.find((o) => o.clientId === 'c-diego')?.msg
    if (doDiego?.type !== 'snapshot') throw new Error('esperava snapshot do Diego')
    expect(doDiego.map.pins.map((p) => p.id)).not.toContain('carta')
    expect(s.pinAudience('carta')).not.toContain(diego)
  })

  it('pino de "Todos" continua de todos: mostrar não cria lista', () => {
    const { s, w, gabi } = mesa()
    s.showPin(gabi, 'carta', w)
    expect(s.pinAudience('carta')).toBeNull()
  })

  it('pino de OUTRA cena não sai: Rui está na Cripta e o mestre pede o pino do Salão; Gabi não recebe a lápide da Cripta', () => {
    const { s, w, gabi, rui } = mesa()
    const paraRui = s.showPin(rui, 'carta', w)
    expect(paraRui.outbound).toEqual([])
    const paraGabi = s.showPin(gabi, 'lapide', w)
    expect(paraGabi.outbound).toEqual([])
    expect(JSON.stringify(paraGabi)).not.toContain(TEXTO_DA_CRIPTA)
    // Nada disso mexe em lista nenhuma.
    expect(s.pinAudience('carta')).toBeNull()
  })

  it('pino oculto para jogadores vira cartão só quando o mestre entrega: Gabi recebe, Diego nada, e o mapa de ninguém ganha o pino', () => {
    const { s, w, gabi } = mesa()
    const r = s.showPin(gabi, 'segredo', w)
    expect(r.outbound.map((o) => o.clientId)).toEqual(['c-gabi', 'c-gabi'])
    expect(JSON.stringify(r.outbound)).toContain('Só o mestre sabe')
    for (const o of s.broadcast(w).outbound) {
      if (o.msg.type === 'snapshot') expect(o.msg.map.pins.map((p) => p.id)).not.toContain('segredo')
    }
  })

  it('pino de viagem, alavanca e id inventado não viram cartão', () => {
    const { s, w, gabi } = mesa()
    w.open.map.pins.push({ id: 'alavanca', x: 220, y: 200, kind: 'alavanca', description: 'Alavanca', image: null })
    expect(s.showPin(gabi, 'alavanca', w).outbound).toEqual([])
    expect(s.showPin(gabi, 'alcapao', w).outbound).toEqual([])
    expect(s.showPin(gabi, 'inventado', w).outbound).toEqual([])
    expect(s.showPin('jogador-inventado', 'carta', w).outbound).toEqual([])
  })

  it('jogador desconectado não recebe (e não ganha lugar na lista)', () => {
    const { s, w, gabi } = mesa()
    s.setPinAudience('carta', [])
    s.disconnect('c-gabi')
    expect(s.showPin(gabi, 'carta', w).outbound).toEqual([])
    expect(s.pinAudience('carta')).toEqual([])
  })
})

/**
 * JUNTO COM A VISÃO POR CENA: na mina a cena enxerga 2 casas. O bilhete está
 * a 5 casas da Gabi — dentro do raio global de 700 px, fora do da mina. O
 * cartão chega do mesmo jeito (mostrar é entregar de propósito), mas o pino
 * só entra no mapa dela quando o raio DELA, cena x fator, alcança.
 */
describe('hostSession: "Mostrar agora a…" numa cena com visão própria', () => {
  const CASA = 64
  const CENTRO = 30 * CASA
  const BILHETE: Pin = { id: 'bilhete', x: CENTRO + 5 * CASA, y: CENTRO, kind: 'interrogacao', description: 'Bilhete sob a pedra', image: null }

  function mina(): MapData {
    return {
      ...createEmptyMap('mapa-mina', 'Mina', 60, 60, CASA),
      visionCells: 2,
      tokens: [token('ficha-gabi', CENTRO, CENTRO), token('ficha-diego', CENTRO, CENTRO - CASA)],
      pins: [BILHETE],
    }
  }

  function mesaNaMina() {
    let n = 0
    const w: HostWorld = { open: { sceneId: 'cena-mina', name: 'Mina', map: mina() }, background: [] }
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
    const gabi = welcomeOf(s.handleMessage('c-gabi', { type: 'join', code: CODE, name: 'Gabi' }, w))
    const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, w))
    s.assignToken(gabi, 'ficha-gabi')
    s.assignToken(diego, 'ficha-diego')
    return { s, w, gabi, diego }
  }

  function pinosDe(r: HostResult, clientId: string): string[] {
    const msg = r.outbound.find((o) => o.clientId === clientId && o.msg.type === 'snapshot')?.msg
    if (msg?.type !== 'snapshot') throw new Error(`esperava snapshot para ${clientId}`)
    return msg.map.pins.map((p) => p.id)
  }

  it('o cartão chega a 5 casas; o pino "Só estes" fica fora do mapa dela até o raio da mina (x fator) alcançar', () => {
    const { s, w, gabi } = mesaNaMina()
    s.setPinAudience('bilhete', [])

    const r = s.showPin(gabi, 'bilhete', w)
    // O cartão e a pista no caderno, os dois só para ela.
    expect(r.outbound.map((o) => [o.clientId, o.msg.type])).toEqual([
      ['c-gabi', 'pin.show'],
      ['c-gabi', 'clue.added'],
    ])
    expect(s.pinAudience('bilhete')).toEqual([gabi])

    // Raio da mina: 2 casas. O bilhete, a 5, não entra no mapa de ninguém.
    const antes = s.broadcast(w)
    expect(pinosDe(antes, 'c-gabi')).toEqual([])
    expect(pinosDe(antes, 'c-diego')).toEqual([])

    // Gabi com x3,0: 6 casas. Agora o bilhete está à vista dela — e só dela.
    s.setVisionFactor(gabi, 3)
    const depois = s.broadcast(w)
    expect(pinosDe(depois, 'c-gabi')).toEqual(['bilhete'])
    // A tela do Diego não mudou: o host não manda nada novo a ele, e nada com o bilhete.
    const paraDiego = depois.outbound.filter((o) => o.clientId === 'c-diego')
    expect(paraDiego.filter((o) => o.msg.type === 'snapshot')).toEqual([])
    expect(JSON.stringify(paraDiego)).not.toContain('bilhete')
  })

  it('o cartão não leva o alcance da cena nem o fator de ninguém', () => {
    const { s, w, gabi } = mesaNaMina()
    s.setVisionFactor(gabi, 1.5)
    const pacote = JSON.stringify(s.showPin(gabi, 'bilhete', w).outbound)
    expect(pacote).toContain('Bilhete sob a pedra')
    for (const campo of ['visionCells', 'visionFactor', 'sceneVisionCells']) expect(pacote).not.toContain(campo)
  })
})

describe('pinCardForPlayer', () => {
  it('lista do que vai: só id, tipo, símbolo, texto e imagem segura', () => {
    expect(pinCardForPlayer({ ...CARTA, image: 'C:/mestre/segredos/carta.png', hidden: true, locked: true })).toEqual({
      id: 'carta',
      kind: 'exclamacao',
      icon: 'chave',
      description: TEXTO_DA_CARTA,
      image: null,
    })
    expect(pinCardForPlayer({ id: 'p', x: 1, y: 2, kind: 'interrogacao', description: '', image: null })).toEqual({
      id: 'p',
      kind: 'interrogacao',
      description: '',
      image: null,
    })
  })

  it('viagem, chegada oculta e alavanca: nada; oculto sai (mostrar é o mestre entregando)', () => {
    expect(pinCardForPlayer(ALCAPAO)).toBeNull()
    expect(pinCardForPlayer({ ...ALCAPAO, soChegada: true })).toBeNull()
    expect(pinCardForPlayer({ id: 'a', x: 1, y: 1, kind: 'alavanca', description: 'Alavanca', image: null })).toBeNull()
    expect(pinCardForPlayer(SEGREDO)).toEqual({ id: 'segredo', kind: 'interrogacao', description: 'Só o mestre sabe', image: null })
  })

  it('nome e nota do mestre, item e ícone desconhecido nunca vão', () => {
    const card = pinCardForPlayer({ ...CARTA, nome: 'Carta do mordomo', notaDoMestre: 'é falsa', item: { nome: 'Carta' }, icon: 'inventado' as never }) // as never: arquivo editado à mão com símbolo desconhecido, que o tipo não deixa escrever
    expect(card).toEqual({ id: 'carta', kind: 'exclamacao', description: TEXTO_DA_CARTA, image: FOTO })
  })
})

/**
 * REVISTAR + "ENTREGAR PISTA…": o pedido de Revistar de Gabi numa sala leva ao
 * MESTRE (nunca a jogador) os pinos ocultos da sala onde ela tocou, pelo nome
 * que o mestre deu. Entregar um deles é o mesmo "Mostrar agora": só Gabi
 * recebe a carta.
 */
describe('hostSession: Revistar lista as pistas ocultas da sala', () => {
  const ESCRITORIO: Region = {
    id: 'escritorio',
    points: [
      { x: 100, y: 100 },
      { x: 600, y: 100 },
      { x: 600, y: 400 },
      { x: 100, y: 400 },
    ],
    tag: '',
    fillColor: '#333333',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'rect', name: 'Escritório' },
  }
  const CARTA_OCULTA: Pin = { id: 'carta-oculta', x: 500, y: 300, kind: 'exclamacao', nome: 'Carta', description: 'Querido irmão, o cofre fica atrás do quadro.', image: null, secret: true }
  const DIARIO: Pin = { id: 'diario', x: 450, y: 300, kind: 'interrogacao', description: 'Diário\nPáginas arrancadas.', image: null, secret: true }
  const VISIVEL: Pin = { id: 'visivel', x: 300, y: 300, kind: 'exclamacao', description: 'Mesa', image: null }
  const FORA: Pin = { id: 'fora', x: 900, y: 300, kind: 'exclamacao', description: 'Longe da sala', image: null, secret: true }

  function mesaNoEscritorio() {
    let n = 0
    const w: HostWorld = {
      open: {
        sceneId: SALAO,
        name: 'Salão',
        map: {
          ...createEmptyMap('mapa-salao', 'Salão', 40, 10, 50),
          regions: [ESCRITORIO],
          tokens: [token('ficha-gabi', 200, 200), token('ficha-diego', 250, 200)],
          pins: [CARTA_OCULTA, DIARIO, VISIVEL, FORA],
        },
      },
      background: [],
    }
    const s = createHostSession({ code: CODE, visionRadius: RADIUS, now: () => 1_000_000, randomId: () => `id-${(n += 1)}` })
    const gabi = welcomeOf(s.handleMessage('c-gabi', { type: 'join', code: CODE, name: 'Gabi' }, w))
    const diego = welcomeOf(s.handleMessage('c-diego', { type: 'join', code: CODE, name: 'Diego' }, w))
    s.assignToken(gabi, 'ficha-gabi')
    s.assignToken(diego, 'ficha-diego')
    s.broadcast(w)
    return { s, w, gabi, diego }
  }

  it('Revistar no Escritório: o mestre lê as pistas ocultas da sala (Carta, Diário); nada vai a jogador', () => {
    const { s, w } = mesaNoEscritorio()
    const r = s.handleMessage('c-gabi', { type: 'point.action', action: 'revistar', x: 200, y: 200 }, w)
    expect(r.outbound).toEqual([])
    expect(r.pointAction?.pistas).toEqual([
      { pinId: 'carta-oculta', label: 'Carta' },
      { pinId: 'diario', label: 'Diário' },
    ])
  })

  it('Procurar, e Revistar fora de sala com nome, não listam pista nenhuma', () => {
    const { s, w } = mesaNoEscritorio()
    const procurar = s.handleMessage('c-gabi', { type: 'point.action', action: 'procurar', x: 200, y: 200 }, w)
    expect(procurar.pointAction?.action).toBe('procurar')
    expect(procurar.pointAction?.pistas).toBeUndefined()
    const fora = s.handleMessage('c-diego', { type: 'point.action', action: 'revistar', x: 900, y: 200 }, w)
    expect(fora.pointAction?.action).toBe('revistar')
    expect(fora.pointAction?.pistas).toBeUndefined()
  })

  it('"Entregar pista… > Carta": só Gabi recebe a carta; Diego não recebe o texto', () => {
    const { s, w, gabi } = mesaNoEscritorio()
    const r = s.showPin(gabi, 'carta-oculta', w)
    expect(r.outbound.map((o) => o.clientId)).toEqual(['c-gabi', 'c-gabi'])
    const show = r.outbound.find((o) => o.msg.type === 'pin.show')?.msg
    if (show?.type !== 'pin.show') throw new Error('esperava pin.show')
    expect(show.pin.description).toBe('Querido irmão, o cofre fica atrás do quadro.')
    // O nome do mestre ("Carta") não vai no cartão.
    expect(JSON.stringify(show)).not.toContain('"nome"')
    const depois = s.broadcast(w)
    expect(JSON.stringify(depois.outbound.filter((o) => o.clientId === 'c-diego'))).not.toContain('cofre fica atrás do quadro')
  })
})
