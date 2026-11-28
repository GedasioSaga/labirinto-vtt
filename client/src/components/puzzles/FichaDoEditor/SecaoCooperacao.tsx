import { CampoFaixa } from '../../grimorio/CampoFaixa'
import { CampoSeg } from '../../grimorio/CampoSeg'
import { CampoTexto } from '../../grimorio/CampoTexto'
import { cooperacaoDoPuzzle, lerCooperacao, NOME_DA_ARTE_DO_PONTO } from '../../../puzzles/cooperacao/cooperacao'
import { NOME_DO_MATERIAL_DO_PAINEL } from '../../../puzzles/interruptores/interruptores'
import { ARTES_DO_PONTO, JANELA_MAX, JANELA_MIN, MATERIAIS_DOS_INTERRUPTORES, PONTOS_MAX, PONTOS_MIN, ROTULO_DO_PONTO_MAX, type CooperacaoDoPuzzle, type PontoDaCooperacao } from '../../../puzzles/tipos'
import { comCooperacao } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'

/**
 * A COOPERAÇÃO NA FICHA DO EDITOR (28/11): o metal da chapa, quantos pontos (2
 * ou 3), o que há em cada um (alavanca, placa de pressão ou painel de botão) e o
 * nome na plaqueta, e a janela do "ao mesmo tempo". ONDE fica cada ponto é do
 * mapa: o 1 é o lugar do desafio, os outros se marcam na ficha do desafio em
 * Jogos. O que destrava fica em "Ao resolver".
 */

const OPCOES_DO_MATERIAL = MATERIAIS_DOS_INTERRUPTORES.map((material) => ({ valor: material, rotulo: NOME_DO_MATERIAL_DO_PAINEL[material] }))
const OPCOES_DA_ARTE = ARTES_DO_PONTO.map((arte) => ({ valor: arte, rotulo: NOME_DA_ARTE_DO_PONTO[arte] }))
const OPCOES_DE_QUANTOS: readonly { valor: string; rotulo: string }[] = Array.from({ length: PONTOS_MAX - PONTOS_MIN + 1 }, (_, i) => {
  const n = String(PONTOS_MIN + i)
  return { valor: n, rotulo: n }
})

function ondeFica(i: number): string {
  return i === 0 ? 'onde o desafio está no mapa' : 'marque o lugar na ficha do desafio, em Jogos'
}

export function SecaoCooperacao({ puzzle, mudar }: PropsDaSecao) {
  const cooperacao = cooperacaoDoPuzzle(puzzle)
  if (cooperacao === null) return null
  /** Uma mudança nos pontos, sobre o puzzle de agora e relida pelo leitor (a contagem de pontos e a janela ficam nos limites). */
  const trocar = (mudanca: (antes: CooperacaoDoPuzzle) => Partial<CooperacaoDoPuzzle>, chave?: string) =>
    mudar((atual) => comCooperacao(atual, (antes) => lerCooperacao({ ...antes, ...mudanca(antes) }) ?? antes), chave)
  const trocarPonto = (i: number, mudanca: Partial<PontoDaCooperacao>, chave?: string) => trocar((antes) => ({ pontos: antes.pontos.map((ponto, k) => (k === i ? { ...ponto, ...mudanca } : ponto)) }), chave)
  const quantos = cooperacao.pontos.length

  return (
    <Secao titulo="Pontos da cooperação" conta={`${quantos} pontos`}>
      <CampoSeg rotulo="Chapa" opcoes={OPCOES_DO_MATERIAL} valor={cooperacao.material} onChange={(material) => material !== cooperacao.material && trocar(() => ({ material }))} />
      <CampoSeg
        rotulo="Pontos"
        opcoes={OPCOES_DE_QUANTOS}
        valor={String(quantos)}
        onChange={(valor) => {
          const n = Number(valor)
          if (n === quantos) return
          trocar((antes) => ({ pontos: n > antes.pontos.length ? [...antes.pontos, ...Array.from({ length: n - antes.pontos.length }, () => ({ arte: 'alavanca' as const, rotulo: '' }))] : antes.pontos.slice(0, n) }))
        }}
      />
      {cooperacao.pontos.map((ponto, i) => (
        <div key={i} className="gr-campo" role="group" aria-label={`Ponto ${i + 1}`}>
          <span className="gr-campo__rot">
            Ponto {i + 1}: {ondeFica(i)}
          </span>
          <CampoSeg nomeAcessivel={`O que há no ponto ${i + 1}`} opcoes={OPCOES_DA_ARTE} valor={ponto.arte} onChange={(arte) => arte !== ponto.arte && trocarPonto(i, { arte })} />
          <CampoTexto rotulo={`Nome na plaqueta do ponto ${i + 1}`} valor={ponto.rotulo} placeholder={`Ponto ${i + 1}`} maxLength={ROTULO_DO_PONTO_MAX} onChange={(rotulo) => trocarPonto(i, { rotulo }, `coop-rotulo-${i}`)} />
        </div>
      ))}
      <CampoFaixa
        rotulo="Janela do “ao mesmo tempo”"
        valor={cooperacao.janela}
        min={JANELA_MIN}
        max={JANELA_MAX}
        formatar={(segundos) => `${segundos} s`}
        falar={(segundos) => `${segundos} segundos`}
        onChange={(janela) => janela !== cooperacao.janela && trocar(() => ({ janela }), 'coop-janela')}
      />
      <p className="pze-nota">
        Cada lampião fica aceso {cooperacao.janela} s depois que alguém aciona o ponto dele; o mecanismo cede quando todos estão acesos juntos. Cada jogador só aciona o ponto onde a ficha dele está, e uma pessoa vale por um ponto. No teste, você aciona todos. Acionar não castiga.
      </p>
    </Secao>
  )
}
