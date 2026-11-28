import { useEffect, useRef, useState } from 'react'
import { CampoLiga } from '../../grimorio/CampoLiga'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { CampoTexto } from '../../grimorio/CampoTexto'
import { Botao } from '../../grimorio/Botao'
import { useImagemDaMesa } from '../../ImagemDaMesa'
import { urlDaFigura } from '../../../puzzles/camadas/arte'
import { camadasDoPuzzle, codigoLimpo, idDoItemDaLamina, marcasDas, NOME_DA_FIGURA, NOME_DO_MATERIAL_DAS_CAMADAS, nomeDaLamina, quantasLaminas, sementeNova } from '../../../puzzles/camadas/camadas'
import { CODIGO_DAS_CAMADAS_MAX, FIGURAS_DAS_CAMADAS, LAMINAS_MAX, LAMINAS_MIN, MATERIAIS_DAS_CAMADAS, type CamadasDoPuzzle } from '../../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../../stores/acervoDeItensStore'
import { comCamadas } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'
import '../../../puzzles/camadas/camadas.css'

/**
 * AS CAMADAS NA FICHA DO EDITOR (28/11): o material das lâminas, a figura que
 * elas formam juntas (uma de fábrica, um código seu ou uma imagem sua), em
 * quantas lâminas ela se divide, se a ordem e o giro importam, e um corte
 * novo. Cada lâmina vira um item do acervo; o que destrava fica em "Ao
 * resolver". Sempre tem solução: tudo na mesa, de pé e na ordem.
 */

const OPCOES_DO_MATERIAL = MATERIAIS_DAS_CAMADAS.map((material) => ({ valor: material, rotulo: NOME_DO_MATERIAL_DAS_CAMADAS[material] }))
const OPCOES_DE_QUANTAS: readonly { valor: string; rotulo: string }[] = Array.from({ length: LAMINAS_MAX - LAMINAS_MIN + 1 }, (_, i) => {
  const n = String(LAMINAS_MIN + i)
  return { valor: n, rotulo: n }
})

function iconeDaFigura(figura: CamadasDoPuzzle['figura']) {
  const url = figura === 'codigo' ? urlDaFigura('codigo', '42') : urlDaFigura(figura, '')
  return url === null ? undefined : <img className="pze-cam-icone" src={url} alt="" draggable={false} />
}

const OPCOES_DA_FIGURA = FIGURAS_DAS_CAMADAS.map((figura) => ({ valor: figura, rotulo: NOME_DA_FIGURA[figura], icone: iconeDaFigura(figura) }))

/** O código só vale depois de uma pausa na digitação: cada código é um jogo de lâminas novo no acervo. */
const PAUSA_DO_CODIGO_MS = 800

export function SecaoCamadas({ puzzle, mudar, onImagem }: PropsDaSecao & { onImagem: () => void }) {
  const camadas = camadasDoPuzzle(puzzle)
  const itens = useAcervoDeItensStore((estado) => estado.itens)
  const resolver = useImagemDaMesa()
  /** Uma mudança na mesa; as lâminas (encaixes e itens) saem de novo dela. */
  const trocar = (mudanca: Partial<CamadasDoPuzzle>, novasQuantas?: number) => mudar((atual) => comCamadas(atual, (antes) => ({ ...antes, ...mudanca }), novasQuantas))
  const [rascunho, setRascunho] = useState<string | null>(null)
  const trocarAgora = useRef(trocar)
  trocarAgora.current = trocar
  useEffect(() => {
    if (rascunho === null) return
    const id = window.setTimeout(() => {
      const codigo = codigoLimpo(rascunho)
      if (codigo !== '') trocarAgora.current({ codigo })
      setRascunho(null)
    }, PAUSA_DO_CODIGO_MS)
    return () => window.clearTimeout(id)
  }, [rascunho])
  if (camadas === null) return null
  const quantas = quantasLaminas(puzzle)
  const semImagem = camadas.figura === 'imagem' && camadas.imagem === null

  return (
    <Secao titulo="Mesa de luz" conta={quantas}>
      <CampoSeg rotulo="Lâminas de" opcoes={OPCOES_DO_MATERIAL} valor={camadas.material} onChange={(material) => material !== camadas.material && trocar({ material })} />
      <CampoSeg rotulo="Figura que se forma" opcoes={OPCOES_DA_FIGURA} forma="grade" valor={camadas.figura} onChange={(figura) => figura !== camadas.figura && trocar({ figura })} />
      {camadas.figura === 'codigo' && (
        <CampoTexto rotulo={`O código (até ${CODIGO_DAS_CAMADAS_MAX} letras ou números)`} valor={rascunho ?? camadas.codigo} maxLength={CODIGO_DAS_CAMADAS_MAX} onChange={setRascunho} />
      )}
      {camadas.figura === 'imagem' && (
        <Botao variante="latao" tamanho="p" className="pze-alinha-inicio" onClick={onImagem}>
          {camadas.imagem === null ? 'Escolher a imagem' : 'Trocar a imagem'}
        </Botao>
      )}
      <CampoSeg
        rotulo="Em quantas lâminas"
        opcoes={OPCOES_DE_QUANTAS}
        valor={String(quantas)}
        onChange={(valor) => {
          const n = Number(valor)
          if (n !== quantas) trocar({}, n)
        }}
      />
      <CampoLiga
        rotulo="O giro importa"
        ajuda={camadas.rotacaoImporta ? 'Cada lâmina pousa torta e o jogador a gira de 90 em 90 graus até a figura endireitar.' : 'As lâminas pousam de pé: basta a ordem (se ela importar) ou pôr todas.'}
        ligado={camadas.rotacaoImporta}
        onChange={(rotacaoImporta) => trocar({ rotacaoImporta })}
      />
      <CampoLiga
        rotulo="A ordem importa"
        ajuda={camadas.ordemImporta ? 'Cada lâmina de baixo tem uma mancha que só a de cima certa cobre: fora de ordem, a mancha aparece.' : 'Qualquer ordem fecha a figura.'}
        ligado={camadas.ordemImporta}
        onChange={(ordemImporta) => trocar({ ordemImporta })}
      />
      <Botao tamanho="p" className="pze-alinha-inicio" onClick={() => trocar({ semente: sementeNova() })}>
        Cortar de novo
      </Botao>
      <p className="pze-nota">
        Cada lâmina vira um item do acervo, na pasta Peça de puzzle: espalhe pelo mapa, num baú ou com um NPC. Mudar a figura, o material, o corte ou as regras faz lâminas novas. Mexer não castiga: a figura certa destrava o que você escolher em Ao resolver.
      </p>
      {semImagem ? (
        <p className="pze-vazio">Escolha a imagem para as lâminas virarem itens.</p>
      ) : (
        <ul className="pze-placas">
          {marcasDas(camadas, quantas).map((marca) => {
            const item = itens.find((candidato) => candidato.id === idDoItemDaLamina(camadas, quantas, marca))
            const src = item === undefined ? null : resolver(item.imagem)
            return (
              <li key={marca} className="pze-placa">
                <span className="pze-placa__arte" aria-hidden="true">
                  {src !== null && <img src={src} alt="" draggable={false} />}
                </span>
                <span className="pze-placa__nome">{item?.nome ?? nomeDaLamina(camadas, marca)}</span>
                <span className="pze-placa__onde">{item === undefined ? 'indo para o acervo…' : 'no acervo'}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Secao>
  )
}
