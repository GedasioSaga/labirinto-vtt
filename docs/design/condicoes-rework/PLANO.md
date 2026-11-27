# Plano de construção: rework das condições (versão 0.6.7)

Fontes: o pedido literal de 27/11 11:51 em `PEDIDOS.md` ("É muito interessante nas condições ter tudo isso, ter várias condições para usar, e uma variedade."); o protótipo aceito como direção, `prototipo.html` (7765aec9): as 13 decisões e as 23 linhas do "onde fica" (`DECISOES` e `ONDE_FICA`, `:1399-1437`), as 8 peças (`PECAS`, `:546`), a seção fixa "Prazo, pilhas e saída" (`:1359`), as 35 de fábrica (`:616-653`, 26 negativas e 9 positivas), "Usar como modelo" e o boneco (`simular`, `:899`). Molde: o rework das habilidades (`docs/design/habilidades-rework/{MAPA,PLANO,PENDENCIAS}.md`). Regras do dono: uma coisa, um lugar; nada do que existe some; fichas e condições antigas continuam funcionando; plano aplicado sem perguntar (as decisões abaixo são do Claude, pelo recomendado); Opus xhigh, Opus max no que é complexo; nenhum teste antes da última etapa, 1 a 3 certeiros no fim, com prints; publicar quando completo. Caminhos relativos a `client/src/`.

## 1. O código de hoje (mapa curto)

### 1.1 Modelo

| O quê | Onde | O que importa |
|---|---|---|
| Criada pelo mestre (`CondicaoPropria`) | `types/map.ts:1613` | nome, cor, um dos 14 desenhos (`lib/condicoesProprias.ts:20`) ou símbolo digitado; `regra` vida, cura ou narra, com `n` (`:1647`); `gatilho` "depois de X turnos" da 0.6.4 (`:1639`; tipo em `lib/itens/modelo.ts:188`) |
| Catálogo (`CondicaoDoCatalogo`) | `lib/condicoes/catalogo.ts:30` | fábrica = as 6 pastilhas de sempre (só o Envenenado tira vida, `:50`) + Sangrando, Queimando, Cura reduzida e Fadiga (`:67`); criada com nome de fábrica sai da lista (`:130`); pelo nome, a de fábrica vence (`:158`) |
| Posta na ficha (`CondicaoNaFicha`) | `lib/itens/modelo.ts:199` | `condId`, turnos, `n` próprio e gatilho da peça que pôs; regras puras em `lib/condicoes/naFicha.ts` (pôr de novo renova `:88`, fim da vez `:127`, vida no começo `:153`, vale o maior corte de cura `:176`) e `lib/condicoes/gatilho.ts:79` |
| Selo da batalha (`SeloDaBatalha`) | `lib/batalha/combate.ts:879` | `mods`, `queda` (`:1033`), `porVez`, `regra` (`:965`), `regenera`, `drenaSp`, `marca`, `marcaDe`, `marcaVezes`, `marcaFica` (`:917-926`), `saiNoProximoGolpe`, `alcance`; quase tudo só do host |
| Regra pelo nome, no código | `lib/batalha/condicoes.ts:79-119` | Atordoado e Paralisado travam (`trava`, `:32`), Aéreo sem Esquiva e Contra, Cego zera Percepção, Marcado esquiva com desvantagem, Sangrando e Queimando por vez, Cura reduzida, Enraizado lembra, mais 6 de uma ficha só; a batalha inteira lê por `comportamentoDoSelo` (`:212`) |
| Quem põe | `lib/batalha/mecanica/modelo.ts:288`, `mecanica/pecas.ts:105`, `components/ItemDoCatalogoDialog.tsx:388-442`, `components/batalha/SeloDialog.tsx` | técnica v1 a v4: selo com números próprios (tela `components/batalha/blocos/PecasDoSelo.tsx:201`); v5: `{nome, turnos}` de 16 nomes fixos (`components/batalha/editor/pecas/vocabulario.ts:26`; Congelado, Eletrizado, Enfraquecido, Fortalecido e Protegido não têm regra nenhuma hoje); item: nome, `n` e gatilho; forma: Fadiga com números próprios (`pecas.ts:228`); batalha: "Pôr selo…" |
| Pagar e/ou teste | `lib/batalha/comoMarca.ts:23` | já é a regra única da marca |

### 1.2 Onde é salvo

- `<pasta>/condicoes.json`, versão 1 (`lib/condicoesNoDisco.ts:26-29`), ou o `localStorage` quando não há pasta (`stores/condicoesPropriasStore.ts:31`); teto de 40 criadas (`condicoesProprias.ts:350`). O leitor guarda só as chaves que conhece (`lerCondicaoPropria`, `:404`): o app de antes apaga campo novo quando regrava; versão maior ele recusa ler e gravar (`condicoesNoDisco.ts:52`, `:102`).
- A criada vai inteira dentro do token (`Token.condicoesProprias`, `types/map.ts:1805`, 6 por ficha); desenho fora da biblioteca = a pastilha não nasce no app que não o conhece.
- `Personagem.condicoes` no `rpg.json` (`lib/personagem.ts:335`; leitor `lib/itens/leitura.ts:229`, teto 40), o mesmo leitor no fio e no Worker.
- Os selos em `TurnosDaCena.selos`; a batalha salva volta "como está" (`lib/batalha/batalhaSalva.ts:66-70`).

