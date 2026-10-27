import { useEffect, useId, useState } from 'react'
import type { MapData, Periodo } from '../types/map'
import {
  ATALHOS_DA_NOITE,
  PERIODOS,
  PERIODOS_AJUSTAVEIS,
  ambienteDoPeriodo,
  atalhoDaNoiteAtual,
  lerPeriodo,
  periodoAjustado,
  periodoDaCena,
  visaoDoPeriodo,
  type IdDoAtalhoDaNoite,
  type PeriodoConfiguravel,
} from '../lib/periodo'
import { SCENE_VISION_CELLS_MAX } from '../lib/sceneVision'
import { useTintaNoEditor } from '../stores/tintaNoEditor'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { PERIODO_LABEL, VER_COMO_JOGADOR_HINT, estadoDaCenaAberta } from './PeriodoDaSessaoSection'
import { Toggle } from './Toggle'
import { andarPelosRadios } from './grimorio/comum'

/** O que o painel lê da cena aberta (tudo opcional: cena sem nada é interior, no padrão). */
export type CenaDoAmbiente = Pick<MapData, 'externa' | 'periodoFixo' | 'ambientePorPeriodo' | 'visaoPorPeriodo'>

export interface AmbienteDaCenaControlsProps {
  /** O período da sessão (o da aventura; no mapa solto, o da sessão). */
  periodoDaSessao: Periodo
  cena: CenaDoAmbiente
  onPeriodoFixoChange: (periodo: Periodo | undefined) => void
  onCorChange: (periodo: PeriodoConfiguravel, cor: string) => void
  /** Chamado a cada passo do arrasto: quem grava emenda os passos num Ctrl+Z só. */
  onForcaChange: (periodo: PeriodoConfiguravel, forca: number) => void
  /** `undefined` = sem valor (a regra de sempre). */
  onVisaoChange: (periodo: PeriodoConfiguravel, casas: number | undefined) => void
  onAtalho: (id: IdDoAtalhoDaNoite) => void
  onPadrao: (periodo: PeriodoConfiguravel) => void
}

const PASSO_DA_FORCA = 0.05

/** "Nenhum" no segmentado do período fixo: a cena segue a regra (externa ou interior). */
const SEM_FIXO = 'nenhum'
type EscolhaDoFixo = Periodo | typeof SEM_FIXO
const ESCOLHAS_DO_FIXO: readonly { valor: EscolhaDoFixo; rotulo: string }[] = [
  { valor: SEM_FIXO, rotulo: 'Nenhum' },
  ...PERIODOS.map((periodo) => ({ valor: periodo, rotulo: PERIODO_LABEL[periodo] })),
]

/** Sem valor na visão do período: o que vale (a regra da L2). */
const VISAO_SEM_VALOR: Record<PeriodoConfiguravel, string> = {
  tarde: 'Vazio: a visão de sempre. 0: o jogador não enxerga nada à tarde.',
  noite: 'Vazio: metade da visão da cena. 0: o jogador não enxerga nada, nem o claro dos lampiões.',
}
const PLACEHOLDER_DA_VISAO: Record<PeriodoConfiguravel, string> = { tarde: 'A de sempre', noite: 'Metade' }
const NA_FRASE: Record<PeriodoConfiguravel, string> = { tarde: 'a tarde', noite: 'a noite' }

function porcento(forca: number): string {
  return `${Math.round(forca * 100)}%`
}

/** O que a ficha fechada diz: o atalho com que a noite casa (ou a força dela) e o período fixo. */
export function resumoDoAmbiente(cena: CenaDoAmbiente): string {
  const atalho = ATALHOS_DA_NOITE.find((a) => a.id === atalhoDaNoiteAtual(cena))
  const noite = atalho?.rotulo ?? `Noite ${porcento(ambienteDoPeriodo(cena, 'noite').forca)}`
  const fixo = lerPeriodo(cena.periodoFixo)
  return fixo === undefined ? noite : `${noite}, sempre ${fixo === 'dia' ? 'de dia' : fixo === 'tarde' ? 'à tarde' : 'à noite'}`
}

