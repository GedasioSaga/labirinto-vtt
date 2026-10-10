/**
 * NOMES DOS LUGARES (fatia 2 do relevo): pílula colorida com o nome de cada
 * região, cor do chão escurecida até o AA, haste dentro do lugar, colisão que
 * sobe a de cima, aparição em cascata dentro de 5 s sem quique — e a regra da
 * névoa: o jogador só tem pílula de lugar do recorte dele, com o nome
 * liberado e o ponto da haste já conhecido.
 */
import { describe, expect, it } from 'vitest'
import type { Drawing, MapData, Region, RegionPoint, Token } from '../types/map'
import { createExploration, markAll } from './exploration'
import { filterMapForPlayer } from './fogFilter'
import { visibleRegions } from './layers'
import { createEmptyMap, setNomesDosLugares, setTipoDeMapa } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  APARICAO,
  CONTRASTE_MINIMO,
  TINTA_DA_PILULA,
  ancoraDoLugar,
  arranjarPilulas,
  assinaturaDosLugares,
  atrasoNaCascata,
  contraste,
  corDaPilula,
  lugaresComNome,
  lugaresConhecidos,
  nomesDosLugaresLigados,
  quadroDaAparicao,
  regioesSemPilula,
  temPilula,
} from './nomesDosLugares'
import { pointInPolygonInclusive } from './roomNesting'

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function lugar(id: string, points: RegionPoint[], nome: string, extra: Partial<Region> = {}, room: Partial<NonNullable<Region['room']>> = {}): Region {
  return {
    id,
    points,
    tag: 'region',
    fillColor: '#76c577',
    fillPattern: 'solid',
    data: {},
    room: { shape: 'polygon', name: nome, ...room },
    ...extra,
  }
}

const canais = (cor: number) => [(cor >> 16) & 255, (cor >> 8) & 255, cor & 255]

describe('chave "Nomes dos lugares" e o padrão por tipo de mapa', () => {
  const normal = createEmptyMap('m', 'Masmorra', 10, 10, 50)
  const continente: MapData = { ...normal, continente: true }

  it('sem escolha do mestre: ligada no Continente (e no mapa-mundi antigo), desligada no Normal', () => {
    expect(nomesDosLugaresLigados(normal)).toBe(false)
    expect(nomesDosLugaresLigados(continente)).toBe(true)
    expect(nomesDosLugaresLigados({ ...normal, worldMap: true })).toBe(true)
    expect(nomesDosLugaresLigados({ ...continente, nomesDosLugares: false })).toBe(false)
    expect(nomesDosLugaresLigados({ ...normal, nomesDosLugares: true })).toBe(true)
  })

  it('setNomesDosLugares grava só o que difere do padrão; voltar ao padrão tira o campo; o mesmo valor devolve o mesmo mapa', () => {
    const desligada = setNomesDosLugares(continente, false)
    expect(desligada.nomesDosLugares).toBe(false)
    expect('nomesDosLugares' in setNomesDosLugares(desligada, true)).toBe(false)
    expect(setNomesDosLugares(continente, true)).toBe(continente)
    expect(setNomesDosLugares(normal, false)).toBe(normal)
    expect(setNomesDosLugares(normal, true).nomesDosLugares).toBe(true)
  })

  it('cena sem escolha segue o tipo de mapa', () => {
    expect(nomesDosLugaresLigados(setTipoDeMapa(continente, 'normal'))).toBe(false)
    expect(nomesDosLugaresLigados(setTipoDeMapa(normal, 'continente'))).toBe(true)
  })

  it('arquivo: mapa antigo abre sem o campo; booleano volta; valor torto abre sem o campo', () => {
    const json = JSON.parse(serializeMap(continente)) as Record<string, unknown> // JSON.parse devolve any: o arquivo é um objeto, só espalhado aqui
    expect('nomesDosLugares' in deserializeMap(JSON.stringify(json))).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...json, nomesDosLugares: false })).nomesDosLugares).toBe(false)
    expect(deserializeMap(JSON.stringify({ ...json, nomesDosLugares: true })).nomesDosLugares).toBe(true)
    expect('nomesDosLugares' in deserializeMap(JSON.stringify({ ...json, nomesDosLugares: 'sim' }))).toBe(false)
    // Ida e volta pelo arquivo: a escolha do mestre sobrevive a salvar e abrir.
    expect(deserializeMap(serializeMap({ ...continente, nomesDosLugares: false })).nomesDosLugares).toBe(false)
  })
})