### 1.3 Quem lê

| Leitor | Como | Onde |
|---|---|---|
| Batalha do mestre | selo pelo nome + números do selo; a condição da ficha vira selo espelho (`daPastilha`) | `lib/ponteDasCondicoes.ts:125`, `:173`; `stores/batalha/condicoesNaFicha.ts:65`, `:119`; Aplicar/pular em `lib/batalha/condicoes.ts:320-340`; fim da vez em `stores/batalha/vez.ts:194-208`, `:330` |
| Worker (Arena e duelo) | importa o motor (`lib/treino/duelo.ts`); só a fábrica e a tabela; sem catálogo criado e sem condição na ficha (`condicoesNaFicha.ts:12`); o "Ao acertar" do item vira selo pelo nome (`lib/batalha/aoAcertarDoItem.ts:14`) | `lobby/nuvem/src/duelo.ts`, `luta.ts` |
| Site do Lobby | não tem catálogo de condições | `lobby-site/` |
| Jogador LAN | pastilha sem regra (`lib/fogFilter.ts:2019`, `:2043`); selos com nome, turnos e mods (`lib/batalha/vistaDoJogador.ts:462`); trava pelo nome no navegador (`condicoes.ts:287`); lembretes do dono (`vistaDoJogador.ts:792`) | `player/` |
| Movimento | o Lento anda metade do passo pela pastilha | `lib/movementRules.ts:73`; host em `lib/moveValidation.ts:375` |

## 2. Modelo de dados novo (aditivo: a condição antiga continua válida)

```ts
// lib/condicoes/modelo.ts (novo). As chaves do pecaNova e do saidaNova do protótipo (prototipo.html:575-600); guarda só o que difere do padrão.
type TipoDeDano = 'qualquer' | 'impacto' | 'cortante' | 'perfurante' | 'fogo' | 'gelo' | 'eletricidade' | 'veneno' | 'luz' | 'trevas' | 'vento'
type PecaDaCondicao =
  | { tipo: 'vez'; quando: 'entrar' | 'comeco' | 'fim'; faz: 'tira' | 'da'; v: number; conta: 'fixo' | 'pctMax' | 'pctAtual'; recurso: 'vida' | 'sp' | 'escudo'; direto?: true; rouba?: true }
  | { tipo: 'atributo'; atr: string; faz: 'tira' | 'soma' | 'fica' | 'maximo'; v: number; conta: 'fixo' | 'pct'; ritmo: 'umaVez' | 'cada' | 'aPartir'; aPartirN?: number; tetoN?: number }
  | { tipo: 'bloqueio'; itens: Partial<Record<'perdeVez' | 'naoReage' | 'reageDesv' | 'naoDesvia' | 'naoMove' | 'naoTecnica' | 'soSimples' | 'naoAlvo', true>> }
  | { tipo: 'danoCura'; recV?: number; recTipo?: TipoDeDano; cauV?: number; curaV?: number; cddV?: number } // ausente = desligado
  | { tipo: 'gatilho'; gatilho: GatilhoDaCondicao } // o da 0.6.4, igual
  | { tipo: 'marca'; mult: number; quem: 'todos' | 'quemPos'; sai: boolean; desvDesv: boolean }
  | { tipo: 'aura'; casas: number; quem: 'aliados' | 'inimigos' | 'todos'; cond: 'esta' | string; espalha?: true } // cond = id do catálogo
  | { tipo: 'contra'; apaga: readonly string[]; impede: boolean } // ids do catálogo
interface PrazoDaCondicao { modo: 'turnos' | 'proximoGolpe' | 'ateTirar' | 'batalha'; n?: number; deNovo: 'renova' | 'pilha' | 'nada'; teto?: number }
type SaidaDaCondicao = { tipo: 'teste'; atr: string; cd: number } | { tipo: 'pagar'; como: 'pagar' | 'teste' | 'e' | 'ou'; paga: 'sp' | 'vida' | 'acao'; v?: number; atr?: string; cd?: number } | { tipo: 'cura' } | { tipo: 'dano'; dano: TipoDeDano } | { tipo: 'agir' }
```

