import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  abaDeDestino,
  camposDoTipo,
  chaveDoNomeDaEntrada,
  DADOS_DO_TIPO,
  ENTRADA_CAMPO_MAX,
  ENTRADA_NOME_MAX,
  ENTRADA_TEXTO_MAX,
  itemLimpo,
  novoIdDeEntrada,
  TIPOS_DO_CATALOGO,
  type ItemDoCatalogo,
  type TipoDoCatalogo,
} from '../../lib/livros/catalogo'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { formatarNumero, movimentoReduzido } from './comum'
import './mundo.css'
import './itens.css'

/**
 * "+ Nova entrada" e "Editar" do catálogo do livro (M3, docs/planos/
 * livros-de-regras-plano.md, seção M3): arma, habilidade ou item, com nome,
 * os campos da aba que recebe (Dano, Ação, Custo...) e a descrição. Grava
 * pelo `catalogoStore` (a tela muda na hora, o disco atrás); a falha do disco
 * fica escrita aqui dentro, sem fechar e sem perder o que foi digitado.
 */

export type ModoDaEntrada = { tipo: 'nova'; tipoDaEntrada: TipoDoCatalogo } | { tipo: 'editar'; item: ItemDoCatalogo }

export interface EntradaDoCatalogoDialogProps {
  modo: ModoDaEntrada
  sistema: SistemaDeRpg
  onClose: () => void
  /** Gravou: a entrada como ficou no catálogo e se é nova. */
  onSalvou: (item: ItemDoCatalogo, nova: boolean) => void
}

