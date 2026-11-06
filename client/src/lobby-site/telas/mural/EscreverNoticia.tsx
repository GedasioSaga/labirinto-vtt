import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { cleanChatText } from '../../../lib/chat'
import { MURAL_TEXTO_MAX } from '../../../lib/nuvem/muralDoLobby'

/**
 * ESCREVER UMA NOTÍCIA (só o mestre): o texto, a imagem opcional entre as que
 * a mesa já guarda e o botão. Serve para a notícia nova e para editar uma que
 * já existe. Ctrl+Enter posta; na edição, Esc cancela sem mudar nada.
 */

/** A partir daqui o contador muda de cor: está chegando no teto. */
const PERTO_DO_TETO = MURAL_TEXTO_MAX - 300

export interface ImagemParaEscolher {
  ref: string
  /** `null` = não dá para mostrar a miniatura aqui (a escolha continua valendo). */
  src: string | null
  nome: string
}

interface Props {
  modo: 'nova' | 'editar'
  textoInicial?: string
  imagemInicial?: string | null
  imagens: readonly ImagemParaEscolher[]
  /** O canal está pronto (sem ele, a nova espera a volta; a edição não sai). */
  pronto: boolean
  /** Editando: o pedido saiu e espera o servidor. */
  salvando?: boolean
  /** `false` = não saiu (texto que não vai, ou sem canal na edição). */
  aoEnviar(texto: string, imagem: string | null): boolean
  aoCancelar?: () => void
}

export function EscreverNoticia({ modo, textoInicial = '', imagemInicial = null, imagens, pronto, salvando = false, aoEnviar, aoCancelar }: Props) {
  const id = useId()
  const campo = useRef<HTMLTextAreaElement>(null)
  const [texto, setTexto] = useState(textoInicial)
  const [imagem, setImagem] = useState<string | null>(imagemInicial)
  const [erro, setErro] = useState<string | null>(null)
  const tamanho = texto.length
  // A imagem que a notícia já tinha continua na lista mesmo que a mesa não a mostre mais.
  const escolhas = imagemInicial !== null && !imagens.some((candidata) => candidata.ref === imagemInicial) ? [{ ref: imagemInicial, src: null, nome: 'A imagem atual' }, ...imagens] : imagens

  function enviar(evento?: FormEvent) {
    evento?.preventDefault()
    if (salvando) return
    const limpo = cleanChatText(texto)
    if (limpo === '') {
      setErro('Escreva o texto da notícia.')
      campo.current?.focus()
      return
    }
    if (limpo.length > MURAL_TEXTO_MAX) {
      setErro(`O texto passou de ${MURAL_TEXTO_MAX.toLocaleString('pt-BR')} caracteres.`)
      campo.current?.focus()
      return
    }
    if (!aoEnviar(texto, imagem)) {
      setErro(modo === 'editar' ? 'Sem conexão agora: a edição não saiu. Tente quando a conexão voltar.' : 'Não deu para postar este texto.')
      return
    }
    setErro(null)
    if (modo === 'nova') {
      setTexto('')
      setImagem(null)
      campo.current?.focus()
    }
  }

  function tecla(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault()
      enviar()
    } else if (evento.key === 'Escape' && modo === 'editar' && aoCancelar !== undefined) {
      evento.preventDefault()
      aoCancelar()
    }
  }

  return (
    <form className={modo === 'editar' ? 'lo-mural-escrever lo-mural-escrever--editar' : 'lo-mural-escrever'} onSubmit={enviar} aria-label={modo === 'editar' ? 'Editar a notícia' : 'Escrever uma notícia'}>
      <div className="lo-campo">
        <label htmlFor={`${id}-texto`}>{modo === 'editar' ? 'Texto da notícia' : 'Nova notícia para a mesa'}</label>
        <textarea
          id={`${id}-texto`}
          ref={campo}
          className="lo-texto"
          value={texto}
          maxLength={MURAL_TEXTO_MAX}
          rows={4}
          autoFocus={modo === 'editar'}
          aria-invalid={erro !== null}
          aria-describedby={`${id}-dicas${erro !== null ? ` ${id}-erro` : ''}`}
          onChange={(evento) => {
            setTexto(evento.target.value)
            if (erro !== null) setErro(null)
          }}
          onKeyDown={tecla}
        />
        <div className="lo-mural-escrever__dicas" id={`${id}-dicas`}>
          <span className="lo-motivo">@Nome avisa a pessoa. Ctrl+Enter {modo === 'editar' ? 'salva' : 'posta'}.</span>
          <span className="lo-motivo lo-mural-escrever__contador" data-perto={tamanho >= PERTO_DO_TETO ? '1' : undefined}>
            {tamanho.toLocaleString('pt-BR')} de {MURAL_TEXTO_MAX.toLocaleString('pt-BR')}
          </span>
        </div>
      </div>
      <fieldset className="lo-mural-imagens">
        <legend>Imagem (opcional)</legend>
        {escolhas.length > 0 && (
          <div className="lo-mural-imagens__lista">
            <label className="lo-mural-imagem">
              <input type="radio" name={`${id}-imagem`} checked={imagem === null} onChange={() => setImagem(null)} />
              Sem imagem
            </label>
            {escolhas.map((escolha) => (
              <label key={escolha.ref} className="lo-mural-imagem" title={escolha.nome}>
                <input type="radio" name={`${id}-imagem`} checked={imagem === escolha.ref} onChange={() => setImagem(escolha.ref)} aria-label={escolha.nome} />
                {escolha.src === null ? <span aria-hidden="true">{escolha.nome}</span> : <img src={escolha.src} alt="" />}
              </label>
            ))}
          </div>
        )}
        <p className="lo-motivo">
          {escolhas.length === 0
            ? 'Esta mesa ainda não guarda nenhuma imagem no Lobby. As imagens sobem pelo app do mestre, junto com as fichas.'
            : 'Só aparecem as imagens que esta mesa já guarda no Lobby (as que o app do mestre subiu com as fichas e as das notícias).'}
        </p>
      </fieldset>
      {erro !== null && (
        <p className="lo-erro-campo" id={`${id}-erro`} role="alert">
          {erro}
        </p>
      )}
      <div className="lo-mural-escrever__acoes">
        <button type="submit" className="lo-btn lo-btn--primario" disabled={salvando || (modo === 'editar' && !pronto)}>
          {salvando ? <span className="lo-giro" aria-hidden="true" /> : null}
          {modo === 'editar' ? (salvando ? 'Salvando…' : 'Salvar') : 'Postar no mural'}
        </button>
        {aoCancelar !== undefined && (
          <button type="button" className="lo-btn" onClick={aoCancelar} disabled={salvando}>
            Cancelar
          </button>
        )}
        {!pronto && <span className="lo-motivo">{modo === 'editar' ? 'Sem conexão: dá para salvar quando ela voltar.' : 'Sem conexão: a notícia fica esperando e sai quando ela voltar.'}</span>}
      </div>
    </form>
  )
}
