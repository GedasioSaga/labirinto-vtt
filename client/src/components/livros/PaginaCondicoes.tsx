import { useMemo, useState } from 'react'
import { catalogoDeCondicoes, type CondicaoDoCatalogo } from '../../lib/condicoes/catalogo'
import { fraseDaRegra, NOMES_DAS_REGRAS, rotuloDoNumero, tetoDoNumero } from '../../lib/condicoes/frases'
import { comCondicoesNaFicha, condicoesDe, porCondicao, tirarCondicao, type PedidoDeCondicao } from '../../lib/condicoes/naFicha'
import { criarCondicaoPropria, lerCondicaoPropria, type RascunhoDeCondicao } from '../../lib/condicoesProprias'
import type { CondicaoNaFicha } from '../../lib/itens/modelo'
import { variacoesDe } from '../../lib/livros/combate'
import type { Personagem } from '../../lib/personagem'
import { tirarCondicaoDeTodasAsCenas, trocarCondicaoEmTodasAsCenas } from '../../stores/condicoesNasCenas'
import { useCondicoesPropriasStore } from '../../stores/condicoesPropriasStore'
import { useToastStore } from '../../stores/toastStore'
import type { CondicaoPropria, RegraDaCondicao } from '../../types/map'
import { ChipDaCondicao, FormDePorCondicao, simboloDoCatalogo } from '../condicoes/PorCondicao'
import { FormDaCondicao } from '../CondicoesProprias'
import { PastilhaDeCondicao } from '../PastilhaDeCondicao'
import { gravarNoMundo } from './comum'
import { IconeDoMundo } from './icones'
import '../condicoes/condicoes.css'

/** O tamanho da prévia da pastilha no formulário (a página não tem token para medir). */
const PREVIA_DA_PASTILHA = 32
const REGRAS: readonly RegraDaCondicao[] = ['vida', 'cura', 'narra']
const VIDA_INICIAL = 3
const CURA_INICIAL = 50

type Edicao = { tipo: 'nova' } | { tipo: 'aparencia'; condicao: CondicaoPropria } | null

/** A condição sem o símbolo digitado: o rascunho do formulário só o traz quando ele vale (escolher um desenho o limpa). */
function semTexto(condicao: CondicaoPropria): CondicaoPropria {
  const { texto: _digitado, ...resto } = condicao
  return resto
}

function nomeDe(personagem: Personagem): string {
  return personagem.nome.trim() || 'Personagem sem nome'
}

/** As postas de `condId` numa ficha. */
function postasDe(personagem: Personagem, condId: string): CondicaoNaFicha[] {
  return condicoesDe(personagem).filter((condicao) => condicao.condId === condId)
}

/** Guarda as condições de antes das fichas que mudam, para o Desfazer voltar só elas. */
function gravarCondicoes(personagens: readonly Personagem[], ids: readonly string[], mudar: (atual: Personagem) => Personagem, texto: string): boolean {
  const antes = new Map<string, readonly CondicaoNaFicha[]>()
  for (const personagem of personagens) {
    if (!ids.includes(personagem.id)) continue
    if (mudar(personagem) !== personagem) antes.set(personagem.id, condicoesDe(personagem))
  }
  if (antes.size === 0) return false
  void gravarNoMundo((lista) => lista.map((personagem) => (antes.has(personagem.id) ? mudar(personagem) : personagem)), {
    texto,
    desfazer: (lista) => lista.map((personagem) => {
      const voltam = antes.get(personagem.id)
      return voltam === undefined ? personagem : comCondicoesNaFicha(personagem, voltam)
    }),
  })
  return true
}

export interface PaginaCondicoesProps {
  personagens: readonly Personagem[]
}

/**
 * CONDIÇÕES (itens refeitos, PLANO §1.5; etapa E4b; tela H do protótipo aprovado): o catálogo
 * inteiro (as de fábrica e as criadas), com quantas fichas estão com cada uma; a escolhida com a
 * regra (vida, cura ou narra) e o número; "Quem está com" (jogador: a ficha; NPC: a cópia de cada
 * token, nunca a ficha modelo); e "Pôr condição em alguém". Criar condição abre o mesmo formulário
 * de nome, símbolo e cor do painel do token; a nova entra na lista de pôr na hora.
 *
 * Grava nas fichas da pasta (`gravarNoMundo`, com Desfazer); a lista das criadas mora na pasta
 * (`stores/condicoesPropriasStore.ts`). Só o mestre abre o livro (decisão 18).
 */
