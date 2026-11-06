import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { apagarCredencial, conferirConta, credencialGuardada, guardarCredencial, type FalhaDoLobby } from './ponteDoLobby'

/**
 * "CONTA NA NUVEM" (docs/planos/lobby-jogadores-2026-11-05.md §3.2 e §6.1,
 * fatias R1 e A6): o mestre cola o Service Token do Access (Client ID e
 * Client Secret) uma vez; o Rust o guarda no Cofre do Windows e é por ele que
 * o app fala com o Lobby. O segredo nunca volta para a tela.
 */

export type EstadoDaConta = { t: 'carregando' } | { t: 'pronta'; guardada: boolean } | { t: 'indisponivel'; falha: FalhaDoLobby }

export interface ContaNaNuvemProps {
  onEstado?: (estado: EstadoDaConta) => void
}

type Conferencia = { t: 'nada' } | { t: 'conferindo' } | { t: 'ok'; email: string } | { t: 'falhou'; mensagem: string }

export function ContaNaNuvem({ onEstado }: ContaNaNuvemProps) {
  const id = useId()
  const [estado, setEstadoLocal] = useState<EstadoDaConta>({ t: 'carregando' })
  const [trocando, setTrocando] = useState(false)
  const [conferencia, setConferencia] = useState<Conferencia>({ t: 'nada' })
  const [apagando, setApagando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const avisar = useRef(onEstado)
  avisar.current = onEstado

  const definir = (novo: EstadoDaConta) => {
    setEstadoLocal(novo)
    avisar.current?.(novo)
  }

  useEffect(() => {
    let vivo = true
    void credencialGuardada().then((resultado) => {
      if (!vivo) return
      const novo: EstadoDaConta = resultado.ok ? { t: 'pronta', guardada: resultado.valor } : { t: 'indisponivel', falha: resultado.falha }
      setEstadoLocal(novo)
      avisar.current?.(novo)
    })
    return () => {
      vivo = false
    }
  }, [])

  const conferir = async () => {
    setConferencia({ t: 'conferindo' })
    const resultado = await conferirConta()
    setConferencia(resultado.ok ? { t: 'ok', email: resultado.valor.email } : { t: 'falhou', mensagem: resultado.falha.mensagem })
  }

  const apagar = async () => {
    setErro(null)
    const resultado = await apagarCredencial()
    setApagando(false)
    if (!resultado.ok) {
      setErro(resultado.falha.mensagem)
      return
    }
    setConferencia({ t: 'nada' })
    definir({ t: 'pronta', guardada: false })
  }

  if (estado.t === 'carregando') {
    return (
      <section className="lby-conta" aria-labelledby={`${id}-t`} aria-busy="true">
        <h4 className="lby-cab__t" id={`${id}-t`}>
          Conta na nuvem
        </h4>
        <p className="lby-dica">Olhando o Cofre do Windows…</p>
      </section>
    )
  }

  if (estado.t === 'indisponivel') {
    return (
      <section className="lby-conta" aria-labelledby={`${id}-t`}>
        <h4 className="lby-cab__t" id={`${id}-t`}>
          Conta na nuvem
        </h4>
        <p className="lby-aviso" data-tom="latao" role="status">
          {estado.falha.mensagem}
        </p>
      </section>
    )
  }

  const formAberto = !estado.guardada || trocando
  return (
    <section className="lby-conta" aria-labelledby={`${id}-t`}>
      <div className="lby-cab">
        <h4 className="lby-cab__t" id={`${id}-t`}>
          Conta na nuvem
        </h4>
        {estado.guardada && !trocando && <span className="lby-marca" data-tom="ok">Token guardado</span>}
      </div>
      {formAberto ? (
        <FormDoToken
          podeCancelar={estado.guardada}
          onCancelar={() => setTrocando(false)}
          onGuardado={() => {
            setTrocando(false)
            definir({ t: 'pronta', guardada: true })
            void conferir()
          }}
        />
      ) : (
        <>
          <p className="lby-dica">O app fala com o Lobby por este token, guardado no Cofre do Windows. Ele nunca aparece na tela nem vai para arquivo.</p>
          <div className="lby-linha">
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={conferencia.t === 'conferindo'} onClick={() => void conferir()}>
              {conferencia.t === 'conferindo' ? 'Conferindo…' : 'Conferir conexão'}
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setTrocando(true)}>
              Trocar token
            </button>
            {apagando ? (
              <span className="lby-linha" role="group" aria-label="Confirmar apagar o token">
                <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => void apagar()}>
                  Apagar o token
                </button>
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" autoFocus onClick={() => setApagando(false)}>
                  Manter
                </button>
              </span>
            ) : (
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setApagando(true)}>
                Apagar
              </button>
            )}
          </div>
          {conferencia.t === 'ok' && (
            <p className="lby-ok" role="status">
              Conectado. O Lobby reconhece o app como {conferencia.email}.
            </p>
          )}
          {conferencia.t === 'falhou' && (
            <p className="lb-field__error" role="alert">
              {conferencia.mensagem}
            </p>
          )}
        </>
      )}
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
    </section>
  )
}

