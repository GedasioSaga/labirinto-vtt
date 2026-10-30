import { useState, type CSSProperties } from 'react'
import type { Equipe } from '../../lib/batalha/equipes'
import type { RegrasDaBatalha } from '../../lib/batalha/regrasDoCampo'
import type { Desempate } from '../../lib/batalha/turnos'
import { ImagemOuIniciais } from '../FichaPecas'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoSel } from '../grimorio/CampoTexto'
import type { DadosDaFaixa, LinhaNaTela } from './dadosDaFaixa'
import { RegistroDaBatalha } from './RegistroDaBatalha'
import './batalha.css'

/**
 * O PAINEL DA BATALHA do mestre (o `.painel` do protótipo), dentro do
 * "Iniciar/Encerrar batalha" do livro da mesa quando a batalha está ligada:
 * Vez (quem joga e Passar a vez), Ordem (Ordenar pela Agilidade, o desempate,
 * incluir quem ficou de fora), Regras do campo, Equipes e o Registro.
 *
 * Dar a vez, carta extra, trocar de equipe e tirar da batalha moram no menu da
 * carta, na faixa: o painel diz onde.
 */

export interface FichaForaDaOrdem {
  tokenId: string
  nome: string
}

export interface PainelDaBatalhaProps {
  dados: DadosDaFaixa
  onPassarVez: () => void
  onOrdenar: () => void
  desempate: Desempate
  onDesempate: (desempate: Desempate) => void
  /** Fichas da cena que ainda não estão na ordem. */
  foraDaOrdem: readonly FichaForaDaOrdem[]
  onIncluir: (tokenId: string) => void
  regras: RegrasDaBatalha | null
  onMudarRegras: () => void
  onBiblioteca: () => void
  equipes: readonly Equipe[]
  onEquipes: () => void
  registro: readonly LinhaNaTela[]
  onDesfazer: (linhaId: string) => void
}

const OPCOES_DO_DESEMPATE: readonly OpcaoDoSeg<Desempate>[] = [
  { valor: 'd20', rotulo: '1d20' },
  { valor: 'manual', rotulo: 'Eu decido' },
]

/** Linhas do registro no painel; o resto mora no "Registro" da faixa. */
const LINHAS_NO_PAINEL = 12

