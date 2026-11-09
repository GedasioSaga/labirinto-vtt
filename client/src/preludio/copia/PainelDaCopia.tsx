import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  cancelarLogin,
  contaDoGoogle,
  copiarAgora,
  copiasNoDrive,
  entrarComGoogle,
  ouvirAndamento,
  restaurarCopia,
  sairDoGoogle,
  ultimaCopia,
  type Andamento,
  type CopiaNoDrive,
  type FalhaDaCopia,
  type UltimaCopia,
} from './ponteDaCopia'
import { precisaDaCopiaDiaria, textoDaCopia, textoDaCopiaFeita, textoDaData, textoDaRestauracao, textoDaRestauracaoBarrada, textoDoAndamento } from './textosDaCopia'
import './copia.css'

/**
 * A CÓPIA NO GOOGLE DRIVE, na tela do Prelúdio (docs/planos/preludio-2026-11-08.md,
 * "Depois do conselho"): entrar com o Google, a última cópia, "Copiar agora" e
 * "Restaurar uma data". A cópia diária roda sozinha ao abrir o Prelúdio
 * (`precisaDaCopiaDiaria`); o login e o Drive são do Rust (`ponteDaCopia.ts`).
 */

type Conta =
  | { t: 'lendo' }
  | { t: 'pronta'; credenciaisNaBuild: boolean; email: string | null }
  | { t: 'indisponivel'; falha: FalhaDaCopia }

/** `alheia` = a cópia foi aberta antes (o mestre saiu e voltou no meio): a tela só acompanha. */
type Trabalho = { t: 'parado' } | { t: 'entrando' } | { t: 'copiando'; alheia: boolean } | { t: 'restaurando' }

type Escolha =
  | { t: 'fechada' }
  | { t: 'listando' }
  | { t: 'aberta'; copias: CopiaNoDrive[]; escolhida: string | null; confirmando: boolean }

interface Recado {
  tom: 'ok' | 'erro'
  texto: string
  avisos: string[]
}

/**
 * A tela pode montar duas vezes seguidas (StrictMode, ir e voltar): a cópia
 * diária não sai de novo dentro deste respiro.
 */
const RESPIRO_DA_AUTOMATICA_MS = 10 * 60 * 1000
let ultimaAutomatica = 0

function erro(falha: FalhaDaCopia): Recado {
  return { tom: 'erro', texto: falha.mensagem, avisos: [] }
}

export interface PainelDaCopiaProps {
  /**
   * A restauração vai trocar a pasta preparo/: antes de baixar, a tela trava a
   * edição e grava o que estava pendente. Devolve o motivo quando algo não
   * gravou, e aí a restauração não começa.
   */
  antesDeRestaurar?: () => Promise<string | null>
  /**
   * Chamado sempre que a restauração acaba, mesmo com o painel já fechado:
   * `restaurou` = trocou a pasta (a tela relê o que voltou). A tela destrava.
   */
  depoisDeRestaurar?: (restaurou: boolean) => Promise<void>
  /**
   * Sobe a cada pedido de cópia vindo de fora (a importação do Grimório acabou de
   * gravar): com login, a cópia sai assim que o painel estiver livre.
   */
  pedidoDeCopia?: number
  /** Outra parte da tela está gravando no Prelúdio: copiar e restaurar esperam. */
  travado?: boolean
}

