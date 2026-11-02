import type { FichaDePersonagemProps } from '../../FichaDePersonagem'

/**
 * FICHA DRAGON BALL — PROVISÓRIA (fase 1 do plano docs/planos/sistema-dragon-ball.md).
 * Só marca o lugar: o registro (`registroDeFichas.ts`) já a escolhe para o
 * motor Dragon Ball, com a mesma interface da ficha padrão. A ficha "Scouter"
 * da fase 2 substitui este arquivo inteiro.
 */
export function FichaDBT({ personagem, tituloId }: FichaDePersonagemProps) {
  return (
    <div className="lb-ficha">
      <div className="lb-ficha__lado">
        <h2 id={tituloId} className="lb-dialog__title">
          {personagem.nome}
        </h2>
        <p className="lb-field__hint" role="status">
          Ficha Dragon Ball em construção. Os dados deste personagem ficam guardados e aparecem aqui quando a ficha nova chegar.
        </p>
      </div>
    </div>
  )
}