- `CondicaoPropria` (`types/map.ts:1613`) ganha, todos opcionais: `tipo` (ausente = negativa), `desenho` (um dos 10 novos; o `simbolo` guarda um dos 14 de reserva, como o `texto` já faz), `pecas`, `prazo`, `saidas`. Com `pecas` valem as peças; sem, a leitura monta as peças da `regra`, do `n` e do `gatilho` de antes (`lib/condicoes/montadaDaAntiga.ts`, pura e idempotente, nada gravado). `prazo` ausente = 3 turnos e "o prazo recomeça" (o `porCondicao` de hoje). Peça torta: a condição fica (nome e pastilha), sem as peças, com "Confira".
- Fábrica em código, `lib/condicoes/fabrica.ts` (novo): as 35 do protótipo, o mesmo id nas 10 de hoje (`IDS_DE_HOJE`, `prototipo.html:615`), com os apelidos da tabela ("Atordoada", "Ferido por prata") e o da peça Imbuir ("Eletrizado", `pecas.ts:333`, acha o Eletrocutado). Vale no app, no site, no jogador e no Worker.
- Quem põe continua guardando o nome e os turnos, como hoje (`Efeito` selo, `modelo.ts:288`; `CondicaoDaPeca`, `pecas.ts:105`; peça do item, `itens/modelo.ts:176`): nenhum formato de técnica ou de item muda e a mecânica não sobe de versão.
- `CondicaoNaFicha` (`lib/itens/modelo.ts:199`) ganha `pilhas?` e `vezes?` (vezes com ela, para o ritmo do Muda atributo); `DuracaoDaPeca` (`:169`) vai até 10 turnos. `SeloDaBatalha` e `SeloDoGolpe` (`combate.ts:879`, `:1006`) ganham, só do host: `regras?` (a tradução congelada: condId, tipo, bloqueios, "fica em" e "no máximo", dano por tipo, dano causado, efeitos na vez novos, gatilho, "se ganhar de novo", saídas, aura, contra), `pilhas?`, `gatilhoConta?`, `gatilhoFeito?`, `daAura?`. `GolpeDaBatalha` (`:691`) ganha `tipos?` (impacto, cortante, perfurante e o elemento), só do host.
- `condicoes.json` sai `versao: 2` quando alguma condição traz campo novo; o leitor lê 1 e 2.

### Decisões de arquitetura (do Claude, aplicadas)

- **D1. Executar é traduzir.** `lib/condicoes/traducao.ts`: condição + pedido (turnos, quem pôs, atributo de quem leva) vira `SeloDoGolpe`. O que o motor já lê vai nos campos de hoje (`mods`, `queda`, `porVez`, `regra`, `regenera`, `drenaSp`, os da marca, `saiNoProximoGolpe`, `alcance`); o novo vai em `regras`. O motor nunca lê peça crua.
- **D2. Congela ao nascer.** `criarSelo` (`lib/batalha/selos.ts:168`) recebe a condição que a store resolveu (fábrica + `mesa.condicoesCriadas`). Selo sem `regras` (batalha salva antes, nome digitado, Worker antes do deploy) acha a de fábrica pelo nome na hora. Editar a condição no meio da luta vale para o próximo selo, como os números da técnica hoje.
- **D3. A tabela por nome vira a fábrica.** `comportamentoDoSelo` mantém a assinatura e devolve a tradução da de fábrica pelo nome; na tabela ficam só as de uma ficha (Imã-Gumelo, Campo de Contenção, Atração, Redoma e Chamas Celestes, pela decisão 12, e a Bênção de uma Raposa, pela linha dela no "onde fica"). "Perde a vez" e "não reage" viram dois (hoje são um, `trava`).
- **D4. O de antes roda como hoje.** Número próprio (selo da técnica: mods, regra, por vez, alcance; `n` do item e da ficha; `fadigaMods` da forma; `regra`, `n` e `gatilho` da criada) continua valendo: por campo, o próprio vence o da condição e o resto vem dela (a Fadiga da forma não soma duas vezes). A tela o mostra como "Regra própria (de antes)" com "Usar só a condição" e "Virar condição nova" (abre o editor já preenchido). Nada sai da ficha sozinho: o site e o Worker não veem o catálogo.
- **D5. O nome continua sendo a chave** (`chaveDaCondicao`), como no selo, na pastilha e no item; aura e contra apontam id do catálogo, resolvido em nome ao congelar. Criada com o nome de uma das 25 novas: a criada vence (como era) e a de fábrica aparece como "(de fábrica)" só para "Usar como modelo". Renomear com uso: aviso com a lista e "Renomear também nos N lugares" (com Desfazer).
- **D6. Quem põe escolhe qual e por quanto**: "o prazo dela" (padrão) ou N turnos; o item mantém "até o fim da batalha" e "até tirarem", que já tem.
- **D7. Pilhas** multiplicam só número fixo do Efeito na vez e do Muda atributo (decisão 4); ganhar pilha não recomeça o prazo (decisão 3). Dois cortes de % de condições diferentes multiplicam, como a batalha já faz (`condicoes.ts:191`), também fora dela (sai o "maior" de `naFicha.ts:176`).
- **D8. Saídas.** Pagar e/ou teste pela regra de `comoMarca.ts`; "Tentar sair" é lembrete na vez dele, no `combate.lembretes` de hoje (vai ao jogador dono e volta pelo pedido `lembrete` de hoje, `net/protocoloDaBatalha.ts:837`; conferir que o filtro do recorte, `vistaDoJogador.ts:791`, deixa passar o id do selo, senão é a E9); teste por turno: o host rola no fim da vez (d20 + mod do rank, como a marca), com linha e Desfazer; NPC e robô pagam se puderem, senão rolam.
- **D9. Aura** só na batalha com mapa: recalcula a cada passo e na troca de vez, pela distância da batalha (`lib/batalha/area.ts:191`), aliados pelo lado da carta; a pega sai fora do raio ou quando a fonte acaba; "passa adiante" sem laço; anel só no mapa do mestre.
- **D10. Bloqueios.** Não pode ser alvo: golpe de um alvo não o escolhe; área pega; ajuda (cura, buff) pode. Não pode se mover: passo 0 pela pastilha (`movementRules.ts:73`), como o Lento; o mestre ainda move. Velocidade = a Agilidade no motor (`atributoNoMotor`, `pecas.ts:92`); CA = o modificador da reação (o sistema não tem CA).
- **D11. Fora da batalha** só vida por vez, gatilho e prazo, com pilhas (como hoje); o resto vale na batalha. O Lento continua andando metade do passo (regra do mapa, não peça) e o cartão diz isso; as 6 pastilhas de sempre mantêm o desenho do mapa.
- **D12. Boneco = o mesmo motor**: a store numa mesa em memória (molde `lib/batalha/ensaio/ensaio.ts:606`), d20 escolhido, 2 a 5 rodadas, refaz 150 ms depois da última mudança; a `simular()` do protótipo é só a resposta esperada.
- **D13. Um editor só** (Livros › Condições, o painel do token e "Virar condição nova" abrem o mesmo); de fábrica não se edita.
- **D14. Fora**: Dragon Ball; as peças Muda atributo e Diminui das habilidades (0.6.5, já o mesmo motor de `mods` e `queda`) ficam como estão.

