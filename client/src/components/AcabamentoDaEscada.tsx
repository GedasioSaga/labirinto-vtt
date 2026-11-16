import { useId, useRef, type CSSProperties, type KeyboardEvent } from 'react'
import type { EstadoDoMetalDaEscada, FeitioDaPedraDaEscada, MaterialDaEscada, Stair, TomDaMadeiraDaEscada } from '../types/map'
import {
  amostraDaEscada,
  ESTADO_PADRAO_DO_METAL,
  ESTADOS_DO_METAL,
  FEITIO_PADRAO_DA_PEDRA,
  FEITIOS_DA_PEDRA,
  MATERIAIS_DA_ESCADA,
  MATERIAL_PADRAO_DA_ESCADA,
  TOM_PADRAO,
  TONS_DA_MADEIRA_DA_ESCADA,
  type MudancaDoMaterialDaEscada,
} from '../lib/materialDaEscada'
import { MATERIAIS } from '../texturas/meioTermo/materiais'
import { urlDaAmostraDaEscada } from '../texturas/escadas/materiais'
import { CampoSeg, type OpcaoDoSeg } from './grimorio/CampoSeg'
import './TexturasControls.css'
import './AcabamentoDaParede.css'
import './MobiliaControls.css'
import './MaterialDaPeca.css'
import './AcabamentoDaEscada.css'

/** O que o painel da escada mostra e grava: o material e o que ele guarda (o tom, o estado do metal, o feitio da pedra). */
export interface AcabamentoDaEscadaProps {
  escada: Pick<Stair, 'material' | 'tom' | 'estadoDoMetal' | 'feitioDaPedra'>
  /** Um Ctrl+Z por clique (`setStairMaterial`). */
  onChange: (mudanca: MudancaDoMaterialDaEscada) => void
}

type Acabamento = 'linhas' | 'textura'

const OPCOES_DO_ACABAMENTO: readonly OpcaoDoSeg<Acabamento>[] = [
  { valor: 'linhas', rotulo: 'Só linhas' },
  { valor: 'textura', rotulo: 'Com textura' },
]

const OPCOES_DO_METAL: readonly OpcaoDoSeg<EstadoDoMetalDaEscada>[] = ESTADOS_DO_METAL.map((e) => ({ valor: e.id, rotulo: e.nome }))
const OPCOES_DA_PEDRA: readonly OpcaoDoSeg<FeitioDaPedraDaEscada>[] = FEITIOS_DA_PEDRA.map((f) => ({ valor: f.id, rotulo: f.nome }))

/**
 * O MATERIAL ESCOLHIDO DA ÚLTIMA VEZ nesta sessão: "Com textura" numa escada
 * que nunca teve material começa no último que o mestre usou (a próxima
 * escada da casa costuma ser do mesmo material), e na primeira vez, madeira.
 * Fica no módulo e não no arquivo: é hábito do mestre, não dado do mapa.
 */
let ultimoMaterial: MaterialDaEscada = MATERIAL_PADRAO_DA_ESCADA

/** A tecla que anda num grupo de rádio, para onde ela leva a partir de `i`; `null` = não é tecla de andar. */
function destino(tecla: string, i: number, ultimo: number): number | null {
  if (tecla === 'ArrowRight' || tecla === 'ArrowDown') return i === ultimo ? 0 : i + 1
  if (tecla === 'ArrowLeft' || tecla === 'ArrowUp') return i === 0 ? ultimo : i - 1
  if (tecla === 'Home') return 0
  if (tecla === 'End') return ultimo
  return null
}

/**
 * Rádio com as setas, como as amostras da mobília: Tab entra pela marcada e
 * as setas andam e escolhem. A tecla para aqui: sem isto as setas chegavam ao
 * atalho do mapa e empurravam a escada selecionada.
 */
function useSetas(total: number, marcado: number, escolher: (i: number) => void) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([])
  return {
    ref: (i: number) => (botao: HTMLButtonElement | null) => {
      botoes.current[i] = botao
    },
    tabIndex: (i: number) => (i === (marcado < 0 ? 0 : marcado) ? 0 : -1),
    onKeyDown: (i: number) => (evento: KeyboardEvent<HTMLButtonElement>) => {
      const alvo = destino(evento.key, i, total - 1)
      if (alvo === null) return
      evento.preventDefault()
      evento.stopPropagation()
      escolher(alvo)
      botoes.current[alvo]?.focus()
    },
  }
}

/**
 * ACABAMENTO DA ESCADA (pedido de 16/11/2026: "a opção da escada ter textura
 * que nem a parede, onde pode ser tirado e colocado"): o mesmo "Só linhas" /
 * "Com textura" da parede e, com textura, a grade dos cinco materiais (a
 * amostra é uma escadinha vista de cima, a mesma receita do mapa) e o que o
 * material pede: a cor da madeira, o metal novo ou enferrujado, a pedra de
 * cascalho ou de pedregulhos. Trocar de material não esquece o tom nem os
 * feitios: voltar à madeira traz a nogueira de antes.
 */
