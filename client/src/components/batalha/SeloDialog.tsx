import { useId, useState, type FormEvent } from 'react'
import { NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, type SeloPedido } from '../../lib/batalha/combate'
import { SELOS_PRONTOS, ehNomeDeSelo, textoDoSelo } from '../../lib/batalha/selos'
import { lerInteiro } from './dadosDoMenu'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import './batalha.css'
import './combate.css'

/**
 * PÔR, EDITAR E TIRAR UM SELO (F3, fatia T; seção 5.3 do plano), só do
 * mestre: pelo menu da carta, pelo clique no selo da carta e pelo painel da
 * vez. Os prontos em botões (Atordoado, Cego, ...), o nome livre (até 24) e a
 * duração: N turnos (1 a 99, contados na vez do alvo, Q4) ou "até tirar".
 * Cada mudança vira linha "selo" no registro; o Desfazer volta.
 */

export interface SeloDialogProps {
  /** O nome da ficha ("Ilo"). */
  quem: string
  /** O selo a editar; `null` = pôr um novo. */
  selo: SeloPedido | null
  /** O pedido valeu? `false` mantém a janela, com o aviso. */
  onConfirmar: (selo: SeloPedido) => boolean
  /** Só ao editar: tira o selo. */
  onTirar?: () => boolean
  onFechar: () => void
}

const TURNOS_PADRAO = '1'

export function SeloDialog({ quem, selo, onConfirmar, onTirar, onFechar }: SeloDialogProps) {
  const idBase = useId()
  const [nome, setNome] = useState(selo?.nome ?? '')
  const [ateTirar, setAteTirar] = useState(selo !== null && selo.turnos === null)
  const [turnosTexto, setTurnosTexto] = useState(selo === null || selo.turnos === null ? TURNOS_PADRAO : String(selo.turnos))
  const [erro, setErro] = useState<string | null>(null)
  const limpo = nome.trim()
  const turnos = ateTirar ? null : lerInteiro(turnosTexto, TURNOS_DO_SELO_MAX)
  const nomeValido = ehNomeDeSelo(limpo)
  const turnosValidos = ateTirar || (turnos !== null && turnos >= 1)
  const editando = selo !== null

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if (!nomeValido) {
      setErro(`Dê um nome ao selo: um dos prontos ou um nome seu, até ${NOME_DO_SELO_MAX} letras.`)
      document.getElementById(`${idBase}-nome`)?.focus()
      return
    }
    if (!turnosValidos) {
      setErro(`Os turnos vão de 1 a ${TURNOS_DO_SELO_MAX}, ou marque "Até tirar".`)
      document.getElementById(`${idBase}-turnos`)?.focus()
      return
    }
    if (onConfirmar({ nome: limpo, turnos })) onFechar()
    else setErro(editando ? 'Não salvou: o selo saiu (alguém desfez) ou a ficha saiu da batalha.' : 'Não pôs: a ficha saiu da batalha ou já tem selos demais.')
  }

  const tirar = () => {
    if (onTirar === undefined) return
    if (onTirar()) onFechar()
    else setErro('Não tirou: o selo já saiu (alguém desfez ou acabou).')
  }

  const previa = nomeValido && turnosValidos ? textoDoSelo({ nome: limpo, turnos }) : null
  return (
    <JanelaDaBatalha
      titulo={editando ? `Selo em ${quem}` : `Pôr selo em ${quem}`}
      descricao={`Com turnos, conta na vez de ${quem}: desconta 1 no fim da vez e sai no 0. Entra no registro; o Desfazer volta.`}
      onFechar={onFechar}
    >
      <form className="bt-form bt-selo-form" onSubmit={confirmar} noValidate>
        <fieldset className="bt-selo-form__prontos">
          <legend>Prontos</legend>
          {SELOS_PRONTOS.map((pronto) => (
            <button
              key={pronto}
              type="button"
              className="bt-botao bt-botao--p"
              aria-pressed={limpo === pronto}
              onClick={() => {
                setErro(null)
                setNome(pronto)
              }}
            >
              {pronto}
            </button>
          ))}
        </fieldset>
        <label className="bt-form__linha" htmlFor={`${idBase}-nome`}>
          <span>Nome</span>
          <span className="bt-selo-form__campo">
            <input
              id={`${idBase}-nome`}
              className="bt-num bt-num--texto"
              maxLength={NOME_DO_SELO_MAX}
              value={nome}
              placeholder="ex.: Marcado"
              aria-invalid={erro !== null && !nomeValido ? true : undefined}
              aria-describedby={`${idBase}-conta`}
              onChange={(evento) => {
                setErro(null)
                setNome(evento.target.value.replace(/[\r\n]/g, ''))
              }}
            />
            <small id={`${idBase}-conta`} className="bt-selo-form__conta">
              {nome.length}/{NOME_DO_SELO_MAX}
            </small>
          </span>
        </label>
        <fieldset className="bt-selo-form__duracao">
          <legend>Duração</legend>
          <label className="bt-selo-form__opcao">
            <input type="radio" name={`${idBase}-duracao`} checked={!ateTirar} onChange={() => setAteTirar(false)} />
            Por
            <input
              id={`${idBase}-turnos`}
              className="bt-num"
              inputMode="numeric"
              aria-label="Turnos"
              value={turnosTexto}
              disabled={ateTirar}
              aria-invalid={erro !== null && !turnosValidos ? true : undefined}
              onChange={(evento) => {
                setErro(null)
                setTurnosTexto(evento.target.value)
              }}
            />
            {turnos === 1 ? 'turno' : 'turnos'}
          </label>
          <label className="bt-selo-form__opcao">
            <input type="radio" name={`${idBase}-duracao`} checked={ateTirar} onChange={() => setAteTirar(true)} />
            Até tirar <small>não desconta; sai quando você tirar</small>
          </label>
        </fieldset>
        {erro !== null && (
          <p className="bt-form__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-form__acoes">
          {editando && onTirar !== undefined && (
            <button type="button" className="bt-botao bt-selo-form__tirar" onClick={tirar}>
              Tirar o selo
            </button>
          )}
          <button type="button" className="bt-botao" onClick={onFechar}>
            Cancelar
          </button>
          <button type="submit" className="bt-botao bt-botao--batalha">
            {editando ? 'Salvar' : previa === null ? 'Pôr selo' : `Pôr ${previa}`}
          </button>
        </div>
      </form>
    </JanelaDaBatalha>
  )
}
