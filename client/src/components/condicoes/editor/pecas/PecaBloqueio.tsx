import type { BloqueioDaCondicao, PecaDaCondicaoDa } from '../../../../lib/condicoes/modelo'
import type { PropsDaPecaDaCondicao } from '../registro'
import './estilo'
import { BLOQUEIOS_NA_TELA } from './vocabulario'

/** Os bloqueios com um ligado ou desligado; o desligado sai da lista (só os `true` ficam gravados). */
function comBloqueio(itens: PecaDaCondicaoDa<'bloqueio'>['itens'], bloqueio: BloqueioDaCondicao, ligado: boolean): PecaDaCondicaoDa<'bloqueio'>['itens'] {
  const { [bloqueio]: _antes, ...outros } = itens
  return ligado ? { ...outros, [bloqueio]: true } : outros
}

/**
 * BLOQUEIO (`corpoBloqueio` do protótipo): o que quem está com ela não pode fazer. Um cartão por bloqueio,
 * com o nome e o que ele quer dizer na mesa; vários podem valer juntos.
 */
export function PecaBloqueio({ peca, aoMudar }: PropsDaPecaDaCondicao<'bloqueio'>) {
  return (
    <fieldset className="lb-cd-bloqs">
      <legend className="lb-sr-only">O que não pode fazer</legend>
      {BLOQUEIOS_NA_TELA.map(({ bloqueio, nome, explica }) => (
        <label key={bloqueio} className="lb-cd-bloq">
          <input type="checkbox" checked={peca.itens[bloqueio] === true} onChange={(evento) => aoMudar({ ...peca, itens: comBloqueio(peca.itens, bloqueio, evento.target.checked) })} />
          <b>{nome}</b>
          <small>{explica}</small>
        </label>
      ))}
    </fieldset>
  )
}
