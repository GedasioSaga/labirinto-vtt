import { useRef, type ReactNode } from 'react'
import type { CamadaId } from '../types/map'
import { contextoDeCamadas, type CamposDeCamadas } from '../lib/camadas/consulta'
import { ehCamadaDeAntes, ehCamadaPadrao, ROTULOS_DAS_CAMADAS } from '../lib/camadas/padrao'
import { EyeIcon, EyeOffIcon, JogadoresIcon, JogadoresOcultosIcon, LockIcon, UnlockIcon } from './icons'
import './LayersPanel.css'

export interface LayersPanelProps {
  /** Os campos de camadas do mapa aberto (os dois olhos, cadeado, opacidade, versão, modelo). */
  camadas: CamposDeCamadas
  /** Itens por camada (`contarItensPorCamada`). Ausente = 0. Só informativo. */
  counts: Partial<Record<CamadaId, number>>
  /** Olho "Mestre vê". */
  onToggleLayer: (id: CamadaId) => void
  /** Olho "Jogadores veem". */
  onTogglePlayers: (id: CamadaId) => void
  onToggleLock: (id: CamadaId) => void
  /** Opacidade de 0 a 1. `gesto`: o mesmo valor do apertar ao soltar de um arrasto (um passo de Ctrl+Z por gesto). */
  onOpacity: (id: CamadaId, opacidade: number, gesto: string) => void
  /** Linha de acesso rápido acima da lista (hoje: Mostrar grade / Grudar). */
  quickToggles?: ReactNode
  /** Aninhado na linha Chão: as camadas de pincel ("Camadas do chão"), com os controles de hoje. */
  chao?: ReactNode
  /** Aninhado na linha Telhados, só enquanto o mestre vê os telhados: o atalho "Transparente". */
  telhados?: ReactNode
}

/** Gestos do slider nesta sessão: cada arrasto (ou cada tecla) ganha um número novo. */
let ultimoGesto = 0
const novoGesto = (origem: 'arrasto' | 'tecla'): string => `${origem}-${(ultimoGesto += 1)}`

interface LinhaProps {
  id: CamadaId
  rotulo: string
  conta: number
  mestreVe: boolean
  jogadoresVeem: boolean
  travada: boolean
  alfa: number
  /** Mapa de antes, nas 9 de antes: o olho do mestre some também para os jogadores (o tooltip avisa). */
  olhoParaTodos: boolean
  aninhado?: ReactNode
  props: LayersPanelProps
}

/**
 * Uma camada: nome e contagem (o ÚNICO texto da linha: as jornadas leem
 * "Paredes 1"), opacidade, olho do mestre, olho dos jogadores e cadeado. Os
 * três botões usam `aria-pressed` para o estado FORA do padrão (oculta,
 * escondida dos jogadores, travada) e o nome acessível diz a ação do próximo
 * clique. A porcentagem aparece só quando não é 100%, por CSS (`data-pct`):
 * a mesma informação do `aria-valuetext`, fora do texto da linha.
 */
