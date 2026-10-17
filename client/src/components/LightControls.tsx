import { useId, type ReactNode } from 'react'
import { useLivroDoMestreStore } from '../stores/livroDoMestreStore'
import type { Light } from '../types/map'
import { Toggle } from './Toggle'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { Essencial } from './grimorio/Cartoes'
import { Fichas } from './grimorio/Ficha'
import { Nota } from './grimorio/Nota'
import { FichaLembrada, type FichaLembradaProps } from './livro/FichaLembrada'
import './livro/fichaDoItem.css'

/** Ficha da cena que pode carregar a luz (tocha presa na ficha). */
export interface LightCarrierOption {
  id: string
  name: string
}

export interface LightControlsProps {
  color: string
  onColorChange: (color: string) => void
  intensity: number
  onIntensityChange: (intensity: number) => void
  /** Fichas da cena, na ordem do mapa. */
  tokens: LightCarrierOption[]
  /** Ficha que carrega esta luz; `null` = solta. */
  attachedTokenId: string | null
  onAttach: (tokenId: string) => void
  onDetach: () => void
  /** `Light.vistaDeLonge`. Sem `onVistaDeLongeChange` o interruptor não aparece. */
  vistaDeLonge?: boolean
  onVistaDeLongeChange?: (vistaDeLonge: boolean) => void
  /** "Depende do estado" (`EstadoDaLuz`): só com uma aventura aberta. */
  estado?: ReactNode
  /** `Light.porEstado`, a regra que o `EstadoDaLuz` edita: dá o resumo da ficha, como na porta. */
  porEstado?: Light['porEstado']
}

const FICHA_SEM_NOME = 'Ficha sem nome'

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-luz-'

function nomeDaFicha(ficha: LightCarrierOption): string {
  return ficha.name.trim() === '' ? FICHA_SEM_NOME : ficha.name
}

/** Ficha da luz com a escolha lembrada: vale para toda luz e entre sessões. */
function FichaDaLuzLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

/**
 * FICHA DA LUZ (fatia 16a do design consolidado; decisão 4.1: a gramática da
 * porta, sem perder controle): o essencial — Cor, Intensidade e Vista de longe
 * — e as fichas "Presa a uma ficha" e "Depende do estado". A primeira nasce
 * aberta: o "Prender na ficha" e o "Soltar" ficavam à vista, e a jornada da
 * tocha os usa logo depois de selecionar. Os controles e os handlers são os
 * de antes.
 *
 * O raio não tem campo aqui de propósito — é editado arrastando a alça
 * desenhada em `drawEditHandles.ts` diretamente sobre o círculo da luz no
 * canvas, mesmo padrão de "editar no lugar" usado por vértice de
 * Parede/Região/Curva. A nota do essencial diz isso ao mestre.
 *
 * "Prender na ficha" faz da luz uma tocha: ela vai para o centro da ficha
 * escolhida (`mapFactory.setLightAttachment`) e anda com ela quando o mestre
 * ou o jogador a movem.
 */
export function LightControls({
  color,
  onColorChange,
  intensity,
  onIntensityChange,
  tokens,
  attachedTokenId,
  onAttach,
  onDetach,
  vistaDeLonge,
  onVistaDeLongeChange,
  estado,
  porEstado,
}: LightControlsProps) {
  const farHintId = `${useId()}-vista-de-longe`
  // Vínculo com ficha que não está mais na cena conta como solta.
  const carrier = attachedTokenId === null ? undefined : tokens.find((t) => t.id === attachedTokenId)
  return (
    <section className="lb-ficha-da-luz">
      {/* O título que as jornadas procuram ("Luz"), só para o leitor de tela: a cabeça já diz o tipo. */}
      <h2 className="gr-sr">Luz</h2>
      <Essencial>
        <section className="lb-section">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-light-color">
              Cor
            </label>
            <CampoDeCorComPipeta id="lb-light-color" value={color} onChange={(cor) => onColorChange(cor)} />
          </div>
          <div className="lb-field">
            <div className="lb-section__row">
              <label className="lb-label" htmlFor="lb-light-intensity">
                Intensidade
              </label>
              <span className="lb-num">{Math.round(intensity * 100)}%</span>
            </div>
            <input
              id="lb-light-intensity"
              className="lb-range"
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={intensity}
              onChange={(event) => onIntensityChange(Number(event.target.value))}
            />
          </div>
          {onVistaDeLongeChange !== undefined && (
            <>
              <Toggle label="Vista de longe" checked={vistaDeLonge === true} onChange={onVistaDeLongeChange} describedBy={farHintId} />
              <p className="lb-field__hint" id={farHintId}>
                Quem tem linha de visão até ela vê um ponto aceso, mesmo longe. O que ela ilumina continua escondido.
              </p>
            </>
          )}
        </section>
        <Nota>O raio se ajusta no mapa: arraste a alça do círculo da luz.</Nota>
      </Essencial>
      <Fichas>
        <FichaDaLuzLembrada id="presa" titulo="Presa a uma ficha" icone="elo" padrao resumo={carrier === undefined ? 'Solta' : nomeDaFicha(carrier)}>
          <section className="lb-section">
            <div className="lb-field">
              <label className="lb-label" htmlFor="lb-light-carrier">
                Prender na ficha
              </label>
              <select
                id="lb-light-carrier"
                className="lb-input"
                value={carrier?.id ?? ''}
                disabled={tokens.length === 0 && carrier === undefined}
                onChange={(event) => {
                  const tokenId = event.target.value
                  if (tokenId === '') onDetach()
                  else onAttach(tokenId)
                }}
              >
                <option value="">{tokens.length === 0 ? 'Nenhuma ficha na cena' : 'Nenhuma (luz parada)'}</option>
                {tokens.map((t) => (
                  <option key={t.id} value={t.id}>
                    {nomeDaFicha(t)}
                  </option>
                ))}
              </select>
              {carrier !== undefined && (
                <div className="lb-section__row">
                  <span className="lb-label">Vai junto com {nomeDaFicha(carrier)}</span>
                  <button type="button" className="lb-btn lb-btn--ghost" onClick={onDetach}>
                    Soltar
                  </button>
                </div>
              )}
            </div>
          </section>
        </FichaDaLuzLembrada>
        {estado !== undefined && (
          <FichaDaLuzLembrada id="estado" titulo="Depende do estado" icone="pulso" padrao={false} resumo={porEstado === undefined ? 'Sempre' : 'Muda com o estado'}>
            {estado}
            <Nota ir={{ rotulo: 'Ir para Aventura', onClick: (evento) => useLivroDoMestreStore.getState().abrirPagina('aventura', evento.detail > 0) }}>
              Os valores vêm do Estado do mundo, no marcador Aventura.
            </Nota>
          </FichaDaLuzLembrada>
        )}
      </Fichas>
    </section>
  )
}
