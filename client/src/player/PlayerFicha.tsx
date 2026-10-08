import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { FichaDePersonagem } from '../components/FichaDePersonagem'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import type { TokenDoPersonagem } from '../net/protocoloDoPersonagem'
import type { EnvioDePersonagem, SalvarPersonagem } from './playerConnection'
import './PlayerFicha.css'

export interface PlayerFichaProps {
  /** O sistema da aventura; `null`/`undefined` = sem sistema (a tela diz isso, em vez de uma ficha vazia). */
  sistema: SistemaDeRpg | null | undefined
  /** Os personagens das fichas (tokens) dele, como o host mandou. */
  personagens: readonly Personagem[]
  /** As fichas (tokens) dele, com ou sem personagem: a sem personagem ganha "Criar". */
  tokens: readonly TokenDoPersonagem[]
  envio: EnvioDePersonagem | undefined
  /** Aberta pelo teclado: aparece já, sem animação. */
  instant?: boolean
  onCriar: (tokenId: string) => boolean
  onSalvar: (base: Personagem, rascunho: Personagem) => SalvarPersonagem
  onClose: () => void
  /** Pede uma imagem ao aparelho, já reduzida para viajar; `null` = cancelou. */
  escolherImagem: () => Promise<string | null>
}

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

const ERRO_AO_CRIAR = 'A mesa não criou a ficha. Confira a conexão e tente de novo.'
const ERRO_AO_SALVAR = 'A mesa não confirmou o que você salvou. A ficha continua aberta: salve de novo.'
const ERRO_SEM_CONEXAO = 'Não deu para pedir agora: confira a conexão com a mesa e tente de novo.'

/** A ficha em edição: `base` é como ela estava quando a edição abriu (o "Salvar" manda só o que mudou desde ela). */
interface Edicao {
  base: Personagem
  rascunho: Personagem
}

/** O envio que esta tela começou. `antes`: o id do envio que já existia — a resposta dele não é a deste. */
interface Espera {
  tipo: EnvioDePersonagem['tipo']
  antes: number | undefined
}

/**
 * FICHA DE PERSONAGEM do jogador, em tela cheia (o botão "Ficha" da barra).
 * O miolo é a MESMA ficha do mestre (`FichaDePersonagem`): lê por padrão e,
 * em "Editar", cada número e texto vira campo num RASCUNHO até "Salvar" —
 * sem pedir licença ao mestre. Sem "Tipo" (Jogador/NPC é do mestre).
 *
 * O "Salvar" só termina quando a mesa confirma (`envio`): confirmado, a
 * ficha sai da edição já com o que a mesa gravou; recusado (ou a conexão
 * caiu), a ficha continua aberta com o rascunho, e o aviso diz o que houve.
 * A edição do mestre chega ao vivo: fora da edição a ficha muda na hora; em
 * edição, o aviso conta, e o "Salvar" troca só as partes que o jogador mexeu.
 */
