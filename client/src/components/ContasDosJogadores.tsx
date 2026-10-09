import { useEffect, useId, useState, type FormEvent } from 'react'
import { NOME_DA_CONTA_MAX, PIN_MAX_DIGITOS, PIN_MIN_DIGITOS, type ContaDeJogador } from '../lib/contasDosJogadores'
import type { Personagem } from '../lib/personagem'
import { personagensAtivos, useAdventureStore } from '../stores/adventureStore'
import { useContasStore } from '../stores/contasStore'
import { CollapsibleSection } from './CollapsibleSection'
import './ContasDosJogadores.css'

export interface ContasDosJogadoresProps {
  contas: readonly ContaDeJogador[]
  soComConta: boolean
  /** Há disco e as contas foram lidas: sem isso, nada se cria nem se muda. */
  podeGravar: boolean
  aviso: string | null
  /** Os personagens em uso (`personagensAtivos`): é entre eles que o mestre escolhe os de cada conta. */
  personagens: readonly Personagem[]
  onCriar: (nome: string, pin: string) => Promise<void>
  onTrocarPin: (contaId: string, pin: string) => Promise<void>
  onApagar: (contaId: string) => Promise<void>
  onEsquecerAparelho: (contaId: string, aparelhoId: string) => Promise<void>
  onSoComConta: (ligado: boolean) => Promise<void>
  /** Dá o personagem à conta (`null` = a nenhuma). Um personagem tem uma conta só. */
  onDarPersonagem: (personagemId: string, contaId: string | null) => void
}

/** O texto do erro que a store lançou (a frase já vem pronta). */
function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Só dígitos, até o teto: o PIN é o que o jogador digita no teclado numérico. */
function soDigitos(texto: string): string {
  return texto.replace(/\D/g, '').slice(0, PIN_MAX_DIGITOS)
}

