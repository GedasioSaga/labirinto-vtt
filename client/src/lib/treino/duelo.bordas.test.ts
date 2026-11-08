// @vitest-environment node
/**
 * AS BORDAS DO DUELO que a auditoria do fechamento do Lobby apontou sem teste
 * (regra pura, `duelo.ts`; o DO só chama): o dono lido do doc, o teto de
 * 64 KiB do cliente para o DO, os 3 minutos de quem caiu (resposta 12.15), o
 * estado no fio sem o dono, a opção (variante) da técnica, a reação com
 * técnica, a forma que não está na ficha e a desistência.
 */
import { describe, expect, it } from 'vitest'
import type { VezEsperada } from '../batalha/ponte'
import { VARIANTE_PRINCIPAL } from '../batalha/escolhaEEvolucao'
import { GRANDE_CHIFRE, jimboy, may, QUEBRA_QUEIXO } from '../batalha/fichasDaFatiaB.testkit'
import { aira } from '../batalha/fichasDaFatiaC.testkit'
import type { RespostasDoPedido } from '../batalha/perguntaNaHora'
import { cartaDaVez } from '../batalha/turnos'
import { LIMITES } from '../nuvem/limites'
import type { Personagem } from '../personagem'
import {
  aplicarJogada,
  criarDuelo,
  desistirDoDuelo,
  dueloParaOFio,
  lerJogadaDoDuelo,
  marcarAusente,
  marcarPresente,
  prazoDoDuelo,
  vencerAusencia,
  VOLTA_DO_AUSENTE_MS,
  type DueloGravado,
  type JogadaDoDuelo,
  type MotorDoDuelo,
  type ResultadoDaJogada,
} from './duelo'
import { MARINHEIRO, SISTEMA_DO_TESTE, ze } from './fichasDeTreino.testkit'
import { criarSorteio } from './sorteio'

const CONTA_A = 'conta_a'
const CONTA_B = 'conta_b'
const TOKEN_DO_ZE = 'treino_tok_a1'
const TOKEN_DO_MARINHEIRO = 'treino_tok_b1'
const AGORA = 1_800_000_000_000

function daConta(ficha: Personagem, contaId: string): Personagem {
  return { ...ficha, dono: contaId }
}

