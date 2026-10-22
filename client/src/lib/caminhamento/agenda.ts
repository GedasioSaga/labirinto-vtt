import type { Wall } from '../../types/map'
import { acharCaminhoNaMalha, avancarBusca, type Busca, type ConsultaDeCaminho, iniciarBusca, largarBusca, type ResultadoDoCaminho } from './busca'
import { criarMalha, type Malha, type MapaDoCaminho, malhaPronta, mesmaEstrutura } from './malha'
import { avancarMalha } from './marcos'

/**
 * AGENDA DE CAMINHOS — reparte o trabalho do motor pelos quadros: monta a
 * malha e anda as buscas em fatias pequenas, até gastar o orçamento do quadro
 * (`rodar(ms)`). Trinta NPCs replanejando num mapa grande não viram uma
 * tarefa longa: cada fatia custa frações de milissegundo e a agenda para no
 * fim do orçamento. Quem pediu pega a resposta num quadro seguinte (`pegar`).
 *
 * REVEZAMENTO: uma fatia de cada pedido por vez, na ordem em que chegaram, e
 * quem não acabou vai para o fim da fila. Uma busca cara (destino atrás de
 * porta trancada num mapa grande: duas rodadas varrem o mapa inteiro) não
 * segura as outras atrás dela. O preço: cada busca começada guarda a memória
 * dela até acabar (no mapa de 300 x 300 casas, uns 2 MB). O caminho não
 * depende de quantas fatias levou nem de com quem revezou.
 *
 * O relógio entra de fora (`performance.now` no app, um relógio falso no
 * teste): o motor não lê relógio nem sorte.
 */

/**
 * Orçamento sugerido por quadro (60 por segundo). A agenda não começa a fatia
 * que, pelo custo da mais cara já feita no quadro, passaria dele: o quadro só
 * passa do orçamento quando uma fatia demora mais que as anteriores.
 */
export const ORCAMENTO_POR_QUADRO_MS = 1.5
/** Pontos da rede por fatia de busca: bem abaixo de um milissegundo. */
export const PONTOS_POR_FATIA = 1500
/** Paredes por fatia de montagem da malha. */
export const PAREDES_POR_FATIA = 16
/** Malhas guardadas (uma por mapa e tamanho de ficha). */
const MALHAS_GUARDADAS = 8

interface EntradaDoCache {
  malha: Malha
  /** As últimas paredes conferidas contra esta malha: mesma lista, nem compara. */
  ultimas: readonly Wall[]
}

export class CacheDeMalhas {
  private readonly entradas: EntradaDoCache[] = []

  /** A malha deste mapa para a ficha de raio `raio` — talvez ainda por montar (`malhaPronta`). */
  malhaPara(mapa: MapaDoCaminho, raio: number): Malha {
    const largura = Math.max(1, Math.ceil(mapa.width))
    const altura = Math.max(1, Math.ceil(mapa.height))
    const indice = this.entradas.findIndex(
      (e) =>
        e.malha.grid === mapa.grid &&
        e.malha.largura === largura &&
        e.malha.altura === altura &&
        e.malha.raio === raio &&
        (e.ultimas === mapa.walls || mesmaEstrutura(e.malha.paredes, mapa.walls)),
    )
    const achada = this.entradas[indice]
    if (achada !== undefined) {
      achada.ultimas = mapa.walls
      // A mais usada vai para a frente; a que fica no fim é a que sai.
      this.entradas.splice(indice, 1)
      this.entradas.unshift(achada)
      return achada.malha
    }
    const malha = criarMalha(mapa, raio)
    this.entradas.unshift({ malha, ultimas: mapa.walls })
    if (this.entradas.length > MALHAS_GUARDADAS) this.entradas.length = MALHAS_GUARDADAS
    return malha
  }
}

