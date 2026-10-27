import { useId, useRef, type CSSProperties } from 'react'
import type { AparenciaDoMovelPatch } from '../lib/mobilia'
import { normalizarCorDeTecido, normalizarCorDoMovel } from '../lib/mobilia'
import {
  LUGARES_DE_MATERIAL,
  MATERIAIS,
  ehMaterial,
  materialMaisPerto,
  type LugarDeMaterial,
  type OpcaoDeMaterial,
  type ReferenciaAMadeira,
} from '../texturas/meioTermo/materiais'
import type { Prop, TipoMobilia } from '../types/map'
import './MaterialDaPeca.css'

type EstiloDaAmostra = CSSProperties & { '--amostra': string }

/** A tecla que anda nas amostras, para onde ela leva a partir de `i`; `null` = não é tecla de andar. */
function destino(tecla: string, i: number, ultimo: number): number | null {
  if (tecla === 'ArrowRight' || tecla === 'ArrowDown') return i === ultimo ? 0 : i + 1
  if (tecla === 'ArrowLeft' || tecla === 'ArrowUp') return i === 0 ? ultimo : i - 1
  if (tecla === 'Home') return 0
  if (tecla === 'End') return ultimo
  return null
}

/**
 * O campo de cor do arquivo que guarda o material de cada lugar, na ordem dos
 * lugares: a cama usa as 3 cores de hoje (madeira, cobertor, travesseiro); o
 * resto, a "Cor" (o 1º lugar) e a "Cor da linha" (o 2º). É a mesma ordem que o
 * desenho lê (`materiaisDoMovel` em `pixi/rasterDosMoveis.ts`).
 */
export type CampoDoMaterial = 'cor' | 'corDaLinha' | 'corDoCobertor' | 'corDoTravesseiro'

function camposDosLugares(tipo: TipoMobilia): readonly CampoDoMaterial[] {
  return tipo === 'catre' ? ['cor', 'corDoCobertor', 'corDoTravesseiro'] : ['cor', 'corDaLinha']
}

function corGravada(prop: Prop, campo: CampoDoMaterial): string | undefined {
  switch (campo) {
    case 'cor':
      return normalizarCorDoMovel(prop.mobiliaCor)
    case 'corDaLinha':
      return normalizarCorDoMovel(prop.mobiliaCorDaLinha)
    case 'corDoCobertor':
      return normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoCobertor)
    case 'corDoTravesseiro':
      return normalizarCorDeTecido(prop.mobilia, prop.mobiliaCorDoTravesseiro)
  }
}

/** O pedido ao painel que grava `cor` (o tom oficial, ou `null` = sem cor) no campo do lugar. */
function pedidoDoCampo(campo: CampoDoMaterial, cor: string | null): AparenciaDoMovelPatch {
  switch (campo) {
    case 'cor':
      return { cor }
    case 'corDaLinha':
      return { corDaLinha: cor }
    case 'corDoCobertor':
      return { corDoCobertor: cor }
    case 'corDoTravesseiro':
      return { corDoTravesseiro: cor }
  }
}

/** As opções sem cor própria usam a madeira do móvel: as varas da cerca e o assento de madeira da cadeira. */
const NOME_DA_REFERENCIA: Readonly<Record<ReferenciaAMadeira, string>> = { varas: 'Varas', mesma: 'Madeira' }

/** O nome de uma opção de material, para o painel e para o resumo da ficha. */
export function nomeDaOpcao(opcao: OpcaoDeMaterial): string {
  return ehMaterial(opcao) ? MATERIAIS[opcao].nome : NOME_DA_REFERENCIA[opcao]
}

/**
 * As opções que o painel consegue gravar num lugar: cada material (o tom
 * oficial no campo de cor) e, quando ela é o PADRÃO do lugar, a opção sem cor
 * própria (gravada como "sem cor": as varas da cerca). A outra opção sem cor
 * (o assento de madeira da cadeira, que não é o padrão) não tem como ser
 * gravada nos campos de hoje, e controle sem efeito não entra.
 */
function opcoesGravaveis(lugar: LugarDeMaterial): OpcaoDeMaterial[] {
  return lugar.opcoes.filter((opcao) => ehMaterial(opcao) || opcao === lugar.padrao)
}

interface LugarProps {
  lugar: LugarDeMaterial
  /** O material que vale agora (a cor gravada, levada ao material mais perto do lugar). */
  marcado: OpcaoDeMaterial
  /** O tom da amostra da opção sem cor própria: o da madeira do móvel. */
  tomDaMadeira: string
  onEscolher: (opcao: OpcaoDeMaterial) => void
}

/**
 * Um lugar de material (a madeira, as pedras, o toldo): o nome do lugar com o
 * material escolhido escrito ao lado e uma amostra por material, no tom que o
 * mapa pinta. Um grupo de rádio: Tab entra pela marcada, as setas andam.
 */
