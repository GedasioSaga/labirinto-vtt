import { useId } from 'react'
import { NOME_DO_OCULTO } from '../../lib/habilidadeOculta'
import type { CartaoDaFicha } from '../../lib/personagem'

/**
 * HABILIDADE OCULTA (fatia C7, `lib/habilidadeOculta.ts`): as três peças de
 * tela. O mestre marca o cartão na edição (`OcultaNoCartao`), vê o selo
 * "Oculta" e revela com um clique (`SeloDeOculta`); o jogador vê um "???"
 * para cada cartão que o mestre escondeu (`CartoesOcultos`), sem nome, texto
 * nem números, porque nada disso chega até ele.
 */

/** Edição do cartão, só do mestre: esconder dos jogadores e, escondido, revelar sozinho ao usar na batalha. */
export function OcultaNoCartao({ cartao, onChange }: { cartao: CartaoDaFicha; onChange: (cartao: CartaoDaFicha) => void }) {
  const ajudaId = useId()
  const oculta = cartao.oculta === true
  const trocarOculta = (marcar: boolean) => {
    const { oculta: _antes, revelaAoUsar: _revela, ...visivel } = cartao
    onChange(marcar ? { ...visivel, oculta: true } : visivel)
  }
  const trocarRevela = (marcar: boolean) => {
    const { revelaAoUsar: _antes, ...resto } = cartao
    onChange(marcar ? { ...resto, revelaAoUsar: true } : resto)
  }
  return (
    <fieldset className="lb-oculta" data-ligada={oculta ? '' : undefined}>
      <legend className="lb-label">Para os jogadores</legend>
      <label className="lb-oculta__opcao">
        <input type="checkbox" checked={oculta} aria-describedby={ajudaId} onChange={(event) => trocarOculta(event.target.checked)} />
        <span>Esconder dos jogadores</span>
      </label>
      <p id={ajudaId} className="lb-oculta__ajuda">
        {oculta ? `Eles veem ${NOME_DO_OCULTO} no lugar do nome, do texto e dos números. Só você vê o cartão.` : 'Eles veem este cartão inteiro.'}
      </p>
      {oculta && (
        <label className="lb-oculta__opcao">
          <input type="checkbox" checked={cartao.revelaAoUsar === true} onChange={(event) => trocarRevela(event.target.checked)} />
          <span>Revelar sozinho quando eu usar na batalha</span>
        </label>
      )}
    </fieldset>
  )
}

/** O selo "Oculta" ao lado do nome (só o mestre vê cartão oculto) e, com `onRevelar`, o botão de revelar. */
export function SeloDeOculta({ cartao, onRevelar }: { cartao: CartaoDaFicha; onRevelar?: (cartaoId: string) => void }) {
  if (cartao.oculta !== true) return null
  const quando = cartao.revelaAoUsar === true ? 'Revela ao usar na batalha' : `Os jogadores veem ${NOME_DO_OCULTO}`
  return (
    <>
      <span className="lb-ficha__chip lb-ficha__chip--oculta" title={quando}>
        Oculta
      </span>
      {onRevelar !== undefined && (
        <button type="button" className="lb-cartao__revelar" aria-label={`Revelar ${cartao.nome} aos jogadores`} onClick={() => onRevelar(cartao.id)}>
          Revelar
        </button>
      )}
    </>
  )
}

/** Um "???" para cada cartão que o mestre escondeu nesta aba (a contagem da projeção). */
export function CartoesOcultos({ quantos }: { quantos: number }) {
  if (quantos <= 0) return null
  const frase = quantos === 1 ? '1 cartão escondido pelo mestre' : `${quantos} cartões escondidos pelo mestre`
  return (
    <>
      {Array.from({ length: quantos }, (_, indice) => (
        <li key={indice} className="lb-cartao lb-cartao--oculto" aria-label={indice === 0 ? frase : undefined} aria-hidden={indice === 0 ? undefined : true}>
          <span className="lb-cartao__nome lb-cartao__nome--oculto">{NOME_DO_OCULTO}</span>
          {indice === 0 && <span className="lb-cartao__oculto-dica">O mestre revela na batalha ou na ficha.</span>}
        </li>
      ))}
    </>
  )
}