describe('cor da pílula: o chão escurecido, com letra clara no AA', () => {
  const chaos = [0xffffff, 0xf3e2a9, 0x76c577, 0x0aa148, 0x9fd8ff, 0xa8776a, 0xd94a3a, 0x3b2a6b, 0x000000, 0x808080]

  it('toda cor de chão, da neve ao breu, dá contraste AA com a letra branca', () => {
    for (const chao of chaos) expect(contraste(TINTA_DA_PILULA, corDaPilula(chao))).toBeGreaterThanOrEqual(CONTRASTE_MINIMO)
  })

  it('escurece sempre (a pílula se separa do chão em volta) e mantém o tom (a proporção entre os canais)', () => {
    for (const chao of chaos.filter((c) => c !== 0)) {
      const pilula = corDaPilula(chao)
      const [r, g, b] = canais(chao)
      const [pr, pg, pb] = canais(pilula)
      expect(pr + pg + pb).toBeLessThan(r + g + b)
      const maior = Math.max(r, g, b)
      const fator = Math.max(pr, pg, pb) / maior
      expect(Math.abs(pr - r * fator)).toBeLessThanOrEqual(1)
      expect(Math.abs(pg - g * fator)).toBeLessThanOrEqual(1)
      expect(Math.abs(pb - b * fator)).toBeLessThanOrEqual(1)
    }
  })

  it('contraste da WCAG nas pontas conhecidas', () => {
    expect(contraste(0xffffff, 0x000000)).toBeCloseTo(21, 5)
    expect(contraste(0xffffff, 0xffffff)).toBeCloseTo(1, 5)
  })
})

describe('onde a haste encosta', () => {
  it('no centróide, quando ele está dentro do lugar', () => {
    expect(ancoraDoLugar(lugar('a', retangulo(0, 0, 400, 200), 'Vila'))).toEqual({ x: 200, y: 100 })
  })

  it('costa em C: o centróide cai no mar, a haste vai para dentro do lugar, longe da beira', () => {
    // Um "C" aberto para a direita: o centróide fica no vão.
    const c: RegionPoint[] = [
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 500 },
      { x: 600, y: 500 },
      { x: 600, y: 600 },
      { x: 0, y: 600 },
    ]
    const ancora = ancoraDoLugar(lugar('c', c, 'Baía'))
    expect(pointInPolygonInclusive(ancora, c)).toBe(true)
    // No miolo da faixa (a 50 px de cada beira), não raspando a costa.
    expect(Math.min(ancora.x, ancora.y < 300 ? 100 - ancora.y : ancora.y - 500, ancora.y)).toBeGreaterThanOrEqual(20)
  })

  it('nome arrastado pelo mestre: a haste vai onde ele soltou', () => {
    expect(ancoraDoLugar(lugar('a', retangulo(0, 0, 400, 200), 'Vila', {}, { labelOffset: { x: 50, y: -30 } }))).toEqual({ x: 250, y: 70 })
  })
})

