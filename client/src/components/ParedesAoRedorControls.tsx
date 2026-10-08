import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { PAREDES_DO_DESENHO_PADRAO } from '../lib/paredesPresas'
import { WALL_COLOR } from '../pixi/drawWalls'
import { theme } from '../theme'
import type { ParedesDoDesenho, PassagemDaParede } from '../types/map'
import { CampoDeCorComPipeta } from './CampoDeCorComPipeta'
import { Toggle } from './Toggle'
import './ParedesAoRedorControls.css'

// O contrato mora no modelo (`types/map.ts`) e o padrão na lógica
// (`lib/paredesPresas.ts`); daqui saem de novo para quem monta o painel.
export { PAREDES_DO_DESENHO_PADRAO }
export type { ParedesDoDesenho, PassagemDaParede }

const APARENCIAS: Array<{ invisivel: boolean; label: string }> = [
  { invisivel: false, label: 'Visível' },
  { invisivel: true, label: 'Invisível' },
]

/** Mesmo vocabulário da janela da parede comum ("Janela (vê, não passa)"). */
const PASSAGENS: Array<{ value: PassagemDaParede; label: string }> = [
  { value: 'bloqueia', label: 'Não vê nem passa' },
  { value: 'janela', label: 'Vê mas não passa' },
]

/** A cor padrão da parede (`WALL_COLOR`) como o `<input type="color">` a lê. */
const COR_PADRAO_HEX = `#${WALL_COLOR.toString(16).padStart(6, '0')}`

/** Abre no tempo base do tema e fecha no rápido: os mesmos tokens do CSS. */
const ABRE_MS = Number.parseFloat(theme.motion.base)
const FECHA_MS = Number.parseFloat(theme.motion.fast)
/** Um quadro de folga: o bloco só sai da árvore depois do último quadro da transição. */
const FOLGA_MS = 20
/** Até quanto tempo depois do "Soltar" um foco perdido volta ao interruptor. */
const DEVOLVER_FOCO_MS = 1000

const FRASE_INTERRUPTOR = 'As paredes ficam presas ao desenho: mover, mudar ou apagar o desenho leva as paredes junto.'
const FRASE_INVISIVEL = 'Invisível: o jogador não vê a parede, mas não passa por ela. Você a vê tracejada.'
const FRASE_SOLTAR = 'Viram paredes comuns, que você edita uma a uma. O desenho deixa de mexer nelas.'

function frasePresas(quantidade: number): string {
  if (quantidade <= 0) return 'Nenhuma parede presa a este desenho'
  if (quantidade === 1) return '1 parede presa a este desenho'
  return `${quantidade.toLocaleString('pt-BR')} paredes presas a este desenho`
}

type Fase = 'abrindo' | 'fechando'

