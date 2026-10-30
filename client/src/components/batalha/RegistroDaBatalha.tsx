import type { LinhaNaTela } from './dadosDaFaixa'
import './batalha.css'

/**
 * O REGISTRO DA BATALHA (decisão 5): a mais nova em cima, "R2 · Mestre" e o
 * texto da linha; Desfazer onde quem olha pode desfazer (o mestre, qualquer
 * linha que vale; o jogador, só a dele e só na vez dele — quem decide é
 * `podeDesfazer`, aqui só se obedece). A linha desfeita fica, riscada, com
 * "desfeito por X", e não se desfaz de novo.
 */

export interface RegistroDaBatalhaProps {
  linhas: readonly LinhaNaTela[]
  onDesfazer: (linhaId: string) => void
  /** Linhas com o Desfazer já pedido e sem resposta ainda (o jogador espera o host). */
  pendentes?: ReadonlySet<string>
  /** Quantas mostrar; ausente = todas. */
  maximo?: number
  /** Nome acessível da lista. */
  rotulo?: string
}

const NENHUMA_PENDENTE: ReadonlySet<string> = new Set()

export function RegistroDaBatalha({ linhas, onDesfazer, pendentes = NENHUMA_PENDENTE, maximo, rotulo = 'Registro da batalha' }: RegistroDaBatalhaProps) {
  if (linhas.length === 0) return <p className="bt-registro__vazio">Nada aconteceu ainda nesta batalha. Passar a vez, mudar a ordem e mexer na ficha entram aqui.</p>
  const visiveis = maximo === undefined ? linhas : linhas.slice(0, maximo)
  return (
    <ol className="bt-registro" aria-label={rotulo}>
      {visiveis.map((linha) => {
        const desfeita = linha.desfeitaPor !== null
        const pedida = pendentes.has(linha.id)
        return (
          <li key={linha.id} className="bt-registro__linha" data-desfeita={desfeita ? 'sim' : 'nao'}>
            <span>
              <span className="bt-registro__meta">
                R{linha.rodada} · {linha.autor}
              </span>{' '}
              <span className="bt-registro__texto">{linha.texto}</span>
              {desfeita && <span className="bt-registro__quem">desfeito por {linha.desfeitaPor}</span>}
            </span>
            {!desfeita && linha.podeDesfazer && (
              <button
                type="button"
                className="bt-botao bt-botao--p"
                disabled={pedida}
                aria-label={pedida ? `Desfazendo: ${linha.texto}` : `Desfazer: ${linha.texto}`}
                onClick={() => onDesfazer(linha.id)}
              >
                {pedida ? 'Desfazendo…' : 'Desfazer'}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
