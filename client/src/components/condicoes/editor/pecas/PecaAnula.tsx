import { Frase, Nota, Texto } from '../../../batalha/editor/pecas/controlesDaPeca'
import { EscolherExcecao, NotaDaExcecao } from '../../../batalha/editor/pecas/ExcecaoDoGolpe'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'

/**
 * INTANGÍVEL (pedido de 27/11/2026, "tem como fazer o inimigo ser intangível / não tomar dano?"): quem tem
 * toma 0 de dano dos golpes, a não ser que o golpe tenha a exceção. A mesma regra do "Anula o dano" das
 * passivas (`lib/batalha/anulacaoNoGolpe.ts`), sem limite nem custo: quanto dura é o prazo da condição.
 */
export function PecaAnula({ peca, aoMudar }: PropsDaPecaDaCondicao<'anula'>) {
  return (
    <>
      <Frase>
        <Texto forte>Toma 0 de dano</Texto>
        <Texto>dos golpes,</Texto>
        <EscolherExcecao exceto={peca.exceto} aoMudar={(exceto) => aoMudar(exceto === undefined ? { tipo: 'anula' } : { tipo: 'anula', exceto })} />
      </Frase>
      <NotaDaExcecao exceto={peca.exceto} />
      <Nota>Só o dano do golpe zera (a condição que o golpe põe pega); o dano por turno e o Dar dano da mesa entram normal.</Nota>
    </>
  )
}
