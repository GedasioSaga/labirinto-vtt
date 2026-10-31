import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { DESCRICAO_DO_NPC_MAX, NIVEIS_DO_NPC, nomeJaUsado, type NivelDoNpc } from '../../lib/ia/gerarNpc'
import { colunaDaComparacao } from '../../lib/livros/encontro'
import { CAMPOS_DA_SAUDE, lerSaude } from '../../lib/livros/saude'
import { camposVisiveis, cartoesDaAba, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { PERSONAGEM_NOME_MAX } from '../../net/protocoloDoPersonagem'
import { useIaStore } from '../../stores/iaStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { escolhasDaFicha, formatarNumero, gravarNoMundo, Retrato } from '../livros/comum'
import { IconeDaIa } from './icones'

/**
 * GERAR NPC na conversa do assistente (M4, porte do protótipo): o formulário
 * ("Como é o NPC?" + força perto do grupo) e, quando a IA responde, a ficha
 * para revisar — nome editável, atributos, HP/SP/Escudo e as técnicas com o
 * dano que o app lê — e "Salvar no bestiário" pelo funil único do mundo
 * (`gravarNoMundo`), com Desfazer.
 */

export interface GerarNpcFormProps {
  onGerar: (descricao: string, nivel: NivelDoNpc) => void
  onCancelar: () => void
}

export function GerarNpcForm({ onGerar, onCancelar }: GerarNpcFormProps) {
  const [descricao, setDescricao] = useState('')
  const [nivel, setNivel] = useState<NivelDoNpc>('nivel')
  const [erro, setErro] = useState<string | null>(null)
  const descricaoRef = useRef<HTMLTextAreaElement>(null)
  const id = useId()

  useEffect(() => {
    descricaoRef.current?.focus()
  }, [])

  const enviar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (descricao.trim().length === 0) {
      setErro('Descreva o NPC em uma frase.')
      descricaoRef.current?.focus()
      return
    }
    onGerar(descricao, nivel)
  }

  return (
    <form
      className="ia-gerar"
      onSubmit={enviar}
      noValidate
      aria-labelledby={`${id}-tit`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancelar()
        }
      }}
    >
      <h3 className="ia-gerar__tit" id={`${id}-tit`}>
        Gerar NPC
      </h3>
      <div className="mu-campo">
        <label htmlFor={`${id}-desc`}>Como é o NPC?</label>
        <textarea
          ref={descricaoRef}
          className="mu-entrada ia-area"
          id={`${id}-desc`}
          rows={3}
          value={descricao}
          maxLength={DESCRICAO_DO_NPC_MAX}
          onChange={(event) => {
            setDescricao(event.target.value)
            setErro(null)
          }}
          placeholder="Ex.: tenente da Marinha que luta com correntes"
          aria-invalid={erro === null ? undefined : true}
          aria-describedby={erro === null ? undefined : `${id}-erro`}
        />
        {erro !== null && (
          <span className="mu-campo__erro" id={`${id}-erro`}>
            {erro}
          </span>
        )}
      </div>
      <div className="mu-campo">
        <label htmlFor={`${id}-nivel`}>Força perto do grupo</label>
        <select className="mu-seletor" id={`${id}-nivel`} value={nivel} onChange={(event) => setNivel(NIVEIS_DO_NPC.find((opcao) => opcao.valor === event.target.value)?.valor ?? 'nivel')}>
          {NIVEIS_DO_NPC.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.rotulo}
            </option>
          ))}
        </select>
        <span className="mu-campo__dica">O grupo é o de Comparar; sem grupo lá, os jogadores da campanha.</span>
      </div>
      <div className="mu-pg-acoes">
        <button type="submit" className="mu-bt mu-bt--p mu-bt--primario">
          <IconeDaIa nome="ia" />
          Gerar ficha
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

export interface NpcGeradoProps {
  npc: Personagem
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
  /** "Gerar outro": abre o formulário de novo. */
  onGerarOutro: () => void
}

/** "O app lê 7 de 8 campos": Lido e Lê na hora contam como lidos; À mão fica fora da conta. */
function contagemDaLeitura(npc: Personagem, sistema: SistemaDeRpg): { lidos: number; total: number } {
  const { contagem } = lerSaude([npc], sistema)
  let lidos = 0
  let total = 0
  for (const campo of CAMPOS_DA_SAUDE) {
    const c = contagem[campo]
    lidos += c.lido + c.naHora
    total += c.lido + c.naHora + c.naoLe
  }
  return { lidos, total }
}

