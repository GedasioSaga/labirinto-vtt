import { useState } from 'react'
import { DANO_MAX } from '../../../../lib/batalha/combate'
import { frasesDoAcumulador } from '../../../../lib/batalha/requisitos/frases'
import { mesmaMarca } from '../../../../lib/batalha/requisitos/ler'
import {
  ATRIBUTOS_DO_MARCO_MAX,
  NIVEL_DO_ACUMULADOR_MAX,
  NOME_DO_ACUMULADOR_MAX,
  PASSO_DO_ACUMULADOR_MAX,
  RECURSO_DO_REQUISITO_MAX,
  REGRAS_DO_ACUMULADOR_MAX,
  VERSAO_DO_ACUMULADOR,
  type AcumuladorDaFicha,
  type AtributoDoMarco,
  type DescidaDoAcumulador,
  type GanhoDoAcumulador,
  type MarcoDoAcumulador,
  type QuandoSobe,
  type Referencia,
  type SubidaDoAcumulador,
} from '../../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha } from '../../../../lib/personagem'
import { acumuladoresNaFicha, ganhoNoNivel, idParaOAcumulador } from '../../acumulador/acumuladoresDaFicha'
import { Caixa, Campo, Escolher, Frase, Nota, Numero, PorDaLista, Segmentos, Texto, TextoCurto, Tirar } from './controlesDaPeca'
import { comATecnicaNoNivel, comOGastoNoNivel, gastoQuePede, nivelQuePede, referenciaDoCartao, tecnicasDaFicha, type GastoNoMarco } from './ligacoes'
import type { ArredoresDaPeca, PropsDoAcumulador } from './registro'
import { ATRIBUTOS_DAS_PECAS, semOItem, trocado, type OpcaoDaPeca } from './vocabulario'

/** O acumulador de partida (o `pecaNova('acumulador')` do protótipo: Fúria até 5, sobe ao acertar, +5 de dano por nível). */
const NOME_DE_PARTIDA = 'Fúria'
const MAXIMO_DE_PARTIDA = 5
const DANO_POR_NIVEL_DE_PARTIDA = 5
const ATRIBUTO_POR_NIVEL_DE_PARTIDA = 5
/** O "a cada N SP" da regra nova (o editor do acumulador começa em 20). */
const SP_DE_PARTIDA = 20

/** Os jeitos de subir (os mesmos do editor do acumulador, `COMO_SOBE` do protótipo). */
const JEITOS_DE_SUBIR: readonly OpcaoDaPeca<QuandoSobe['quando']>[] = [
  { valor: 'gastaReacao', rotulo: 'Gastar a reação' },
  { valor: 'acerta', rotulo: 'Acertar um golpe' },
  { valor: 'apanha', rotulo: 'Receber dano' },
  { valor: 'usaTecnica', rotulo: 'Usar uma técnica' },
  { valor: 'comecoDaVez', rotulo: 'Começar a vez' },
  { valor: 'derruba', rotulo: 'Derrubar alguém' },
  { valor: 'esquiva', rotulo: 'Esquivar' },
  { valor: 'gastaSp', rotulo: 'A cada tanto de SP gasto' },
]

type DescidaGuardada = AcumuladorDaFicha['desce'][number]

/** D9: "zera quando a técnica desliga" (`DescidaAoDesligar`, na união que o leitor devolve). */
function ehDescidaDesliga(regra: DescidaGuardada): boolean {
  return regra.quando === 'desliga'
}

const DESCIDA_DESLIGA: DescidaGuardada = { quando: 'desliga' }
/** Até quantos níveis a tira mostra um por um (como no editor dos Acumuladores). */
const MAXIMO_NA_TIRA = 10