export function PaginaCondicoes({ personagens }: PaginaCondicoesProps) {
  const criadas = useCondicoesPropriasStore((state) => state.catalogo)
  const catalogo = useMemo(() => catalogoDeCondicoes(criadas), [criadas])
  const [selId, setSelId] = useState<string>(catalogo[0]?.id ?? '')
  const [edicao, setEdicao] = useState<Edicao>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const sel = catalogo.find((condicao) => condicao.id === selId) ?? catalogo[0]
  // A ficha modelo do NPC não recebe condição: cada token tem a sua cópia (decisão 1).
  const alvos = personagens.filter((personagem) => variacoesDe(personagem.id, personagens).length === 0).map((personagem) => ({ id: personagem.id, nome: nomeDe(personagem) }))
  const quantasTem = (condId: string) => personagens.filter((personagem) => postasDe(personagem, condId).length > 0).length

  const abrir = (proxima: Edicao) => {
    setAviso(null)
    setEdicao(proxima)
  }

  const salvarAparencia = (rascunho: RascunhoDeCondicao) => {
    if (edicao === null) return
    // Editar não perde a regra nem o número: a aparência entra por cima da condição como está.
    const condicao = edicao.tipo === 'nova' ? criarCondicaoPropria(rascunho) : lerCondicaoPropria({ ...semTexto(edicao.condicao), ...rascunho, id: edicao.condicao.id })
    if (condicao === null) {
      setAviso('Não deu para gravar: confira o nome e o símbolo.')
      return
    }
    if (!useCondicoesPropriasStore.getState().salvar(condicao)) {
      setAviso('A lista de condições está cheia: apague uma antes de criar outra.')
      return
    }
    if (edicao.tipo === 'aparencia') trocarCondicaoEmTodasAsCenas(condicao)
    else useToastStore.getState().push('info', `${condicao.nome} entrou no catálogo: já dá para pôr em alguém.`)
    setSelId(condicao.id)
    abrir(null)
  }

  const mudarRegra = (propria: CondicaoPropria, regra: RegraDaCondicao, n: number) => {
    const nova = lerCondicaoPropria(regra === 'narra' ? { ...propria, regra, n: undefined } : { ...propria, regra, n })
    if (nova === null || !useCondicoesPropriasStore.getState().salvar(nova)) useToastStore.getState().push('error', 'Não deu para gravar a regra.')
  }

  const apagar = (condicao: CondicaoDoCatalogo) => {
    useCondicoesPropriasStore.getState().excluir(condicao.id)
    tirarCondicaoDeTodasAsCenas(condicao.id)
    setSelId(catalogo[0]?.id ?? '')
  }

  const por = (ids: readonly string[], pedido: PedidoDeCondicao): boolean => {
    const nomeDaCondicao = catalogo.find((condicao) => condicao.id === pedido.condId)?.nome ?? 'A condição'
    const nomes = personagens.filter((personagem) => ids.includes(personagem.id)).map(nomeDe)
    const pos = gravarCondicoes(personagens, ids, (atual) => porCondicao(atual, pedido, criadas), `${nomeDaCondicao} em ${nomes.join(', ')}.`)
    if (!pos) useToastStore.getState().push('error', `Não deu para pôr ${nomeDaCondicao}: a ficha já está com condições demais, ou o número não vale.`)
    return pos
  }

  const tirar = (personagem: Personagem, condicao: CondicaoNaFicha, nomeDaCondicao: string) => {
    gravarCondicoes(personagens, [personagem.id], (atual) => tirarCondicao(atual, condicao.id), `${nomeDaCondicao} saiu de ${nomeDe(personagem)}.`)
  }

  const comEla = sel === undefined ? [] : personagens.filter((personagem) => postasDe(personagem, sel.id).length > 0)
  const propria = sel?.criada === true && sel.pastilha.tipo === 'propria' ? sel.pastilha.condicao : null

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Condições</h2>
          <p className="mu-pg-sub">
            Moram na ficha do jogador ou na cópia do NPC, não no token. Aparecem iguais no mapa, na batalha, na ficha e na tela do jogador.
          </p>
        </div>
        <button type="button" className="mu-bt mu-bt--p" onClick={() => abrir(edicao?.tipo === 'nova' ? null : { tipo: 'nova' })} aria-expanded={edicao?.tipo === 'nova'}>
          <IconeDoMundo nome="mais" />
          Criar condição
        </button>
      </header>
      {edicao !== null && (
        <section className="cd-pg-form" aria-label={edicao.tipo === 'nova' ? 'Criar condição' : `Mudar ${edicao.condicao.nome}`}>
          <FormDaCondicao
            key={edicao.tipo === 'nova' ? 'nova' : edicao.condicao.id}
            inicial={edicao.tipo === 'nova' ? null : edicao.condicao}
            aviso={aviso}
            tamanhoNoMapa={PREVIA_DA_PASTILHA}
            onSalvar={salvarAparencia}
            onFechar={() => abrir(null)}
          />
        </section>
      )}
      <div className="cd-pg">
        <ul className="cd-pg-lista" aria-label="Catálogo de condições">
          {catalogo.map((condicao) => {
            const n = quantasTem(condicao.id)
            return (
              <li key={condicao.id}>
                <button type="button" className="cd-pg-linha" aria-pressed={condicao.id === sel?.id} onClick={() => setSelId(condicao.id)}>
                  <PastilhaDeCondicao symbol={simboloDoCatalogo(condicao)} tamanho={20} />
                  <span className="cd-pg-linha__txt">
                    <span className="cd-pg-linha__nome">{condicao.nome}</span>
                    <span className="cd-pg-linha__resumo">
                      {NOMES_DAS_REGRAS[condicao.regra]}
                      {condicao.regra === 'vida' ? `: ${condicao.n} por vez` : condicao.regra === 'cura' ? `: ${condicao.n}%` : ''}
                      {condicao.criada ? '. Criada por você' : ''}
                    </span>
                  </span>
                  <span className="cd-pg-linha__qtd">{n === 0 ? '' : n === 1 ? '1 está com ela' : `${n} estão com ela`}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {sel !== undefined && (
          <div className="cd-pg-lado">
            <section className="cd-pg-secao" aria-labelledby="cd-pg-tit">
              <h3 className="cd-pg-secao__tit" id="cd-pg-tit">
                <PastilhaDeCondicao symbol={simboloDoCatalogo(sel)} tamanho={22} />
                {sel.nome}
              </h3>
              <p className="cd-nota">{sel.criada ? 'Criada por você. Mudou aqui, muda em todo lugar que ela aparece.' : 'Do jogo: a regra é fixa.'}</p>
              {propria !== null ? (
                <RegraDaCriada key={propria.id} propria={propria} regra={sel.regra} n={sel.n} onMudar={(regra, n) => mudarRegra(propria, regra, n)} />
              ) : (
                <p className="cd-pg-regra">Regra: {fraseDaRegra(sel.regra, sel.n)}.</p>
              )}
              {propria !== null && (
                <div className="cd-pg-acoes">
                  <button type="button" className="mu-bt" onClick={() => abrir({ tipo: 'aparencia', condicao: propria })}>
                    Mudar nome e pastilha
                  </button>
                  <button
                    type="button"
                    className="mu-bt"
                    disabled={comEla.length > 0}
                    title={comEla.length > 0 ? 'Está em uso: tire de quem está com ela antes.' : undefined}
                    onClick={() => apagar(sel)}
                  >
                    <IconeDoMundo nome="lixo" />
                    Apagar condição
                  </button>
                </div>
              )}
            </section>
            <section className="cd-pg-secao" aria-labelledby="cd-pg-quem">
              <h3 className="cd-pg-secao__tit" id="cd-pg-quem">
                Quem está com {sel.nome}
              </h3>
              {comEla.length === 0 ? (
                <p className="cd-nota">Ninguém agora.</p>
              ) : (
                <ul className="cd-pg-quem">
                  {comEla.map((personagem) => (
                    <li key={personagem.id}>
                      <span className="cd-pg-quem__nome">{nomeDe(personagem)}</span>
                      {postasDe(personagem, sel.id).map((condicao) => (
                        <ChipDaCondicao key={condicao.id} condicao={condicao} criadas={criadas} onTirar={(posta, nome) => tirar(personagem, posta, nome)} />
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="cd-pg-secao" aria-labelledby="cd-pg-por">
              <h3 className="cd-pg-secao__tit" id="cd-pg-por">
                Pôr condição em alguém
              </h3>
              <FormDePorCondicao key={sel.id} alvos={alvos} catalogo={catalogo} condIdInicial={sel.id} onPor={por} />
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

/** A regra da condição criada: o seletor (Tira vida, Corta a cura, O mestre narra) e o número, gravados ao trocar ou ao sair do campo. */
function RegraDaCriada({ propria, regra, n, onMudar }: { propria: CondicaoPropria; regra: RegraDaCondicao; n: number; onMudar: (regra: RegraDaCondicao, n: number) => void }) {
  const [texto, setTexto] = useState(String(n))
  const rotulo = rotuloDoNumero(regra)
  const numero = Number.parseInt(texto, 10)
  const valido = Number.isInteger(numero) && numero >= 0 && numero <= tetoDoNumero(regra)
  const gravarNumero = () => {
    if (valido && numero !== n) onMudar(regra, numero)
  }
  return (
    <div className="cd-pg-regras">
      <div className="cd-pg-seg" role="radiogroup" aria-label={`Regra de ${propria.nome}`}>
        {REGRAS.map((opcao) => (
          <button key={opcao} type="button" role="radio" aria-checked={regra === opcao} className="cd-pg-seg__op" onClick={() => {
              if (opcao === regra) return
              // Da que narra para a que tem número: nasce o de fábrica parecido (3 de vida, metade da cura).
              const proximo = opcao === 'narra' ? 0 : n > 0 ? n : opcao === 'vida' ? VIDA_INICIAL : CURA_INICIAL
              setTexto(String(proximo))
              onMudar(opcao, proximo)
            }}>
            {NOMES_DAS_REGRAS[opcao]}
          </button>
        ))}
      </div>
      {rotulo !== null && (
        <label className="cd-campo cd-campo--num">
          <span className="cd-campo__rot">{rotulo}</span>
          <input
            className="lb-input"
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={texto}
            aria-invalid={!valido}
            onChange={(evento) => setTexto(evento.target.value.replace(/\D/g, ''))}
            onBlur={gravarNumero}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') gravarNumero()
            }}
          />
        </label>
      )}
      <p className="cd-pg-regra">Regra: {fraseDaRegra(regra, valido ? numero : n)}.</p>
    </div>
  )
}
