/**
 * PARTÍCULAS DO MAPA na tela do jogador (auditoria da frente B, 09/11/2026).
 * O jogador só recebe os fogos que enxerga. "Nenhum fogo no recorte" não é
 * "cena sem fogo": quem diz que a cena não tem fogo é o host, no recorte. Sem
 * isso, numa cena cheia de fogos fora da vista dele a fumaça e as brasas
 * nasciam espalhadas pela tela toda. Pacote forjado, dados inventados.
 */
import { describe, expect, it } from 'vitest'
import { Container, Sprite, Ticker } from 'pixi.js'
import type { MapData, Prop, TipoMobilia, Token } from '../types/map'
import { filterMapForPlayer } from '../lib/fogFilter'
import { createEmptyMap } from '../lib/mapFactory'
import { particulasDoJogador, particulasDoMestre } from '../lib/particulasDaCena'
import { criarParticulasDoMapa, type ParticulasDoMapa } from './particulasDoMapa'

const GRID = 50
const HEROI = { x: 600, y: 400 }
/** A visão do jogador nesta cena: 6 casas. */
const VISAO = 6 * GRID
const QUADRO_MS = 16
/** Três segundos de tela: tempo de sobra para o teto encher. */
const QUADROS = 190

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

function movel(id: string, mobilia: TipoMobilia, x: number, y: number): Prop {
  return { id, src: '', x, y, width: GRID, height: GRID, linkedMapPath: null, mobilia }
}

function fogo(id: string, x: number, y: number): Prop {
  return movel(id, 'fogo', x, y)
}

function floresta(props: Prop[]): MapData {
  return { ...createEmptyMap('floresta', 'Floresta', 120, 40, GRID), tokens: [ficha('heroi', HEROI.x, HEROI.y)], props, particulas: { fumaca: 'muita', brasas: 'muita' } }
}

/** O recorte que o host manda ao jogador dono do herói. */
function recorteDoJogador(map: MapData): MapData {
  return filterMapForPlayer(map, 'ana', { ana: ['heroi'] }, VISAO).map
}

/** A camada numa tela de 1600 x 900 com a câmera na origem, e o relógio batido à mão. */
function tela(): { particulas: ParticulasDoMapa; bater: (quadros: number) => void } {
  const ticker = new Ticker()
  let agora = 1000
  const particulas = criarParticulasDoMapa({ ticker, reducedMotion: () => false, mundo: new Container(), tela: () => ({ width: 1600, height: 900 }) })
  return {
    particulas,
    bater: (quadros) => {
      for (let i = 0; i < quadros; i += 1) ticker.update((agora += QUADRO_MS))
    },
  }
}

function sprites(no: Container): Sprite[] {
  return no.children.flatMap((filho) => (filho instanceof Sprite ? (filho.visible ? [filho] : []) : sprites(filho)))
}

describe('partículas na tela do jogador', () => {
  it('cena que TEM fogo, com nenhum no recorte do jogador: nada é desenhado', () => {
    const recorte = recorteDoJogador(floresta([fogo('longe', HEROI.x + 45 * GRID, HEROI.y)]))
    expect(recorte.props).toEqual([])
    const { particulas, bater } = tela()
    particulas.atualizar(recorte.id, particulasDoJogador(recorte))
    bater(QUADROS)
    expect(sprites(particulas.camada)).toEqual([])
    particulas.destruir()
  })

  it('cena SEM fogo: o host avisa no recorte e elas nascem espalhadas; com fogo à vista, nascem só dele', () => {
    const semFogo = recorteDoJogador(floresta([]))
    expect(semFogo.particulasSemFogo).toBe(true)
    const espalhadas = tela()
    espalhadas.particulas.atualizar(semFogo.id, particulasDoJogador(semFogo))
    espalhadas.bater(QUADROS)
    const larguraDasEspalhadas = Math.max(...sprites(espalhadas.particulas.camada).map((s) => s.x)) - Math.min(...sprites(espalhadas.particulas.camada).map((s) => s.x))
    expect(larguraDasEspalhadas).toBeGreaterThan(800)
    espalhadas.particulas.destruir()

    const comFogo = recorteDoJogador(floresta([fogo('perto', HEROI.x + 2 * GRID, HEROI.y)]))
    expect(comFogo.particulasSemFogo).toBeUndefined()
    const doFogo = tela()
    doFogo.particulas.atualizar(comFogo.id, particulasDoJogador(comFogo))
    doFogo.bater(QUADROS)
    const vivas = sprites(doFogo.particulas.camada)
    expect(vivas.length).toBeGreaterThan(0)
    // Nascem no fogo e sobem com o vento: nenhuma a mais de 4 casas para o lado dele.
    expect(vivas.every((s) => Math.abs(s.x - (HEROI.x + 2 * GRID)) < 4 * GRID && s.y < HEROI.y + GRID)).toBe(true)
    doFogo.particulas.destruir()
  })
})