describe('os lugares com nome de uma tela', () => {
  const vila = lugar('vila', retangulo(0, 0, 400, 400), 'Vila', { fillColor: '#a8776a' })
  const semNome = lugar('mar', retangulo(400, 0, 800, 400), '   ')
  const comum: Region = { id: 'comum', points: retangulo(0, 400, 400, 800), tag: 'region', fillColor: '#ffffff', fillPattern: 'solid', data: {} }
  const escondido = lugar('cripta', retangulo(0, 800, 400, 1200), 'Cripta', {}, { nameHiddenFromPlayers: true })
  const torto = lugar('torto', [{ x: 0, y: 0 }, { x: 10, y: 0 }], 'Linha')

  it('só região com nome e polígono de verdade vira pílula; as outras seguem na plaquinha', () => {
    const regioes = [vila, semNome, comum, escondido, torto]
    expect(regioes.filter(temPilula).map((r) => r.id)).toEqual(['vila', 'cripta'])
    expect(regioesSemPilula(regioes, true).map((r) => r.id)).toEqual(['mar', 'comum', 'torto'])
    expect(regioesSemPilula(regioes, false)).toBe(regioes)
  })

  it('a cor é a do bioma pintado no lugar (desenho com fundo por cima), não a da região de baixo', () => {
    const floresta: Drawing = { id: 'floresta', kind: 'polygon', points: retangulo(100, 100, 300, 300), color: '#0aa148', width: 0, filled: true, fillAlpha: 1 }
    const [comBioma] = lugaresComNome([vila], [floresta])
    expect(comBioma.fundo).toBe(corDaPilula(0x0aa148))
    const [semBioma] = lugaresComNome([vila], [])
    expect(semBioma.fundo).toBe(corDaPilula(0xa8776a))
  })

  it('ordem da cascata: de cima para baixo, depois da esquerda para a direita; nome escondido sai esmaecido (só o mestre o recebe)', () => {
    const leste = lugar('leste', retangulo(800, 0, 1200, 400), 'Leste')
    const lugares = lugaresComNome([escondido, leste, vila], [])
    expect(lugares.map((l) => l.id)).toEqual(['vila', 'leste', 'cripta'])
    expect(lugares.map((l) => l.esmaecido)).toEqual([false, false, true])
    expect(lugares[0].texto).toBe('Vila')
  })

  it('o texto pode vir de fora (o editor junta o olho de "ver através")', () => {
    const [l] = lugaresComNome([vila], [], { textoDe: (r) => `${r.room?.name ?? ''} 👁` })
    expect(l.texto).toBe('Vila 👁')
  })

  it('a assinatura muda com o nome, o arrasto e a terra; não muda com rabisco', () => {
    const base = assinaturaDosLugares([vila], [])
    const rabisco: Drawing = { id: 'r', kind: 'freehand', points: retangulo(0, 0, 10, 10), color: '#000000', width: 2 }
    expect(assinaturaDosLugares([vila], [rabisco])).toBe(base)
    expect(assinaturaDosLugares([lugar('vila', vila.points, 'Vilarejo', { fillColor: '#a8776a' })], [])).not.toBe(base)
    expect(assinaturaDosLugares([lugar('vila', vila.points, 'Vila', { fillColor: '#a8776a' }, { labelOffset: { x: 1, y: 0 } })], [])).not.toBe(base)
    expect(assinaturaDosLugares([{ ...vila, fillColor: '#123456' }], [])).not.toBe(base)
  })
})