interface FormDoTokenProps {
  podeCancelar: boolean
  onCancelar: () => void
  onGuardado: () => void
}

function FormDoToken({ podeCancelar, onCancelar, onGuardado }: FormDoTokenProps) {
  const id = useId()
  const [clientId, setClientId] = useState('')
  const [segredo, setSegredo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [erros, setErros] = useState<{ id?: string; segredo?: string; geral?: string }>({})
  const idRef = useRef<HTMLInputElement>(null)
  const segredoRef = useRef<HTMLInputElement>(null)

  const guardar = async (event: FormEvent) => {
    event.preventDefault()
    const novos: typeof erros = {}
    if (clientId.trim() === '') novos.id = 'Cole o Client ID do token.'
    if (segredo.trim() === '') novos.segredo = 'Cole o Client Secret do token.'
    setErros(novos)
    if (novos.id !== undefined) {
      idRef.current?.focus()
      return
    }
    if (novos.segredo !== undefined) {
      segredoRef.current?.focus()
      return
    }
    setGuardando(true)
    const resultado = await guardarCredencial(clientId, segredo)
    setGuardando(false)
    if (!resultado.ok) {
      setErros({ geral: resultado.falha.mensagem })
      return
    }
    setClientId('')
    setSegredo('')
    onGuardado()
  }

  return (
    <form
      className="lby-form"
      noValidate
      onSubmit={(event) => void guardar(event)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && podeCancelar) onCancelar()
      }}
      aria-label="Colar o token do app"
    >
      <p className="lby-dica">
        No painel Zero Trust da Cloudflare, em Access, Service Auth, crie (ou abra) o token do app e cole as duas partes aqui. O segredo fica só no Cofre do Windows.
      </p>
      <div className="lby-campo">
        <label className="lby-rot" htmlFor={`${id}-id`}>
          Client ID
        </label>
        <input
          ref={idRef}
          id={`${id}-id`}
          className="lby-input"
          value={clientId}
          autoComplete="off"
          spellCheck={false}
          placeholder="termina em .access"
          aria-invalid={erros.id !== undefined}
          aria-describedby={erros.id !== undefined ? `${id}-id-erro` : undefined}
          onChange={(event) => setClientId(event.target.value)}
        />
        {erros.id !== undefined && (
          <p className="lby-erro" id={`${id}-id-erro`}>
            {erros.id}
          </p>
        )}
      </div>
      <div className="lby-campo">
        <label className="lby-rot" htmlFor={`${id}-segredo`}>
          Client Secret
        </label>
        <input
          ref={segredoRef}
          id={`${id}-segredo`}
          className="lby-input"
          type="password"
          value={segredo}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={erros.segredo !== undefined}
          aria-describedby={erros.segredo !== undefined ? `${id}-segredo-erro` : undefined}
          onChange={(event) => setSegredo(event.target.value)}
        />
        {erros.segredo !== undefined && (
          <p className="lby-erro" id={`${id}-segredo-erro`}>
            {erros.segredo}
          </p>
        )}
      </div>
      {erros.geral !== undefined && (
        <p className="lb-field__error" role="alert">
          {erros.geral}
        </p>
      )}
      <div className="lby-linha">
        <button type="submit" className="lb-btn lb-btn--primary lb-btn--compact" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar token'}
        </button>
        {podeCancelar && (
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