function acumuladorDePartida(arredores: ArredoresDaPeca | undefined): AcumuladorDaFicha {
  const outros = arredores === undefined ? [] : acumuladoresNaFicha(arredores.personagem).map((item) => item.acumulador)
  const nome = outros.some((outro) => mesmaMarca(outro.nome, NOME_DE_PARTIDA)) ? `${NOME_DE_PARTIDA} ${outros.length + 1}` : NOME_DE_PARTIDA
  return {
    v: VERSAO_DO_ACUMULADOR,
    id: idParaOAcumulador(nome, outros.map((outro) => outro.id)),
    nome,
    maximo: MAXIMO_DE_PARTIDA,
    sobe: [{ quando: 'acerta', quanto: 1 }],
    desce: [{ quando: 'fimDaBatalha' }],
    ganho: { ganho: 'dano', cada: DANO_POR_NIVEL_DE_PARTIDA },
  }
}

function subidaNova(quando: QuandoSobe['quando'], quanto: number, tecnicas: readonly Referencia[]): SubidaDoAcumulador | null {
  switch (quando) {
    case 'usaTecnica': {
      const primeira = tecnicas[0]
      return primeira === undefined ? null : { quando, tecnica: primeira, quanto }
    }
    case 'gastaSp':
      return { quando, cada: SP_DE_PARTIDA, quanto }
    default:
      return { quando, quanto }
  }
}

function comMaximo(a: AcumuladorDaFicha, maximo: number): AcumuladorDaFicha {
  const { inicial, ganho } = a
  const comInicial = inicial === undefined || inicial <= maximo ? a : { ...a, inicial: maximo }
  // O valor por nível acompanha o máximo novo: corta, ou repete o último.
  if ((ganho.ganho === 'dano' || ganho.ganho === 'atributo') && ganho.niveis !== undefined) {
    const ultimo = ganho.niveis.at(-1) ?? 0
    const niveis = Array.from({ length: maximo }, (_, indice) => ganho.niveis[indice] ?? ultimo)
    return { ...comInicial, maximo, ganho: ganho.ganho === 'dano' ? { ganho: 'dano', niveis } : { ganho: 'atributo', atributo: ganho.atributo, niveis } }
  }
  return { ...comInicial, maximo }
}

function comInicial(a: AcumuladorDaFicha, inicial: number): AcumuladorDaFicha {
  const { inicial: _antes, ...sem } = a
  return inicial > 0 ? { ...sem, inicial: Math.min(inicial, a.maximo) } : sem
}

function LinhaDaSubida({ regra, tecnicas, nome, aoMudar, aoTirar }: { regra: AcumuladorDaFicha['sobe'][number]; tecnicas: readonly Referencia[]; nome: string; aoMudar: (regra: SubidaDoAcumulador) => void; aoTirar: () => void }) {
  if (regra.quando === 'naoLida') {
    return (
      <li className="lb-pc__item">
        <Texto>Regra de app mais novo: fica guardada como veio.</Texto>
        <Tirar rotulo="Tirar esta regra" onClick={aoTirar} />
      </li>
    )
  }
  const jeitos = tecnicas.length === 0 ? JEITOS_DE_SUBIR.filter((jeito) => jeito.valor !== 'usaTecnica' || regra.quando === 'usaTecnica') : JEITOS_DE_SUBIR
  return (
    <li className="lb-pc__item">
      <Escolher
        rotulo="Como sobe"
        valor={regra.quando}
        opcoes={jeitos}
        onChange={(quando) => {
          const nova = subidaNova(quando, regra.quanto, tecnicas)
          if (nova !== null) aoMudar(nova)
        }}
      />
      {regra.quando === 'usaTecnica' && (
        <>
          <Escolher
            rotulo="Qual técnica"
            valor={regra.tecnica.id ?? regra.tecnica.nome}
            opcoes={tecnicas.map((tecnica) => ({ valor: tecnica.id ?? tecnica.nome, rotulo: tecnica.nome }))}
            onChange={(chave) => {
              const tecnica = tecnicas.find((candidata) => (candidata.id ?? candidata.nome) === chave)
              if (tecnica !== undefined) aoMudar({ ...regra, tecnica })
            }}
          />
          <Caixa
            rotulo="só se acertar"
            marcado={regra.seAcertar === true}
            onChange={(marcado) => {
              const { seAcertar: _antes, ...aoUsar } = regra
              aoMudar(marcado ? { ...aoUsar, seAcertar: true } : aoUsar)
            }}
          />
        </>
      )}
      {regra.quando === 'gastaSp' && (
        <>
          <Texto>a cada</Texto>
          <Numero rotulo="A cada quanto de SP" valor={regra.cada} minimo={1} maximo={RECURSO_DO_REQUISITO_MAX} onChange={(cada) => aoMudar({ ...regra, cada })} />
          <Texto>SP</Texto>
        </>
      )}
      <Texto>soma</Texto>
      <Numero rotulo="Quanto soma" valor={regra.quanto} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} onChange={(quanto) => aoMudar({ ...regra, quanto })} />
      {regra.quando === 'gastaReacao' && <span className="lb-pc__nota-curta">vira a ação «Carregar {nome}» no menu</span>}
      <Tirar rotulo="Tirar este jeito de subir" onClick={aoTirar} />
    </li>
  )
}