describe('névoa: o jogador só tem pílula de lugar descoberto', () => {
  const ANA: Token = { id: 'ana', characterId: null, name: 'Ana', x: 200, y: 200, size: 1, image: null }
  // A: onde a Ana está. D: vizinha de baixo, vista só na ponta de cima (o
  // centro, na névoa). E: à vista, com o nome escondido pelo mestre. B:
  // escondida pelo mestre. C: longe, nunca vista.
  const A = lugar('A', retangulo(100, 100, 400, 400), 'Vila')
  const D = lugar('D', retangulo(100, 400, 400, 1300), 'Pântano')
  const E = lugar('E', retangulo(400, 100, 500, 400), 'Covil', {}, { nameHiddenFromPlayers: true })
  const B = lugar('B', retangulo(-200, 100, 100, 400), 'Forte', { hidden: true })
  const C = lugar('C', retangulo(1100, 100, 1400, 400), 'Longe')
  const mestre: MapData = { ...createEmptyMap('m-nomes', 'Mundo', 40, 40, 50), continente: true, regions: [A, D, E, B, C], tokens: [ANA] }

  // A memória da névoa mede o mundo em px (`hostSession.ts`: largura × grid).
  const novaMemoria = () => createExploration({ width: mestre.width * mestre.grid, height: mestre.height * mestre.grid, grid: mestre.grid })

  function doJogador(explorado = novaMemoria()) {
    const view = filterMapForPlayer(mestre, 'p1', { p1: ['ana'] }, 400, explorado)
    const lugares = lugaresComNome(visibleRegions(view.map.regions, view.map.hiddenLayers), view.map.drawings)
    return { view, lugares, conhecidos: lugaresConhecidos(lugares, { visao: view.vision, explorado }, view.concealed) }
  }

  it('zona oculta ativa sobre o ponto da haste: sem pílula (o preto da zona fica ABAIXO dela), e volta quando a zona é revelada', () => {
    // A zona cobre o centróide de A (250, 250), mas não a Ana (200, 200) nem a
    // maior parte da sala: o recorte manda A inteira, com o nome.
    const zona = { id: 'z', name: 'Cripta', revealed: false, points: retangulo(220, 220, 300, 300) }
    const comZona = (revealed: boolean) => {
      const mapa: MapData = { ...mestre, concealZones: [{ ...zona, revealed }] }
      const view = filterMapForPlayer(mapa, 'p1', { p1: ['ana'] }, 400, novaMemoria())
      const lugares = lugaresComNome(visibleRegions(view.map.regions, view.map.hiddenLayers), view.map.drawings)
      return { view, lugares, conhecidos: lugaresConhecidos(lugares, { visao: view.vision }, view.concealed) }
    }
    const ativa = comZona(false)
    expect(ativa.view.concealed.length).toBeGreaterThan(0)
    expect(ativa.lugares.map((l) => l.id)).toContain('A')
    expect(ativa.conhecidos.map((l) => l.id)).not.toContain('A')
    expect(comZona(true).conhecidos.map((l) => l.id)).toContain('A')
  })

  it('a chave atravessa; B (escondida) e C (longe) nem chegam; o nome escondido chega vazio', () => {
    const { view, lugares } = doJogador()
    expect(nomesDosLugaresLigados(view.map)).toBe(true)
    const ids = view.map.regions.map((r) => r.id)
    expect(ids).not.toContain('B')
    expect(ids).not.toContain('C')
    expect(lugares.map((l) => l.id)).not.toContain('E')
    expect(lugares.flatMap((l) => [l.texto])).not.toContain('Covil')
  })

  it('D chega no recorte, mas o coração dele está na névoa: sem pílula até ser conhecido', () => {
    const { view, lugares, conhecidos } = doJogador()
    expect(view.map.regions.map((r) => r.id)).toContain('D')
    expect(lugares.map((l) => l.id)).toContain('D')
    expect(conhecidos.map((l) => l.id)).toEqual(['A'])
  })

  it('com o mapa explorado (memória da névoa), a pílula do lembrado aparece; nome escondido e região escondida seguem fora', () => {
    const explorado = novaMemoria()
    markAll(explorado)
    const { conhecidos } = doJogador(explorado)
    expect(conhecidos.map((l) => l.id).sort()).toEqual(['A', 'C', 'D'])
  })
})

