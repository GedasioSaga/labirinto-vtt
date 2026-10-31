import { useId, useState, type FormEvent } from 'react'
import { NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, type NaturezaDoSelo, type SeloPedido } from '../../lib/batalha/combate'
import { SELOS_PRONTOS, ehNomeDeSelo, naturezaDosMods, textoDoSelo, type AlvoDeMod } from '../../lib/batalha/selos'
import { lerInteiro } from './dadosDoMenu'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import { LinhasDeMods, linhasDosMods, modsDasLinhas, resumoDasLinhas, type LinhaDeMod } from './LinhasDeMods'
import './batalha.css'
import './combate.css'

/**
 * PÔR, EDITAR E TIRAR UM SELO (F3, fatia T; seção 5.3 do plano), só do
 * mestre: pelo menu da carta, pelo clique no selo da carta e pelo painel da
 * vez. Os prontos em botões (Atordoado, Cego, ...), o nome livre (até 24) e a
 * duração: N turnos (1 a 99, contados na vez do alvo, Q4) ou "até tirar".
 * Cada mudança vira linha "selo" no registro; o Desfazer volta.
 *
 * Tipos de habilidade F2: as linhas "atributo / delta" (o que o selo soma
 * enquanto existe, até 4) e a prévia da pílula na cor que a carta vai
 * mostrar: só somas = verde, só perdas = roxo, sem linha ou misturado = a de
 * sempre; o selo de técnica guarda a cor do Tipo (`corFixa`).
 */

export interface SeloDialogProps {
  /** O nome da ficha ("Ilo"). */
  quem: string
  /** O selo a editar (com os mods); `null` = pôr um novo. */
  selo: SeloPedido | null
  /** As opções das linhas de modificador (`alvosDeMod(sistema)`). */
  alvosDeMod: readonly AlvoDeMod[]
  /** Ao editar um selo posto por técnica: a cor do Tipo, que não muda com as linhas. Ausente = a cor segue o sinal das linhas. */
  corFixa?: NaturezaDoSelo
  /** O pedido valeu? `false` mantém a janela, com o aviso. */
  onConfirmar: (selo: SeloPedido) => boolean
  /** Só ao editar: tira o selo. */
  onTirar?: () => boolean
  onFechar: () => void
}

const TURNOS_PADRAO = '1'

/** O nome da cor na prévia (o leitor de tela não vê a cor). */
const NOME_DA_NATUREZA: Record<NaturezaDoSelo, string> = { buff: 'buff, verde', debuff: 'debuff, roxo', passiva: 'passiva, dourado', condicao: 'condição, a cor de sempre' }

export function SeloDialog({ quem, selo, alvosDeMod, corFixa, onConfirmar, onTirar, onFechar }: SeloDialogProps) {
  const idBase = useId()
  const [nome, setNome] = useState(selo?.nome ?? '')
  const [ateTirar, setAteTirar] = useState(selo !== null && selo.turnos === null)
  const [turnosTexto, setTurnosTexto] = useState(selo === null || selo.turnos === null ? TURNOS_PADRAO : String(selo.turnos))
  const [linhas, setLinhas] = useState<LinhaDeMod[]>(() => linhasDosMods(selo?.mods))
  const [erro, setErro] = useState<string | null>(null)
  const limpo = nome.trim()
  const turnos = ateTirar ? null : lerInteiro(turnosTexto, TURNOS_DO_SELO_MAX)
  const nomeValido = ehNomeDeSelo(limpo)
  const turnosValidos = ateTirar || (turnos !== null && turnos >= 1)
  const editando = selo !== null
  const lidos = modsDasLinhas(linhas, alvosDeMod)
  const natureza: NaturezaDoSelo = corFixa ?? ('mods' in lidos ? naturezaDosMods(lidos.mods) : undefined) ?? 'condicao'
  const resumo = resumoDasLinhas(linhas, alvosDeMod)

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
    if ('erro' in lidos) {
      setErro(lidos.erro)
      return
    }
    // Sem linha que valha, o pedido vai sem `mods` (editar assim tira os que havia).
    const pedido: SeloPedido = lidos.mods.length > 0 ? { nome: limpo, turnos, mods: lidos.mods } : { nome: limpo, turnos }
    if (onConfirmar(pedido)) onFechar()
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
        <LinhasDeMods
          idBase={idBase}
          linhas={linhas}
          alvos={alvosDeMod}
          dica="somam na conta enquanto o selo existir"
          onMudar={(novas) => {
            setErro(null)
            setLinhas(novas)
          }}
        />
        <p className="bt-selo-form__previa">
          <span className="bt-selo-form__previa-rot">Na carta</span>
          <span className="bt-selo bt-selo--previa" data-natureza={natureza === 'condicao' ? undefined : natureza}>
            {previa ?? (limpo || 'Selo')}
            {resumo !== '' && <span className="bt-selo__mods">{resumo}</span>}
          </span>
          <small>{corFixa !== undefined ? `cor do Tipo da técnica (${NOME_DA_NATUREZA[natureza]})` : NOME_DA_NATUREZA[natureza]}</small>
        </p>
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
