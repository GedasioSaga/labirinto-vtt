/**
 * AGENDA E CACHE DE MALHAS — o contrato: o pedido novo tira o velho (e a
 * resposta velha nunca chega), cancelar some com o trabalho, quem pega leva a
 * resposta uma vez só, as buscas revezam (a cara não segura a barata), e o
 * caminho pela agenda, com a malha montada em fatias, é o mesmo da busca de
 * uma vez. O cache troca a malha quando a estrutura das paredes muda e
 * descarta a menos usada.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { AgendaDeCaminhos, CacheDeMalhas, caminhoAgora } from './agenda'
import { acharCaminhoNaMalha, type ConsultaDeCaminho } from './busca'
import { GRID, mapa, parede, porta } from './caminho.fixture'
import { malhaPronta, type MapaDoCaminho, PONTOS_PARA_MARCOS } from './malha'
import { avancarMalha, montarMalha } from './marcos'
import { gerarMapaDoRobo, sorteador } from './robo.fixture'
import { agendaDeFatias } from './simulacao.fixture'

const R1 = GRID / 2
/** `rodar(UMA_FATIA)` na agenda de relógio falso anda exatamente uma fatia. */
const UMA_FATIA = 1

/** Sala com a única abertura do outro lado: a busca anda várias fatias pequenas. */
const sala = mapa([
  parede('n', 256, 128, 576, 128),
  parede('s', 256, 448, 576, 448),
  parede('o', 256, 128, 256, 448),
  parede('l1', 576, 128, 576, 256),
  parede('l2', 576, 320, 576, 448),
])
const deFora: ConsultaDeCaminho = { de: { x: 160, y: 288 }, para: { x: 416, y: 288 }, fichas: [] }
const outroDestino: ConsultaDeCaminho = { de: { x: 160, y: 288 }, para: { x: 416, y: 224 }, fichas: [] }

/** Anda até o pedido de `id` sair (ou `limite` fatias); devolve as fatias andadas. */
function fatiasAte(agenda: AgendaDeCaminhos, id: string, limite: number): number {
  let fatias = 0
  while (agenda.pendente(id) && fatias < limite) {
    agenda.rodar(UMA_FATIA)
    fatias += 1
  }
  return fatias
}

describe('agenda de caminhos: o contrato', () => {
  it('pedir de novo com a busca no meio: a anterior sai e só a nova responde', () => {
    const agenda = agendaDeFatias({ pontosPorFatia: 4 })
    agenda.pedir('a', sala, R1, deFora)
    agenda.rodar(UMA_FATIA)
    agenda.rodar(UMA_FATIA)
    // Malha montada e busca começada, sem terminar.
    expect(malhaPronta(agenda.cache.malhaPara(sala, R1))).toBe(true)
    expect(agenda.pendente('a')).toBe(true)
    expect(agenda.pegar('a')).toBeUndefined()
    agenda.pedir('a', sala, R1, outroDestino)
    expect(fatiasAte(agenda, 'a', 10_000)).toBeLessThan(10_000)
    const esperado = caminhoAgora(new CacheDeMalhas(), sala, R1, outroDestino)
    expect(esperado).not.toEqual(caminhoAgora(new CacheDeMalhas(), sala, R1, deFora))
    expect(agenda.pegar('a')).toEqual(esperado)
    expect(agenda.pegar('a')).toBeUndefined()
    expect(agenda.temTrabalho).toBe(false)
  })

  it('pedir de novo depois da resposta, sem pegar: a resposta velha some', () => {
    const agenda = agendaDeFatias({})
    agenda.pedir('a', sala, R1, deFora)
    while (agenda.temTrabalho) agenda.rodar(1000)
    agenda.pedir('a', sala, R1, outroDestino)
    expect(agenda.pegar('a')).toBeUndefined()
    while (agenda.temTrabalho) agenda.rodar(1000)
    expect(agenda.pegar('a')).toEqual(caminhoAgora(new CacheDeMalhas(), sala, R1, outroDestino))
  })

  it('cancelar no meio: nada a pegar, nada a fazer', () => {
    const agenda = agendaDeFatias({ pontosPorFatia: 4 })
    agenda.pedir('a', sala, R1, deFora)
    agenda.rodar(UMA_FATIA)
    agenda.rodar(UMA_FATIA)
    expect(agenda.pendente('a')).toBe(true)
    agenda.cancelar('a')
    expect(agenda.pendente('a')).toBe(false)
    expect(agenda.temTrabalho).toBe(false)
    expect(agenda.rodar(1000)).toBe(0)
    expect(agenda.pegar('a')).toBeUndefined()
  })

  it('quem pega leva: a segunda vez dá undefined, e um id não pega a resposta do outro', () => {
    const agenda = agendaDeFatias({})
    agenda.pedir('a', sala, R1, deFora)
    agenda.pedir('b', sala, R1, outroDestino)
    while (agenda.temTrabalho) agenda.rodar(1000)
    expect(agenda.pegar('c')).toBeUndefined()
    expect(agenda.pegar('a')).toEqual(caminhoAgora(new CacheDeMalhas(), sala, R1, deFora))
    expect(agenda.pegar('a')).toBeUndefined()
    expect(agenda.pegar('b')).toEqual(caminhoAgora(new CacheDeMalhas(), sala, R1, outroDestino))
  })

  it('não começa a fatia que, pelo custo das de antes, passaria do orçamento; a primeira sempre vai', () => {
    // Cada fatia (uma parede da malha) custa 0,5 ms neste relógio.
    let ms = 0
    const agenda = new AgendaDeCaminhos(() => {
      ms += 0.5
      return ms
    }, { paredesPorFatia: 1 })
    agenda.pedir('a', sala, R1, deFora)
    const malha = agenda.cache.malhaPara(sala, R1)
    expect(agenda.rodar(1.5)).toBe(1.5)
    expect(malha.feitas).toBe(3)
    expect(agenda.rodar(0)).toBe(0.5)
    expect(malha.feitas).toBe(4)
  })

  it('pedidos do mesmo custo, malha pronta: o primeiro que pediu sai primeiro', () => {
    const agenda = agendaDeFatias({ pontosPorFatia: 4 })
    // Com a malha por montar, a fatia dela conta na vez de quem a pegou: aqui é só o revezamento das buscas.
    const malha = agenda.cache.malhaPara(sala, R1)
    while (!avancarMalha(malha, Number.POSITIVE_INFINITY));
    agenda.pedir('primeiro', sala, R1, deFora)
    agenda.pedir('segundo', sala, R1, deFora)
    const saida: string[] = []
    while (agenda.temTrabalho) {
      agenda.rodar(UMA_FATIA)
      for (const id of ['primeiro', 'segundo']) if (agenda.pegar(id) !== undefined) saida.push(id)
    }
    expect(saida).toEqual(['primeiro', 'segundo'])
  })
})

