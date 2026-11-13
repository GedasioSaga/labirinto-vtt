import { Container } from 'pixi.js'
import type { MapData } from '../types/map'
import { abrigoDoJogador, SEM_ABRIGO, type AbrigoDoAmbiente } from '../lib/abrigoDoAmbiente'
import type { AmbienteRenderer } from './drawAmbiente'
import type { NeblinaRenderer } from './drawNeblina'
import { entradaDoAmbiente } from './neblinaNoEditor'

/**
 * O AMBIENTE NA TELA DO JOGADOR (`drawAmbiente.ts`). A neblina e as
 * partículas andam juntas numa camada só ("clima"): a tela do jogador já põe
 * a camada da neblina no lugar certo da pilha (acima da névoa e da tinta,
 * abaixo do contorno das fichas), e as partículas vão logo acima dela.
 */
export function juntarNeblinaEAmbiente(neblina: NeblinaRenderer, ambiente: AmbienteRenderer): NeblinaRenderer {
  const clima = new Container()
  clima.label = 'clima'
  clima.eventMode = 'none'
  clima.interactiveChildren = false
  clima.addChild(neblina.camada, ambiente.camada)
  return {
    camada: clima,
    atualizar: neblina.atualizar,
    setAbrigo: neblina.setAbrigo,
    setPeriodo(periodo) {
      neblina.setPeriodo(periodo)
      ambiente.setPeriodo(periodo)
    },
    destruir() {
      neblina.destruir()
      ambiente.destruir()
      clima.destroy()
    },
  }
}

/** O último abrigo calculado: o recorte chega a cada passo de ficha, e salas e paredes quase nunca mudam. */
const abrigoLembrado = new WeakMap<AmbienteRenderer, { regions: MapData['regions']; walls: MapData['walls']; seco: string; abrigo: AbrigoDoAmbiente }>()

function abrigoDoRecorte(ambiente: AmbienteRenderer, recorte: MapData): AbrigoDoAmbiente {
  const seco = (recorte.ambienteSeco ?? []).join(',')
  const lembrado = abrigoLembrado.get(ambiente)
  if (lembrado !== undefined && lembrado.regions === recorte.regions && lembrado.walls === recorte.walls && lembrado.seco === seco) return lembrado.abrigo
  const abrigo = abrigoDoJogador(recorte)
  abrigoLembrado.set(ambiente, { regions: recorte.regions, walls: recorte.walls, seco, abrigo })
  return abrigo
}

/**
 * Liga o Ambiente do recorte. As partículas seguem a regra das partículas da
 * cena: saem no modo leve e com "Efeitos do mapa" desligado (`particulas` =
 * false). O abrigo vale também para a neblina (que fica à vista sem os efeitos).
 * Brasas e fumaça do mapa inteiro só saem daqui quando o host diz que a cena
 * não tem fogo (`particulasSemFogo`); com fogo, nascem dos fogos.
 */
export function atualizarAmbienteDoJogador(ambiente: AmbienteRenderer, neblina: NeblinaRenderer, recorte: MapData, abrigoLigado: boolean, particulas: boolean): void {
  const largura = recorte.width * recorte.grid
  const altura = recorte.height * recorte.grid
  ambiente.setAbrigo(abrigoLigado ? abrigoDoRecorte(ambiente, recorte) : SEM_ABRIGO, largura, altura, recorte.grid)
  neblina.setAbrigo(ambiente.ar(), largura, altura)
  ambiente.atualizar(particulas ? entradaDoAmbiente(recorte, recorte.ambientePintado, recorte.particulasSemFogo === true, true) : null)
}