const SAIDA_MS = 150
/** A partir de que fração do limite a descrição mostra quantas letras faltam. */
const CONTADOR_A_PARTIR_DE = 0.8
const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Exemplo de formato em alguns campos (os que a batalha lê do jeito do roteiro: "35", "Ação Simples"). */
const EXEMPLO_DO_CAMPO: Readonly<Record<string, string>> = { dano: 'ex.: 35', acao: 'ex.: Ação Simples', quantidade: 'ex.: 1' }

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export function EntradaDoCatalogoDialog({ modo, sistema, onClose, onSalvou }: EntradaDoCatalogoDialogProps) {
  const tituloId = useId()
  const subId = useId()
  const nomeId = useId()
  const erroDoNomeId = useId()
  const textoId = useId()
  const contadorId = useId()
  const dicaDoTipoId = useId()
  const campoIdBase = useId()
  const dialogRef = useRef<HTMLFormElement>(null)
  const nomeRef = useRef<HTMLInputElement>(null)
  const apertouNoFundo = useRef(false)
  const editando = modo.tipo === 'editar' ? modo.item : null

  const [tipo, setTipo] = useState<TipoDoCatalogo>(editando?.tipo ?? (modo.tipo === 'nova' ? modo.tipoDaEntrada : 'arma'))
  const [nome, setNome] = useState(editando?.nome ?? '')
  const [texto, setTexto] = useState(editando?.texto ?? '')
  /** Todos os campos digitados, de qualquer tipo: trocar de Arma para Habilidade e voltar não perde o Dano. */
  const [campos, setCampos] = useState<Record<string, string>>(() => ({ ...(editando?.campos ?? {}) }))
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)
  const [erroDoDisco, setErroDoDisco] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [saindo, setSaindo] = useState(false)
  const [mexeu, setMexeu] = useState(false)

  const camposDoTipoEscolhido = camposDoTipo(sistema, tipo)
  const semAba = abaDeDestino(sistema, tipo) === undefined
  const pertoDoLimite = texto.length >= ENTRADA_TEXTO_MAX * CONTADOR_A_PARTIR_DE

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

  const mexer = () => {
    setMexeu(true)
    setErroDoDisco(null)
  }

  /** A entrada que o formulário monta (só os campos do tipo escolhido), ou a frase do que falta. */
  const montar = (): { item: ItemDoCatalogo } | { erro: string } => {
    const ids = new Set(camposDoTipoEscolhido.map((campo) => campo.id))
    const doTipo = Object.fromEntries(Object.entries(campos).filter(([chave]) => ids.has(chave)))
    const item = itemLimpo({ id: editando?.id ?? novoIdDeEntrada(), tipo, nome, texto, campos: doTipo })
    if (item === null) return { erro: 'Dê um nome à entrada.' }
    const chave = chaveDoNomeDaEntrada(item.nome)
    const repetida = useCatalogoStore.getState().itens.some((outro) => outro.id !== item.id && outro.tipo === item.tipo && chaveDoNomeDaEntrada(outro.nome) === chave)
    if (repetida) return { erro: `Já existe ${item.nome} em ${DADOS_DO_TIPO[item.tipo].nome}. Use outro nome.` }
    return { item }
  }

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (gravando) return
    const montado = montar()
    if ('erro' in montado) {
      setErroDoNome(montado.erro)
      nomeRef.current?.focus()
      return
    }
    setGravando(true)
    setErroDoDisco(null)
    try {
      await useCatalogoStore.getState().salvarEntrada(montado.item)
    } catch (erro) {
      setGravando(false)
      setErroDoDisco(mensagemDoErro(erro))
      return
    }
    setGravando(false)
    onSalvou(montado.item, editando === null)
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

  // O clique no fundo fecha só a janela intocada: com algo digitado, um clique fora não joga o texto fora (Esc e Cancelar continuam fechando).
  function aoClicarNoFundo(event: MouseEvent<HTMLDivElement>) {
    if (apertouNoFundo.current && event.target === event.currentTarget && !mexeu) fechar()
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
            {editando === null ? 'Nova entrada do catálogo' : `Editar ${editando.nome}`}
          </h2>
          <p className="mu-modal__sub" id={subId}>
            {editando === null
              ? 'Fica no catálogo deste livro e serve para qualquer ficha das pastas que o usam.'
              : 'Muda só o catálogo: as fichas que já receberam esta entrada ficam como estão.'}
          </p>
        </div>
        <div className="mu-modal__corpo">
          <fieldset className="mu-ent-tipos">
            <legend className="mu-campo__rot">Tipo</legend>
            <div className="mu-chips">
              {TIPOS_DO_CATALOGO.map((opcao) => (
                <label key={opcao} className="mu-chip mu-chip--sem-ret mu-ent-tipo">
                  <input
                    type="radio"
                    className="mu-it-sr"
                    name={`${campoIdBase}-tipo`}
                    value={opcao}
                    checked={tipo === opcao}
                    aria-describedby={semAba ? dicaDoTipoId : undefined}
                    onChange={() => {
                      setTipo(opcao)
                      setErroDoNome(null)
                      mexer()
                    }}
                  />
                  {DADOS_DO_TIPO[opcao].um}
                </label>
              ))}
            </div>
            {semAba && (
              <span className="mu-campo__dica" id={dicaDoTipoId}>
                A ficha deste sistema não tem a aba {DADOS_DO_TIPO[tipo].nome}: a entrada fica no catálogo, mas não vai para as fichas.
              </span>
            )}
          </fieldset>

          <div className="mu-campo">
            <label htmlFor={nomeId}>Nome</label>
            <input
              ref={nomeRef}
              className="mu-entrada"
              id={nomeId}
              value={nome}
              maxLength={ENTRADA_NOME_MAX}
              autoComplete="off"
              aria-invalid={erroDoNome !== null}
              aria-describedby={erroDoNome !== null ? erroDoNomeId : undefined}
              onChange={(event) => {
                setNome(event.target.value)
                setErroDoNome(null)
                mexer()
              }}
            />
            {erroDoNome !== null && (
              <span className="mu-campo__erro" id={erroDoNomeId} role="alert">
                {erroDoNome}
              </span>
            )}
          </div>

          {camposDoTipoEscolhido.length > 0 && (
            <div className="mu-ent-campos">
              {camposDoTipoEscolhido.map((campo) => {
                const id = `${campoIdBase}-${campo.id}`
                return (
                  <div key={campo.id} className="mu-campo">
                    <label htmlFor={id}>{campo.rotulo}</label>
                    <input
                      className="mu-entrada"
                      id={id}
                      value={campos[campo.id] ?? ''}
                      maxLength={ENTRADA_CAMPO_MAX}
                      autoComplete="off"
                      placeholder={EXEMPLO_DO_CAMPO[campo.id]}
                      onChange={(event) => {
                        const valor = event.target.value
                        setCampos((atuais) => ({ ...atuais, [campo.id]: valor }))
                        mexer()
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}

          <div className="mu-campo">
            <label htmlFor={textoId}>Descrição</label>
            <textarea
              className="mu-entrada mu-ent-area"
              id={textoId}
              value={texto}
              maxLength={ENTRADA_TEXTO_MAX}
              aria-describedby={pertoDoLimite ? contadorId : undefined}
              onChange={(event) => {
                setTexto(event.target.value)
                mexer()
              }}
            />
            {pertoDoLimite && (
              <span className="mu-campo__dica mu-ent-contador" id={contadorId} aria-live="polite">
                {formatarNumero(texto.length)} de {formatarNumero(ENTRADA_TEXTO_MAX)} letras
              </span>
            )}
          </div>
        </div>
        <div className="mu-modal__pe mu-ent-pe">
          {erroDoDisco !== null && (
            <p className="mu-campo__erro mu-ent-pe__erro" role="alert">
              {erroDoDisco}
            </p>
          )}
          <button type="button" className="mu-bt" onClick={fechar}>
            Cancelar
          </button>
          <button type="submit" className="mu-bt mu-bt--primario" disabled={gravando}>
            {gravando ? 'Guardando…' : editando === null ? 'Criar entrada' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
