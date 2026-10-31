import { useState, type CSSProperties, type ReactNode } from 'react'
import type { AcoesDaVez } from '../../lib/batalha/acoes'
import type { PedidoDeAcao } from '../../lib/batalha/combate'
import type { FormaNoMenu } from '../../lib/batalha/transformacao'
import { ImagemOuIniciais } from '../FichaPecas'
import type { RecursoNaCarta } from './dadosDaFaixa'
import { economiaEmTexto, formatarNumero, textoDaAcao, textoDaCarga, type AlvoNaMira, type GolpeNaTela } from './dadosDoMenu'
import { PainelDaForma, nomeDaForma } from './ListaDeFormas'
import { DetalheDoGolpe } from './ListaDeTecnicas'
import { MiraDoGolpe, pedidoDoGolpe, type ConsultaDaFicha } from './MiraDoGolpe'
import './batalha.css'
import './combate.css'

/**
 * O PAINEL DA VEZ DO NPC (mestre, aba Batalha; o `.mp-*` do protótipo
 * aprovado): retrato e perfil compacto (HP, SP, carga, a economia da vez), as
 * técnicas e armas com a seta para o detalhe, a técnica e o alvo sugeridos já
 * marcados (`sugestaoParaNpc`), o dano editável com a conta, Surpresa,
 * Perfurante, Concentrar, Executar e Encerrar vez. Nada acontece sem Executar
 * (sem "jogam sozinhos"). F3: a Transformação do NPC (o mesmo painel da forma
 * do jogador, aberto pela seta) e os selos da ficha da vez.
 */

export interface PainelDaVezDoNpcProps {
  nome: string
  imagem: string | null
  cor: string | null
  /** "NPC · Marinha". */
  descricao: string
  recursos: readonly RecursoNaCarta[]
  acoes: AcoesDaVez
  carga: number
  motivoDoConcentrar: string | null
  armas: readonly GolpeNaTela[]
  habilidades: readonly GolpeNaTela[]
  alvos: readonly AlvoNaMira[]
  /** A sugestão (`sugestaoParaNpc`): a chave do golpe ("tecnica:…", "arma:…") e o alvo. */
  sugestao: { chave: string | null; alvoTokenId: string | null }
  onExecutar: (pedido: PedidoDeAcao) => boolean
  onConcentrar: () => boolean
  /** "Zerar" a concentração (só com carga): volta a 0, a ação gasta não volta. Ausente = sem o botão. */
  onZerarCarga?: () => boolean
  onEncerrar: () => boolean
  onAcoesExtras: () => void
  onDarDano: () => void
  /** S4: as marcas da mira no mapa e o "Escolher no mapa". */
  consulta?: ConsultaDaFicha | null
  alvoDoMapa?: { tokenId: string; seq: number } | null
  mapa?: { ligado: boolean; onTrocar: (ligado: boolean) => void }
  /** F3: as formas da ficha do NPC (`formasNoMenu`). */
  formas?: readonly FormaNoMenu[]
  personagemId?: string | null
  /** F3: os selos da ficha da vez e o "Pôr selo…" (quem monta abre a janela). */
  selos?: ReactNode
}

const SEM_FORMAS: readonly FormaNoMenu[] = []