describe('agenda de caminhos: revezamento', () => {
  // Mapa aberto de 60 x 60 casas; uma casa fechada no meio, com a porta trancada a oeste.
  const L = 60
  const caixa: Wall[] = [
    parede('caixa-n', 30 * GRID, 30 * GRID, 31 * GRID, 30 * GRID),
    parede('caixa-l', 31 * GRID, 30 * GRID, 31 * GRID, 31 * GRID),
    parede('caixa-s', 31 * GRID, 31 * GRID, 30 * GRID, 31 * GRID),
    parede('caixa-o', 30 * GRID, 31 * GRID, 30 * GRID, 30 * GRID, { door: porta({ locked: true }) }),
  ]
  const aberto: MapaDoCaminho = mapa([...caixa, parede('meio', 10 * GRID, 2 * GRID, 10 * GRID, 8 * GRID)], L, L)
  const fichas = [{ id: 'parada', x: 20.5 * GRID, y: 40.5 * GRID, raio: R1 }]
  // A cara: o destino atrás da tranca. As rodadas com e sem fichas varrem o mapa todo antes da terceira achar a porta.
  const cara: ConsultaDeCaminho = { de: { x: 1.5 * GRID, y: 1.5 * GRID }, para: { x: 30.5 * GRID, y: 30.5 * GRID }, fichas }
  // A barata: contorna uma parede ali perto.
  const barata: ConsultaDeCaminho = { de: { x: 8.5 * GRID, y: 5.5 * GRID }, para: { x: 12.5 * GRID, y: 5.5 * GRID }, fichas }

  it('a busca cara não segura a barata que pediu depois', () => {
    const agenda = agendaDeFatias({ pontosPorFatia: 50 })
    agenda.pedir('cara', aberto, R1, cara)
    agenda.pedir('barata', aberto, R1, barata)
    const fatiasDaBarata = fatiasAte(agenda, 'barata', 10_000)
    expect(agenda.pegar('barata')).toEqual(caminhoAgora(new CacheDeMalhas(), aberto, R1, barata))
    expect(agenda.pendente('cara')).toBe(true)
    const fatiasDaCara = fatiasDaBarata + fatiasAte(agenda, 'cara', 10_000)
    expect(agenda.pegar('cara')).toEqual({ tipo: 'sem-caminho', motivo: 'porta-trancada', portas: ['caixa-o'], fichas: [] })
    console.log(`AGENDA revezamento ${JSON.stringify({ fatiasDaBarata, fatiasDaCara })}`)
    // Na fila de antes (um pedido por vez até acabar) a barata esperava a cara inteira.
    expect(fatiasDaBarata).toBeLessThanOrEqual(20)
    expect(fatiasDaCara).toBeGreaterThan(10 * fatiasDaBarata)
  })
})

