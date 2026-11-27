import { MULT_DA_MARCA_MAX, MULT_DA_MARCA_MIN } from '../../../../lib/condicoes/modelo'
import { Caixa, Frase, Numero, Segmentos, Texto } from '../../../batalha/editor/pecas/controlesDaPeca'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { QUEM_DA_MARCA_NA_TELA } from './vocabulario'

/**
 * MARCA (`corpoMarca` do protótipo): o próximo golpe em quem tem dá N vezes o dano, de qualquer um ou só
 * de quem pôs a condição; a marca pode sair com esse golpe, e quem tem pode desviar com desvantagem.
 */
export function PecaMarca({ peca, aoMudar }: PropsDaPecaDaCondicao<'marca'>) {
  return (
    <>
      <Frase>
        <Texto>O próximo golpe nele dá</Texto>
        <Numero rotulo="Vezes o dano" valor={peca.mult} minimo={MULT_DA_MARCA_MIN} maximo={MULT_DA_MARCA_MAX} onChange={(mult) => aoMudar({ ...peca, mult })} />
        <Texto>vezes o dano; aproveita</Texto>
        <Segmentos rotulo="Quem aproveita" valor={peca.quem} opcoes={QUEM_DA_MARCA_NA_TELA} onChange={(quem) => aoMudar({ ...peca, quem })} />
      </Frase>
      <Frase>
        <Caixa rotulo="A marca sai com esse golpe" marcado={peca.sai} onChange={(sai) => aoMudar({ ...peca, sai })} />
        <Caixa rotulo="Desvia com desvantagem" marcado={peca.desvDesv} onChange={(desvDesv) => aoMudar({ ...peca, desvDesv })} />
      </Frase>
    </>
  )
}
