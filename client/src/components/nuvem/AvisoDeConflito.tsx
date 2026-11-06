import { useId } from 'react'

/**
 * AVISO DE CONFLITO (docs/planos/lobby-jogadores-2026-11-05.md §5.2 e §5.6,
 * fatia A6): uma mudança que espera alguém decidir. PURO POR PROPS, de
 * propósito: o app ("Mudanças para decidir") e o site (lista acima da ficha,
 * fatia S3) usam o mesmo. Nada de store, Tauri ou CSS aqui dentro — cada lado
 * estiliza as classes `adc*` e diz a classe dos botões (`classeDoBotao`).
 *
 * - `conflito`: o mesmo campo mudou dos dois lados ("Bia acabou de mudar Vida
 *   para 25. Você pôs 28."), com as escolhas [Ficar com 25] [Usar 28];
 * - `negado`: o servidor recusou por regra; aviso vermelho com o motivo e as
 *   escolhas [Desfazer aqui] [Guardar como nota].
 */

export type TomDoAviso = 'conflito' | 'negado'

export interface EscolhaDoAviso {
  /** O verbo do botão ("Ficar com 25"). */
  rotulo: string
  onEscolher: () => void
  /** A escolha que o aviso recomenda: botão de destaque. */
  principal?: boolean
}

export interface AvisoDeConflitoProps {
  tom: TomDoAviso
  /** Onde: "Sora Maretta" (a ficha). */
  onde: string
  /** O que aconteceu, numa frase. */
  titulo: string
  /** O porquê ou o que cada escolha faz. */
  detalhe?: string
  /** "há 3 min". */
  quando?: string
  escolhas: readonly EscolhaDoAviso[]
  /** Uma escolha está a caminho: os botões esperam. */
  ocupado?: boolean
  /** A escolha falhou: a frase, junto do aviso. */
  erro?: string | null
  classeDoBotao?: (principal: boolean) => string
}

function IconeDoAviso({ tom }: { tom: TomDoAviso }) {
  return (
    <svg className="adc__icone" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {tom === 'negado' ? (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" />
        </>
      ) : (
        <>
          <path d="M3 5.5h8.5l-2-2M13 10.5H4.5l2 2" />
        </>
      )}
    </svg>
  )
}

const classePadrao = (principal: boolean): string => (principal ? 'adc__escolha adc__escolha--principal' : 'adc__escolha')

export function AvisoDeConflito({ tom, onde, titulo, detalhe, quando, escolhas, ocupado = false, erro = null, classeDoBotao = classePadrao }: AvisoDeConflitoProps) {
  const id = useId()
  return (
    <div className="adc" data-tom={tom} role="group" aria-labelledby={`${id}-titulo`} aria-describedby={detalhe !== undefined ? `${id}-detalhe` : undefined} aria-busy={ocupado}>
      <IconeDoAviso tom={tom} />
      <div className="adc__corpo">
        <p className="adc__onde">
          <span>{onde}</span>
          {quando !== undefined && <span className="adc__quando">{quando}</span>}
        </p>
        <p className="adc__titulo" id={`${id}-titulo`}>
          {titulo}
        </p>
        {detalhe !== undefined && (
          <p className="adc__detalhe" id={`${id}-detalhe`}>
            {detalhe}
          </p>
        )}
        <div className="adc__escolhas">
          {escolhas.map((escolha) => (
            <button key={escolha.rotulo} type="button" className={classeDoBotao(escolha.principal === true)} disabled={ocupado} onClick={escolha.onEscolher}>
              {escolha.rotulo}
            </button>
          ))}
        </div>
        {erro !== null && (
          <p className="adc__erro" role="alert">
            {erro}
          </p>
        )}
      </div>
    </div>
  )
}