function LugarDeMaterialCampo({ lugar, marcado, tomDaMadeira, onEscolher }: LugarProps) {
  const rotuloId = useId()
  const amostras = useRef<(HTMLButtonElement | null)[]>([])
  const opcoes = opcoesGravaveis(lugar)
  const ultimo = opcoes.length - 1

  function escolher(i: number): void {
    const opcao = opcoes[i]
    if (opcao === undefined) return
    onEscolher(opcao)
    amostras.current[i]?.focus()
  }

  return (
    <div className="lb-field lb-material">
      <div className="lb-material__cabeca">
        <span className="lb-label" id={rotuloId}>
          {lugar.nome}
        </span>
        <span className="lb-material__escolhido">{nomeDaOpcao(marcado)}</span>
      </div>
      <div className="lb-material__amostras" role="radiogroup" aria-labelledby={rotuloId}>
        {opcoes.map((opcao, i) => {
          const estilo: EstiloDaAmostra = { '--amostra': ehMaterial(opcao) ? MATERIAIS[opcao].tom : tomDaMadeira }
          return (
            <button
              key={opcao}
              ref={(amostra) => {
                amostras.current[i] = amostra
              }}
              type="button"
              role="radio"
              aria-checked={opcao === marcado}
              aria-label={nomeDaOpcao(opcao)}
              title={nomeDaOpcao(opcao)}
              className="lb-paleta__amostra lb-material__amostra"
              style={estilo}
              tabIndex={opcao === marcado ? 0 : -1}
              onClick={() => escolher(i)}
              onKeyDown={(evento) => {
                const alvo = destino(evento.key, i, ultimo)
                if (alvo === null) return
                evento.preventDefault()
                // A tecla é das amostras: sem isto as setas chegavam ao atalho do mapa e empurravam a peça.
                evento.stopPropagation()
                escolher(alvo)
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/** O material que vale num lugar do móvel, e o campo do arquivo que o guarda. */
export interface MaterialNoLugar {
  lugar: LugarDeMaterial
  material: OpcaoDeMaterial
  campo: CampoDoMaterial
}

/**
 * Lugar a lugar, o material que vale agora no móvel com textura: a cor
 * gravada no campo do lugar levada ao material mais perto dele; sem cor, o
 * padrão do lugar. É o que o painel marca e o que o resumo da ficha escreve.
 */
export function materiaisDaPeca(prop: Prop, tipo: TipoMobilia): MaterialNoLugar[] {
  const campos = camposDosLugares(tipo)
  return LUGARES_DE_MATERIAL[tipo].map((lugar, i) => {
    const campo = campos[i] ?? 'cor'
    return { lugar, campo, material: materialMaisPerto(corGravada(prop, campo), lugar) }
  })
}

export interface MaterialDaPecaProps {
  prop: Prop
  tipo: TipoMobilia
  onAparenciaChange: (id: string, patch: AparenciaDoMovelPatch) => void
}

/**
 * APARÊNCIA DO MÓVEL COM TEXTURA: o material no lugar da cor livre, decisão
 * do usuário. Vale para a peça nova (MT4, sempre com textura) e, com o
 * Meio-Termo ligado (MT12), para os 11 móveis de antes que não pediram a
 * versão em linhas: "Preencher" e a cor livre não teriam efeito no desenho
 * com textura. Cada lugar grava o tom OFICIAL do material
 * (`MATERIAIS[id].hex`) no campo de cor que já existe para ele (a "Cor", a
 * "Cor da linha" ou, na cama, as cores do cobertor e do travesseiro); a opção
 * sem cor própria grava "sem cor". Sem campo novo no arquivo; o desenho lê o
 * material mais perto da cor. Lugar com uma opção só não é escolha e não entra.
 */
export function MaterialDaPeca({ prop, tipo, onAparenciaChange }: MaterialDaPecaProps) {
  const materiais = materiaisDaPeca(prop, tipo)
  const madeira = materiais[0]?.material
  const tomDaMadeira = madeira !== undefined && ehMaterial(madeira) ? MATERIAIS[madeira].tom : MATERIAIS.carvalho.tom
  return (
    <section className="lb-section">
      {materiais
        .filter(({ lugar }) => opcoesGravaveis(lugar).length > 1)
        .map(({ lugar, campo, material: marcado }) => (
          <LugarDeMaterialCampo
            key={lugar.id}
            lugar={lugar}
            marcado={marcado}
            tomDaMadeira={tomDaMadeira}
            onEscolher={(opcao) => onAparenciaChange(prop.id, pedidoDoCampo(campo, ehMaterial(opcao) ? MATERIAIS[opcao].hex : null))}
          />
        ))}
    </section>
  )
}
