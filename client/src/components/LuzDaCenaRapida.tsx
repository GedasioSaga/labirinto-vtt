import { useEffect, useId, useRef } from 'react'
import type { MapData, Periodo, QuantidadeDeParticulas } from '../types/map'
import { ambienteNoEscuro, PASSO_DO_ESCURO } from '../lib/luzDaCena'
import { EFEITOS_DE_PARTICULA, QUANTIDADES_DE_PARTICULAS, type EfeitoDeParticula } from '../lib/particulasDaCena'
import { PERIODOS, ambienteDoPeriodo, lerPeriodo, periodoDaCena } from '../lib/periodo'
import { TOOL_SHORTCUTS } from '../lib/keymap'
import { periodoDaSessao, useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { useTintaNoEditor } from '../stores/tintaNoEditor'
import { PERIODO_LABEL } from './PeriodoDaSessaoSection'
import { Toggle } from './Toggle'
import type { ComSaidaFilho } from './grimorio/ComSaida'
import { andarPelosRadios } from './grimorio/comum'
import './LuzDaCenaRapida.css'

export interface LuzDaCenaRapidaProps extends ComSaidaFilho {
  /** Fecha o balão (Escape). */
  onClose: () => void
  /** Arma a ferramenta de pôr um ponto de luz no mapa (a de sempre, tecla H). */
  onPorLuz: () => void
}

/** Sem outra mudança por este tempo, o arrasto da força vira UM passo do Ctrl+Z (o mesmo prazo dos controles do painel). */
const FIM_DO_ARRASTO_MS = 400

const FRASE_DO_PERIODO: Readonly<Record<Periodo, string>> = {
  dia: 'Esta cena fica de dia. Os jogadores veem o mapa claro.',
  tarde: 'Esta cena fica à tarde. O fogo e as luzes clareiam um pouco.',
  noite: 'Esta cena fica à noite. Longe do fogo e das luzes fica escuro.',
}

const ROTULO_DO_EFEITO: Readonly<Record<EfeitoDeParticula, string>> = { fumaca: 'Fumaça preta', brasas: 'Brasas' }
const ROTULO_DA_QUANTIDADE: Readonly<Record<QuantidadeDeParticulas, string>> = { pouca: 'Pouca', media: 'Média', muita: 'Muita' }
/** As escolhas de cada efeito: desligado (`null`) e as três quantidades. */
const ESCOLHAS_DO_EFEITO: readonly (QuantidadeDeParticulas | null)[] = [null, ...QUANTIDADES_DE_PARTICULAS]

function porcento(forca: number): string {
  return `${Math.round(forca * 100)}%`
}

/**
 * O arrasto do controle deslizante anda ao vivo no mapa e vira um passo só do
 * desfazer quando para (ou quando o balão fecha no meio).
 */
function useArrastoComUmPasso(): (aplicar: () => void) => void {
  const antes = useRef<MapData | null>(null)
  const relogio = useRef<number | null>(null)
  const fechar = () => {
    if (relogio.current !== null) window.clearTimeout(relogio.current)
    relogio.current = null
    const mapaDeAntes = antes.current
    antes.current = null
    if (mapaDeAntes !== null) useMapStore.getState().commitDragHistory(mapaDeAntes)
  }
  useEffect(() => fechar, [])
  return (aplicar) => {
    if (antes.current === null) antes.current = useMapStore.getState().map
    if (relogio.current !== null) window.clearTimeout(relogio.current)
    aplicar()
    relogio.current = window.setTimeout(fechar, FIM_DO_ARRASTO_MS)
  }
}

/**
 * LUZ DA CENA (pedido do mestre de 09/11/2026): o que o botão do sol da barra
 * abre. Dia, Tarde ou Noite e a força do escuro DESTA cena, com efeito na hora
 * no mapa do mestre e na tela de todos os jogadores, guardados na cena
 * (`periodoFixo` e `ambientePorPeriodo`, os campos de sempre da Luz).
 *
 * É o controle rápido; o ajuste fino (cor, visão em casas, atalhos da noite)
 * continua na ficha "Ambiente da cena" da página Cena. Lê e grava direto nas
 * lojas, como a `Toolbar` que o hospeda.
 *
 * EFEITOS (mesmo pedido: "partículas de fumaça preta e brasas"): a quantidade
 * de cada efeito da cena, guardada em `MapData.particulas`
 * (`lib/particulasDaCena.ts`).
 */
export function LuzDaCenaRapida({ onClose, onPorLuz, saindo }: LuzDaCenaRapidaProps) {
  const id = useId()
  const tituloId = `${id}-titulo`
  const fraseId = `${id}-frase`
  const forcaId = `${id}-forca`
  const forcaDicaId = `${id}-forca-dica`
  const verId = `${id}-ver`
  const efeitosDicaId = `${id}-efeitos-dica`
  const raiz = useRef<HTMLDivElement>(null)

  const externa = useMapStore((s) => s.map.externa)
  const periodoFixo = useMapStore((s) => s.map.periodoFixo)
  const ambientePorPeriodo = useMapStore((s) => s.map.ambientePorPeriodo)
  const particulas = useMapStore((s) => s.map.particulas)
  const sessao = useAdventureStore(periodoDaSessao)
  const comoJogador = useTintaNoEditor((estado) => estado.comoJogador)
  const setComoJogador = useTintaNoEditor((estado) => estado.setComoJogador)
  const arrastar = useArrastoComUmPasso()

  // Abriu pelo botão: o foco entra no balão, para as setas valerem aqui.
  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]')?.focus()
  }, [])

  // O Escape fecha o balão onde quer que o foco esteja (o mestre abre, clica num
  // campo do painel e aperta Esc). Na captura do documento: o Escape é deste
  // balão enquanto ele está aberto, e não fecha nem cancela mais nada por baixo.
  useEffect(() => {
    if (saindo) return
    const aoApertar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', aoApertar, true)
    return () => document.removeEventListener('keydown', aoApertar, true)
  }, [onClose, saindo])

  const cena = { externa, periodoFixo, ambientePorPeriodo }
  const periodo = periodoDaCena(cena, sessao)
  const segueASessao = lerPeriodo(periodoFixo) === undefined
  const ambiente = periodo === 'dia' ? null : ambienteDoPeriodo(cena, periodo)

  const mudarForca = (forca: number) => {
    if (periodo === 'dia') return
    arrastar(() => useMapStore.getState().setAmbienteDaCenaLive(periodo, ambienteNoEscuro(periodo, forca, ambienteDoPeriodo(useMapStore.getState().map, periodo))))
  }

  return (
    <div
      ref={raiz}
      className={`lb-panel lb-scroll lb-toolvariant-menu lb-luz-da-cena gr-anima${saindo ? ' gr-sai' : ''}`}
      inert={saindo}
      role="dialog"
      aria-labelledby={tituloId}
    >
      <h3 id={tituloId} className="lb-eyebrow">
        Luz da cena
      </h3>

      <div className="lb-field">
        <div className="lb-seg" role="radiogroup" aria-labelledby={tituloId} aria-describedby={fraseId} onKeyDown={andarPelosRadios}>
          {PERIODOS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="radio"
              aria-checked={periodo === opcao}
              tabIndex={periodo === opcao ? 0 : -1}
              className="lb-seg__option"
              onClick={() => useMapStore.getState().setPeriodoFixo(opcao)}
            >
              {PERIODO_LABEL[opcao]}
            </button>
          ))}
        </div>
        {/* `status`: trocar o período muda a frase, e o leitor de tela a lê sem roubar o foco. */}
        <p id={fraseId} className="lb-field__hint" role="status">
          {FRASE_DO_PERIODO[periodo]}
          {segueASessao && externa === true ? ' Ela segue o período do Grupo até você escolher um aqui.' : ''}
        </p>
      </div>

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor={forcaId}>
            Força do escuro
          </label>
          <span className="lb-num">{ambiente === null ? '0%' : porcento(ambiente.forca)}</span>
        </div>
        <input
          id={forcaId}
          className="lb-range"
          type="range"
          min={0}
          max={1}
          step={PASSO_DO_ESCURO}
          disabled={ambiente === null}
          value={ambiente === null ? 0 : ambiente.forca}
          aria-valuetext={ambiente === null ? 'Sem escuro' : porcento(ambiente.forca)}
          aria-describedby={forcaDicaId}
          onChange={(event) => mudarForca(Number(event.target.value))}
        />
        <p id={forcaDicaId} className="lb-field__hint">
          {ambiente === null ? 'De dia não há escuro. Escolha Tarde ou Noite para ajustar.' : 'Em 100% fica breu: só o fogo e as luzes clareiam.'}
        </p>
      </div>

      <div className="lb-field">
        <Toggle label="Ver como jogador" checked={comoJogador} describedBy={verId} onChange={setComoJogador} />
        <p id={verId} className="lb-field__hint">
          Você vê o escuro pela metade, para enxergar o mapa. Ligado, vê igual aos jogadores.
        </p>
      </div>

      <div className="lb-luz-da-cena__efeitos">
        <h3 className="lb-eyebrow">Efeitos</h3>
        {EFEITOS_DE_PARTICULA.map((efeito) => {
          const atual = particulas?.[efeito] ?? null
          const rotuloId = `${id}-${efeito}`
          return (
            <div className="lb-field" key={efeito}>
              <span className="lb-label" id={rotuloId}>
                {ROTULO_DO_EFEITO[efeito]}
              </span>
              <div className="lb-seg" role="radiogroup" aria-labelledby={rotuloId} aria-describedby={efeitosDicaId} onKeyDown={andarPelosRadios}>
                {ESCOLHAS_DO_EFEITO.map((quantidade) => (
                  <button
                    key={quantidade ?? 'nao'}
                    type="button"
                    role="radio"
                    aria-checked={atual === quantidade}
                    tabIndex={atual === quantidade ? 0 : -1}
                    className="lb-seg__option"
                    onClick={() => useMapStore.getState().setParticulasDaCena(efeito, quantidade)}
                  >
                    {quantidade === null ? 'Não' : ROTULO_DA_QUANTIDADE[quantidade]}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        <p id={efeitosDicaId} className="lb-field__hint">
          Sobem dos fogos do mapa, para você e para os jogadores. Sem fogo na cena, aparecem espalhadas.
        </p>
      </div>

      <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact lb-luz-da-cena__por-luz" onClick={onPorLuz}>
        <span>Pôr uma luz no mapa</span>
        <kbd className="gr-kbd">{TOOL_SHORTCUTS.light}</kbd>
      </button>
    </div>
  )
}