function ComoDesce({ a, gravar }: { a: AcumuladorDaFicha; gravar: (a: AcumuladorDaFicha) => void }) {
  const rodada = a.desce.find((regra): regra is Extract<DescidaDoAcumulador, { quando: 'rodadaSemUso' }> => regra.quando === 'rodadaSemUso')
  const apanha = a.desce.find((regra): regra is Extract<DescidaDoAcumulador, { quando: 'apanha' }> => regra.quando === 'apanha')
  const desliga = a.desce.some(ehDescidaDesliga)
  const outrasNaoLidas = a.desce.some((regra) => regra.quando === 'naoLida' && !ehDescidaDesliga(regra))
  const trocar = (fora: (regra: DescidaGuardada) => boolean, nova: DescidaGuardada | null) => {
    const outras = a.desce.filter((regra) => !fora(regra))
    gravar({ ...a, desce: nova === null ? outras : [...outras, nova] })
  }
  return (
    <ul className="lb-pc__lista">
      <li className="lb-pc__item lb-pc__item--fixo">
        <Texto>As técnicas com «e gasta» nos Requisitos tiram o que gastam</Texto>
        <span className="lb-pc__nota-curta">sempre (tipo A4)</span>
      </li>
      <li className="lb-pc__item lb-pc__item--fixo">
        <Texto>Zera no fim da batalha</Texto>
        <span className="lb-pc__nota-curta">sempre: a batalha nova começa do zero</span>
      </li>
      <li className="lb-pc__item lb-pc__item--fixo">
        <Caixa rotulo="Cai por rodada sem subir" marcado={rodada !== undefined} onChange={(marcado) => trocar((regra) => regra.quando === 'rodadaSemUso', marcado ? { quando: 'rodadaSemUso', quanto: 1 } : null)} />
        {rodada !== undefined && (
          <>
            <Texto>cai</Texto>
            <Numero rotulo="Quanto cai por rodada" valor={rodada.quanto} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} onChange={(quanto) => trocar((regra) => regra.quando === 'rodadaSemUso', { quando: 'rodadaSemUso', quanto })} />
          </>
        )}
      </li>
      <li className="lb-pc__item lb-pc__item--fixo">
        <Caixa rotulo="Cai ao receber dano" marcado={apanha !== undefined} onChange={(marcado) => trocar((regra) => regra.quando === 'apanha', marcado ? { quando: 'apanha', quanto: 1 } : null)} />
        {apanha !== undefined && (
          <>
            <Caixa rotulo="zera tudo" marcado={apanha.quanto === 'tudo'} onChange={(tudo) => trocar((regra) => regra.quando === 'apanha', { quando: 'apanha', quanto: tudo ? 'tudo' : 1 })} />
            {apanha.quanto !== 'tudo' && (
              <>
                <Texto>cai</Texto>
                <Numero rotulo="Quanto cai ao receber dano" valor={apanha.quanto} minimo={1} maximo={PASSO_DO_ACUMULADOR_MAX} onChange={(quanto) => trocar((regra) => regra.quando === 'apanha', { quando: 'apanha', quanto })} />
              </>
            )}
          </>
        )}
      </li>
      <li className="lb-pc__item lb-pc__item--fixo">
        <Caixa rotulo="Zera quando a técnica desliga" marcado={desliga} onChange={(marcado) => trocar(ehDescidaDesliga, marcado ? DESCIDA_DESLIGA : null)} />
        <span className="lb-pc__nota-curta">a dona do medidor, na «Ligar e manter» ou na forma</span>
      </li>
      {outrasNaoLidas && (
        <li className="lb-pc__item lb-pc__item--fixo">
          <span className="lb-pc__nota-curta">Uma regra de cair de app mais novo fica guardada como veio.</span>
        </li>
      )}
    </ul>
  )
}

