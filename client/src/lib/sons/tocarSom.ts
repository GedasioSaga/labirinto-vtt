import { estaCalado, useSomStore, type PreferenciaDeSom } from '../../stores/somStore'
import { obterSaidaDeSom, type SaidaDeSom } from './contexto'
import { RECEITAS, type SomId } from './receitas'
import { tocarReceita } from './sintetizador'

/**
 * TOCAR UM SOM DE CLIMA pelo nome: `tocarSom('item')`. É a única porta de
 * quem dispara som (jogador, mestre, controle de volume): respeita mudo e
 * volume (`estaCalado`), não toca antes do primeiro gesto destravar o áudio e
 * não repete o mesmo som em rajada. A amostra do controle de volume passa pela
 * mesma porta, mas fora do intervalo mínimo (`tocarAmostra`).
 */

/**
 * Intervalo mínimo entre dois toques do MESMO som, em ms. A chegada de uma
 * viagem e a troca de cena vêm em mensagens separadas, a poucos ms uma da
 * outra, e tocariam a passagem duas vezes; uma alavanca que abre cinco portas
 * não pode virar cinco rangidos.
 */
export const INTERVALO_MINIMO_MS: Record<SomId, number> = {
  passagem: 1500,
  item: 600,
  portaAbre: 250,
  portaFecha: 250,
  trancada: 400,
  dado: 300,
  aviso: 2000,
}

/** Produz o som `id` na saída e diz se tocou. */
export type ProduzirSom<N> = (saida: SaidaDeSom<N>, id: SomId, volume: number) => boolean

export interface OpcoesDoTocador<N> {
  obterSaida: () => SaidaDeSom<N> | null
  lerPreferencia: () => PreferenciaDeSom
  /** Relógio em ms, monotônico. */
  agora: () => number
  /**
   * Como cada som é produzido. O padrão sintetiza a receita; para trocar um
   * som por gravação CC0, só esta função muda para aquele id — quem chama
   * `tocarSom(id)` continua igual.
   */
  produzir?: ProduzirSom<N>
}

export interface OpcoesDoToque {
  /**
   * AMOSTRA do controle de volume: fica fora do intervalo mínimo, sem ler nem
   * gravar o último toque do som. Quem mexe na barra quer ouvir cada passo
   * (cinco setas, cinco sinos), e o item de verdade que chega logo depois da
   * amostra não pode ficar mudo por causa dela. Mudo, volume e destravamento
   * valem igual.
   */
  amostra?: boolean
}

export type TocarSom = (id: SomId, opcoes?: OpcoesDoToque) => boolean

function sintetizarReceita<N>(saida: SaidaDeSom<N>, id: SomId, volume: number): boolean {
  return tocarReceita(saida, RECEITAS[id], volume)
}

export function criarTocador<N>({ obterSaida, lerPreferencia, agora, produzir = sintetizarReceita }: OpcoesDoTocador<N>): TocarSom {
  const ultimoToque = new Map<SomId, number>()
  return (id, { amostra = false } = {}) => {
    const preferencia = lerPreferencia()
    if (estaCalado(preferencia)) return false
    const instante = agora()
    const anterior = amostra ? undefined : ultimoToque.get(id)
    if (anterior !== undefined && instante - anterior < INTERVALO_MINIMO_MS[id]) return false
    const saida = obterSaida()
    // Antes do gesto não há saída, e contexto suspenso não toca: nada sai antes do destravamento.
    if (saida === null || saida.ctx.state !== 'running') return false
    const tocou = produzir(saida, id, preferencia.volume)
    // Só o que tocou conta para o intervalo: som que falhou pode tentar de novo logo. A amostra nunca conta.
    if (tocou && !amostra) ultimoToque.set(id, instante)
    return tocou
  }
}

export const tocarSom = criarTocador({
  obterSaida: obterSaidaDeSom,
  lerPreferencia: () => useSomStore.getState(),
  agora: () => performance.now(),
})

/** A amostra do controle de volume (`ControleDeSom`): o `tocarSom` fora do intervalo mínimo. */
export const tocarAmostra = (id: SomId): boolean => tocarSom(id, { amostra: true })
