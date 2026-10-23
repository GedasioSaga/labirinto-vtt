import { memo, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { CamadaId } from '../types/map'
import { contextoDeCamadas, type CamposDeCamadas } from '../lib/camadas/consulta'
import { ehCamadaDeAntes, ehCamadaPadrao, ROTULOS_DAS_CAMADAS } from '../lib/camadas/padrao'
import { ChevronDownIcon, EyeIcon, EyeOffIcon, JogadoresIcon, JogadoresOcultosIcon, LockIcon, UnlockIcon } from './icons'
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

/** O que a linha pede ao painel: referências ESTÁVEIS (a linha é `memo` e não re-renderiza por callback novo). */
interface AcoesDaLinha {
  olhoDoMestre: (id: CamadaId) => void
  olhoDosJogadores: (id: CamadaId) => void
  cadeado: (id: CamadaId) => void
  opacidade: (id: CamadaId, opacidade: number, gesto: string) => void
  /** Abre a linha (fechando a que estava aberta) ou fecha, se já era ela. */
  alternar: (id: CamadaId) => void
  fechar: (id: CamadaId) => void
}

/** Só primitivos e as ações estáveis: arrastar a opacidade de UMA camada re-renderiza só a linha dela. */
interface LinhaProps {
  id: CamadaId
  rotulo: string
  conta: number
  mestreVe: boolean
  jogadoresVeem: boolean
  travada: boolean
  /** Opacidade em pontos de porcentagem (0 a 100). */
  pct: number
  /** Mapa de antes, nas 9 de antes: o olho do mestre some também para os jogadores (o tooltip avisa). */
  olhoParaTodos: boolean
  aberta: boolean
  acoes: AcoesDaLinha
}

/**
 * Uma camada: o NOME é o botão que abre a linha (a opacidade, controle raro,
 * mora dentro), a contagem, o olho do mestre, o olho dos jogadores e o
 * cadeado. O texto da linha fechada é só nome e contagem (as jornadas leem
 * "Paredes 1"): a divisa é desenho e a porcentagem é `::after` (`data-pct`).
 * Os três botões usam `aria-pressed` para o estado FORA do padrão (oculta,
 * escondida dos jogadores, travada) e o nome acessível diz a ação do próximo
 * clique. A ordem do DOM é a da leitura: nome, botões, e só então o slider.
 */
const LinhaDaCamada = memo(function LinhaDaCamada({ id, rotulo, conta, mestreVe, jogadoresVeem, travada, pct, olhoParaTodos, aberta, acoes }: LinhaProps) {
  const gesto = useRef<string | null>(null)
  const nome = useRef<HTMLButtonElement>(null)
  const corpoId = useId()
  const notaId = useId()
  const olhoDoMestre = mestreVe ? `Ocultar ${rotulo}` : `Mostrar ${rotulo}`
  const olhoDosJogadores = jogadoresVeem ? `Ocultar ${rotulo} dos jogadores` : `Mostrar ${rotulo} aos jogadores`
  const soltar = () => {
    gesto.current = null
  }
  // Esc fecha a linha e devolve o foco ao nome; o Esc não segue para o mapa (não larga a seleção).
  const fecharComEsc = (evento: KeyboardEvent<HTMLElement>) => {
    if (evento.key !== 'Escape' || !aberta) return
    evento.preventDefault()
    evento.stopPropagation()
    acoes.fechar(id)
    nome.current?.focus()
  }
  return (
    <>
      <div className="lb-camadas__cabeca">
        <button
          ref={nome}
          type="button"
          className="lb-camadas__nome"
          aria-expanded={aberta}
          aria-controls={corpoId}
          aria-label={`${rotulo}, opacidade`}
          title={rotulo}
          onClick={() => acoes.alternar(id)}
          onKeyDown={fecharComEsc}
        >
          <span className="lb-camadas__divisa" aria-hidden="true">
            <ChevronDownIcon size={12} />
          </span>
          <span className="lb-camadas__rotulo">{rotulo}</span>
        </button>
        <span className="lb-camadas__pct" data-pct={pct === 100 ? undefined : `${pct}%`} aria-hidden="true" />
        <span className="lb-num lb-layers__count lb-camadas__conta" data-zero={conta === 0 ? '' : undefined}>
          {conta}
        </span>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={!mestreVe}
          aria-label={olhoDoMestre}
          title={olhoParaTodos ? `${olhoDoMestre} (some também para os jogadores)` : `${olhoDoMestre} só para você`}
          onClick={() => acoes.olhoDoMestre(id)}
        >
          {mestreVe ? <EyeIcon size={16} /> : <EyeOffIcon size={16} />}
        </button>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={!jogadoresVeem}
          aria-label={olhoDosJogadores}
          title={olhoDosJogadores}
          onClick={() => acoes.olhoDosJogadores(id)}
        >
          {jogadoresVeem ? <JogadoresIcon size={16} /> : <JogadoresOcultosIcon size={16} />}
        </button>
        <button
          type="button"
          className="lb-iconbtn lb-iconbtn--sm lb-camadas__bt"
          aria-pressed={travada}
          aria-label={travada ? `Destravar ${rotulo}` : `Travar ${rotulo}`}
          title={travada ? `Destravar ${rotulo}` : `Travar ${rotulo}`}
          onClick={() => acoes.cadeado(id)}
        >
          {travada ? <LockIcon size={16} /> : <UnlockIcon size={16} />}
        </button>
      </div>
      {/* Fechada, a linha fica montada (a abertura anima como a ficha do Grimório) e `inert`: fora do Tab e do leitor. */}
      <div className="lb-camadas__corpo" id={corpoId} inert={!aberta} onKeyDown={fecharComEsc}>
        <div className="lb-camadas__miolo">
          <div className="lb-camadas__dentro">
            <input
              type="range"
              className="gr-faixa lb-camadas__faixa"
              min={0}
              max={100}
              step={1}
              value={pct}
              aria-label={`Opacidade de ${rotulo}`}
              aria-valuetext={`${pct}%`}
              aria-describedby={aberta ? notaId : undefined}
              // Fixo (não muda a cada quadro do arrasto): o valor está no `aria-valuetext` e no `::after` da linha.
              title={`Opacidade de ${rotulo} (0% some para todos)`}
              onPointerDown={() => {
                gesto.current = novoGesto('arrasto')
              }}
              onPointerUp={soltar}
              onPointerCancel={soltar}
              onBlur={soltar}
              onChange={(evento) => acoes.opacidade(id, Number(evento.currentTarget.value) / 100, gesto.current ?? novoGesto('tecla'))}
            />
            {/* Só com a linha aberta: fechada, o texto da linha continua só nome e contagem. */}
            {aberta && (
              <span className="lb-camadas__nota" id={notaId}>
                Para você e para os jogadores
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  )
})

/** O nome da linha: um dos 13 rótulos, ou o da camada livre no modelo. */
function rotuloDe(id: CamadaId, camadas: CamposDeCamadas): string {
  if (ehCamadaPadrao(id)) return ROTULOS_DAS_CAMADAS[id]
  const nome = camadas.modeloCamadas?.ordem.find((def) => def.id === id)?.nome?.trim()
  return nome === undefined || nome === '' ? 'Sem nome' : nome
}

/**
 * CAMADAS (fase 3, fatia 6): as 13 camadas na ordem da lista, de CIMA para
 * BAIXO = da que desenha por cima (Telhados) à de baixo (Chão). Cada linha
 * tem os dois olhos e o cadeado à vista; a opacidade abre pelo nome (uma
 * linha aberta por vez). A linha Chão leva aninhadas as camadas de pincel, e
 * a de Telhados o atalho "Transparente" do mestre.
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
  const [aberta, setAberta] = useState<CamadaId | null>(null)

  // Quem envolve passa callbacks novos a cada render: a linha recebe ações estáveis que chamam as de AGORA.
  const atuais = useRef(props)
  useLayoutEffect(() => {
    atuais.current = props
  })
  const acoes = useMemo<AcoesDaLinha>(
    () => ({
      olhoDoMestre: (id) => atuais.current.onToggleLayer(id),
      olhoDosJogadores: (id) => atuais.current.onTogglePlayers(id),
      cadeado: (id) => atuais.current.onToggleLock(id),
      opacidade: (id, opacidade, gesto) => atuais.current.onOpacity(id, opacidade, gesto),
      alternar: (id) => setAberta((atual) => (atual === id ? null : id)),
      fechar: (id) => setAberta((atual) => (atual === id ? null : atual)),
    }),
    [],
  )

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
          const pct = Math.round(contexto.alfa(id) * 100)
          const aninhado = id === 'chao' ? chao : id === 'telhados' && mestreVe ? telhados : undefined
          return (
            <li
              key={id}
              className="lb-layers__row lb-camadas__linha"
              data-camada={id}
              data-hidden={mestreVe ? undefined : ''}
              data-esmaecida={pct < 100 ? '' : undefined}
              data-aberta={aberta === id ? '' : undefined}
            >
              <LinhaDaCamada
                id={id}
                rotulo={rotuloDe(id, camadas)}
                conta={counts[id] ?? 0}
                mestreVe={mestreVe}
                jogadoresVeem={contexto.jogadorVe(id)}
                travada={contexto.travada(id)}
                pct={pct}
                olhoParaTodos={mapaDeAntes && ehCamadaDeAntes(id) && camadas.ocultasDoJogador === undefined}
                aberta={aberta === id}
                acoes={acoes}
              />
              {aninhado !== undefined && <div className="lb-camadas__aninhado">{aninhado}</div>}
            </li>
          )
        })}
      </ul>
    </>
  )
}
