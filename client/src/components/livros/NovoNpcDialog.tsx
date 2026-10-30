import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { chaveDoNome } from '../../lib/contasDosJogadores'
import { ATALHOS_DA_FORCA, fichaMinima, modelosDeNpc, novaVariacao, trocarForca } from '../../lib/livros/combate'
import { FORCA_PADRAO, forcaDe, novoPersonagem, RECURSO_QUE_A_FORCA_MULTIPLICA, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { PERSONAGEM_NOME_MAX } from '../../net/protocoloDoPersonagem'
import { formatarForca, gravarNoMundo, movimentoReduzido, semCenario, trocarFicha } from './comum'
import './mundo.css'

/**
 * "Novo NPC" e "Dar ficha" do bestiário (M1, protótipo aprovado:
 * docs/design/livros-de-regras/prototipo.js, `abrirNovoNpc`). Novo: do zero
 * (a ficha mínima ou em branco) ou como variação de um modelo. Dar ficha: o
 * NPC "Só no cenário" volta para a ordem dos turnos, com a ficha que já tem,
 * a mínima ou a de um modelo — o MESMO id, para os tokens ligados a ele no
 * mapa continuarem ligados. Grava pelo funil do mundo, com Desfazer no aviso.
 */

export type ModoDoNovoNpc = { tipo: 'novo'; modeloId?: string; nome?: string } | { tipo: 'darFicha'; personagem: Personagem }

export interface NovoNpcDialogProps {
  modo: ModoDoNovoNpc
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
  onClose: () => void
  /** Gravou: o NPC (novo ou que saiu do cenário) e se a ficha dele deve abrir para preencher. */
  onFeito: (personagemId: string, abrirFicha: boolean) => void
}

const SAIDA_MS = 150
const PROPRIA = 'propria'
const MINIMA = 'minima'
const BRANCO = 'branco'
const PREFIXO_DO_MODELO = 'modelo:'

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** O que cada começo faz, dito embaixo do seletor. */
function dicaDoComeco(comeco: string, modelo: Personagem | undefined): string {
  if (comeco === PROPRIA) return 'Volta para a batalha com a ficha que já tem.'
  if (comeco === MINIMA) return '300 de HP e um golpe de 80: o bastante para entrar na batalha agora.'
  if (comeco === BRANCO) return 'A ficha abre em seguida para você preencher.'
  return modelo === undefined ? '' : `Herda técnicas, armas e atributos de ${modelo.nome}: mudar o modelo muda esta ficha também.`
}

/** O começo que o "Dar ficha" sugere: a própria, quando ela já tem HP para a batalha; senão a mínima. */
function comecoSugerido(modo: ModoDoNovoNpc): string {
  if (modo.tipo === 'novo') return modo.modeloId === undefined ? MINIMA : `${PREFIXO_DO_MODELO}${modo.modeloId}`
  const hp = modo.personagem.maximos[RECURSO_QUE_A_FORCA_MULTIPLICA] ?? modo.personagem.recursos[RECURSO_QUE_A_FORCA_MULTIPLICA] ?? 0
  return hp > 0 ? PROPRIA : MINIMA
}

export function NovoNpcDialog({ modo, sistema, personagens, onClose, onFeito }: NovoNpcDialogProps) {
  const tituloId = useId()
  const subId = useId()
  const comecoId = useId()
  const nomeId = useId()
  const erroId = useId()
  const forcaId = useId()
  const dicaId = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const apertouNoFundo = useRef(false)
  const modelos = modelosDeNpc(personagens).filter((modelo) => modo.tipo === 'novo' || modelo.id !== modo.personagem.id)
  const [comeco, setComeco] = useState(() => comecoSugerido(modo))
  const [nome, setNome] = useState(modo.tipo === 'darFicha' ? modo.personagem.nome : (modo.nome ?? ''))
  const [forca, setForca] = useState(modo.tipo === 'darFicha' ? forcaDe(modo.personagem) : FORCA_PADRAO)
  const [erro, setErro] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [saindo, setSaindo] = useState(false)

  const modeloEscolhido = comeco.startsWith(PREFIXO_DO_MODELO) ? modelos.find((modelo) => `${PREFIXO_DO_MODELO}${modelo.id}` === comeco) : undefined
  const darFicha = modo.tipo === 'darFicha'

  useEffect(() => {
    const abriu = document.activeElement
    nomeRef.current?.focus()
    nomeRef.current?.select()
    return () => {
      if (abriu instanceof HTMLElement && abriu !== document.body && abriu.isConnected) abriu.focus()
    }
  }, [])

  const fechar = () => {
    if (saindo) return
    setSaindo(true)
    window.setTimeout(onClose, movimentoReduzido() ? 0 : SAIDA_MS)
  }

  /** A ficha que o formulário monta, ou a frase do que falta. */
  const montar = (): { ficha: Personagem } | { erro: string } => {
    const limpo = nome.trim().slice(0, PERSONAGEM_NOME_MAX)
    if (limpo.length === 0) return { erro: 'Dê um nome ao NPC.' }
    const proprioId = darFicha ? modo.personagem.id : null
    if (personagens.some((personagem) => personagem.id !== proprioId && chaveDoNome(personagem.nome) === chaveDoNome(limpo))) {
      return { erro: `Já existe “${limpo}” neste livro. Use outro nome.` }
    }
    let ficha: Personagem
    if (comeco === PROPRIA && darFicha) ficha = semCenario({ ...modo.personagem, nome: limpo })
    else if (comeco === MINIMA) ficha = fichaMinima(sistema, limpo)
    else if (comeco === BRANCO) ficha = { ...novoPersonagem(sistema, 'npc', limpo), combate: { forca: FORCA_PADRAO } }
    else if (modeloEscolhido !== undefined) ficha = novaVariacao(modeloEscolhido, limpo)
    else return { erro: 'Esse modelo não está mais no bestiário. Escolha outro começo.' }
    if (darFicha && comeco !== PROPRIA) {
      // O MESMO id: os tokens do mapa ligados a ele continuam ligados. Retrato e anotação dele ficam.
      const antes = modo.personagem
      ficha = { ...ficha, id: antes.id, retrato: antes.retrato ?? ficha.retrato }
      if (antes.notaDoMestre !== undefined) ficha.notaDoMestre = antes.notaDoMestre
    }
    return { ficha: trocarForca(ficha, forca) }
  }

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (gravando) return
    const montado = montar()
    if ('erro' in montado) {
      setErro(montado.erro)
      nomeRef.current?.focus()
      return
    }
    const { ficha } = montado
    setGravando(true)
    let gravou: boolean
    if (darFicha) {
      const antes = modo.personagem
      gravou = await gravarNoMundo((lista) => trocarFicha(lista, antes.id, () => ficha), {
        texto: `${ficha.nome} saiu do cenário e entra na batalha.`,
        desfazer: (lista) => trocarFicha(lista, antes.id, () => antes),
      })
    } else {
      const de = modeloEscolhido === undefined ? '' : ` como variação de ${modeloEscolhido.nome}`
      gravou = await gravarNoMundo((lista) => [...lista, ficha], {
        texto: `${ficha.nome} entrou no bestiário${de}.`,
        desfazer: (lista) => lista.filter((personagem) => personagem.id !== ficha.id),
      })
    }
    setGravando(false)
    if (!gravou) return
    onFeito(ficha.id, comeco === BRANCO)
    fechar()
  }

  function aoTeclar(event: KeyboardEvent<HTMLFormElement>) {
    // Janela modal: nenhuma tecla daqui vale para o mundo (Esc fecharia ele) nem para o editor atrás.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      fechar()
      return
    }
    if (event.key !== 'Tab') return
    const itens = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    const primeiro = itens[0]
    const ultimo = itens[itens.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && document.activeElement === primeiro) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  function aoClicarNoFundo(event: MouseEvent<HTMLDivElement>) {
    if (apertouNoFundo.current && event.target === event.currentTarget) fechar()
    apertouNoFundo.current = false
  }

  return createPortal(
    <div
      className={saindo ? 'mu-modal-fundo mu-modal-fundo--saindo' : 'mu-modal-fundo'}
      onMouseDown={(event) => (apertouNoFundo.current = event.target === event.currentTarget)}
      onClick={aoClicarNoFundo}
    >
      <form
        ref={dialogRef}
        className="mu-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={subId}
        noValidate
        onSubmit={(event) => void enviar(event)}
        onKeyDown={aoTeclar}
      >
        <div className="mu-modal__cab">
          <h2 className="mu-modal__tit" id={tituloId}>
            {darFicha ? `Dar ficha de batalha a ${modo.personagem.nome}` : 'Novo NPC de combate'}
          </h2>
          <p className="mu-modal__sub" id={subId}>
            {darFicha ? 'Ele sai do cenário e passa a entrar na ordem dos turnos.' : 'Do zero, ou como variação de um modelo: a variação herda técnicas, armas e atributos.'}
          </p>
        </div>
        <div className="mu-modal__corpo">
          <div className="mu-campo">
            <label htmlFor={comecoId}>{darFicha ? 'Com que ficha' : 'Começa de'}</label>
            <select className="mu-seletor" id={comecoId} value={comeco} aria-describedby={dicaId} onChange={(event) => setComeco(event.target.value)}>
              {darFicha && <option value={PROPRIA}>A ficha que ele já tem</option>}
              <option value={MINIMA}>Ficha mínima (HP 300, golpe 80)</option>
              {!darFicha && <option value={BRANCO}>Ficha em branco</option>}
              {modelos.length > 0 && (
                <optgroup label="Variação de um modelo">
                  {modelos.map((modelo) => (
                    <option key={modelo.id} value={`${PREFIXO_DO_MODELO}${modelo.id}`}>
                      Como {modelo.nome}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <span className="mu-campo__dica" id={dicaId}>
              {dicaDoComeco(comeco, modeloEscolhido)}
            </span>
          </div>
          <div className="mu-campo">
            <label htmlFor={nomeId}>Nome</label>
            <input
              ref={nomeRef}
              className="mu-entrada"
              id={nomeId}
              value={nome}
              maxLength={PERSONAGEM_NOME_MAX}
              autoComplete="off"
              aria-invalid={erro !== null}
              aria-describedby={erro !== null ? erroId : undefined}
              onChange={(event) => {
                setNome(event.target.value)
                setErro(null)
              }}
            />
            {erro !== null && (
              <span className="mu-campo__erro" id={erroId} role="alert">
                {erro}
              </span>
            )}
          </div>
          <div className="mu-campo">
            <label htmlFor={forcaId}>Força</label>
            <select className="mu-seletor" id={forcaId} value={String(forca)} onChange={(event) => setForca(Number(event.target.value))}>
              {(ATALHOS_DA_FORCA.includes(forca) ? ATALHOS_DA_FORCA : [...ATALHOS_DA_FORCA, forca].sort((a, b) => a - b)).map((valor) => (
                <option key={valor} value={String(valor)}>
                  {formatarForca(valor)}
                </option>
              ))}
            </select>
            <span className="mu-campo__dica">Multiplica HP e dano. Dá para mudar depois.</span>
          </div>
        </div>
        <div className="mu-modal__pe">
          <button type="button" className="mu-bt" onClick={fechar}>
            Cancelar
          </button>
          <button type="submit" className="mu-bt mu-bt--primario" disabled={gravando}>
            {gravando ? 'Guardando…' : darFicha ? 'Dar ficha' : 'Criar no bestiário'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
