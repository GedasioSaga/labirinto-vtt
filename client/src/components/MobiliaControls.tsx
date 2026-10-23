import { useId, useRef, type CSSProperties } from 'react'
import {
  FORMAS_DO_TAPETE,
  PALETA_DE_TECIDO,
  ROTULO_FORMA,
  ROTULO_MOBILIA,
  ROTULO_VISTA,
  VISTAS_MOBILIA,
  aceitaVista,
  ehMovelVazado,
  ehTipoMobilia,
  formaDoTapete,
  normalizarCorDeTecido,
  normalizarCorDoMovel,
  vistaDoMovel,
  type AparenciaDoMovelPatch,
} from '../lib/mobilia'
import { catalogoComOTipo, ehPecaNova } from '../lib/mobilia/pecasNovas'
import { DEFAULT_FLOOR_STYLE } from '../lib/mapFile'
import { parseHexColor } from '../lib/tokenColor'
import { PROP_SILHOUETTE_EDGE_COLOR, PROP_SILHOUETTE_FILL_ALPHA, PROP_SILHOUETTE_FILL_COLOR } from '../pixi/drawPropSilhouettes'
import type { FormaDoTapete, Prop, TipoMobilia, VistaMobilia } from '../types/map'
import { Toggle } from './Toggle'
import './MobiliaControls.css'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { FormaDoTapeteIcon } from './icons'
import { MaterialDaPeca } from './MaterialDaPeca'

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
  /** Tapete: troca a forma (Retangular | Redondo) no lugar; o tamanho vai para o padrão da forma nova. */
  onFormaChange: (id: string, forma: FormaDoTapete) => void
  /** Um eixo da aparência por vez: "Preencher", "Cor" ou "Cor da linha" (`null` = volta ao padrão). */
  onAparenciaChange: (id: string, patch: AparenciaDoMovelPatch) => void
}

interface CampoDeCorProps {
  id: string
  rotulo: string
  /** Cor própria já normalizada; `undefined` = o móvel usa a cor de sempre. */
  corPropria: string | undefined
  corPadrao: string
  /** A cor não aparece no desenho agora (o fundo com "Preencher" desligado): o campo fica inerte à vista. */
  desabilitado: boolean
  onEscolher: (cor: string) => void
  /**
   * O botão "Padrão" ao lado da amostra, com o nome acessível dele (com as
   * cores trocadas há vários "Padrão" na seção). Ausente = sem botão: as cores
   * de tecido voltam ao padrão pela primeira amostra da paleta.
   */
  padrao?: { rotulo: string; onPadrao: () => void }
}

/**
 * Uma cor do móvel no molde da "Cor do título" da Sala: amostra nativa na ponta
 * da linha e "Padrão" ao lado dela só quando há cor própria para desfazer.
 * Arrastar dentro do seletor dispara uma troca por movimento; quem junta tudo
 * num passo só do Ctrl+Z é o `mapStore` (`setAparenciaDoMovel`).
 */
function CampoDeCor({ id, rotulo, corPropria, corPadrao, desabilitado, onEscolher, padrao }: CampoDeCorProps) {
  return (
    <div className="lb-section__row">
      <label className="lb-label" htmlFor={id}>
        {rotulo}
      </label>
      <div className="lb-mobilia__color">
        {padrao !== undefined && corPropria !== undefined && (
          <button type="button" className="lb-btn lb-btn--ghost" aria-label={padrao.rotulo} disabled={desabilitado} onClick={padrao.onPadrao}>
            Padrão
          </button>
        )}
        <CampoDeCorComPipeta
          id={id}
          value={corPropria ?? corPadrao}
          disabled={desabilitado}
          rotuloDaPipeta={`Pegar do mapa: ${rotulo}`}
          onChange={(cor) => onEscolher(cor)}
        />
      </div>
    </div>
  )
}

/** A amostra pinta a cor pela variável `--amostra` (o CSS desenha o risco do "Padrão" por cima dela). */
type EstiloDaAmostra = CSSProperties & { '--amostra': string }

/** Uma opção da paleta: `cor: null` = "Padrão" (o tecido pinta com a cama, como hoje). */
const OPCOES_DE_TECIDO: readonly { nome: string; cor: string | null }[] = [{ nome: 'Padrão', cor: null }, ...PALETA_DE_TECIDO]

/** A tecla que anda na paleta, para onde ela leva a partir de `i`; `null` = não é tecla de andar. */
function destinoNaPaleta(tecla: string, i: number, ultimo: number): number | null {
  if (tecla === 'ArrowRight' || tecla === 'ArrowDown') return i === ultimo ? 0 : i + 1
  if (tecla === 'ArrowLeft' || tecla === 'ArrowUp') return i === 0 ? ultimo : i - 1
  if (tecla === 'Home') return 0
  if (tecla === 'End') return ultimo
  return null
}

