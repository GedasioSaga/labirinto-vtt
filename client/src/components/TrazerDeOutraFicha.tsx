import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { pecasDoCartao } from '../lib/batalha/mecanica/leitura'
import { camposVisiveis, CARTAO_SEM_NOME, paragrafosDoCartao, PERSONAGEM_SEM_NOME, type CartaoDaFicha, type Personagem } from '../lib/personagem'
import type { AbaDoSistema, SistemaDeRpg } from '../lib/sistemaDeRpg'
import { cartaoCasaComBusca, copiaDoCartao, fichaCasaComBusca, fichasParaTrazer, type CartaoParaTrazer, type FichaParaTrazer } from '../lib/trazerDeOutraFicha'
import { etiquetaDaMecanica, pecasAMao, resumoDaMecanica } from '../lib/batalha/mecanica/resumo'
import { ImagemOuIniciais } from './FichaPecas'
import { BackIcon } from './icons'
import './EscolherDoLivro.css'
import './TrazerDeOutraFicha.css'

/**
 * "TRAZER DE OUTRA FICHA": na aba em edição, logo abaixo dos botões (o mesmo
 * lugar e a mesma moldura do "Escolher do livro"). Dois passos na mesma caixa:
 *
 * 1. a lista das outras fichas da pasta que têm algo nesta aba, com busca pelo
 *    nome da ficha ou do cartão ("bolha" acha o Tree);
 * 2. os cartões da ficha escolhida, cada um com caixa de marcar e o resumo do
 *    que faz; "Trazer" copia os marcados para a ficha em edição.
 *
 * O que entra é cópia (`copiaDoCartao`): mudar depois não muda a outra ficha.
 * Esc volta um passo: do passo 2 para a lista, da lista fecha a caixa (nunca a ficha).
 */

export interface TrazerDeOutraFichaProps {
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  /** A ficha em edição: quem recebe as cópias. */
  personagem: Personagem
  /** As fichas da pasta (a em edição pode vir junto: ela sai da lista). */
  fichas: readonly Personagem[]
  /** Nomes (minúsculos) dos cartões que a aba já tem: o igual aparece avisado, e continua podendo vir. */
  nomesNaFicha: ReadonlySet<string>
  /** As cópias prontas, na ordem da outra ficha, e o nome de quem as tinha. */
  onTrazer: (cartoes: CartaoDaFicha[], deQuem: string) => void
  onFechar: () => void
}

const TIPO: Record<Personagem['tipo'], string> = { jogador: 'Jogador', npc: 'NPC' }

function nomeDaFicha(personagem: Personagem): string {
  return personagem.nome.trim() === '' ? PERSONAGEM_SEM_NOME : personagem.nome
}

function nomeDoCartao(cartao: CartaoDaFicha): string {
  return cartao.nome.trim() === '' ? CARTAO_SEM_NOME : cartao.nome
}

/**
 * De onde sai a técnica que mora dentro de uma transformação: na ficha de quem
 * traz ela chega solta, então a lista diz de que forma ela é ("da forma Gear 4").
 * O nome que já começa por "Forma" não repete a palavra ("da Forma Híbrida").
 */
function origemNaForma(forma: string): string {
  const nome = forma.trim()
  if (nome === '') return 'de uma forma sem nome'
  return /^forma\b/i.test(nome) ? `da ${nome}` : `da forma ${nome}`
}

/** "1 habilidade", "3 habilidades": a conta com a palavra da aba. */
function contaDaAba(aba: AbaDoSistema, quantos: number): string {
  return `${quantos} ${(quantos === 1 ? aba.item : aba.nome).toLocaleLowerCase('pt-BR')}`
}

/** O cartão que segue pelo texto, em uma linha: os campos curtos ("Custo: 30 SP · Ação: Simples") ou o começo do parágrafo. */
function resumoEmTexto(aba: AbaDoSistema, cartao: CartaoDaFicha): string {
  const linhas = camposVisiveis(aba, cartao, 'linha')
    .slice(0, 4)
    .map((linha) => (linha.rotulo.length > 0 ? `${linha.rotulo}: ${linha.valor}` : linha.valor))
  if (linhas.length > 0) return linhas.join(' · ')
  return [...camposVisiveis(aba, cartao, 'destaque').map((linha) => linha.valor), ...paragrafosDoCartao(aba, cartao)][0] ?? ''
}

function Retrato({ personagem }: { personagem: Personagem }) {
  return (
    <span className="lb-trazer__retrato" aria-hidden="true">
      <ImagemOuIniciais imagem={personagem.retrato} nome={nomeDaFicha(personagem)} />
    </span>
  )
}