export function PlayerFicha({ sistema, personagens, tokens, envio, instant = false, onCriar, onSalvar, onClose, escolherImagem }: PlayerFichaProps) {
  const tituloId = useId()
  const raizRef = useRef<HTMLDivElement>(null)
  const [escolhidoId, setEscolhidoId] = useState<string | null>(null)
  const [edicao, setEdicao] = useState<Edicao | null>(null)
  const [espera, setEspera] = useState<Espera | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [perguntaDeSaida, setPerguntaDeSaida] = useState(false)

  const idMostrado = edicao === null ? escolhidoId : edicao.base.id
  const mostrado = personagens.find((personagem) => personagem.id === idMostrado) ?? personagens.at(0)
  const semPersonagem = tokens.filter((token) => token.personagemId === null)
  const mudou = edicao !== null && edicao.rascunho !== edicao.base
  const salvando = espera !== null

  useEffect(() => {
    const quemAbriu = document.activeElement
    raizRef.current?.focus()
    return () => {
      if (quemAbriu instanceof HTMLElement && quemAbriu !== document.body && quemAbriu.isConnected) quemAbriu.focus()
    }
  }, [])

  // A resposta da mesa ao envio desta tela: só quando TODOS os pedidos dele responderam.
  useEffect(() => {
    if (espera === null || envio === undefined || envio.id === espera.antes || envio.pendentes.length > 0) return
    setEspera(null)
    if (envio.falhou) {
      setErro(espera.tipo === 'criar' ? ERRO_AO_CRIAR : ERRO_AO_SALVAR)
      return
    }
    setErro(null)
    if (espera.tipo === 'salvar') {
      setEdicao(null)
      return
    }
    // A ficha que nasceu já chegou (o host a manda antes da resposta): abre em edição, para preencher.
    const nascida = envio.personagemId === null ? undefined : personagens.find((personagem) => personagem.id === envio.personagemId)
    if (nascida === undefined) return
    setEscolhidoId(nascida.id)
    setEdicao({ base: nascida, rascunho: nascida })
  }, [envio, espera, personagens])

  // O mestre tirou a ficha dele (ou apagou o personagem) no meio da edição: não há mais o que salvar.
  const editandoSumiu = edicao !== null && !personagens.some((personagem) => personagem.id === edicao.base.id)
  useEffect(() => {
    if (!editandoSumiu) return
    setEdicao(null)
    setPerguntaDeSaida(false)
    setErro('Esta ficha não está mais com você: a mesa a tirou enquanto você editava.')
  }, [editandoSumiu])

  const criar = (tokenId: string) => {
    const antes = envio?.id
    if (!onCriar(tokenId)) {
      setErro(ERRO_SEM_CONEXAO)
      return
    }
    setErro(null)
    setEspera({ tipo: 'criar', antes })
  }

  const salvar = () => {
    if (edicao === null) return
    const antes = envio?.id
    const resultado = onSalvar(edicao.base, edicao.rascunho)
    setPerguntaDeSaida(false)
    if (!resultado.ok) {
      setErro(resultado.erro)
      return
    }
    setErro(null)
    if (resultado.nada) setEdicao(null)
    else setEspera({ tipo: 'salvar', antes })
  }

  const cancelar = () => {
    setEdicao(null)
    setErro(null)
    setPerguntaDeSaida(false)
  }

  /** Fechar (Esc, X): com rascunho mudado, pergunta antes de jogar fora o que ele escreveu. */
  const pedirFechar = () => {
    if (mudou) setPerguntaDeSaida(true)
    else onClose()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Tela por cima do mapa: nenhuma tecla daqui vale como atalho do jogo (I, Esc do medir...).
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      pedirFechar()
      return
    }
    if (event.key !== 'Tab') return
    const itens = Array.from(raizRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    const primeiro = itens.at(0)
    const ultimo = itens.at(-1)
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === raizRef.current)) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  const sistemaPronto = sistema === null || sistema === undefined ? null : sistema
  const editadoNaMesa = edicao !== null && mostrado !== undefined && mostrado !== edicao.base && !salvando

  return (
    <div
      ref={raizRef}
      className="pp-ficha"
      role="dialog"
      aria-modal="true"
      aria-labelledby={tituloId}
      tabIndex={-1}
      data-instant={instant ? '' : undefined}
      onKeyDown={onKeyDown}
    >
      <header className="pp-ficha__topo">
        <div className="pp-ficha__titulo">
          <p className="lb-eyebrow">Ficha de personagem{sistemaPronto === null ? '' : ` · ${sistemaPronto.nome}`}</p>
        </div>
        <div className="pp-ficha__acoes">
          {sistemaPronto !== null && mostrado !== undefined && edicao === null && (
            <button type="button" className="lb-btn" onClick={() => setEdicao({ base: mostrado, rascunho: mostrado })}>
              Editar
            </button>
          )}
          {edicao !== null && (
            <>
              <button type="button" className="lb-btn lb-btn--ghost" disabled={salvando} onClick={cancelar}>
                Cancelar
              </button>
              <button type="button" className="lb-btn lb-btn--primary" disabled={salvando} onClick={salvar}>
                {salvando ? 'Salvando…' : 'Salvar'}
              </button>
            </>
          )}
          <button type="button" className="lb-btn pp-ficha__fechar" aria-label="Fechar a ficha" onClick={pedirFechar}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {sistemaPronto !== null && personagens.length > 1 && (
          <ul className="pp-ficha__personagens" aria-label="Seus personagens">
            {personagens.map((personagem) => (
              <li key={personagem.id}>
                <button
                  type="button"
                  className="lb-btn lb-btn--compact"
                  aria-pressed={mostrado !== undefined && personagem.id === mostrado.id}
                  // Trocar de ficha no meio da edição largaria o rascunho sem perguntar.
                  disabled={edicao !== null}
                  onClick={() => setEscolhidoId(personagem.id)}
                >
                  {personagem.nome}
                </button>
              </li>
            ))}
          </ul>
        )}
      </header>
      {perguntaDeSaida && (
        <div className="pp-ficha__aviso" data-tom="erro" role="alert">
          <span>A ficha tem mudanças que não foram salvas.</span>
          <button type="button" className="lb-btn lb-btn--compact" onClick={() => setPerguntaDeSaida(false)}>
            Continuar editando
          </button>
          <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={onClose}>
            Descartar e fechar
          </button>
          <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" disabled={salvando} onClick={salvar}>
            Salvar
          </button>
        </div>
      )}
      {erro !== null && (
        <p className="pp-ficha__aviso" data-tom="erro" role="alert">
          {erro}
        </p>
      )}
      {editadoNaMesa && (
        <p className="pp-ficha__aviso" aria-live="polite">
          Esta ficha mudou na mesa enquanto você editava. O Salvar troca só o que você mexeu.
        </p>
      )}
      <div className="pp-ficha__corpo">
        {sistemaPronto === null ? (
          <div className="pp-ficha__vazio">
            <h2 id={tituloId}>Ficha de personagem</h2>
            <p>O mestre ainda não escolheu um sistema de RPG para esta aventura. Quando escolher, a sua ficha aparece aqui.</p>
          </div>
        ) : mostrado === undefined ? (
          <SemFicha tituloId={tituloId} sistema={sistemaPronto} semPersonagem={semPersonagem} criando={espera?.tipo === 'criar'} onCriar={criar} />
        ) : (
          <>
            {semPersonagem.length > 0 && edicao === null && (
              <div className="pp-ficha__sem-ficha">
                {semPersonagem.map((token) => (
                  <button key={token.tokenId} type="button" className="lb-btn lb-btn--compact" disabled={salvando} onClick={() => criar(token.tokenId)}>
                    Criar ficha de {token.nome || 'ficha sem nome'}
                  </button>
                ))}
              </div>
            )}
            <FichaDePersonagem
              personagem={edicao === null ? mostrado : edicao.rascunho}
              sistema={sistemaPronto}
              editando={edicao !== null}
              onChange={(rascunho) => setEdicao((atual) => (atual === null ? atual : { ...atual, rascunho }))}
              escolherImagem={escolherImagem}
              tituloId={tituloId}
              tipoEditavel={false}
            />
          </>
        )}
      </div>
    </div>
  )
}

