import { describe, expect, it } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { adicionarMarca, MARCA_TEXTO_MAX, MARCAS_POR_JOGADOR_POR_CENA } from '../lib/marcas'
import type { MapData, MarcaNoLugar, Token } from '../types/map'
import { createHostSession, type AppliedMark, type HostResult, type HostWorld } from './hostSession'
import { parsePlayerMessage, type HostMessage } from './protocol'

/**
 * BILHETE NO LUGAR pela rede. O jogador crava um bilhete (ou risca uma seta)
 * encostado na própria ficha; o host confere e devolve `applyMark` para o
 * integrador gravar no mapa da cena. Quem mais recebe a marca é decidido pelo
 * recorte (`filterMapForPlayer`): quem passar ali depois. Quem está em OUTRA
 * cena nunca recebe nada dela, e o nome de quem deixou nunca sai.
 */

const CODE = 'MARC01'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function mapa(id: string, nome: string, tokens: Token[], marcas?: MarcaNoLugar[]): MapData {
  // 60 x 20 células de 50 px: 3000 x 1000 de mundo.
  return { ...createEmptyMap(id, nome, 60, 20, 50), tokens, ...(marcas === undefined ? {} : { marcas }) }
}

function welcome(r: HostResult): string {
  const first = r.outbound[0]?.msg
  if (first?.type !== 'welcome') throw new Error('esperava welcome')
  return first.playerId
}

/**
 * Salão (aberto) com Ana em (200, 200) e Caio em (2800, 800), longe; Cripta
 * (de fundo) com Bruno. Raio de visão 400: Caio não vê o canto de Ana.
 */
function mesa(relogio = { t: 1_000_000 }) {
  const estado = { salao: mapa('m-salao', 'Salao Norte', [ficha('lanterna', 200, 200), ficha('capa', 2800, 800)]), cripta: mapa('m-cripta', 'Cripta Rubra', [ficha('machado', 200, 200)]) }
  const mundo = (): HostWorld => ({
    open: { sceneId: 's-salao', name: 'Salao Norte', map: estado.salao },
    background: [{ sceneId: 's-cripta', name: 'Cripta Rubra', map: estado.cripta }],
  })
  let n = 0
  const s = createHostSession({ code: CODE, visionRadius: 400, now: () => relogio.t, randomId: () => `id-${(n += 1)}` })
  const ana = welcome(s.handleMessage('c1', { type: 'join', code: CODE, name: 'Ana' }, mundo()))
  const bruno = welcome(s.handleMessage('c2', { type: 'join', code: CODE, name: 'Bruno' }, mundo()))
  const caio = welcome(s.handleMessage('c3', { type: 'join', code: CODE, name: 'Caio' }, mundo()))
  s.assignToken(ana, 'lanterna')
  s.assignToken(bruno, 'machado')
  s.assignToken(caio, 'capa')
  s.broadcast(mundo())
  /** O integrador: grava a marca na cena certa, como `net/playerChanges.ts`. */
  const aplicar = (r: HostResult) => {
    const m = r.applyMark
    if (m === undefined) return
    if (m.sceneId === 's-cripta') estado.cripta = adicionarMarca(estado.cripta, m.marca)
    else estado.salao = adicionarMarca(estado.salao, m.marca)
  }
  const deixar = (clientId: string, msg: Record<string, unknown>): HostResult => s.handleMessage(clientId, { type: 'mark.place', ...msg }, mundo())
  return { s, estado, mundo, aplicar, deixar, relogio }
}

function para(r: HostResult, clientId: string): HostMessage[] {
  return r.outbound.filter((o) => o.clientId === clientId).map((o) => o.msg)
}

function marcasNoSnapshot(r: HostResult, clientId: string): MarcaNoLugar[] {
  const snap = para(r, clientId).find((m) => m.type === 'snapshot')
  if (snap?.type !== 'snapshot') throw new Error(`sem snapshot para ${clientId}`)
  return snap.map.marcas ?? []
}

