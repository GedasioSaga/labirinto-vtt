import { useState } from 'react'
import { Botao } from '../../grimorio/Botao'
import { CampoLiga } from '../../grimorio/CampoLiga'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { colunasDoPainel, interruptoresDoPuzzle, lerInterruptores, NOME_DA_LIGACAO, NOME_DO_MATERIAL_DO_PAINEL, NOME_DO_OBJETIVO, sementeNova, viradosPor } from '../../../puzzles/interruptores/interruptores'
import { INTERRUPTORES_MAX, INTERRUPTORES_MIN, LIGACOES_DOS_INTERRUPTORES, MATERIAIS_DOS_INTERRUPTORES, OBJETIVOS_DOS_INTERRUPTORES, type InterruptoresDoPuzzle } from '../../../puzzles/tipos'
import { comInterruptores } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'

/**
 * OS INTERRUPTORES NA FICHA DO EDITOR (28/11): o metal da chapa, quantos
 * lampiões, o que cada alavanca vira (os do lado, a linha e a coluna, ou a sua
 * regra, clicando quem vira quem), o objetivo (todos acesos ou um desenho que
 * você risca clicando nos lampiões) e um embaralho novo. O que destrava fica em
 * "Ao resolver".
 */

const OPCOES_DO_MATERIAL = MATERIAIS_DOS_INTERRUPTORES.map((material) => ({ valor: material, rotulo: NOME_DO_MATERIAL_DO_PAINEL[material] }))
const OPCOES_DA_LIGACAO = LIGACOES_DOS_INTERRUPTORES.map((ligacao) => ({ valor: ligacao, rotulo: NOME_DA_LIGACAO[ligacao] }))
const OPCOES_DO_OBJETIVO = OBJETIVOS_DOS_INTERRUPTORES.map((objetivo) => ({ valor: objetivo, rotulo: NOME_DO_OBJETIVO[objetivo] }))
const OPCOES_DE_QUANTOS: readonly { valor: string; rotulo: string }[] = Array.from({ length: INTERRUPTORES_MAX - INTERRUPTORES_MIN + 1 }, (_, i) => {
  const n = String(INTERRUPTORES_MIN + i)
  return { valor: n, rotulo: n }
})

const AJUDA_DA_LIGACAO: Readonly<Record<InterruptoresDoPuzzle['ligacao'], string>> = {
  vizinhos: 'Cada alavanca vira o lampião dela e os encostados: em cima, embaixo, à esquerda e à direita.',
  linha: 'Cada alavanca vira o lampião dela e todos da mesma linha e da mesma coluna. Numa fila só, vira todos.',
  propria: 'Escolha uma alavanca abaixo e marque os lampiões que ela vira junto com o dela.',
}

interface PropsDaGrade {
  quantos: number
  rotulo: string
  /** O lampião `i` aparece aceso. */
  aceso: (i: number) => boolean
  /** A alavanca em destaque (a que está sendo ligada). */
  destaque?: number | null
  nome: (i: number) => string
  onTocar: (i: number) => void
}

