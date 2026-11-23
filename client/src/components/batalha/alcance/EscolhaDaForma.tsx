import { useId, useMemo, useRef, type KeyboardEvent } from 'react'
import { casasDaExplosao, casasDoAlcance } from '../../../lib/batalha/alcance/casas'
import type { CorDoAlcance } from '../../../lib/batalha/alcance/cor'
import { usaDirecao, type FormaDoAlcance } from '../../../lib/batalha/alcance/forma'
import type { OpcaoDeForma } from './formaNaTela'
import './alcance.css'

/**
 * O SELETOR "FORMA DO ALCANCE" (fase F, ALCANCE.md §8; protótipo `sincronizarCampos` e
 * `glifo`): um botão por desenho, cada um com a forma pequena acesa pela MESMA função das casas
 * da batalha (`casasDoAlcance`, `casasDaExplosao`), sem geometria própria. Grupo de rádio de
 * verdade: setas trocam e levam o foco, Tab entra só no escolhido.
 */

/** O desenho de 7 x 7 casas, com a ficha no meio; as formas que olham para um lado olham para cima. */
const LADO_DO_GLIFO = 7
const MEIO = 3
/** A ficha das formas que olham para um lado fica embaixo, para a forma caber. */
const LINHA_DA_FICHA_DIRECIONAL = 5
/** O centro da área longe, 2 casas acima de quem usa. */
const CENTRO_DA_AREA = { col: MEIO, row: 1, tamanho: 1 }

function casasDoGlifo(forma: FormaDoAlcance): { acesas: ReadonlySet<string>; quemUsa: { col: number; row: number }; centro: { col: number; row: number } | null } {
  const grade = { segmentos: [], colunas: LADO_DO_GLIFO, linhas: LADO_DO_GLIFO, grade: 1 }
  const quemUsa = { col: MEIO, row: usaDirecao(forma) ? LINHA_DA_FICHA_DIRECIONAL : MEIO, tamanho: 1 }
  if (forma.tipo === 'ponto' || forma.tipo === 'ficha') {
    const casas = casasDaExplosao({ ...grade, forma, centro: CENTRO_DA_AREA })
    return { acesas: new Set(casas.map((casa) => `${casa.col},${casa.row}`)), quemUsa: { col: MEIO, row: LADO_DO_GLIFO - 2 }, centro: forma.tipo === 'ficha' ? CENTRO_DA_AREA : null }
  }
  const casas = casasDoAlcance({ ...grade, forma, quemUsa, direcao: 'norte' })
  return { acesas: new Set(casas.map((casa) => `${casa.col},${casa.row}`)), quemUsa, centro: null }
}

export function GlifoDoAlcance({ forma, cor }: { forma: FormaDoAlcance; cor: CorDoAlcance }) {
  const { acesas, quemUsa, centro } = useMemo(() => casasDoGlifo(forma), [forma])
  const passo = 30 / LADO_DO_GLIFO
  const celulas = []
  for (let row = 0; row < LADO_DO_GLIFO; row += 1) {
    for (let col = 0; col < LADO_DO_GLIFO; col += 1) {
      const chave = `${col},${row}`
      celulas.push(<rect key={chave} x={col * passo + 0.5} y={row * passo + 0.5} width={passo - 1} height={passo - 1} rx={0.6} className={acesas.has(chave) ? `lb-alc__glifo-acesa lb-alc__glifo-acesa--${cor}` : 'lb-alc__glifo-casa'} />)
    }
  }
  const ficha = (casa: { col: number; row: number }, chave: string) => <circle key={chave} cx={casa.col * passo + passo / 2} cy={casa.row * passo + passo / 2} r={passo * 0.34} className="lb-alc__glifo-ficha" />
  return (
    <svg className="lb-alc__glifo" viewBox="0 0 30 30" aria-hidden="true">
      {celulas}
      {ficha(quemUsa, 'quem')}
      {centro !== null && ficha(centro, 'centro')}
    </svg>
  )
}

interface EscolhaDaFormaProps<T extends string> {
  legenda: string
  opcoes: readonly OpcaoDeForma<T>[]
  valor: T
  cor: CorDoAlcance
  onChange: (valor: T) => void
  /** Leitura só (o jogador vendo a ficha, a arma do Acervo): os botões não trocam. */
  soLeitura?: boolean
}

export function EscolhaDaForma<T extends string>({ legenda, opcoes, valor, cor, onChange, soLeitura = false }: EscolhaDaFormaProps<T>) {
  const legendaId = useId()
  const grupo = useRef<HTMLDivElement>(null)
  const aoTeclar = (event: KeyboardEvent<HTMLButtonElement>) => {
    const passo = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (passo === 0 || soLeitura) return
    event.preventDefault()
    const indice = opcoes.findIndex((opcao) => opcao.tipo === valor)
    const proxima = opcoes[(indice + passo + opcoes.length) % opcoes.length]
    if (proxima === undefined) return
    onChange(proxima.tipo)
    // O botão escolhido é refeito no mesmo lugar: o foco vai com a escolha (o rádio do sistema faz assim).
    requestAnimationFrame(() => grupo.current?.querySelector<HTMLButtonElement>(`[data-forma="${proxima.tipo}"]`)?.focus())
  }
  return (
    <div className="lb-alc__campo">
      <span className="lb-mec__legenda" id={legendaId}>
        {legenda}
      </span>
      <div ref={grupo} className="lb-alc__formas" role="radiogroup" aria-labelledby={legendaId} aria-readonly={soLeitura || undefined}>
        {opcoes.map((opcao) => {
          const escolhida = opcao.tipo === valor
          return (
            <button
              key={opcao.tipo}
              type="button"
              role="radio"
              className="lb-alc__forma"
              data-forma={opcao.tipo}
              aria-checked={escolhida}
              tabIndex={escolhida ? 0 : -1}
              disabled={soLeitura && !escolhida}
              onClick={() => {
                if (!soLeitura) onChange(opcao.tipo)
              }}
              onKeyDown={aoTeclar}
            >
              <GlifoDoAlcance forma={opcao.exemplo} cor={cor} />
              <span>{opcao.rotulo}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
