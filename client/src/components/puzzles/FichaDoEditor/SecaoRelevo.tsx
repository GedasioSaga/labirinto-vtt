import { useEffect, useState } from 'react'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { useImagemDaMesa } from '../../ImagemDaMesa'
import { NOME_DA_CENA, NOME_DO_METAL } from '../../../puzzles/relevo/arte'
import { urlDoSvgDoPainel } from '../../../puzzles/relevo/miniatura'
import { comQuantasPlacas, comVisualDoRelevo, idDoItemDaPlaca, nomeDaPlaca, placasDoPuzzle } from '../../../puzzles/relevo/relevo'
import { CENAS_DO_RELEVO, LACUNAS_DO_RELEVO_MAX, LACUNAS_DO_RELEVO_MIN, METAIS_DO_RELEVO, type CenaDoRelevo, type MetalDoRelevo, type VisualDoRelevo } from '../../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../../stores/acervoDeItensStore'
import { Botao } from '../../grimorio/Botao'
import { Secao, type PropsDaSecao } from './comum'

/**
 * O PAINEL EM RELEVO NA FICHA DO EDITOR (28/11): a escolha da cena (ou de uma
 * imagem sua cortada nas mesmas placas), o metal, quantas placas faltam e as
 * placas que já são itens do acervo.
 */

const OPCOES_DO_METAL: readonly { valor: MetalDoRelevo; rotulo: string }[] = METAIS_DO_RELEVO.map((metal) => ({ valor: metal, rotulo: NOME_DO_METAL[metal] }))

const OPCOES_DE_QUANTAS: readonly { valor: string; rotulo: string }[] = Array.from({ length: LACUNAS_DO_RELEVO_MAX - LACUNAS_DO_RELEVO_MIN + 1 }, (_, i) => {
  const n = String(LACUNAS_DO_RELEVO_MIN + i)
  return { valor: n, rotulo: n }
})

interface PropsDaEscolha {
  visual: VisualDoRelevo | null
  /** Uma cena de fábrica: o puzzle vira o painel dela (o Desfazer volta). */
  onCena: (cena: CenaDoRelevo) => void
  /** "Imagem sua em placas": escolher a imagem no computador. */
  onImagem: () => void
}

/**
 * Quantas miniaturas já aparecem: uma a mais por quadro. O navegador monta cada
 * SVG do painel na linha principal; os seis de uma vez travavam a abertura do editor.
 */
export function useUmaPorQuadro(total: number): number {
  const [prontas, setProntas] = useState(0)
  useEffect(() => {
    if (prontas >= total) return
    const quadro = requestAnimationFrame(() => setProntas((n) => n + 1))
    return () => cancelAnimationFrame(quadro)
  }, [prontas, total])
  return prontas
}

/** As seis cenas e a imagem própria, no mesmo jeito das miniaturas dos modelos. */
export function EscolhaDoRelevo({ visual, onCena, onImagem }: PropsDaEscolha) {
  const prontas = useUmaPorQuadro(CENAS_DO_RELEVO.length)
  return (
    <div className="gr-campo">
      <span className="gr-campo__rot">Painel em relevo</span>
      <div className="pze-modelos">
        {CENAS_DO_RELEVO.map((cena, i) => (
          <button key={cena} type="button" className="pze-modelo" aria-pressed={visual?.cena === cena} aria-label={`Painel em relevo: ${NOME_DA_CENA[cena]}`} onClick={() => onCena(cena)}>
            {i < prontas && <img className="pze-modelo__arte" src={urlDoSvgDoPainel(cena, 'bronze')} alt="" draggable={false} />}
            <span className="pze-modelo__nome">{NOME_DA_CENA[cena]}</span>
          </button>
        ))}
      </div>
      <Botao variante="latao" tamanho="p" className="pze-alinha-inicio" aria-pressed={visual !== null && visual.cena === null} onClick={onImagem}>
        {visual !== null && visual.cena === null && visual.imagem !== null ? 'Trocar a imagem das placas' : 'Imagem sua em placas'}
      </Botao>
    </div>
  )
}

/** As placas que faltam: o metal, quantas, e cada uma como item do acervo. */
export function SecaoPlacas({ puzzle, mudar, visual }: PropsDaSecao & { visual: VisualDoRelevo }) {
  const placas = placasDoPuzzle(puzzle)
  const itens = useAcervoDeItensStore((estado) => estado.itens)
  const resolver = useImagemDaMesa()
  return (
    <Secao titulo="Placas que faltam" conta={placas.length}>
      {visual.cena !== null && (
        <CampoSeg rotulo="Metal" opcoes={OPCOES_DO_METAL} valor={visual.metal} onChange={(metal) => metal !== visual.metal && mudar((atual) => comVisualDoRelevo(atual, { ...visual, metal }))} />
      )}
      <CampoSeg
        rotulo="Quantas faltam"
        opcoes={OPCOES_DE_QUANTAS}
        valor={String(placas.length)}
        onChange={(valor) => {
          const quantas = Number(valor)
          if (quantas !== placas.length) mudar((atual) => comQuantasPlacas(atual, quantas))
        }}
      />
      <p className="pze-nota">
        Clique numa placa do painel, ao lado, para trocar quais faltam. Cada placa vira um item do acervo, na pasta Peça de puzzle: espalhe pelo mapa, num baú ou com um NPC. Ao completar, o painel destrava o que você escolher em Ao resolver.
      </p>
      {visual.cena === null && visual.imagem === null ? (
        <p className="pze-vazio">Escolha a imagem do painel para as placas virarem itens.</p>
      ) : (
        <ul className="pze-placas">
          {placas.map((placa) => {
            const itemId = idDoItemDaPlaca(visual, placa)
            const item = itemId === null ? undefined : itens.find((candidato) => candidato.id === itemId)
            const src = item === undefined ? null : resolver(item.imagem)
            return (
              <li key={placa} className="pze-placa">
                <span className="pze-placa__arte" aria-hidden="true">
                  {src !== null && <img src={src} alt="" draggable={false} />}
                </span>
                <span className="pze-placa__nome">{item?.nome ?? nomeDaPlaca(visual, placa)}</span>
                <span className="pze-placa__onde">{item === undefined ? 'indo para o acervo…' : 'no acervo'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Secao>
  )
}