function quando(ms: number): string {
  return ms === 0 ? 'nunca' : new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

const DICA_DO_PIN = `De ${PIN_MIN_DIGITOS} a ${PIN_MAX_DIGITOS} números.`

/**
 * CONTAS DOS JOGADORES na aba Jogo, logo abaixo de Personagens: o mestre cria
 * a conta (nome + PIN) de cada jogador, troca o PIN, esquece aparelhos, diz
 * quais personagens são de quem e liga o "Só com conta". O PIN só existe
 * enquanto ele digita: a conta guarda o hash (`lib/contasDosJogadores.ts`).
 */
export function ContasDosJogadores(props: ContasDosJogadoresProps) {
  const { contas, soComConta, podeGravar, aviso, onSoComConta } = props
  const [erro, setErro] = useState<string | null>(null)
  const soComContaId = useId()

  const ligar = async (ligado: boolean) => {
    setErro(null)
    try {
      await onSoComConta(ligado)
    } catch (causa) {
      setErro(textoDoErro(causa))
    }
  }

  return (
    <CollapsibleSection id="contas-dos-jogadores" title="Contas dos jogadores" defaultOpen={false} contagem={contas.length} headingLevel={3}>
      <div className="lb-contas">
        {aviso !== null && (
          <p className="lb-field__error" role="alert">
            {aviso}
          </p>
        )}
        <div className="lb-contas__opcao">
          <label className="lb-section__row" htmlFor={soComContaId}>
            <span className="lb-label">Só com conta</span>
            <input
              id={soComContaId}
              type="checkbox"
              checked={soComConta}
              disabled={!podeGravar || contas.length === 0}
              aria-describedby={`${soComContaId}-dica`}
              onChange={(event) => void ligar(event.target.checked)}
            />
          </label>
          <p id={`${soComContaId}-dica`} className="lb-field__hint">
            {contas.length === 0
              ? 'Crie uma conta antes de fechar a sala para quem não tem.'
              : 'Ligado, quem entra só digitando o nome é recusado. Quem já está na sala continua.'}
          </p>
        </div>
        {contas.length === 0 ? (
          <p className="lb-rpg__vazio">Nenhuma conta ainda. Sem conta, o jogador entra só com o nome, como sempre.</p>
        ) : (
          <ul className="lb-contas__lista" aria-label="Contas dos jogadores">
            {contas.map((conta) => (
              <ContaDaLista key={conta.id} conta={conta} {...props} />
            ))}
          </ul>
        )}
        {erro !== null && (
          <p className="lb-field__error" role="alert">
            {erro}
          </p>
        )}
        <NovaConta podeGravar={podeGravar} onCriar={props.onCriar} />
      </div>
    </CollapsibleSection>
  )
}

function NovaConta({ podeGravar, onCriar }: { podeGravar: boolean; onCriar: ContasDosJogadoresProps['onCriar'] }) {
  const [nome, setNome] = useState('')
  const [pin, setPin] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const id = useId()

  const criar = async (event: FormEvent) => {
    event.preventDefault()
    setCriando(true)
    setErro(null)
    try {
      await onCriar(nome, pin)
      setNome('')
      setPin('')
    } catch (causa) {
      setErro(textoDoErro(causa))
    } finally {
      setCriando(false)
    }
  }

  return (
    <form className="lb-contas__nova" onSubmit={(event) => void criar(event)} aria-label="Nova conta">
      <div className="lb-contas__campos">
        <div className="lb-field">
          <label className="lb-label" htmlFor={`${id}-nome`}>
            Nome do jogador
          </label>
          <input id={`${id}-nome`} className="lb-input" value={nome} maxLength={NOME_DA_CONTA_MAX} autoComplete="off" onChange={(event) => setNome(event.target.value)} />
        </div>
        <div className="lb-field lb-contas__pin">
          <label className="lb-label" htmlFor={`${id}-pin`}>
            PIN
          </label>
          <input
            id={`${id}-pin`}
            className="lb-input"
            value={pin}
            inputMode="numeric"
            autoComplete="off"
            aria-describedby={`${id}-dica`}
            onChange={(event) => setPin(soDigitos(event.target.value))}
          />
        </div>
      </div>
      <p id={`${id}-dica`} className="lb-field__hint">
        {DICA_DO_PIN} Diga o nome e o PIN ao jogador: ele digita os dois só na primeira vez em cada aparelho.
      </p>
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
      <div className="lb-cenas__acoes">
        <button type="submit" className="lb-btn" disabled={!podeGravar || criando || nome.trim() === '' || pin.length < PIN_MIN_DIGITOS}>
          {criando ? 'Criando…' : '+ Conta'}
        </button>
      </div>
    </form>
  )
}

interface ContaDaListaProps extends ContasDosJogadoresProps {
  conta: ContaDeJogador
}

function ContaDaLista({ conta, contas, podeGravar, personagens, onApagar, onEsquecerAparelho, onDarPersonagem, onTrocarPin }: ContaDaListaProps) {
  const [aberta, setAberta] = useState(false)
  const [apagando, setApagando] = useState(false)
  const [trocandoPin, setTrocandoPin] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const detalhesId = useId()
  const daConta = personagens.filter((personagem) => personagem.dono === conta.id).length

  const tentar = async (acao: () => Promise<void>) => {
    setErro(null)
    try {
      await acao()
    } catch (causa) {
      setErro(textoDoErro(causa))
    }
  }

  return (
    <li className="lb-contas__conta">
      <div className="lb-rpg__linha">
        <button type="button" className="lb-rpg__abrir" aria-expanded={aberta} aria-controls={detalhesId} onClick={() => setAberta((antes) => !antes)}>
          <span className="lb-rpg__nome">{conta.nome}</span>
          <span className="lb-contas__resumo">
            {daConta} {daConta === 1 ? 'personagem' : 'personagens'} · {conta.aparelhos.length} {conta.aparelhos.length === 1 ? 'aparelho' : 'aparelhos'}
          </span>
        </button>
        {apagando ? (
          <span className="lb-rpg__confirma">
            <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" disabled={!podeGravar} onClick={() => void tentar(() => onApagar(conta.id))}>
              Apagar
            </button>
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setApagando(false)}>
              Manter
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="lb-btn lb-btn--ghost lb-btn--compact lb-rpg__remover"
            aria-label={`Apagar a conta de ${conta.nome}`}
            title="Apagar conta"
            disabled={!podeGravar}
            onClick={() => setApagando(true)}
          >
            ×
          </button>
        )}
      </div>
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
      {aberta && (
        <div id={detalhesId} className="lb-contas__detalhes">
          <PersonagensDaConta conta={conta} contas={contas} personagens={personagens} onDarPersonagem={onDarPersonagem} />
          <AparelhosDaConta conta={conta} podeGravar={podeGravar} onEsquecer={(aparelhoId) => void tentar(() => onEsquecerAparelho(conta.id, aparelhoId))} />
          {trocandoPin ? (
            <TrocarPin nome={conta.nome} onTrocar={(pin) => onTrocarPin(conta.id, pin)} onFechar={() => setTrocandoPin(false)} />
          ) : (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" disabled={!podeGravar} onClick={() => setTrocandoPin(true)}>
              Trocar PIN
            </button>
          )}
        </div>
      )}
    </li>
  )
}

interface PersonagensDaContaProps {
  conta: ContaDeJogador
  contas: readonly ContaDeJogador[]
  personagens: readonly Personagem[]
  onDarPersonagem: ContasDosJogadoresProps['onDarPersonagem']
}

