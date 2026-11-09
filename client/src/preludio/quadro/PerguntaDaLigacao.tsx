import { useId, useState, type KeyboardEvent } from 'react'

/**
 * A PERGUNTA DA SETA (fatia F3b): o mestre desenhou uma seta entre dois cartões
 * cujos verbetes não têm ligação. O quadro oferece criar a ligação, com o tipo
 * (o texto escrito na seta já vem no campo). Não toma o foco de quem está
 * desenhando: chega pelo Tab ou pelo clique. Enter cria; Esc ou "Agora não"
 * deixa só a seta no quadro.
 */

export interface PerguntaDeLigacao {
  /** A seta que fez a pergunta (muda a cada seta nova, e o campo recomeça). */
  readonly setaId: string
  readonly de: string
  readonly para: string
  readonly tipo: string
}

export interface PerguntaDaLigacaoProps {
  pergunta: PerguntaDeLigacao
  /** Os tipos para sugerir no campo. */
  tipos: readonly string[]
  /** Por que as ligações não podem ser gravadas agora; `null` = podem. */
  bloqueio: string | null
  /** Grava a ligação; devolve o motivo se o disco recusou. */
  aoCriar: (tipo: string) => Promise<string | null>
  aoDispensar: () => void
}

export function PerguntaDaLigacao({ pergunta, tipos, bloqueio, aoCriar, aoDispensar }: PerguntaDaLigacaoProps) {
  const [tipo, setTipo] = useState(pergunta.tipo)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const idDaLista = useId()
  const idDoTexto = useId()
  const limpo = tipo.trim()

  const criar = async () => {
    if (limpo === '' || criando) return
    setCriando(true)
    setErro(null)
    const motivo = await aoCriar(limpo)
    setCriando(false)
    if (motivo !== null) setErro(motivo)
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Escape') {
      evento.preventDefault()
      evento.stopPropagation()
      aoDispensar()
    }
  }

  return (
    <div className="pr-pergunta" role="dialog" aria-labelledby={idDoTexto} onKeyDown={aoTeclar}>
      <p id={idDoTexto} className="pr-pergunta__texto">
        Seta de <b>{pergunta.de}</b> para <b>{pergunta.para}</b>.{' '}
        {bloqueio === null ? 'Criar a ligação entre os verbetes?' : 'A seta fica só no quadro:'}
      </p>
      {bloqueio !== null ? (
        <div className="pr-pergunta__linha">
          <p className="pr-pergunta__bloqueio">{bloqueio}</p>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoDispensar}>
            Entendi
          </button>
        </div>
      ) : (
        <form
          className="pr-pergunta__linha"
          onSubmit={(evento) => {
            evento.preventDefault()
            void criar()
          }}
        >
          <input
            className="pr-pergunta__campo"
            list={idDaLista}
            aria-label="Tipo da ligação"
            placeholder="Tipo: conhece, aliado de…"
            value={tipo}
            maxLength={60}
            onChange={(evento) => setTipo(evento.target.value)}
          />
          <datalist id={idDaLista}>
            {tipos.map((cada) => (
              <option key={cada} value={cada} />
            ))}
          </datalist>
          <button type="submit" className="gr-bt gr-bt--p gr-bt--primario" disabled={limpo === '' || criando} aria-busy={criando}>
            {criando ? 'Criando…' : 'Criar ligação'}
          </button>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoDispensar}>
            Agora não
          </button>
        </form>
      )}
      {erro !== null && (
        <p className="pr-pergunta__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
