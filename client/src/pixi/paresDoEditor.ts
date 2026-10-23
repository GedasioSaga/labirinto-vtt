/**
 * Os pares (faixa, camada) com itens no EDITOR, só das faixas que dividem os
 * itens por nó da pilha (paredes, portas, linhas, marcadores, escadas,
 * desenhos, móveis, luzes). É a entrada `pares` de `pilhaDeCamadas.ts`.
 *
 * Memorizados pela referência de cada lista (a store é imutável) e pelo
 * modelo (camada livre apagada devolve o item à padrão do tipo). Tudo, não só
 * o visível: esconder camada não remonta a pilha.
 *
 * Fora daqui (fatia 3b, antes da 8): fichas, pinos, salas, texto, chão,
 * raster, carimbos e telhados com camada escolhida continuam no container de
 * hoje — a ordem e a opacidade da camada deles valem, o nó próprio não.
 */
import type { Drawing, MapData, Stair, Wall } from '../types/map'
import type { ParDeFaixa } from '../lib/camadas/ordem'
import { contextoDeCamadas } from '../lib/camadas/consulta'
import { desenhoFicaSobAsSalas } from '../lib/desenhoSobAsSalas'
import { paresDosItens } from './pilhaDeCamadas'

export function criarParesDoEditor(): (map: MapData) => ParDeFaixa[] {
  const memo = new WeakMap<readonly object[], { modelo: MapData['modeloCamadas']; pares: ParDeFaixa[] }>()
  const daLista = (lista: readonly object[], modelo: MapData['modeloCamadas'], calcular: () => ParDeFaixa[]): ParDeFaixa[] => {
    const pronto = memo.get(lista)
    if (pronto !== undefined && pronto.modelo === modelo) return pronto.pares
    const pares = calcular()
    memo.set(lista, { modelo, pares })
    return pares
  }
  return (map) => {
    const camadas = contextoDeCamadas(map)
    const modelo = map.modeloCamadas
    const deParede = (w: Wall) => camadas.camadaDe('parede', w)
    const deEscada = (s: Stair) => camadas.camadaDe('escada', s)
    const deDesenho = (d: Drawing) => camadas.camadaDe('desenho', d)
    return [
      ...daLista(map.walls, modelo, () => [
        ...paresDosItens('wallsGraphics', map.walls, deParede),
        ...paresDosItens('doorsGraphics', map.walls.filter((w) => w.door !== null), deParede),
      ]),
      ...daLista(map.lines, modelo, () => paresDosItens('mapLinesGraphics', map.lines, (l) => camadas.camadaDe('linha', l))),
      ...daLista(map.markers, modelo, () => paresDosItens('mapLinesGraphics', map.markers, (m) => camadas.camadaDe('marcador', m))),
      ...daLista(map.stairs, modelo, () => [
        ...paresDosItens('stairsGraphics', map.stairs.filter((s) => !s.secret), deEscada),
        ...paresDosItens('secretStairsGraphics', map.stairs.filter((s) => s.secret), deEscada),
      ]),
      ...daLista(map.drawings, modelo, () => {
        // O Texto tem renderer próprio (`textLabelsContainer`): `drawDrawings` o pula.
        const traços = map.drawings.filter((d) => d.kind !== 'text')
        const sob = traços.filter(desenhoFicaSobAsSalas)
        const sobre = traços.filter((d) => !desenhoFicaSobAsSalas(d))
        return [
          ...paresDosItens('drawingsGraphics', sob.filter((d) => !d.secret), deDesenho),
          ...paresDosItens('secretDrawingsGraphics', sob.filter((d) => d.secret), deDesenho),
          ...paresDosItens('pathsGraphics', sobre.filter((d) => !d.secret), deDesenho),
          ...paresDosItens('secretPathsGraphics', sobre.filter((d) => d.secret), deDesenho),
        ]
      }),
      ...daLista(map.props, modelo, () => paresDosItens('propsContainer', map.props, (p) => camadas.camadaDe('objeto', p))),
      ...daLista(map.lights, modelo, () => paresDosItens('lightsContainer', map.lights, (l) => camadas.camadaDe('luz', l))),
    ]
  }
}
