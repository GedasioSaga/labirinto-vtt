import { useEffect, useId, useMemo, useState } from 'react'
import { ensaiar, type PassoDoEnsaio } from '../../lib/batalha/ensaio/ensaio'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { SEMENTE_MAX } from '../../lib/treino/sorteio'
import './ensaio.css'

/**
 * A MINIABA DO TESTAR (Fase 3 de docs/design/habilidades/SISTEMA.md §6,
 * notas 5-11 do protótipo): um botão roda o cartão no Boneco de treino e
 * mostra, em passos numerados, o que o motor da batalha fez. O cartão é o da
 * tela (o rascunho): mudou no editor, o teste roda de novo com o MESMO d20;
 * só o "Testar de novo" sorteia outro. Nada sai daqui: nem ficha, nem mapa.
 */

/** O d20 fixo do boneco: "Sorteado" ou de 1 a 20. */
const FACES_DO_D20 = Array.from({ length: 20 }, (_, i) => i + 1)

function novaSemente(): number {
  return Math.floor(Math.random() * SEMENTE_MAX)
}

interface PainelDeEnsaioProps {
  cartao: CartaoDaFicha
  /** A ficha de quem usa; o teste trabalha numa cópia dela. */
  quemUsa: Personagem
  sistema: SistemaDeRpg
  onFechar: () => void
  /** Dentro do editor ou do cartão da ficha: sem a coluna fixa da biblioteca. */
  embutido?: boolean
}

export function PainelDeEnsaio({ cartao, quemUsa, sistema, onFechar, embutido = false }: PainelDeEnsaioProps) {
  const tituloId = useId()
  const d20Id = useId()
  const [semente, setSemente] = useState(novaSemente)
  const [d20Fixo, setD20Fixo] = useState<number | null>(null)
  const [depois, setDepois] = useState<PassoDoEnsaio[]>([])
  const [recursosCheios, setRecursosCheios] = useState(false)

  const resultado = useMemo(
    () => ensaiar({ cartao, quemUsa, sistema, semente, recursosCheios, ...(d20Fixo === null ? {} : { d20Fixo }) }),
    [cartao, quemUsa, sistema, semente, d20Fixo, recursosCheios],
  )
  // O conserto de um clique só aparece na recusa que ele conserta (SP ou HP que faltam na cópia).
  const consertaRecursos = resultado.passos.some((passo) => passo.conserto === 'encherRecursos')
  // O "Passar 1 vez" vale para o golpe que está na tela: outro golpe, outra conta.
  useEffect(() => setDepois([]), [resultado])

  useEffect(() => {
    // Esc fecha a camada de cima (nota 22 do protótipo): o teste antes da janela da ficha, por isso na captura.
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      event.preventDefault()
      onFechar()
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [onFechar])

  const passos = [...resultado.passos, ...depois]
  const { passarUmaVez } = resultado

  return (
    <aside className={embutido ? 'mu-cartao ens-painel ens-painel--embutido' : 'mu-cartao ens-painel'} aria-labelledby={tituloId}>
      <header className="ens-cab">
        <h3 id={tituloId} className="ens-tit">
          Testar: {cartao.nome.trim().length > 0 ? cartao.nome : 'sem nome'}
        </h3>
        <button type="button" className="mu-bt mu-bt--p" aria-label="Fechar o teste" onClick={onFechar}>
          Fechar
        </button>
      </header>
      <p className="ens-quem">
        {quemUsa.nome} usa num boneco de treino. A ficha e o mapa não mudam.
      </p>

      {resultado.barras.map((barra) => (
        <div key={barra.nome} className="ens-barra" role="img" aria-label={`${barra.nome}: vida ${barra.antes} para ${barra.depois} de ${barra.maximo}`}>
          <span className="ens-barra__nome">{barra.nome}</span>
          <span className="ens-barra__trilho" aria-hidden="true">
            <span className="ens-barra__cheia" style={{ transform: `scaleX(${barra.maximo > 0 ? Math.min(1, barra.depois / barra.maximo) : 0})` }} />
          </span>
          <span className="ens-barra__num">
            HP {barra.antes} → {barra.depois}
          </span>
        </div>
      ))}

      <ol className="ens-passos" aria-label="O que aconteceu">
        {passos.map((passo, indice) => (
          // A chave leva a semente: o "Testar de novo" refaz a cascata; a mudança no editor só troca o texto.
          <li key={`${semente}-${indice}`} className={`ens-passo ens-passo--${passo.tipo}`} style={{ animationDelay: `${Math.min(indice, 7) * 30}ms` }}>
            {passo.dado !== undefined && (
              <span className="ens-d20" aria-hidden="true">
                {passo.dado}
              </span>
            )}
            <span className="ens-passo__tit">{passo.titulo}</span> {passo.texto}
          </li>
        ))}
      </ol>

      <div className="ens-acoes">
        {consertaRecursos && !recursosCheios && (
          <button type="button" className="mu-bt mu-bt--p" onClick={() => setRecursosCheios(true)}>
            Testar com SP e HP cheios
          </button>
        )}
        <button type="button" className="mu-bt mu-bt--p" onClick={() => setSemente(novaSemente())}>
          Testar de novo
        </button>
        {passarUmaVez !== null && (
          <button type="button" className="mu-bt mu-bt--p" onClick={() => setDepois((antes) => [...antes, ...passarUmaVez()])}>
            Passar 1 vez do alvo
          </button>
        )}
      </div>

      <details className="ens-ajustes">
        <summary>Ajustar o boneco e a cópia</summary>
        <label htmlFor={d20Id} className="ens-ajuste">
          d20 do boneco
          <select id={d20Id} value={d20Fixo === null ? '' : String(d20Fixo)} onChange={(event) => setD20Fixo(event.target.value === '' ? null : Number(event.target.value))}>
            <option value="">Sorteado</option>
            {FACES_DO_D20.map((face) => (
              <option key={face} value={face}>
                {face}
              </option>
            ))}
          </select>
        </label>
        <label className="ens-ajuste">
          <input type="checkbox" checked={recursosCheios} onChange={(event) => setRecursosCheios(event.target.checked)} />
          Cópia de {quemUsa.nome} com SP e HP cheios
        </label>
      </details>
    </aside>
  )
}