export function PainelDaBatalha({
  dados,
  onPassarVez,
  onOrdenar,
  desempate,
  onDesempate,
  foraDaOrdem,
  onIncluir,
  regras,
  onMudarRegras,
  onBiblioteca,
  equipes,
  onEquipes,
  registro,
  onDesfazer,
}: PainelDaBatalhaProps) {
  const [incluir, setIncluir] = useState('')
  const daVez = dados.vez === null ? undefined : dados.cartas.find((carta) => carta.id === dados.vez)
  const escolhidoParaIncluir = foraDaOrdem.some((ficha) => ficha.tokenId === incluir) ? incluir : (foraDaOrdem[0]?.tokenId ?? '')
  const semCartas = dados.cartas.length === 0

  return (
    <div className="bt-painel" aria-label="Painel da batalha">
      <section className="bt-secao" aria-labelledby="bt-painel-vez">
        <h3 className="bt-secao__titulo" id="bt-painel-vez">
          Vez · Rodada {dados.rodada} · Turno {dados.turno.n}/{dados.turno.m}
        </h3>
        {daVez === undefined ? (
          <p className="bt-texto">{semCartas ? 'Ninguém na ordem ainda.' : 'Ninguém na vez: "Passar a vez" começa pela primeira carta.'}</p>
        ) : (
          <div className="bt-painel-vez">
            <span className="bt-carta__retrato" style={daVez.cor === null ? undefined : ({ '--lado': daVez.cor } as CSSProperties)}>
              <ImagemOuIniciais imagem={daVez.imagem} nome={daVez.nome} />
            </span>
            <span className="bt-painel-vez__quem">
              <span className="bt-painel-vez__nome">{daVez.nome}</span>
              <span className="bt-painel-vez__sub">
                {[daVez.equipe, daVez.npc ? 'NPC' : daVez.personagemId === null ? 'sem ficha' : 'jogador', daVez.caiu ? 'caiu' : null].filter(Boolean).join(' · ')}
              </span>
            </span>
          </div>
        )}
        <Acoes>
          <Botao variante="primario" aria-disabled={semCartas} title={semCartas ? 'Inclua um combatente primeiro' : undefined} onClick={() => !semCartas && onPassarVez()}>
            Passar a vez
          </Botao>
        </Acoes>
        {dados.depois !== null && <p className="bt-texto">{dados.depois}</p>}
      </section>

      <section className="bt-secao" aria-labelledby="bt-painel-ordem">
        <h3 className="bt-secao__titulo" id="bt-painel-ordem">
          Ordem
        </h3>
        <Acoes>
          <Botao aria-disabled={semCartas} title={semCartas ? 'Ninguém na ordem para ordenar' : undefined} onClick={() => !semCartas && onOrdenar()}>
            Ordenar pela Agilidade
          </Botao>
        </Acoes>
        <CampoSeg rotulo="Empate na Agilidade" opcoes={OPCOES_DO_DESEMPATE} valor={desempate} onChange={onDesempate} />
        <p className="bt-texto">
          {desempate === 'd20' ? '1d20: o app rola para os empatados e mostra o número na carta (só você vê).' : 'Eu decido: a marca de empate fica na carta até você arrastar.'}
        </p>
        {foraDaOrdem.length > 0 ? (
          <div className="bt-linha-de-campo">
            <CampoSel
              rotulo="Fora da ordem"
              opcoes={foraDaOrdem.map((ficha) => ({ valor: ficha.tokenId, rotulo: ficha.nome }))}
              valor={escolhidoParaIncluir}
              onChange={setIncluir}
            />
            <Botao onClick={() => escolhidoParaIncluir !== '' && onIncluir(escolhidoParaIncluir)}>Incluir</Botao>
          </div>
        ) : (
          <p className="bt-texto">Toda ficha da cena já está na ordem.</p>
        )}
        <p className="bt-texto">Clique numa carta da faixa para dar a vez, pôr uma carta extra, trocar de equipe ou tirar da batalha.</p>
      </section>

      <section className="bt-secao" aria-labelledby="bt-painel-regras">
        <h3 className="bt-secao__titulo" id="bt-painel-regras">
          Regras do campo
        </h3>
        <p className="bt-texto">
          {regras === null ? (
            'Nenhuma regra nesta batalha.'
          ) : (
            <>
              <b>{regras.nome}</b> · {regras.blocosPorRank} {regras.blocosPorRank === 1 ? 'bloco' : 'blocos'} por rank
            </>
          )}
        </p>
        <Acoes>
          <Botao tamanho="p" onClick={onMudarRegras}>
            Mudar regras
          </Botao>
          <Botao tamanho="p" variante="fantasma" onClick={onBiblioteca}>
            Biblioteca
          </Botao>
        </Acoes>
      </section>

      <section className="bt-secao" aria-labelledby="bt-painel-equipes">
        <h3 className="bt-secao__titulo" id="bt-painel-equipes">
          Equipes
        </h3>
        <p className="bt-texto">{equipes.length === 0 ? 'Nenhuma equipe: todo jogador é aliado de todo jogador.' : equipes.map((equipe) => equipe.nome).join(', ')}</p>
        <Acoes>
          <Botao tamanho="p" onClick={onEquipes}>
            Equipes
          </Botao>
        </Acoes>
      </section>

      <section className="bt-secao" aria-labelledby="bt-painel-registro">
        <h3 className="bt-secao__titulo" id="bt-painel-registro">
          Registro
        </h3>
        <RegistroDaBatalha linhas={registro} onDesfazer={onDesfazer} maximo={LINHAS_NO_PAINEL} />
      </section>
    </div>
  )
}
