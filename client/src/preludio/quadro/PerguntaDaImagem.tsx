import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ROTULO_DO_TIPO } from '../../lib/preparo/enciclopedia'

/**
 * A IMAGEM QUE VIRA VERBETE (fatia F3c, como no Grimório,
 * `transformarImagemEmEntidade.ts`): Espaço numa imagem solta do quadro
 * pergunta o tipo e o nome; o verbete nasce com a imagem de retrato e o
 * cartão dele fica no lugar da imagem. Foi o mestre que pediu (tecla), então
 * o foco vai para o nome. Enter cria; Esc ou "Agora não" deixa a imagem.
 */

export type TipoDaImagem = 'personagem' | 'lugar' | 'item' | 'faccao'

const TIPOS: readonly TipoDaImagem[] = ['personagem', 'lugar', 'item', 'faccao']

export interface PerguntaDaImagemProps {
  /** O nome sugerido (o do arquivo da imagem, sem a extensão). */
  sugestao: string
  /** Por que a imagem não pode virar verbete agora; `null` = pode. */
  bloqueio: string | null
  /** Cria o verbete e troca a imagem pelo cartão; devolve o motivo se não deu. */
  aoCriar: (tipo: TipoDaImagem, nome: string) => Promise<string | null>
  aoDispensar: () => void
}

export function PerguntaDaImagem({ sugestao, bloqueio, aoCriar, aoDispensar }: PerguntaDaImagemProps) {
  const [tipo, setTipo] = useState<TipoDaImagem>('personagem')
  const [nome, setNome] = useState(sugestao)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const idDoTexto = useId()
  const campo = useRef<HTMLInputElement>(null)
  const limpo = nome.trim()

  useEffect(() => {
    campo.current?.select()
  }, [])

  const criar = async () => {
    if (limpo === '' || criando) return
    setCriando(true)
    setErro(null)
    const motivo = await aoCriar(tipo, limpo)
    setCriando(false)
    if (motivo !== null) setErro(motivo)
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    aoDispensar()
  }

  return (
    <div className="pr-pergunta" role="dialog" aria-labelledby={idDoTexto} onKeyDown={aoTeclar}>
      <p id={idDoTexto} className="pr-pergunta__texto">
        {bloqueio === null ? 'Transformar esta imagem num verbete? Ela vira o retrato, e o cartão fica no lugar dela.' : 'Esta imagem não vira verbete:'}
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
          <select className="pr-pergunta__tipo" aria-label="Tipo do verbete" value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoDaImagem)}>
            {TIPOS.map((cada) => (
              <option key={cada} value={cada}>
                {ROTULO_DO_TIPO[cada].um}
              </option>
            ))}
          </select>
          <input ref={campo} className="pr-pergunta__campo" aria-label="Nome do verbete" placeholder="Nome" value={nome} maxLength={120} onChange={(evento) => setNome(evento.target.value)} />
          <button type="submit" className="gr-bt gr-bt--p gr-bt--primario" disabled={limpo === '' || criando} aria-busy={criando}>
            {criando ? 'Criando…' : 'Criar o verbete'}
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