describe('protocolo: mark.place', () => {
  it('bilhete: aceita texto curto, apara as pontas e devolve só os campos conhecidos', () => {
    expect(parsePlayerMessage({ type: 'mark.place', x: 10, y: 20, tipo: 'bilhete', texto: '  volto já  ', autor: 'Mestre', extra: 1 })).toEqual({
      type: 'mark.place',
      x: 10,
      y: 20,
      tipo: 'bilhete',
      texto: 'volto já',
    })
  })

  it('seta: aceita o rumo e joga fora o texto', () => {
    expect(parsePlayerMessage({ type: 'mark.place', x: 10, y: 20, tipo: 'seta', rumo: 'so', texto: 'x' })).toEqual({ type: 'mark.place', x: 10, y: 20, tipo: 'seta', rumo: 'so' })
  })

  it('recusa bilhete vazio ou acima do teto, seta sem rumo, tipo desconhecido e ponto torto', () => {
    expect(parsePlayerMessage({ type: 'mark.place', x: 1, y: 1, tipo: 'bilhete', texto: '   ' })).toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: 1, y: 1, tipo: 'bilhete', texto: 'a'.repeat(MARCA_TEXTO_MAX + 1) })).toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: 1, y: 1, tipo: 'bilhete', texto: 'a'.repeat(MARCA_TEXTO_MAX) })).not.toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: 1, y: 1, tipo: 'seta' })).toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: 1, y: 1, tipo: 'seta', rumo: 'aqui' })).toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: 1, y: 1, tipo: 'placa', texto: 'oi' })).toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: Number.NaN, y: 1, tipo: 'bilhete', texto: 'oi' })).toBeNull()
    expect(parsePlayerMessage({ type: 'mark.place', x: '1', y: 1, tipo: 'bilhete', texto: 'oi' })).toBeNull()
  })
})

