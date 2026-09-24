import { useId, useRef, useState, type FormEvent } from 'react'
import type { EstadoDoMundo, ResumoDaTroca } from '../lib/estadoDoMundo'
import { CollapsibleSection } from './CollapsibleSection'

export type { ResumoDaTroca }

export interface WorldStateSectionProps {
  estados: readonly EstadoDoMundo[]
  /** Quantos elementos (portas, pinos, zonas) obedecem a cada estado, somando as cenas abertas. */
  amarrados: ReadonlyMap<string, number>
  /** Devolve o id do estado criado, ou `null` quando não deu. */
  onCriar: (nome: string, valores: string) => string | null
  /** Devolve o que mudou, ou `null` quando a troca não valeu. */
  onTrocar: (estadoId: string, valor: string) => ResumoDaTroca | null
}

/** "Maré: baixa. 4 elementos mudaram em 2 cenas." — o aviso depois de um toque. */
export function trocaText(nome: string, valor: string, resumo: ResumoDaTroca): string {
  if (resumo.elementos === 0) return `${nome}: ${valor}. Nenhum elemento mudou.`
  const elementos = resumo.elementos === 1 ? '1 elemento mudou' : `${resumo.elementos} elementos mudaram`
  const cenas = resumo.cenas === 1 ? '1 cena' : `${resumo.cenas} cenas`
  return `${nome}: ${valor}. ${elementos} em ${cenas}.`
}

function amarradosText(n: number): string {
  if (n === 0) return 'Nada amarrado ainda'
  return n === 1 ? '1 elemento amarrado' : `${n} elementos amarrados`
}

/**
 * ESTADO DO MUNDO — "Maré: alta | baixa". O mestre troca o valor com um toque e
 * as portas, os pinos de viagem e as zonas ocultas amarrados ao estado mudam
 * juntos, em todas as cenas da aventura. Os valores são rádios nativos: as
 * setas trocam de valor, e o grupo inteiro é uma parada de Tab. Nada disto vai
 * ao jogador: ele recebe só o efeito (`lib/fogFilter.ts`).
 */
export function WorldStateSection({ estados, amarrados, onCriar, onTrocar }: WorldStateSectionProps) {
  const baseId = useId()
  const [aviso, setAviso] = useState('')
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [valores, setValores] = useState('')
  const [erro, setErro] = useState<{ campo: 'nome' | 'valores'; texto: string } | null>(null)
  const nomeRef = useRef<HTMLInputElement | null>(null)
  const valoresRef = useRef<HTMLInputElement | null>(null)
  const nomeId = `${baseId}-nome`
  const valoresId = `${baseId}-valores`
  const erroId = `${baseId}-erro`

  const trocar = (estado: EstadoDoMundo, valor: string) => {
    if (valor === estado.atual) return
    const resumo = onTrocar(estado.id, valor)
    if (resumo !== null) setAviso(trocaText(estado.nome, valor, resumo))
  }

  /** Ao fechar o formulário o foco volta para "Novo estado", que só existe no render seguinte. */
  const focarNovoRef = useRef(false)
  const refDoNovo = (el: HTMLButtonElement | null) => {
    if (el !== null && focarNovoRef.current) {
      focarNovoRef.current = false
      el.focus()
    }
  }

  const fecharForm = () => {
    setCriando(false)
    setNome('')
    setValores('')
    setErro(null)
    focarNovoRef.current = true
  }

  const criar = (event: FormEvent) => {
    event.preventDefault()
    if (nome.trim().length === 0) {
      setErro({ campo: 'nome', texto: 'Dê um nome ao estado, como "Maré".' })
      nomeRef.current?.focus()
      return
    }
    if (valores.split(',').every((v) => v.trim().length === 0)) {
      setErro({ campo: 'valores', texto: 'Escreva pelo menos um valor, como "alta, baixa".' })
      valoresRef.current?.focus()
      return
    }
    const id = onCriar(nome, valores)
    if (id === null) {
      setErro({ campo: 'nome', texto: 'Não deu para criar o estado.' })
      nomeRef.current?.focus()
      return
    }
    setAviso(`Estado "${nome.trim()}" criado.`)
    fecharForm()
  }

  return (
    <CollapsibleSection id="world-state" title="Estado do mundo" defaultOpen={false}>
      <div className="lb-world">
        {estados.length === 0 ? (
          <p className="lb-world__vazio">Nenhum estado ainda. Um estado ("Maré: alta, baixa") muda de uma vez as portas, os pinos e as zonas amarrados a ele, em todas as cenas.</p>
        ) : (
          estados.map((estado) => (
            <fieldset key={estado.id} className="lb-world__estado">
              <legend className="lb-label">{estado.nome}</legend>
              <div className="lb-seg lb-world__valores">
                {estado.valores.map((valor) => (
                  <label key={valor} className="lb-seg__option lb-world__valor">
                    <input
                      type="radio"
                      className="lb-world__radio"
                      name={`${baseId}-${estado.id}`}
                      value={valor}
                      checked={estado.atual === valor}
                      onChange={() => trocar(estado, valor)}
                    />
                    {valor}
                  </label>
                ))}
              </div>
              <p className="lb-world__conta">{amarradosText(amarrados.get(estado.id) ?? 0)}</p>
            </fieldset>
          ))
        )}
        <p className="lb-world__aviso" role="status">
          {aviso}
        </p>
        {criando ? (
          <form className="lb-world__form" onSubmit={criar} noValidate>
            <div className="lb-field">
              <label className="lb-label" htmlFor={nomeId}>
                Nome
              </label>
              <input
                ref={nomeRef}
                id={nomeId}
                className="lb-input"
                value={nome}
                placeholder="Maré"
                aria-invalid={erro?.campo === 'nome'}
                aria-describedby={erro?.campo === 'nome' ? erroId : undefined}
                onChange={(e) => {
                  setNome(e.target.value)
                  if (erro?.campo === 'nome') setErro(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') fecharForm()
                }}
                autoFocus
              />
            </div>
            <div className="lb-field">
              <label className="lb-label" htmlFor={valoresId}>
                Valores, separados por vírgula
              </label>
              <input
                ref={valoresRef}
                id={valoresId}
                className="lb-input"
                value={valores}
                placeholder="alta, baixa"
                aria-invalid={erro?.campo === 'valores'}
                aria-describedby={erro?.campo === 'valores' ? erroId : undefined}
                onChange={(e) => {
                  setValores(e.target.value)
                  if (erro?.campo === 'valores') setErro(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') fecharForm()
                }}
              />
            </div>
            {erro !== null && (
              <p id={erroId} className="lb-world__erro">
                {erro.texto}
              </p>
            )}
            <div className="lb-world__acoes">
              <button type="button" className="lb-btn" onClick={fecharForm}>
                Cancelar
              </button>
              <button type="submit" className="lb-btn lb-btn--primary">
                Criar
              </button>
            </div>
          </form>
        ) : (
          <button ref={refDoNovo} type="button" className="lb-btn" onClick={() => setCriando(true)}>
            Novo estado
          </button>
        )}
      </div>
    </CollapsibleSection>
  )
}
