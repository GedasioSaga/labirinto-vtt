/**
 * FATIA 7 NO HOST: a camada livre CRIADA pelo painel (id aleatório, nome do
 * mestre) pelo recorte REAL do jogador. O nome nunca atravessa; o id só vai
 * quando a camada tem item no pacote; escondida dos jogadores, nada dela vai;
 * apagada, os itens voltam e o id some; id de antes (`livre_Segredo_do_Lich`,
 * arquivo editado à mão) continua escondido e não leva o texto.
 */
import { describe, expect, it } from 'vitest'
import type { CamadaId, MapData } from '../types/map'
import { alternarOlhoDosJogadores } from './camadas/estado'
import { apagarCamadaLivre, criarCamadaLivre, renomearCamada } from './camadas/modelo'
import { filterMapForPlayer, type PlayerMapView } from './fogFilter'
import { deserializeMap, serializeMap } from './mapFile'
import { mapaDeItens } from './__fixtures__/recorteDeCamadas'

const RAIO_TOTAL = 5000
const NOME = 'Segredo do Lich'

function doOlho(map: MapData): PlayerMapView {
  return filterMapForPlayer(map, 'p1', { p1: ['olho'] }, RAIO_TOTAL)
}

function comLivreCriada(): { map: MapData; id: CamadaId; parede: string } {
  const base = mapaDeItens()
  const criada = criarCamadaLivre(base, {})
  if (criada === null) throw new Error('não criou')
  // Uma parede que o olho vê no mapa de base: sem isso, "não chegou" não provaria nada.
  const parede = doOlho(base).map.walls[0]?.id ?? ''
  expect(parede).not.toBe('')
  const map = renomearCamada(criada.map, criada.id, NOME)
  return { map: { ...map, walls: map.walls.map((w) => (w.id === parede ? { ...w, camada: criada.id } : w)) }, id: criada.id, parede }
}

describe('camada livre criada pelo painel, pelo recorte do jogador', () => {
  it('à vista: a parede vai, o id vai em camadasDoJogador (só id), o NOME nunca', () => {
    const { map, id, parede } = comLivreCriada()
    const view = doOlho(map)
    expect(view.map.walls.some((w) => w.id === parede)).toBe(true)
    expect(view.map.camadasDoJogador?.some((c) => c.id === id)).toBe(true)
    const pacote = JSON.stringify(view)
    expect(pacote).not.toContain(NOME)
    expect(pacote).not.toContain('Segredo')
    expect(view.map).not.toHaveProperty('modeloCamadas')
  })

  it('escondida dos jogadores: nem a parede, nem o id', () => {
    const { map, id, parede } = comLivreCriada()
    const view = doOlho(alternarOlhoDosJogadores(map, id))
    expect(view.map.walls.some((w) => w.id === parede)).toBe(false)
    expect(JSON.stringify(view)).not.toContain(id)
  })

  it('vazia: o id não vai (só diria que ela existe)', () => {
    const criada = criarCamadaLivre(mapaDeItens(), {})
    if (criada === null) throw new Error('não criou')
    expect(JSON.stringify(doOlho(criada.map))).not.toContain(criada.id)
  })

  it('apagada: a parede volta a Paredes e vai; o id some do pacote', () => {
    const { map, id, parede } = comLivreCriada()
    const view = doOlho(apagarCamadaLivre(map, id).map)
    expect(view.map.walls.some((w) => w.id === parede)).toBe(true)
    expect(JSON.stringify(view)).not.toContain(id)
  })

  it('id de antes no arquivo (livre_Segredo_do_Lich) escondido dos jogadores: continua escondido, e o texto não vai', () => {
    const { map, parede } = comLivreCriada()
    const legado = 'livre_Segredo_do_Lich'
    const cru = JSON.parse(serializeMap({ ...map, versaoDasCamadas: 2, ocultasDoJogador: [], walls: map.walls.map((w) => (w.id === parede ? { ...w, camada: 'livre_0badc0de' } : w)) }))
    // Arquivo editado à mão: o id de antes na parede e na lista dos jogadores.
    const texto = JSON.stringify(cru).replaceAll('livre_0badc0de', legado).replace('"ocultasDoJogador": []', `"ocultasDoJogador": ["${legado}"]`).replace('"ocultasDoJogador":[]', `"ocultasDoJogador":["${legado}"]`)
    const lido = deserializeMap(texto)
    expect(lido.ocultasDoJogador).toHaveLength(1)
    const view = doOlho(lido)
    expect(view.map.walls.some((w) => w.id === parede)).toBe(false)
    expect(JSON.stringify(view)).not.toContain('Segredo')
  })
})