export function NpcGerado({ npc, sistema, personagens, onGerarOutro }: NpcGeradoProps) {
  const [nome, setNome] = useState(npc.nome)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const nomeRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const coluna = useMemo(() => colunaDaComparacao(npc, sistema), [npc, sistema])
  const leitura = useMemo(() => contagemDaLeitura(npc, sistema), [npc, sistema])
  const danoPorCartao = useMemo(() => new Map(coluna.golpes.flatMap((golpe) => (golpe.cartao === null || golpe.valor === null ? [] : [[golpe.cartao.id, golpe.valor] as const]))), [coluna]) // as const: tupla [id, dano] para o Map, não é cast
  const abasComCartoes = sistema.abas.filter((aba) => cartoesDaAba(npc, aba.id).length > 0)
  const escolhas = escolhasDaFicha(npc, sistema)

  // A ficha chegou: o foco vai para o nome, o primeiro campo da revisão.
  useEffect(() => {
    nomeRef.current?.focus()
  }, [npc.id])

  const salvar = async () => {
    const escolhido = nome.trim() || npc.nome
    if (nomeJaUsado(escolhido, personagens)) {
      setErro(`Já existe “${escolhido}” na campanha. Troque o nome antes de salvar.`)
      nomeRef.current?.focus()
      return
    }
    const ficha: Personagem = { ...npc, nome: escolhido }
    setSalvando(true)
    const gravou = await gravarNoMundo((lista) => [...lista, ficha], {
      texto: `${escolhido} foi salvo no bestiário.`,
      desfazer: (lista) => lista.filter((personagem) => personagem.id !== ficha.id),
    })
    setSalvando(false)
    if (!gravou) return
    // A página NPCs de combate abre já nele.
    useMundoDoLivroStore.getState().escolherNpc(ficha.id)
    useIaStore.getState().descartarGerado()
  }

  const titulo = nome.trim() || npc.nome
  return (
    <section className="ia-npc" aria-labelledby={`${id}-nome`}>
      <div className="ia-npc__cab">
        <Retrato imagem={null} nome={titulo} />
        <div>
          <h3 className="ia-npc__nome" id={`${id}-nome`}>
            {titulo}
          </h3>
          <p className="ia-npc__sub">{[escolhas, 'NPC único'].filter((parte) => parte.length > 0).join(' · ')}</p>
        </div>
      </div>
      {npc.descricao.length > 0 && <p className="ia-npc__desc">{npc.descricao}</p>}
      <div className="mu-campo">
        <label htmlFor={`${id}-nomear`}>Nome</label>
        <input
          ref={nomeRef}
          className="mu-entrada"
          id={`${id}-nomear`}
          value={nome}
          maxLength={PERSONAGEM_NOME_MAX}
          autoComplete="off"
          onChange={(event) => {
            setNome(event.target.value)
            setErro(null)
          }}
          aria-invalid={erro === null ? undefined : true}
          aria-describedby={erro === null ? undefined : `${id}-erro`}
        />
        {erro !== null && (
          <span className="mu-campo__erro" id={`${id}-erro`} role="alert">
            {erro}
          </span>
        )}
      </div>
      <div className="ia-atrs">
        {coluna.atributos.map((atributo) => (
          <div className="ia-atr" key={atributo.id} title={atributo.nome}>
            <span className="ia-atr__ab">{atributo.abreviacao}</span>
            <span className="ia-atr__val">
              {formatarNumero(atributo.valor)}
              {atributo.rank !== null && <span className="ia-atr__rank">{atributo.rank}</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="mu-pg-nota">
        {coluna.hp !== null && (
          <>
            HP <b>{formatarNumero(coluna.hp.maximo)}</b>
          </>
        )}
        {coluna.sp !== null && (
          <>
            {' · '}SP <b>{formatarNumero(coluna.sp.maximo)}</b>
          </>
        )}
        {coluna.escudo !== null && (
          <>
            {' · '}Escudo <b>{formatarNumero(coluna.escudo)}</b>
          </>
        )}
      </p>
      {abasComCartoes.map((aba) => (
        <div key={aba.id} className="ia-npc__aba">
          <h4 className="ia-npc__aba-tit">{aba.nome}</h4>
          <ul className="ia-npc__tec">
            {cartoesDaAba(npc, aba.id).map((cartao) => {
              const campos = camposVisiveis(aba, cartao, 'linha')
              const dano = danoPorCartao.get(cartao.id)
              return (
                <li key={cartao.id}>
                  <b>{cartao.nome}</b>
                  {campos.length > 0 && (
                    <span>
                      {campos.map((campo) => `${campo.rotulo}: ${campo.valor}`).join(' · ')}
                      {dano !== undefined && ` (= ${formatarNumero(dano)} de dano)`}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {leitura.total > 0 && (
        <p className={leitura.lidos === leitura.total ? 'mu-pg-nota' : 'mu-pg-nota mu-pg-nota--aviso'}>
          O app lê {leitura.lidos} de {leitura.total} campos de batalha desta ficha{leitura.lidos === leitura.total ? '.' : ': o resto aparece na Saúde da ficha depois de salvar.'}
        </p>
      )}
      <div className="ia-npc__acoes">
        <button type="button" className="mu-bt mu-bt--p mu-bt--primario" onClick={() => void salvar()} disabled={salvando} aria-busy={salvando || undefined}>
          Salvar no bestiário
        </button>
        <button type="button" className="mu-bt mu-bt--p" onClick={onGerarOutro} disabled={salvando}>
          Gerar outro
        </button>
        <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={() => useIaStore.getState().descartarGerado()} disabled={salvando}>
          Descartar
        </button>
      </div>
    </section>
  )
}