export function PainelDaVezDoNpc(props: PainelDaVezDoNpcProps) {
  const { nome, imagem, cor, descricao, recursos, acoes, carga, motivoDoConcentrar, armas, habilidades, alvos, sugestao, onExecutar, onConcentrar, onZerarCarga, onEncerrar, onAcoesExtras, onDarDano, consulta, alvoDoMapa, mapa } =
    props
  const { formas = SEM_FORMAS, personagemId = null, selos } = props
  const [formaAberta, setFormaAberta] = useState<string | null>(null)
  const golpes = [...habilidades, ...armas]
  const primeiraValida = golpes.find((golpe) => golpe.motivo === null)?.chave ?? null
  const [escolhida, setEscolhida] = useState<string | null>(() => (sugestao.chave !== null && golpes.some((golpe) => golpe.chave === sugestao.chave && golpe.motivo === null) ? sugestao.chave : primeiraValida))
  const [aberto, setAberto] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const golpe = golpes.find((candidato) => candidato.chave === escolhida) ?? null
  const textoCarga = textoDaCarga(carga)
  const estilo = cor === null ? undefined : ({ '--lado': cor } as CSSProperties)

  const executar = (pedido: PedidoDeAcao): boolean => {
    const saiu = onExecutar(pedido)
    setAviso(saiu ? null : 'A regra recusou: confira o motivo na técnica (ação, custo, recarga).')
    return saiu
  }

  const grupo = (titulo: string, lista: readonly GolpeNaTela[]) =>
    lista.length === 0 ? null : (
      <fieldset className="bt-npc__lista">
        <legend>{titulo}</legend>
        {lista.map((item) => {
          const expandido = aberto === item.chave
          return (
            <div key={item.chave}>
              <label className="bt-opcao" data-apagada={item.motivo === null ? 'nao' : 'sim'} title={item.motivo ?? undefined}>
                <input type="radio" name="bt-golpe-do-npc" checked={escolhida === item.chave} disabled={item.motivo !== null} onChange={() => setEscolhida(item.chave)} />
                <span className="bt-opcao__nome">
                  {item.nome}
                  <small>{item.motivo ?? [item.acaoTexto, item.dano.valor === null ? (item.dano.semDano ? 'sem dano' : 'dano à mão') : `dano ${formatarNumero(item.dano.valor)}`, item.tempoTexto].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="bt-opcao__lado">
                  {sugestao.chave === item.chave && <span className="bt-opcao__sug">sugerido</span>} {item.custoTexto ?? ''}
                </span>
                <button
                  type="button"
                  className="bt-seta"
                  aria-expanded={expandido}
                  aria-label={`Detalhe de ${item.nome}`}
                  onClick={(evento) => {
                    evento.preventDefault()
                    setAberto(expandido ? null : item.chave)
                  }}
                >
                  ›
                </button>
              </label>
              {expandido && <DetalheDoGolpe golpe={item} />}
            </div>
          )
        })}
      </fieldset>
    )

  return (
    <div className="bt-npc" style={estilo}>
      <div className="bt-npc__quem">
        <span className="bt-npc__retrato">
          <ImagemOuIniciais imagem={imagem} nome={nome} />
        </span>
        <div>
          <b className="bt-npc__nome">Vez de {nome}</b>
          <span className="bt-npc__perfil">
            {descricao}
            {recursos.map((recurso) => (
              <span key={recurso.id} data-r={recurso.tom}>
                {' · '}
                {recurso.rotulo} {formatarNumero(recurso.atual)}/{formatarNumero(recurso.maximo)}
              </span>
            ))}
          </span>
        </div>
      </div>
      <p className="bt-npc__perfil">
        {economiaEmTexto(acoes)}
        {textoCarga !== null && ` · ${textoCarga}`}
      </p>
      {selos}
      {formas.length > 0 && (
        <div className="bt-npc__lista bt-npc__formas" role="group" aria-label="Transformação">
          <p className="bt-npc__legenda">Transformação</p>
          {formas.map((forma) => {
            const id = forma.cartao.id
            const aberta = formaAberta === id
            return (
              <div key={id}>
                <div className="bt-opcao bt-opcao--forma" data-ligada={forma.ligada ? 'sim' : 'nao'}>
                  <span className="bt-opcao__nome">
                    {nomeDaForma(forma)}
                    <small>{forma.ligada ? 'Ativa · desfazer é ação livre' : `${textoDaAcao(forma.acaoDaFicha)}${forma.numeros.length > 0 ? ` · muda ${forma.numeros.length}` : ''}`}</small>
                  </span>
                  <span className="bt-opcao__lado">{forma.ligada && <span className="bt-opcao__sug bt-opcao__sug--forma">ativa</span>}</span>
                  <button type="button" className="bt-seta" aria-expanded={aberta} aria-label={`${forma.ligada ? 'Desfazer' : 'Ativar'} ${nomeDaForma(forma)}`} onClick={() => setFormaAberta(aberta ? null : id)}>
                    ›
                  </button>
                </div>
                {aberta && (
                  <PainelDaForma
                    forma={forma}
                    acoes={acoes}
                    personagemId={personagemId}
                    onAtivar={(acao, trocarImagem) => {
                      const saiu = onExecutar({ tipo: 'transformar', cartaoId: id, acao, trocarImagem })
                      if (saiu) setFormaAberta(null)
                      return saiu
                    }}
                    onDesfazer={() => {
                      const saiu = onExecutar({ tipo: 'destransformar', cartaoId: id })
                      if (saiu) setFormaAberta(null)
                      return saiu
                    }}
                    onVoltar={() => setFormaAberta(null)}
                    className="bt-forma--npc"
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
      {grupo('Habilidades', habilidades)}
      {grupo('Atacar', armas)}
      {golpes.length === 0 && <p className="bt-texto">Sem técnica nem arma na ficha: dê dano à mão ou encerre a vez.</p>}
      {golpe !== null && (
        <MiraDoGolpe
          key={golpe.chave}
          golpe={golpe}
          carga={carga}
          alvos={alvos}
          alvoInicial={sugestao.alvoTokenId}
          rotuloDoLancar="Executar"
          semVoltar
          onVoltar={() => {}}
          consulta={consulta}
          alvoDoMapa={alvoDoMapa}
          mapa={mapa}
          onLancar={(escolha) => executar(pedidoDoGolpe(golpe, escolha))}
        />
      )}
      {aviso !== null && (
        <p className="bt-npc__erro" role="alert">
          {aviso}
        </p>
      )}
      <div className="bt-pendente__acoes">
        <button
          type="button"
          className="bt-botao"
          disabled={motivoDoConcentrar !== null}
          title={motivoDoConcentrar ?? undefined}
          onClick={() => setAviso(onConcentrar() ? null : 'Não concentrou: a ação já foi gasta.')}
        >
          Concentrar
        </button>
        {onZerarCarga !== undefined && carga > 0 && (
          <button type="button" className="bt-botao" title="Volta a 0; a ação gasta não volta" onClick={() => setAviso(onZerarCarga() ? null : 'Não zerou: a carga já estava em 0.')}>
            Zerar concentração ({carga})
          </button>
        )}
        <button type="button" className="bt-botao" onClick={onAcoesExtras}>
          Ações extras
        </button>
        <button type="button" className="bt-botao" onClick={onDarDano}>
          Dar dano
        </button>
        <button type="button" className="bt-botao bt-botao--primario" onClick={() => setAviso(onEncerrar() ? null : 'A vez não passou: confira a ordem.')}>
          Encerrar vez
        </button>
      </div>
      {motivoDoConcentrar !== null && <p className="bt-npc__perfil">Concentrar: {motivoDoConcentrar}</p>}
    </div>
  )
}
