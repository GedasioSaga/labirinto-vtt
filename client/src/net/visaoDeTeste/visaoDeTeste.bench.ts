import { bench, describe } from 'vitest'
import { filterMapForPlayer } from '../../lib/fogFilter'
import { createEmptyMap } from '../../lib/mapFactory'
import { useMapStore } from '../../stores/mapStore'
import type { MapData, Token, Wall } from '../../types/map'
import { criarCamadaDeTeste } from './camadaDeTeste'
import type { HostBridge } from '../hostBridge'
import { singleSceneWorld } from '../hostSession'
import { criarBancada, semAventura } from './visaoDeTeste.fixture'

/**
 * VISÃO DE JOGADOR — quanto a ponte de teste custa ao editor por broadcast,
 * num mapa de 990 paredes com 1 jogador. Fora da suíte padrão: roda com
 * `npx vitest bench --run src/net/visaoDeTeste/visaoDeTeste.bench.ts`.
 *
 * - o recorte da névoa sozinho, com o mapa novo a cada vez (o mestre arrastou
 *   uma parede: o cache por referência não vale);
 * - a camada de teste reaplicada sobre o mapa novo;
 * - o broadcast inteiro da ponte de teste (camada + recorte + envio pelo canal);
 * - um arrasto de parede de 1 s com o teste aberto: quantos broadcasts saem e
 *   quanto tempo do editor eles tomam (os callbacks de timer acima de 2 ms),
 *   com a janela à vista e escondida.
 */

const GRADE = 50
const LADO = 60
const CENTRO = (LADO * GRADE) / 2
const ANA: Token = { id: 'tok-ana', characterId: null, name: 'Ana', x: CENTRO + 25, y: CENTRO + 25, size: 1, image: null }
const QUANTAS = 990

/** Paredes curtas espalhadas pela cena inteira (a maioria fora da vista); o entorno da Ana fica livre. */
function espalhadas(): Wall[] {
  const lista: Wall[] = []
  for (let i = 0; lista.length < QUANTAS; i += 1) {
    const x = (i * 37) % (LADO * GRADE)
    const y = (i * 91) % (LADO * GRADE)
    if (Math.abs(x - CENTRO) < 200 && Math.abs(y - CENTRO) < 200) continue
    lista.push({ id: `w${i}`, x1: x, y1: y, x2: x + 30 + (i % 5) * 10, y2: y + ((i % 7) - 3) * 10, blocksLight: true, blocksMove: true, door: null })
  }
  return lista
}

/** O pior caso: TODAS as paredes à vista, um anel fechado em volta da Ana (as paredes presas no contorno de um desenho). */
function anel(): Wall[] {
  const raio = 450
  const ponto = (i: number) => ({ x: CENTRO + raio * Math.cos((2 * Math.PI * i) / QUANTAS), y: CENTRO + raio * Math.sin((2 * Math.PI * i) / QUANTAS) })
  return Array.from({ length: QUANTAS }, (_, i) => {
    const a = ponto(i)
    const b = ponto(i + 1)
    return { id: `a${i}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, blocksLight: true, blocksMove: true, door: null }
  })
}

const ESPALHADAS: MapData = { ...createEmptyMap('m-990-espalhadas', 'Labirinto', LADO, LADO, GRADE), tokens: [ANA], walls: espalhadas() }
const BASE: MapData = { ...createEmptyMap('m-990', 'Desenho cercado', LADO, LADO, GRADE), tokens: [ANA], walls: anel() }

let rodada = 0
/** O mestre arrastou uma parede: mapa novo, a parede 500 um pouco para o lado. */
function mapaArrastado(): MapData {
  rodada += 1
  const desvio = rodada % 2 === 0 ? 0 : GRADE / 5
  return { ...BASE, walls: BASE.walls.map((w, i) => (i === 500 ? { ...w, x1: w.x1 + desvio, x2: w.x2 + desvio } : w)) }
}

const camada = criarCamadaDeTeste()
camada.registrar(BASE.id, (map) => ({ ...map, tokens: map.tokens.map((t) => (t.id === ANA.id ? { ...t, x: ANA.x + GRADE } : t)) }), ANA.id)

semAventura()
useMapStore.getState().loadMap(BASE)
const bancada = criarBancada()
const janela = await bancada.jogarCom(ANA.id)
// Um passo no teste: a camada da ponte tem uma entrada.
janela.conexao().requestMove(ANA.id, ANA.x + GRADE, ANA.y)
await new Promise((resolve) => setTimeout(resolve, 100))
function ponteAberta(): HostBridge {
  const aberta = bancada.controlador.ponte()
  if (aberta === null) throw new Error('a ponte de teste deveria estar aberta')
  return aberta
}
const ponte = ponteAberta()

describe('Visão de jogador, 990 paredes, 1 jogador', () => {
  bench('recorte da névoa, paredes espalhadas (a maioria fora da vista), mapa novo', () => {
    filterMapForPlayer({ ...ESPALHADAS }, 'p1', { p1: [ANA.id] }, 600)
  })

  bench('recorte da névoa, 990 paredes à vista, mapa novo', () => {
    filterMapForPlayer(mapaArrastado(), 'p1', { p1: [ANA.id] }, 600)
  })

  bench('camada de teste sobre o mapa novo', () => {
    camada.aplicarNoMundo(singleSceneWorld(mapaArrastado()))
  })

  bench('broadcast inteiro da ponte de teste depois de o mestre mexer', () => {
    useMapStore.setState({ map: mapaArrastado() })
    // `notifyTurnChanged` manda na hora (`broadcastNow`): o mesmo trabalho do broadcast do arrasto, sem esperar o intervalo.
    ponte.notifyTurnChanged()
  })

  bench('arrasto de parede de 1 s com o teste aberto (um passo a cada 16 ms)', () => arrastar(false), { iterations: 3, warmupIterations: 0, time: 0 })
  bench('arrasto de parede de 1 s com a janela de teste escondida', () => arrastar(true), { iterations: 3, warmupIterations: 0, time: 0 })
})

/** Um segundo de arrasto: o mestre muda a parede a cada 16 ms e avisa a ponte de teste, como o App. */
async function arrastar(escondida: boolean): Promise<void> {
  janela.visibilidade(escondida)
  await new Promise((resolve) => setTimeout(resolve, 0))
  const original = globalThis.setTimeout
  const longos: number[] = []
  // Mede cada callback de timer: é por um deles que o broadcast do intervalo sai.
  const medido: typeof setTimeout = (handler, timeout, ...args) =>
    original(() => {
      const inicio = performance.now()
      if (typeof handler === 'function') handler(...args)
      const gasto = performance.now() - inicio
      if (gasto > 2) longos.push(gasto)
    }, timeout)
  globalThis.setTimeout = medido
  try {
    const fim = performance.now() + 1000
    while (performance.now() < fim) {
      useMapStore.setState({ map: mapaArrastado() })
      ponte.notifyMapChanged()
      await new Promise((resolve) => original(resolve, 16))
    }
  } finally {
    globalThis.setTimeout = original
  }
  const total = longos.reduce((soma, ms) => soma + ms, 0)
  const maior = longos.reduce((max, ms) => Math.max(max, ms), 0)
  // A medida é a saída desta bancada: o tinybench só cronometra o segundo inteiro.
  console.info(`arrasto 1 s${escondida ? ' (escondida)' : ''}: ${longos.length} broadcasts, ${total.toFixed(0)} ms do editor, maior ${maior.toFixed(1)} ms`)
}
