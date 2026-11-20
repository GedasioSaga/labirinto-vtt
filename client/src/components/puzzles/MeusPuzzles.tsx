import { useEffect, useMemo, useState } from 'react'
import { Botao } from '../grimorio/Botao'
import { useImagemDaMesa } from '../ImagemDaMesa'
import { desafiosDo } from '../../lib/desafios'
import { ArteSvg } from '../../puzzles/arte/ArteSvg'
import { desenhoDoModelo } from '../../puzzles/arte/modelos'
import { situacaoDaCopia, type SituacaoDaCopia } from '../../puzzles/meusPuzzles'
import { puzzleDoModelo } from '../../puzzles/padroes'
import type { IdDaPecaDesenhada, MinigamePuzzle, ModeloDePuzzle, Puzzle } from '../../puzzles/tipos'
import { lerOAcervoSeFaltar } from '../../stores/acervoDeItensStore'
import { useDesafiosStore } from '../../stores/desafiosStore'
import { useMapStore } from '../../stores/mapStore'
import { useMeusPuzzlesStore } from '../../stores/meusPuzzlesStore'
import { useEditorDoPuzzleStore } from './editorDoPuzzleStore'
import { usePecasDoEditor } from './pecasDoEditor'
import './editorDoPuzzle.css'

/**
 * MEUS PUZZLES na aba Puzzles da página Jogos (protótipo aprovado, aba "Meus
 * puzzles"): os modelos do mestre, que valem para qualquer mapa e campanha.
 * "Pôr aqui" põe uma cópia própria neste mapa; mexer na cópia não muda o
 * modelo, e salvar o modelo não muda as cópias.
 */

const TEXTO_DA_SITUACAO: Readonly<Record<SituacaoDaCopia, string>> = {
  feitaAqui: 'feito aqui',
  modeloApagado: 'o modelo foi apagado; a cópia continua',
  igual: 'igual ao modelo',
  mudadaAqui: 'mudada só aqui',
  modeloMudou: 'o modelo mudou depois',
}

/** A situação da cópia de um lugar, para a linha da lista: "cópia de “Fonte”, mudada só aqui". */
export function textoDaCopia(minigame: MinigamePuzzle, modelos: readonly ModeloDePuzzle[]): string {
  const situacao = situacaoDaCopia(minigame, modelos)
  if (situacao === 'feitaAqui' || situacao === 'modeloApagado') return TEXTO_DA_SITUACAO[situacao]
  const modelo = modelos.find((candidato) => candidato.id === minigame.modeloId)
  return `cópia de “${modelo?.puzzle.nome ?? ''}”, ${TEXTO_DA_SITUACAO[situacao]}`
}

/** As peças desenhadas que já estão no acervo, para o modelo novo já nascer com as peças certas. */
export function usePecasLigadas(): Partial<Record<IdDaPecaDesenhada, string>> {
  const { biblioteca } = usePecasDoEditor()
  return useMemo(() => {
    const ligadas: Partial<Record<IdDaPecaDesenhada, string>> = {}
    for (const peca of biblioteca) if (peca.desenhada !== null && peca.noAcervo) ligadas[peca.desenhada] = peca.itemId
    return ligadas
  }, [biblioteca])
}