interface CampoDeTecidoProps {
  id: string
  rotulo: string
  /** Cor própria do tecido, já normalizada; `undefined` = pinta com a cama. */
  corPropria: string | undefined
  /** O tom da cama (a "Cor", ou o da cama padrão no chão padrão): o que o tecido pinta sem cor própria. */
  corDaCama: string
  desabilitado: boolean
  /** `null` = volta ao padrão (a amostra riscada). */
  onEscolher: (cor: string | null) => void
}

/**
 * Uma cor de TECIDO da cama: a linha de cor de sempre (pipeta e seletor livre,
 * sem o botão "Padrão") e, embaixo, a paleta de tecido. O "Padrão" é a
 * primeira amostra da paleta, a cor da cama riscada na diagonal: com o botão na
 * linha, o rótulo longo quebrava em duas linhas no primeiro clique e a paleta
 * descia debaixo do cursor. A paleta é um ponto de Tab só (roving tabindex):
 * setas, Home e End andam e escolhem, como um grupo de rádio.
 */
function CampoDeTecido({ id, rotulo, corPropria, corDaCama, desabilitado, onEscolher }: CampoDeTecidoProps) {
  const amostras = useRef<(HTMLButtonElement | null)[]>([])
  const marcada = OPCOES_DE_TECIDO.findIndex((opcao) => opcao.cor === (corPropria ?? null))
  // Cor livre fora da paleta: nenhuma marcada, e o Tab entra pela primeira.
  const pontoDeTab = marcada === -1 ? 0 : marcada
  const ultimo = OPCOES_DE_TECIDO.length - 1

  function escolher(i: number): void {
    const opcao = OPCOES_DE_TECIDO[i]
    if (opcao === undefined) return
    onEscolher(opcao.cor)
    amostras.current[i]?.focus()
  }

  return (
    <div className="lb-cor-de-tecido">
      <CampoDeCor id={id} rotulo={rotulo} corPropria={corPropria} corPadrao={corDaCama} desabilitado={desabilitado} onEscolher={onEscolher} />
      <div className="lb-paleta" role="radiogroup" aria-label={`Paleta: ${rotulo.toLowerCase()}`}>
        {OPCOES_DE_TECIDO.map((opcao, i) => {
          const estilo: EstiloDaAmostra = { '--amostra': opcao.cor ?? corDaCama }
          return (
            <button
              key={opcao.nome}
              ref={(amostra) => {
                amostras.current[i] = amostra
              }}
              type="button"
              role="radio"
              aria-checked={i === marcada}
              aria-label={opcao.cor === null ? 'Padrão (como hoje)' : opcao.nome}
              title={opcao.cor === null ? 'Padrão: pinta com a cama, como hoje' : opcao.nome}
              className={opcao.cor === null ? 'lb-paleta__amostra lb-paleta__amostra--padrao' : 'lb-paleta__amostra'}
              style={estilo}
              tabIndex={i === pontoDeTab ? 0 : -1}
              disabled={desabilitado}
              onClick={() => escolher(i)}
              onKeyDown={(evento) => {
                const destino = destinoNaPaleta(evento.key, i, ultimo)
                if (destino === null) return
                evento.preventDefault()
                // A tecla é da paleta: sem isto ela chegava ao atalho do mapa (na
                // bolha do window) e as setas também empurravam a cama selecionada.
                evento.stopPropagation()
                escolher(destino)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/** O tom da cama padrão no chão padrão: o preto translúcido da silhueta sobre o chão de sempre. */
function tomDaCamaPadrao(): string {
  // Chão que não seja cor: a amostra cai no preto da silhueta, a de antes da paleta.
  const chao = parseHexColor(DEFAULT_FLOOR_STYLE.fillColor) ?? PROP_SILHOUETTE_FILL_COLOR
  const canal = (deslocamento: number): number => Math.round(((chao >> deslocamento) & 0xff) * (1 - PROP_SILHOUETTE_FILL_ALPHA))
  return hexDaCor((canal(16) << 16) | (canal(8) << 8) | canal(0))
}
const COR_DA_CAMA_PADRAO = tomDaCamaPadrao()

/** O pedaço do móvel que a ficha do objeto põe em cada lugar: o essencial (o que a peça É) ou a ficha Aparência. */
export type ParteDoMovel = 'essencial' | 'aparencia'

/**
 * MÓVEL — o que só o móvel desenhado (objeto com `mobilia`) tem: o tipo, a
 * vista (só os tipos com vista), a forma (só o tapete) e a aparência da
 * silhueta. Objeto de imagem não mostra nada. Na ficha do objeto (fatia 16a)
 * vem em dois pedaços: `essencial` (Tipo, Vista e Forma: o que diz o que a
 * peça É) e `aparencia` (Preencher, Cor, as cores da cama e Cor da linha, na
 * ficha Aparência). Nenhum controle trava com "Travado": ele segura o gesto no
 * mapa, não o painel.
 */
export function MobiliaControls({
  parte,
  prop,
  onTipoChange,
  onVistaChange,
  onFormaChange,
  onAparenciaChange,
}: MobiliaControlsProps & { parte: ParteDoMovel }) {
  const baseId = useId()
  const tipo = prop.mobilia
  if (tipo === undefined) return null

  if (parte === 'essencial') {
    const tipoId = `${baseId}-tipo`
    const vista = vistaDoMovel(prop)
    const forma = formaDoTapete(prop)
    return (
      <section className="lb-section">
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
            {catalogoComOTipo(tipo).map((opcao) => (
              <option key={opcao} value={opcao}>
                {ROTULO_MOBILIA[opcao]}
              </option>
            ))}
          </select>
        </div>
        {/* A vista (de frente ou de lado) só existe nos tipos com vista (`TIPOS_COM_VISTA`): vem logo
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
        {/* A forma só existe no tapete: logo depois da vista, o mesmo segmentado,
            com a silhueta de cada forma em cima do nome. */}
        {tipo === 'tapete' && (
          <div className="lb-field">
            <span className="lb-label">Forma</span>
            <div className="lb-seg" role="radiogroup" aria-label="Forma">
              {FORMAS_DO_TAPETE.map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  role="radio"
                  aria-checked={forma === opcao}
                  className="lb-seg__option"
                  onClick={() => onFormaChange(prop.id, opcao)}
                >
                  <FormaDoTapeteIcon forma={opcao} size={16} strokeWidth={1.8} />
                  {ROTULO_FORMA[opcao]}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    )
  }

  // PEÇA NOVA (MT4): sai sempre com textura, então a aparência é o MATERIAL (o hex oficial nos campos de cor de sempre).
  if (ehPecaNova(tipo)) return <MaterialDaPeca prop={prop} tipo={tipo} onAparenciaChange={onAparenciaChange} />

  const corId = `${baseId}-cor`
  const corDaLinhaId = `${baseId}-cor-da-linha`
  const preenchido = prop.mobiliaPreenchido !== false
  // O que o tecido pinta sem cor própria: a "Cor" da cama, ou o tom da cama padrão no chão padrão.
  const corDaCama = normalizarCorDoMovel(prop.mobiliaCor) ?? COR_DA_CAMA_PADRAO

  return (
    <section className="lb-section">
      {/* Móvel vazado (a cerca) não tem fundo: "Preencher" e "Cor" não teriam o que pintar. */}
      {!ehMovelVazado(tipo) && (
        <>
          <Toggle label="Preencher" checked={preenchido} onChange={(ligado) => onAparenciaChange(prop.id, { preenchido: ligado })} />
          {/* Sem "Preencher" não há fundo para a "Cor" pintar: escolher ali não
              mudaria nada na tela, então o campo fica inerte (e guarda a cor, que
              volta quando o fundo volta). */}
          <CampoDeCor
            id={corId}
            rotulo="Cor"
            corPropria={normalizarCorDoMovel(prop.mobiliaCor)}
            corPadrao={COR_PADRAO}
            desabilitado={!preenchido}
            onEscolher={(cor) => onAparenciaChange(prop.id, { cor })}
            padrao={{ rotulo: 'Padrão da cor', onPadrao: () => onAparenciaChange(prop.id, { cor: null }) }}
          />
          {/* CAMA EM TRÊS CORES: a "Cor" fica na madeira; travesseiro e cobertor
              têm a paleta de tecido. Sem "Preencher" também ficam inertes (não
              há fundo onde o tecido entre). */}
          {tipo === 'catre' && (
            <>
              <CampoDeTecido
                id={`${baseId}-cor-do-travesseiro`}
                rotulo="Cor do travesseiro"
                corPropria={normalizarCorDeTecido(tipo, prop.mobiliaCorDoTravesseiro)}
                corDaCama={corDaCama}
                desabilitado={!preenchido}
                onEscolher={(corDoTravesseiro) => onAparenciaChange(prop.id, { corDoTravesseiro })}
              />
              <CampoDeTecido
                id={`${baseId}-cor-do-cobertor`}
                rotulo="Cor do cobertor"
                corPropria={normalizarCorDeTecido(tipo, prop.mobiliaCorDoCobertor)}
                corDaCama={corDaCama}
                desabilitado={!preenchido}
                onEscolher={(corDoCobertor) => onAparenciaChange(prop.id, { corDoCobertor })}
              />
            </>
          )}
        </>
      )}
      <CampoDeCor
        id={corDaLinhaId}
        rotulo="Cor da linha"
        corPropria={normalizarCorDoMovel(prop.mobiliaCorDaLinha)}
        corPadrao={COR_DA_LINHA_PADRAO}
        desabilitado={false}
        onEscolher={(corDaLinha) => onAparenciaChange(prop.id, { corDaLinha })}
        padrao={{ rotulo: 'Padrão da cor da linha', onPadrao: () => onAparenciaChange(prop.id, { corDaLinha: null }) }}
      />
    </section>
  )
}
