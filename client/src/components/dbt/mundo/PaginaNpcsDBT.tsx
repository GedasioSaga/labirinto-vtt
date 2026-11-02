import { useState } from 'react'
import { avisosDosAtributosDoNpc } from '../../../lib/dbt/regras/npc'
import type { TabelaDeRanksDBT } from '../../../lib/dbt/regras/tecnicas'
import { ehVariacao, entraNaBatalha, soltarDoModelo, variacoesDe } from '../../../lib/livros/combate'
import { FORCA_PADRAO, type Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { useMundoDoLivroStore } from '../../../stores/mundoDoLivroStore'
import { gravarNoMundo, primeiroNome, Retrato, semCenario, trocarFicha } from '../../livros/comum'
import { IconeDoMundo } from '../../livros/icones'
import { EditorDaNota, SoVoceVe } from '../../livros/PaginaAnotacoes'
import { fichaDe, notacaoDoNpc, RANKS_DO_LIVRO } from './contasDoMundo'
import { NovoNpcDBTDialog, type ModoDoNovoNpcDBT } from './NovoNpcDBTDialog'
import { ResumoDoNpcDBT } from './ResumoDoNpcDBT'
import './mundoDBT.css'

/**
 * NPCS DE COMBATE do Dragon Ball (plano docs/planos/sistema-dragon-ball.md,
 * item 9): o mesmo bestiário do mundo (modelos, variações, "Só no cenário",
 * anotação), com a ficha do livro no detalhe — ND, rank e categoria, PV, PK,
 * CA, EP e as técnicas. Sem a força ×0,5 a ×2 do motor padrão: aqui o PV
 * do NPC sai do ND (Livro do Narrador 4.0.2), que se muda na ficha.
 */

const daBatalha = (personagem: Personagem): boolean => personagem.combate?.criadoNaBatalha === true

/** "Modelo · 2 variações", "Variação", "NPC único". */
function papelDoNpc(personagem: Personagem, deCombate: readonly Personagem[]): string {
  if (ehVariacao(personagem)) return 'Variação'
  const n = variacoesDe(personagem.id, deCombate).length
  return n === 0 ? 'NPC único' : `Modelo · ${n} ${n === 1 ? 'variação' : 'variações'}`
}

/** "ND 3 – Rank E (Comum)" ou, sem o bloco de NPC na ficha, o aviso curto. */
function notacaoDe(personagem: Personagem): string {
  const npc = fichaDe(personagem).npc
  return npc === undefined ? 'Sem ND: PV pela conta do jogador' : notacaoDoNpc(npc)
}

function rankDe(personagem: Personagem): string {
  const npc = fichaDe(personagem).npc
  return npc === undefined ? 'Sem rank de NPC' : `Rank ${npc.rank}`
}

interface ItemDaListaProps {
  personagem: Personagem
  deCombate: readonly Personagem[]
  escolhido: boolean
  variacao: boolean
}

function ItemDaLista({ personagem, deCombate, escolhido, variacao }: ItemDaListaProps) {
  return (
    <li>
      <button
        type="button"
        className={variacao ? 'mu-bes-item mu-bes-item--var' : 'mu-bes-item'}
        aria-current={escolhido}
        onClick={() => useMundoDoLivroStore.getState().escolherNpc(personagem.id)}
      >
        <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
        <span className="mu-bes-item__txt">
          <span className="mu-bes-item__nome">{personagem.nome}</span>
          <span className="mu-bes-item__sub">
            {papelDoNpc(personagem, deCombate)}
            {daBatalha(personagem) ? ' · criado na batalha' : ''}
          </span>
        </span>
        <span className="mu-bes-item__forca" aria-label={rankDe(personagem)}>
          {fichaDe(personagem).npc?.rank ?? '—'}
        </span>
      </button>
    </li>
  )
}

interface DetalheProps {
  personagem: Personagem
  personagens: readonly Personagem[]
  deCombate: readonly Personagem[]
  ranks: TabelaDeRanksDBT
  onNovoNpc: (modo: ModoDoNovoNpcDBT) => void
}

function DetalheDoNpc({ personagem, personagens, deCombate, ranks, onNovoNpc }: DetalheProps) {
  const modeloId = personagem.combate?.modeloId
  const modelo = modeloId === undefined ? undefined : personagens.find((candidato) => candidato.id === modeloId)
  const variacoes = variacoesDe(personagem.id, deCombate)
  const npc = fichaDe(personagem).npc
  const avisos = npc === undefined ? [] : avisosDosAtributosDoNpc(npc.categoria, personagem.atributos)
  const notaId = `mu-nota-npc-${personagem.id}`
  const nome = personagem.nome

  const irParaCenario = () =>
    void gravarNoMundo((lista) => trocarFicha(lista, personagem.id, (atual) => ({ ...atual, soCenario: true })), {
      texto: `${nome} foi para Só no cenário: fica fora da ordem dos turnos.`,
      desfazer: (lista) => trocarFicha(lista, personagem.id, semCenario),
    })

  const soltar = () => {
    if (modeloId === undefined) return
    void gravarNoMundo((lista) => trocarFicha(lista, personagem.id, soltarDoModelo), {
      texto: `${nome} agora é NPC único: a ficha não segue mais ${modelo?.nome ?? 'o modelo'}.`,
      desfazer: (lista) => trocarFicha(lista, personagem.id, (atual) => ({ ...atual, combate: { forca: atual.combate?.forca ?? FORCA_PADRAO, ...atual.combate, modeloId } })),
    })
  }

  const apagar = () => {
    const indice = personagens.findIndex((candidato) => candidato.id === personagem.id)
    const apagado = personagem
    useMundoDoLivroStore.getState().escolherNpc(modeloId ?? null)
    void gravarNoMundo((lista) => lista.filter((candidato) => candidato.id !== apagado.id), {
      texto: `${nome} saiu do bestiário.`,
      desfazer: (lista) => (lista.some((candidato) => candidato.id === apagado.id) ? lista : [...lista.slice(0, indice), apagado, ...lista.slice(indice)]),
    })
  }

  let de: string
  if (modeloId !== undefined) de = `Variação de ${modelo?.nome ?? 'um modelo'}: nasceu com a ficha dele.`
  else if (variacoes.length > 0) de = `Modelo com ${variacoes.length} ${variacoes.length === 1 ? 'variação' : 'variações'}.`
  else de = 'NPC único. Crie uma variação para usá-lo como modelo.'

  return (
    <section className="mu-cartao mu-bes-det" aria-labelledby="mu-bes-nome">
      <div className="mu-bes-det__cab">
        <Retrato imagem={personagem.retrato} nome={nome} tamanho="g" />
        <div>
          <h3 className="mu-bes-det__nome" id="mu-bes-nome">
            {nome}
          </h3>
          <p className="mu-bes-det__de">
            {modeloId !== undefined ? (
              <span className="mu-etiqueta mu-etiqueta--npc">Variação</span>
            ) : variacoes.length > 0 ? (
              <span className="mu-etiqueta mu-etiqueta--modelo">Modelo</span>
            ) : (
              <span className="mu-etiqueta mu-etiqueta--npc">NPC</span>
            )}
            {daBatalha(personagem) && <span className="mu-etiqueta mu-etiqueta--batalha">Da batalha</span>}
            <span className="dbm-notacao">{notacaoDe(personagem)}</span>
          </p>
        </div>
        <div className="mu-pg-acoes">
          <button type="button" className="mu-bt mu-bt--p" onClick={() => useMundoDoLivroStore.getState().abrirFicha(personagem.id)}>
            Abrir ficha
          </button>
          <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={irParaCenario}>
            <IconeDoMundo nome="cenario" />
            Só no cenário
          </button>
          {variacoes.length === 0 && (
            <button type="button" className="mu-bt mu-bt--p mu-bt--ic" aria-label={`Apagar ${nome}`} title="Apagar" onClick={apagar}>
              <IconeDoMundo nome="lixo" />
            </button>
          )}
        </div>
      </div>
      <p className="mu-pg-nota">
        {de}{' '}
        {modeloId !== undefined && (
          <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={soltar}>
            Soltar do modelo
          </button>
        )}
      </p>

      <div className="mu-bes-bloco dbm">
        <ResumoDoNpcDBT personagem={personagem} ranks={ranks} />
        {avisos.length > 0 && (
          <ul className="dbm-avisos" aria-label="Boa prática do livro">
            {avisos.map((aviso) => (
              <li key={aviso}>{aviso}</li>
            ))}
          </ul>
        )}
      </div>

      {modeloId === undefined && (
        <div className="mu-bes-bloco">
          <h4 className="mu-bes-bloco__tit">Variações</h4>
          <p className="mu-bes-bloco__sub">Mesma ficha com outro nome. Bom para “3 Saibamans”, cada um ajustado na própria ficha.</p>
          <div className="mu-pg-acoes">
            {variacoes.map((variacao) => (
              <button key={variacao.id} type="button" className="mu-chip" onClick={() => useMundoDoLivroStore.getState().escolherNpc(variacao.id)}>
                <Retrato imagem={variacao.retrato} nome={variacao.nome} tamanho="p" />
                {variacao.nome}
              </button>
            ))}
            <button
              type="button"
              className="mu-bt mu-bt--p"
              onClick={() => onNovoNpc({ tipo: 'novo', modeloId: personagem.id, nome: `${primeiroNome(nome)} ${variacoes.length + 1}` })}
            >
              <IconeDoMundo nome="copia" />
              Nova variação
            </button>
          </div>
        </div>
      )}

      <div className="mu-bes-bloco">
        <h4 className="mu-bes-bloco__tit mu-bes-bloco__tit--nota">
          <label htmlFor={notaId}>Anotação do mestre</label>
          <SoVoceVe />
        </h4>
        <EditorDaNota personagem={personagem} campoId={notaId} curto />
      </div>
    </section>
  )
}

export interface PaginaNpcsDBTProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
}

