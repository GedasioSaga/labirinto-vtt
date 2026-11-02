import { useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { CA_DO_BONECO_MAX, EP_DO_BONECO_MAX, PV_DO_BONECO_MAX, type AjusteDoBonecoDBT, type BonecoDeTreinoDBT } from '../../../stores/arenaDBTStore'
import { IconeDoMundo } from '../../livros/icones'
import { inteiroDoCampo } from '../ficha/pecas'

/**
 * UM BONECO DE TREINO da arena Dragon Ball (`useArenaDBTStore`): o nome (só
 * na montagem), CA, PV e EP. O número digitado só vale ao sair do campo ou
 * com Enter (na luta cada troca entra no Desfazer da arena; letra por letra
 * encheria a pilha); Esc volta ao valor de antes. Fora da faixa, o campo
 * acusa e volta ao sair.
 */

export interface BonecoDaArenaDBTProps {
  boneco: BonecoDeTreinoDBT
  momento: 'montagem' | 'luta'
  onAjustar: (ajuste: AjusteDoBonecoDBT) => void
  /** Montagem: tirar o boneco. */
  onTirar?: () => void
  /** Luta: o PV de agora (o campo PV regrava o atual e o máximo). */
  pvAtual?: number
}

interface CampoDoBonecoProps {
  rotulo: string
  dica: string
  valor: number
  min: number
  max: number
  onTrocar: (valor: number) => void
}

/**
 * Enter grava, Esc desiste: as duas ficam no campo (não fecham nada atrás).
 * O `blur` dispara o `onBlur` na hora, com o texto desta renderização: o Esc
 * marca `desistiu` antes, e quem grava confere a marca.
 */
function teclasDoCampo(evento: KeyboardEvent<HTMLInputElement>, desistiu: RefObject<boolean>): void {
  if (evento.key === 'Enter') {
    evento.preventDefault()
    evento.currentTarget.blur()
  } else if (evento.key === 'Escape') {
    evento.preventDefault()
    evento.stopPropagation()
    desistiu.current = true
    evento.currentTarget.blur()
  }
}

function CampoDoBoneco({ rotulo, dica, valor, min, max, onTrocar }: CampoDoBonecoProps) {
  const id = useId()
  /** O texto enquanto o campo tem o foco; `null` = mostra o valor gravado. */
  const [texto, setTexto] = useState<string | null>(null)
  const desistiu = useRef(false)
  const lido = texto === null ? valor : inteiroDoCampo(texto)
  const invalido = lido === null || lido < min || lido > max
  const gravar = () => {
    if (!desistiu.current && lido !== null && lido >= min && lido <= max && lido !== valor) onTrocar(lido)
    desistiu.current = false
    setTexto(null)
  }
  return (
    <label className="dba-campo" htmlFor={id} title={dica}>
      <span className="dba-campo__rot">{rotulo}</span>
      <input
        id={id}
        className="dbf-inp dbf-inp--num dba-campo__inp"
        inputMode="numeric"
        value={texto ?? String(valor)}
        aria-invalid={invalido}
        aria-describedby={invalido ? `${id}-faixa` : undefined}
        onFocus={() => setTexto(String(valor))}
        onChange={(evento) => setTexto(evento.target.value)}
        onBlur={gravar}
        onKeyDown={(evento) => teclasDoCampo(evento, desistiu)}
      />
      {invalido && (
        <span className="dba-campo__erro" id={`${id}-faixa`}>
          {min} a {max.toLocaleString('pt-BR')}
        </span>
      )}
    </label>
  )
}

/** O nome na montagem: grava ao sair do campo; vazio volta ao de antes. */
function NomeDoBoneco({ nome, onTrocar }: { nome: string; onTrocar: (nome: string) => void }) {
  const [texto, setTexto] = useState<string | null>(null)
  const desistiu = useRef(false)
  const gravar = () => {
    if (!desistiu.current && texto !== null && texto.trim() !== '' && texto.trim() !== nome) onTrocar(texto.trim())
    desistiu.current = false
    setTexto(null)
  }
  return (
    <input
      className="dbf-inp dba-boneco__nome-inp"
      aria-label="Nome do boneco"
      maxLength={40}
      value={texto ?? nome}
      onFocus={() => setTexto(nome)}
      onChange={(evento) => setTexto(evento.target.value)}
      onBlur={gravar}
      onKeyDown={(evento) => teclasDoCampo(evento, desistiu)}
    />
  )
}

export function BonecoDaArenaDBT({ boneco, momento, onAjustar, onTirar, pvAtual }: BonecoDaArenaDBTProps) {
  return (
    <li className="dba-boneco" data-momento={momento}>
      <div className="dba-boneco__cab">
        <span className="dba-boneco__med" aria-hidden="true">
          <IconeDoMundo nome="boneco" />
        </span>
        {momento === 'montagem' ? <NomeDoBoneco nome={boneco.nome} onTrocar={(nome) => onAjustar({ nome })} /> : <span className="dba-boneco__nome">{boneco.nome}</span>}
        {pvAtual !== undefined && (
          <span className="dba-boneco__pv" aria-label={`PV agora ${pvAtual} de ${boneco.pv}`}>
            {pvAtual}/{boneco.pv}
          </span>
        )}
        {onTirar !== undefined && (
          <button type="button" className="dbf-btn dbf-btn--xs dbf-btn--ghost" aria-label={`Tirar ${boneco.nome}`} title="Tirar o boneco" onClick={onTirar}>
            <IconeDoMundo nome="x" />
          </button>
        )}
      </div>
      <div className="dba-boneco__campos">
        <CampoDoBoneco rotulo="CA" dica="Classe de Armadura: o acerto precisa chegar nela" valor={boneco.ca} min={0} max={CA_DO_BONECO_MAX} onTrocar={(ca) => onAjustar({ ca })} />
        <CampoDoBoneco
          rotulo="PV"
          dica={momento === 'luta' ? 'Regrava o PV atual e o máximo' : 'Pontos de Vida do boneco'}
          valor={boneco.pv}
          min={1}
          max={PV_DO_BONECO_MAX}
          onTrocar={(pv) => onAjustar({ pv })}
        />
        <CampoDoBoneco rotulo="EP" dica="Escala de Poder: a diferença de EP desloca a faixa de dano" valor={boneco.ep} min={0} max={EP_DO_BONECO_MAX} onTrocar={(ep) => onAjustar({ ep })} />
      </div>
    </li>
  )
}