## 3. O motor: o que já faz e o que é novo

| Peça | Já faz (reaproveitar) | Motor novo | Etapa |
|---|---|---|---|
| Efeito na vez | tira vida no começo, direto, pelo Aplicar/pular (`condicoes.ts:253`, `:320-340`); SP no fim com o dono ganhando (`drenaSp`, `vez.ts:208`); regenera HP ou SP no fim (`vez.ts:196`); vida da regra na ficha (`naFicha.ts:153`) | ao entrar (E3); SP e Escudo no começo; vida no fim; % da vida máxima ou atual; vida pelo Escudo; quem pôs ganha vida; vezes as pilhas (E5) | E3, E5 |
| Muda atributo | `mods` (atributo, dano, reação), `queda` por vez, a partir do turno N, com teto e % no acerto (`selos.ts:186-244`), Cego zera, alcance soma ou teto | "fica em N" e "no máximo N" em qualquer atributo; % de uma vez; ritmo na condição da ficha (`vezes`); vezes as pilhas | E1, E3, E5 |
| Bloqueio | trava (`condicoes.ts:287`), sem Esquiva e Contra (`:243`), reage com desvantagem (`:146`) | perde a vez e não reage separados; não anda; não usa técnica; só ação simples; não pode ser alvo (menu em `components/batalha/dadosDoMenu.ts`, host em `lib/batalha/golpe.ts:530`) | E3 |
| Dano e cura | dano recebido % (`reducaoDoDano.ts:69`), cura recebida % (`condicoes.ts:191`), cura do dano causado (`:167`) | dano recebido de um tipo (o golpe passa a saber os tipos); dano causado % | E3 |
| Depois de X turnos | na condição da ficha (`gatilho.ts:79`) | nos selos da batalha e na Arena, pela mesma conta (`gatilho.ts:56`) | E5 |
| Marca | os campos da marca no selo (`combate.ts:917-926`, `marca.ts:206-257`) | lida da condição em vez do nome | E3 |
| Aura | nada | inteira (D9) | E5 |
| Contra-condição | nada | ao entrar apaga; enquanto durar barra (selo em `comSeloNovo`, `selos.ts:257`; ficha em `porCondicao`) | E3, E5 |
| Prazo e "se ganhar de novo" | turnos, até tirar, até o próximo golpe (`condicoes.ts:136`), até o fim da batalha (ficha); renova (Queimando, ficha) | "nada muda"; pilhas com teto | E3, E5 |
| Saídas | nenhuma (só o mestre tira) | ao receber cura, ao tomar dano de um tipo, ao agir: a regra pura e os pontos do golpe (E3), os da vez e da passiva (E5); teste por turno e pagar e/ou teste (E5) | E3, E5 |
| "Só as negativas" | `seloNegativo` pela natureza (`debuffs.ts:19`) | pelo tipo da condição (a positiva não sai na limpeza) | E3 |

## 4. Ondas e etapas

No máximo 3 escritores por onda, todos na main, sem worktree; dentro da onda os arquivos não se cruzam. "max" = Opus max; "xhigh" = Opus xhigh. Agente: `programador` no motor e nos dados, `programador-frontend` na tela.

| Onda | Etapa | Modelo | Depende de |
|---|---|---|---|
| 0 | E1 Núcleo: modelo, fábrica, tradução e frases | max | nada |
| 1 | E2 Conversão, cópia, o de antes e os usos | max | E1 |
| 1 | E3 Motor do golpe e do selo | max | E1 |
| 1 | E4 Peças, prazo e pastilha na tela | xhigh | E1 |
| 2 | E5 Motor da vez, da ficha, aura e boneco | max | E1, E3 |
| 2 | E6 Editor único e Livros › Condições | xhigh | E1, E2, E4 |
| 2 | E7 Quem põe: técnica, item e batalha | xhigh | E1, E2, E3 |
| 3 | E8 Testes certeiros, prints, verificação e publicação | xhigh | todas |

