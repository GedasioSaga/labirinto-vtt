import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { chaveDoNome, type ContaNaSala } from '../../lib/contasDosJogadores'
import { desligarJogador, jogadoresSemFicha, ligacaoDe, ligarAConta, ligarAoNome, outrasFichasDoNome, type LigacaoDoJogador } from '../../lib/livros/jogadores'
import { lerJogadoresVistos, type JogadorVisto } from '../../lib/livros/jogadoresVistos'
import { NOME_DO_JOGADOR_MAX, novoPersonagem, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useContasStore } from '../../stores/contasStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { escolhasDaFicha, fraseDoVisto, gravarNoMundo, primeiroNome, Retrato, trocarFicha } from './comum'
import { IconeDoMundo } from './icones'

/**
 * Página JOGADORES do mundo do livro (M1, decisão D1): cada ficha de jogador
 * da pasta ligada uma vez ao jogador — pela CONTA (nome + PIN) quando ele tem
 * uma, ou pelo nome com que entra na mesa. Embaixo, quem já entrou e ainda
 * não tem ficha, com "Criar ficha". A regra da ligação é de
 * lib/livros/jogadores.ts; aqui só a tela.
 */

const SEM_JOGADOR = ''
const OUTRO_NOME = '__outro'
const PREFIXO_CONTA = 'conta:'
const PREFIXO_NOME = 'nome:'

function valorDaLigacao(ligacao: LigacaoDoJogador): string {
  if (ligacao.tipo === 'conta') return `${PREFIXO_CONTA}${ligacao.contaId}`
  if (ligacao.tipo === 'nome') return `${PREFIXO_NOME}${ligacao.nome}`
  return SEM_JOGADOR
}

/** Volta a ficha à ligação que ela tinha (o Desfazer). */
function restaurarLigacao(personagem: Personagem, ligacao: LigacaoDoJogador): Personagem {
  if (ligacao.tipo === 'conta') return ligarAConta(personagem, ligacao.contaId)
  if (ligacao.tipo === 'nome') return ligarAoNome(personagem, ligacao.nome)
  return desligarJogador(personagem)
}

/** "nos 4 mapas da pasta", "no mapa da pasta"; sem mapa nenhum, nada (a frase mentiria). */
function fraseDosMapas(mapas: number | null): string {
  if (mapas === null || mapas === 0) return ''
  return mapas === 1 ? ' · no mapa da pasta' : ` · nos ${mapas} mapas da pasta`
}

interface Contexto {
  personagens: readonly Personagem[]
  contas: readonly ContaNaSala[]
  vistos: readonly JogadorVisto[]
  mapas: number | null
  agora: number
}

function contaComONome(contas: readonly ContaNaSala[], nome: string): ContaNaSala | undefined {
  const chave = chaveDoNome(nome)
  return contas.find((conta) => chaveDoNome(conta.nome) === chave)
}

/** Liga a ficha e conta no aviso, com Desfazer. Nome que é de uma conta liga pela conta (D1: o nome sem PIN não herda nada). */
function ligar(personagem: Personagem, valor: string, contas: readonly ContaNaSala[]): void {
  const antes = ligacaoDe(personagem)
  let trocar: (atual: Personagem) => Personagem
  let texto: string
  if (valor === SEM_JOGADOR) {
    trocar = desligarJogador
    texto = `${personagem.nome} ficou sem jogador.`
  } else if (valor.startsWith(PREFIXO_CONTA)) {
    const contaId = valor.slice(PREFIXO_CONTA.length)
    const conta = contas.find((candidata) => candidata.id === contaId)
    trocar = (atual) => ligarAConta(atual, contaId)
    texto = `“${conta?.nome ?? 'A conta'}” agora entra como ${personagem.nome}, pela conta.`
  } else {
    const nome = valor.slice(PREFIXO_NOME.length)
    const conta = contaComONome(contas, nome)
    if (conta !== undefined) {
      trocar = (atual) => ligarAConta(atual, conta.id)
      texto = `“${conta.nome}” tem conta: ${personagem.nome} ficou ligada pela conta, com PIN.`
    } else {
      trocar = (atual) => ligarAoNome(atual, nome)
      texto = `“${nome}” agora entra como ${personagem.nome}.`
    }
  }
  void gravarNoMundo((lista) => trocarFicha(lista, personagem.id, trocar), {
    texto,
    desfazer: (lista) => trocarFicha(lista, personagem.id, (atual) => restaurarLigacao(atual, antes)),
  })
}

