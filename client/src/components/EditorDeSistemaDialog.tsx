import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  personagemDeExemplo,
  rascunhoDoSistema,
  REGRA_DOS_DADOS,
  SECOES_DO_EDITOR,
  sistemaDoRascunho,
  type RascunhoDoSistema,
  type SecaoDoEditor,
  type SistemaDoRascunho,
} from '../lib/editorDeSistema'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { SecaoCatalogos, SecaoLivro } from './EditorDeSistemaLivro'
import { SecaoAbas, SecaoAtributos, SecaoEscolhas, SecaoGeral, SecaoRecursos, type MudarRascunho } from './EditorDeSistemaPartes'
import { FichaDePersonagem } from './FichaDePersonagem'
import { CloseIcon } from './icons'
import './FichaDePersonagem.css'
import './EditorDeSistema.css'

export interface EditorDeSistemaDialogProps {
  /** De onde a edição começa: o sistema da biblioteca, em branco ou a cópia de outro. */
  inicial: RascunhoDoSistema
  /** Os ids da biblioteca: o sistema novo pega um id que ninguém usa. */
  idsDaBiblioteca: ReadonlySet<string>
  /** Grava na biblioteca. Lança com a razão (disco sem permissão...). */
  onSalvar: (sistema: SistemaDeRpg) => Promise<void>
  onClose: () => void
}

type SecaoDaJanela = SecaoDoEditor | 'previa'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * EDITOR DE SISTEMA (entrega 6): uma janela grande, com as seções à esquerda
 * e o rascunho à direita. Mesma casca da ficha (`FichaDePersonagemDialog`):
 * portal no `body`, foco preso dentro, Esc fecha — e com mudança não salva,
 * pergunta antes. O "Salvar" passa pela mesma leitura do "Importar"
 * (`sistemaDoRascunho`) e, recusado, diz cada problema na seção dele; salvo, a
 * janela continua aberta (dá para ver a prévia e seguir mexendo).
 */
