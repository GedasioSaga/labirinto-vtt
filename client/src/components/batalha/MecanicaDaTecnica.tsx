import { avisoDaMecanica, lerMecanica, type MecanicaLida as LeituraDaMecanica, type MecanicaV1 } from '../../lib/batalha/mecanica/modelo'
import { etiquetaDaMecanica, pecasAMao, resumoDaMecanica, type FichaDaPrevia } from '../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../lib/personagem'
import './MecanicaDaTecnica.css'

/**
 * A MECÂNICA LIDA no cartão (construtor de mecânicas, fatia C2): o resumo em
 * frases do que a técnica, a arma ou o item faz, e a proposta que espera o
 * mestre. Quem edita (decisão 1 do mestre): o MESTRE grava a `mecanica`; o
 * DONO da ficha monta a `mecanicaProposta`, que só vale depois que o mestre
 * aceitar. Desde a ED7 o editor é um só para técnica, arma e item
 * (`editor/EditorDaHabilidade.tsx`, aberto por `editor/HabilidadeNaFicha.tsx`);
 * o de 3 degraus que morava aqui saiu.
 */

/** `ninguem` = só lê o resumo (a ficha de um colega, ou quem chama sem dizer). */
export type QuemEditaAMecanica = 'mestre' | 'dono' | 'ninguem'

/** O resumo em frases, com a etiqueta (o que o jogador também vê). `espera` = proposta que ainda não vale (borda tracejada). */
export function ResumoDaMecanica({ mecanica, ficha, titulo, espera = false }: { mecanica: MecanicaV1; ficha?: FichaDaPrevia; titulo?: string; espera?: boolean }) {
  const aMao = pecasAMao(mecanica)
  return (
    <div className="lb-mec__resumo" data-espera={espera ? '' : undefined}>
      <div className="lb-mec__resumo-cab">
        {titulo !== undefined && <span className="lb-mec__resumo-titulo">{titulo}</span>}
        <span className="lb-mec__etiqueta" data-a-mao={aMao > 0 ? '' : undefined}>
          {etiquetaDaMecanica(mecanica)}
        </span>
      </div>
      <ul className="lb-mec__frases">
        {resumoDaMecanica(mecanica, ficha).map((frase, indice) => (
          <li key={indice}>{frase}</li>
        ))}
      </ul>
    </div>
  )
}

/** O aviso do cartão com mecânica que este app não lê. */
function AvisoDaLida({ lida }: { lida: LeituraDaMecanica }) {
  if (lida.tipo !== 'invalida' && lida.tipo !== 'futura') return null
  return (
    <p className="lb-mec__aviso" role="note">
      {avisoDaMecanica(lida)}
    </p>
  )
}

/**
 * Fora da edição (o mestre e o jogador): o resumo em frases da mecânica que
 * vale e, se houver, a proposta que espera o mestre, também em frases (quem
 * propôs vê o que mandou; o mestre vê o que vai aceitar). Sem mecânica e sem
 * proposta = nada (o cartão segue pelo texto, como antes).
 */
export function MecanicaLida({ cartao, ficha }: { cartao: CartaoDaFicha; ficha: FichaDaPrevia }) {
  if (cartao.mecanica === undefined && cartao.mecanicaProposta === undefined) return null
  const valendo = lerMecanica(cartao.mecanica)
  const proposta = lerMecanica(cartao.mecanicaProposta)
  const temProposta = cartao.mecanicaProposta !== undefined
  return (
    <div className="lb-mec lb-mec--lida">
      {valendo.tipo === 'pecas' && <ResumoDaMecanica mecanica={valendo.mecanica} ficha={ficha} titulo={temProposta ? 'Vale agora' : 'Mecânica'} />}
      <AvisoDaLida lida={valendo} />
      {temProposta &&
        (proposta.tipo === 'pecas' ? (
          <ResumoDaMecanica mecanica={proposta.mecanica} ficha={ficha} titulo="Proposta, esperando o mestre" espera />
        ) : (
          <p className="lb-mec__espera">Proposta de mecânica esperando o mestre.</p>
        ))}
    </div>
  )
}
