import type * as Three from 'three'

/** O módulo `three` inteiro, recebido por parâmetro: ele só baixa quando uma transição toca. */
export type ThreeModule = typeof Three

/** O que o motor entrega para a cena montar o som dela. */
export interface KitDeSom {
  ctx: AudioContext
  /** Ligue aqui o que toca; o motor cuida do volume e do mudo. */
  destino: AudioNode
  /** Ruído branco de `segundos`, reaproveitado entre chamadas. */
  ruido: (segundos: number) => AudioBuffer
}

export interface QuadroDaCena {
  /** 0 = cena visível, 1 = tela toda preta (fade de entrada e de saída). */
  fade: number
}

/**
 * Uma cena de transição. O tempo vem de fora (`atualizar(t)`), nunca de um
 * relógio interno: assim o motor escala a duração e a miniatura é sempre o
 * mesmo quadro.
 */
export interface CenaTransicao {
  scene: Three.Scene
  camera: Three.PerspectiveCamera
  atualizar: (t: number) => QuadroDaCena
  /** Chamado a cada mudança de tamanho; a cena abre o campo de visão em tela estreita. */
  ajustarTela: (aspecto: number) => void
  /**
   * Monta o som e devolve quem dispara as pistas pelo tempo da cena. Cada
   * pista toca uma vez por volta; `reiniciar` esquece as já tocadas.
   */
  criarSom?: (kit: KitDeSom) => { atualizar: (t: number) => void; reiniciar: () => void }
  descartar: () => void
}

export interface OpcoesDaCena {
  reduzirMovimento: boolean
}

export type CriarCena = (THREE: ThreeModule, opcoes: OpcoesDaCena) => CenaTransicao