describe('agenda de caminhos: igual à busca de uma vez', () => {
  it('mapa acima de PONTOS_PARA_MARCOS, malha e marcos em fatias, seis buscas revezando: os mesmos caminhos', () => {
    const gerado = gerarMapaDoRobo(31, GRID, false, 1, { largura: 150, altura: 150 })
    expect(gerado.mapa.width * gerado.mapa.height).toBeGreaterThan(PONTOS_PARA_MARCOS)
    const sorte = sorteador(5)
    const ponto = (): Point => ({ x: (Math.floor(sorte() * 150) + 0.5) * GRID, y: (Math.floor(sorte() * 150) + 0.5) * GRID })
    const consultas: ConsultaDeCaminho[] = Array.from({ length: 6 }, (_, k) => ({ de: ponto(), para: ponto(), fichas: k % 2 === 0 ? gerado.fichas : [] }))
    const agenda = agendaDeFatias({ pontosPorFatia: 300, paredesPorFatia: 16 })
    consultas.forEach((consulta, k) => agenda.pedir(`npc${k}`, gerado.mapa, R1, consulta))
    let rodadas = 0
    while (agenda.temTrabalho) {
      agenda.rodar(UMA_FATIA)
      rodadas += 1
    }
    const malha = montarMalha(gerado.mapa, R1)
    expect(malha.quantosMarcos).toBeGreaterThan(0)
    // Montar em fatias levou muitas: a prova de que não foi de uma vez.
    expect(rodadas).toBeGreaterThan(100)
    const tipos: string[] = []
    consultas.forEach((consulta, k) => {
      const esperado = acharCaminhoNaMalha(malha, gerado.mapa.walls, consulta)
      tipos.push(esperado.tipo)
      expect(agenda.pegar(`npc${k}`), `npc${k}`).toEqual(esperado)
    })
    expect(tipos).toContain('caminho')
  }, 60_000)
})

describe('cache de malhas', () => {
  const walls = [
    parede('a', 192, 0, 192, 448),
    parede('b', 384, 192, 384, 640),
    parede('d', 576, 256, 576, 320, { door: porta() }),
  ]
  const base = mapa(walls)
  const trocar = (k: number, extra: Partial<Wall>): Wall[] => walls.map((w, i) => (i === k ? { ...w, ...extra } : w))

  it('mesma estrutura (cópia da lista, porta aberta ou fechada): a mesma malha', () => {
    const cache = new CacheDeMalhas()
    const malha = cache.malhaPara(base, R1)
    expect(cache.malhaPara(base, R1)).toBe(malha)
    expect(cache.malhaPara(mapa([...walls]), R1)).toBe(malha)
    expect(cache.malhaPara(mapa(trocar(2, { door: porta({ open: true }) })), R1)).toBe(malha)
  })

  it('estrutura diferente: outra malha', () => {
    const cache = new CacheDeMalhas()
    const malha = cache.malhaPara(base, R1)
    const outras: Record<string, MapaDoCaminho> = {
      'ponta movida': mapa(trocar(0, { x1: 200 })),
      'parede a mais': mapa([...walls, parede('e', 768, 128, 768, 640)]),
      'parede a menos': mapa(walls.slice(0, 2)),
      'porta de um lado': mapa(trocar(2, { door: porta({ opensFrom: 'left' }) })),
      'porta trancada': mapa(trocar(2, { door: porta({ locked: true }) })),
      'parede que deixa passar': mapa(trocar(1, { blocksMove: false })),
      'outro id': mapa(trocar(1, { id: 'b2' })),
      'outro tamanho de mapa': mapa(walls, 16, 10),
    }
    for (const [nome, outro] of Object.entries(outras)) expect(cache.malhaPara(outro, R1), nome).not.toBe(malha)
    expect(cache.malhaPara(base, GRID), 'outro raio').not.toBe(cache.malhaPara(base, R1))
  })

  it('nove mapas diferentes: a malha do primeiro sai do cache', () => {
    const cache = new CacheDeMalhas()
    const mapas = Array.from({ length: 9 }, (_, k) => mapa([parede(`p${k}`, 64 * (k + 1), 0, 64 * (k + 1), 256)]))
    const primeira = cache.malhaPara(mapas[0] ?? base, R1)
    const segunda = cache.malhaPara(mapas[1] ?? base, R1)
    for (const m of mapas.slice(2)) cache.malhaPara(m, R1)
    expect(cache.malhaPara(mapas[1] ?? base, R1)).toBe(segunda)
    expect(cache.malhaPara(mapas[0] ?? base, R1)).not.toBe(primeira)
  })

  it('guarda as 8 mais usadas: a nona tira a que ficou mais tempo sem uso', () => {
    const cache = new CacheDeMalhas()
    const mapas = Array.from({ length: 9 }, (_, k) => mapa([parede(`p${k}`, 64 * (k + 1), 0, 64 * (k + 1), 256)]))
    const malhas = mapas.slice(0, 8).map((m) => cache.malhaPara(m, R1))
    // A primeira volta a ser usada: a menos usada agora é a segunda.
    expect(cache.malhaPara(mapas[0] ?? base, R1)).toBe(malhas[0])
    cache.malhaPara(mapas[8] ?? base, R1)
    expect(cache.malhaPara(mapas[0] ?? base, R1)).toBe(malhas[0])
    expect(cache.malhaPara(mapas[1] ?? base, R1)).not.toBe(malhas[1])
  })
})