/** O Zé com o Golpe de duas opções: a principal (Força + 60) e a "Opção Leve" (Força + 10). */
function zeComOpcoes(): Personagem {
  const base = ze(60)
  const golpe = { id: 'tec_golpe', nome: 'Golpe Duplo', campos: { acao: 'Simples', custo: '10 SP', dano: 'Força + 60', efeito: 'Força + 60' }, extras: [{ nome: 'Opção Leve', valor: 'Força + 10' }], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
  return daConta({ ...base, abas: { ...base.abas, habilidades: [...(base.abas.habilidades ?? []), golpe] } }, CONTA_A)
}

/** O Marinheiro com SP e o Passo de Valsa (Reação): o texto diz esquivar e marcar quem atacou por 2 turnos. */
function marinheiroComValsa(): Personagem {
  const valsa = {
    id: 'tec_valsa',
    nome: 'Passo de Valsa',
    campos: { acao: 'Reação', custo: '10 SP', efeito: 'Esquiva do golpe e deixa uma marca de tinta por 2 turnos' },
    extras: [],
    atributos: [],
    imagem: null,
    modificadores: [],
    subcartoes: [],
  }
  return daConta({ ...MARINHEIRO, recursos: { ...MARINHEIRO.recursos, sp: 50 }, maximos: { ...MARINHEIRO.maximos, sp: 50 }, abas: { ...MARINHEIRO.abas, habilidades: [valsa] } }, CONTA_B)
}

function motor(semente = 7): MotorDoDuelo {
  const sorteio = criarSorteio(semente)
  return { sistema: SISTEMA_DO_TESTE, rolarD20: () => sorteio.d20() }
}

function aceita(resultado: ResultadoDaJogada, oQue: string): DueloGravado {
  if (!resultado.ok) throw new Error(`${oQue} recusada: ${resultado.motivo}`)
  return resultado.duelo
}

function vezDe(duelo: DueloGravado): VezEsperada {
  const { vez, rodada } = duelo.cena.turnos
  if (vez === null) throw new Error('duelo sem vez')
  return { cartaId: vez, rodada }
}

function novoDuelo(a: Personagem, b: Personagem, m: MotorDoDuelo): DueloGravado {
  const criado = criarDuelo({ id: 'duelo_bordas', a: { contaId: CONTA_A, nome: 'Ana', fichas: [a] }, b: { contaId: CONTA_B, nome: 'Bia', fichas: [b] } }, m)
  if (!criado.ok) throw new Error(`duelo recusado: ${JSON.stringify(criado)}`)
  return criado.duelo
}

/** O 1x1 na vez do Zé (o Marinheiro passa se a ordem deu a vez a ele). */
function naVezDoZe(a: Personagem, b: Personagem, m: MotorDoDuelo): DueloGravado {
  const duelo = novoDuelo(a, b, m)
  if (cartaDaVez(duelo.cena.turnos)?.tokenId === TOKEN_DO_ZE) return duelo
  return aceita(aplicarJogada(duelo, m, CONTA_B, { tipo: 'passar', seq: duelo.seq, vez: vezDe(duelo) }), 'o Marinheiro passar')
}

function copia(duelo: DueloGravado, id: string): Personagem {
  const achada = duelo.lutadores.personagens.find((personagem) => personagem.id === id)
  if (achada === undefined) throw new Error(`sem a cópia ${id}`)
  return achada
}

function golpeDoZe(duelo: DueloGravado, cartaoId: string, variante?: string): JogadaDoDuelo {
  return {
    tipo: 'agir',
    seq: duelo.seq,
    vez: vezDe(duelo),
    pedido: { tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null, ...(variante === undefined ? {} : { variante }) },
  }
}

function danoNoMarinheiro(duelo: DueloGravado): number | null | undefined {
  return duelo.cena.turnos.golpes?.at(-1)?.alvos.find((alvo) => alvo.tokenId === TOKEN_DO_MARINHEIRO)?.dano
}

// ─────────────────────────────────────────────────────────────────────────

describe('criarDuelo: o dono vem do doc da ficha, não de quem pede', () => {
  it('ficha de outra conta no lado A é recusada (naoEDono, lado a)', () => {
    const criado = criarDuelo({ id: 'd', a: { contaId: CONTA_A, nome: 'Ana', fichas: [daConta(ze(60), CONTA_B)] }, b: { contaId: CONTA_B, nome: 'Bia', fichas: [daConta(MARINHEIRO, CONTA_B)] } }, motor())
    expect(criado).toEqual({ ok: false, motivo: 'naoEDono', lado: 'a' })
  })

  it('ficha sem dono (NPC do mestre) no lado B é recusada', () => {
    const semDono: Personagem = { ...MARINHEIRO }
    delete semDono.dono
    const criado = criarDuelo({ id: 'd', a: { contaId: CONTA_A, nome: 'Ana', fichas: [daConta(ze(60), CONTA_A)] }, b: { contaId: CONTA_B, nome: 'Bia', fichas: [semDono] } }, motor())
    expect(criado).toEqual({ ok: false, motivo: 'naoEDono', lado: 'b' })
  })

  it('a mesma conta dos dois lados é recusada antes de olhar as fichas', () => {
    const criado = criarDuelo({ id: 'd', a: { contaId: CONTA_A, nome: 'Ana', fichas: [] }, b: { contaId: CONTA_A, nome: 'Ana', fichas: [] } }, motor())
    expect(criado).toEqual({ ok: false, motivo: 'mesmaConta' })
  })

  it('lado sem ficha é recusado (vazio)', () => {
    const criado = criarDuelo({ id: 'd', a: { contaId: CONTA_A, nome: 'Ana', fichas: [daConta(ze(60), CONTA_A)] }, b: { contaId: CONTA_B, nome: 'Bia', fichas: [] } }, motor())
    expect(criado).toMatchObject({ ok: false, motivo: 'vazio', lado: 'b' })
  })

  it('as fichas recebidas não mudam ao criar', () => {
    const a = daConta(ze(60), CONTA_A)
    const antes = structuredClone(a)
    novoDuelo(a, daConta(MARINHEIRO, CONTA_B), motor())
    expect(a).toEqual(antes)
  })
})

describe('lerJogadaDoDuelo: o teto de 64 KiB do cliente para o DO', () => {
  /** Uma jogada `passar` válida com enchimento num campo a mais até `tamanho` bytes. */
  function jogadaDeTamanho(bytes: number, letra = 'x'): string {
    const base = { tipo: 'passar', seq: 0, vez: { cartaId: 'carta_x', rodada: 1 }, enchimento: '' }
    const vazio = JSON.stringify(base).length
    const bytesDaLetra = new TextEncoder().encode(letra).length
    const quantas = Math.floor((bytes - vazio) / bytesDaLetra)
    return JSON.stringify({ ...base, enchimento: letra.repeat(quantas) })
  }

  it('exatamente 64 KiB ainda é lido', () => {
    const texto = jogadaDeTamanho(LIMITES.frameBytes)
    expect(new TextEncoder().encode(texto).length).toBe(LIMITES.frameBytes)
    expect(lerJogadaDoDuelo(texto)).toEqual({ ok: true, jogada: { tipo: 'passar', seq: 0, vez: { cartaId: 'carta_x', rodada: 1 } } })
  })

  it('um byte acima de 64 KiB é grandeDemais', () => {
    expect(lerJogadaDoDuelo(jogadaDeTamanho(LIMITES.frameBytes) + ' ')).toEqual({ ok: false, motivo: 'grandeDemais' })
  })

  it('acentos: menos de 64 Ki caracteres mas mais de 64 KiB em UTF-8 é grandeDemais', () => {
    // "é" = 2 bytes: ~33 mil caracteres passam do teto em bytes.
    const texto = jogadaDeTamanho(LIMITES.frameBytes + 2, 'é')
    expect(texto.length).toBeLessThan(LIMITES.frameBytes)
    expect(lerJogadaDoDuelo(texto)).toEqual({ ok: false, motivo: 'grandeDemais' })
  })

  it('JSON quebrado, texto vazio e tipo desconhecido são formato, não exceção', () => {
    expect(lerJogadaDoDuelo('')).toEqual({ ok: false, motivo: 'formato' })
    expect(lerJogadaDoDuelo('{"tipo":"passar"')).toEqual({ ok: false, motivo: 'formato' })
    expect(lerJogadaDoDuelo('{"tipo":"curar","seq":0}')).toEqual({ ok: false, motivo: 'formato' })
    expect(lerJogadaDoDuelo('null')).toEqual({ ok: false, motivo: 'formato' })
  })

  it('seq negativo, fracionário ou em texto é formato', () => {
    for (const seq of [-1, 1.5, '0', Number.MAX_SAFE_INTEGER + 2]) {
      expect(lerJogadaDoDuelo(JSON.stringify({ tipo: 'passar', seq, vez: { cartaId: 'c', rodada: 1 } })), String(seq)).toEqual({ ok: false, motivo: 'formato' })
    }
  })

  it('__proto__ no JSON não contamina o objeto lido', () => {
    const lida = lerJogadaDoDuelo('{"tipo":"passar","seq":0,"vez":{"cartaId":"c","rodada":1},"__proto__":{"seq":99}}')
    expect(({} as Record<string, unknown>).seq).toBeUndefined()
    if (lida.ok) expect(lida.jogada.seq).toBe(0)
  })

  it('dano forjado em texto ("1e12", "abc") não recusa por formato: o servidor recalcula', () => {
    const texto = JSON.stringify({
      tipo: 'agir',
      seq: 0,
      vez: { cartaId: 'c', rodada: 1 },
      pedido: { tipo: 'atacar', armaId: 'arma_espada', alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: 'abc' }], surpresa: false, perfurante: false },
    })
    const lida = lerJogadaDoDuelo(texto)
    expect(lida.ok).toBe(true)
    if (lida.ok && lida.jogada.tipo === 'agir' && lida.jogada.pedido.tipo === 'atacar') expect(lida.jogada.pedido.alvos[0]?.dano).toBeNull()
  })
})

