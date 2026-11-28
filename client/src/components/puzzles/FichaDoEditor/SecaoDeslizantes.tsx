import { Botao } from '../../grimorio/Botao'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { urlDaFigura } from '../../../puzzles/camadas/arte'
import { comecoDasDeslizantes, deslizantesDoPuzzle, lerDeslizantes, minimoDeLances, NOME_DA_FIGURA_DAS_DESLIZANTES, NOME_DO_MATERIAL_DAS_DESLIZANTES, NOME_DO_MODO_DAS_DESLIZANTES, pecaVazia, textoDoMinimo } from '../../../puzzles/deslizantes/deslizantes'
import { sementeNova } from '../../../puzzles/giratorias/giratorias'
import { FIGURAS_DAS_DESLIZANTES, LADO_DAS_DESLIZANTES_MAX, LADO_DAS_DESLIZANTES_MIN, MATERIAIS_DAS_DESLIZANTES, MODOS_DAS_DESLIZANTES, type DeslizantesDoPuzzle, type FiguraDasDeslizantes } from '../../../puzzles/tipos'
import { comDeslizantes } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'

/**
 * AS PEÇAS DESLIZANTES NA FICHA DO EDITOR (28/11): o modo (montar a figura ou
 * levar a peça-chave à saída), a figura (uma das quatro de fábrica ou uma
 * imagem sua), o material, o tamanho da grade e um embaralho novo. No modo
 * chave, duas grades pequenas escolhem a peça-chave e a casa da saída. O
 * mínimo de lances do começo aparece embaixo, só para o mestre.
 */

const OPCOES_DO_MODO = MODOS_DAS_DESLIZANTES.map((modo) => ({ valor: modo, rotulo: NOME_DO_MODO_DAS_DESLIZANTES[modo] }))
const OPCOES_DO_MATERIAL = MATERIAIS_DAS_DESLIZANTES.map((material) => ({ valor: material, rotulo: NOME_DO_MATERIAL_DAS_DESLIZANTES[material] }))
const OPCOES_DO_LADO = Array.from({ length: LADO_DAS_DESLIZANTES_MAX - LADO_DAS_DESLIZANTES_MIN + 1 }, (_, i) => {
  const n = LADO_DAS_DESLIZANTES_MIN + i
  return { valor: String(n), rotulo: `${n} x ${n}` }
})
const FIGURAS_DE_FABRICA = FIGURAS_DAS_DESLIZANTES.filter((figura): figura is Exclude<FiguraDasDeslizantes, 'imagem'> => figura !== 'imagem')

function nomeDaCasa(casa: number, lado: number): string {
  return `linha ${Math.floor(casa / lado) + 1}, coluna ${(casa % lado) + 1}`
}

/** A grade pequena do modo chave: uma casa escolhida (aria-pressed), e as que não valem apagadas com o motivo no rótulo. */
function GradeDeCasas({ rotulo, lado, escolhida, proibida, motivo, onEscolher }: { rotulo: string; lado: number; escolhida: number; proibida: number | null; motivo: string; onEscolher: (casa: number) => void }) {
  return (
    <div className="gr-campo">
      <span className="gr-campo__rot">{rotulo}</span>
      <div className="pze-dz-grade" style={{ gridTemplateColumns: `repeat(${lado}, 1fr)` }} role="group" aria-label={rotulo}>
        {Array.from({ length: lado * lado }, (_, casa) => (
          <button
            key={casa}
            type="button"
            className="pze-dz-casa"
            aria-pressed={casa === escolhida}
            disabled={casa === proibida}
            aria-label={`${nomeDaCasa(casa, lado)}${casa === proibida ? ` (${motivo})` : ''}`}
            title={casa === proibida ? motivo : nomeDaCasa(casa, lado)}
            onClick={() => casa !== escolhida && onEscolher(casa)}
          />
        ))}
      </div>
    </div>
  )
}