describe('hostSession: bilhete no lugar', () => {
  it('bilhete encostado na ficha: vira applyMark com autor e hora (para o mestre) e "ok" para quem deixou', () => {
    const { deixar, relogio } = mesa()
    const r = deixar('c1', { x: 230, y: 200, tipo: 'bilhete', texto: 'O piso cede aqui' })
    const esperado: AppliedMark = {
      marca: { id: 'id-7', tipo: 'bilhete', x: 230, y: 200, texto: 'O piso cede aqui', autor: 'Ana', em: relogio.t },
      playerName: 'Ana',
      sceneName: 'Salao Norte',
    }
    expect(r.applyMark).toEqual(esperado)
    expect(para(r, 'c1')).toEqual([{ type: 'mark.place.result', ok: true }])
    // Ninguém mais recebe nada agora: a marca chega a eles pelo recorte do broadcast.
    expect(r.outbound.map((o) => o.clientId)).toEqual(['c1'])
  })

  it('numa cena de FUNDO, o applyMark diz a cena', () => {
    const { deixar } = mesa()
    const r = deixar('c2', { x: 200, y: 230, tipo: 'seta', rumo: 'l' })
    expect(r.applyMark?.sceneId).toBe('s-cripta')
    expect(r.applyMark?.marca).toEqual({ id: 'id-7', tipo: 'seta', x: 200, y: 230, rumo: 'l', autor: 'Bruno', em: 1_000_000 })
  })

  it('longe da própria ficha: recusa sem gravar nada', () => {
    const { deixar } = mesa()
    const r = deixar('c1', { x: 600, y: 200, tipo: 'bilhete', texto: 'longe' })
    expect(r.applyMark).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'mark.place.result', ok: false, reason: 'unavailable' }])
  })

  it('fora do mapa ou de quem ainda aguarda (sem ficha): nada', () => {
    const { s, deixar, mundo } = mesa()
    expect(deixar('c1', { x: -5, y: 200, tipo: 'bilhete', texto: 'fora' }).applyMark).toBeUndefined()
    s.handleMessage('c4', { type: 'join', code: CODE, name: 'Dora' }, mundo())
    const r = deixar('c4', { x: 200, y: 200, tipo: 'bilhete', texto: 'sem ficha' })
    expect(r.applyMark).toBeUndefined()
    expect(para(r, 'c4')).toEqual([{ type: 'mark.place.result', ok: false, reason: 'unavailable' }])
  })

  it('um bilhete por segundo por jogador: o segundo cedo demais volta too_soon', () => {
    const { deixar, relogio } = mesa()
    expect(deixar('c1', { x: 230, y: 200, tipo: 'bilhete', texto: 'um' }).applyMark?.marca.texto).toBe('um')
    const cedo = deixar('c1', { x: 230, y: 210, tipo: 'bilhete', texto: 'dois' })
    expect(cedo.applyMark).toBeUndefined()
    expect(para(cedo, 'c1')).toEqual([{ type: 'mark.place.result', ok: false, reason: 'too_soon' }])
    relogio.t += 1000
    expect(deixar('c1', { x: 230, y: 210, tipo: 'bilhete', texto: 'dois' }).applyMark?.marca.texto).toBe('dois')
  })

  it('teto por jogador por cena: cheio volta "full" e nada é gravado', () => {
    const { deixar, estado, aplicar, relogio } = mesa()
    const cheio: MarcaNoLugar[] = Array.from({ length: MARCAS_POR_JOGADOR_POR_CENA }, (_, i) => ({ id: `v${i}`, tipo: 'seta', x: 100, y: 100, rumo: 'n', autor: 'Ana', em: 0 }))
    estado.salao = { ...estado.salao, marcas: cheio }
    const r = deixar('c1', { x: 230, y: 200, tipo: 'bilhete', texto: 'mais um' })
    expect(r.applyMark).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'mark.place.result', ok: false, reason: 'full' }])
    // As de outro autor não contam no teto de Ana.
    estado.salao = { ...estado.salao, marcas: cheio.map((m) => ({ ...m, autor: 'Caio' })) }
    relogio.t += 5000
    const outra = deixar('c1', { x: 230, y: 200, tipo: 'bilhete', texto: 'mais um' })
    aplicar(outra)
    expect(outra.applyMark?.marca.texto).toBe('mais um')
  })

  it('quem passar depois vê: Caio, longe, não recebe; ao chegar perto, recebe — e nunca o nome de Ana', () => {
    const { s, deixar, aplicar, estado, mundo } = mesa()
    aplicar(deixar('c1', { x: 230, y: 200, tipo: 'bilhete', texto: 'Fui pela escada' }))
    const agora = s.broadcast(mundo())
    // Ana vê o próprio bilhete, sem autor.
    expect(marcasNoSnapshot(agora, 'c1')).toEqual([{ id: 'id-7', tipo: 'bilhete', x: 230, y: 200, texto: 'Fui pela escada' }])
    // Caio está no mesmo mapa, longe: nada do bilhete.
    expect(marcasNoSnapshot(agora, 'c3')).toEqual([])
    expect(JSON.stringify(para(agora, 'c3'))).not.toContain('Fui pela escada')
    // Bruno está em OUTRA cena: a tela dele não muda (nada sai), nada do bilhete, nem do Salão.
    expect(para(agora, 'c2')).toEqual([])
    expect(JSON.stringify(para(agora, 'c2'))).not.toContain('Fui pela escada')
    expect(JSON.stringify(para(agora, 'c2'))).not.toContain('Salao Norte')
    // Caio anda até o canto de Ana: agora recebe, sem o nome de quem deixou.
    estado.salao = { ...estado.salao, tokens: estado.salao.tokens.map((t) => (t.id === 'capa' ? { ...t, x: 400, y: 260 } : t)) }
    const depois = s.broadcast(mundo())
    expect(marcasNoSnapshot(depois, 'c3').map((m) => m.texto)).toEqual(['Fui pela escada'])
    expect(JSON.stringify(para(depois, 'c3'))).not.toContain('"Ana"')
    expect(JSON.stringify(para(depois, 'c3'))).not.toContain('autor')
  })

  it('bilhete cravado DEPOIS que Caio saiu do canto: o escuro lembrado dele não mostra onde Ana está agora', () => {
    const { s, deixar, aplicar, estado, mundo, relogio } = mesa()
    const moverCaio = (x: number, y: number) => {
      estado.salao = { ...estado.salao, tokens: estado.salao.tokens.map((t) => (t.id === 'capa' ? { ...t, x, y } : t)) }
    }
    // Caio passa pelo canto de Ana (explora) e vai embora.
    moverCaio(400, 260)
    s.broadcast(mundo())
    moverCaio(2800, 800)
    s.broadcast(mundo())
    // Ana crava o bilhete no centro da própria ficha.
    aplicar(deixar('c1', { x: 200, y: 200, tipo: 'bilhete', texto: 'estou aqui agora' }))
    const depois = s.broadcast(mundo())
    const snapCaio = para(depois, 'c3').find((m) => m.type === 'snapshot')
    if (snapCaio?.type !== 'snapshot') throw new Error('sem snapshot para Caio')
    // A névoa esconde a ficha de Ana, e esconde a marca que diria onde ela está.
    expect(snapCaio.map.tokens.map((t) => t.id)).toEqual(['capa'])
    expect(snapCaio.map.marcas ?? []).toEqual([])
    expect(JSON.stringify(para(depois, 'c3'))).not.toContain('estou aqui agora')
    // Caio volta e VÊ o bilhete; ao sair de novo, o escuro lembrado guarda o que ele viu.
    moverCaio(400, 260)
    expect(marcasNoSnapshot(s.broadcast(mundo()), 'c3').map((m) => m.texto)).toEqual(['estou aqui agora'])
    moverCaio(2800, 800)
    expect(marcasNoSnapshot(s.broadcast(mundo()), 'c3').map((m) => m.texto)).toEqual(['estou aqui agora'])
    // Um segundo bilhete cravado depois dessa volta continua fora do escuro
    // lembrado dele: a tela de Caio não muda (nada sai), e segue só com o primeiro.
    relogio.t += 5000
    aplicar(deixar('c1', { x: 210, y: 200, tipo: 'bilhete', texto: 'ainda aqui' }))
    const ultimo = s.broadcast(mundo())
    expect(para(ultimo, 'c3')).toEqual([])
    expect(JSON.stringify(para(ultimo, 'c3'))).not.toContain('ainda aqui')
  })

  it('"Mostrar meu mapa a…" passa também as marcas que quem mostra já viu', () => {
    const { s, deixar, aplicar, estado, mundo } = mesa()
    aplicar(deixar('c1', { x: 200, y: 200, tipo: 'bilhete', texto: 'vi e mostro' }))
    s.broadcast(mundo())
    // Caio, longe, recebe o mapa de Ana: o explorado dela e o bilhete que ela viu.
    const r = s.handleMessage('c1', { type: 'map.share', to: 'Caio' }, mundo())
    expect(para(r, 'c1')).toEqual([{ type: 'map.share.result', to: 'Caio', ok: true }])
    expect(estado.salao.tokens.find((t) => t.id === 'capa')?.x).toBe(2800)
    expect(marcasNoSnapshot(s.broadcast(mundo()), 'c3').map((m) => m.texto)).toEqual(['vi e mostro'])
  })

  it('ficha SECRETA (que o mestre esconde dos outros) não crava marca: a marca contaria onde ela está', () => {
    const { deixar, estado } = mesa()
    estado.salao = { ...estado.salao, tokens: estado.salao.tokens.map((t) => (t.id === 'lanterna' ? { ...t, secret: true } : t)) }
    const r = deixar('c1', { x: 200, y: 200, tipo: 'bilhete', texto: 'invisivel' })
    expect(r.applyMark).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'mark.place.result', ok: false, reason: 'unavailable' }])
  })

  it('ponto numa zona oculta ativa, mesmo encostado na ficha: recusa (o jogador não sabe o que há ali)', () => {
    const { deixar, estado } = mesa()
    estado.salao = {
      ...estado.salao,
      concealZones: [{ id: 'z', name: 'Poço', revealed: false, points: [{ x: 220, y: 180 }, { x: 260, y: 180 }, { x: 260, y: 220 }, { x: 220, y: 220 }] }],
    }
    const r = deixar('c1', { x: 240, y: 200, tipo: 'bilhete', texto: 'no escuro' })
    expect(r.applyMark).toBeUndefined()
    expect(para(r, 'c1')).toEqual([{ type: 'mark.place.result', ok: false, reason: 'unavailable' }])
  })

  it('a cena da marca é a da ficha, não a aberta no editor: nome de cena nunca sai na resposta', () => {
    const { deixar } = mesa()
    const r = deixar('c2', { x: 200, y: 230, tipo: 'bilhete', texto: 'aqui embaixo' })
    expect(r.applyMark?.sceneName).toBe('Cripta Rubra')
    expect(JSON.stringify(r.outbound)).not.toContain('Cripta')
    expect(JSON.stringify(r.outbound)).not.toContain('s-cripta')
  })
})