describe('colisão em px de tela: a de cima desliza ou sobe', () => {
  const medidas = { haste: 22, folga: 4, raioDoPonto: 5.5, tetoDeSubida: 78 }
  type Pilula = { id: string; x: number; y: number; largura: number; altura: number }

  /** O retângulo final da pílula, a partir do arranjo. */
  function caixa(p: Pilula, arranjo: { subida: number; deslize: number }) {
    const topo = p.y - medidas.haste - p.altura - arranjo.subida
    const x = p.x + arranjo.deslize
    return { x0: x - p.largura / 2, x1: x + p.largura / 2, y0: topo, y1: topo + p.altura }
  }
  function sobrepoe(a: ReturnType<typeof caixa>, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
    return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
  }
  function arranjo(lista: Pilula[], id: string) {
    const a = arranjarPilulas(lista, medidas).get(id)
    if (a === undefined || a === null) throw new Error(`sem arranjo para ${id}`)
    return a
  }

  it('pílulas longe uma da outra não mexem', () => {
    const lista = [
      { id: 'a', x: 0, y: 100, largura: 80, altura: 22 },
      { id: 'b', x: 300, y: 100, largura: 80, altura: 22 },
    ]
    expect(arranjo(lista, 'a')).toEqual({ subida: 0, deslize: 0 })
    expect(arranjo(lista, 'b')).toEqual({ subida: 0, deslize: 0 })
  })

  it('duas quase no mesmo ponto: a de baixo na tela fica, a de cima sobe até sobrar a folga', () => {
    const lista = [
      { id: 'cima', x: 10, y: 100, largura: 80, altura: 22 },
      { id: 'baixo', x: 0, y: 110, largura: 80, altura: 22 },
    ]
    expect(arranjo(lista, 'baixo')).toEqual({ subida: 0, deslize: 0 })
    // Topo da de baixo: 110 - 22 - 22 = 66. A de cima termina 4 px acima: topo 40; natural seria 56.
    expect(arranjo(lista, 'cima')).toEqual({ subida: 16, deslize: 0 })
  })

  it('encostando só na ponta: a de cima desliza de lado (sem subir), e a haste segue na parte reta da base dela', () => {
    const cima = { id: 'cima', x: 70, y: 100, largura: 120, altura: 22 }
    const baixo = { id: 'baixo', x: 0, y: 104, largura: 80, altura: 22 }
    const a = arranjo([cima, baixo], 'cima')
    expect(a.subida).toBe(0)
    expect(a.deslize).toBeGreaterThan(0)
    expect(Math.abs(a.deslize)).toBeLessThanOrEqual(cima.largura / 2 - cima.altura / 2 - 2)
    expect(sobrepoe(caixa(cima, a), caixa(baixo, arranjo([cima, baixo], 'baixo')))).toBe(false)
  })

  it('pílula não tampa o ponto de outro lugar', () => {
    const baixo = { id: 'baixo', x: 0, y: 200, largura: 80, altura: 22 }
    const vizinho = { id: 'vizinho', x: 30, y: 170, largura: 60, altura: 22 }
    const a = arranjo([baixo, vizinho], 'baixo')
    const ponto = { x0: 30 - 5.5, x1: 30 + 5.5, y0: 170 - 5.5, y1: 170 + 5.5 }
    expect(sobrepoe(caixa(baixo, a), ponto)).toBe(false)
    // O ponto do próprio lugar não barra a pílula dele: sozinha, ela não mexe.
    expect(arranjo([{ id: 'so', x: 0, y: 200, largura: 80, altura: 22 }], 'so')).toEqual({ subida: 0, deslize: 0 })
  })

  it('nenhuma pílula colocada sobrepõe outra, num aglomerado de 8', () => {
    const lista = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, x: (i % 3) * 50, y: 300 + Math.floor(i / 3) * 20, largura: 90, altura: 22 }))
    const arranjos = arranjarPilulas(lista, { ...medidas, tetoDeSubida: 1000 })
    const caixas = lista.flatMap((p) => {
      const a = arranjos.get(p.id)
      return a === null || a === undefined ? [] : [caixa(p, a)]
    })
    expect(caixas).toHaveLength(8)
    for (let i = 0; i < caixas.length; i += 1) for (let j = i + 1; j < caixas.length; j += 1) expect(sobrepoe(caixas[i], caixas[j])).toBe(false)
  })

  it('torre alta demais: a que não cabe até o teto some neste zoom (null), as outras ficam', () => {
    const pilhas = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, x: 0, y: 100 + i, largura: 80, altura: 22 }))
    const arranjos = arranjarPilulas(pilhas, medidas)
    expect(arranjos.get('p5')).toEqual({ subida: 0, deslize: 0 })
    expect([...arranjos.values()].filter((a) => a === null).length).toBeGreaterThan(0)
    for (const a of arranjos.values()) if (a !== null) expect(a.subida).toBeLessThanOrEqual(medidas.tetoDeSubida)
  })

  it('é determinístico: a mesma entrada em outra ordem dá o mesmo arranjo', () => {
    const lista = [
      { id: 'a', x: 0, y: 100, largura: 80, altura: 22 },
      { id: 'b', x: 20, y: 100, largura: 80, altura: 22 },
      { id: 'c', x: 40, y: 105, largura: 80, altura: 22 },
    ]
    const ida = Object.fromEntries(arranjarPilulas(lista, medidas))
    const volta = Object.fromEntries(arranjarPilulas([...lista].reverse(), medidas))
    expect(volta).toEqual(ida)
  })
})