export function PainelDaCopia({ antesDeRestaurar, depoisDeRestaurar, pedidoDeCopia = 0, travado = false }: PainelDaCopiaProps) {
  const id = useId()
  const [conta, setConta] = useState<Conta>({ t: 'lendo' })
  const [ultima, setUltima] = useState<UltimaCopia | null>(null)
  const [trabalho, setTrabalho] = useState<Trabalho>({ t: 'parado' })
  const [andamento, setAndamento] = useState<Andamento | null>(null)
  const [escolha, setEscolha] = useState<Escolha>({ t: 'fechada' })
  const [recado, setRecado] = useState<Recado | null>(null)
  const montado = useRef(false)
  const trabalhoAtual = useRef<Trabalho>(trabalho)
  trabalhoAtual.current = trabalho

  const copiar = useCallback(async (automatica: boolean) => {
    setTrabalho({ t: 'copiando', alheia: false })
    setAndamento(null)
    if (!automatica) setRecado(null)
    const resultado = await copiarAgora()
    if (!montado.current) return
    setAndamento(null)
    if (resultado.ok) {
      setTrabalho({ t: 'parado' })
      setUltima(resultado.valor)
      setRecado({ tom: 'ok', texto: textoDaCopiaFeita(resultado.valor), avisos: resultado.valor.avisos })
      return
    }
    const { falha } = resultado
    if (falha.t === 'ocupado') {
      setTrabalho({ t: 'copiando', alheia: true })
      return
    }
    setTrabalho({ t: 'parado' })
    if (falha.t === 'sem-conta') setConta((atual) => (atual.t === 'pronta' ? { ...atual, email: null } : atual))
    // A cópia diária de um Prelúdio ainda vazio não é problema de ninguém.
    if (automatica && falha.t === 'vazio') return
    setRecado(erro(falha))
  }, [])

  // O andamento vem por evento; o `fim` de uma cópia aberta antes devolve a tela ao normal.
  useEffect(() => {
    montado.current = true
    const pararDeOuvir = ouvirAndamento((novo) => {
      if (!montado.current) return
      if (novo.fase !== 'fim') {
        setAndamento(novo)
        return
      }
      setAndamento(null)
      const agora = trabalhoAtual.current
      if (agora.t !== 'copiando' || !agora.alheia) return
      setTrabalho({ t: 'parado' })
      void ultimaCopia().then((lida) => {
        if (montado.current && lida.ok) setUltima(lida.valor)
      })
    })
    return () => {
      montado.current = false
      pararDeOuvir()
      // Sair da tela no meio do login desiste dele (a porta local não fica 5 min aberta à toa).
      if (trabalhoAtual.current.t === 'entrando') void cancelarLogin()
    }
  }, [])

  // A conta, a última cópia e, se já passou um dia, a cópia diária.
  useEffect(() => {
    let vivo = true
    void Promise.all([contaDoGoogle(), ultimaCopia()]).then(([lida, ultimaLida]) => {
      if (!vivo) return
      const ultimaNoPc = ultimaLida.ok ? ultimaLida.valor : null
      setUltima(ultimaNoPc)
      if (!lida.ok) {
        setConta({ t: 'indisponivel', falha: lida.falha })
        return
      }
      setConta({ t: 'pronta', ...lida.valor })
      const agora = Date.now()
      if (lida.valor.email === null || !precisaDaCopiaDiaria(ultimaNoPc, agora) || agora - ultimaAutomatica < RESPIRO_DA_AUTOMATICA_MS) return
      ultimaAutomatica = agora
      void copiar(true)
    })
    return () => {
      vivo = false
    }
  }, [copiar])

  // O pedido de fora espera o painel ficar livre (uma cópia diária pode estar andando) e a conta ser lida.
  const pedidoAtendido = useRef(pedidoDeCopia)
  useEffect(() => {
    if (pedidoDeCopia === pedidoAtendido.current || trabalho.t !== 'parado' || travado || conta.t === 'lendo') return
    pedidoAtendido.current = pedidoDeCopia
    if (conta.t !== 'pronta' || conta.email === null) return
    ultimaAutomatica = Date.now()
    void copiar(false)
  }, [pedidoDeCopia, trabalho, travado, conta, copiar])

  const entrar = async () => {
    setRecado(null)
    setTrabalho({ t: 'entrando' })
    const resultado = await entrarComGoogle()
    if (!montado.current) return
    setTrabalho({ t: 'parado' })
    if (!resultado.ok) {
      if (resultado.falha.t !== 'cancelado') setRecado(erro(resultado.falha))
      return
    }
    const email = resultado.valor
    setConta((atual) => (atual.t === 'pronta' ? { ...atual, email } : { t: 'pronta', credenciaisNaBuild: true, email }))
    // A primeira cópia sai logo depois do login.
    ultimaAutomatica = Date.now()
    void copiar(false)
  }

  const sair = async () => {
    setRecado(null)
    const resultado = await sairDoGoogle()
    if (!montado.current) return
    if (!resultado.ok) {
      setRecado(erro(resultado.falha))
      return
    }
    setConta((atual) => (atual.t === 'pronta' ? { ...atual, email: null } : atual))
    setEscolha({ t: 'fechada' })
  }

  const abrirDatas = async () => {
    setRecado(null)
    setEscolha({ t: 'listando' })
    const resultado = await copiasNoDrive()
    if (!montado.current) return
    if (!resultado.ok) {
      setEscolha({ t: 'fechada' })
      setRecado(erro(resultado.falha))
      return
    }
    const copias = resultado.valor
    setEscolha({ t: 'aberta', copias, escolhida: copias[0]?.id ?? null, confirmando: false })
  }

  const restaurar = async (copia: CopiaNoDrive) => {
    setRecado(null)
    setTrabalho({ t: 'restaurando' })
    setAndamento(null)
    let barrada: string | null = null
    let resultado: Awaited<ReturnType<typeof restaurarCopia>> | null = null
    try {
      barrada = (await antesDeRestaurar?.()) ?? null
      if (barrada === null) resultado = await restaurarCopia(copia.id)
    } finally {
      // Destravar não depende do painel continuar aberto: sem isto, a edição ficaria travada até sair do Prelúdio.
      await depoisDeRestaurar?.(resultado?.ok === true)
    }
    if (!montado.current) return
    setTrabalho({ t: 'parado' })
    setAndamento(null)
    if (resultado === null || !resultado.ok) {
      setEscolha((atual) => (atual.t === 'aberta' ? { ...atual, confirmando: false } : atual))
      setRecado(resultado === null ? { tom: 'erro', texto: textoDaRestauracaoBarrada(barrada ?? ''), avisos: [] } : erro(resultado.falha))
      return
    }
    setEscolha({ t: 'fechada' })
    setRecado({ tom: 'ok', texto: textoDaRestauracao(resultado.valor, copia.quando), avisos: [] })
  }

  const titulo = `${id}-t`
  const ocupado = trabalho.t !== 'parado' || travado
  const textoDoAndar = andamento === null ? null : textoDoAndamento(andamento)
  const comBarra = andamento !== null && (andamento.fase === 'enviando' || andamento.fase === 'baixando') && andamento.total > 0

  return (
    <section className="pl-copia" aria-labelledby={titulo} aria-busy={conta.t === 'lendo' || ocupado}>
      <div className="pl-copia__cab">
        <h2 className="pl-copia__t" id={titulo}>
          Cópia no Google Drive
        </h2>
        {conta.t === 'pronta' && conta.email !== null && <span className="pl-copia__marca">Conectado</span>}
      </div>

      {conta.t === 'lendo' && <p className="pl-copia__dica">Olhando a conta guardada neste PC…</p>}
      {conta.t === 'indisponivel' && (
        <p className="pl-copia__aviso" role="status">
          {conta.falha.mensagem}
        </p>
      )}

      {conta.t === 'pronta' && conta.email === null && (
        <>
          <p className="pl-copia__dica">
            Entre com a sua conta do Google para guardar uma cópia do Prelúdio no seu Drive, todo dia, só com o que mudou. O app só enxerga a pasta que ele mesmo cria lá.
          </p>
          {!conta.credenciaisNaBuild && (
            <p className="pl-copia__aviso" role="status">
              Esta versão do Labirinto saiu sem o cliente do Google, então o login não funciona nela. A próxima versão publicada traz.
            </p>
          )}
          <div className="pl-copia__linha">
            <button type="button" className="lb-btn lb-btn--primary" disabled={!conta.credenciaisNaBuild || ocupado} onClick={() => void entrar()}>
              {trabalho.t === 'entrando' ? 'Esperando o navegador…' : 'Entrar com Google'}
            </button>
            {trabalho.t === 'entrando' && (
              <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => void cancelarLogin()}>
                Cancelar
              </button>
            )}
          </div>
          {trabalho.t === 'entrando' && <p className="pl-copia__dica">Termine o login na aba que abriu no navegador e volte para cá.</p>}
        </>
      )}

      {conta.t === 'pronta' && conta.email !== null && (
        <>
          <p className="pl-copia__texto">
            Conta: <b className="pl-copia__email">{conta.email}</b>{' '}
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={ocupado} onClick={() => void sair()}>
              Sair
            </button>
          </p>
          <p className="pl-copia__texto">
            {ultima === null ? 'Ainda não houve cópia neste PC.' : `Última cópia: ${textoDaCopia(ultima)}.`}
          </p>
          <p className="pl-copia__dica">Ela roda sozinha ao abrir o Prelúdio, uma vez por dia.</p>
          <div className="pl-copia__linha">
            <button type="button" className="lb-btn lb-btn--primary" disabled={ocupado} onClick={() => void copiar(false)}>
              {trabalho.t === 'copiando' ? 'Copiando…' : 'Copiar agora'}
            </button>
            <button
              type="button"
              className="lb-btn"
              disabled={ocupado || escolha.t !== 'fechada'}
              aria-expanded={escolha.t === 'aberta'}
              onClick={() => void abrirDatas()}
            >
              {escolha.t === 'listando' ? 'Buscando as datas…' : 'Restaurar uma data…'}
            </button>
          </div>
          {escolha.t === 'aberta' && (
            <EscolhaDaData
              escolha={escolha}
              ocupado={ocupado}
              onEscolher={(copiaId) => setEscolha({ ...escolha, escolhida: copiaId, confirmando: false })}
              onConfirmar={(confirmando) => setEscolha({ ...escolha, confirmando })}
              onFechar={() => setEscolha({ t: 'fechada' })}
              onRestaurar={(copia) => void restaurar(copia)}
            />
          )}
        </>
      )}

      {trabalho.t === 'copiando' && trabalho.alheia && andamento === null && (
        <p className="pl-copia__dica">Uma cópia ou restauração começou antes e ainda está andando…</p>
      )}
      {ocupado && textoDoAndar !== null && (
        <div className="pl-copia__andar">
          {comBarra && <progress className="pl-copia__barra" value={andamento.feitos} max={andamento.total} aria-label="Andamento" />}
          <p className="pl-copia__dica">{textoDoAndar}</p>
        </div>
      )}

      {recado !== null && (
        <div className="pl-copia__recado" role={recado.tom === 'erro' ? 'alert' : 'status'}>
          <p className={recado.tom === 'erro' ? 'lb-field__error' : 'pl-copia__ok'}>{recado.texto}</p>
          {recado.avisos.length > 0 && (
            <ul className="pl-copia__avisos">
              {recado.avisos.map((aviso) => (
                <li key={aviso}>{aviso}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

interface EscolhaDaDataProps {
  escolha: Extract<Escolha, { t: 'aberta' }>
  ocupado: boolean
  onEscolher: (copiaId: string) => void
  onConfirmar: (confirmando: boolean) => void
  onFechar: () => void
  onRestaurar: (copia: CopiaNoDrive) => void
}

/** A lista das datas no Drive e a confirmação, que diz que o Prelúdio de agora não se perde. */
function EscolhaDaData({ escolha, ocupado, onEscolher, onConfirmar, onFechar, onRestaurar }: EscolhaDaDataProps) {
  const id = useId()
  const escolhida = escolha.copias.find((copia) => copia.id === escolha.escolhida) ?? null
  const botaoRestaurar = useRef<HTMLButtonElement>(null)
  const estavaConfirmando = useRef(escolha.confirmando)

  // Desistir da confirmação devolve o foco ao botão que a abriu (senão ele cairia no body).
  useEffect(() => {
    if (estavaConfirmando.current && !escolha.confirmando) botaoRestaurar.current?.focus()
    estavaConfirmando.current = escolha.confirmando
  }, [escolha.confirmando])

  // O Esc é desta caixa: sem isto ele subiria até o `MenuShell`, que ouve Escape no `window` e tiraria o mestre da tela.
  const aoTeclar = (evento: KeyboardEvent<HTMLFieldSetElement>) => {
    if (evento.key !== 'Escape' || ocupado) return
    evento.preventDefault()
    evento.stopPropagation()
    if (escolha.confirmando) onConfirmar(false)
    else onFechar()
  }

  return (
    <fieldset className="pl-copia__datas" onKeyDown={aoTeclar} disabled={ocupado}>
      <legend className="pl-copia__legenda">Restaurar de uma data</legend>
      {escolha.copias.length === 0 ? (
        <p className="pl-copia__dica">Ainda não há cópia desta conta no Google Drive.</p>
      ) : (
        <ul className="pl-copia__lista">
          {escolha.copias.map((copia) => (
            <li key={copia.id}>
              <label className="pl-copia__data">
                <input type="radio" name={`${id}-data`} checked={copia.id === escolha.escolhida} onChange={() => onEscolher(copia.id)} />
                {textoDaCopia(copia)}
              </label>
            </li>
          ))}
        </ul>
      )}
      {escolhida !== null && escolha.confirmando ? (
        <div className="pl-copia__confirmar" role="group" aria-label="Confirmar a restauração">
          <p className="pl-copia__aviso">
            O Prelúdio deste PC volta a ser o de {textoDaData(escolhida.quando)}. O de agora não se perde: fica guardado na pasta de dados do app.
          </p>
          <div className="pl-copia__linha">
            <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={() => onRestaurar(escolhida)}>
              {ocupado ? 'Restaurando…' : 'Restaurar esta data'}
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" autoFocus onClick={() => onConfirmar(false)}>
              Manter o de agora
            </button>
          </div>
        </div>
      ) : (
        <div className="pl-copia__linha">
          <button ref={botaoRestaurar} type="button" className="lb-btn lb-btn--compact" disabled={escolhida === null} onClick={() => onConfirmar(true)}>
            Restaurar esta data…
          </button>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
            Fechar
          </button>
        </div>
      )}
    </fieldset>
  )
}
