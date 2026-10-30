import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { maximoComposto, temMaximo } from '../../lib/ajusteDaFicha'
import { CAMPO_DO_DANO, lerDano, type ContextoDaFormula } from '../../lib/batalha/formula'
import { armasDe, tecnicasDe } from '../../lib/batalha/leituraDaFicha'
import { ATALHOS_DA_FORCA, ehVariacao, entraNaBatalha, semForca, soltarDoModelo, trocarForca, variacoesDe } from '../../lib/livros/combate'
import { FORCA_MAX, FORCA_MIN, FORCA_PADRAO, FORCA_PASSO, forcaDe, forcaNoPasso, RECURSO_QUE_A_FORCA_MULTIPLICA, type Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { escolhasDaFicha, formatarForca, formatarNumero, forcaMexida, gravarNoMundo, primeiroNome, Retrato, semCenario, trocarFicha } from './comum'
import { IconeDoMundo } from './icones'
import { NovoNpcDialog, type ModoDoNovoNpc } from './NovoNpcDialog'

/**
 * Página NPCS DE COMBATE do mundo do livro (M1): o bestiário. À esquerda,
 * modelos com as variações embaixo e o bloco "Só no cenário"; à direita, o
 * detalhe do NPC escolhido com a FORÇA (x0,5 a x2, só HP e dano, decisão 3):
 * o deslizante mostra o número novo na hora e o de antes riscado, pelos MESMOS
 * funis da ficha e da batalha (`maximoComposto`, `lerDano`). Quem decide as
 * regras é lib/livros/combate.ts; aqui só a tela.
 */

/** O deslizante grava quando a mão para: cada passo do arrasto não vira uma gravação no disco. */
const GRAVA_A_FORCA_DEPOIS_MS = 350

/** A força que o deslizante mostra antes de gravar, por NPC. */
interface ForcaAoVivo {
  personagemId: string
  forca: number
}

interface Efeito {
  chave: string
  rotulo: string
  /** O texto do campo Dano (o "title" do rótulo), ou nada para o HP. */
  formula?: string
  /** Com força 1 (o riscado). */
  base: number
  final: number
}

/** O dano do cartão pelos funis da batalha; sem arma escolhida, a primeira da ficha (a que a fórmula pede). */
function danoDoCartao(texto: string, personagem: Personagem, sistema: SistemaDeRpg): number | null {
  const ctx: ContextoDaFormula = { personagem, sistema, arma: null, vidaDoAlvo: null }
  const lido = lerDano(texto, ctx)
  if (lido.tipo === 'valor') return lido.valor
  const arma = armasDe(personagem)[0]
  if (lido.tipo !== 'precisaArma' || arma === undefined) return null
  const comArma = lerDano(texto, { ...ctx, arma })
  return comArma.tipo === 'valor' ? comArma.valor : null
}

/** O HP máximo e o dano de cada golpe que a força mexe: o de agora e o com força 1. */
function efeitosDaForca(personagem: Personagem, sistema: SistemaDeRpg): Efeito[] {
  const base = semForca(personagem)
  const efeitos: Efeito[] = []
  if (temMaximo(sistema, RECURSO_QUE_A_FORCA_MULTIPLICA)) {
    efeitos.push({
      chave: 'hp',
      rotulo: 'HP máximo',
      base: maximoComposto(base, RECURSO_QUE_A_FORCA_MULTIPLICA).total,
      final: maximoComposto(personagem, RECURSO_QUE_A_FORCA_MULTIPLICA).total,
    })
  }
  for (const cartao of tecnicasDe(personagem, sistema)) {
    const texto = (cartao.campos[CAMPO_DO_DANO] ?? '').trim()
    if (texto.length === 0) continue
    const final = danoDoCartao(texto, personagem, sistema)
    const antes = danoDoCartao(texto, base, sistema)
    if (final === null || antes === null) continue
    efeitos.push({ chave: cartao.id, rotulo: cartao.nome, formula: texto, base: antes, final })
  }
  return efeitos
}

function NumeroComForca({ efeito }: { efeito: Efeito }) {
  if (efeito.base === efeito.final) return <span className="mu-efeito__num">{formatarNumero(efeito.final)}</span>
  return (
    <span className="mu-efeito__num">
      <s aria-label={`antes ${formatarNumero(efeito.base)}`}>{formatarNumero(efeito.base)}</s>
      <span className={efeito.final > efeito.base ? 'mu-efeito__num--sobe' : 'mu-efeito__num--desce'}>{formatarNumero(efeito.final)}</span>
    </span>
  )
}

/** "Modelo · 2 variações", "Variação", "NPC único". */
function papelDoNpc(personagem: Personagem, deCombate: readonly Personagem[]): string {
  if (ehVariacao(personagem)) return 'Variação'
  const n = variacoesDe(personagem.id, deCombate).length
  return n === 0 ? 'NPC único' : `Modelo · ${n} ${n === 1 ? 'variação' : 'variações'}`
}

const daBatalha = (personagem: Personagem): boolean => personagem.combate?.criadoNaBatalha === true

interface ItemDaListaProps {
  personagem: Personagem
  deCombate: readonly Personagem[]
  escolhido: boolean
  variacao: boolean
  forca: number
}

function ItemDaLista({ personagem, deCombate, escolhido, variacao, forca }: ItemDaListaProps) {
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
        <span className={forcaMexida(forca) ? 'mu-bes-item__forca mu-bes-item__forca--mexida' : 'mu-bes-item__forca'} aria-label={`Força ${formatarForca(forca)}`}>
          {formatarForca(forca)}
        </span>
      </button>
    </li>
  )
}

