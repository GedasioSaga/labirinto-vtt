import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { PassoDaPatrulha, PontoDaPatrulha, TipoDePassoDaPatrulha } from '../types/map'
import { ESPERA_MAXIMA_S, FALA_MAX_LETRAS, passosDoPonto, VELOCIDADE_PADRAO } from '../lib/npcPatrol'
import './TokenControls.css'

/**
 * MACRO POR PONTO no painel da patrulha: a lista de pontos da rota, cada um
 * com o resumo do que a ficha faz nele; abrir um ponto mostra os passos dele,
 * um por linha (rótulo, valor, subir/descer, remover) com alça de arrastar, e
 * "+ Adicionar passo" com os 7 tipos. Toda edição sai inteira por `onPassos`:
 * quem aplica é o store, que a põe no Ctrl+Z (a EXECUÇÃO dos passos fica fora).
 */

/** As velocidades que as listas oferecem, em casas por segundo: de quem espreita a quem corre. */
export const VELOCIDADES = [0.5, 1, 2, 3, 4, 6, 8] as const

export function rotuloDaVelocidade(casas: number): string {
  return casas === 1 ? '1 casa/s' : `${casas.toLocaleString('pt-BR')} casas/s`
}

/** As 8 direções do "Olhar para", em graus de tela (0 = para cima, horário: a frente da ficha). */
const DIRECOES: ReadonlyArray<{ graus: number; nome: string; curto: string }> = [
  { graus: 0, nome: 'Norte (cima)', curto: 'N' },
  { graus: 45, nome: 'Nordeste', curto: 'NE' },
  { graus: 90, nome: 'Leste (direita)', curto: 'L' },
  { graus: 135, nome: 'Sudeste', curto: 'SE' },
  { graus: 180, nome: 'Sul (baixo)', curto: 'S' },
  { graus: 225, nome: 'Sudoeste', curto: 'SO' },
  { graus: 270, nome: 'Oeste (esquerda)', curto: 'O' },
  { graus: 315, nome: 'Noroeste', curto: 'NO' },
]

/** Os 7 tipos, na ordem do menu, com o passo que nasce de cada um. */
const TIPOS: ReadonlyArray<{ tipo: TipoDePassoDaPatrulha; rotulo: string; novo: PassoDaPatrulha }> = [
  { tipo: 'esperar', rotulo: 'Esperar', novo: { tipo: 'esperar', segundos: 2 } },
  { tipo: 'olhar', rotulo: 'Olhar para', novo: { tipo: 'olhar', graus: 0 } },
  { tipo: 'velocidade', rotulo: 'Velocidade', novo: { tipo: 'velocidade', casas: VELOCIDADE_PADRAO } },
  { tipo: 'falar', rotulo: 'Falar', novo: { tipo: 'falar', texto: '' } },
  { tipo: 'sumir', rotulo: 'Sumir', novo: { tipo: 'sumir' } },
  { tipo: 'aparecer', rotulo: 'Aparecer', novo: { tipo: 'aparecer' } },
  { tipo: 'esperarMestre', rotulo: 'Esperar o mestre', novo: { tipo: 'esperarMestre' } },
]

function rotuloDoTipo(tipo: TipoDePassoDaPatrulha): string {
  return TIPOS.find((t) => t.tipo === tipo)?.rotulo ?? tipo
}

function direcaoCurta(graus: number): string {
  return DIRECOES.find((d) => d.graus === graus)?.curto ?? `${graus}°`
}

function segundosEscritos(segundos: number): string {
  return `${segundos.toLocaleString('pt-BR')} s`
}

/** Um passo em poucas letras, para o resumo do ponto. */
function passoCurto(passo: PassoDaPatrulha): string {
  switch (passo.tipo) {
    case 'esperar':
      return segundosEscritos(passo.segundos)
    case 'olhar':
      return `Olhar ${direcaoCurta(passo.graus)}`
    case 'velocidade':
      return rotuloDaVelocidade(passo.casas)
    case 'esperarMestre':
      return 'Esperar você'
    default:
      return rotuloDoTipo(passo.tipo)
  }
}

/** Mais que isto no resumo vira "+N": a coluna do painel é estreita. */
const RESUMO_MAX_PASSOS = 3

/** "Esperar 2 s" vira "2 s · Olhar L · Falar +1": o que a ficha faz no ponto, de relance. */
export function resumoDosPassos(passos: readonly PassoDaPatrulha[]): string {
  if (passos.length === 0) return 'Segue direto'
  const vistos = passos.slice(0, RESUMO_MAX_PASSOS).map(passoCurto).join(' · ')
  return passos.length > RESUMO_MAX_PASSOS ? `${vistos} +${passos.length - RESUMO_MAX_PASSOS}` : vistos
}