interface SemFichaProps {
  tituloId: string
  sistema: SistemaDeRpg
  semPersonagem: readonly TokenDoPersonagem[]
  criando: boolean
  onCriar: (tokenId: string) => void
}

/** O sistema existe e ele ainda não tem personagem: "Criar minha ficha", ou uma por ficha (token) quando ele tem várias. */
function SemFicha({ tituloId, sistema, semPersonagem, criando, onCriar }: SemFichaProps) {
  if (semPersonagem.length === 0) {
    return (
      <div className="pp-ficha__vazio">
        <h2 id={tituloId}>Sem ficha por enquanto</h2>
        <p>Você ainda não tem personagem nesta mesa. Quando o mestre lhe der uma ficha no mapa, a ficha de personagem dela aparece aqui.</p>
      </div>
    )
  }
  const umaSo = semPersonagem.length === 1
  return (
    <div className="pp-ficha__vazio">
      <h2 id={tituloId}>Você ainda não tem ficha de personagem</h2>
      <p>A ficha nasce pelo sistema {sistema.nome}, com os números zerados; depois é só preencher. O mestre vê e pode ajustar.</p>
      <div className="pp-ficha__criar">
        {semPersonagem.map((token) => (
          <button key={token.tokenId} type="button" className="lb-btn lb-btn--primary" disabled={criando} onClick={() => onCriar(token.tokenId)}>
            {criando ? 'Criando…' : umaSo ? 'Criar minha ficha' : `Criar ficha de ${token.nome || 'ficha sem nome'}`}
          </button>
        ))}
      </div>
    </div>
  )
}