function prefereMenosMovimento(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Um bloco que aparece e some com um estado que vem de FORA (`aberto`, do
 * valor do desenho). Só anima o que o próprio gesto pediu (`pedir`, chamado
 * no clique antes do `onChange`): selecionar outro desenho, desfazer ou o
 * painel abrir com as paredes já ligadas mostram o bloco pronto, sem
 * movimento. Fechando, ele continua na árvore o tempo da transição.
 */
function useRevelacao(aberto: boolean) {
  const [pedido, setPedido] = useState<Fase | null>(null)
  useEffect(() => {
    if (pedido === null) return
    const timer = setTimeout(() => setPedido(null), (pedido === 'abrindo' ? ABRE_MS : FECHA_MS) + FOLGA_MS)
    return () => clearTimeout(timer)
  }, [pedido])
  // O pedido só vale no sentido em que o estado de fora andou de verdade.
  const fase: Fase | undefined = aberto
    ? pedido === 'abrindo'
      ? 'abrindo'
      : undefined
    : pedido === 'fechando'
      ? 'fechando'
      : undefined
  return { montado: aberto || fase === 'fechando', fase, pedir: setPedido }
}

/** Fechando, o bloco não responde a clique nem a Tab (`inert`). */
function Revela({ fase, children }: { fase: Fase | undefined; children: ReactNode }) {
  return (
    <div className="lb-paredes__revela" data-movimento={fase} inert={fase === 'fechando'}>
      <div className="lb-paredes__recorte">
        <div className="lb-paredes__miolo">{children}</div>
      </div>
    </div>
  )
}

export interface ParedesAoRedorControlsProps {
  /** As paredes do desenho selecionado; `undefined` = nunca ligadas. */
  valor: ParedesDoDesenho | undefined
  /** Quantas paredes estão presas ao desenho agora (0 com o interruptor desligado). */
  quantidade: number
  /**
   * Cada controle manda SÓ o que mudou, e quem chama mescla no valor:
   * ligar um desenho sem valor manda `PAREDES_DO_DESENHO_PADRAO` inteiro;
   * religar manda `{ ativo: true }` e o resto volta como estava; "Padrão"
   * da cor manda `{ cor: undefined }`.
   */
  onChange: (patch: Partial<ParedesDoDesenho>) => void
  /** As paredes presas viram paredes comuns, independentes do desenho. */
  onSoltar: () => void
  disabled?: boolean
  /** Por que está desligado: aparece sob o interruptor quando `disabled`. */
  motivoDesabilitado?: string
}

/**
 * "Paredes ao redor" no painel de propriedades do desenho: o interruptor
 * cria paredes no contorno do que está desenhado e, ligado, mostra a
 * aparência (visível ou invisível), a cor, o que a parede deixa passar e a
 * saída para soltar as paredes do desenho. Só apresenta: quem chama liga
 * `valor`/`onChange` ao desenho selecionado.
 *
 * As frases de explicação seguem o contrato de `lib/dicaDoPainel.ts`
 * (`p.lb-field__hint` ligado por `aria-describedby`): dentro do painel viram
 * o "?" sob demanda, como as das outras seções.
 */
export function ParedesAoRedorControls({
  valor,
  quantidade,
  onChange,
  onSoltar,
  disabled = false,
  motivoDesabilitado,
}: ParedesAoRedorControlsProps) {
  const id = useId()
  const dicaInterruptorId = `${id}-interruptor`
  const motivoId = `${id}-motivo`
  const dicaInvisivelId = `${id}-invisivel`
  const corId = `${id}-cor`
  const presasId = `${id}-presas`
  const dicaSoltarId = `${id}-soltar`

  const ativo = valor?.ativo === true
  // Desligando com movimento o bloco ainda aparece por um instante: mostra o
  // último valor LIGADO, não o de agora, que pode ter perdido os campos.
  const [ultimoLigado, setUltimoLigado] = useState(valor)
  if (ativo && valor !== ultimoLigado) setUltimoLigado(valor)
  const exibido = ativo ? valor : ultimoLigado
  const invisivel = exibido?.invisivel === true
  const passagem = exibido?.passagem ?? 'bloqueia'
  const cor = exibido?.cor

  const corpo = useRevelacao(ativo)
  const linhaDaCor = useRevelacao(!invisivel)
  const secaoRef = useRef<HTMLElement>(null)
  const gesto = useRef<'ponteiro' | 'teclado' | null>(null)
  const soltouEm = useRef<number | null>(null)

  // "Soltar" fecha o bloco com o foco dentro dele: o foco volta ao
  // interruptor, e não ao <body>. Só se ele se perdeu de fato e logo depois
  // do clique — nunca rouba o foco de outro lugar.
  useEffect(() => {
    if (corpo.montado) return
    const quando = soltouEm.current
    soltouEm.current = null
    const focoPerdido = document.activeElement === null || document.activeElement === document.body
    if (quando === null || !focoPerdido || performance.now() - quando > DEVOLVER_FOCO_MS) return
    secaoRef.current?.querySelector<HTMLInputElement>('.lb-switch__input')?.focus()
  }, [corpo.montado])

  /** O clique veio do ponteiro (anima) ou do teclado (troca de uma vez)? Lê uma vez só. */
  const animar = (): boolean => {
    const doPonteiro = gesto.current === 'ponteiro'
    gesto.current = null
    return doPonteiro && !prefereMenosMovimento()
  }

  const alternarParedes = (ligar: boolean) => {
    if (animar()) corpo.pedir(ligar ? 'abrindo' : 'fechando')
    if (!ligar) onChange({ ativo: false })
    else onChange(valor ? { ativo: true } : { ...PAREDES_DO_DESENHO_PADRAO })
  }

  const escolherAparencia = (novoInvisivel: boolean) => {
    const comMovimento = animar()
    if (novoInvisivel === invisivel) return
    if (comMovimento) linhaDaCor.pedir(novoInvisivel ? 'fechando' : 'abrindo')
    onChange({ invisivel: novoInvisivel })
  }

  const escolherPassagem = (nova: PassagemDaParede) => {
    if (nova !== passagem) onChange({ passagem: nova })
  }

  const soltar = () => {
    if (animar()) corpo.pedir('fechando')
    soltouEm.current = performance.now()
    onSoltar()
  }

  // Desligado, cada controle aponta o motivo (quando há); ligado, a própria frase.
  const motivo = disabled ? motivoDesabilitado?.trim() || undefined : undefined
  const descricaoDoMotivo = motivo === undefined ? undefined : motivoId
  const podeSoltar = !disabled && quantidade > 0
  const descricaoDoSoltar = disabled ? descricaoDoMotivo : podeSoltar ? dicaSoltarId : presasId

  return (
    <section
      ref={secaoRef}
      className="lb-section lb-paredes"
      onPointerDownCapture={() => {
        gesto.current = 'ponteiro'
      }}
      onKeyDownCapture={() => {
        gesto.current = 'teclado'
      }}
    >
      <h2 className="lb-eyebrow">Paredes</h2>
      <Toggle
        label="Paredes ao redor"
        checked={ativo}
        disabled={disabled}
        describedBy={disabled ? descricaoDoMotivo : dicaInterruptorId}
        onChange={alternarParedes}
      />
      {disabled ? (
        motivo !== undefined && (
          <p className="lb-field__hint" id={motivoId}>
            {motivo}
          </p>
        )
      ) : (
        <p className="lb-field__hint" id={dicaInterruptorId}>
          {FRASE_INTERRUPTOR}
        </p>
      )}

      {corpo.montado && (
        <Revela fase={corpo.fase}>
          <div className="lb-field">
            <span className="lb-label">Aparência</span>
            <div className="lb-seg" role="radiogroup" aria-label="Aparência das paredes" aria-disabled={disabled || undefined}>
              {APARENCIAS.map((opcao) => (
                <button
                  key={opcao.label}
                  type="button"
                  role="radio"
                  aria-checked={invisivel === opcao.invisivel}
                  aria-describedby={opcao.invisivel && !disabled ? dicaInvisivelId : undefined}
                  className="lb-seg__option"
                  disabled={disabled}
                  onClick={() => escolherAparencia(opcao.invisivel)}
                >
                  {opcao.label}
                </button>
              ))}
            </div>
            {!disabled && (
              <p className="lb-field__hint" id={dicaInvisivelId}>
                {FRASE_INVISIVEL}
              </p>
            )}
          </div>

          {/* Parede invisível não tem cor para o jogador: a linha some (e volta
              com a cor de antes) em vez de ficar apagada sem motivo à vista. */}
          {linhaDaCor.montado && (
            <Revela fase={linhaDaCor.fase}>
              <div className="lb-section__row">
                <label className="lb-label" htmlFor={corId}>
                  Cor
                </label>
                <div className="lb-room-title__color">
                  {cor !== undefined && !disabled && (
                    <button type="button" className="lb-btn lb-btn--ghost" onClick={() => onChange({ cor: undefined })}>
                      Padrão
                    </button>
                  )}
                  <CampoDeCorComPipeta
                    id={corId}
                    value={cor ?? COR_PADRAO_HEX}
                    rotuloDaPipeta="Pegar do mapa a cor das paredes"
                    disabled={disabled}
                    onChange={(nova) => onChange({ cor: nova })}
                  />
                </div>
              </div>
            </Revela>
          )}

          <div className="lb-field">
            <span className="lb-label">Passagem</span>
            <div className="lb-seg" role="radiogroup" aria-label="Passagem pelas paredes" aria-disabled={disabled || undefined}>
              {PASSAGENS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={passagem === value}
                  className="lb-seg__option"
                  disabled={disabled}
                  onClick={() => escolherPassagem(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="lb-field">
            <span className="lb-label" id={presasId}>
              {frasePresas(quantidade)}
            </span>
            <button
              type="button"
              className="lb-btn lb-btn--block"
              disabled={!podeSoltar}
              aria-describedby={descricaoDoSoltar}
              onClick={soltar}
            >
              Soltar paredes
            </button>
            {podeSoltar && (
              <p className="lb-field__hint" id={dicaSoltarId}>
                {FRASE_SOLTAR}
              </p>
            )}
          </div>
        </Revela>
      )}
    </section>
  )
}

export interface AvisoParedePresaProps {
  /** Nome do desenho dono da parede, como o mestre o reconhece. */
  nomeDoDesenho: string
  /** Troca a seleção para o desenho, onde se mexe nas paredes todas de uma vez. */
  onSelecionarDesenho: () => void
  /** Solta TODAS as paredes do desenho, não só a selecionada. */
  onSoltar: () => void
}

/**
 * Aviso para quando o mestre seleciona UMA parede presa a um desenho: diz de
 * quem ela é e dá as duas saídas — ir ao desenho ou soltar as paredes para
 * editá-las uma a uma.
 */
export function AvisoParedePresa({ nomeDoDesenho, onSelecionarDesenho, onSoltar }: AvisoParedePresaProps) {
  const nome = nomeDoDesenho.trim()
  return (
    <section className="lb-section">
      <h2 className="lb-eyebrow">Parede presa</h2>
      <p className="lb-field__hint">
        {nome === '' ? (
          'Esta parede é de um desenho'
        ) : (
          <>
            Esta parede é do desenho <span className="lb-paredes-aviso__nome">{nome}</span>
          </>
        )}{' '}
        e muda junto com ele. Para editar só esta parede, solte as paredes.
      </p>
      <div className="lb-paredes-aviso__acoes">
        <button type="button" className="lb-btn lb-btn--block" onClick={onSelecionarDesenho}>
          Selecionar desenho
        </button>
        <button type="button" className="lb-btn lb-btn--block" onClick={onSoltar}>
          Soltar paredes
        </button>
      </div>
    </section>
  )
}