export function TrazerDeOutraFicha({ aba, sistema, personagem, fichas, nomesNaFicha, onTrazer, onFechar }: TrazerDeOutraFichaProps) {
  const [busca, setBusca] = useState('')
  const [escolhidaId, setEscolhidaId] = useState<string | null>(null)
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set())
  const buscaRef = useRef<HTMLInputElement>(null)
  const voltarRef = useRef<HTMLButtonElement>(null)
  /** Voltar à lista devolve o foco à busca; a primeira montagem já o põe lá pelo `autoFocus`. */
  const focarNaBusca = useRef(false)
  const comAlgo = useMemo(() => fichasParaTrazer(fichas, personagem, aba, sistema), [fichas, personagem, aba, sistema])
  const visiveis = useMemo(() => comAlgo.filter((ficha) => fichaCasaComBusca(ficha, busca)), [comAlgo, busca])
  // A ficha escolhida é lida da lista de agora: se ela sair da pasta no meio do caminho, a caixa volta à lista.
  const escolhida = escolhidaId === null ? undefined : comAlgo.find((ficha) => ficha.personagem.id === escolhidaId)
  const plural = aba.nome.toLocaleLowerCase('pt-BR')

  useEffect(() => {
    if (escolhida !== undefined) voltarRef.current?.focus()
    else if (focarNaBusca.current) {
      focarNaBusca.current = false
      buscaRef.current?.focus()
    }
  }, [escolhida])

  const voltar = () => {
    focarNaBusca.current = true
    setEscolhidaId(null)
  }
  const abrirFicha = (ficha: FichaParaTrazer) => {
    // Quem buscou "bolha" e abriu o Tree quer a Bolha: ela já vem marcada.
    setMarcados(new Set(ficha.cartoes.filter((item) => cartaoCasaComBusca(item, busca)).map((item) => item.cartao.id)))
    setEscolhidaId(ficha.personagem.id)
  }
  const alternar = (cartaoId: string) =>
    setMarcados((antes) => {
      const depois = new Set(antes)
      if (!depois.delete(cartaoId)) depois.add(cartaoId)
      return depois
    })

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (escolhida !== undefined) voltar()
    else onFechar()
  }

  if (escolhida !== undefined) {
    const escolhidos = escolhida.cartoes.filter((item) => marcados.has(item.cartao.id))
    const todos = escolhidos.length === escolhida.cartoes.length
    const dono = nomeDaFicha(escolhida.personagem)
    return (
      <div className="lb-escolher lb-trazer" role="group" aria-label={`Trazer ${plural} de ${dono}`} onKeyDown={onKeyDown}>
        <div className="lb-escolher__topo lb-trazer__topo">
          <button ref={voltarRef} type="button" className="lb-btn lb-btn--ghost lb-btn--compact lb-trazer__voltar" onClick={voltar}>
            <BackIcon size={14} />
            Fichas
          </button>
          <span className="lb-trazer__de">
            <Retrato personagem={escolhida.personagem} />
            <span className="lb-trazer__de-nome">{dono}</span>
            <span className="lb-trazer__tipo">{TIPO[escolhida.personagem.tipo]}</span>
          </span>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
            Fechar
          </button>
        </div>
        <ul className="lb-escolher__lista lb-trazer__cartoes" aria-label={`${aba.nome} de ${dono}`}>
          {escolhida.cartoes.map((item) => (
            <CartaoParaMarcar
              key={item.cartao.id}
              item={item}
              aba={aba}
              sistema={sistema}
              personagem={personagem}
              marcado={marcados.has(item.cartao.id)}
              jaNaFicha={nomesNaFicha.has(item.cartao.nome.trim().toLocaleLowerCase('pt-BR'))}
              onAlternar={() => alternar(item.cartao.id)}
            />
          ))}
        </ul>
        <p className="lb-trazer__nota">
          O que vier é cópia. Mudar aqui depois não muda a ficha de {dono}.
        </p>
        <div className="lb-trazer__pe">
          {escolhida.cartoes.length > 1 && (
            <button
              type="button"
              className="lb-btn lb-btn--ghost lb-btn--compact"
              onClick={() => setMarcados(todos ? new Set() : new Set(escolhida.cartoes.map((item) => item.cartao.id)))}
            >
              {todos ? 'Desmarcar todas' : 'Marcar todas'}
            </button>
          )}
          {escolhidos.length === 0 && <span className="lb-trazer__falta">Marque o que você quer trazer.</span>}
          <button
            type="button"
            className="lb-btn lb-btn--primary lb-trazer__confirmar"
            disabled={escolhidos.length === 0}
            onClick={() =>
              onTrazer(
                escolhidos.map((item) => copiaDoCartao(item.cartao)),
                dono,
              )
            }
          >
            {escolhidos.length === 0 ? 'Trazer' : `Trazer ${contaDaAba(aba, escolhidos.length)}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="lb-escolher lb-trazer" role="group" aria-label={`Trazer ${plural} de outra ficha`} onKeyDown={onKeyDown}>
      <div className="lb-escolher__topo">
        <input
          ref={buscaRef}
          type="search"
          className="lb-input lb-escolher__filtro"
          aria-label={`Buscar ficha ou ${aba.item.toLocaleLowerCase('pt-BR')}`}
          placeholder={`Buscar ficha ou ${aba.item.toLocaleLowerCase('pt-BR')}…`}
          // Abriu a caixa para achar a ficha: a busca é o primeiro passo.
          autoFocus
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
        />
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
          Fechar
        </button>
      </div>
      {visiveis.length === 0 ? (
        <p className="lb-escolher__aviso" role="status">
          {comAlgo.length === 0 ? `Nenhuma outra ficha desta pasta tem ${plural}.` : `Nenhuma ficha nem ${aba.item.toLocaleLowerCase('pt-BR')} com “${busca.trim()}”.`}
        </p>
      ) : (
        <ul className="lb-escolher__lista" aria-label="Fichas da pasta">
          {visiveis.map((ficha) => {
            // Com busca, os cartões que casaram vêm na frente: é por eles que o mestre reconhece a ficha.
            const nomes = [...ficha.cartoes.filter((item) => cartaoCasaComBusca(item, busca)), ...ficha.cartoes.filter((item) => !cartaoCasaComBusca(item, busca))].map((item) =>
              nomeDoCartao(item.cartao),
            )
            return (
              <li key={ficha.personagem.id}>
                <button type="button" className="lb-escolher__item lb-trazer__ficha" onClick={() => abrirFicha(ficha)}>
                  <Retrato personagem={ficha.personagem} />
                  <span className="lb-trazer__ficha-texto">
                    <span className="lb-escolher__nome">
                      {nomeDaFicha(ficha.personagem)}
                      <span className="lb-trazer__tipo">{TIPO[ficha.personagem.tipo]}</span>
                    </span>
                    <span className="lb-trazer__ficha-nomes">{nomes.join(', ')}</span>
                  </span>
                  <span className="lb-trazer__conta">{contaDaAba(aba, ficha.cartoes.length)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface CartaoParaMarcarProps {
  item: CartaoParaTrazer
  aba: AbaDoSistema
  sistema: SistemaDeRpg
  /** A ficha que recebe: os números do resumo saem dos atributos dela, que é onde a cópia vai valer. */
  personagem: Personagem
  marcado: boolean
  jaNaFicha: boolean
  onAlternar: () => void
}

function CartaoParaMarcar({ item, aba, sistema, personagem, marcado, jaNaFicha, onAlternar }: CartaoParaMarcarProps) {
  const pecas = pecasDoCartao(item.cartao)
  const texto = pecas === null ? resumoEmTexto(aba, item.cartao) : ''
  return (
    <li>
      <label className="lb-trazer__cartao" data-marcado={marcado ? '' : undefined}>
        <input type="checkbox" checked={marcado} onChange={onAlternar} />
        <span className="lb-trazer__cartao-corpo">
          <span className="lb-escolher__nome">
            {nomeDoCartao(item.cartao)}
            {pecas !== null && (
              <span className="lb-mec__etiqueta" data-a-mao={pecasAMao(pecas) > 0 ? '' : undefined}>
                {etiquetaDaMecanica(pecas)}
              </span>
            )}
            {item.dentroDe !== null && <span className="lb-escolher__ja">{origemNaForma(item.dentroDe)}</span>}
            {jaNaFicha && <span className="lb-escolher__ja">{nomeDaFicha(personagem)} já tem uma com este nome</span>}
          </span>
          {pecas !== null ? (
            // As mesmas frases do resumo da ficha, em texto corrido: dentro do rótulo da caixa de marcar só cabe texto.
            <span className="lb-trazer__frases">
              {resumoDaMecanica(pecas, { personagem, sistema }).map((frase, indice) => (
                <span key={indice} className="lb-trazer__frase">
                  {frase}
                </span>
              ))}
            </span>
          ) : (
            texto.length > 0 && <span className="lb-escolher__resumo">{texto}</span>
          )}
        </span>
      </label>
    </li>
  )
}