/** O caminho já, montando o que faltar da malha (teste, mapa pequeno, robô). */
export function caminhoAgora(cache: CacheDeMalhas, mapa: MapaDoCaminho, raio: number, consulta: ConsultaDeCaminho): ResultadoDoCaminho {
  return acharCaminhoNaMalha(cache.malhaPara(mapa, raio), mapa.walls, consulta)
}

interface Trabalho {
  paredes: readonly Wall[]
  consulta: ConsultaDeCaminho
  malha: Malha
  busca: Busca | null
}

export interface OpcoesDaAgenda {
  pontosPorFatia?: number
  paredesPorFatia?: number
}

export class AgendaDeCaminhos {
  readonly cache = new CacheDeMalhas()
  private readonly fila = new Map<string, Trabalho>()
  private readonly prontos = new Map<string, ResultadoDoCaminho>()
  private readonly pontosPorFatia: number
  private readonly paredesPorFatia: number

  constructor(
    private readonly relogio: () => number,
    opcoes: OpcoesDaAgenda = {},
  ) {
    this.pontosPorFatia = opcoes.pontosPorFatia ?? PONTOS_POR_FATIA
    this.paredesPorFatia = opcoes.paredesPorFatia ?? PAREDES_POR_FATIA
  }

  /** Pede o caminho de `id` (o pedido anterior dele, se ainda na fila, sai; a resposta dele, se não pega, também). */
  pedir(id: string, mapa: MapaDoCaminho, raio: number, consulta: ConsultaDeCaminho): void {
    this.cancelar(id)
    this.fila.set(id, { paredes: mapa.walls, consulta, malha: this.cache.malhaPara(mapa, raio), busca: null })
  }

  cancelar(id: string): void {
    const antigo = this.fila.get(id)
    if (antigo !== undefined && antigo.busca !== null) largarBusca(antigo.busca)
    this.fila.delete(id)
    this.prontos.delete(id)
  }

  pendente(id: string): boolean {
    return this.fila.has(id)
  }

  /** A resposta de `id`, se já saiu; quem pega a leva (a próxima chamada devolve `undefined`). */
  pegar(id: string): ResultadoDoCaminho | undefined {
    const resultado = this.prontos.get(id)
    if (resultado !== undefined) this.prontos.delete(id)
    return resultado
  }

  get temTrabalho(): boolean {
    return this.fila.size > 0
  }

  /**
   * Trabalha no máximo `orcamentoMs` (ou até acabar a fila), uma fatia de cada
   * pedido por vez; a primeira fatia do quadro sempre vai, para a fila andar.
   * Devolve os ms gastos.
   */
  rodar(orcamentoMs: number): number {
    const inicio = this.relogio()
    let agora = inicio
    let feitas = 0
    let fatiaMaisCara = 0
    while (this.fila.size > 0) {
      if (feitas > 0 && agora - inicio + fatiaMaisCara > orcamentoMs) break
      const primeiro = this.fila.entries().next()
      if (primeiro.done === true) break
      const [id, trabalho] = primeiro.value
      this.fila.delete(id)
      const resultado = this.fatia(trabalho)
      if (resultado === null) this.fila.set(id, trabalho)
      else this.prontos.set(id, resultado)
      const depois = this.relogio()
      feitas += 1
      fatiaMaisCara = Math.max(fatiaMaisCara, depois - agora)
      agora = depois
    }
    return agora - inicio
  }

  /** Uma fatia do trabalho: um pedaço da malha ou da busca. A resposta, quando a busca acabou; senão `null`. */
  private fatia(trabalho: Trabalho): ResultadoDoCaminho | null {
    if (!malhaPronta(trabalho.malha)) {
      avancarMalha(trabalho.malha, this.paredesPorFatia)
      return null
    }
    trabalho.busca ??= iniciarBusca(trabalho.malha, trabalho.paredes, trabalho.consulta)
    return avancarBusca(trabalho.busca, this.pontosPorFatia) ? trabalho.busca.resultado : null
  }
}