/*
 * Segunda auditoria (09/11/2026): fogueira, lareira e fornalha iluminavam mas
 * não soltavam nada. A cena só com fogueira contava como "sem fogo" e a fumaça
 * nascia espalhada pela tela toda, para o mestre e para o jogador.
 */
describe('fogueira, lareira e fornalha soltam fumaça e brasas', () => {
  const QUE_SOLTAM: readonly TipoMobilia[] = ['fogueira', 'lareira', 'fornalha']
  const PERTO = { x: HEROI.x + 2 * GRID, y: HEROI.y }

  it('cena só com uma delas, no mestre: as partículas nascem dela e o modo espalhado não liga; o lampião não solta', () => {
    for (const tipo of QUE_SOLTAM) {
      const cena = floresta([movel('acesa', tipo, PERTO.x, PERTO.y)])
      const entrada = particulasDoMestre(cena)
      expect(entrada?.espalhar, tipo).toBe(false)
      const { particulas, bater } = tela()
      particulas.atualizar(cena.id, entrada)
      bater(QUADROS)
      const vivas = sprites(particulas.camada)
      expect(vivas.length, tipo).toBeGreaterThan(0)
      // Nascem no fogo e sobem com o vento: nenhuma a mais de 4 casas para o lado dele.
      expect(vivas.every((s) => Math.abs(s.x - PERTO.x) < 4 * GRID && s.y < PERTO.y + GRID), tipo).toBe(true)
      particulas.destruir()
    }
    // O lampião só ilumina: a cena só com ele segue sem fogo.
    expect(particulasDoMestre(floresta([movel('lampiao', 'lampiao', PERTO.x, PERTO.y)]))?.espalhar).toBe(true)
  })

  it('jogador sem a fogueira à vista: o host não diz "cena sem fogo" e nada é desenhado', () => {
    const recorte = recorteDoJogador(floresta([movel('longe', 'fogueira', HEROI.x + 45 * GRID, HEROI.y)]))
    expect(recorte.props).toEqual([])
    expect(recorte.particulasSemFogo).toBeUndefined()
    const { particulas, bater } = tela()
    particulas.atualizar(recorte.id, particulasDoJogador(recorte))
    bater(QUADROS)
    expect(sprites(particulas.camada)).toEqual([])
    particulas.destruir()
  })
})

describe('troca de cena', () => {
  it('as partículas da cena anterior somem na hora, sem terminar de apagar nas coordenadas dela', () => {
    const { particulas, bater } = tela()
    const antes = recorteDoJogador(floresta([fogo('perto', HEROI.x + 2 * GRID, HEROI.y)]))
    particulas.atualizar(antes.id, particulasDoJogador(antes))
    bater(QUADROS)
    expect(sprites(particulas.camada).length).toBeGreaterThan(0)
    // A cena nova não tem partículas.
    particulas.atualizar('outra-cena', null)
    expect(sprites(particulas.camada)).toEqual([])
    particulas.destruir()
  })
})
