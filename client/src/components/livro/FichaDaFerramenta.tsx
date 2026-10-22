import type { ComponentType, ReactNode } from 'react'
import type { DrawingTool } from '../../types/tools'
import { TOOL_SHORTCUTS } from '../../lib/keymap'
import { CAMADAS_DO_CHAO } from '../../lib/camadasDoChao'
import { BaldeIcon, EllipseIcon, FloorIcon, PathIcon, RegularPolygonIcon, RoomIcon } from '../icons'
import { TOOL_VARIANTS, clusterVariantGroups, type ToolVariantGroup, type ToolVariantStoreKey } from '../../lib/toolVariants'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import { DICAS_DA_FICHA, DICA_DA_FICHA_SALA_LIVRE_PAREDE, TOOL_LABELS, clusterOfTool } from '../labels'
import { eixoDaVariante, type ToolVariantBindings } from '../ToolVariantMenu'
import { TOOL_ICONS } from '../toolIcons'
import { Cabeca, CabecaMedalha } from '../grimorio/Cabeca'
import { CampoSeg } from '../grimorio/CampoSeg'
import { Nota } from '../grimorio/Nota'
import './fichaDaFerramenta.css'

/** O ícone da medalha (o CSS da cabeça fixa 22 px; o tamanho aqui é só o desenho de partida). */
const TAMANHO_DA_MEDALHA = 22
/** O ícone de cada opção do grupo Forma, o mesmo das opções do cantinho da barra. */
const TAMANHO_DA_OPCAO = 16
/** Mais opções que isto não cabem numa linha de 238 px: viram grade, como as formas do protótipo. */
const OPCOES_NUMA_LINHA = 3

/**
 * Eixos que a ficha da ferramenta já mostra pelos controles de sempre: "Parede
 * interna", "Tipo de porta", "Hachurado" e "Lados". Repeti-los como variante
 * seriam dois controles para a mesma escolha, um embaixo do outro.
 */
const EIXOS_JA_NA_FICHA: ReadonlySet<ToolVariantStoreKey> = new Set<ToolVariantStoreKey>(['wallKind', 'doorKind', 'regionFillPattern', 'polygonSides'])

/**
 * As variantes da ferramenta que a ficha mostra, na ordem do cantinho da barra
 * (`clusterVariantGroups`/`TOOL_VARIANTS`): a escolha da forma (Sala, Desenho,
 * Objeto) e os eixos prontos dela, menos os que a ficha já tem
 * (`EIXOS_JA_NA_FICHA`). Os mesmos eixos, a mesma store: a ficha é um segundo
 * caminho até a escolha, não uma escolha nova.
 */
export function variantesDaFicha(ferramenta: DrawingTool): ToolVariantGroup[] {
  const grupo = clusterOfTool(ferramenta)
  const entrada = TOOL_VARIANTS[ferramenta]
  const grupos = grupo !== null ? clusterVariantGroups(grupo, ferramenta) : entrada?.available === true ? entrada.groups : []
  return grupos.filter((g) => !EIXOS_JA_NA_FICHA.has(g.storeKey))
}

/**
 * O que a ferramenta não ajusta antes de criar e mora na ficha do item ou em
 * outro lugar: uma frase, para o mestre não procurar na barra.
 */
const NOTAS_DA_FICHA: Partial<Record<DrawingTool, string>> = {
  light: 'Cor, intensidade e "vista de longe" se ajustam na ficha da luz, depois de criada.',
  stair: 'Sentido, forma e para onde leva se ajustam na ficha da escada, depois de criada.',
  concealZone: 'Nome e "Revelar para jogadores" ficam na ficha da zona, depois de criada.',
  measure: 'A escala e o jeito de medir mudam nas Configurações do mapa, a engrenagem no alto do livro.',
}

/** O Chão: o estilo do chão do MAPA inteiro mora na página Cena, a um clique daqui. */
const NOTA_DO_CHAO = 'Cor do chão, contorno e moldura do mapa ficam no marcador Cena.'

/**
 * "Ir para Cena": a página Cena entra (animada só pelo ponteiro, como pelo
 * marcador; pelo teclado, troca na hora) e o foco vai ao "Chão do mapa" — o
 * link some junto com a Ficha, e o foco não pode cair no nada.
 */
function irAoChaoDoMapa(peloPonteiro: boolean): void {
  useLivroDoMestreStore.getState().abrirPagina('cena', peloPonteiro)
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('.gr-folha[data-pagina="cena"] [data-secao="floor"] .gr-ficha__cab')?.focus()
  })
}

function iconeDaOpcao(ferramenta: DrawingTool): ReactNode {
  const Icone = TOOL_ICONS[ferramenta]
  return Icone ? <Icone size={TAMANHO_DA_OPCAO} /> : null
}

/** As formas do Chão com os desenhos do protótipo (sala, elipse, polígono, caminho, blocos, balde). */
const ICONES_DA_FORMA_DO_CHAO: Partial<Record<string, ComponentType<{ size?: number }>>> = {
  rect: RoomIcon,
  ellipse: EllipseIcon,
  polygon: RegularPolygonIcon,
  corridor: PathIcon,
  blocos: FloorIcon,
  balde: BaldeIcon,
}