export function EditorDeSistemaDialog({ inicial, idsDaBiblioteca, onSalvar, onClose }: EditorDeSistemaDialogProps) {
  const tituloId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const [rascunho, setRascunho] = useState(inicial)
  /** O rascunho como está no disco (ou como abriu): sem diferença, fechar não pergunta nada. */
  const [base, setBase] = useState(inicial)
  const [secao, setSecao] = useState<SecaoDaJanela>('geral')
  /** Os erros só aparecem depois do primeiro "Salvar": ninguém quer ouvir "sem nome" antes de digitar o nome. */
  const [tentouSalvar, setTentouSalvar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [perguntaDeSaida, setPerguntaDeSaida] = useState(false)
  const resultado = useMemo(() => sistemaDoRascunho(rascunho, idsDaBiblioteca), [rascunho, idsDaBiblioteca])
  const mudou = rascunho !== base
  const erros = tentouSalvar && !resultado.ok ? resultado.erros : []

  useEffect(() => {
    const opener = document.activeElement
    // Sistema novo começa pelo nome; o que já existe, pela janela (nada para digitar de cara).
    const alvo = inicial.novo ? dialogRef.current?.querySelector<HTMLElement>('.lb-sistema-editor__conteudo input[type="text"]') : dialogRef.current
    alvo?.focus()
    return () => {
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) opener.focus()
    }
    // Só na abertura: o rascunho inicial não muda enquanto a janela vive.
  }, [])

  const mudar: MudarRascunho = (mudanca) => {
    setRascunho((atual) => mudanca(atual))
    setEstado(null)
  }

  const salvar = async (fecharDepois: boolean) => {
    setTentouSalvar(true)
    setPerguntaDeSaida(false)
    if (!resultado.ok) {
      const primeira = resultado.erros[0].secao
      setSecao(primeira)
      setEstado({ tipo: 'erro', texto: `${resultado.erros.length === 1 ? 'Um problema impede' : `${resultado.erros.length} problemas impedem`} salvar: veja as seções marcadas.` })
      return
    }
    setSalvando(true)
    try {
      await onSalvar(resultado.sistema)
      if (fecharDepois) {
        onClose()
        return
      }
      // Salvo, o id de cada parte trava: o rascunho passa a ser o do sistema gravado.
      const salvo = rascunhoDoSistema(resultado.sistema)
      setRascunho(salvo)
      setBase(salvo)
      setTentouSalvar(false)
      setEstado({ tipo: 'ok', texto: `${resultado.sistema.nome} salvo na biblioteca.` })
    } catch (erro) {
      setEstado({ tipo: 'erro', texto: erro instanceof Error ? erro.message : String(erro) })
    } finally {
      setSalvando(false)
    }
  }

  /** Fechar (Esc, X, fundo, Fechar): com mudança não salva, pergunta antes. */
  const pedirFechar = () => {
    if (mudou) setPerguntaDeSaida(true)
    else onClose()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Janela modal: nenhuma tecla daqui vale como atalho do editor de mapa atrás dela.
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      pedirFechar()
      return
    }
    if (event.key !== 'Tab') return
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  function onBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (pressStartedOnBackdrop.current && event.target === event.currentTarget) pedirFechar()
    pressStartedOnBackdrop.current = false
  }

  const errosDaSecao = erros.filter((erro) => erro.secao === secao)
  const titulo = rascunho.novo ? `Novo sistema${rascunho.nome.trim().length > 0 ? ` · ${rascunho.nome.trim()}` : ''}` : `Editar ${base.nome.trim() || 'sistema'}`

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={(event) => (pressStartedOnBackdrop.current = event.target === event.currentTarget)} onClick={onBackdropClick}>
      <div ref={dialogRef} className="lb-panel lb-dialog lb-sistema-editor" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={onKeyDown}>
        <header className="lb-dialog__head">
          <div className="lb-sistema-editor__topo">
            <p className="lb-eyebrow">Sistema de RPG</p>
            <h2 id={tituloId} className="lb-dialog__title">
              {titulo}
            </h2>
          </div>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={pedirFechar}>
            <CloseIcon size={16} />
          </button>
        </header>
        {perguntaDeSaida && (
          <div className="lb-ficha-janela__pergunta" role="alert">
            <span>O sistema tem mudanças que não foram salvas.</span>
            <button type="button" className="lb-btn lb-btn--compact" onClick={() => setPerguntaDeSaida(false)}>
              Continuar editando
            </button>
            <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" onClick={onClose}>
              Descartar e fechar
            </button>
            <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" disabled={salvando} onClick={() => void salvar(true)}>
              Salvar e fechar
            </button>
          </div>
        )}
        <div className="lb-sistema-editor__miolo">
          <nav className="lb-sistema-editor__secoes" aria-label="Partes do sistema">
            {[...SECOES_DO_EDITOR, { secao: 'previa' as const, rotulo: 'Prévia da ficha' }].map((entrada) => {
              const quantos = erros.filter((erro) => erro.secao === entrada.secao).length
              return (
                <button
                  key={entrada.secao}
                  type="button"
                  className="lb-sistema-editor__secao"
                  aria-current={entrada.secao === secao ? 'page' : undefined}
                  onClick={() => setSecao(entrada.secao)}
                >
                  <span>{entrada.rotulo}</span>
                  {quantos > 0 && (
                    <span className="lb-sistema-editor__selo" aria-label={`${quantos} ${quantos === 1 ? 'problema' : 'problemas'}`}>
                      {quantos}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
          <div className="lb-sistema-editor__conteudo lb-scroll">
            {errosDaSecao.length > 0 && (
              <ul className="lb-sistema-editor__erros" aria-label="Problemas desta parte">
                {errosDaSecao.map((erro, i) => (
                  <li key={`${i}-${erro.texto}`}>{erro.texto}</li>
                ))}
              </ul>
            )}
            <ConteudoDaSecao secao={secao} rascunho={rascunho} mudar={mudar} resultado={resultado} />
          </div>
        </div>
        <footer className="lb-sistema-editor__rodape">
          <p className="lb-field__hint lb-sistema-editor__regra">{REGRA_DOS_DADOS}</p>
          <div className="lb-sistema-editor__rodape-acoes">
            {estado !== null && (
              <p className={estado.tipo === 'erro' ? 'lb-field__error' : 'lb-field__hint'} role={estado.tipo === 'erro' ? 'alert' : 'status'}>
                {estado.texto}
              </p>
            )}
            <button type="button" className="lb-btn lb-btn--ghost" onClick={pedirFechar}>
              {mudou ? 'Cancelar' : 'Fechar'}
            </button>
            <button type="button" className="lb-btn lb-btn--primary" disabled={salvando} onClick={() => void salvar(false)}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

interface ConteudoDaSecaoProps {
  secao: SecaoDaJanela
  rascunho: RascunhoDoSistema
  mudar: MudarRascunho
  resultado: SistemaDoRascunho
}

function ConteudoDaSecao({ secao, rascunho, mudar, resultado }: ConteudoDaSecaoProps) {
  switch (secao) {
    case 'geral':
      return <SecaoGeral rascunho={rascunho} mudar={mudar} />
    case 'escolhas':
      return <SecaoEscolhas rascunho={rascunho} mudar={mudar} />
    case 'recursos':
      return <SecaoRecursos rascunho={rascunho} mudar={mudar} />
    case 'atributos':
      return <SecaoAtributos rascunho={rascunho} mudar={mudar} />
    case 'abas':
      return <SecaoAbas rascunho={rascunho} mudar={mudar} />
    case 'catalogos':
      return <SecaoCatalogos rascunho={rascunho} mudar={mudar} />
    case 'livro':
      return <SecaoLivro rascunho={rascunho} mudar={mudar} />
    case 'previa':
      return <PreviaDaFicha resultado={resultado} />
  }
}

const nada = (): void => {}
const semImagem = async (): Promise<string | null> => null

/** A ficha de verdade (`FichaDePersonagem`) com o personagem de exemplo, só para ler. */
function PreviaDaFicha({ resultado }: { resultado: SistemaDoRascunho }) {
  const sistema = resultado.ok ? resultado.sistema : null
  const personagem = useMemo(() => (sistema === null ? null : personagemDeExemplo(sistema)), [sistema])
  if (sistema === null || personagem === null) {
    return <p className="lb-field__hint">A prévia aparece quando o sistema não tem nenhum problema: o "Salvar" mostra o que falta e onde.</p>
  }
  return (
    <div className="lb-sistema-editor__previa">
      <p className="lb-field__hint">Um personagem de exemplo com este sistema, como a ficha mostra — antes de salvar.</p>
      <FichaDePersonagem personagem={personagem} sistema={sistema} editando={false} onChange={nada} escolherImagem={semImagem} />
    </div>
  )
}
