import { Container, Sprite, type Texture } from 'pixi.js'
import { CICLO_DA_CHAMA_MS, type MovimentoDasChamas } from './chamasDasFogueiras'
import { faseDoId } from './mapaDeLuz'

/**
 * O BRILHO QUE MEXE dos carimbos (lote C6 de 14/11/2026: a brasa da rocha
 * vulcânica). O carimbo com `brilho` (`DefinicaoDeCarimbo.brilho`, a parte que
 * acende, no mesmo quadro do desenho) ganha UM sprite por objeto, da textura
 * do brilho assada uma vez por desenho (como o corpo), somado por cima dos
 * corpos (`blendMode 'add'`), numa camada logo acima deles
 * (`pixi/drawCarimbos.ts`).
 *
 * O PULSO NÃO PESA O QUADRO: os sprites vão em `FASES_DO_BRILHO` contêineres,
 * cada objeto no da fase do id dele (`faseDoId`, a mesma nas duas telas), e o
 * relógio só escreve o `alpha` desses contêineres, um passo a cada 100 ms —
 * 4 escritas por passo, com 1 rocha ou com 1.000. Nada de chama por rocha (a
 * chama do braseiro é um nó por objeto: cara em spray).
 *
 * O relógio só fica inscrito com brilho na cena e movimento normal; com "menos
 * movimento" do sistema (ou sem relógio: testes, exportar imagem) o brilho
 * fica parado em `ALFA_DO_BRILHO_PARADO`, como a chama fica na pose fixa
 * (`chamasDasFogueiras.ts`). No jogador o brilho mora dentro da camada dos
 * carimbos, então passa pelo mesmo recorte do conhecido que os corpos.
 */

/** Quantos contêineres de fase: as rochas não pulsam todas juntas, e o relógio escreve só isto por passo. */
export const FASES_DO_BRILHO = 4
/** O passo do pulso, em ms (10 por segundo, o do tremor da luz do fogo em `mapaDeLuz.ts`). */
export const PASSO_DO_BRILHO_MS = 100
/** O alpha do brilho parado ("menos movimento" ou sem relógio): perto do meio do pulso. */
export const ALFA_DO_BRILHO_PARADO = 0.75
/** O pulso vai de... */
export const ALFA_DO_BRILHO_MIN = 0.55
/** ...até. */
export const ALFA_DO_BRILHO_MAX = 1
/** De quanto em quanto tempo, com o brilho pulsando, o relógio confere se a pessoa passou a pedir menos movimento. */
const CONFERIR_MOVIMENTO_MS = 1000

/**
 * O alpha do brilho no instante `tempoMs`, para a `fase` (0 a 1), entre
 * `ALFA_DO_BRILHO_MIN` e `ALFA_DO_BRILHO_MAX`. A forma é a do tremor da luz do
 * fogo (`tremorDoFogo`: 5 partes da onda lenta para 3 da rápida), nos
 * harmônicos 4 e 10 do ciclo da chama (1,67 e 4,17 por segundo, os mais perto
 * dos 1,7 e 4,3 do tremor): o tempo entra módulo o ciclo, e a volta não salta.
 */
export function pulsoDoBrilho(tempoMs: number, fase: number): number {
  const noCiclo = ((tempoMs % CICLO_DA_CHAMA_MS) + CICLO_DA_CHAMA_MS) % CICLO_DA_CHAMA_MS
  const s = noCiclo / CICLO_DA_CHAMA_MS
  const volta = 2 * Math.PI
  const onda = 0.625 * Math.sin(volta * (4 * s + fase)) + 0.375 * Math.sin(volta * (10 * s + 2 * fase))
  const meio = (ALFA_DO_BRILHO_MAX + ALFA_DO_BRILHO_MIN) / 2
  const amplitude = (ALFA_DO_BRILHO_MAX - ALFA_DO_BRILHO_MIN) / 2
  return meio + amplitude * onda
}

/** O contêiner de fase do objeto (0 a `FASES_DO_BRILHO - 1`), pelo id: o mesmo nas duas telas. */
export function faseDoBrilho(id: string): number {
  return Math.min(FASES_DO_BRILHO - 1, Math.floor(faseDoId(id) * FASES_DO_BRILHO))
}

