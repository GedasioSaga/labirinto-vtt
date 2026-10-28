/**
 * ABRIR O MAPA sem uma tarefa longa só (otimização 200x200, fatia F8).
 *
 * Perfil da abertura no mapa real (200x200, 27/10/2026): a montagem do canvas
 * do mestre era uma tarefa de 600-850 ms, e o maior pedaço dela era o contorno
 * do chão (marching squares sobre o campo de distância, 150-340 ms) da
 * primeira pintura. Aqui o contorno sai numa tarefa PRÓPRIA enquanto o Pixi
 * inicia, e fica guardado (`buildFloorOutline`, cache da F5 pela lista de
 * peças): a primeira pintura acha o contorno pronto. Os bytes são os mesmos,
 * a mesma função calcula; só muda em que tarefa.
 */
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { buildFloorOutline, mapFloorClip } from '../lib/floorContour'
import type { MapData } from '../types/map'

/** Uma tarefa nova do navegador (não microtarefa): o que vem depois não soma na tarefa de agora. */
export function proximaTarefa(): Promise<void> {
  return new Promise((resolver) => setTimeout(resolver, 0))
}

/** A primeira pintura do editor vai contornar o chão deste mapa? (o mesmo teste de `paintFloor`) */
function vaiContornar(map: MapData): boolean {
  return map.floorStyle.renderMode !== 'raster' && map.floor.length > 0 && contextoDeCamadas(map).mestreVe('chao')
}

/**
 * Calcula, numa tarefa própria, o contorno do chão que a primeira pintura do
 * editor vai pedir (mesma lista, mesmo passo, mesmo recorte de `paintFloor`).
 * Resolve `true` quando calculou (quem chama começa a montagem noutra tarefa)
 * e `false`, na hora e sem tarefa nova, quando não há o que contornar (mapa
 * sem chão, render fiel). Nunca rejeita: se algo falhar aqui, a pintura refaz
 * e mostra o erro dela.
 */
export function preaquecerContornoDoChao(lerMapa: () => MapData): Promise<boolean> {
  let map: MapData
  try {
    map = lerMapa()
    if (!vaiContornar(map)) return Promise.resolve(false)
  } catch {
    return Promise.resolve(false)
  }
  return new Promise((resolver) => {
    setTimeout(() => {
      try {
        buildFloorOutline(map.floor, { step: map.floorStyle.sampleStep, clip: mapFloorClip(map) })
      } catch {
        // A primeira pintura chama a mesma função e trata o erro onde sempre tratou.
      }
      resolver(true)
    }, 0)
  })
}