describe('aparição: cascata curta, ease-out, sem quique, até 5 s', () => {
  it('45 ms entre pílulas', () => {
    expect([0, 1, 2, 3].map((i) => atrasoNaCascata(i, 4))).toEqual([0, 45, 90, 135])
  })

  it('com muitos lugares o passo encurta: a última assenta dentro de 5 s', () => {
    for (const total of [10, 100, 112, 400]) {
      const ultima = atrasoNaCascata(total - 1, total) + APARICAO.duracaoMs
      expect(ultima).toBeLessThanOrEqual(APARICAO.tetoMs)
    }
    expect(atrasoNaCascata(9, 10)).toBe(9 * APARICAO.passoMs)
  })

  it('começa invisível, 94% e 6 px abaixo; termina inteira no lugar', () => {
    expect(quadroDaAparicao(-10)).toMatchObject({ alfa: 0, escala: APARICAO.escalaInicial, descida: APARICAO.descidaInicialPx, terminou: false })
    expect(quadroDaAparicao(0)).toMatchObject({ alfa: 0, escala: APARICAO.escalaInicial })
    expect(quadroDaAparicao(APARICAO.duracaoMs)).toEqual({ alfa: 1, escala: 1, descida: 0, terminou: true })
  })

  it('sem quique: escala nunca passa de 1, descida nunca abaixo de 0, e tudo só avança (ease-out: rápido no começo)', () => {
    let antes = quadroDaAparicao(0)
    for (let ms = 5; ms <= APARICAO.duracaoMs; ms += 5) {
      const q = quadroDaAparicao(ms)
      expect(q.escala).toBeLessThanOrEqual(1)
      expect(q.descida).toBeGreaterThanOrEqual(0)
      expect(q.alfa).toBeGreaterThanOrEqual(antes.alfa)
      expect(q.escala).toBeGreaterThanOrEqual(antes.escala)
      expect(q.descida).toBeLessThanOrEqual(antes.descida)
      antes = q
    }
    // Ease-out: na primeira quarta parte do tempo, já percorreu mais da metade.
    const quarto = quadroDaAparicao(APARICAO.duracaoMs / 4)
    expect((quarto.escala - APARICAO.escalaInicial) / (1 - APARICAO.escalaInicial)).toBeGreaterThan(0.5)
  })

  it('"Reduzir movimento": só a opacidade, sem crescer nem subir', () => {
    for (const ms of [0, 50, 100, APARICAO.reduzidaMs]) {
      const q = quadroDaAparicao(ms, true)
      expect(q.escala).toBe(1)
      expect(q.descida).toBe(0)
    }
    expect(quadroDaAparicao(APARICAO.reduzidaMs, true).alfa).toBe(1)
  })
})