function LinhaDoJogador({ personagem, sistema, contexto }: { personagem: Personagem; sistema: SistemaDeRpg; contexto: Contexto }) {
  const seletorId = useId()
  const outroId = useId()
  const erroId = useId()
  const { personagens, contas, vistos, mapas, agora } = contexto
  const ligacao = ligacaoDe(personagem)
  const [digitando, setDigitando] = useState(false)
  const [outro, setOutro] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  /** "(hoje com Bruno)": quem mais está ligado a essa conta ou nome. */
  const comQuem = (outras: readonly Personagem[]): string => (outras.length === 0 ? '' : ` (hoje com ${primeiroNome(outras[0]?.nome ?? '')})`)
  const outrasDaConta = (contaId: string) => personagens.filter((candidato) => candidato.id !== personagem.id && candidato.dono === contaId)

  // Os nomes vistos que não são de conta, com o da ligação atual escrito como a ficha o guarda.
  const atual = ligacao.tipo === 'nome' ? ligacao.nome : null
  const nomes = vistos
    .filter((visto) => contaComONome(contas, visto.nome) === undefined)
    .map((visto) => (atual !== null && chaveDoNome(visto.nome) === chaveDoNome(atual) ? atual : visto.nome))
  if (atual !== null && !nomes.some((nome) => chaveDoNome(nome) === chaveDoNome(atual))) nomes.unshift(atual)

  const contaLigada = ligacao.tipo === 'conta' ? contas.find((conta) => conta.id === ligacao.contaId) : undefined
  const outrasIguais =
    ligacao.tipo === 'conta' ? outrasDaConta(ligacao.contaId) : ligacao.tipo === 'nome' ? outrasFichasDoNome(personagens, ligacao.nome, personagem.id) : []

  let estado: { texto: string; tom: 'ok' | 'falta' }
  if (ligacao.tipo === 'conta') {
    estado =
      contaLigada === undefined
        ? { texto: 'A conta ligada foi apagada: escolha outra, ou um nome.', tom: 'falta' }
        : { texto: `Entra pela conta “${contaLigada.nome}”, com PIN${fraseDosMapas(mapas)}`, tom: 'ok' }
  } else if (ligacao.tipo === 'nome') {
    const visto = vistos.find((candidato) => chaveDoNome(candidato.nome) === chaveDoNome(ligacao.nome))
    const quando = visto === undefined ? 'ainda não entrou na mesa' : fraseDoVisto(visto.vistoEm, agora)
    estado = { texto: `Entra como “${ligacao.nome}” · ${quando}${fraseDosMapas(mapas)}`, tom: 'ok' }
  } else {
    estado = { texto: 'Sem jogador: no mapa, o token fica com o mestre.', tom: 'falta' }
  }

  const ligarOutro = (event: FormEvent) => {
    event.preventDefault()
    const nome = outro.trim()
    if (nome.length === 0) {
      setErro('Escreva o nome com que ele entra na mesa.')
      return
    }
    ligar(personagem, `${PREFIXO_NOME}${nome}`, contas)
    setDigitando(false)
    setOutro('')
    setErro(null)
  }

  const cancelarOutro = () => {
    setDigitando(false)
    setOutro('')
    setErro(null)
  }

  const aoTeclarNoOutro = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Escape') return
    // Esc aqui só desiste do nome: não fecha o mundo.
    event.preventDefault()
    event.stopPropagation()
    cancelarOutro()
  }

  const tipo = escolhasDaFicha(personagem, sistema)

  return (
    <li className="mu-cartao mu-jog">
      <Retrato imagem={personagem.retrato} nome={personagem.nome} />
      <div className="mu-jog__quem">
        <h3 className="mu-jog__nome">{personagem.nome}</h3>
        <p className="mu-jog__tipo">{tipo.length > 0 ? tipo : 'Jogador'}</p>
      </div>
      <div className="mu-jog__liga">
        {digitando ? (
          <form className="mu-jog__outro" onSubmit={ligarOutro} noValidate>
            <label className="lb-sr-only" htmlFor={outroId}>
              Nome com que o jogador de {personagem.nome} entra na mesa
            </label>
            <input
              className="mu-entrada"
              id={outroId}
              value={outro}
              maxLength={NOME_DO_JOGADOR_MAX}
              autoComplete="off"
              placeholder="Nome na mesa"
              autoFocus
              aria-invalid={erro !== null}
              aria-describedby={erro !== null ? erroId : undefined}
              onChange={(event) => {
                setOutro(event.target.value)
                setErro(null)
              }}
              onKeyDown={aoTeclarNoOutro}
            />
            <button type="submit" className="mu-bt mu-bt--p">
              Ligar
            </button>
            <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={cancelarOutro}>
              Cancelar
            </button>
          </form>
        ) : (
          <div className="mu-jog__liga-linha">
            <IconeDoMundo nome="elo" />
            <label className="lb-sr-only" htmlFor={seletorId}>
              Jogador de {personagem.nome}
            </label>
            <select
              className="mu-seletor"
              id={seletorId}
              value={valorDaLigacao(ligacao)}
              onChange={(event) => {
                if (event.target.value === OUTRO_NOME) setDigitando(true)
                else ligar(personagem, event.target.value, contas)
              }}
            >
              <option value={SEM_JOGADOR}>Sem jogador</option>
              {(contas.length > 0 || (ligacao.tipo === 'conta' && contaLigada === undefined)) && (
                <optgroup label="Contas (nome + PIN)">
                  {contas.map((conta) => (
                    <option key={conta.id} value={`${PREFIXO_CONTA}${conta.id}`}>
                      {conta.nome}
                      {comQuem(outrasDaConta(conta.id))}
                    </option>
                  ))}
                  {ligacao.tipo === 'conta' && contaLigada === undefined && <option value={`${PREFIXO_CONTA}${ligacao.contaId}`}>Conta apagada</option>}
                </optgroup>
              )}
              {nomes.length > 0 && (
                <optgroup label="Nomes vistos na mesa">
                  {nomes.map((nome) => (
                    <option key={chaveDoNome(nome)} value={`${PREFIXO_NOME}${nome}`}>
                      {nome}
                      {comQuem(outrasFichasDoNome(personagens, nome, personagem.id))}
                    </option>
                  ))}
                </optgroup>
              )}
              <option value={OUTRO_NOME}>Outro nome…</option>
            </select>
          </div>
        )}
        {erro !== null ? (
          <span className="mu-campo__erro" id={erroId} role="alert">
            {erro}
          </span>
        ) : (
          <span className={`mu-jog__estado mu-jog__estado--${estado.tom}`}>{estado.texto}</span>
        )}
        {outrasIguais.length > 0 && (
          <span className="mu-jog__estado mu-jog__estado--falta">
            {outrasIguais.map((outra) => outra.nome).join(', ')} também {outrasIguais.length === 1 ? 'entra' : 'entram'} assim: o jogador recebe {outrasIguais.length === 1 ? 'as duas fichas' : 'todas'}.
          </span>
        )}
      </div>
      <div className="mu-jog__acoes">
        <button type="button" className="mu-bt mu-bt--p" onClick={() => useMundoDoLivroStore.getState().abrirFicha(personagem.id)}>
          Abrir ficha
        </button>
      </div>
    </li>
  )
}