function PersonagensDaConta({ conta, contas, personagens, onDarPersonagem }: PersonagensDaContaProps) {
  const nomeDaConta = (contaId: string | undefined): string | null => contas.find((outra) => outra.id === contaId)?.nome ?? null
  return (
    <fieldset className="lb-contas__grupo">
      <legend className="lb-label">Personagens de {conta.nome}</legend>
      {personagens.length === 0 ? (
        <p className="lb-field__hint">Nenhum personagem nesta aventura. Crie em Personagens, acima.</p>
      ) : (
        personagens.map((personagem) => {
          const deOutra = personagem.dono !== conta.id ? nomeDaConta(personagem.dono) : null
          return (
            <label key={personagem.id} className="lb-contas__marca">
              <input type="checkbox" checked={personagem.dono === conta.id} onChange={(event) => onDarPersonagem(personagem.id, event.target.checked ? conta.id : null)} />
              <span className="lb-rpg__nome">{personagem.nome}</span>
              {deOutra !== null && <span className="lb-contas__resumo">de {deOutra}</span>}
            </label>
          )
        })
      )}
      <p className="lb-field__hint">Ao entrar com a conta, o jogador recebe as fichas ligadas a estes personagens — as que ninguém está usando.</p>
    </fieldset>
  )
}

function AparelhosDaConta({ conta, podeGravar, onEsquecer }: { conta: ContaDeJogador; podeGravar: boolean; onEsquecer: (aparelhoId: string) => void }) {
  return (
    <div className="lb-contas__grupo">
      <p className="lb-label">Aparelhos lembrados</p>
      {conta.aparelhos.length === 0 ? (
        <p className="lb-field__hint">Nenhum: o próximo entra com nome e PIN.</p>
      ) : (
        <ul className="lb-contas__aparelhos">
          {conta.aparelhos.map((aparelho) => (
            <li key={aparelho.id} className="lb-rpg__linha">
              <span className="lb-rpg__nome">{aparelho.rotulo}</span>
              <span className="lb-contas__resumo">visto {quando(aparelho.vistoEm)}</span>
              <button
                type="button"
                className="lb-btn lb-btn--ghost lb-btn--compact"
                aria-label={`Esquecer ${aparelho.rotulo} de ${conta.nome}`}
                disabled={!podeGravar}
                onClick={() => onEsquecer(aparelho.id)}
              >
                Esquecer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TrocarPin({ nome, onTrocar, onFechar }: { nome: string; onTrocar: (pin: string) => Promise<void>; onFechar: () => void }) {
  const [pin, setPin] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const id = useId()

  const salvar = async (event: FormEvent) => {
    event.preventDefault()
    setSalvando(true)
    setErro(null)
    try {
      await onTrocar(pin)
      onFechar()
    } catch (causa) {
      setErro(textoDoErro(causa))
      setSalvando(false)
    }
  }

  return (
    <form className="lb-contas__grupo" onSubmit={(event) => void salvar(event)} aria-label={`Trocar o PIN de ${nome}`}>
      <div className="lb-field lb-contas__pin">
        <label className="lb-label" htmlFor={`${id}-pin`}>
          PIN novo de {nome}
        </label>
        <input
          id={`${id}-pin`}
          className="lb-input"
          value={pin}
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          aria-describedby={`${id}-dica`}
          onChange={(event) => setPin(soDigitos(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onFechar()
          }}
        />
      </div>
      <p id={`${id}-dica`} className="lb-field__hint">
        {DICA_DO_PIN} Os aparelhos lembrados continuam entrando.
      </p>
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
      <div className="lb-cenas__acoes">
        <button type="submit" className="lb-btn lb-btn--compact" disabled={salvando || pin.length < PIN_MIN_DIGITOS}>
          {salvando ? 'Salvando…' : 'Salvar PIN'}
        </button>
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** O personagem sem conta: a chave sai (não fica `dono: undefined` no arquivo). */
function semDono(personagem: Personagem): Personagem {
  const copia = { ...personagem }
  delete copia.dono
  return copia
}

/** A seção ligada às stores: as contas do app e os personagens em uso (os da pasta ou os da aventura). */
export function ContasDosJogadoresDoApp() {
  const arquivo = useContasStore((state) => state.arquivo)
  const aviso = useContasStore((state) => state.aviso)
  const podeGravar = useContasStore((state) => state.podeGravar)
  const personagens = useAdventureStore(personagensAtivos)

  useEffect(() => {
    void useContasStore.getState().carregar()
  }, [])

  const contas = useContasStore.getState
  return (
    <ContasDosJogadores
      contas={arquivo.contas}
      soComConta={arquivo.soComConta}
      podeGravar={podeGravar}
      aviso={aviso}
      personagens={personagens}
      onCriar={(nome, pin) => contas().criarConta(nome, pin)}
      onTrocarPin={(contaId, pin) => contas().trocarPin(contaId, pin)}
      onApagar={(contaId) => contas().apagarConta(contaId)}
      onEsquecerAparelho={(contaId, aparelhoId) => contas().esquecerAparelho(contaId, aparelhoId)}
      onSoComConta={(ligado) => contas().definirSoComConta(ligado)}
      onDarPersonagem={(personagemId, contaId) => {
        useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => (contaId === null ? semDono(atual) : { ...atual, dono: contaId }))
      }}
    />
  )
}
