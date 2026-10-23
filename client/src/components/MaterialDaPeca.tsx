import { useId, useRef, type CSSProperties } from 'react'
import type { AparenciaDoMovelPatch } from '../lib/mobilia'
import type { PecaNova } from '../lib/mobilia/pecasNovas'
import { normalizarCorDoMovel } from '../lib/mobilia'
import { LUGARES_DE_MATERIAL, MATERIAIS, ehMaterial, materialMaisPerto, type IdDoMaterial, type LugarDeMaterial } from '../texturas/meioTermo/materiais'
import type { Prop } from '../types/map'
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

interface LugarProps {
  lugar: LugarDeMaterial
  /** O material que vale agora (a cor gravada, levada ao material mais perto do lugar). */
  marcado: IdDoMaterial
  onEscolher: (material: IdDoMaterial) => void
}

/**
 * Um lugar de material (a madeira, as pedras, o toldo): o nome do lugar com o
 * material escolhido escrito ao lado e uma amostra por material, no tom que o
 * mapa pinta. Um grupo de rádio: Tab entra pela marcada, as setas andam.
 */
function LugarDeMaterialCampo({ lugar, marcado, onEscolher }: LugarProps) {
  const rotuloId = useId()
  const amostras = useRef<(HTMLButtonElement | null)[]>([])
  const opcoes = lugar.opcoes.filter(ehMaterial)
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
        <span className="lb-material__escolhido">{MATERIAIS[marcado].nome}</span>
      </div>
      <div className="lb-material__amostras" role="radiogroup" aria-labelledby={rotuloId}>
        {opcoes.map((opcao, i) => {
          const material = MATERIAIS[opcao]
          const estilo: EstiloDaAmostra = { '--amostra': material.tom }
          return (
            <button
              key={opcao}
              ref={(amostra) => {
                amostras.current[i] = amostra
              }}
              type="button"
              role="radio"
              aria-checked={opcao === marcado}
              aria-label={material.nome}
              title={material.nome}
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

/** O material que vale num lugar da peça nova. */
export interface MaterialNoLugar {
  lugar: LugarDeMaterial
  material: IdDoMaterial
}

/**
 * Lugar a lugar, o material que vale agora na peça nova: a cor gravada (o 1º
 * lugar na "Cor", o 2º na "Cor da linha") levada ao material mais perto do
 * lugar; sem cor, o padrão do lugar. É o que o painel marca e o que o resumo
 * da ficha escreve.
 */
export function materiaisDaPeca(prop: Prop, tipo: PecaNova): MaterialNoLugar[] {
  const cores = [normalizarCorDoMovel(prop.mobiliaCor), normalizarCorDoMovel(prop.mobiliaCorDaLinha)]
  return LUGARES_DE_MATERIAL[tipo].map((lugar, i) => {
    const perto = materialMaisPerto(cores[i], lugar)
    return { lugar, material: ehMaterial(perto) ? perto : 'carvalho' }
  })
}

export interface MaterialDaPecaProps {
  prop: Prop
  tipo: PecaNova
  onAparenciaChange: (id: string, patch: AparenciaDoMovelPatch) => void
}

/**
 * APARÊNCIA DA PEÇA NOVA (MT4): o material no lugar da cor livre, decisão do
 * usuário. A peça nova sai sempre com textura, então "Preencher" e a cor
 * livre não teriam efeito; cada lugar grava o tom OFICIAL do material
 * (`MATERIAIS[id].hex`) no campo de cor que já existe: o primeiro lugar na
 * "Cor" (`mobiliaCor`), o segundo na "Cor da linha" (`mobiliaCorDaLinha`).
 * Sem campo novo no arquivo; o desenho lê o material mais perto da cor.
 */
export function MaterialDaPeca({ prop, tipo, onAparenciaChange }: MaterialDaPecaProps) {
  return (
    <section className="lb-section">
      {materiaisDaPeca(prop, tipo).map(({ lugar, material: marcado }, i) => (
        <LugarDeMaterialCampo
          key={lugar.id}
          lugar={lugar}
          marcado={marcado}
          onEscolher={(material) => onAparenciaChange(prop.id, i === 0 ? { cor: MATERIAIS[material].hex } : { corDaLinha: MATERIAIS[material].hex })}
        />
      ))}
    </section>
  )
}
