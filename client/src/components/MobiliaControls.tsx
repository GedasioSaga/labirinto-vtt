import { useId } from 'react'
import {
  ROTULO_MOBILIA,
  ROTULO_VISTA,
  TIPOS_MOBILIA,
  VISTAS_MOBILIA,
  aceitaVista,
  ehTipoMobilia,
  normalizarCorDoMovel,
  vistaDoMovel,
  type AparenciaDoMovelPatch,
} from '../lib/mobilia'
import { PROP_SILHOUETTE_EDGE_COLOR, PROP_SILHOUETTE_FILL_COLOR } from '../pixi/drawPropSilhouettes'
import type { Prop, TipoMobilia, VistaMobilia } from '../types/map'
import { Toggle } from './Toggle'
import './MobiliaControls.css'

function hexDaCor(cor: number): string {
  return `#${cor.toString(16).padStart(6, '0')}`
}

/**
 * O que cada seletor mostra enquanto o móvel não tem cor própria: as cores de
 * hoje da silhueta. O fundo padrão é preto translúcido (escurece o chão), então
 * a amostra sai preta; a primeira cor escolhida já pinta chapado e opaco.
 */
const COR_PADRAO = hexDaCor(PROP_SILHOUETTE_FILL_COLOR)
const COR_DA_LINHA_PADRAO = hexDaCor(PROP_SILHOUETTE_EDGE_COLOR)

export interface MobiliaControlsProps {
  prop: Prop
  /** Troca o móvel de tipo no lugar (o tamanho vai para o padrão do tipo novo). */
  onTipoChange: (id: string, tipo: TipoMobilia) => void
  /** Cadeira e baú: troca a vista (Frente | Lado) no lugar; o tamanho vai para o padrão da vista nova. */
  onVistaChange: (id: string, vista: VistaMobilia) => void
  /** Um eixo da aparência por vez: "Preencher", "Cor" ou "Cor da linha" (`null` = volta ao padrão). */
  onAparenciaChange: (id: string, patch: AparenciaDoMovelPatch) => void
}

interface CampoDeCorProps {
  id: string
  rotulo: string
  /** Nome acessível do "Padrão": com as duas cores trocadas há dois botões "Padrão" na seção. */
  rotuloDoPadrao: string
  /** Cor própria já normalizada; `undefined` = o móvel usa a cor de sempre. */
  corPropria: string | undefined
  corPadrao: string
  /** A cor não aparece no desenho agora (o fundo com "Preencher" desligado): o campo fica inerte à vista. */
  desabilitado: boolean
  onEscolher: (cor: string) => void
  onPadrao: () => void
}

/**
 * Uma cor do móvel no molde da "Cor do título" da Sala: amostra nativa na ponta
 * da linha e "Padrão" ao lado dela só quando há cor própria para desfazer.
 * Arrastar dentro do seletor dispara uma troca por movimento; quem junta tudo
 * num passo só do Ctrl+Z é o `mapStore` (`setAparenciaDoMovel`).
 */
function CampoDeCor({ id, rotulo, rotuloDoPadrao, corPropria, corPadrao, desabilitado, onEscolher, onPadrao }: CampoDeCorProps) {
  return (
    <div className="lb-section__row">
      <label className="lb-label" htmlFor={id}>
        {rotulo}
      </label>
      <div className="lb-mobilia__color">
        {corPropria !== undefined && (
          <button type="button" className="lb-btn lb-btn--ghost" aria-label={rotuloDoPadrao} disabled={desabilitado} onClick={onPadrao}>
            Padrão
          </button>
        )}
        <input
          id={id}
          className="lb-swatch"
          type="color"
          value={corPropria ?? corPadrao}
          disabled={desabilitado}
          onChange={(event) => onEscolher(event.target.value)}
        />
      </div>
    </div>
  )
}

/**
 * MÓVEL — o que só o móvel desenhado (objeto com `mobilia`) tem: o tipo, a
 * vista (só cadeira e baú) e a aparência da silhueta. Objeto de imagem não
 * mostra a seção. Mora acima de "Objeto" (Rotação, Travado, Oculto) porque é o
 * que diz o que a peça É; o resto vale para qualquer objeto. Nenhum controle
 * trava com "Travado": como na seção "Objeto", ele segura o gesto no mapa, não
 * o painel.
 */
export function MobiliaControls({ prop, onTipoChange, onVistaChange, onAparenciaChange }: MobiliaControlsProps) {
  const baseId = useId()
  const tipo = prop.mobilia
  if (tipo === undefined) return null

  const tipoId = `${baseId}-tipo`
  const corId = `${baseId}-cor`
  const corDaLinhaId = `${baseId}-cor-da-linha`
  const vista = vistaDoMovel(prop)
  const preenchido = prop.mobiliaPreenchido !== false

  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Móvel</h2>
      <div className="lb-field">
        <label className="lb-label" htmlFor={tipoId}>
          Tipo
        </label>
        <select
          id={tipoId}
          className="lb-input"
          value={tipo}
          onChange={(event) => {
            const novo = event.target.value
            if (ehTipoMobilia(novo)) onTipoChange(prop.id, novo)
          }}
        >
          {TIPOS_MOBILIA.map((opcao) => (
            <option key={opcao} value={opcao}>
              {ROTULO_MOBILIA[opcao]}
            </option>
          ))}
        </select>
      </div>
      {/* A vista (de frente ou de lado) só existe na cadeira e no baú: vem logo
          depois do "Tipo", que decide se ela aparece. Mesmo segmentado dos
          outros painéis (`lb-seg`), com as duas opções à vista. */}
      {aceitaVista(tipo) && (
        <div className="lb-field">
          <span className="lb-label">Vista</span>
          <div className="lb-seg" role="radiogroup" aria-label="Vista">
            {VISTAS_MOBILIA.map((opcao) => (
              <button
                key={opcao}
                type="button"
                role="radio"
                aria-checked={vista === opcao}
                className="lb-seg__option"
                onClick={() => onVistaChange(prop.id, opcao)}
              >
                {ROTULO_VISTA[opcao]}
              </button>
            ))}
          </div>
        </div>
      )}
      <Toggle label="Preencher" checked={preenchido} onChange={(ligado) => onAparenciaChange(prop.id, { preenchido: ligado })} />
      {/* Sem "Preencher" não há fundo para a "Cor" pintar: escolher ali não
          mudaria nada na tela, então o campo fica inerte (e guarda a cor, que
          volta quando o fundo volta). */}
      <CampoDeCor
        id={corId}
        rotulo="Cor"
        rotuloDoPadrao="Padrão da cor"
        corPropria={normalizarCorDoMovel(prop.mobiliaCor)}
        corPadrao={COR_PADRAO}
        desabilitado={!preenchido}
        onEscolher={(cor) => onAparenciaChange(prop.id, { cor })}
        onPadrao={() => onAparenciaChange(prop.id, { cor: null })}
      />
      <CampoDeCor
        id={corDaLinhaId}
        rotulo="Cor da linha"
        rotuloDoPadrao="Padrão da cor da linha"
        corPropria={normalizarCorDoMovel(prop.mobiliaCorDaLinha)}
        corPadrao={COR_DA_LINHA_PADRAO}
        desabilitado={false}
        onEscolher={(corDaLinha) => onAparenciaChange(prop.id, { corDaLinha })}
        onPadrao={() => onAparenciaChange(prop.id, { corDaLinha: null })}
      />
    </section>
  )
}