export function AcabamentoDaEscada({ escada, onChange }: AcabamentoDaEscadaProps) {
  const material = escada.material
  const comTextura = material !== undefined
  const tom = escada.tom ?? TOM_PADRAO
  const rotuloDoMaterial = useId()
  const rotuloDoTom = useId()

  const escolherMaterial = (id: MaterialDaEscada) => {
    ultimoMaterial = id
    if (id !== material) onChange({ material: id })
  }
  const setasDoMaterial = useSetas(MATERIAIS_DA_ESCADA.length, MATERIAIS_DA_ESCADA.findIndex((m) => m.id === material), (i) => {
    const m = MATERIAIS_DA_ESCADA[i]
    if (m !== undefined) escolherMaterial(m.id)
  })
  const setasDoTom = useSetas(TONS_DA_MADEIRA_DA_ESCADA.length, TONS_DA_MADEIRA_DA_ESCADA.indexOf(tom), (i) => {
    const novo = TONS_DA_MADEIRA_DA_ESCADA[i]
    if (novo !== undefined && novo !== tom) onChange({ tom: novo })
  })

  return (
    <>
      <div className="lb-escada-acabamento">
        <CampoSeg
          rotulo="Acabamento"
          nomeAcessivel="Acabamento da escada"
          opcoes={OPCOES_DO_ACABAMENTO}
          valor={comTextura ? 'textura' : 'linhas'}
          onChange={(valor) => {
            if (valor === 'linhas' && comTextura) onChange({ material: null })
            if (valor === 'textura' && !comTextura) onChange({ material: ultimoMaterial })
          }}
        />
        <p className="lb-field__hint">
          Com textura, cada degrau leva o material; o patamar continua sendo o alto. O passo e a visão não mudam.
        </p>
      </div>

      {comTextura && (
        <div className="gr-campo">
          <span className="gr-campo__rot" id={rotuloDoMaterial}>
            Material
          </span>
          <div className="lb-texturas__grade lb-acabamento__grade" role="radiogroup" aria-labelledby={rotuloDoMaterial}>
            {MATERIAIS_DA_ESCADA.map((m, i) => {
              // A amostra mostra o material como ESTA escada o teria: a madeira no tom dela, o metal e a pedra no feitio dela.
              const url = urlDaAmostraDaEscada(amostraDaEscada({ ...escada, material: m.id }) ?? '')
              return (
                <button
                  key={m.id}
                  ref={setasDoMaterial.ref(i)}
                  type="button"
                  role="radio"
                  aria-checked={material === m.id}
                  aria-label={m.nome}
                  title={m.descricao}
                  className="lb-texturas__opcao"
                  tabIndex={setasDoMaterial.tabIndex(i)}
                  onKeyDown={setasDoMaterial.onKeyDown(i)}
                  onClick={() => escolherMaterial(m.id)}
                >
                  <span
                    className="lb-amostra-material lb-amostra-material--faixa lb-amostra-escada"
                    aria-hidden="true"
                    style={url === null ? undefined : { backgroundImage: `url(${url})` }}
                  />
                  <span className="lb-texturas__nome" aria-hidden="true">
                    {m.nome}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {material === 'madeira' && (
        <div className="gr-campo">
          <div className="lb-material__cabeca">
            <span className="gr-campo__rot" id={rotuloDoTom}>
              Cor da madeira
            </span>
            <span className="lb-material__escolhido">{MATERIAIS[tom].nome}</span>
          </div>
          <div className="lb-material__amostras" role="radiogroup" aria-labelledby={rotuloDoTom}>
            {TONS_DA_MADEIRA_DA_ESCADA.map((id: TomDaMadeiraDaEscada, i) => (
              <button
                key={id}
                ref={setasDoTom.ref(i)}
                type="button"
                role="radio"
                aria-checked={id === tom}
                aria-label={MATERIAIS[id].nome}
                title={MATERIAIS[id].nome}
                className="lb-paleta__amostra lb-material__amostra"
                style={{ '--amostra': MATERIAIS[id].tom } as CSSProperties}
                tabIndex={setasDoTom.tabIndex(i)}
                onKeyDown={setasDoTom.onKeyDown(i)}
                onClick={() => id !== tom && onChange({ tom: id })}
              />
            ))}
          </div>
        </div>
      )}

      {material === 'metal' && (
        <CampoSeg
          rotulo="Metal"
          nomeAcessivel="Estado do metal"
          opcoes={OPCOES_DO_METAL}
          valor={escada.estadoDoMetal ?? ESTADO_PADRAO_DO_METAL}
          onChange={(estadoDoMetal) => onChange({ estadoDoMetal })}
        />
      )}

      {material === 'pedra' && (
        <CampoSeg
          rotulo="Pedra"
          nomeAcessivel="Feitio da pedra"
          opcoes={OPCOES_DA_PEDRA}
          valor={escada.feitioDaPedra ?? FEITIO_PADRAO_DA_PEDRA}
          onChange={(feitioDaPedra) => onChange({ feitioDaPedra })}
        />
      )}
    </>
  )
}
