import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { theme } from '../../theme'
import { Cabeca, CabecaMedalha } from './Cabeca'
import { classes, movimentoReduzido } from './comum'
import './grimorio.css'

/** A sub-ficha entra 8 px de lado em 180 ms (o `.entra-lado` do protótipo); com movimento reduzido, só aparece. */
const ENTRADA_DE_LADO_MS = 180
const ENTRADA_REDUZIDA_MS = 120

/**
 * O bloco essencial (o `.ficha--plana.essencial` do protótipo): sempre aberto,
 * sem cabeçalho, logo abaixo da cabeça. É onde fica o que se muda a toda hora.
 */
export function Essencial({ children }: { children: ReactNode }) {
  return (
    <div className="gr-ficha gr-ficha--plana gr-essencial">
      <div className="gr-ficha__dentro">{children}</div>
    </div>
  )
}

/**
 * Grade de cartões (o `.cartoes`): recursos raros do item, cada um abrindo uma
 * sub-ficha própria. O título diz isso, para o clique não surpreender.
 */
export function Cartoes({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <>
      <h3 className="gr-titulo-secao">
        {titulo}
        <small>abre em ficha própria</small>
      </h3>
      <div className="gr-cartoes">{children}</div>
    </>
  )
}

export interface CartaoProps {
  icone: ReactNode
  rotulo: string
  /** O estado em poucas palavras ("Desligada", "Lampião aceso"). */
  resumo: string
  /** Recurso em uso: filete de latão e o pontinho no canto. */
  ligado?: boolean
  /** Presente, o cartão fica apagado e diz por quê, no lugar do resumo. */
  desligado?: string
  /** `peloTeclado`: Enter ou Espaço (a sub-ficha entra sem animação). */
  onAbrir: (peloTeclado: boolean) => void
  /** Ao voltar da sub-ficha deste cartão, o foco volta para ele. */
  focar?: boolean
}

/** Um cartão (o `.cartao`): ícone gravado, nome e resumo, empilhados. */
export function Cartao({ icone, rotulo, resumo, ligado = false, desligado, onAbrir, focar = false }: CartaoProps) {
  const botao = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    if (focar) botao.current?.focus({ preventScroll: true })
  }, [focar])
  return (
    <button
      ref={botao}
      type="button"
      className={classes('gr-cartao', ligado && 'gr-e-ligado')}
      disabled={desligado !== undefined}
      // `detail` 0 = clique sintetizado pelo Enter ou pelo Espaço.
      onClick={(evento) => onAbrir(evento.detail === 0)}
    >
      {icone}
      <span className="gr-cartao__rot">{rotulo}</span>
      <span className="gr-cartao__resumo">{desligado ?? resumo}</span>
    </button>
  )
}

export interface SubFichaProps {
  /** O nome do item, no botão de voltar ("Saga"). */
  voltarPara: string
  onVoltar: (peloTeclado: boolean) => void
  icone: ReactNode
  titulo: string
  /** A linha de baixo ("Comportamento de Saga"). */
  tipo: string
  /** Aberta pelo teclado: entra parada, sem o deslize de lado. */
  instantanea?: boolean
  children: ReactNode
}

/**
 * Sub-ficha de um cartão (o `pagSubFicha` do protótipo): "‹ nome do item" no
 * alto, a cabeça do recurso e os campos num cartão plano. Ao abrir, o foco vai
 * ao voltar, o primeiro da folha nova; quem monta devolve o foco ao cartão
 * (`Cartao.focar`) quando volta.
 */
export function SubFicha({ voltarPara, onVoltar, icone, titulo, tipo, instantanea = false, children }: SubFichaProps) {
  const raiz = useRef<HTMLDivElement>(null)
  const voltar = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    voltar.current?.focus({ preventScroll: true })
    const folha = raiz.current
    if (instantanea || folha === null || typeof folha.animate !== 'function') return
    const reduzido = movimentoReduzido()
    folha.animate(
      reduzido ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: reduzido ? ENTRADA_REDUZIDA_MS : ENTRADA_DE_LADO_MS, easing: reduzido ? 'ease' : theme.gr.easeOut },
    )
    // Só ao montar: a folha entra uma vez.
  }, [])
  return (
    <div ref={raiz} className="gr-subficha">
      <button ref={voltar} type="button" className="gr-voltar-sub" aria-label={`Voltar para ${voltarPara}`} onClick={(evento) => onVoltar(evento.detail === 0)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        {voltarPara}
      </button>
      <Cabeca marca={<CabecaMedalha>{icone}</CabecaMedalha>} nome={titulo} tipo={tipo} comoTitulo />
      <div className="gr-ficha gr-ficha--plana">
        <div className="gr-ficha__dentro">{children}</div>
      </div>
    </div>
  )
}