/** O período que o painel abre ajustando: o da cena se for tarde ou noite; senão a noite, a que mais se mexe. */
function periodoInicial(cena: CenaDoAmbiente, sessao: Periodo): PeriodoConfiguravel {
  const agora = periodoDaCena(cena, sessao)
  return agora === 'dia' ? 'noite' : agora
}

/**
 * AMBIENTE DA CENA (Luz L4c, pedido D7 do usuário): como esta cena fica à
 * tarde e à noite. Em cima, o período fixo da cena (item (e) da L1) com a
 * frase do que ela mostra agora; no meio, Tarde ou Noite com cor, força e
 * visão em casas (e os atalhos da noite); embaixo, o que só o editor vê: a
 * prévia do período no mapa e "Ver como jogador" (o mesmo do painel Período).
 *
 * Os controles são os do painel de sempre (segmentado, amostra de cor com
 * pipeta, deslizante de `lb-range`, campo de número, interruptor). Cada
 * mudança vai ao mapa na hora e entra no Ctrl+Z (o App grava; ver
 * `stores/mapStore.ts`, "AMBIENTE DA CENA").
 */
export function AmbienteDaCenaControls({ periodoDaSessao, cena, onPeriodoFixoChange, onCorChange, onForcaChange, onVisaoChange, onAtalho, onPadrao }: AmbienteDaCenaControlsProps) {
  const id = useId()
  const estadoId = `${id}-estado`
  const corId = `${id}-cor`
  const forcaId = `${id}-forca`
  const visaoId = `${id}-visao`
  const visaoDicaId = `${id}-visao-dica`
  const atalhosId = `${id}-atalhos`
  const atalhosDicaId = `${id}-atalhos-dica`
  const previaDicaId = `${id}-previa-dica`
  const comoJogadorDicaId = `${id}-como-jogador-dica`

  const [ajustando, setAjustando] = useState<PeriodoConfiguravel>(() => periodoInicial(cena, periodoDaSessao))
  const previa = useTintaNoEditor((estado) => estado.previa)
  const setPrevia = useTintaNoEditor((estado) => estado.setPrevia)
  const comoJogador = useTintaNoEditor((estado) => estado.comoJogador)
  const setComoJogador = useTintaNoEditor((estado) => estado.setComoJogador)
  const previaLigada = previa !== null

  // A prévia é deste painel: fechou a ficha ou saiu da página, o mapa volta ao período de verdade.
  useEffect(() => () => useTintaNoEditor.getState().setPrevia(null), [])

  const escolherAjuste = (periodo: PeriodoConfiguravel) => {
    setAjustando(periodo)
    if (previaLigada) setPrevia(periodo)
  }

  const fixo = lerPeriodo(cena.periodoFixo)
  const escolhaDoFixo: EscolhaDoFixo = fixo ?? SEM_FIXO
  const ambiente = ambienteDoPeriodo(cena, ajustando)
  const visao = visaoDoPeriodo(cena, ajustando)
  const atalhoAtual = atalhoDaNoiteAtual(cena)
  const dicaDoAtalho = ATALHOS_DA_NOITE.find((a) => a.id === atalhoAtual)?.dica ?? 'Um clique ajusta cor, força e visão da noite de uma vez.'

  function mudarVisao(texto: string) {
    if (texto.trim() === '') {
      onVisaoChange(ajustando, undefined)
      return
    }
    // Fora da faixa (fração, negativo, acima do teto) não grava: o campo volta ao valor que vale.
    const casas = Number(texto)
    if (Number.isInteger(casas) && casas >= 0 && casas <= SCENE_VISION_CELLS_MAX) onVisaoChange(ajustando, casas)
  }

  return (
    <div className="lb-ambiente">
      <div className="lb-field">
        <span className="lb-label" aria-hidden="true">
          Período fixo
        </span>
        <div className="lb-seg" role="radiogroup" aria-label="Período fixo" aria-describedby={estadoId} onKeyDown={andarPelosRadios}>
          {ESCOLHAS_DO_FIXO.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              role="radio"
              aria-checked={escolhaDoFixo === opcao.valor}
              tabIndex={escolhaDoFixo === opcao.valor ? 0 : -1}
              className="lb-seg__option"
              onClick={() => onPeriodoFixoChange(opcao.valor === SEM_FIXO ? undefined : opcao.valor)}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        {/* `status`: trocar o fixo muda a frase, e o leitor de tela a lê sem roubar o foco. */}
        <p id={estadoId} className="lb-field__hint" role="status">
          {estadoDaCenaAberta(periodoDaSessao, cena.externa === true, fixo)}
        </p>
      </div>

      <div className="lb-ambiente__grupo">
        <div className="lb-field">
          <span className="lb-label" aria-hidden="true">
            Ajustar
          </span>
          <div className="lb-seg" role="radiogroup" aria-label="Ajustar" onKeyDown={andarPelosRadios}>
            {PERIODOS_AJUSTAVEIS.map((periodo) => (
              <button
                key={periodo}
                type="button"
                role="radio"
                aria-checked={ajustando === periodo}
                tabIndex={ajustando === periodo ? 0 : -1}
                className="lb-seg__option"
                onClick={() => escolherAjuste(periodo)}
              >
                {PERIODO_LABEL[periodo]}
              </button>
            ))}
          </div>
        </div>

        {ajustando === 'noite' && (
          <div className="lb-field">
            <span className="lb-label" id={atalhosId}>
              Atalhos da noite
            </span>
            <div className="lb-seg" role="group" aria-labelledby={atalhosId} aria-describedby={atalhosDicaId}>
              {ATALHOS_DA_NOITE.map((atalho) => (
                <button key={atalho.id} type="button" className="lb-seg__option" aria-pressed={atalhoAtual === atalho.id} title={atalho.dica} onClick={() => onAtalho(atalho.id)}>
                  {atalho.rotulo}
                </button>
              ))}
            </div>
            <p className="lb-field__hint" id={atalhosDicaId}>
              {dicaDoAtalho}
            </p>
          </div>
        )}

        <div className="lb-section__row">
          <label className="lb-label" htmlFor={corId}>
            Cor
          </label>
          <CampoDeCorComPipeta id={corId} value={ambiente.cor} rotuloDaPipeta={`Pegar do mapa a cor d${NA_FRASE[ajustando]}`} onChange={(cor) => onCorChange(ajustando, cor)} />
        </div>

        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor={forcaId}>
              Força
            </label>
            <span className="lb-num">{porcento(ambiente.forca)}</span>
          </div>
          <input
            id={forcaId}
            className="lb-range"
            type="range"
            min={0}
            max={1}
            step={PASSO_DA_FORCA}
            value={ambiente.forca}
            aria-valuetext={porcento(ambiente.forca)}
            onChange={(event) => onForcaChange(ajustando, Number(event.target.value))}
          />
        </div>

        <div className="lb-field">
          <label className="lb-label" htmlFor={visaoId}>
            Visão (casas)
          </label>
          <input
            id={visaoId}
            className="lb-input"
            type="number"
            inputMode="numeric"
            min={0}
            max={SCENE_VISION_CELLS_MAX}
            step={1}
            placeholder={PLACEHOLDER_DA_VISAO[ajustando]}
            value={visao ?? ''}
            aria-describedby={visaoDicaId}
            onChange={(event) => mudarVisao(event.target.value)}
          />
          <p id={visaoDicaId} className="lb-field__hint">
            {VISAO_SEM_VALOR[ajustando]} Nunca passa da visão de dia.
          </p>
        </div>

        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={!periodoAjustado(cena, ajustando)} onClick={() => onPadrao(ajustando)}>
          Voltar ao padrão
        </button>
      </div>

      <div className="lb-ambiente__grupo">
        <Toggle label="Prévia no mapa" checked={previaLigada} describedBy={previaDicaId} onChange={(ligada) => setPrevia(ligada ? ajustando : null)} />
        <p id={previaDicaId} className="lb-field__hint">
          {previaLigada ? `O seu mapa mostra ${NA_FRASE[ajustando]} desta cena.` : `Mostra ${NA_FRASE[ajustando]} no seu mapa, agora.`} Só no seu editor: os jogadores não recebem a prévia.
        </p>
        <Toggle label="Ver como jogador" checked={comoJogador} describedBy={comoJogadorDicaId} onChange={setComoJogador} />
        <p id={comoJogadorDicaId} className="lb-field__hint">
          {VER_COMO_JOGADOR_HINT}
        </p>
      </div>
    </div>
  )
}