/** Um objeto com brilho, como o palco dos carimbos o entrega. */
export interface BrilhoNoPalco {
  /** O id do carimbo no mapa. */
  id: string
  textura: Texture
  /** Põe o sprite onde está o corpo (a textura do brilho, a âncora, a posição, a escala e o giro dele). */
  posicionar: (sprite: Sprite) => void
}

export interface BrilhoDosCarimbos {
  /** A camada: logo acima dos corpos dos carimbos. */
  readonly camada: Container
  /** Os objetos com brilho de agora (os outros saem); liga ou desliga o relógio. */
  sincronizar: (itens: readonly BrilhoNoPalco[]) => void
  /** O brilho dos objetos que a borracha vai tirar fica com o `alfa` deles (os outros voltam ao cheio). */
  esmaecer: (ids: ReadonlySet<string>, alfa: number) => void
  destruir: () => void
}

/**
 * Cria o brilho de uma tela, com o relógio fechado por closure: instanciar
 * junto do palco dos carimbos de cada montagem, nunca em escopo de módulo.
 */
export function createBrilhoDosCarimbos(opcoes: { movimento?: MovimentoDasChamas } = {}): BrilhoDosCarimbos {
  const { movimento } = opcoes
  const agora = movimento?.agora ?? (() => performance.now())
  const camada = new Container()
  camada.label = 'carimbos-brilho'
  camada.eventMode = 'none'
  const fases: Container[] = []
  for (let k = 0; k < FASES_DO_BRILHO; k += 1) {
    const fase = new Container()
    fase.label = `carimbos-brilho-${k}`
    fase.alpha = ALFA_DO_BRILHO_PARADO
    fases.push(fase)
    camada.addChild(fase)
  }
  const sprites = new Map<string, Sprite>()
  let noRelogio = false
  let passoAtual = -1
  let conferidoEm = 0

  function semMovimento(): boolean {
    return movimento === undefined || movimento.reducedMotion()
  }

  function parar(): void {
    passoAtual = -1
    for (const fase of fases) fase.alpha = ALFA_DO_BRILHO_PARADO
  }

  function passo(): void {
    const t = agora()
    if (Math.abs(t - conferidoEm) >= CONFERIR_MOVIMENTO_MS) {
      conferidoEm = t
      if (semMovimento()) {
        sairDoRelogio()
        parar()
        return
      }
    }
    const p = Math.floor(t / PASSO_DO_BRILHO_MS)
    if (p === passoAtual) return
    passoAtual = p
    // O meio de cada faixa de fase: as quatro ficam espalhadas pelo ciclo.
    for (let k = 0; k < FASES_DO_BRILHO; k += 1) fases[k].alpha = pulsoDoBrilho(p * PASSO_DO_BRILHO_MS, (k + 0.5) / FASES_DO_BRILHO)
  }

  function entrarNoRelogio(): void {
    if (noRelogio || movimento === undefined) return
    noRelogio = true
    conferidoEm = agora()
    movimento.ticker.add(passo)
  }

  function sairDoRelogio(): void {
    if (!noRelogio || movimento === undefined) return
    noRelogio = false
    movimento.ticker.remove(passo)
  }

  /** Relógio só com brilho na cena e movimento normal; senão, o brilho parado. */
  function ligarOuDesligar(): void {
    if (sprites.size > 0 && !semMovimento()) {
      entrarNoRelogio()
      return
    }
    sairDoRelogio()
    parar()
  }

  return {
    camada,
    sincronizar(itens) {
      const vivos = new Set<string>()
      for (const item of itens) {
        vivos.add(item.id)
        let sprite = sprites.get(item.id)
        if (sprite === undefined) {
          sprite = new Sprite(item.textura)
          sprite.blendMode = 'add'
          sprites.set(item.id, sprite)
          fases[faseDoBrilho(item.id)].addChild(sprite)
        }
        item.posicionar(sprite)
      }
      for (const [id, sprite] of [...sprites]) {
        if (vivos.has(id)) continue
        sprite.destroy()
        sprites.delete(id)
      }
      ligarOuDesligar()
    },
    esmaecer(ids, alfa) {
      for (const [id, sprite] of sprites) sprite.alpha = ids.has(id) ? alfa : 1
    },
    destruir() {
      sairDoRelogio()
      sprites.clear()
      camada.removeFromParent()
      camada.destroy({ children: true })
    },
  }
}
