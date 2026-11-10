import { parseTransicao, type TransicaoId } from './catalogo'
import { carregarThree, resolverFabricaDaCena, temWebGL } from './motor'

/**
 * AQUECIMENTO das cutscenes: baixa e avalia o CÓDIGO delas com a página
 * ociosa, antes de alguém pedir para tocar.
 *
 * Medido em 09/11/2026 (jogador com rede lenta e CPU 4x mais lenta): a
 * primeira abertura de batalha depois de entrar na mesa esperava o download do
 * `three` (o mestre já estava na cena havia 14 s), e a primeira Porta esperava
 * o pedaço da própria cena (0,8 s). Com o código já na página, o preparo cabe
 * no prazo da largada combinada (`largada.ts`).
 *
 * Só código: montar e compilar cada cena de antemão custaria uma travada por
 * cena com o jogador no mapa, e o preparo de verdade (`motor.ts`) já faz isso
 * por baixo da cortina preta, na hora de tocar.
 */

/** Espera depois de pedir: o mapa da entrada monta primeiro, e o download não disputa a rede com ele. */
const ESPERA_ANTES_DE_AQUECER_MS = 3000
/** Teto da espera pela página ociosa: aparelho que nunca fica ocioso aquece assim mesmo. */
const ESPERA_DA_OCIOSIDADE_MAX_MS = 5000

function naOciosidade(tarefa: () => void): void {
  setTimeout(() => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(tarefa, { timeout: ESPERA_DA_OCIOSIDADE_MAX_MS })
    else tarefa()
  }, ESPERA_ANTES_DE_AQUECER_MS)
}

let motorPedido = false
const transicoesPedidas = new Set<TransicaoId>()

/**
 * Baixa o `three` (o motor de todas as cutscenes). Uma vez por página; falha
 * de rede não fica gravada, e a próxima cutscene baixa do jeito de sempre.
 */
export function aquecerMotorDasCutscenes(): void {
  if (motorPedido || !temWebGL()) return
  motorPedido = true
  naOciosidade(() => {
    void carregarThree().catch(() => undefined)
  })
}

/**
 * Baixa o pedaço de cada transição que os pinos e as escadas deste mapa usam
 * (as embutidas têm um pedaço próprio; as do pacote já chegaram com ele). Cada
 * transição uma vez por página. Barato de chamar a cada mapa novo.
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
  naOciosidade(() => {
    for (const id of novas) void resolverFabricaDaCena(id).catch(() => undefined)
  })
}