Max nas quatro porque a E1 define o formato que app, site, jogador e Worker leem para sempre; a E2 é proteção de dado; a E3 e a E5 mexem no coração da batalha (`lib/batalha/golpe.ts` 1799 linhas, `stores/batalha/golpe.ts` 1521, vez, núcleo e passivas), que o Worker também roda. Golpe e vez em ondas diferentes: os stores se chamam uns aos outros (a lição da onda 2 das habilidades).

**E1. Núcleo (onda 0, max, 1 escritor)**
- Arquivos: `lib/condicoes/{modelo,leitura,fabrica,traducao,frasesDaCondicao,montadaDaAntiga}.ts` (novos); `lib/condicoes/catalogo.ts`; `lib/condicaoPorNome.ts` (a de fábrica com pastilha de criada também acende pelo nome, `:44`); `lib/condicoesProprias.ts` (leitor dos campos novos; os 10 desenhos com reserva); `lib/condicoesNoDisco.ts` (versão 2); `types/map.ts` (só o bloco `CondicaoPropria`); `lib/itens/{modelo,leitura}.ts` (`pilhas`, `vezes`, `DuracaoDaPeca`); `lib/batalha/combate.ts` (só tipos); `lib/fogFilter.ts` (só `semARegra`: ao jogador vai só a pastilha); `components/condicoes/editor/registro.ts` (novo: o contrato de cada peça na tela e o do boneco, vazio).
- Faz: o §2 inteiro, D1, a precedência de nome de D5 em `catalogo.ts`, e as frases do cartão, dos avisos, do "o que aparece na batalha", de quem apaga e de quem cita, mais a frase curta dos seletores (`frasePeca`, `fraseSaida`, `frasePrazo`, `avisosDe`, `prototipo.html:716-849`). Tetos: 10 peças, 4 atributos (`MODS_POR_SELO_MAX`, `combate.ts:1130`), 4 saídas.
- Pronto quando: tsc do client (`rtk proxy npx tsc --noEmit`) e do Worker (`-p lobby/nuvem/tsconfig.json`) limpos; a leitura aceita cada família e recusa chave desconhecida; as 35 traduzem sem erro e as 10 de hoje mantêm o id; `montadaDaAntiga` devolve a MESMA referência na 2ª passada; o arquivo só sai versão 2 com campo novo; `fabrica`, `traducao`, `modelo` e `leitura` não importam store, Tauri nem `lib/batalha/condicoes.ts` (o Worker os embute; sem ciclo com `catalogo.ts`); commit só destes caminhos.

**E2. Conversão, cópia, o de antes e os usos (onda 1, max)**
- Arquivos: `stores/conversaoDasCondicoes.ts` (novo, no molde de `stores/conversaoDasHabilidades.ts`); `App.tsx` (a chamada, ao lado da de `:3385`); `stores/condicoesPropriasStore.ts`; `lib/livros/catalogoNoDisco.ts` (a cópia do catálogo, molde `:55`); `lib/condicoes/{legado,usos,renomear}.ts` (novos, puros).
- Faz: a cópia de `condicoes.json`, `rpg.json` e `catalogo.json` com `.antes-condicoes-v2`, uma vez, antes da 1ª gravação; a store grava os campos novos; D4 em `legado.ts` (o número de antes de cada lugar vira peça, para o "Virar condição nova"); "quem põe ou cita" (fichas da pasta, catálogo do livro e outras condições) em `usos.ts`; a troca de nome nos N lugares em `renomear.ts`.
- Pronto quando: tsc limpo; tudo puro e idempotente; nada grava ao abrir além da cópia, que nasce uma vez; todo número de antes vira peça ou "Confira"; commit só destes caminhos.

**E3. Motor do golpe e do selo (onda 1, max)**
- Arquivos: `lib/batalha/{selos,condicoes,reducaoDoDano,golpe,marca,debuffs}.ts`; `stores/batalha/{golpe,selos}.ts`; `components/batalha/{dadosDoMenu,dadosDaFaixa}.ts`; `lib/ponteDasCondicoes.ts`; `lib/movementRules.ts`.
- Faz: D2, D3, D10; congelar ao nascer (o resolvedor na store); os bloqueios no menu e no host; `tipos` em toda criação de golpe (arma, Pergunta, Imbuir; sem tipo = qualquer); dano por tipo e dano causado; marca pela condição; ao entrar: contra, pilhas, "se ganhar de novo" e o Efeito na vez "ao entrar"; as saídas ao receber cura, ao tomar dano de um tipo e ao agir (a regra pura e os pontos do golpe); "só as negativas" pelo tipo; o espelho da ficha pela tradução, com pilhas e vezes (`ponteDasCondicoes.ts:125`; `espelhoEmDia`, `:102`, compara as regras); a pílula com a frase da condição e as pilhas.
- Pronto quando: tsc do client e do Worker limpos; Atordoado, Paralisado, Aéreo, Cego, Sangrando, Queimando e Cura reduzida postos pelo nome fazem o que faziam (o diff da tabela só move linhas para a fábrica); `comportamentoDoSelo` com a mesma assinatura; commit só destes caminhos.