export function MeusPuzzles() {
  const modelos = useMeusPuzzlesStore((estado) => estado.modelos)
  const aviso = useMeusPuzzlesStore((estado) => estado.aviso)
  const podeGravar = useMeusPuzzlesStore((estado) => estado.podeGravar)
  const map = useMapStore((estado) => estado.map)
  const ligadas = usePecasLigadas()
  const [confirmarApagar, setConfirmarApagar] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    void useMeusPuzzlesStore.getState().recarregar()
    lerOAcervoSeFaltar()
  }, [])

  const lugares = (modeloId: string) => desafiosDo(map).filter((desafio) => desafio.minigame.jogo === 'puzzle' && desafio.minigame.modeloId === modeloId).length
  const montarNovo = () => useEditorDoPuzzleStore.getState().abrir({ tipo: 'rascunho', puzzle: puzzleDoModelo('fonte', ligadas) })
  const porAqui = (modelo: ModeloDePuzzle) => {
    const id = useMeusPuzzlesStore.getState().porNoLugar(modelo.id)
    // A ficha abre já pedindo o lugar: o puzzle precisa de um ponto ou de um objeto para o jogador encostar.
    if (id !== null) {
      useDesafiosStore.getState().abrir(id)
      useDesafiosStore.getState().marcar(id, 'ponto')
    }
  }
  const apagar = (modelo: ModeloDePuzzle) => {
    if (confirmarApagar !== modelo.id) {
      setConfirmarApagar(modelo.id)
      return
    }
    setConfirmarApagar(null)
    useMeusPuzzlesStore
      .getState()
      .apagarModelo(modelo.id)
      .catch((causa: unknown) => setErro(causa instanceof Error ? causa.message : String(causa)))
  }

  return (
    <>
      <h3 className="mg-secao">
        Meus puzzles <small>{modelos.length}</small>
      </h3>
      <p className="pzm-intro">Cada puzzle salvo vira um modelo seu. “Pôr aqui” põe uma cópia própria neste mapa: mexer na cópia não muda o modelo.</p>
      {aviso !== null && (
        <p className="pzm-aviso" role="alert">
          {aviso}
        </p>
      )}
      {erro !== null && (
        <p className="pzm-aviso" role="alert">
          {erro}
        </p>
      )}
      {modelos.length === 0 ? (
        <p className="mg-vazio">{podeGravar ? 'Nenhum puzzle salvo. Monte um e use “Salvar nos meus puzzles”.' : 'Meus puzzles mora no disco do app: aqui fora dele, a lista fica vazia.'}</p>
      ) : (
        <ul className="pzm-lista">
          {modelos.map((modelo) => {
            const n = lugares(modelo.id)
            return (
              <li key={modelo.id} className="pzm-cartao">
                <MiniaturaDoPuzzle puzzle={modelo.puzzle} prefixo={`pzm-${modelo.id}`} />
                <div className="pzm-cartao__corpo">
                  <span className="pzm-cartao__nome">{modelo.puzzle.nome}</span>
                  <span className="mg-linha__tags">
                    <span className="mg-tag">{modelo.puzzle.encaixes.length === 1 ? '1 encaixe' : `${modelo.puzzle.encaixes.length} encaixes`}</span>
                    <span className="mg-tag mg-tag--latao">{n === 0 ? 'em nenhum lugar deste mapa' : n === 1 ? 'em 1 lugar deste mapa' : `em ${n} lugares deste mapa`}</span>
                  </span>
                </div>
                <div className="pzm-cartao__acoes">
                  <Botao tamanho="p" onClick={() => useEditorDoPuzzleStore.getState().abrir({ tipo: 'modelo', modeloId: modelo.id })}>
                    Editar modelo
                  </Botao>
                  <Botao variante="latao" tamanho="p" onClick={() => porAqui(modelo)}>
                    Pôr aqui
                  </Botao>
                  {podeGravar && (
                    <Botao variante="perigo" tamanho="p" onClick={() => apagar(modelo)} onBlur={() => setConfirmarApagar(null)}>
                      {confirmarApagar === modelo.id ? 'Apagar mesmo?' : 'Apagar'}
                    </Botao>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mg-nota-pe">
        <Botao variante="latao" largo onClick={montarNovo}>
          Montar um puzzle novo
        </Botao>
      </div>
    </>
  )
}

/** A arte do puzzle em miniatura, com os encaixes como pontos (o `cartao-mp__arte` do v2). */
export function MiniaturaDoPuzzle({ puzzle, prefixo }: { puzzle: Puzzle; prefixo: string }) {
  const resolver = useImagemDaMesa()
  const { visual } = puzzle
  const arte = useMemo(() => (visual.tipo === 'modelo' ? desenhoDoModelo(visual, prefixo) : null), [visual, prefixo])
  const src = visual.tipo === 'imagem' ? resolver(visual.imagem) : null
  return (
    <span className="pzm-mini" aria-hidden="true">
      {arte !== null ? (
        <span className="pzm-mini__arte">
          <ArteSvg arte={arte} />
        </span>
      ) : src !== null ? (
        <img className="pzm-mini__arte" src={src} alt="" draggable={false} />
      ) : null}
      {puzzle.encaixes.map((encaixe) => (
        <span key={encaixe.id} className="pzm-mini__ponto" style={{ left: `${encaixe.x}%`, top: `${encaixe.y}%`, width: `${Math.max(4, encaixe.t * 0.6)}%` }} />
      ))}
    </span>
  )
}