/** A grade do painel em miniatura: uma casa por lampião, na mesma ordem e no mesmo arranjo do quadro. */
function GradeDeLampioes({ quantos, rotulo, aceso, destaque = null, nome, onTocar }: PropsDaGrade) {
  return (
    <div className="pze-lampioes" role="group" aria-label={rotulo} style={{ gridTemplateColumns: `repeat(${colunasDoPainel(quantos)}, 44px)` }}>
      {Array.from({ length: quantos }, (_, i) => (
        <button key={i} type="button" className="pze-lampiao" data-destaque={destaque === i || undefined} aria-pressed={aceso(i)} aria-label={nome(i)} title={nome(i)} onClick={() => onTocar(i)}>
          <span className="pze-lampiao__luz" aria-hidden="true" />
          <span className="pze-lampiao__n" aria-hidden="true">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  )
}

export function SecaoInterruptores({ puzzle, mudar }: PropsDaSecao) {
  const interruptores = interruptoresDoPuzzle(puzzle)
  // A alavanca que o mestre está ligando na regra dele (só na tela do editor).
  const [ligando, setLigando] = useState<number | null>(null)
  if (interruptores === null) return null
  const { quantos } = interruptores
  const alavanca = ligando !== null && ligando < quantos ? ligando : null
  /** Uma mudança no painel, relida pelo leitor (as ligações e o desenho acompanham o número de lampiões). */
  const trocar = (mudanca: Partial<InterruptoresDoPuzzle>) => mudar((atual) => comInterruptores(atual, (antes) => lerInterruptores({ ...antes, ...mudanca }) ?? antes))

  const tocarNaRegra = (i: number) => {
    if (alavanca === null || alavanca === i) {
      setLigando(alavanca === i ? null : i)
      return
    }
    const deste = interruptores.ligados[alavanca] ?? []
    const proximo = deste.includes(i) ? deste.filter((j) => j !== i) : [...deste, i]
    trocar({ ligados: interruptores.ligados.map((lista, k) => (k === alavanca ? proximo : lista)) })
  }

  return (
    <Secao titulo="Painel de lampiões">
      <CampoSeg rotulo="Chapa" opcoes={OPCOES_DO_MATERIAL} valor={interruptores.material} onChange={(material) => material !== interruptores.material && trocar({ material })} />
      <CampoSeg
        rotulo="Lampiões"
        opcoes={OPCOES_DE_QUANTOS}
        valor={String(quantos)}
        onChange={(valor) => {
          const n = Number(valor)
          if (n !== quantos) trocar({ quantos: n })
        }}
      />
      <CampoSeg rotulo="Cada alavanca vira" opcoes={OPCOES_DA_LIGACAO} valor={interruptores.ligacao} onChange={(ligacao) => ligacao !== interruptores.ligacao && trocar({ ligacao })} />
      <p className="pze-nota">{AJUDA_DA_LIGACAO[interruptores.ligacao]}</p>
      {interruptores.ligacao === 'propria' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">{alavanca === null ? 'Clique numa alavanca para ligar' : `Alavanca ${alavanca + 1}: clique nos lampiões que ela vira (clique nela de novo para terminar)`}</span>
          <GradeDeLampioes
            quantos={quantos}
            rotulo="Quem vira quem"
            destaque={alavanca}
            aceso={(i) => alavanca !== null && viradosPor(interruptores, alavanca).includes(i)}
            nome={(i) => (alavanca === null ? `Ligar a alavanca ${i + 1}` : i === alavanca ? `Alavanca ${i + 1}: terminar` : `Lampião ${i + 1}: virar junto com a alavanca ${alavanca + 1}`)}
            onTocar={tocarNaRegra}
          />
        </div>
      )}
      <CampoSeg rotulo="Objetivo" opcoes={OPCOES_DO_OBJETIVO} valor={interruptores.objetivo} onChange={(objetivo) => objetivo !== interruptores.objetivo && trocar({ objetivo })} />
      {interruptores.objetivo === 'desenho' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">O desenho: clique nos lampiões que precisam ficar acesos</span>
          <GradeDeLampioes
            quantos={quantos}
            rotulo="O desenho"
            aceso={(i) => interruptores.desenho[i] === true}
            nome={(i) => `Lampião ${i + 1} ${interruptores.desenho[i] === true ? 'aceso' : 'apagado'} no desenho`}
            onTocar={(i) => trocar({ desenho: interruptores.desenho.map((acesa, k) => (k === i ? !acesa : acesa)) })}
          />
          <CampoLiga
            rotulo="Mostrar o desenho numa plaqueta do painel"
            ajuda={interruptores.desenhoNoPainel ? 'O jogador vê o desenho gravado em cima dos lampiões.' : 'O desenho fica com você: dê como pista (um documento, por exemplo).'}
            ligado={interruptores.desenhoNoPainel}
            onChange={(desenhoNoPainel) => trocar({ desenhoNoPainel })}
          />
        </div>
      )}
      <Botao tamanho="p" className="pze-alinha-inicio" onClick={() => trocar({ embaralho: sementeNova() })}>
        Embaralhar de novo
      </Botao>
      <p className="pze-nota">O jogador começa do embaralho que o quadro mostra, e sempre tem volta. Puxar não castiga: o painel certo destrava o que você escolher em Ao resolver.</p>
    </Secao>
  )
}