interface DetalheProps {
  personagem: Personagem
  personagens: readonly Personagem[]
  deCombate: readonly Personagem[]
  sistema: SistemaDeRpg
  /** A força do deslizante antes de gravar; `null` = a gravada. */
  aoVivo: number | null
  onForca: (forca: number, agora: boolean) => void
  onNovoNpc: (modo: ModoDoNovoNpc) => void
}

function DetalheDoNpc({ personagem, personagens, deCombate, sistema, aoVivo, onForca, onNovoNpc }: DetalheProps) {
  const mostrado = aoVivo === null ? personagem : trocarForca(personagem, aoVivo)
  const forca = forcaDe(mostrado)
  const pct = ((forca - FORCA_MIN) / (FORCA_MAX - FORCA_MIN)) * 100
  const efeitos = efeitosDaForca(mostrado, sistema)
  const modeloId = personagem.combate?.modeloId
  const modelo = modeloId === undefined ? undefined : personagens.find((candidato) => candidato.id === modeloId)
  const variacoes = variacoesDe(personagem.id, deCombate)
  const escolhas = escolhasDaFicha(personagem, sistema)
  const sliderId = `mu-forca-${personagem.id}`
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
  if (modeloId !== undefined) de = `Variação de ${modelo?.nome ?? 'um modelo'}: técnicas, armas e atributos vêm do modelo.`
  else if (variacoes.length > 0) de = `Modelo com ${variacoes.length} ${variacoes.length === 1 ? 'variação' : 'variações'}. Mudar a ficha do modelo muda todas.`
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
            {escolhas}
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

      <div className="mu-bes-bloco">
        <h4 className="mu-bes-bloco__tit">
          <label htmlFor={sliderId}>Força do NPC</label>
        </h4>
        <p className="mu-bes-bloco__sub">
          Multiplica o HP e o dano das técnicas, de ×0,5 a ×2. Para balancear no meio da campanha sem reescrever a ficha. Os jogadores nunca veem esse número.
        </p>
        <div className="mu-forca">
          <input
            type="range"
            className="mu-deslizante"
            id={sliderId}
            min={FORCA_MIN}
            max={FORCA_MAX}
            step={FORCA_PASSO}
            value={forca}
            style={{ '--pct': `${pct}%` } as CSSProperties}
            aria-valuetext={formatarForca(forca)}
            onChange={(event) => onForca(forcaNoPasso(Number(event.target.value)), false)}
          />
          <output className="mu-forca__valor" htmlFor={sliderId}>
            {formatarForca(forca)}
          </output>
          <div className="mu-forca__marcas" aria-hidden="true">
            <span>×0,5</span>
            <span>×1</span>
            <span>×1,5</span>
            <span>×2</span>
          </div>
        </div>
        <div className="mu-predef" role="group" aria-label="Atalhos da força">
          {ATALHOS_DA_FORCA.map((valor) => (
            <button key={valor} type="button" className="mu-chip mu-chip--sem-ret" aria-pressed={valor === forca} onClick={() => onForca(valor, true)}>
              {formatarForca(valor)}
            </button>
          ))}
        </div>
        {efeitos.length === 0 ? (
          <p className="mu-efeito__nada">A ficha não tem HP nem golpe com dano que o app leia: a força não muda nada nela ainda.</p>
        ) : (
          <div className="mu-efeito" aria-live="polite">
            {efeitos.map((efeito) => (
              <div key={efeito.chave} className="mu-efeito__item">
                <span className="mu-efeito__rot" title={efeito.formula}>
                  {efeito.rotulo}
                </span>
                <NumeroComForca efeito={efeito} />
              </div>
            ))}
          </div>
        )}
      </div>

      {modeloId === undefined && (
        <div className="mu-bes-bloco">
          <h4 className="mu-bes-bloco__tit">Variações</h4>
          <p className="mu-bes-bloco__sub">Mesma ficha, outro nome e outra força. Bom para “3 recrutas”, cada um um pouco diferente.</p>
          <div className="mu-pg-acoes">
            {variacoes.map((variacao) => (
              <button key={variacao.id} type="button" className="mu-chip" onClick={() => useMundoDoLivroStore.getState().escolherNpc(variacao.id)}>
                <Retrato imagem={variacao.retrato} nome={variacao.nome} tamanho="p" />
                {variacao.nome} · {formatarForca(forcaDe(variacao))}
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
    </section>
  )
}

export interface PaginaNpcsProps {
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg
}

export function PaginaNpcs({ personagens, sistema }: PaginaNpcsProps) {
  const escolhidoId = useMundoDoLivroStore((state) => state.npcEscolhido)
  const [aoVivo, setAoVivo] = useState<ForcaAoVivo | null>(null)
  const [dialogo, setDialogo] = useState<ModoDoNovoNpc | null>(null)
  const pendente = useRef<{ forca: ForcaAoVivo; relogio: number } | null>(null)

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

  /** Grava a força que o deslizante deixou (a pendente), se ainda há uma. */
  const gravarPendente = () => {
    const agora = pendente.current
    if (agora === null) return
    window.clearTimeout(agora.relogio)
    pendente.current = null
    const { personagemId, forca } = agora.forca
    void gravarNoMundo((lista) => trocarFicha(lista, personagemId, (atual) => trocarForca(atual, forca))).then(() => {
      setAoVivo((atual) => (atual !== null && atual.personagemId === personagemId && atual.forca === forca ? null : atual))
    })
  }

  // Trocou de NPC ou saiu da página com o deslizante no meio: a força deixada grava agora, sem esperar.
  useEffect(() => gravarPendente, [escolhido?.id])

  const mudarForca = (personagemId: string, forca: number, agora: boolean) => {
    const nova: ForcaAoVivo = { personagemId, forca }
    setAoVivo(nova)
    if (pendente.current !== null) window.clearTimeout(pendente.current.relogio)
    pendente.current = { forca: nova, relogio: window.setTimeout(gravarPendente, agora ? 0 : GRAVA_A_FORCA_DEPOIS_MS) }
  }

  const forcaNaLista = (personagem: Personagem): number => (aoVivo !== null && aoVivo.personagemId === personagem.id ? aoVivo.forca : forcaDe(personagem))

  return (
    <div className="mu-pg">
      <header className="mu-pg-cab">
        <div className="mu-pg-cab__txt">
          <h2 className="mu-pg-titulo">NPCs de combate</h2>
          <p className="mu-pg-sub">Só quem tem ficha de batalha entra na ordem dos turnos. Crie a partir de um modelo e ajuste a força para balancear sem mexer na ficha.</p>
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
              <span aria-hidden="true">Força</span>
            </h3>
            {ordem.length === 0 ? (
              <p className="mu-pg-nota" style={{ padding: '4px 8px 8px' }}>
                Nenhum NPC de combate.
              </p>
            ) : (
              <ul>
                {ordem.map(({ personagem, variacao }) => (
                  <ItemDaLista
                    key={personagem.id}
                    personagem={personagem}
                    deCombate={deCombate}
                    escolhido={escolhido?.id === personagem.id}
                    variacao={variacao}
                    forca={forcaNaLista(personagem)}
                  />
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
                      <span className="mu-bes-item__sub">{escolhasDaFicha(personagem, sistema) || 'NPC'}</span>
                    </span>
                    <button type="button" className="mu-bt mu-bt--p" aria-label={`Dar ficha de batalha a ${personagem.nome}`} onClick={() => setDialogo({ tipo: 'darFicha', personagem })}>
                      Dar ficha
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {escolhido === undefined ? (
          <div className="mu-vazio">
            <p>Nenhum NPC de combate ainda. Crie o primeiro: com a ficha mínima, em branco ou a partir de um modelo.</p>
            <button type="button" className="mu-bt mu-bt--p" onClick={() => setDialogo({ tipo: 'novo' })}>
              <IconeDoMundo nome="mais" />
              Novo NPC
            </button>
          </div>
        ) : (
          <DetalheDoNpc
            key={escolhido.id}
            personagem={escolhido}
            personagens={personagens}
            deCombate={deCombate}
            sistema={sistema}
            aoVivo={aoVivo !== null && aoVivo.personagemId === escolhido.id ? aoVivo.forca : null}
            onForca={(forca, agora) => mudarForca(escolhido.id, forca, agora)}
            onNovoNpc={setDialogo}
          />
        )}
      </div>

      {dialogo !== null && (
        <NovoNpcDialog
          modo={dialogo}
          sistema={sistema}
          personagens={personagens}
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