function CadaNivelDa({ a, atributos, gravar }: { a: AcumuladorDaFicha; atributos: readonly Referencia[]; gravar: (a: AcumuladorDaFicha) => void }) {
  const ganho = a.ganho
  const tipo = ganho.ganho === 'naoLido' ? 'nada' : ganho.ganho
  const valorAtual = (partida: number): number => (ganho.ganho === 'dano' || ganho.ganho === 'atributo' ? (ganho.cada ?? ganho.niveis[0] ?? partida) : partida)
  const trocarTipo = (novo: 'dano' | 'atributo' | 'nada') => {
    if (novo === 'nada') return gravar({ ...a, ganho: { ganho: 'nada' } })
    if (novo === 'dano') return gravar({ ...a, ganho: { ganho: 'dano', cada: valorAtual(DANO_POR_NIVEL_DE_PARTIDA) } })
    const primeiro = atributos[0]
    if (primeiro !== undefined) gravar({ ...a, ganho: { ganho: 'atributo', atributo: primeiro, cada: valorAtual(ATRIBUTO_POR_NIVEL_DE_PARTIDA) } })
  }
  const comCada = (cada: number): GanhoDoAcumulador => (ganho.ganho === 'atributo' ? { ganho: 'atributo', atributo: ganho.atributo, cada } : { ganho: 'dano', cada })
  return (
    <>
      <Frase>
        {/* Pedido de 28/11/2026: o atalho "Igual em todo nível: +N" (a regra antiga "cada nível +10"); o de cada nível mora nos marcos. */}
        <Texto forte>Igual em todo nível</Texto>
        <Segmentos
          rotulo="Igual em todo nível"
          valor={tipo}
          opcoes={[
            { valor: 'dano', rotulo: 'Dano' },
            { valor: 'atributo', rotulo: 'Atributo' },
            { valor: 'nada', rotulo: 'Nada (só libera)' },
          ]}
          onChange={trocarTipo}
        />
        {(ganho.ganho === 'dano' || ganho.ganho === 'atributo') &&
          (ganho.cada !== undefined ? (
            <>
              <Texto>cada nível +</Texto>
              <Numero rotulo={ganho.ganho === 'dano' ? 'Dano por nível' : 'Pontos por nível'} valor={ganho.cada} minimo={1} maximo={DANO_MAX} onChange={(cada) => gravar({ ...a, ganho: comCada(cada) })} />
              <Texto>{ganho.ganho === 'dano' ? 'de dano em todo golpe que acerta' : 'de'}</Texto>
            </>
          ) : (
            <Texto>{`um valor por nível: ${ganho.niveis.join(', ')} (o editor dos Acumuladores muda nível por nível)`}</Texto>
          ))}
        {ganho.ganho === 'atributo' && (
          <Escolher
            rotulo="Qual atributo"
            valor={ganho.atributo.id ?? ganho.atributo.nome}
            opcoes={atributos.map((atributo) => ({ valor: atributo.id ?? atributo.nome, rotulo: atributo.nome }))}
            onChange={(chave) => {
              const atributo = atributos.find((candidato) => (candidato.id ?? candidato.nome) === chave)
              if (atributo !== undefined) gravar({ ...a, ganho: { ...ganho, atributo } })
            }}
          />
        )}
        {tipo === 'nada' && <Texto>só libera (usado pelos Requisitos)</Texto>}
      </Frase>
      {ganho.ganho === 'naoLido' && <Nota>O ganho guardado é de um app mais novo e não se lê aqui; escolher de novo troca.</Nota>}
    </>
  )
}