**E4. Peças, prazo e pastilha na tela (onda 1, xhigh)**
- Arquivos: `components/condicoes/editor/pecas/` (novo: as 8 peças com os nomes, ícones, cores e padrões de `PECAS` e `pecaNova`); `components/condicoes/editor/{NomeEPastilha,PrazoESaida}.tsx` (novos); o preenchimento de `registro.ts`; `components/PastilhaDeCondicao.tsx`, `lib/glifoDeCondicao.ts`, `pixi/drawTokenConditions.ts` (10 desenhos, Amarelo e Cinza). Skills do Emil antes da tela (`emil-design-eng`).
- Pronto quando: tsc limpo; cada família tem componente e entrada no registro; nada grava fora de `pecas`, `prazo` e `saidas`; o desenho novo sai igual no editor, no mapa e na tela do jogador; commit só destes caminhos.

**E5. Motor da vez, da ficha, aura e boneco (onda 2, max)**
- Arquivos: `stores/batalha/{vez,nucleo,passivas,formas,condicoesNaFicha}.ts`; `lib/batalha/{condicoesNaVez,aura}.ts` (novos); `lib/condicoes/{naFicha,gatilho,ensaio}.ts` (`ensaio` novo); `lib/batalha/transformacao.ts`; `lib/treino/{duelo,robo}.ts`; `lib/turnoForaDaBatalha.ts`, `stores/turnoForaDaBatalha.ts`; `components/batalha/PassivasDaBatalha.tsx`; `pixi/drawAuras.ts` (novo) e uma linha em `pixi/PixiCanvas.tsx`.
- Faz: o Efeito na vez do começo e do fim (tirar vida no começo segue o "Aplicar / pular"; o resto aplica sozinho, com linha e Desfazer); o ritmo do Muda atributo também na ficha; o gatilho nos selos (a conta de `gatilho.ts` vale para os dois); D8 (teste por turno e "Tentar sair", também na tira do jogador); D9; contra e pilhas na ficha (`porCondicao`); as saídas nos pontos de cura e de dano da vez e da passiva; a Fadiga da forma pela de fábrica (a peça só dá os turnos); a Arena (`duelo.ts`) e o robô (respeita os bloqueios e tenta sair); D11; o motor do boneco (D12, no contrato da E1).
- Pronto quando: tsc do client e do Worker limpos; todo efeito novo entra no registro com Desfazer; a criada de antes (regra vida ou cura) tira e corta o mesmo que antes; o boneco do Envenenado e do Lento chega, no fim de cada rodada, aos totais da `simular()` do protótipo; commit só destes caminhos.

**E6. Editor único e Livros › Condições (onda 2, xhigh)**
- Arquivos: `components/condicoes/editor/{EditorDaCondicao,PapelDaCondicao,OndeAparece,BonecoDaCondicao,ComecarDe}.tsx` e `editor.css` (novos); `components/livros/PaginaCondicoes.tsx`; `components/CondicoesProprias.tsx`; `components/condicoes/{PorCondicao,LinhaDoGatilho,CondicoesDaFicha}.tsx` e `condicoes.css`; `components/{SubmenuDeCondicoes,TokenConditionControls}.tsx`.
- Faz: a tela do protótipo (Começar de; Nome e pastilha; O que ela faz; Prazo, pilhas e saída; Onde aparece; o cartão à direita, clicável; o boneco ao vivo; Desfazer com Ctrl+Z; "Salvar no catálogo" com Ctrl+S); a lista com as 35 e as criadas, busca e filtro por tipo e por peça; de fábrica só "Usar como modelo"; criada: Editar, Usar como modelo e Apagar só sem uso; Quem está com ela e Pôr condição (escolhe qual e os turnos; o `n` de antes fica à vista); o painel e o submenu do token listam o catálogo e abrem o MESMO editor (D13); o aviso de renomear (D5). Skills do Emil antes.
- Pronto quando: tsc limpo; a escolha de regra saiu da tela (`rg "NOMES_DAS_REGRAS|rotuloDoNumero" components` vazio); um editor só (`FormDaCondicao` saiu ou é a casca dele); digitar num número não dá tarefa longa (`ux-driver medir`); commit só destes caminhos.

**E7. Quem põe: técnica, item e batalha (onda 2, xhigh)**
- Arquivos: `components/batalha/editor/pecas/{controlesDaPeca.tsx,vocabulario.ts,PecaTransformacao.tsx}`; `components/batalha/blocos/PecasDoSelo.tsx`; `components/batalha/SeloDialog.tsx`; `components/ItemDoCatalogoDialog.tsx` (só a peça Condição e a lista, `:388-442` e `:511`); `components/batalha/editor/requisitosDoCartao.ts`; `lib/batalha/mecanica/{resumo,textoGerado}.ts`.
- Faz: todo seletor lista o catálogo (no app, fábrica e criadas; no site e no jogador, as de fábrica) com a frase curta; escolhe só qual e os turnos (D6); o número de antes como "Regra própria (de antes)" (D4); a Transformação só com os turnos da Fadiga; o texto da técnica e do item diz o nome e põe a frase da condição no título.
- Pronto quando: tsc limpo; nenhum seletor em `components` usa `CONDICOES_DAS_PECAS`, `SELOS_PRONTOS` ou `SELOS_COM_REGRA` (`rg`); o item não pede mais o número da regra fora do "de antes"; os ramos arma e item do editor de habilidade sem mudança de comportamento; commit só destes caminhos.