/** "Criar ficha para kaio": ficha de jogador nova, já ligada (pela conta, se o nome é de uma), aberta para preencher. */
async function criarFichaPara(nome: string, sistema: SistemaDeRpg, contas: readonly ContaNaSala[]): Promise<void> {
  const conta = contaComONome(contas, nome)
  const nova = novoPersonagem(sistema, 'jogador', `Ficha de ${nome}`)
  const ligada = conta === undefined ? ligarAoNome(nova, nome) : ligarAConta(nova, conta.id)
  const gravou = await gravarNoMundo((lista) => [...lista, ligada], {
    texto: conta === undefined ? `Ficha criada e ligada a “${nome}”.` : `Ficha criada e ligada à conta “${conta.nome}”.`,
    desfazer: (lista) => lista.filter((personagem) => personagem.id !== ligada.id),
  })
  if (gravou) useMundoDoLivroStore.getState().abrirFicha(ligada.id, true)
}

export interface PaginaJogadoresProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
  /** Mapas que usam esta pasta; `null` enquanto o índice lê. */
  mapas: number | null
}

export function PaginaJogadores({ personagens, sistema, mapas }: PaginaJogadoresProps) {
  const contasDoApp = useContasStore((state) => state.arquivo.contas)
  const [vistos, setVistos] = useState<readonly JogadorVisto[]>([])
  const [avisoDosVistos, setAvisoDosVistos] = useState<string | null>(null)
  const [agora] = useState(() => Date.now())

  useEffect(() => {
    void useContasStore.getState().carregar()
    let vivo = true
    void lerJogadoresVistos().then(({ vistos: lidos, aviso }) => {
      if (!vivo) return
      setVistos(lidos)
      setAvisoDosVistos(aviso)
    })
    return () => {
      vivo = false
    }
  }, [])

  const contas = useMemo<ContaNaSala[]>(() => contasDoApp.map((conta) => ({ id: conta.id, nome: conta.nome })), [contasDoApp])
  const jogadores = personagens.filter((personagem) => personagem.tipo === 'jogador')
  const semFicha = jogadoresSemFicha(vistos, personagens, contas)
  const contexto: Contexto = { personagens, contas, vistos, mapas, agora }

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">Jogadores</h2>
          <p className="mu-pg-sub">Cada personagem fica ligado ao jogador uma vez. Quando ele entrar em qualquer mapa deste livro, o token dele já vem com a ficha.</p>
        </div>
      </header>
      <ol className="mu-como">
        <li>
          <b>1. Ligue a ficha ao jogador</b>
          <span>Pela conta, quando ele tem uma (nome + PIN); senão, pelo nome com que entra na mesa.</span>
        </li>
        <li>
          <b>2. Ele entra em qualquer mapa</b>
          <span>{mapas === null || mapas === 0 ? 'Todo mapa que usa os personagens desta pasta.' : `Qualquer um dos ${mapas} ${mapas === 1 ? 'mapa' : 'mapas'} desta pasta.`}</span>
        </li>
        <li>
          <b>3. O token já vem com a ficha</b>
          <span>HP, SP, técnicas e armas, prontos para a batalha.</span>
        </li>
      </ol>

      {jogadores.length === 0 ? (
        <div className="mu-vazio">
          <p>Nenhuma ficha de jogador nesta pasta ainda. Quem já entrou na mesa aparece abaixo, com “Criar ficha”.</p>
        </div>
      ) : (
        <ul className="mu-linhas" aria-label="Fichas de jogador">
          {jogadores.map((personagem) => (
            <LinhaDoJogador key={personagem.id} personagem={personagem} sistema={sistema} contexto={contexto} />
          ))}
        </ul>
      )}

      {avisoDosVistos !== null && <p className="mu-pg-nota mu-pg-nota--aviso">{avisoDosVistos}</p>}

      <section className="mu-pg-secao" aria-labelledby="mu-sem-ficha">
        <h3 className="mu-pg-secao__tit" id="mu-sem-ficha">
          Entraram na mesa e não têm ficha {semFicha.length > 0 && <small>{semFicha.length}</small>}
        </h3>
        {semFicha.length === 0 ? (
          <p className="mu-pg-nota">{vistos.length === 0 ? 'Quando alguém entrar na sala, o nome dele aparece aqui.' : 'Todo mundo que já entrou na mesa tem ficha.'}</p>
        ) : (
          <ul className="mu-linhas">
            {semFicha.map((visto) => (
              <li key={chaveDoNome(visto.nome)} className="mu-cartao mu-jog">
                <Retrato imagem={null} nome={visto.nome} />
                <div className="mu-jog__quem">
                  <h3 className="mu-jog__nome">“{visto.nome}”</h3>
                  <p className="mu-jog__tipo">{fraseDoVisto(visto.vistoEm, agora).replace(/^v/, 'V')}</p>
                </div>
                <div className="mu-jog__liga">
                  <span className="mu-jog__estado">Quando entrar, recebe um token sem ficha.</span>
                </div>
                <div className="mu-jog__acoes">
                  <button type="button" className="mu-bt mu-bt--p" onClick={() => void criarFichaPara(visto.nome, sistema, contas)}>
                    <IconeDoMundo nome="mais" />
                    Criar ficha para {visto.nome}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