export function SecaoDeslizantes({ puzzle, mudar, onImagem }: PropsDaSecao & { onImagem: () => void }) {
  const deslizantes = deslizantesDoPuzzle(puzzle)
  if (deslizantes === null) return null
  /** Uma mudança no tabuleiro, relida pelo leitor (a peça-chave e a saída acompanham o tamanho). */
  const trocar = (mudanca: Partial<DeslizantesDoPuzzle>) => mudar((atual) => comDeslizantes(atual, (antes) => lerDeslizantes({ ...antes, ...mudanca }) ?? antes))
  const { lado, modo } = deslizantes
  const minimo = minimoDeLances(comecoDasDeslizantes(deslizantes), deslizantes)

  return (
    <Secao titulo="Tabuleiro">
      <CampoSeg rotulo="O que resolve" opcoes={OPCOES_DO_MODO} valor={modo} onChange={(novo) => novo !== modo && trocar({ modo: novo })} />
      {modo === 'figura' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">Figura</span>
          <div className="pze-modelos">
            {FIGURAS_DE_FABRICA.map((figura) => (
              <button key={figura} type="button" className="pze-modelo pze-modelo--disco" aria-pressed={deslizantes.figura === figura} aria-label={`Figura: ${NOME_DA_FIGURA_DAS_DESLIZANTES[figura]}`} onClick={() => figura !== deslizantes.figura && trocar({ figura })}>
                <img className="pze-modelo__arte" src={urlDaFigura(figura, '') ?? undefined} alt="" draggable={false} />
                <span className="pze-modelo__nome">{NOME_DA_FIGURA_DAS_DESLIZANTES[figura]}</span>
              </button>
            ))}
            <button type="button" className="pze-modelo" aria-pressed={deslizantes.figura === 'imagem'} onClick={() => (deslizantes.figura === 'imagem' ? onImagem() : trocar({ figura: 'imagem' }))}>
              <span className="pze-modelo__nome">{NOME_DA_FIGURA_DAS_DESLIZANTES.imagem}</span>
            </button>
          </div>
          {deslizantes.figura === 'imagem' && (
            <>
              <Botao variante="latao" tamanho="p" className="pze-alinha-inicio" onClick={onImagem}>
                {deslizantes.imagem === null ? 'Escolher a imagem do tabuleiro' : 'Trocar a imagem do tabuleiro'}
              </Botao>
              <p className="pze-nota">A imagem é cortada no quadrado do meio e dividida nas peças. Também dá para soltar o arquivo sobre o quadro.</p>
            </>
          )}
        </div>
      )}
      <CampoSeg rotulo="Material" opcoes={OPCOES_DO_MATERIAL} valor={deslizantes.material} onChange={(material) => material !== deslizantes.material && trocar({ material })} />
      <CampoSeg
        rotulo="Grade"
        opcoes={OPCOES_DO_LADO}
        valor={String(lado)}
        onChange={(valor) => {
          const novo = Number(valor)
          // A saída padrão acompanha o canto de baixo à direita; a peça-chave volta ao começo se não couber.
          if (novo !== lado) trocar({ lado: novo, alvo: deslizantes.alvo === pecaVazia(lado) ? pecaVazia(novo) : deslizantes.alvo, chave: deslizantes.chave < pecaVazia(novo) ? deslizantes.chave : 0 })
        }}
      />
      {modo === 'chave' && (
        <div className="pze-dz-grades">
          <GradeDeCasas rotulo="A peça-chave (onde ela mora)" lado={lado} escolhida={deslizantes.chave} proibida={pecaVazia(lado)} motivo="a casa vazia" onEscolher={(chave) => trocar({ chave })} />
          <GradeDeCasas rotulo="A saída" lado={lado} escolhida={deslizantes.alvo} proibida={null} motivo="" onEscolher={(alvo) => trocar({ alvo })} />
        </div>
      )}
      <Botao tamanho="p" className="pze-alinha-inicio" onClick={() => trocar({ embaralho: sementeNova() })}>
        Embaralhar de novo
      </Botao>
      <p className="pze-nota">
        O jogador começa do embaralho que o quadro mostra, feito de deslizadas de verdade: sempre tem volta. Daqui, {textoDoMinimo(minimo)}. Deslizar não castiga: o tabuleiro certo destrava o que você escolher em Ao resolver.
      </p>
    </Secao>
  )
}
