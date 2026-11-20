import { useMemo } from 'react'
import { Botao } from '../../grimorio/Botao'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { CampoTexto } from '../../grimorio/CampoTexto'
import { classes } from '../../grimorio/comum'
import { ArteSvg } from '../../../puzzles/arte/ArteSvg'
import { desenhoDoModelo, type NoDaArte } from '../../../puzzles/arte/modelos'
import { aceitaMolduraPorta, NOME_DO_MODELO, PADROES_DOS_MODELOS } from '../../../puzzles/padroes'
import { INSCRICAO_MAX, MODELOS_DO_PUZZLE, NOME_DO_PUZZLE_MAX, type CoresDoModelo, type ModeloDoPuzzle, type MolduraDoPuzzle } from '../../../puzzles/tipos'
import { comCoresDoModelo, comVisual } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'

/** O nome de cada cor, pelo modelo (`rotuloObjeto` do v2). */
const NOME_DO_OBJETO: Readonly<Record<ModeloDoPuzzle, string>> = {
  fonte: 'Pedra da fonte',
  porta: 'Madeira da porta',
  cofre: 'Metal do cofre',
  altar: 'Pedra do altar',
}

/** Onde o texto gravado aparece na arte (v2). */
const ONDE_DA_INSCRICAO: Readonly<Record<ModeloDoPuzzle, string>> = {
  fonte: 'na bacia',
  porta: 'na placa',
  cofre: 'no bilhete da parede',
  altar: 'na pedra do altar',
}

const CHAVES_DE_COR: readonly (keyof CoresDoModelo)[] = ['parede', 'chao', 'objeto']
const NOME_DA_COR: Readonly<Record<keyof CoresDoModelo, string>> = { parede: 'Parede', chao: 'Chão', objeto: 'Objeto' }

const MOLDURAS: readonly { valor: MolduraDoPuzzle; rotulo: string }[] = [
  { valor: 'original', rotulo: 'Original' },
  { valor: 'porta', rotulo: 'Porta' },
]

/** "Básico": o nome do mestre e o título que o jogador vê. */
export function SecaoBasico({ puzzle, mudar }: PropsDaSecao) {
  return (
    <Secao titulo="Básico">
      <CampoTexto rotulo="Nome (só seu)" valor={puzzle.nome} maxLength={NOME_DO_PUZZLE_MAX} onChange={(nome) => mudar({ ...puzzle, nome }, 'nome')} />
      <CampoTexto
        rotulo="Título para o jogador"
        valor={puzzle.nomePublico}
        placeholder="Sem título"
        maxLength={NOME_DO_PUZZLE_MAX}
        onChange={(nomePublico) => mudar({ ...puzzle, nomePublico }, 'nomePublico')}
      />
    </Secao>
  )
}

/** As miniaturas dos 4 modelos, desenhadas uma vez por abertura do editor. */
function useMiniaturas(): Readonly<Record<ModeloDoPuzzle, NoDaArte>> {
  return useMemo(() => {
    const desenho = (modelo: ModeloDoPuzzle) => desenhoDoModelo({ modelo, moldura: 'original', cores: PADROES_DOS_MODELOS[modelo].cores, inscricao: '' }, `pze-mini-${modelo}`)
    return { fonte: desenho('fonte'), porta: desenho('porta'), cofre: desenho('cofre'), altar: desenho('altar') }
  }, [])
}

interface PropsDoVisual extends PropsDaSecao {
  /** "Começar de um modelo": troca a arte, a regra e os encaixes (o Desfazer volta). */
  onModelo: (modelo: ModeloDoPuzzle) => void
  onImagem: () => void
}

export function SecaoVisual({ puzzle, mudar, onModelo, onImagem }: PropsDoVisual) {
  const miniaturas = useMiniaturas()
  const { visual } = puzzle
  const mudarCor = (chave: keyof CoresDoModelo, cor: string) => {
    if (visual.tipo !== 'modelo') return
    mudar(comVisual(puzzle, { ...visual, cores: { ...visual.cores, [chave]: cor } }), `cor:${chave}`)
  }
  return (
    <Secao titulo="Visual">
      <div className="gr-campo">
        <span className="gr-campo__rot">Começar de um modelo</span>
        <div className="pze-modelos">
          {MODELOS_DO_PUZZLE.map((modelo) => (
            <button
              key={modelo}
              type="button"
              className="pze-modelo"
              aria-pressed={visual.tipo === 'modelo' && visual.modelo === modelo}
              aria-label={`Começar do modelo ${NOME_DO_MODELO[modelo]}`}
              onClick={() => onModelo(modelo)}
            >
              <span className="pze-modelo__arte">
                <ArteSvg arte={miniaturas[modelo]} />
              </span>
              <span className="pze-modelo__nome">{NOME_DO_MODELO[modelo]}</span>
            </button>
          ))}
        </div>
      </div>
      {visual.tipo === 'modelo' && aceitaMolduraPorta(visual.modelo) && (
        <div className="pze-grupo">
          <CampoSeg rotulo="Moldura" opcoes={MOLDURAS} valor={visual.moldura} onChange={(moldura) => moldura !== visual.moldura && mudar(comVisual(puzzle, { ...visual, moldura }))} />
          <p className="pze-nota">
            {visual.moldura === 'porta' ? 'Vira uma porta de pedra: os encaixes ficam onde estão e, ao resolver, as folhas abrem.' : 'Porta transforma o modelo numa passagem que abre ao resolver.'}
          </p>
        </div>
      )}
      <Botao variante="latao" tamanho="p" className="pze-alinha-inicio" onClick={onImagem}>
        {visual.tipo === 'imagem' && visual.imagem !== null ? 'Trocar a imagem' : 'Imagem própria'}
      </Botao>
      {visual.tipo === 'modelo' ? (
        <>
          <div className="pze-cores">
            {CHAVES_DE_COR.map((chave) => (
              <label key={chave} className="pze-cor">
                {chave === 'objeto' ? NOME_DO_OBJETO[visual.modelo] : NOME_DA_COR[chave]}
                <input type="color" value={visual.cores[chave]} onChange={(evento) => mudarCor(chave, evento.currentTarget.value)} />
              </label>
            ))}
          </div>
          <CampoTexto
            rotulo={`Texto gravado na arte, ${visual.moldura === 'porta' && visual.modelo !== 'cofre' ? 'na verga' : ONDE_DA_INSCRICAO[visual.modelo]}`}
            valor={visual.inscricao}
            maxLength={INSCRICAO_MAX}
            onChange={(inscricao) => mudar(comVisual(puzzle, { ...visual, inscricao }), 'inscricao')}
          />
          <Botao variante="fantasma" tamanho="p" className={classes('pze-alinha-inicio')} onClick={() => mudar(comCoresDoModelo(puzzle))}>
            Voltar às cores do modelo
          </Botao>
        </>
      ) : (
        <p className="pze-nota">{visual.imagem !== null ? 'A imagem fica na mídia desta mesa. Arraste os encaixes sobre ela.' : 'Escolha uma imagem ou solte um arquivo sobre o quadro ao lado.'}</p>
      )}
    </Secao>
  )
}
