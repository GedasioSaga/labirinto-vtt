import type { Direcao } from '../lib/batalha/area'
import { usaDirecao } from '../lib/batalha/alcance/forma'
import { golpeDeAjuda, type AlvoNaMira, type GolpeNaTela } from '../components/batalha/dadosDoMenu'
import { acaoDaMiraDoGolpe, corDoGolpe } from '../components/batalha/MiraDoGolpe'
import { alcanceDaMira, direcaoAoAbrirAMira } from '../components/batalha/regraDaMira'
import { useMiraNoMapa, type MiraNoMapa } from '../stores/batalha/miraNoMapa'
import { useMapStore } from '../stores/mapStore'

/**
 * A MIRA DA MESA NO MAPA (sobra do alcance, 23/11/2026). O golpe e os alvos que o mestre escolhe na Mesa
 * da batalha (a doca ou a janela à parte) acendem as casas no mapa principal, como a mira do menu da vez.
 * A mesa manda o pedido 'mira'; a principal monta a mira com a mesma conta da `MiraDoGolpe` e a põe na
 * `useMiraNoMapa` (a camada do chão desenha; o hostBridge leva aos jogadores). Lançar, cancelar (Esc),
 * trocar de vez e fechar a janela mandam `null`, e a mira apaga.
 */

/** A mira que a mesa pôs: apagar só tira esta (a do menu da vez, aberta depois, fica). */
let postaPelaMesa: MiraNoMapa | null = null

/**
 * A mira no chão do golpe escolhido na mesa; `null` = nada a acender (o golpe sem alcance, a mesa sem a
 * conta das casas). A forma vem com as condições de quem usa. Conserto de 25/11/2026 (levantamento das
 * mecânicas duplicadas, item 16): a direção é a que a mesa virou (`direcao`) ou, sem ela, a de abrir do
 * menu da vez (a área montada olha para o lado que pega mais quando a ficha não tem frente).
 */
export function miraDaMesaNoChao(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], marcados: readonly string[], direcao?: Direcao): MiraNoMapa | null {
  const grade = alvos.find((alvo) => alvo.naGrade !== undefined)?.naGrade
  const quemUsaId = alvos.find((alvo) => alvo.lado === 'eu')?.tokenId
  const alcance = alcanceDaMira(golpe, grade?.condicoes)
  if (grade?.mapa === undefined || quemUsaId === undefined || alcance === null) return null
  const { forma } = alcance
  const fichaDe = (tokenId: string) => alvos.find((alvo) => alvo.tokenId === tokenId)?.naGrade?.ficha ?? null
  const mira: MiraNoMapa = {
    tokenId: quemUsaId,
    forma,
    cor: corDoGolpe(golpe, golpe.dano.semDano),
    quemUsa: grade.deQuemAge,
    direcao: usaDirecao(forma) ? (direcao ?? direcaoAoAbrirAMira(golpe, alvos)) : null,
    acendeQuemUsa: golpeDeAjuda(golpe),
    mapa: grade.mapa,
    centro: null,
    alvos: marcados.flatMap((tokenId) => {
      const ficha = tokenId === quemUsaId ? null : fichaDe(tokenId)
      return ficha === null ? [] : [ficha]
    }),
    fichas: alvos.flatMap((alvo) => (alvo.naGrade === undefined ? [] : [alvo.naGrade.ficha])),
  }
  // O que vai à mesa dos jogadores, como a mira do menu da vez manda (o host resolve a forma pelo cartão dele).
  const acao = acaoDaMiraDoGolpe(golpe)
  if (acao !== null) mira.fio = { acao }
  return mira
}

/**
 * Conserto de 25/11/2026 ("me movo mas os quadrados azuis não se movem"): a mesa só manda a mira de novo
 * quando o golpe ou os alvos mudam, e a conta acima é uma foto das fichas na hora do pedido. Com a mira no
 * ar, cada mudança do mapa (a ficha andou, a porta abriu) refaz a mira com a mesa de agora.
 */
let refazerDaMesa: (() => MiraNoMapa | null) | null = null
let pararDeOuvirOMapa: (() => void) | null = null

function seguirOMapa(): void {
  if (pararDeOuvirOMapa !== null) return
  pararDeOuvirOMapa = useMapStore.subscribe((agora, antes) => {
    if (agora.map === antes.map || postaPelaMesa === null || refazerDaMesa === null) return
    // Outra mira na tela (o menu da vez aberto depois): a dela manda; a da mesa não volta por cima.
    if (useMiraNoMapa.getState().local !== postaPelaMesa) return
    const nova = refazerDaMesa()
    if (nova === null) {
      mostrarMiraDaMesa(null)
      return
    }
    postaPelaMesa = nova
    useMiraNoMapa.getState().mostrar(nova)
  })
}

/**
 * Conserto de 25/11/2026 (item 16): o lado do mouse no mapa (a store da mira o acha em relação a quem usa)
 * enquanto a mira no chão é a da mesa: vai no espelho, e a mesa vira a forma como o menu da vez vira.
 * `null` = outra mira no chão, nenhuma, ou o mouse na zona morta do meio.
 */
export function ladoDoMouseNaMiraDaMesa(): Direcao | null {
  const { local, lado } = useMiraNoMapa.getState()
  return postaPelaMesa !== null && local === postaPelaMesa ? lado : null
}

function pararDeSeguirOMapa(): void {
  pararDeOuvirOMapa?.()
  pararDeOuvirOMapa = null
  refazerDaMesa = null
}

/**
 * Põe a mira da mesa no mapa; `null` apaga a que a mesa pôs (e só ela). `refazer` (a mesma conta com a mesa
 * de agora) faz a mira seguir a ficha que anda com ela no ar; ausente = a mira fica como veio.
 */
export function mostrarMiraDaMesa(mira: MiraNoMapa | null, refazer?: () => MiraNoMapa | null): void {
  const { local, mostrar } = useMiraNoMapa.getState()
  if (mira !== null) {
    postaPelaMesa = mira
    mostrar(mira)
    if (refazer === undefined) {
      pararDeSeguirOMapa()
      return
    }
    refazerDaMesa = refazer
    seguirOMapa()
    return
  }
  pararDeSeguirOMapa()
  if (postaPelaMesa !== null && local === postaPelaMesa) mostrar(null)
  postaPelaMesa = null
}
