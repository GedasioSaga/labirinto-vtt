import { alcanceComCondicoes } from '../lib/batalha/alcance/condicoes'
import { usaDirecao } from '../lib/batalha/alcance/forma'
import { golpeDeAjuda, type AlvoNaMira, type GolpeNaTela } from '../components/batalha/dadosDoMenu'
import { acaoDaMiraDoGolpe, corDoGolpe, grupoDoGolpe } from '../components/batalha/MiraDoGolpe'
import { useMiraNoMapa, type MiraNoMapa } from '../stores/batalha/miraNoMapa'

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
 * conta das casas). A forma vem com as condições de quem usa; a direção é a frente dele (a mesa não vira).
 */
export function miraDaMesaNoChao(golpe: GolpeNaTela, alvos: readonly AlvoNaMira[], marcados: readonly string[]): MiraNoMapa | null {
  const grade = alvos.find((alvo) => alvo.naGrade !== undefined)?.naGrade
  const quemUsaId = alvos.find((alvo) => alvo.lado === 'eu')?.tokenId
  if (grade?.mapa === undefined || quemUsaId === undefined || golpe.formaDoAlcance === undefined) return null
  const { forma } = alcanceComCondicoes(golpe.formaDoAlcance, grupoDoGolpe(golpe), grade.condicoes ?? [])
  const fichaDe = (tokenId: string) => alvos.find((alvo) => alvo.tokenId === tokenId)?.naGrade?.ficha ?? null
  const mira: MiraNoMapa = {
    tokenId: quemUsaId,
    forma,
    cor: corDoGolpe(golpe, golpe.dano.semDano),
    quemUsa: grade.deQuemAge,
    direcao: usaDirecao(forma) ? (grade.frente ?? 'norte') : null,
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

/** Põe a mira da mesa no mapa; `null` apaga a que a mesa pôs (e só ela). */
export function mostrarMiraDaMesa(mira: MiraNoMapa | null): void {
  const { local, mostrar } = useMiraNoMapa.getState()
  if (mira !== null) {
    postaPelaMesa = mira
    mostrar(mira)
    return
  }
  if (postaPelaMesa !== null && local === postaPelaMesa) mostrar(null)
  postaPelaMesa = null
}
