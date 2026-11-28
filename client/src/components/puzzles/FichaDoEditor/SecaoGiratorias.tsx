import { Botao } from '../../grimorio/Botao'
import { CampoLiga } from '../../grimorio/CampoLiga'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { urlDoDisco } from '../../../puzzles/giratorias/arte'
import { giratoriasDoPuzzle, lerGiratorias, NOME_DO_MATERIAL, NOME_DO_SIMBOLO_DO_ANEL, sementeNova } from '../../../puzzles/giratorias/giratorias'
import { NOME_DA_CENA } from '../../../puzzles/relevo/arte'
import { ANEIS_MAX, ANEIS_MIN, CENAS_DO_RELEVO, MATERIAIS_DAS_GIRATORIAS, SIMBOLOS_DO_ANEL, type DesenhoDasGiratorias, type GiratoriasDoPuzzle, type MaterialDasGiratorias, type SimboloDoAnel } from '../../../puzzles/tipos'
import { comGiratorias } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'
import { useUmaPorQuadro } from './SecaoRelevo'

/**
 * AS PEÇAS GIRATÓRIAS NA FICHA DO EDITOR (28/11): o desenho do medalhão (uma
 * cena em relevo, uma imagem sua ou os símbolos que cada anel precisa mostrar
 * sob a marca), o material, quantos anéis, o modo difícil (cada anel leva os do
 * lado) e um embaralho novo. O que destrava ao fechar fica em "Ao resolver".
 */

const OPCOES_DO_DESENHO: readonly { valor: DesenhoDasGiratorias; rotulo: string }[] = [
  { valor: 'cena', rotulo: 'Cena em relevo' },
  { valor: 'imagem', rotulo: 'Imagem sua' },
  { valor: 'simbolos', rotulo: 'Símbolos' },
]

const OPCOES_DO_MATERIAL: readonly { valor: MaterialDasGiratorias; rotulo: string }[] = MATERIAIS_DAS_GIRATORIAS.map((material) => ({ valor: material, rotulo: NOME_DO_MATERIAL[material] }))

const OPCOES_DE_ANEIS: readonly { valor: string; rotulo: string }[] = Array.from({ length: ANEIS_MAX - ANEIS_MIN + 1 }, (_, i) => {
  const n = String(ANEIS_MIN + i)
  return { valor: n, rotulo: n }
})

function nomeDoAnel(anel: number, total: number): string {
  if (anel === 0) return 'Anel 1, o de fora'
  if (anel === total - 1) return `Anel ${anel + 1}, o de dentro`
  return `Anel ${anel + 1}`
}

function ehSimbolo(valor: string): valor is SimboloDoAnel {
  return (SIMBOLOS_DO_ANEL as readonly string[]).includes(valor)
}

export function SecaoGiratorias({ puzzle, mudar, onImagem }: PropsDaSecao & { onImagem: () => void }) {
  const giratorias = giratoriasDoPuzzle(puzzle)
  // As miniaturas do disco saem uma por quadro, como as do painel em relevo (cada SVG do disco pesa).
  const prontas = useUmaPorQuadro(giratorias?.desenho === 'cena' ? CENAS_DO_RELEVO.length : 0)
  if (giratorias === null) return null
  /** Uma mudança no medalhão, relida pelo leitor (os símbolos acompanham o número de anéis). */
  const trocar = (mudanca: Partial<GiratoriasDoPuzzle>) => mudar((atual) => comGiratorias(atual, (antes) => lerGiratorias({ ...antes, ...mudanca }) ?? antes))
  const trocarSimbolo = (anel: number, valor: string) => {
    if (!ehSimbolo(valor)) return
    trocar({ simbolos: giratorias.simbolos.map((simbolo, k) => (k === anel ? valor : simbolo)) })
  }

  return (
    <Secao titulo="Medalhão">
      <CampoSeg rotulo="Desenho" opcoes={OPCOES_DO_DESENHO} valor={giratorias.desenho} onChange={(desenho) => desenho !== giratorias.desenho && trocar({ desenho })} />
      {giratorias.desenho === 'cena' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">Cena</span>
          <div className="pze-modelos">
            {CENAS_DO_RELEVO.map((cena, i) => (
              <button key={cena} type="button" className="pze-modelo pze-modelo--disco" aria-pressed={giratorias.cena === cena} aria-label={`Medalhão: ${NOME_DA_CENA[cena]}`} onClick={() => cena !== giratorias.cena && trocar({ cena })}>
                {i < prontas && <img className="pze-modelo__arte" src={urlDoDisco('cena', cena, giratorias.material, giratorias.aneis)} alt="" draggable={false} />}
                <span className="pze-modelo__nome">{NOME_DA_CENA[cena]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {giratorias.desenho === 'imagem' && (
        <div className="gr-campo">
          <Botao variante="latao" tamanho="p" className="pze-alinha-inicio" onClick={onImagem}>
            {giratorias.imagem === null ? 'Escolher a imagem do medalhão' : 'Trocar a imagem do medalhão'}
          </Botao>
          <p className="pze-nota">A imagem é cortada num círculo e dividida nos anéis; o miolo fica parado. Também dá para soltar o arquivo sobre o quadro.</p>
        </div>
      )}
      {giratorias.desenho === 'simbolos' && (
        <div className="gr-campo">
          <span className="gr-campo__rot">O símbolo que cada anel mostra sob a marca</span>
          <div className="pze-simbolos">
            {giratorias.simbolos.map((simbolo, anel) => (
              <select key={anel} className="gr-entrada" value={simbolo} aria-label={nomeDoAnel(anel, giratorias.aneis)} title={nomeDoAnel(anel, giratorias.aneis)} onChange={(evento) => trocarSimbolo(anel, evento.currentTarget.value)}>
                {SIMBOLOS_DO_ANEL.map((opcao) => (
                  <option key={opcao} value={opcao}>
                    {NOME_DO_SIMBOLO_DO_ANEL[opcao]}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <p className="pze-nota">Do anel de fora para o de dentro. Cada anel traz os oito símbolos, em ordem diferente: só um fica sob a marca.</p>
        </div>
      )}
      <CampoSeg rotulo="Material" opcoes={OPCOES_DO_MATERIAL} valor={giratorias.material} onChange={(material) => material !== giratorias.material && trocar({ material })} />
      <CampoSeg
        rotulo="Anéis"
        opcoes={OPCOES_DE_ANEIS}
        valor={String(giratorias.aneis)}
        onChange={(valor) => {
          const aneis = Number(valor)
          if (aneis !== giratorias.aneis) trocar({ aneis })
        }}
      />
      <CampoLiga
        rotulo="Cada anel gira os do lado junto (modo difícil)"
        ajuda={giratorias.vizinhas ? 'Girar um anel leva o de fora e o de dentro no mesmo sentido: o jogador precisa pensar na ordem.' : 'Cada anel gira sozinho.'}
        ligado={giratorias.vizinhas}
        onChange={(vizinhas) => trocar({ vizinhas })}
      />
      <Botao tamanho="p" className="pze-alinha-inicio" onClick={() => trocar({ embaralho: sementeNova() })}>
        Embaralhar de novo
      </Botao>
      <p className="pze-nota">O jogador começa do embaralho que o quadro mostra, e sempre tem volta. Girar errado não castiga: o medalhão fechado destrava o que você escolher em Ao resolver.</p>
    </Secao>
  )
}