/** Lista com o passo `de` levado para a posição `para`. */
function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  const nova = [...lista]
  const [item] = nova.splice(de, 1)
  if (item === undefined) return nova
  nova.splice(para, 0, item)
  return nova
}

interface CampoQueConfirmaProps {
  valor: string
  tipo: 'number' | 'text'
  rotulo: string
  onConfirmar: (valor: string) => void
  min?: number
  max?: number
  passo?: number
  maxLength?: number
}

/**
 * Campo que manda o valor ao SAIR dele (ou no Enter), não a cada tecla: cada
 * envio é um passo de Ctrl+Z, e "15" não pode virar dois passos ("1", "15").
 */
function CampoQueConfirma({ valor, tipo, rotulo, onConfirmar, min, max, passo, maxLength }: CampoQueConfirmaProps) {
  const [rascunho, setRascunho] = useState(valor)
  // Ctrl+Z ou outro ponto: o campo acompanha o valor gravado.
  useEffect(() => setRascunho(valor), [valor])
  const confirmar = () => {
    if (rascunho !== valor) onConfirmar(rascunho)
  }
  const teclas = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') confirmar()
    if (event.key === 'Escape') setRascunho(valor)
  }
  return (
    <input
      type={tipo}
      className="lb-input lb-passo__valor"
      aria-label={rotulo}
      value={rascunho}
      min={min}
      max={max}
      step={passo}
      maxLength={maxLength}
      onChange={(event) => setRascunho(event.target.value)}
      onBlur={confirmar}
      onKeyDown={teclas}
    />
  )
}

interface CampoDoPassoProps {
  passo: PassoDaPatrulha
  numero: number
  onTrocar: (passo: PassoDaPatrulha) => void
}

/** O valor do passo, no controle que cabe a ele. Sumir, aparecer e esperar o mestre não têm valor. */
function CampoDoPasso({ passo, numero, onTrocar }: CampoDoPassoProps) {
  switch (passo.tipo) {
    case 'esperar':
      return (
        <>
          <CampoQueConfirma
            tipo="number"
            rotulo={`Segundos do passo ${numero}`}
            valor={String(passo.segundos)}
            min={0}
            max={ESPERA_MAXIMA_S}
            passo={0.5}
            onConfirmar={(texto) => {
              const segundos = Number(texto.replace(',', '.'))
              if (Number.isFinite(segundos)) onTrocar({ tipo: 'esperar', segundos })
            }}
          />
          <span className="lb-passo__unidade">s</span>
        </>
      )
    case 'olhar':
      return (
        <select className="lb-input lb-passo__valor" aria-label={`Direção do passo ${numero}`} value={String(passo.graus)} onChange={(event) => onTrocar({ tipo: 'olhar', graus: Number(event.target.value) })}>
          {DIRECOES.some((d) => d.graus === passo.graus) ? null : <option value={String(passo.graus)}>{`${passo.graus}°`}</option>}
          {DIRECOES.map((d) => (
            <option key={d.graus} value={String(d.graus)}>
              {d.nome}
            </option>
          ))}
        </select>
      )
    case 'velocidade':
      return (
        <select className="lb-input lb-passo__valor" aria-label={`Velocidade do passo ${numero}`} value={String(passo.casas)} onChange={(event) => onTrocar({ tipo: 'velocidade', casas: Number(event.target.value) })}>
          {[...new Set<number>([...VELOCIDADES, passo.casas])]
            .sort((a, b) => a - b)
            .map((casas) => (
              <option key={casas} value={String(casas)}>
                {rotuloDaVelocidade(casas)}
              </option>
            ))}
        </select>
      )
    case 'falar':
      return <CampoQueConfirma tipo="text" rotulo={`Fala do passo ${numero}`} valor={passo.texto} maxLength={FALA_MAX_LETRAS} onConfirmar={(texto) => onTrocar({ tipo: 'falar', texto })} />
    default:
      return null
  }
}

interface PassosDoPontoProps {
  indice: number
  passos: readonly PassoDaPatrulha[]
  onPassos: (indice: number, passos: PassoDaPatrulha[]) => void
}