function LinhaDaCamada({ id, rotulo, conta, mestreVe, jogadoresVeem, travada, alfa, olhoParaTodos, aninhado, props }: LinhaProps) {
  const gesto = useRef<string | null>(null)
  const pct = Math.round(alfa * 100)
  const olhoDoMestre = mestreVe ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`
  const olhoDosJogadores = jogadoresVeem ? `Ocultar ${rotulo} dos jogadores` : `Mostrar ${rotulo} aos jogadores`
  const soltar = () => {
    gesto.current = null
  }
  return (
    <li className="lb-layers__row lb-camadas__linha" data-camada={id} data-hidden={mestreVe ? undefined : ''} data-esmaecida={pct < 100 ? '' : undefined}>
      <div className="lb-camadas__cabeca">
        <span className="lb-layers__name lb-camadas__nome" title={rotulo}>
          {rotulo}
        </span>
        <span className="lb-num lb-layers__count lb-camadas__conta">{conta}</span>
        <span className="lb-camadas__opacidade" data-pct={pct === 100 ? undefined : `${pct}%`}>
          <input
            type="range"
            className="gr-faixa lb-camadas__faixa"
            min={0}
            max={100}
            step={1}
            value={pct}
            aria-label={`Opacidade de ${rotulo}`}
            aria-valuetext={`${pct}%`}
            title={`Opacidade de ${rotulo}: ${pct}% (para você e para os jogadores)`}
            onPointerDown={() => {
              gesto.current = novoGesto('arrasto')
            }}
            onPointerUp={soltar}
            onPointerCancel={soltar}
            onBlur={soltar}
            onChange={(evento) => props.onOpacity(id, Number(evento.currentTarget.value) / 100, gesto.current ?? novoGesto('tecla'))}
          />
        </span>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={!mestreVe}
          aria-label={olhoDoMestre}
          title={olhoParaTodos ? `${olhoDoMestre} (some também para os jogadores)` : `${olhoDoMestre} só para você`}
          onClick={() => props.onToggleLayer(id)}
        >
          {mestreVe ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
        </button>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={!jogadoresVeem}
          aria-label={olhoDosJogadores}
          title={olhoDosJogadores}
          onClick={() => props.onTogglePlayers(id)}
        >
          {jogadoresVeem ? <JogadoresIcon size={16} /> : <JogadoresOcultosIcon size={16} />}
        </button>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={travada}
          aria-label={travada ? `Destravar ${rotulo}` : `Travar ${rotulo}`}
          title={travada ? `Destravar ${rotulo}` : `Travar ${rotulo}`}
          onClick={() => props.onToggleLock(id)}
        >
          {travada ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
        </button>
      </div>
      {aninhado !== undefined && <div className="lb-camadas__aninhado">{aninhado}</div>}
    </li>
  )
}

/** O nome da linha: um dos 13 rótulos, ou o da camada livre no modelo. */
function rotuloDe(id: CamadaId, camadas: CamposDeCamadas): string {
  if (ehCamadaPadrao(id)) return ROTULOS_DAS_CAMADAS[id]
  const nome = camadas.modeloCamadas?.ordem.find((def) => def.id === id)?.nome?.trim()
  return nome === undefined || nome === '' ? 'Sem nome' : nome
}

/**
 * CAMADAS (fase 3, fatia 6): as 13 camadas na ordem da lista, de CIMA para
 * BAIXO = da que desenha por cima (Telhados) à de baixo (Chão). Cada linha
 * tem os dois olhos, o cadeado e a opacidade; a linha Chão leva aninhadas as
 * camadas de pincel, e a de Telhados o atalho "Transparente" do mestre.
 *
 * Só apresentação: quem responde por cada camada é `contextoDeCamadas` (o
 * ponto único); este componente lê e emite o pedido. O título e o abre/fecha
 * ficam com quem envolve (a ficha "Camadas" da página Cena).
 */
export function LayersPanel(props: LayersPanelProps) {
  const { camadas, counts, quickToggles, chao, telhados } = props
  const contexto = contextoDeCamadas(camadas)
  const deCimaParaBaixo = [...contexto.ordem].reverse()
  const mapaDeAntes = camadas.versaoDasCamadas !== 2
  return (
    <>
      {quickToggles}
      {/* A chave dos ícones: os dois olhos da linha não são iguais, e aqui se diz qual é qual. */}
      <p className="lb-camadas__legenda">
        <span className="lb-camadas__chave">
          <EyeIcon size={14} />
          Você vê
        </span>
        <span className="lb-camadas__chave">
          <JogadoresIcon size={14} />
          Jogadores veem
        </span>
        <span className="lb-camadas__chave">
          <UnlockIcon size={14} />
          Trava
        </span>
      </p>
      <ul className="lb-layers lb-camadas" aria-label="Camadas do mapa">
        {deCimaParaBaixo.map((id) => {
          const mestreVe = contexto.mestreVe(id)
          const aninhado = id === 'chao' ? chao : id === 'telhados' && mestreVe ? telhados : undefined
          return (
            <LinhaDaCamada
              key={id}
              id={id}
              rotulo={rotuloDe(id, camadas)}
              conta={counts[id] ?? 0}
              mestreVe={mestreVe}
              jogadoresVeem={contexto.jogadorVe(id)}
              travada={contexto.travada(id)}
              alfa={contexto.alfa(id)}
              olhoParaTodos={mapaDeAntes && ehCamadaDeAntes(id) && camadas.ocultasDoJogador === undefined}
              aninhado={aninhado}
              props={props}
            />
          )
        })}
      </ul>
    </>
  )
}
