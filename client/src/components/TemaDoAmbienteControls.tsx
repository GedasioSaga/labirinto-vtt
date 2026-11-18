import { useId } from 'react'
import { TEMAS_DO_AMBIENTE, corEForcaDoTema, temaPronto, type EscolhaDoTema } from '../lib/temasDoAmbiente'
import { useTintaNoEditor } from '../stores/tintaNoEditor'
import { andarPelosRadios } from './grimorio/comum'
import { Toggle } from './Toggle'

export interface TemaDoAmbienteControlsProps {
  /** O tema do mapa; ausente = Normal (o período manda). */
  tema: EscolhaDoTema | undefined
  /** `juntar`: a mesma chave em passos seguidos (o arrasto da força, da cor) é UM Ctrl+Z. */
  onTemaChange: (tema: EscolhaDoTema | undefined, juntar?: string) => void
}

const PASSO_DA_FORCA = 0.05
const JUNTAR_FORCA = 'tema:forca'
const JUNTAR_COR = 'tema:cor'

/** No mapa o tema aparece pela metade, como a tarde e a noite. */
const VER_COMO_JOGADOR_DICA = 'No seu mapa o tema aparece pela metade. Ligado, você vê a cor inteira, como os jogadores veem.'

function porcento(forca: number): string {
  return `${Math.round(forca * 100)}%`
}

/**
 * TEMA DO AMBIENTE do mapa (pedido do mestre de 17/11/2026), na seção
 * "Ambiente" de Configurar: os cinco temas prontos e, fora do Normal, a cor e
 * a força. O tema substitui a cor da tarde e da noite neste mapa; cada piso
 * pode ter o seu na barra dos pisos (`PisoHud`). Cada mudança vai ao mapa na
 * hora e entra no Ctrl+Z (o App grava, `definirTemaDoMapa`).
 *
 * A cor é a amostra nativa sem a pipeta: a janela cobre o mapa, e o
 * conta-gotas pede um clique nele.
 */
export function TemaDoAmbienteControls({ tema, onTemaChange }: TemaDoAmbienteControlsProps) {
  const id = useId()
  const rotuloId = `${id}-tema`
  const dicaId = `${id}-dica`
  const corId = `${id}-cor`
  const forcaId = `${id}-forca`
  const comoJogadorDicaId = `${id}-como-jogador`
  const comoJogador = useTintaNoEditor((estado) => estado.comoJogador)
  const setComoJogador = useTintaNoEditor((estado) => estado.setComoJogador)

  const escolhido = tema?.id ?? 'normal'
  const pronto = temaPronto(escolhido)
  const ajustado = tema !== undefined && (tema.cor !== undefined || tema.forca !== undefined)
  const { cor, forca } = tema === undefined ? { cor: pronto.cor, forca: pronto.forca } : corEForcaDoTema(tema)

  return (
    <div className="lb-ambiente">
      <div className="lb-field">
        <span className="lb-label" id={rotuloId}>
          Tema
        </span>
        <div className="lb-seg" role="radiogroup" aria-labelledby={rotuloId} aria-describedby={dicaId} onKeyDown={andarPelosRadios}>
          {TEMAS_DO_AMBIENTE.map((opcao) => (
            <button
              key={opcao.id}
              type="button"
              role="radio"
              aria-checked={escolhido === opcao.id}
              tabIndex={escolhido === opcao.id ? 0 : -1}
              className="lb-seg__option"
              title={opcao.dica}
              onClick={() => onTemaChange(opcao.id === 'normal' ? undefined : { id: opcao.id })}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
        {/* `status`: trocar o tema muda a frase, e o leitor de tela a lê sem roubar o foco. */}
        <p id={dicaId} className="lb-field__hint" role="status">
          {pronto.dica}
        </p>
      </div>

      {tema !== undefined && escolhido !== 'normal' && (
        <div className="lb-ambiente__grupo">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor={corId}>
              Cor
            </label>
            <input id={corId} className="lb-swatch" type="color" value={cor} onChange={(event) => onTemaChange({ ...tema, cor: event.target.value }, JUNTAR_COR)} />
          </div>

          <div className="lb-field">
            <div className="lb-section__row">
              <label className="lb-label" htmlFor={forcaId}>
                Força
              </label>
              <span className="lb-num">{porcento(forca)}</span>
            </div>
            <input
              id={forcaId}
              className="lb-range"
              type="range"
              min={0}
              max={1}
              step={PASSO_DA_FORCA}
              value={forca}
              aria-valuetext={porcento(forca)}
              onChange={(event) => onTemaChange({ ...tema, forca: Number(event.target.value) }, JUNTAR_FORCA)}
            />
          </div>

          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={!ajustado} onClick={() => onTemaChange({ id: tema.id })}>
            Voltar ao padrão do tema
          </button>
        </div>
      )}

      <div className="lb-ambiente__grupo">
        <Toggle label="Ver como jogador" checked={comoJogador} describedBy={comoJogadorDicaId} onChange={setComoJogador} />
        <p id={comoJogadorDicaId} className="lb-field__hint">
          {VER_COMO_JOGADOR_DICA} Só a cor muda: a visão dos jogadores fica igual, e as luzes do mapa continuam acendendo. Cada piso pode ter o seu tema na barra dos pisos, ao lado da Altura.
        </p>
      </div>
    </div>
  )
}
