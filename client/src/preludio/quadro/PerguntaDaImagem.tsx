import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { compararTitulos, ROTULO_DO_TIPO, semAcento } from '../../lib/preparo/enciclopedia'
import type { Verbete } from '../../lib/preparo/tipos'

/**
 * A IMAGEM QUE VIRA VERBETE (fatia F3c, como no Grimório,
 * `transformarImagemEmEntidade.ts` e `dialogoTransformar.tsx`): Espaço numa
 * imagem solta do quadro pergunta o que ela vira.
 *
 * - "Verbete novo": o tipo e o nome; o verbete nasce com a imagem de retrato.
 * - "Forma nova de um verbete": a imagem vira uma forma nova (e ativa) de um
 *   personagem, lugar, item ou facção que já existe, como a "nova
 *   transformação" do Grimório.
 * - Se a imagem já é o retrato de algum verbete (o Ctrl+Z devolveu a imagem,
 *   mas o verbete ficou), a pergunta oferece pôr o cartão dele, em vez de
 *   criar outro igual.
 *
 * Em todos, o cartão fica no lugar da imagem. Foi o mestre que pediu (tecla),
 * então o foco vai para o primeiro campo. Esc ou "Agora não" deixa a imagem.
 */

export type TipoDaImagem = 'personagem' | 'lugar' | 'item' | 'faccao'

const TIPOS: readonly TipoDaImagem[] = ['personagem', 'lugar', 'item', 'faccao']

/** Quantos verbetes a busca do "Forma nova" mostra de uma vez. */
const ACHADOS_NA_BUSCA = 6

export type DestinoDaImagem =
  | { readonly t: 'novo'; readonly tipo: TipoDaImagem; readonly nome: string }
  | { readonly t: 'forma'; readonly verbeteId: string; readonly nome: string }
  | { readonly t: 'cartao'; readonly verbeteId: string; readonly formaId: string }

/** O verbete que já tem esta imagem de retrato, e em qual forma. */
export interface JaRetrato {
  readonly verbete: Verbete
  readonly formaId: string
}

export interface PerguntaDaImagemProps {
  /** O nome sugerido (o do arquivo da imagem, sem a extensão). */
  sugestao: string
  /** Por que a imagem não pode virar verbete agora; `null` = pode. */
  bloqueio: string | null
  /** Os verbetes que podem ganhar a forma nova (personagem, lugar, item e facção). */
  candidatos: readonly Verbete[]
  /** Os verbetes que já usam esta imagem de retrato. */
  jaRetrato: readonly JaRetrato[]
  /** Faz o que o mestre escolheu e troca a imagem pelo cartão; devolve o motivo se não deu. */
  aoCriar: (destino: DestinoDaImagem) => Promise<string | null>
  aoDispensar: () => void
}

type Modo = 'novo' | 'forma'