/**
 * A pinta de cor da tinta (a camada do Chão), no lugar do ícone. "Chão" não tem
 * cor própria — é a do chão do mapa —, então vira só o anel.
 */
function PintaDaTinta({ cor }: { cor: string | null }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      {cor === null ? <circle cx="10" cy="10" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.4" /> : <circle cx="10" cy="10" r="6" fill={cor} />}
    </svg>
  )
}

/** O desenho de cada opção que o cantinho da barra não tem: as formas e as tintas do Chão. */
function iconeDaFicha(grupo: ToolVariantGroup, id: string): ReactNode {
  if (grupo.storeKey === 'floorShapeKind') {
    const Icone = ICONES_DA_FORMA_DO_CHAO[id]
    return Icone ? <Icone size={TAMANHO_DA_OPCAO} /> : undefined
  }
  if (grupo.storeKey === 'floorCamada') return <PintaDaTinta cor={CAMADAS_DO_CHAO.find((camada) => camada.id === id)?.color ?? null} />
  return undefined
}

/**
 * Eixo que só vale com uma forma do Chão escolhida: o tamanho do pincel com o
 * Pincel de blocos, os lados com o Polígono regular. A ficha mostra só quando
 * vale, como o protótipo; o valor fica guardado (o cantinho da barra mostra
 * sempre).
 */
function grupoValeAgora(grupo: ToolVariantGroup, variantes: ToolVariantBindings): boolean {
  if (grupo.storeKey === 'floorBrushSize') return variantes.floorShapeKind.value === 'blocos'
  if (grupo.storeKey === 'floorPolygonSides') return variantes.floorShapeKind.value === 'polygon'
  return true
}

function CampoDaVariante({ grupo, variantes }: { grupo: ToolVariantGroup; variantes: ToolVariantBindings }) {
  const { opcoes, marcada, escolher } = eixoDaVariante(grupo, variantes, iconeDaOpcao)
  const comIcone = opcoes.map((opcao) => ({ ...opcao, icon: opcao.icon ?? iconeDaFicha(grupo, opcao.id) }))
  // Com ícone, três opções já pedem a grade (ícone em cima do nome, como as formas do protótipo).
  const temIcone = comIcone.some((opcao) => opcao.icon !== undefined && opcao.icon !== null)
  const emGrade = opcoes.length > OPCOES_NUMA_LINHA || (temIcone && opcoes.length > 2)
  return (
    <CampoSeg
      rotulo={grupo.label}
      forma={emGrade ? 'grade' : 'linha'}
      opcoes={comIcone.map((opcao) => ({ valor: opcao.id, rotulo: opcao.label, icone: opcao.icon, atalho: opcao.atalho }))}
      valor={marcada ?? ''}
      onChange={escolher}
    />
  )
}

export interface FichaDaFerramentaProps {
  ferramenta: DrawingTool
  /**
   * As preferências da PRÓXIMA peça, as mesmas do cantinho da barra (App.tsx).
   * Ausente, a ficha mostra só os controles de sempre (`children`).
   */
  variantes?: ToolVariantBindings
  /** Os controles da ferramenta, os de sempre (`PropertiesPanel`), dentro do cartão. */
  children?: ReactNode
}

/**
 * A ficha da ferramenta armada, com nada selecionado: a cabeça (medalha com o
 * ícone da barra, o nome, a dica curta e a tecla) e um cartão com as variantes
 * e os controles da ferramenta. O nome é o primeiro título da página, dito
 * "Ferramenta · Sala Circular" ao leitor de tela: é a ferramenta na mão, não
 * um item do mapa.
 */
export function FichaDaFerramenta({ ferramenta, variantes, children }: FichaDaFerramentaProps) {
  const Icone = TOOL_ICONS[ferramenta]
  const paredeSolta = ferramenta === 'roomFree' && variantes?.roomFreeKind.value === 'parede'
  const dica = paredeSolta ? DICA_DA_FICHA_SALA_LIVRE_PAREDE : (DICAS_DA_FICHA[ferramenta] ?? '')
  const grupos = variantes === undefined ? [] : variantesDaFicha(ferramenta).filter((grupo) => grupoValeAgora(grupo, variantes))
  const nota = NOTAS_DA_FICHA[ferramenta]
  return (
    <div className="lb-ficha-ferramenta">
      <Cabeca
        marca={<CabecaMedalha>{Icone ? <Icone size={TAMANHO_DA_MEDALHA} /> : null}</CabecaMedalha>}
        nome={TOOL_LABELS[ferramenta] ?? ferramenta}
        tipo={dica}
        atalho={TOOL_SHORTCUTS[ferramenta] || undefined}
        comoTitulo
        prefixoOculto="Ferramenta · "
      />
      <div className="gr-ficha gr-ficha--plana">
        <div className="gr-ficha__dentro">
          {variantes !== undefined && grupos.map((grupo) => <CampoDaVariante key={`${grupo.storeKey}:${grupo.label}`} grupo={grupo} variantes={variantes} />)}
          {children}
          {nota !== undefined && <Nota>{nota}</Nota>}
          {ferramenta === 'floor' && (
            <Nota ir={{ rotulo: 'Ir para Cena', onClick: (evento) => irAoChaoDoMapa(evento.detail > 0) }}>{NOTA_DO_CHAO}</Nota>
          )}
        </div>
      </div>
    </div>
  )
}