export function PaginaNpcsDBT({ personagens, sistema }: PaginaNpcsDBTProps) {
  const escolhidoId = useMundoDoLivroStore((state) => state.npcEscolhido)
  const [dialogo, setDialogo] = useState<ModoDoNovoNpcDBT | null>(null)

  const npcs = personagens.filter((personagem) => personagem.tipo === 'npc')
  const deCombate = npcs.filter(entraNaBatalha)
  const cenario = npcs.filter((personagem) => !entraNaBatalha(personagem))
  const idsDeCombate = new Set(deCombate.map((personagem) => personagem.id))
  // No topo: quem não é variação, e a variação cujo modelo não está entre os de combate (foi para o cenário).
  const topo = deCombate.filter((personagem) => {
    const modeloId = personagem.combate?.modeloId
    return modeloId === undefined || modeloId === personagem.id || !idsDeCombate.has(modeloId)
  })
  const ordem = topo.flatMap((personagem) => [
    { personagem, variacao: false },
    ...(ehVariacao(personagem) ? [] : variacoesDe(personagem.id, deCombate).map((variacao) => ({ personagem: variacao, variacao: true }))),
  ])
  const escolhido = ordem.find((item) => item.personagem.id === escolhidoId)?.personagem ?? ordem[0]?.personagem

  const voltarParaABatalha = (personagem: Personagem) =>
    void gravarNoMundo((lista) => trocarFicha(lista, personagem.id, semCenario), {
      texto: `${personagem.nome} saiu do cenário e entra na batalha.`,
      desfazer: (lista) => trocarFicha(lista, personagem.id, (atual) => ({ ...atual, soCenario: true })),
    }).then((gravou) => {
      if (gravou) useMundoDoLivroStore.getState().escolherNpc(personagem.id)
    })

  if (RANKS_DO_LIVRO === null) {
    return (
      <div className="mu-pg">
        <div className="mu-vazio mu-vazio--erro" role="alert">
          <p>A tabela de ranks do livro Dragon Ball veio incompleta nesta versão do app: o bestiário não consegue calcular as fichas.</p>
        </div>
      </div>
    )
  }
  const ranks = RANKS_DO_LIVRO

  return (
    <div className="mu-pg dbm">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">NPCs de combate</h2>
          <p className="mu-pg-sub">Crie do zero ou a partir dos NPCs prontos das sagas. O PV de cada um sai do ND: quantos golpes do rank ele aguenta.</p>
        </div>
        <div className="mu-pg-acoes">
          <button type="button" className="mu-bt mu-bt--primario" onClick={() => setDialogo({ tipo: 'novo' })}>
            <IconeDoMundo nome="mais" />
            Novo NPC
          </button>
        </div>
      </header>

      <div className="mu-bes">
        <div className="mu-bes-lista">
          <div className="mu-cartao mu-bes-grupo">
            <h3 className="mu-bes-grupo__tit">
              <span>Modelos e variações</span>
              <span aria-hidden="true">Rank</span>
            </h3>
            {ordem.length === 0 ? (
              <p className="mu-pg-nota" style={{ padding: '4px 8px 8px' }}>
                Nenhum NPC de combate.
              </p>
            ) : (
              <ul>
                {ordem.map(({ personagem, variacao }) => (
                  <ItemDaLista key={personagem.id} personagem={personagem} deCombate={deCombate} escolhido={escolhido?.id === personagem.id} variacao={variacao} />
                ))}
              </ul>
            )}
          </div>
          <div className="mu-cartao mu-bes-grupo mu-bes-cenario">
            <h3 className="mu-bes-grupo__tit">
              <span>Só no cenário · fora da batalha</span>
            </h3>
            {cenario.length === 0 ? (
              <p className="mu-pg-nota" style={{ padding: '4px 8px 8px' }}>
                Nenhum NPC só de cenário.
              </p>
            ) : (
              <ul>
                {cenario.map((personagem) => (
                  <li key={personagem.id} className="mu-bes-item">
                    <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
                    <span className="mu-bes-item__txt">
                      <span className="mu-bes-item__nome">{personagem.nome}</span>
                      <span className="mu-bes-item__sub">{notacaoDe(personagem)}</span>
                    </span>
                    <button type="button" className="mu-bt mu-bt--p" aria-label={`Voltar ${personagem.nome} para a batalha`} onClick={() => voltarParaABatalha(personagem)}>
                      Voltar à batalha
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {escolhido === undefined ? (
          <div className="mu-vazio">
            <p>Nenhum NPC de combate ainda. Crie o primeiro em branco ou escolha um dos NPCs prontos das sagas.</p>
            <button type="button" className="mu-bt mu-bt--p" onClick={() => setDialogo({ tipo: 'novo' })}>
              <IconeDoMundo nome="mais" />
              Novo NPC
            </button>
          </div>
        ) : (
          <DetalheDoNpc key={escolhido.id} personagem={escolhido} personagens={personagens} deCombate={deCombate} ranks={ranks} onNovoNpc={setDialogo} />
        )}
      </div>

      {dialogo !== null && (
        <NovoNpcDBTDialog
          modo={dialogo}
          sistema={sistema}
          personagens={personagens}
          ranks={ranks}
          onClose={() => setDialogo(null)}
          onFeito={(personagemId, abrirFicha) => {
            useMundoDoLivroStore.getState().escolherNpc(personagemId)
            if (abrirFicha) useMundoDoLivroStore.getState().abrirFicha(personagemId, true)
          }}
        />
      )}
    </div>
  )
}
