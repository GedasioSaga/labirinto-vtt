import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { VIDA_INFINITA, type AjustesDoBoneco as Ajustes, type ContaDoPlacar } from '../../lib/arena/tipos'
import { formatarNumero } from '../livros/comum'
import { AjustesDoBoneco } from './AjustesDoBoneco'

/**
 * O PLACAR DO JUDGE-BONECO (docs/planos/batalha-arena-de-testes-plano.md
 * §4.4, decisão 2 do usuário): o dano total em destaque, a média por rodada
 * (total dividido pelas rodadas que contam: as completas, as em que errou
 * inclusive, e a atual só depois que um golpe dela entrou) e cada
 * golpe, do mais novo para o mais velho: rodada, quem bateu, o golpe e a conta
 * Escudo + HP. Só mostra: a conta vem pronta (`placarDoBoneco`), e o Desfazer
 * do registro tira o golpe daqui sozinho.
 *
 * "Ajustar" abre os ajustes do boneco num popover preso ao placar; o menu da
 * carta do Judge na faixa também o abre (por isso é controlado de fora).
 */

export interface PlacarDoBonecoProps {
  conta: ContaDoPlacar
  boneco: Ajustes
  onAjustar: (ajuste: Partial<Ajustes>) => void
  comEscudo: boolean
  comVida: boolean
  ajustesAbertos: boolean
  onAjustesAbertos: (abertos: boolean) => void
}

const MEDIA = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

/** "HP ∞ · Escudo 100 · d20 +5": o boneco de agora numa linha. */
function resumoDoBoneco(boneco: Ajustes, comEscudo: boolean, comVida: boolean): string {
  const partes: string[] = []
  if (comVida) partes.push(boneco.infinito || boneco.hp >= VIDA_INFINITA ? 'HP ∞' : `HP ${formatarNumero(boneco.hp)}`)
  if (comEscudo) partes.push(`Escudo ${formatarNumero(boneco.escudo)}`)
  if (boneco.reage === 'parado') partes.push('parado')
  else partes.push(boneco.modificador === 0 ? 'd20' : `d20 ${boneco.modificador > 0 ? '+' : '−'}${Math.abs(boneco.modificador)}`)
  return partes.join(' · ')
}

/** O popover dos ajustes: foco no primeiro campo ao abrir, Esc e clique fora fecham, o foco volta ao "Ajustar". */
interface PopoverDosAjustesProps {
  id: string
  rotuloId: string
  gatilho: RefObject<HTMLButtonElement | null>
  onFechar: () => void
  children: ReactNode
}

function PopoverDosAjustes({ id, rotuloId, gatilho, onFechar, children }: PopoverDosAjustesProps) {
  const caixa = useRef<HTMLDivElement>(null)
  const fechar = useRef(onFechar)
  fechar.current = onFechar

  useEffect(() => {
    const raiz = caixa.current
    raiz?.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)')?.focus()
    const aoApertar = (evento: PointerEvent) => {
      const alvo = evento.target as Node | null
      if (alvo === null || raiz?.contains(alvo) || gatilho.current?.contains(alvo)) return
      fechar.current()
    }
    document.addEventListener('pointerdown', aoApertar, true)
    return () => document.removeEventListener('pointerdown', aoApertar, true)
  }, [gatilho])

  return (
    <div
      ref={caixa}
      id={id}
      className="ar-pop"
      role="dialog"
      aria-labelledby={rotuloId}
      onKeyDown={(evento) => {
        if (evento.key !== 'Escape') return
        evento.preventDefault()
        evento.stopPropagation()
        fechar.current()
        gatilho.current?.focus()
      }}
    >
      {children}
    </div>
  )
}

export function PlacarDoBoneco({ conta, boneco, onAjustar, comEscudo, comVida, ajustesAbertos, onAjustesAbertos }: PlacarDoBonecoProps) {
  const tituloId = useId()
  const popId = useId()
  const ajustar = useRef<HTMLButtonElement>(null)
  const golpes = [...conta.golpes].reverse()

  return (
    <section className="ar-placar" aria-labelledby={tituloId}>
      <header className="ar-placar__cab">
        <div className="ar-placar__cab-txt">
          <h2 className="ar-placar__tit" id={tituloId}>
            Placar do Judge
          </h2>
          <p className="ar-placar__resumo">{resumoDoBoneco(boneco, comEscudo, comVida)}</p>
        </div>
        <button
          ref={ajustar}
          type="button"
          className="mu-bt mu-bt--p mu-bt--latao"
          aria-expanded={ajustesAbertos}
          aria-controls={ajustesAbertos ? popId : undefined}
          onClick={() => onAjustesAbertos(!ajustesAbertos)}
        >
          Ajustar
        </button>
      </header>

      <dl className="ar-placar__numeros">
        <div className="ar-placar__total">
          <dt>Dano total</dt>
          <dd key={conta.total} className="ar-placar__grande">
            {formatarNumero(conta.total)}
          </dd>
        </div>
        <div className="ar-placar__media">
          <dt>Média por rodada</dt>
          <dd className="ar-placar__medio">{MEDIA.format(conta.mediaPorRodada)}</dd>
          <dd className="ar-placar__div">
            {formatarNumero(conta.total)} em {conta.rodadas} {conta.rodadas === 1 ? 'rodada' : 'rodadas'}
          </dd>
        </div>
      </dl>

      {golpes.length === 0 ? (
        <p className="ar-placar__vazio">Nenhum golpe no Judge ainda. Na vez de uma ficha, escolha Atacar e mire nele.</p>
      ) : (
        <ol className="ar-placar__golpes" aria-label="Golpes no Judge, do mais novo para o mais velho">
          {golpes.map((golpe) => (
            <li key={golpe.linhaId} className="ar-golpe">
              <span className="ar-golpe__rodada" aria-label={`Rodada ${golpe.rodada}`}>
                R{golpe.rodada}
              </span>
              <span className="ar-golpe__quem">
                <span className="ar-golpe__nome">{golpe.atacante}</span>
                <span className="ar-golpe__golpe">{golpe.golpe}</span>
              </span>
              <span className="ar-golpe__conta">
                {comEscudo && golpe.escudo > 0 ? (
                  <>
                    <span className="ar-golpe__parte">Escudo {formatarNumero(golpe.escudo)}</span>
                    <span className="ar-golpe__parte">+ HP {formatarNumero(golpe.hp)}</span>
                  </>
                ) : (
                  <span className="ar-golpe__parte">HP {formatarNumero(golpe.hp)}</span>
                )}
              </span>
              <b className="ar-golpe__total">{formatarNumero(golpe.total)}</b>
            </li>
          ))}
        </ol>
      )}

      {ajustesAbertos && (
        <PopoverDosAjustes id={popId} rotuloId={`${popId}-tit`} gatilho={ajustar} onFechar={() => onAjustesAbertos(false)}>
          <h3 className="ar-pop__tit" id={`${popId}-tit`}>
            Ajustes do Judge
          </h3>
          <AjustesDoBoneco valor={boneco} onAjustar={onAjustar} comEscudo={comEscudo} comVida={comVida} momento="luta" />
        </PopoverDosAjustes>
      )}
    </section>
  )
}
