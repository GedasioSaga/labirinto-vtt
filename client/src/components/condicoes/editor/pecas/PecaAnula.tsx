import { anulaTudo } from '../../../../lib/batalha/anulaODano'
import { Frase, Nota, Texto } from '../../../batalha/editor/pecas/controlesDaPeca'
import { EscolherCorteDoAnula } from '../../../batalha/editor/pecas/CorteDoAnula'
import { EscolherExcecao, NotaDaExcecao } from '../../../batalha/editor/pecas/ExcecaoDoGolpe'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'

/**
 * INTANGÍVEL (pedido de 27/11/2026, "tem como fazer o inimigo ser intangível / não tomar dano?"): quem tem
 * toma 0 de dano dos golpes, a não ser que o golpe tenha a exceção. A mesma regra do "Anula o dano" das
 * passivas (`lib/batalha/anulacaoNoGolpe.ts`), sem limite nem custo: quanto dura é o prazo da condição.
 * Pedido de 28/11/2026: anula tudo ou só uma parte (−N de dano ou −X%), pelo mesmo controle da passiva.
 */
export function PecaAnula({ peca, aoMudar }: PropsDaPecaDaCondicao<'anula'>) {
  const { exceto, ...semExcecao } = peca
  const { corte: _corte, ...semCorte } = peca
  return (
    <>
      <Frase>
        <Texto forte>{anulaTudo(peca.corte) ? 'Toma 0 de dano' : 'Anula parte do dano'}</Texto>
        <Texto>dos golpes,</Texto>
        <EscolherExcecao exceto={exceto} aoMudar={(nova) => aoMudar(nova === undefined ? semExcecao : { ...semExcecao, exceto: nova })} />
      </Frase>
      <NotaDaExcecao exceto={exceto} />
      <EscolherCorteDoAnula corte={peca.corte} aoMudar={(corte) => aoMudar(corte === undefined ? semCorte : { ...semCorte, corte })} />
      <Nota>Só o dano do golpe é anulado (a condição que o golpe põe pega); o dano por turno e o Dar dano da mesa entram normal.</Nota>
    </>
  )
}