**E8. Testes certeiros, prints, verificação e publicação (onda 3, xhigh, 1 escritor)**
- Arquivos: só `.test.ts(x)` novos e `docs/design/condicoes-rework/provas/`. Cada teste visto vermelho uma vez (um número quebrado de propósito).
  1. **Nada some (núcleo)**: as criadas de antes (vida 5, cura 50, narra, com gatilho) leem como montadas e dão na batalha o mesmo de antes (−5 pelo Aplicar; cura 40 chega 20); a 2ª leitura é a mesma referência; postos pelo nome, Atordoado (só Passar a vez, sem reação), Aéreo (sem Esquiva e Contra), Cego (Percepção 0) e Cura reduzida (−50%) fazem o mesmo; a criada "Congelado" de antes vence a de fábrica; o arquivo gravado sai versão 2, e arquivo de versão maior que a do app é recusado sem gravar por cima (a regra que protege o app de antes).
  2. **Pilhas, contra e teste por turno, na batalha** (`stores/batalhaFabrica`): Hector com Queimando ganha Molhado e o Queimando sai; um Queimando novo é recusado; Envenenado duas vezes dá 2 pilhas, o Aplicar tira 6 e a cura 40 chega 20; com o d20 fixo dando 12 no total, passa no teste de Resistência CD 12 no fim da vez e sai; Congelado: golpe de Impacto 30 chega 45, e um de Fogo o tira.
  3. **Bloqueio, ritmo e sair pagando**: Lento (−10 de Velocidade por vez, teto 30, só ação simples): a Agilidade 40 vai a 30, 20, 10 e fica em 10, e o menu recusa a Completa; Silenciado: técnica recusada no menu e no host, "Tentar sair" com 20 SP sai e, sem SP, rola Espírito CD 13; Enraizado: o passo do jogador é 0 e só sai pagando a ação simples e passando em Força CD 15.
- Depois: a suíte inteira uma vez (fora as vermelhas conhecidas); tsc do client, do site e do Worker; 3 prints no PC (editor com peças e boneco; Livros › Condições com as 35 e o filtro; batalha com pilhas, aura e a frase na pílula); uma jornada só por cliques (Livros › Condições, "Usar como modelo" no Congelado, mudar um número e ver o boneco mudar, Salvar, pôr a cópia no "Se acertar" de uma técnica, acertar na batalha e ver a pílula); `ux-driver medir` no editor e na batalha (nenhuma tarefa longa de 200 ms ou mais); `verificador-realidade` item por item contra o pedido de 27/11 11:51, as 13 decisões e as 23 linhas do "onde fica"; publicar a 0.6.7 com `node scripts/publicar-versao.cjs --publicar` (Worker, depois Pages, depois o release); avisar o dono para atualizar o app em todos os PCs.
- Pronto quando: os 3 testes e a suíte passam; os prints estão em `provas/`; o verificador não acha item faltando; a 0.6.7 está publicada.

**E9. Só se a E8 pedir (isolada, marcada).** Se o navegador do jogador precisar de um dado que hoje não chega (pilhas na pastilha dele, bloqueio de condição criada no menu dele, o id do selo no lembrete), uma etapa sozinha mexe em `lib/batalha/vistaDoJogador.ts` e `net/protocoloDaBatalha.ts`, depois que a outra sessão fechar `net/protocol.ts`.

## 5. Worker e `net/protocol.ts`

- **O Worker sai junto? Sim, só o deploy.** Ele embute o motor (`lobby/nuvem/src/duelo.ts` e `luta.ts` puxam `lib/treino/duelo.ts`); nenhum arquivo de `lobby/nuvem/src` muda. Com o deploy, Arena e duelo ganham as 35, os bloqueios, as pilhas, as saídas e o gatilho nos selos; sem ele, seguem a tabela velha (não quebra, só não automatiza). A criada não existe no Worker (o catálogo mora na pasta do app): na Arena ela vale pelo nome, como hoje um nome fora da tabela. `VERSAO_DO_MOTOR_DA_LUTA` (`lib/treino/luta.ts:71`) não sobe: o estado só ganha campos opcionais.
- **Algo exige `net/protocol.ts`? Não**, nem `net/protocoloDaBatalha.ts`. A regra nova do selo é só do host (`regras`, como `porVez` e `regra`); o jogador acha as de fábrica pelo nome no próprio navegador (o mesmo código) e o host recusa o resto com o motivo; "Tentar sair" usa o lembrete e o pedido de hoje (D8); a pastilha nova vai no `condicoesProprias` de hoje. Se faltar dado no jogador, é a E9.

