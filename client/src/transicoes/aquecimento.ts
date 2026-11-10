import { parseTransicao, type TransicaoId } from './catalogo'
import { carregarThree, preCompilarAbertura, preCompilarTransicao, resolverFabricaDaCena, semCutsceneNoAr, temWebGL } from './motor'

/**
 * AQUECIMENTO das cutscenes, em dois tempos:
 *
 * 1. O CÓDIGO baixa JÁ na entrada da sala (`aquecerMotorDasCutscenes`,
 *    `aquecerTransicoesDoMapa`). Medido em 09/11/2026 com o jogador lento (CPU
 *    4x, rede lenta): com a espera de 3 s mais a ociosidade que havia aqui,
 *    quem recebia a ordem 1 s depois de entrar passava a cena inteira na tela
 *    preta, com o `three` ainda descendo.
 * 2. A parte que pesa na CPU (montar a cena, compilar os programas, subir as
 *    texturas) fica para a INTENÇÃO, com a página ociosa: `aquecerAbertura`
 *    quando o mestre escolhe a abertura, `aquecerTransicao` quando o jogador
 *    abre o cartão da passagem. Aquecer toda cena de antemão custaria uma
 *    travada por cena com o jogador no mapa.
 *
 * Nada disso roda por cima de uma cutscene no ar: o mapa novo que chega no
 * meio da travessia baixava o código das transições dele com a cena tocando.
 */

/** Teto da espera pela página ociosa: aparelho que nunca fica ocioso aquece assim mesmo. */
export const ESPERA_DA_OCIOSIDADE_MAX_MS = 2000

/** Sem cutscene no ar e com a página ociosa (ou no teto da espera por ela). */
function naOciosidade(tarefa: () => void): void {
  void semCutsceneNoAr().then(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(tarefa, { timeout: ESPERA_DA_OCIOSIDADE_MAX_MS })
    else setTimeout(tarefa, 0)
  })
}

function querMovimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

let motorPedido = false
const transicoesPedidas = new Set<TransicaoId>()
const aberturasAquecidas = new Set<string>()
const transicoesAquecidas = new Set<TransicaoId>()

/**
 * Baixa o `three` (o motor de todas as cutscenes), na hora. Uma vez por
 * página; falha de rede não fica gravada, e a próxima chamada (ou a próxima
 * cutscene) baixa de novo.
 */
export function aquecerMotorDasCutscenes(): void {
  if (motorPedido || !temWebGL()) return
  motorPedido = true
  void carregarThree().catch(() => {
    motorPedido = false
  })
}

/**
 * Baixa o pedaço de cada transição que os pinos e as escadas deste mapa usam
 * (as embutidas têm um pedaço próprio; as do pacote já chegaram com ele). Cada
 * transição uma vez por página. Barato de chamar a cada mapa novo; com
 * cutscene no ar, espera ela acabar.
 */
export function aquecerTransicoesDoMapa(mapa: { pins: readonly { transicao?: unknown }[]; stairs: readonly { transicao?: unknown }[] } | null | undefined): void {
  if (!mapa || !temWebGL()) return
  const novas: TransicaoId[] = []
  for (const dono of [...mapa.pins, ...mapa.stairs]) {
    if (dono.transicao === undefined) continue
    const id = parseTransicao(dono.transicao)?.id
    if (id === undefined || transicoesPedidas.has(id)) continue
    transicoesPedidas.add(id)
    novas.push(id)
  }
  if (novas.length === 0) return
  aquecerMotorDasCutscenes()
  void semCutsceneNoAr().then(() => {
    for (const id of novas) void resolverFabricaDaCena(id).catch(() => undefined)
  })
}

/** Pré-aquece uma cena uma vez por id; a que este app ainda não tem (pacote descendo) pode ser pedida de novo. */
function aquecerUmaVez<Id extends string>(aquecidas: Set<Id>, id: Id, preCompilar: (id: Id, reduzirMovimento: boolean) => Promise<boolean>): void {
  if (!temWebGL() || aquecidas.has(id)) return
  aquecidas.add(id)
  // O download não espera a ociosidade; a montagem e a compilação, sim.
  aquecerMotorDasCutscenes()
  naOciosidade(() => {
    void preCompilar(id, querMovimentoReduzido()).then((feito) => {
      if (!feito) aquecidas.delete(id)
    })
  })
}

/**
 * AQUECER PELA INTENÇÃO: o mestre escolheu a abertura `id` e ainda não
 * confirmou. Esta tela (mestre, jogador ou TV) baixa e pré-compila a cena
 * agora, para o preparo de verdade caber folgado no prazo da largada
 * (`largada.ts`; a frio, o jogador lento ficou pronto 22 ms antes do prazo).
 */
export function aquecerAbertura(id: string): void {
  aquecerUmaVez(aberturasAquecidas, id, preCompilarAbertura)
}

/** O mesmo para a transição de local: o jogador abriu o cartão da passagem que a toca. */
export function aquecerTransicao(id: TransicaoId): void {
  aquecerUmaVez(transicoesAquecidas, id, preCompilarTransicao)
}