describe('quem caiu: 3 minutos para voltar (12.15)', () => {
  const m = motor()
  const base = (): DueloGravado => novoDuelo(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)

  it('o prazo é 3 min depois de ficar sem socket; 1 ms antes ainda não perde, no prazo exato perde', () => {
    const ausente = marcarAusente(base(), CONTA_A, AGORA)
    expect(VOLTA_DO_AUSENTE_MS).toBe(180_000)
    expect(prazoDoDuelo(ausente)).toBe(AGORA + 180_000)
    expect(vencerAusencia(ausente, AGORA + 179_999).fim).toBeNull()
    expect(vencerAusencia(ausente, AGORA + 180_000).fim).toEqual({ tipo: 'ausencia', vencedor: 'b' })
  })

  it('cair de novo (2ª aba fecha) não reinicia o relógio: fica o primeiro instante', () => {
    const uma = marcarAusente(base(), CONTA_B, AGORA)
    const duas = marcarAusente(uma, CONTA_B, AGORA + 60_000)
    expect(duas).toBe(uma)
    expect(prazoDoDuelo(duas)).toBe(AGORA + 180_000)
  })

  it('voltar antes do prazo zera; cair de novo depois começa outros 3 min', () => {
    const volta = marcarPresente(marcarAusente(base(), CONTA_A, AGORA), CONTA_A)
    expect(prazoDoDuelo(volta)).toBeNull()
    expect(vencerAusencia(volta, AGORA + 10 * 60_000).fim).toBeNull()
    const deNovo = marcarAusente(volta, CONTA_A, AGORA + 120_000)
    expect(prazoDoDuelo(deNovo)).toBe(AGORA + 300_000)
  })

  it('os dois caídos: o prazo é o menor; os dois passaram = ninguém vence', () => {
    const doisFora = marcarAusente(marcarAusente(base(), CONTA_A, AGORA), CONTA_B, AGORA + 30_000)
    expect(prazoDoDuelo(doisFora)).toBe(AGORA + 180_000)
    expect(vencerAusencia(doisFora, AGORA + 180_000).fim).toEqual({ tipo: 'ausencia', vencedor: 'b' })
    expect(vencerAusencia(doisFora, AGORA + 210_000).fim).toEqual({ tipo: 'ausencia', vencedor: null })
  })

  it('conta de fora não marca ninguém; duelo acabado não ganha prazo', () => {
    const d = base()
    expect(marcarAusente(d, 'conta_estranha', AGORA)).toBe(d)
    const acabado = aceita(desistirDoDuelo(d, CONTA_A), 'desistir')
    expect(marcarAusente(acabado, CONTA_B, AGORA)).toBe(acabado)
    expect(prazoDoDuelo({ ...marcarAusente(d, CONTA_B, AGORA), fim: { tipo: 'desistencia', vencedor: 'a' } })).toBeNull()
  })

  it('estar ausente não recusa a jogada (a aba que volta joga antes do ola chegar): só o prazo vence', () => {
    const d = marcarAusente(naVezDoZe(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m), CONTA_A, AGORA)
    const passou = aplicarJogada(d, m, CONTA_A, { tipo: 'passar', seq: d.seq, vez: vezDe(d) })
    expect(passou.ok).toBe(true)
  })
})