/** "Ao usar: gasta N / gasta tudo / não gasta" (pedido de 28/11/2026), por técnica liberada no marco. */
function gastosNoMarco(nivel: number): readonly OpcaoDaPeca<GastoNoMarco>[] {
  return [
    { valor: 'nao', rotulo: 'não gasta' },
    { valor: 'nivel', rotulo: `gasta ${nivel}` },
    { valor: 'tudo', rotulo: 'gasta tudo' },
  ]
}

/** O que o marco dá: o dano a mais e os atributos (valores livres, com sinal). */
function GanhoDoMarco({ marco, atributos, aoMudar }: { marco: MarcoDoAcumulador; atributos: readonly Referencia[]; aoMudar: (marco: MarcoDoAcumulador) => void }) {
  const dados = marco.atributos ?? []
  const comAtributos = (lista: readonly AtributoDoMarco[]): MarcoDoAcumulador => {
    const { atributos: _atributos, ...sem } = marco
    return lista.length === 0 ? sem : { ...sem, atributos: lista }
  }
  const livres = atributos.filter((atributo) => !dados.some((dado) => (dado.atributo.id ?? dado.atributo.nome) === (atributo.id ?? atributo.nome)))
  return (
    <>
      <Frase sub>
        <Texto>Dá</Texto>
        <Numero
          rotulo={`Dano a mais no nível ${marco.nivel}`}
          valor={marco.dano ?? 0}
          minimo={-DANO_MAX}
          maximo={DANO_MAX}
          onChange={(dano) => {
            const { dano: _dano, ...sem } = marco
            aoMudar(dano === 0 ? sem : { ...sem, dano })
          }}
        />
        <Texto>de dano</Texto>
        {dados.map((dado, indice) => (
          <span key={dado.atributo.id ?? dado.atributo.nome} className="lb-pc__junto">
            <Texto>e</Texto>
            <Numero rotulo={`${dado.atributo.nome} a mais no nível ${marco.nivel}`} valor={dado.n} minimo={-DANO_MAX} maximo={DANO_MAX} onChange={(n) => aoMudar(comAtributos(trocado(dados, indice, { ...dado, n })))} />
            <Texto>{dado.atributo.nome}</Texto>
            <Tirar rotulo={`Tirar ${dado.atributo.nome} do nível ${marco.nivel}`} onClick={() => aoMudar(comAtributos(semOItem(dados, indice)))} />
          </span>
        ))}
        {dados.length < ATRIBUTOS_DO_MARCO_MAX && livres.length > 0 && (
          <PorDaLista
            rotulo={`Atributo a mais no nível ${marco.nivel}`}
            opcoes={livres.map((atributo) => ({ valor: atributo.id ?? atributo.nome, rotulo: atributo.nome }))}
            onPor={(chave) => {
              const atributo = livres.find((candidato) => (candidato.id ?? candidato.nome) === chave)
              if (atributo !== undefined) aoMudar(comAtributos([...dados, { atributo, n: ATRIBUTO_POR_NIVEL_DE_PARTIDA }]))
            }}
          />
        )}
      </Frase>
    </>
  )
}

