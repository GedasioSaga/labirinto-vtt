import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { ArmadilhaDoObjeto, ConteudoDoObjeto, Prop, TipoDeArmadilha } from '../../types/map'
import {
  armadilhaMudouDoPadrao,
  armadilhaPadrao,
  conteudoDe,
  DANO_DA_ARMADILHA_MAX,
  ITENS_NO_CONTEUDO_MAX,
  MINIGAME_DO_OBJETO,
  minigameLigado,
  mobiliaDoConteudo,
  MOEDAS_NO_CONTEUDO_MAX,
  objetoReposto,
  POR_VEZ_DA_ARMADILHA_MAX,
  TURNOS_DA_ARMADILHA_MAX,
} from '../../lib/conteudoDoObjeto'
import { itemParaDar, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { ITEM_QUANTIDADE_MAX } from '../../lib/items'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { useMapStore } from '../../stores/mapStore'
import { Botao } from '../grimorio/Botao'
import { Toggle } from '../Toggle'
import './conteudoDoObjeto.css'

/*
 * CONTEÚDO do baú, da caixa e do barril (ficha do objeto, protótipo aprovado
 * pelo mestre em 15/11/2026, tela 2): itens do Acervo com quantidade, moedas e
 * a Armadilha (Nenhuma, Cobra, Aranha) já com os padrões e "Voltar ao padrão".
 * Aberto, mostra quem abriu e "Fechar e repor". Cada mudança é um passo do
 * Ctrl+Z (`updateProp`). Regras em `lib/conteudoDoObjeto.ts`.
 */

const LIMITE_DA_BUSCA = 8

function hora(em: number): string {
  const data = new Date(em)
  return `${String(data.getHours()).padStart(2, '0')}h${String(data.getMinutes()).padStart(2, '0')}`
}

interface PassoProps {
  rotulo: string
  valor: number
  min: number
  max: number
  aoMudar: (valor: number) => void
  passo?: number
}

/** − valor +, com o número editável; fora do intervalo cai na ponta. */
function Passo({ rotulo, valor, min, max, aoMudar, passo = 1 }: PassoProps) {
  const limitar = (n: number) => Math.min(max, Math.max(min, Math.round(n)))
  return (
    <span className="lb-conteudo__passo" role="group" aria-label={rotulo}>
      <button type="button" className="lb-conteudo__passo-bt" aria-label={`Menos ${rotulo.toLowerCase()}`} disabled={valor <= min} onClick={() => aoMudar(limitar(valor - passo))}>
        −
      </button>
      <input
        className="lb-conteudo__passo-num"
        type="number"
        inputMode="numeric"
        aria-label={rotulo}
        min={min}
        max={max}
        value={valor}
        onChange={(evento) => {
          const lido = Number(evento.target.value)
          if (evento.target.value !== '' && Number.isFinite(lido)) aoMudar(limitar(lido))
        }}
      />
      <button type="button" className="lb-conteudo__passo-bt" aria-label={`Mais ${rotulo.toLowerCase()}`} disabled={valor >= max} onClick={() => aoMudar(limitar(valor + passo))}>
        +
      </button>
    </span>
  )
}

/** A busca no Acervo: Enter põe o primeiro achado, Esc fecha. */
function EscolhaDoAcervo({ aoEscolher, aoFechar, verbo }: { aoEscolher: (item: ItemDoCatalogo) => void; aoFechar: () => void; verbo: string }) {
  const itens = useAcervoDeItensStore((state) => state.itens)
  const [busca, setBusca] = useState('')
  const campo = useRef<HTMLInputElement>(null)
  const listaId = useId()
  useEffect(() => {
    void useAcervoDeItensStore.getState().recarregar()
    campo.current?.focus()
  }, [])
  const achados = useMemo(() => {
    const chave = busca.trim().toLocaleLowerCase('pt-BR')
    const lista = chave === '' ? itens : itens.filter((item) => item.nome.toLocaleLowerCase('pt-BR').includes(chave) || item.categoria.toLocaleLowerCase('pt-BR').includes(chave))
    return lista.slice(0, LIMITE_DA_BUSCA)
  }, [busca, itens])
  const aoTeclar = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'Escape') {
      evento.stopPropagation()
      aoFechar()
    } else if (evento.key === 'Enter' && achados.length > 0) {
      evento.preventDefault()
      aoEscolher(achados[0])
    }
  }
  return (
    <div className="lb-conteudo__acervo" role="dialog" aria-label="Itens do acervo">
      <input
        ref={campo}
        className="lb-conteudo__busca"
        type="search"
        placeholder="Procurar no acervo"
        aria-label="Procurar no acervo"
        aria-controls={listaId}
        value={busca}
        onChange={(evento) => setBusca(evento.target.value)}
        onKeyDown={aoTeclar}
      />
      {itens.length === 0 ? (
        <p className="lb-field__hint">O acervo de itens está vazio. Crie itens na aba Acervo do livro.</p>
      ) : achados.length === 0 ? (
        <p className="lb-field__hint">Nada com esse nome no acervo.</p>
      ) : (
        <ul id={listaId} className="lb-conteudo__achados">
          {achados.map((item) => (
            <li key={item.id}>
              <button type="button" className="lb-conteudo__achado" onClick={() => aoEscolher(item)}>
                <span>{item.nome}</span>
                {item.categoria !== '' && <small>{item.categoria}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="lb-field__hint">Enter {verbo} · Esc fecha</p>
    </div>
  )
}

const OPCOES_DA_ARMADILHA: readonly { valor: TipoDeArmadilha | 'nenhuma'; rotulo: string }[] = [
  { valor: 'nenhuma', rotulo: 'Nenhuma' },
  { valor: 'cobra', rotulo: 'Cobra' },
  { valor: 'aranha', rotulo: 'Aranha' },
]

function CamposDaArmadilha({ armadilha, aoMudar, jumpscare }: { armadilha: ArmadilhaDoObjeto; aoMudar: (armadilha: ArmadilhaDoObjeto) => void; jumpscare: boolean }) {
  const mudou = armadilhaMudouDoPadrao(armadilha)
  const voltar = mudou && (
    <button type="button" className="lb-conteudo__link" onClick={() => aoMudar(armadilhaPadrao(armadilha.tipo))}>
      Voltar ao padrão
    </button>
  )
  return (
    <div className="lb-conteudo__armadilha">
      <div className="lb-conteudo__par">
        <span>
          Dano na hora <small>PV</small>
        </span>
        <Passo rotulo="Dano na hora, em PV" valor={armadilha.dano} min={0} max={DANO_DA_ARMADILHA_MAX} aoMudar={(dano) => aoMudar({ ...armadilha, dano })} />
      </div>
      <div className="lb-conteudo__par">
        <span>
          {armadilha.efeito} <small>turnos</small>
        </span>
        <Passo rotulo={`Turnos de ${armadilha.efeito}`} valor={armadilha.turnos} min={1} max={TURNOS_DA_ARMADILHA_MAX} aoMudar={(turnos) => aoMudar({ ...armadilha, turnos })} />
      </div>
      {armadilha.tipo === 'cobra' ? (
        <>
          <div className="lb-conteudo__par">
            <span>
              Por turno <small>PV perdidos</small>
            </span>
            <Passo rotulo="PV perdidos por turno" valor={armadilha.porVez} min={1} max={POR_VEZ_DA_ARMADILHA_MAX} aoMudar={(porVez) => aoMudar({ ...armadilha, porVez })} />
          </div>
          <p className="lb-field__hint">
            Padrão da cobra: 8 PV na hora e Envenenado por 3 turnos, perdendo 4 PV em cada. {voltar}
          </p>
          <p className="lb-field__hint">Jumpscare {jumpscare ? 'ligado' : 'desligado'} neste mapa (Configurações do mapa, Armadilhas).</p>
        </>
      ) : (
        <p className="lb-field__hint">
          Lento: anda metade do passo enquanto durar. Padrão da aranha: 5 PV e Lento por 2 turnos. {voltar}
        </p>
      )}
    </div>
  )
}

/** A seção Conteúdo; só existe para o baú, a caixa, o barril e os destroços deles. */
export function ConteudoDoObjetoFicha({ prop }: { prop: Prop }) {
  const updateProp = useMapStore((state) => state.updateProp)
  const jumpscare = useMapStore((state) => state.map.semJumpscare !== true)
  const [escolhendo, setEscolhendo] = useState(false)
  const explicacaoDoMinigameId = useId()
  const tipo = mobiliaDoConteudo(prop)
  const conteudo = conteudoDe(prop)
  if (tipo === null || conteudo === null) return null
  const bau = tipo === 'bau'
  const verbo = bau ? 'abrir' : 'quebrar'
  const ligado = minigameLigado(prop.conteudo)
  const mudar = (novo: ConteudoDoObjeto) => updateProp(prop.id, { conteudo: novo })

  const porItem = (escolhido: ItemDoCatalogo) => {
    // Sem munições: o conteúdo do objeto não guarda a lista; a arma tirada dele cai no Acervo de agora.
    const item = itemParaDar(escolhido, [])
    const ja = conteudo.itens.findIndex((dentro) => dentro.item.itemId === escolhido.id)
    if (ja >= 0) {
      mudar({ ...conteudo, itens: conteudo.itens.map((dentro, i) => (i === ja ? { ...dentro, quantidade: Math.min(ITEM_QUANTIDADE_MAX, dentro.quantidade + 1) } : dentro)) })
    } else if (conteudo.itens.length < ITENS_NO_CONTEUDO_MAX) {
      mudar({ ...conteudo, itens: [...conteudo.itens, { item, quantidade: 1 }] })
    }
    setEscolhendo(false)
  }

  const trocarArmadilha = (valor: TipoDeArmadilha | 'nenhuma') => {
    if (valor === (conteudo.armadilha?.tipo ?? 'nenhuma')) return
    mudar({ ...conteudo, armadilha: valor === 'nenhuma' ? null : armadilhaPadrao(valor) })
  }

  const aberto = conteudo.aberto
  return (
    <div className="lb-conteudo">
      {/* MINIGAME PARA O JOGADOR (16/11/2026): ligado, o jogador vê o selo de latão no objeto e o toque abre o jogo. */}
      {/* O mesmo interruptor de "Barra a passagem" (`Toggle`), com a explicação embaixo. */}
      <div className="lb-conteudo__minigame">
        <Toggle label="Minigame para o jogador" checked={ligado} onChange={(liga) => mudar({ ...conteudo, minigame: liga })} describedBy={explicacaoDoMinigameId} />
        <p id={explicacaoDoMinigameId} className="lb-field__hint">
          {ligado ? (
            <>
              <b>{MINIGAME_DO_OBJETO[tipo]}</b>, pelo tipo do objeto. O jogador vê o selo, encosta e joga na tela dele; se errar, tenta de novo sem custo.
            </>
          ) : (
            'Desligado: o toque do jogador não abre nada, e o objeto fica sem selo.'
          )}
        </p>
      </div>
      {aberto !== undefined && (
        <div className="lb-conteudo__aberto">
          <p>
            <b>
              {aberto.por === '' ? 'Alguém' : aberto.por} {bau ? 'abriu' : 'quebrou'}
              {aberto.em > 0 ? ` às ${hora(aberto.em)}` : ''}.
            </b>
          </p>
          <Botao
            tamanho="p"
            onClick={() => {
              // O tamanho volta junto: o barril quebrado é maior que o barril (os cacos em volta), no mesmo centro.
              const reposto = objetoReposto(prop)
              updateProp(prop.id, { conteudo: reposto.conteudo, mobilia: reposto.mobilia, width: reposto.width, height: reposto.height })
            }}
          >
            Fechar e repor
          </Botao>
          <p className="lb-field__hint">Repor guarda o mesmo conteúdo de novo, para outro jogador {verbo}.</p>
        </div>
      )}
      <div className="lb-conteudo__campo">
        <span className="lb-conteudo__rotulo">
          Itens{conteudo.itens.length > 0 && <small>{conteudo.itens.reduce((soma, dentro) => soma + dentro.quantidade, 0)} no total</small>}
        </span>
        {conteudo.itens.length === 0 ? (
          <p className="lb-conteudo__vazio">Nenhum item. {bau ? 'O baú abre vazio.' : 'Quebra e não tem nada.'}</p>
        ) : (
          <ul className="lb-conteudo__itens">
            {conteudo.itens.map((dentro, indice) => (
              <li key={`${dentro.item.itemId ?? dentro.item.nome}-${indice}`} className="lb-conteudo__item">
                <span className="lb-conteudo__nome">
                  {dentro.item.nome}
                  {dentro.item.categoria !== undefined && <small>{dentro.item.categoria}</small>}
                </span>
                <Passo
                  rotulo={`Quantidade de ${dentro.item.nome}`}
                  valor={dentro.quantidade}
                  min={1}
                  max={ITEM_QUANTIDADE_MAX}
                  aoMudar={(quantidade) => mudar({ ...conteudo, itens: conteudo.itens.map((outro, i) => (i === indice ? { ...outro, quantidade } : outro)) })}
                />
                <button type="button" className="lb-conteudo__tirar" aria-label={`Tirar ${dentro.item.nome}`} onClick={() => mudar({ ...conteudo, itens: conteudo.itens.filter((_, i) => i !== indice) })}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <Botao tamanho="p" largo aria-haspopup="dialog" aria-expanded={escolhendo} onClick={() => setEscolhendo((antes) => !antes)}>
          + Item do acervo
        </Botao>
        {escolhendo && <EscolhaDoAcervo verbo={bau ? 'põe no baú' : tipo === 'caixa' ? 'põe na caixa' : 'põe no barril'} aoEscolher={porItem} aoFechar={() => setEscolhendo(false)} />}
      </div>
      <div className="lb-conteudo__par">
        <span>Moedas</span>
        <Passo rotulo="Moedas" valor={conteudo.moedas} min={0} max={MOEDAS_NO_CONTEUDO_MAX} passo={5} aoMudar={(moedas) => mudar({ ...conteudo, moedas })} />
      </div>
      <div className="lb-conteudo__campo">
        <span className="lb-conteudo__rotulo">Armadilha</span>
        <div className="lb-conteudo__seg" role="radiogroup" aria-label="Armadilha">
          {OPCOES_DA_ARMADILHA.map((opcao) => {
            const marcada = (conteudo.armadilha?.tipo ?? 'nenhuma') === opcao.valor
            return (
              <button key={opcao.valor} type="button" role="radio" aria-checked={marcada} className="lb-conteudo__seg-bt" onClick={() => trocarArmadilha(opcao.valor)}>
                {opcao.rotulo}
              </button>
            )
          })}
        </div>
        {conteudo.armadilha === null ? (
          <p className="lb-field__hint">Abriu, pegou. Nada pula.</p>
        ) : (
          <CamposDaArmadilha armadilha={conteudo.armadilha} jumpscare={jumpscare} aoMudar={(armadilha) => mudar({ ...conteudo, armadilha })} />
        )}
      </div>
      <p className="lb-field__hint">O jogador só descobre o que tem ao {verbo}.</p>
    </div>
  )
}