describe('desistir', () => {
  const m = motor()
  it('o outro lado vence na hora, sem mexer no seq nem nos passos, mesmo fora da vez', () => {
    const d = naVezDoZe(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    const fim = aceita(desistirDoDuelo(d, CONTA_B), 'a Bia desistir fora da vez')
    expect(fim.fim).toEqual({ tipo: 'desistencia', vencedor: 'a' })
    expect({ seq: fim.seq, passos: fim.passos }).toEqual({ seq: d.seq, passos: d.passos })
  })

  it('depois do fim: desistir de novo é "acabou", e jogar também', () => {
    const d = naVezDoZe(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    const fim = aceita(desistirDoDuelo(d, CONTA_A), 'desistir')
    expect(desistirDoDuelo(fim, CONTA_B)).toEqual({ ok: false, motivo: 'acabou' })
    expect(aplicarJogada(fim, m, CONTA_A, { tipo: 'passar', seq: fim.seq, vez: vezDe(fim) })).toEqual({ ok: false, motivo: 'acabou' })
  })

  it('conta de fora não desiste por ninguém', () => {
    const d = novoDuelo(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    expect(desistirDoDuelo(d, 'conta_estranha')).toEqual({ ok: false, motivo: 'naoJoga' })
  })

  it('duelo de outra versão do motor não aceita desistência nem jogada', () => {
    const d = novoDuelo(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    // Teste: um estado gravado por outro motor (o tipo só conhece a versão 2).
    const velho = { ...d, versao: 1 } as unknown as DueloGravado
    expect(desistirDoDuelo(velho, CONTA_A)).toEqual({ ok: false, motivo: 'versao' })
    expect(aplicarJogada(velho, m, CONTA_A, { tipo: 'passar', seq: d.seq, vez: vezDe(d) })).toEqual({ ok: false, motivo: 'versao' })
  })
})

describe('o estado no fio', () => {
  it('as fichas vão sem o dono e sem a nota do mestre; o gravado (só no servidor) guarda o dono', () => {
    const comNota = { ...daConta(ze(60), CONTA_A), notaDoMestre: 'segredo do mestre' } as Personagem
    const d = novoDuelo(comNota, daConta(MARINHEIRO, CONTA_B), motor())
    expect(d.lutadores.personagens.map((p) => p.dono)).toEqual([CONTA_A, CONTA_B])
    const fio = JSON.stringify(dueloParaOFio(d))
    expect(fio).not.toContain('"dono"')
    expect(fio).not.toContain('segredo do mestre')
  })

  it('o fio não leva a reversão (Desfazer) do registro', () => {
    const m = motor()
    const d = naVezDoZe(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    const depois = aceita(aplicarJogada(d, m, CONTA_A, { tipo: 'agir', seq: d.seq, vez: vezDe(d), pedido: { tipo: 'atacar', armaId: 'arma_espada', alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false } }), 'atacar')
    expect(depois.cena.registro.length).toBeGreaterThan(0)
    for (const linha of dueloParaOFio(depois).registro) expect(linha).not.toHaveProperty('reversao')
  })
})

describe('a opção (variante) da técnica: o servidor lê o dano da opção pedida', () => {
  const m = motor()

  it('a "Opção Leve" bate Força + 10 = 70; a principal, Força + 60 = 120', () => {
    const d = naVezDoZe(zeComOpcoes(), daConta(MARINHEIRO, CONTA_B), m)
    const leve = aceita(aplicarJogada(d, m, CONTA_A, golpeDoZe(d, 'tec_golpe', 'Opção Leve')), 'a Opção Leve')
    const principal = aceita(aplicarJogada(d, m, CONTA_A, golpeDoZe(d, 'tec_golpe', VARIANTE_PRINCIPAL)), 'a principal')
    expect(danoNoMarinheiro(leve)).toBe(70)
    expect(danoNoMarinheiro(principal)).toBe(120)
  })

  it('opção que a técnica não tem é recusada (regra), e o duelo fica como estava', () => {
    const d = naVezDoZe(zeComOpcoes(), daConta(MARINHEIRO, CONTA_B), m)
    const antes = structuredClone(d)
    expect(aplicarJogada(d, m, CONTA_A, golpeDoZe(d, 'tec_golpe', 'Opção Forjada de 9999'))).toEqual({ ok: false, motivo: 'regra' })
    expect(d).toEqual(antes)
  })

  it('técnica que não está na ficha é recusada', () => {
    const d = naVezDoZe(zeComOpcoes(), daConta(MARINHEIRO, CONTA_B), m)
    expect(aplicarJogada(d, m, CONTA_A, golpeDoZe(d, 'tec_inventada'))).toEqual({ ok: false, motivo: 'regra' })
  })
})

/** A técnica do lado A no lado B com as respostas da mira (o dano o servidor refaz). */
function golpeComRespostas(duelo: DueloGravado, cartaoId: string, respostas: RespostasDoPedido): JogadaDoDuelo {
  return {
    tipo: 'agir',
    seq: duelo.seq,
    vez: vezDe(duelo),
    pedido: { tipo: 'habilidade', cartaoId, armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null, respostas },
  }
}

describe('as respostas da mira (F2, fatia B): o servidor refaz o dano com elas', () => {
  const m = motor()

  it('Quebra-Queixo do Jimboy: ponto vital = 90, sem ele = 60; resposta fora das opções é recusada', () => {
    const d = naVezDoZe(daConta(jimboy, CONTA_A), daConta(may, CONTA_B), m)
    expect(danoNoMarinheiro(aceita(aplicarJogada(d, m, CONTA_A, golpeComRespostas(d, QUEBRA_QUEIXO.id, { vital: 'sim' })), 'o ponto vital'))).toBe(90)
    expect(danoNoMarinheiro(aceita(aplicarJogada(d, m, CONTA_A, golpeComRespostas(d, QUEBRA_QUEIXO.id, { vital: 'nao' })), 'sem o ponto vital'))).toBe(60)
    expect(aplicarJogada(d, m, CONTA_A, golpeComRespostas(d, QUEBRA_QUEIXO.id, { vital: 'talvez' }))).toEqual({ ok: false, motivo: 'regra' })
  })

  it('Grande Chifre da May: 3 quadrados e parede = 151, e o Jimboy que não reage fica Atordoado', () => {
    const d = naVezDoZe(daConta(may, CONTA_A), daConta(jimboy, CONTA_B), m)
    const golpeado = aceita(aplicarJogada(d, m, CONTA_A, golpeComRespostas(d, GRANDE_CHIFRE.id, { quadrados: '3', parede: 'sim' })), 'o Grande Chifre')
    expect(danoNoMarinheiro(golpeado)).toBe(151)
    const golpeId = golpeado.cena.turnos.golpes?.at(-1)?.id ?? ''
    const depois = aceita(aplicarJogada(golpeado, m, CONTA_B, { tipo: 'reagir', seq: golpeado.seq, pedido: { tipo: 'naoReagir', golpeId, tokenId: TOKEN_DO_MARINHEIRO } }), 'o Jimboy não reagir')
    expect((depois.cena.turnos.selos ?? []).filter((selo) => selo.tokenId === TOKEN_DO_MARINHEIRO).map((selo) => selo.nome)).toContain('Atordoado')
  })
})

describe('o Electro no Atacar (F2, fatia C): o servidor leva as respostas junto', () => {
  const m = motor()
  /** O Atacar sem arma da Aira na May, com as respostas da mira. */
  const atacarDaAira = (duelo: DueloGravado, respostas: RespostasDoPedido): JogadaDoDuelo => ({
    tipo: 'agir',
    seq: duelo.seq,
    vez: vezDe(duelo),
    pedido: { tipo: 'atacar', armaId: null, alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false, respostas },
  })
  const spDaAira = (duelo: DueloGravado): number | undefined => duelo.lutadores.personagens.find((personagem) => personagem.nome === 'Aira')?.recursos.sp

  it('"Sim": +20 no dano, -10 SP (140 → 130) e "eletricidade" no golpe; "Não": nada disso', () => {
    const d = naVezDoZe(daConta(aira, CONTA_A), daConta(may, CONTA_B), m)
    const comElectro = aceita(aplicarJogada(d, m, CONTA_A, atacarDaAira(d, { electro: 'sim' })), 'o Atacar com Electro')
    const semElectro = aceita(aplicarJogada(d, m, CONTA_A, atacarDaAira(d, { electro: 'nao' })), 'o Atacar sem Electro')
    expect((danoNoMarinheiro(comElectro) ?? 0) - (danoNoMarinheiro(semElectro) ?? 0)).toBe(20)
    expect([spDaAira(comElectro), spDaAira(semElectro)]).toEqual([130, 140])
    expect(comElectro.cena.turnos.golpes?.at(-1)?.variante).toContain('eletricidade')
  })

  it('resposta fora das opções é recusada (regra)', () => {
    const d = naVezDoZe(daConta(aira, CONTA_A), daConta(may, CONTA_B), m)
    expect(aplicarJogada(d, m, CONTA_A, atacarDaAira(d, { electro: 'talvez' }))).toEqual({ ok: false, motivo: 'regra' })
  })
})

describe('a forma que não está na ficha', () => {
  it('transformar numa forma que a cópia não tem é recusado', () => {
    const m = motor()
    const d = naVezDoZe(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    const jogada: JogadaDoDuelo = { tipo: 'agir', seq: d.seq, vez: vezDe(d), pedido: { tipo: 'transformar', cartaoId: 'forma_gear_5', acao: 'simples', trocarImagem: false } }
    expect(aplicarJogada(d, m, CONTA_A, jogada)).toEqual({ ok: false, motivo: 'regra' })
  })

  it('mover pelo agir (o caminho do contra-ataque) é fora do duelo: o andar é a jogada própria', () => {
    const m = motor()
    const d = naVezDoZe(daConta(ze(60), CONTA_A), daConta(MARINHEIRO, CONTA_B), m)
    const lida = lerJogadaDoDuelo(JSON.stringify({ tipo: 'agir', seq: d.seq, vez: null, pedido: { tipo: 'mover', contraDe: 'golpe_x' } }))
    expect(lida.ok).toBe(true)
    if (lida.ok) expect(aplicarJogada(d, m, CONTA_A, lida.jogada).ok).toBe(false)
  })
})

describe('a reação com técnica: saída, custo e selo vêm da ficha, não do pedido', () => {
  /** O Zé ataca o Marinheiro com a Espada: o golpe fica esperando a reação dele. */
  function golpeEsperando(m: MotorDoDuelo): { duelo: DueloGravado; golpeId: string } {
    const d = naVezDoZe(daConta(ze(60), CONTA_A), marinheiroComValsa(), m)
    const atacou = aceita(aplicarJogada(d, m, CONTA_A, { tipo: 'agir', seq: d.seq, vez: vezDe(d), pedido: { tipo: 'atacar', armaId: 'arma_espada', alvos: [{ tokenId: TOKEN_DO_MARINHEIRO, dano: null }], surpresa: false, perfurante: false } }), 'o Zé atacar')
    const golpe = atacou.cena.turnos.golpes?.at(-1)
    if (golpe === undefined) throw new Error('o golpe não ficou esperando')
    return { duelo: atacou, golpeId: golpe.id }
  }

  it('o Passo de Valsa pedido como "contra" e com custo 0 vira esquiva, cobra os 10 SP e o HP fica inteiro', () => {
    // Arrange
    const m = motor()
    const { duelo, golpeId } = golpeEsperando(m)
    const hpAntes = copia(duelo, 'treino_b1').recursos.hp

    // Act
    const reagiu = aceita(
      aplicarJogada(duelo, m, CONTA_B, { tipo: 'reagir', seq: duelo.seq, pedido: { tipo: 'tecnica', golpeId, tokenId: TOKEN_DO_MARINHEIRO, cartaoId: 'tec_valsa', saida: 'contra', custo: 0 } }),
      'o Passo de Valsa',
    )

    // Assert
    const marinheiro = copia(reagiu, 'treino_b1')
    expect(marinheiro.recursos.sp).toBe(40)
    expect(marinheiro.recursos.hp).toBe(hpAntes)
    const textos = JSON.stringify(reagiu.cena.registro.map((linha) => linha.texto))
    expect(textos).toMatch(/Passo de Valsa/)
    expect(textos).toMatch(/esquiv/i)
    expect(reagiu.cena.turnos.contras ?? []).toEqual([])
  })

  it('o selo pedido em quem atacou é o da ficha ("Marcado" por 2 turnos), nunca o nome forjado', () => {
    const m = motor()
    const { duelo, golpeId } = golpeEsperando(m)
    const reagiu = aceita(
      aplicarJogada(duelo, m, CONTA_B, {
        tipo: 'reagir',
        seq: duelo.seq,
        pedido: { tipo: 'tecnica', golpeId, tokenId: TOKEN_DO_MARINHEIRO, cartaoId: 'tec_valsa', saida: 'esquiva', custo: null, seloNoAtacante: { nome: 'Atordoado', turnos: 99 } },
      }),
      'a Valsa com selo forjado',
    )
    const selos = JSON.stringify(reagiu.cena.turnos.selos ?? [])
    expect(selos).toContain('Marcado')
    expect(selos).not.toContain('Atordoado')
  })

  it('técnica de reação que o Marinheiro não tem é recusada', () => {
    const m = motor()
    const { duelo, golpeId } = golpeEsperando(m)
    expect(aplicarJogada(duelo, m, CONTA_B, { tipo: 'reagir', seq: duelo.seq, pedido: { tipo: 'tecnica', golpeId, tokenId: TOKEN_DO_MARINHEIRO, cartaoId: 'tec_inventada', saida: 'esquiva', custo: null } })).toEqual({ ok: false, motivo: 'regra' })
  })

  it('a conta do Zé não reage pelo Marinheiro', () => {
    const m = motor()
    const { duelo, golpeId } = golpeEsperando(m)
    expect(aplicarJogada(duelo, m, CONTA_A, { tipo: 'reagir', seq: duelo.seq, pedido: { tipo: 'tecnica', golpeId, tokenId: TOKEN_DO_MARINHEIRO, cartaoId: 'tec_valsa', saida: 'esquiva', custo: null } })).toEqual({ ok: false, motivo: 'naoEDaConta' })
  })

  it('a reação com rolar pede o bônus dos selos: modificador forjado de +50 é ignorado', () => {
    const m1 = motor(11)
    const m2 = motor(11)
    const um = golpeEsperando(m1)
    const dois = golpeEsperando(m2)
    const honesto = aceita(aplicarJogada(um.duelo, m1, CONTA_B, { tipo: 'reagir', seq: um.duelo.seq, pedido: { tipo: 'rolar', golpeId: um.golpeId, tokenId: TOKEN_DO_MARINHEIRO, modificador: 0 } }), 'rolar honesto')
    const forjado = aceita(aplicarJogada(dois.duelo, m2, CONTA_B, { tipo: 'reagir', seq: dois.duelo.seq, pedido: { tipo: 'rolar', golpeId: dois.golpeId, tokenId: TOKEN_DO_MARINHEIRO, modificador: 50 } }), 'rolar forjado')
    expect(forjado.cena.registro.map((linha) => linha.texto)).toEqual(honesto.cena.registro.map((linha) => linha.texto))
  })
})