/**
 * OS MARCOS "Ao chegar a N" (D8 e os pedidos do dono de 28/11/2026): uma lista, um marco por nível, cada um
 * com o que DÁ (dano e atributos, valores livres, em `AcumuladorDaFicha.marcos`) e as técnicas que LIBERA,
 * cada uma com "Ao usar: gasta N / gasta tudo / não gasta". A liberação mora no requisito A4 da técnica
 * ("<medidor> N ou mais"): o marco e o requisito são a MESMA regra, e a técnica abaixo do nível fica
 * cinza com o motivo ("Falta: Polaridade 2, tem 1").
 */
function Marcos({ a, arredores, atributos, gravar }: { a: AcumuladorDaFicha; arredores: ArredoresDaPeca | undefined; atributos: readonly Referencia[]; gravar: (a: AcumuladorDaFicha) => void }) {
  const [nivelNovo, setNivelNovo] = useState(1)
  const ref: Referencia = { id: a.id, nome: a.nome }
  const tecnicas = arredores === undefined ? [] : tecnicasDaFicha(arredores.personagem, arredores.cartao.id)
  const liberadas = tecnicas.flatMap((cartao): { cartao: CartaoDaFicha; nivel: number }[] => {
    const nivel = nivelQuePede(cartao, ref)
    return nivel === null ? [] : [{ cartao, nivel }]
  })
  const outras = tecnicas.filter((cartao) => !liberadas.some((item) => item.cartao === cartao))
  const mudar = arredores?.aoMudarOutroCartao
  const marcos = a.marcos ?? []
  const niveis = [...new Set([...marcos.map((marco) => marco.nivel), ...liberadas.map((item) => item.nivel)])].filter((nivel) => nivel <= a.maximo).sort((x, y) => x - y)
  const comMarcos = (lista: readonly MarcoDoAcumulador[]): AcumuladorDaFicha => {
    const { marcos: _marcos, somaOsDeBaixo: _soma, ...sem } = a
    const ordenada = [...lista].sort((x, y) => x.nivel - y.nivel)
    return ordenada.length === 0 ? sem : { ...sem, marcos: ordenada, ...(a.somaOsDeBaixo === true ? { somaOsDeBaixo: true } : {}) }
  }
  const trocarMarco = (marco: MarcoDoAcumulador): void => gravar(comMarcos([...marcos.filter((outro) => outro.nivel !== marco.nivel), marco]))
  const tirarMarco = (nivel: number): void => {
    gravar(comMarcos(marcos.filter((marco) => marco.nivel !== nivel)))
    if (mudar !== undefined) for (const item of liberadas) if (item.nivel === nivel) mudar(comATecnicaNoNivel(item.cartao, ref, null))
  }
  const nivelNaFaixa = Math.min(a.maximo, Math.max(1, nivelNovo))
  return (
    <Campo rotulo="Ao chegar a N (os marcos)">
      {niveis.length > 0 && (
        <ul className="lb-pc__lista">
          {niveis.map((nivel) => {
            const marco = marcos.find((candidato) => candidato.nivel === nivel) ?? { nivel }
            const doMarco = liberadas.filter((item) => item.nivel === nivel)
            return (
              <li key={nivel} className="lb-pc__item lb-pc__item--fixo">
                <Frase>
                  <Texto forte>{`Ao chegar a ${nivel}`}</Texto>
                  <Tirar rotulo={`Tirar o marco do nível ${nivel}`} onClick={() => tirarMarco(nivel)} />
                </Frase>
                <GanhoDoMarco marco={marco} atributos={atributos} aoMudar={trocarMarco} />
                {doMarco.map(({ cartao }) => (
                  <Frase sub key={cartao.id}>
                    <Texto>libera</Texto>
                    <Texto forte>{cartao.nome.trim()}</Texto>
                    <Texto>· ao usar:</Texto>
                    {mudar === undefined ? (
                      <Texto>{gastosNoMarco(nivel).find((opcao) => opcao.valor === gastoQuePede(cartao, ref))?.rotulo ?? 'não gasta'}</Texto>
                    ) : (
                      <Segmentos rotulo={`O que ${cartao.nome.trim()} gasta de ${a.nome}`} valor={gastoQuePede(cartao, ref)} opcoes={gastosNoMarco(nivel)} onChange={(gasto) => mudar(comOGastoNoNivel(cartao, ref, gasto))} />
                    )}
                    {mudar !== undefined && <Tirar rotulo={`Não liberar mais ${cartao.nome.trim()}`} onClick={() => mudar(comATecnicaNoNivel(cartao, ref, null))} />}
                  </Frase>
                ))}
                {mudar !== undefined && outras.length > 0 && (
                  <Frase sub>
                    <PorDaLista
                      rotulo={`Libera no nível ${nivel}`}
                      opcoes={outras.map((cartao) => ({ valor: cartao.id, rotulo: cartao.nome.trim() }))}
                      onPor={(id) => {
                        const cartao = outras.find((candidato) => candidato.id === id)
                        if (cartao !== undefined) mudar(comATecnicaNoNivel(cartao, ref, nivel))
                      }}
                    />
                  </Frase>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {niveis.length < a.maximo && (
        <Frase>
          <Texto>Novo marco: ao chegar a</Texto>
          <Numero rotulo="Nível do marco novo" valor={nivelNaFaixa} minimo={1} maximo={a.maximo} onChange={setNivelNovo} />
          <button type="button" className="lb-ed__bt lb-ed__bt--p" disabled={niveis.includes(nivelNaFaixa)} onClick={() => trocarMarco({ nivel: nivelNaFaixa })}>
            Pôr o marco
          </button>
        </Frase>
      )}
      {niveis.length > 1 && (
        <Caixa
          rotulo="Soma os níveis de baixo (sem marcar, vale só o maior marco até o nível de agora)"
          marcado={a.somaOsDeBaixo === true}
          onChange={(marcado) => {
            const { somaOsDeBaixo: _soma, ...sem } = a
            gravar(marcado ? { ...sem, somaOsDeBaixo: true } : sem)
          }}
        />
      )}
      {arredores === undefined && <Nota>Para liberar uma técnica num marco, abra esta peça na ficha (a liberação mora nos Requisitos da técnica, tipo A4).</Nota>}
    </Campo>
  )
}

/**
 * ACUMULADOR (D9; `corpoAcumulador` do protótipo): o medidor do cartão dono (`cartao.acumulador`, nunca
 * cópia na mecânica). Nome, até que nível vai e onde começa; como sobe; como desce (com o "zera quando a
 * técnica desliga" novo); o que cada nível dá; e as técnicas que ele libera ao chegar a N (pelo requisito
 * A4 delas). As mesmas regras do editor dos Acumuladores (`EditorDoAcumulador.tsx`), na forma de peça.
 */
export function PecaAcumulador({ acumulador, aoMudar, arredores }: PropsDoAcumulador) {
  const [nomeDigitado, setNomeDigitado] = useState<string | null>(null)
  if (acumulador === undefined) {
    return (
      <>
        <Nota>Este cartão ainda não tem medidor. Ele nasce aqui e aparece na faixa Acumuladores da ficha.</Nota>
        <div>
          <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={() => aoMudar(acumuladorDePartida(arredores))}>
            Criar o medidor
          </button>
        </div>
      </>
    )
  }
  const a = acumulador
  const outros = arredores === undefined ? [] : acumuladoresNaFicha(arredores.personagem).filter((item) => item.acumulador.id !== a.id)
  const tecnicas = arredores === undefined ? [] : tecnicasDaFicha(arredores.personagem).map(referenciaDoCartao)
  const atributos = arredores?.atributos ?? ATRIBUTOS_DAS_PECAS.map((opcao): Referencia => ({ id: opcao.valor, nome: opcao.rotulo }))
  const nomeNaTela = nomeDigitado ?? a.nome
  const limpo = nomeNaTela.trim()
  const erroDoNome = limpo === '' ? 'Dê um nome ao medidor.' : outros.some((outro) => mesmaMarca(outro.acumulador.nome, limpo)) ? `Já existe “${limpo}” nesta ficha.` : null
  const cheio = a.sobe.length >= REGRAS_DO_ACUMULADOR_MAX
  const niveis = Array.from({ length: Math.min(a.maximo, MAXIMO_NA_TIRA) }, (_, indice) => ganhoNoNivel(a, indice + 1))
  return (
    <>
      <Frase>
        <Texto forte>O medidor</Texto>
        <TextoCurto
          rotulo="Nome do acumulador"
          valor={nomeNaTela}
          maximo={NOME_DO_ACUMULADOR_MAX}
          placeholder={NOME_DE_PARTIDA}
          onChange={(texto) => {
            setNomeDigitado(texto)
            const novo = texto.trim()
            if (novo !== '' && !outros.some((outro) => mesmaMarca(outro.acumulador.nome, novo))) aoMudar({ ...a, nome: novo })
          }}
        />
        <Texto>vai até o nível</Texto>
        <Numero rotulo="Vai até o nível" valor={a.maximo} minimo={1} maximo={NIVEL_DO_ACUMULADOR_MAX} onChange={(maximo) => aoMudar(comMaximo(a, maximo))} />
        <Texto>e começa a batalha em</Texto>
        <Numero rotulo="Começa a batalha em" valor={a.inicial ?? 0} minimo={0} maximo={a.maximo} onChange={(inicial) => aoMudar(comInicial(a, inicial))} />
      </Frase>
      {erroDoNome !== null && (
        <p className="lb-pc__alerta" role="alert">
          {erroDoNome}
        </p>
      )}
      <Campo rotulo="Como sobe">
        {a.sobe.length === 0 ? (
          <Nota>Nada faz subir ainda: só as técnicas que somam («Soma num acumulador» nos Efeitos).</Nota>
        ) : (
          <ul className="lb-pc__lista">
            {a.sobe.map((regra, indice) => (
              <LinhaDaSubida
                key={indice}
                regra={regra}
                tecnicas={tecnicas}
                nome={a.nome}
                aoMudar={(nova) => aoMudar({ ...a, sobe: trocado(a.sobe, indice, nova) })}
                aoTirar={() => aoMudar({ ...a, sobe: semOItem(a.sobe, indice) })}
              />
            ))}
          </ul>
        )}
        {!cheio && (
          <Frase>
            <PorDaLista
              rotulo="Outro jeito de subir"
              opcoes={tecnicas.length === 0 ? JEITOS_DE_SUBIR.filter((jeito) => jeito.valor !== 'usaTecnica') : JEITOS_DE_SUBIR}
              onPor={(quando) => {
                const nova = subidaNova(quando, 1, tecnicas)
                if (nova !== null) aoMudar({ ...a, sobe: [...a.sobe, nova] })
              }}
            />
          </Frase>
        )}
      </Campo>
      <Campo rotulo="Como desce">
        <ComoDesce a={a} gravar={aoMudar} />
      </Campo>
      <CadaNivelDa a={a} atributos={atributos} gravar={aoMudar} />
      {niveis.some((texto) => texto !== null) && (
        <div className="lb-pc__niveis" aria-label="O que cada nível dá">
          {niveis.map((texto, indice) => (
            <span key={indice} className="lb-pc__etq">
              Nível {indice + 1}: {texto}
            </span>
          ))}
          {a.maximo > MAXIMO_NA_TIRA && <span className="lb-pc__nota-curta">… até o nível {a.maximo}</span>}
        </div>
      )}
      <Marcos a={a} arredores={arredores} atributos={atributos} gravar={aoMudar} />
      <div className="lb-pc__palavras" aria-live="polite">
        <span className="lb-pc__rot">Em palavras</span>
        <ul>
          {frasesDoAcumulador(a).map((frase) => (
            <li key={frase}>{frase}.</li>
          ))}
        </ul>
      </div>
      <Nota>É o mesmo acumulador da faixa Acumuladores da ficha: qualquer técnica pode pedir um nível dele nos Requisitos.</Nota>
    </>
  )
}