export function PerguntaDaImagem({ sugestao, bloqueio, candidatos, jaRetrato, aoCriar, aoDispensar }: PerguntaDaImagemProps) {
  const [modo, setModo] = useState<Modo>('novo')
  const [tipo, setTipo] = useState<TipoDaImagem>('personagem')
  const [nome, setNome] = useState(sugestao)
  const [busca, setBusca] = useState('')
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const idDoTexto = useId()
  const campo = useRef<HTMLInputElement>(null)
  const campoDaBusca = useRef<HTMLInputElement>(null)
  const limpo = nome.trim()

  const achados = useMemo(() => {
    const consulta = semAcento(busca.trim())
    return candidatos
      .filter((verbete) => consulta === '' || semAcento(verbete.titulo).includes(consulta))
      .sort((a, b) => compararTitulos(a.titulo, b.titulo))
      .slice(0, ACHADOS_NA_BUSCA)
  }, [candidatos, busca])
  const alvo = escolhido === null ? undefined : candidatos.find((verbete) => verbete.id === escolhido)

  useEffect(() => {
    if (modo === 'novo') campo.current?.select()
    else campoDaBusca.current?.focus()
  }, [modo])

  const fazer = async (destino: DestinoDaImagem) => {
    if (criando) return
    setCriando(true)
    setErro(null)
    const motivo = await aoCriar(destino)
    setCriando(false)
    if (motivo !== null) setErro(motivo)
  }

  const criar = () => {
    if (limpo === '') return
    if (modo === 'novo') void fazer({ t: 'novo', tipo, nome: limpo })
    else if (alvo !== undefined) void fazer({ t: 'forma', verbeteId: alvo.id, nome: limpo })
  }

  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape') return
    evento.preventDefault()
    evento.stopPropagation()
    aoDispensar()
  }

  const aoTeclarNoModo = (evento: KeyboardEvent<HTMLButtonElement>) => {
    if (evento.key !== 'ArrowLeft' && evento.key !== 'ArrowRight') return
    evento.preventDefault()
    setModo((antes) => (antes === 'novo' ? 'forma' : 'novo'))
  }

  // Enter na busca escolhe o primeiro achado (e o nome da forma fica para digitar).
  const aoTeclarNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key !== 'Enter') return
    evento.preventDefault()
    const primeiro = achados[0]
    if (primeiro === undefined) return
    setEscolhido(primeiro.id)
    requestAnimationFrame(() => campo.current?.select())
  }

  if (bloqueio !== null) {
    return (
      <div className="pr-pergunta" role="dialog" aria-labelledby={idDoTexto} onKeyDown={aoTeclar}>
        <p id={idDoTexto} className="pr-pergunta__texto">
          Esta imagem não vira verbete:
        </p>
        <div className="pr-pergunta__linha">
          <p className="pr-pergunta__bloqueio">{bloqueio}</p>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoDispensar}>
            Entendi
          </button>
        </div>
      </div>
    )
  }

  const modos: readonly { readonly id: Modo; readonly rotulo: string }[] = [
    { id: 'novo', rotulo: 'Verbete novo' },
    { id: 'forma', rotulo: 'Forma nova de um verbete' },
  ]

  return (
    <div className="pr-pergunta" role="dialog" aria-labelledby={idDoTexto} onKeyDown={aoTeclar}>
      <p id={idDoTexto} className="pr-pergunta__texto">
        Transformar esta imagem? Ela vira o retrato, e o cartão fica no lugar dela.
      </p>
      {jaRetrato.map(({ verbete, formaId }) => {
        const forma = verbete.formas.find((cada) => cada.id === formaId)
        const quem = verbete.titulo || 'Sem nome'
        return (
          <div key={`${verbete.id}:${formaId}`} className="pr-pergunta__linha pr-pergunta__ja">
            <p className="pr-pergunta__bloqueio">
              Esta imagem já é o retrato de <b>{quem}</b>
              {verbete.formas.length > 1 && forma !== undefined ? ` (forma ${forma.nome || 'sem nome'})` : ''}.
            </p>
            <button type="button" className="gr-bt gr-bt--p gr-bt--latao" disabled={criando} onClick={() => void fazer({ t: 'cartao', verbeteId: verbete.id, formaId })}>
              Pôr o cartão de {quem}
            </button>
          </div>
        )
      })}
      <div className="pr-abas pr-pergunta__modo" role="radiogroup" aria-label="O que a imagem vira">
        {modos.map((cada) => (
          <button
            key={cada.id}
            type="button"
            role="radio"
            className="pr-abas__aba"
            aria-checked={modo === cada.id}
            tabIndex={modo === cada.id ? 0 : -1}
            onClick={() => setModo(cada.id)}
            onKeyDown={aoTeclarNoModo}
          >
            {cada.rotulo}
          </button>
        ))}
      </div>
      <form
        className="pr-pergunta__corpo"
        onSubmit={(evento) => {
          evento.preventDefault()
          criar()
        }}
      >
        {modo === 'forma' && (
          <div className="pr-pergunta__busca">
            <input
              ref={campoDaBusca}
              className="pr-pergunta__campo"
              aria-label="Procurar o verbete"
              placeholder="Procurar o verbete pelo nome"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              onKeyDown={aoTeclarNaBusca}
            />
            {achados.length === 0 ? (
              <p className="pr-pergunta__bloqueio">Nenhum personagem, lugar, item ou facção com esse nome.</p>
            ) : (
              <ul className="pr-pergunta__achados" aria-label="Verbetes achados">
                {achados.map((verbete) => (
                  <li key={verbete.id}>
                    <button type="button" className="pr-pergunta__achado" aria-pressed={verbete.id === escolhido} onClick={() => setEscolhido(verbete.id)}>
                      <span>{verbete.titulo || 'Sem nome'}</span>
                      <span className="pr-pergunta__achado-tipo">{ROTULO_DO_TIPO[verbete.tipo].um}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="pr-pergunta__linha">
          {modo === 'novo' && (
            <select className="pr-pergunta__tipo" aria-label="Tipo do verbete" value={tipo} onChange={(evento) => setTipo(TIPOS.find((cada) => cada === evento.target.value) ?? 'personagem')}>
              {TIPOS.map((cada) => (
                <option key={cada} value={cada}>
                  {ROTULO_DO_TIPO[cada].um}
                </option>
              ))}
            </select>
          )}
          <input
            ref={campo}
            className="pr-pergunta__campo"
            aria-label={modo === 'novo' ? 'Nome do verbete' : 'Nome da forma'}
            placeholder={modo === 'novo' ? 'Nome' : 'Nome da forma'}
            value={nome}
            maxLength={120}
            onChange={(evento) => setNome(evento.target.value)}
          />
          <button type="submit" className="gr-bt gr-bt--p gr-bt--primario" disabled={limpo === '' || criando || (modo === 'forma' && alvo === undefined)} aria-busy={criando}>
            {criando ? 'Criando…' : modo === 'novo' ? 'Criar o verbete' : alvo === undefined ? 'Escolha o verbete' : `Criar a forma em ${alvo.titulo || 'Sem nome'}`}
          </button>
          <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoDispensar}>
            Agora não
          </button>
        </div>
      </form>
      {erro !== null && (
        <p className="pr-pergunta__erro" role="alert">
          {erro}
        </p>
      )}
    </div>
  )
}