/** Os passos de UM ponto: uma linha cada, na ordem em que a ficha os faz. */
function PassosDoPonto({ indice, passos, onPassos }: PassosDoPontoProps) {
  // O índice arrastado mora num ref (lido no drop, que pode chegar antes de o
  // React repintar) e num estado (só para apagar a linha que está sendo levada).
  const arrastadoRef = useRef<number | null>(null)
  const [arrastado, setArrastadoVisivel] = useState<number | null>(null)
  const setArrastado = (i: number | null) => {
    arrastadoRef.current = i
    setArrastadoVisivel(i)
  }
  const mandar = (lista: PassoDaPatrulha[]) => onPassos(indice, lista)
  const trocar = (i: number, passo: PassoDaPatrulha) => mandar(passos.map((p, j) => (j === i ? passo : p)))
  return (
    <div className="lb-passos">
      {passos.length === 0 ? <p className="lb-field__hint">Sem passos: a ficha passa por aqui sem parar.</p> : null}
      <ol className="lb-passos__lista">
        {passos.map((passo, i) => {
          const numero = i + 1
          return (
            <li
              // A lista não tem id estável por passo; índice + tipo basta (reordenar remonta a linha).
              key={`${i}-${passo.tipo}`}
              className={arrastado === i ? 'lb-passo lb-passo--arrastado' : 'lb-passo'}
              onDragOver={(event) => {
                if (arrastadoRef.current !== null) event.preventDefault()
              }}
              onDrop={(event) => {
                event.preventDefault()
                const de = arrastadoRef.current
                if (de !== null && de !== i) mandar(mover(passos, de, i))
                setArrastado(null)
              }}
            >
              <span
                className="lb-passo__alca"
                draggable
                aria-hidden="true"
                title="Arraste para mudar a ordem"
                onDragStart={(event) => {
                  // jsdom e alguns navegadores não trazem `dataTransfer`; o Firefox só arrasta com algum dado.
                  event.dataTransfer?.setData('text/plain', String(i))
                  setArrastado(i)
                }}
                onDragEnd={() => setArrastado(null)}
              >
                ⠿
              </span>
              <span className="lb-passo__rotulo">{rotuloDoTipo(passo.tipo)}</span>
              <CampoDoPasso passo={passo} numero={numero} onTrocar={(novo) => trocar(i, novo)} />
              <span className="lb-passo__acoes">
                <button type="button" className="lb-btn lb-btn--ghost lb-passo__btn" aria-label={`Subir passo ${numero}`} disabled={i === 0} onClick={() => mandar(mover(passos, i, i - 1))}>
                  ↑
                </button>
                <button
                  type="button"
                  className="lb-btn lb-btn--ghost lb-passo__btn"
                  aria-label={`Descer passo ${numero}`}
                  disabled={i === passos.length - 1}
                  onClick={() => mandar(mover(passos, i, i + 1))}
                >
                  ↓
                </button>
                <button type="button" className="lb-btn lb-btn--ghost lb-passo__btn" aria-label={`Remover passo ${numero}`} onClick={() => mandar(passos.filter((_, j) => j !== i))}>
                  ×
                </button>
              </span>
            </li>
          )
        })}
      </ol>
      {/* Lista suspensa no papel de menu: teclado e leitor de tela prontos, e cabe na coluna estreita. */}
      <select
        className="lb-input lb-passos__adicionar"
        aria-label="Adicionar passo"
        value=""
        onChange={(event) => {
          const novo = TIPOS.find((t) => t.tipo === event.target.value)?.novo
          if (novo !== undefined) mandar([...passos, novo])
        }}
      >
        <option value="">+ Adicionar passo</option>
        {TIPOS.map((t) => (
          <option key={t.tipo} value={t.tipo}>
            {t.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}

export interface ListaDePontosProps {
  pontos: readonly PontoDaPatrulha[]
  /** O ponto aberto no painel (o mapa o destaca); `null` = nenhum. */
  aberto: number | null
  onAbrir: (indice: number | null) => void
  onPassos: (indice: number, passos: PassoDaPatrulha[]) => void
}

/** Os pontos da rota, cada um com o resumo; o aberto mostra os passos logo abaixo dele. */
export function ListaDePontos({ pontos, aberto, onAbrir, onPassos }: ListaDePontosProps) {
  const baseId = useId()
  return (
    <ol className="lb-patrulha-pontos" aria-label="Pontos da ronda">
      {pontos.map((ponto, i) => {
        const passos = passosDoPonto(ponto)
        const estaAberto = aberto === i
        const corpoId = `${baseId}-ponto-${i}`
        return (
          <li key={i} className="lb-patrulha-ponto">
            <button
              type="button"
              className="lb-btn lb-btn--ghost lb-btn--block lb-patrulha-ponto__cabeca"
              aria-expanded={estaAberto}
              aria-controls={estaAberto ? corpoId : undefined}
              onClick={() => onAbrir(estaAberto ? null : i)}
            >
              <span className="lb-patrulha-ponto__nome">Ponto {i + 1}</span>
              <span className="lb-patrulha-ponto__resumo">{resumoDosPassos(passos)}</span>
            </button>
            {estaAberto ? (
              <div id={corpoId}>
                <PassosDoPonto indice={i} passos={passos} onPassos={onPassos} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