## 6. Regras para os escritores (main, sem worktree)

1. Antes de cada onda: `git status` (não pegar arquivo da outra sessão: hoje `net/protocol.ts` e `stores/batalha/ordem.ts`, fora de todas as etapas) e o disco (piso de 8 GB).
2. Cada etapa escreve só nos arquivos dela; arquivo novo nasce na pasta dela. Precisou de outro: anota no relatório e não edita (o orquestrador junta em `PENDENCIAS.md` desta pasta).
3. Commit só dos próprios caminhos (`git commit -- <caminhos>`), mensagem curta em inglês, com a linha de autoria.
4. Erro de `tsc` fora dos próprios arquivos é de outra etapa em curso: ignorar. O tsc limpo do client, do site e do Worker é conferido no fim de cada onda, antes da seguinte.
5. Nenhum teste novo antes da E8; nada publicado antes da E8.
6. Fora de todas as etapas: `lobby/nuvem/src`, `net/protocol.ts`, `net/protocoloDaBatalha.ts`, `stores/batalha/ordem.ts`, `lib/dbt`, `components/dbt`, `components/EfeitoDaArmaCampos.tsx`, os ramos arma e item do editor de habilidade e as peças Muda atributo e Diminui das habilidades.
7. Função exportada que outra etapa usa não muda de assinatura (`comportamentoDoSelo`, `travaDosSelos`, `criarSelo`, `porCondicao`, `curaComAsCondicoes`, `condicaoDoCatalogoPeloNome`): acrescentar, nunca trocar.
8. Nos prompts dos agentes, código entre aspas simples (crase fecha o script do Workflow); skills do Emil antes de tela (E4, E6, E7).
9. HANDOFF.md, `PENDENCIAS.md` e um diagrama novo (`docs/diagrams/condicoes.html`: regra, estado e motor, com a linha no INDEX) são do orquestrador, no fim de cada onda.

## 7. Riscos

1. **Regra nova em selo já posto pelo nome.** As 25 novas e as 5 que saem da tabela dão regra a selos que hoje só narram (Congelado, Eletrizado, Envenenado e Enfraquecido das peças da 0.6.5; o Lento por turno; o "Marcado" posto à mão vira marca de dano dobrado de verdade; o Queimando passa pelo Escudo). É o pedido (decisão 9), mas muda batalhas em curso. Contra o efeito ruim: a criada de mesmo nome vence (D5), o número de antes vence por campo (D4) e o teste 1 prende as de hoje.
2. **Perda de dado no app de antes.** O leitor da criada e o da ficha guardam só as chaves que conhecem: o app de antes regravaria `condicoes.json` sem as peças. Proteção: versão 2 (o de antes recusa ler e gravar), a cópia `.antes-condicoes-v2` e o desenho novo com o de reserva no `simbolo` (sem ele a pastilha some no app velho e no mapa aberto noutro PC).
3. **Motor acoplado e Worker.** A E3 e a E5 mexem no coração da batalha que o Worker também roda: um dono por onda e o tsc do Worker em cada uma. O golpe ainda não sabe o próprio tipo (`GolpeDaBatalha`, `combate.ts:691`, só `perfurante`): "dano de um tipo" e "sai com fogo" dependem do `tipos` posto em TODA criação de golpe; o que escapar conta como "qualquer".
4. **A criada fora do app.** Site e Worker não veem o catálogo da pasta: a Arena trata a criada só pelo nome e o navegador do jogador não sabe os bloqueios dela (o host recusa com o motivo). E9 se a E8 pedir.
5. **Tetos.** 4 mods por selo (`combate.ts:1130`), 8 selos por ficha (`:1126`; aura e gatilho somam), 6 pastilhas criadas por ficha (`condicoesProprias.ts:348`; as 29 de fábrica sem desenho de mapa contam nele) e 40 criadas (`:350`; "Usar como modelo" enche): o editor avisa antes de salvar.
6. **Velocidade e CA.** Velocidade é a Agilidade no motor: o Acelerado de fábrica (+15 de Velocidade e +10 de Agilidade) dá +25 de Agilidade; o editor avisa quando uma condição mexe nas duas.
7. **Boneco ao vivo.** A store roda a cada mudança: medir na E8; se passar de 200 ms, roda ao sair do campo.

## 8. O que o dono vai perceber, por onda

- Onda 0: nada na tela.
- Onda 1: as de fábrica postas pelo nome já fazem na batalha o que o cartão diz (bloqueios, pilhas, contra, saídas por cura, dano e ação); a pastilha com 10 desenhos novos; o editor ainda é o de hoje.
- Onda 2: Livros › Condições nova (as 35 de fábrica e as suas, busca, filtros, editor com peças, cartão e boneco ao vivo); escolher a condição em técnica, item e "Pôr selo…" pela lista; na batalha, Efeito na vez, gatilho, teste por turno, "Tentar sair" e aura.
- Onda 3: a 0.6.7 publicada (app, site e Worker), com as provas e os prints em `docs/design/condicoes-rework/provas/`.
