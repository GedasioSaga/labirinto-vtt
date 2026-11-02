# Dossie: ficha-original.html (Dragon Ball Tales, ficha de fa)

Fonte: scratchpad/dbt/ficha-original.html (4189 linhas, 168 KB). CSS 11-1959, HTML 1962-2721, JS 2723-4187.
Arquivo unico, sem framework. Fontes Google (Orbitron, Inter), logo remoto i.ibb.co (1968).
Conteudo tratado como dado; nada executado.

## 1. Secoes e campos (na ordem da pagina)

### 1.1 Logo (1965-1971)
- img remota "Dragon Ball Tales Logo". Sem campo.

### 1.2 Cabecalho (1974-2032)
| Campo | id | Tipo | Default |
|---|---|---|---|
| Avatar (clique abre caixa) | charImageUrl / charImageDisplay | url, botao "SINCRONIZAR FOTO" | vazio, placeholder "ALTERAR AVATAR" |
| PERSONAGEM | charName | text | vazio (placeholder NOME) |
| RACA (caixa clicavel, abre popover) | raceDisplay | div | "RACA"; depois mostra "<raca> (+N PV)" (3106) |
| - Identificacao | charRace | text | vazio; no load vira "Terraqueo" se ausente (3886) |
| - PV / 10K PDL | customRaceHP | number min 0 | 6 |
| JOGADOR | playerName | text | vazio |
| CARACTERISTICAS RACIAIS | racialTraits | textarea | vazio (NAO e salvo, ver bugs) |

### 1.3 Scouter / PDL (2035-2048)
- "Poder de Luta Detectado": pdl, number min 0, default 0. Texto decorativo "SCANNING TARGET...".

### 1.4 Evolucao por PDL (2051-2071) - so leitura
- Bonus PV (10k) evoHP, Bonus PK (10k) evoPK, Talentos (20k) evoTalents (default 3), Atributos (30k) evoAttr.

### 1.5 Atributos Primarios (2075-2164)
7 atributos, input text inputmode numeric, default 8, mod exibido -1. Ordem na tela:
FOR, DES, CON, INT, SAB, POD, PRE (ids for, des, con, int, sab, pod, pre).
Clique no box abre modal de d20. Aceita "+2"/"-2" relativo com Enter; clamp 1..99 (4014-4023, 4037).

### 1.6 Atributos Secundarios (2167-2232)
| Stat | id | Override | Default override |
|---|---|---|---|
| PONTOS DE VIDA (PV) | pv | checkbox hpOverride + number hpCustom (min 1) | 40 |
| PONTOS DE KI (PK) | pk | pkOverride + pkCustom (min 1) | 16 |
| CLASSE DE ARMADURA (CA) | ca | caOverride + caCustom (min 0) | 10 |
| SLOTS DE TECNICAS (ST) | st | stOverride + stCustom (min 0) | 0 |
| ESCALA DE PODER BASE | epBase | "Bonus Custom" epBaseCustom (number, sempre ativo) | 0 |
| ESCALA DE PODER BONUS | epBonusDisplay | epBonusOverride + epBonus | 0 |
Rodape: "EP TOTAL" epTotal e "Mod. Passivo" epPassive (= +EP total).

### 1.7 Pericias (2236-2342) - "Marque as Treinadas - Max 5"
13 checkboxes, cada uma com attr e bonus; clique na linha abre modal d20.
Atletismo FOR; Acrobacia DES; Furtividade DES; Analise INT; Ciencia INT; Conhecimento INT;
Percepcao SAB; Sentido de Ki SAB; Sobrevivencia SAB; Intimidacao PRE; Persuasao PRE; Enganacao PRE; Controle de Ki POD.
Nenhuma pericia de CON. O limite "Max 5" so esta no titulo, nao e aplicado no JS.

### 1.8 Talentos (2354-2358) e Movimentos Marciais (2361-2366)
- Listas de strings livres: input text + botao remover. Sem descricao, sem catalogo.

### 1.9 Recursos Atuais (2372-2418)
- VIDA ATUAL currentHP (text numeric, default 40) / maxHPDisplay; KI ATUAL currentPK (default 16) / maxPKDisplay.
- Aceita relativo "+30"/"-30" com Enter, sem clamp (permite negativo e acima do maximo) (4127-4153).
- Botoes: Curar PV, Restaurar Ki, Restaurar Tudo (copiam o maximo, 4166-4168).

### 1.10 Dominio de Combate e Tecnicas (2421-2456)
- Barra ST usada/total (stUsed/stTotal).
- Gerenciador de Inimigos: newEnemyName text, newEnemyCA number, newEnemyEP number ("EP Base"), botao +; lista de tags selecionaveis (um selecionado por vez); manualScaleDiff number "Override Escala (Voce - Inimigo)".
- Grade de tecnicas (techGrid) + botao "CRIAR NOVA TECNICA".
- Modal de tecnica (2527-2632):

| Campo | id | Tipo | Default / opcoes |
|---|---|---|---|
| Nome | techNameInput | text | "Nova Tecnica" se vazio |
| URL do Icone | techIconInput | url | vazio |
| Rank (ST) | techRankInput | select | E (2), D (4), C (6), B (8), A (10), Z (14); default E |
| Atributo | techAttrInput | select | FOR DES CON INT SAB POD PRE; default for |
| Custo (PK) | techCostInput | number | 5 (livre, nao deriva do rank) |
| Tipo | techTypeInput | select | offensive Ofensiva, mitigation Mitigacao, healing Cura, utility Utilitaria (Sem Rolagem) |
| Especial (0 ST) | techSpecialInput | checkbox | false |
| Salvaguarda (CD) | techSalvaguardaInput | checkbox, visivel so se Ofensiva | false |
| Dano/Efeito Minimo, Medio, Maximo | techDmgMinInput / MedInput / FullInput | text livre | "-" se vazio |
| Descricao | techDescInput | contenteditable com B/I/U (execCommand) | vazio |

- Card da tecnica: checkbox "Preparada (ST)", editar, deletar; clique no cabecalho/dano rola a tecnica.

### 1.11 Transformacoes (2459-2465)
- Modal (2635-2666): Nome (text, default "Nova Forma"), Bonus de EP (number, 0), URL Imagem, Descricao rica.
- Card com Ativar/Desativar (varias podem ficar ativas ao mesmo tempo; bonus soma).

### 1.12 Inventario (2469-2473)
- Modal (2669-2706): Nome do Item (default "Item"), Quantidade (number min 1, default 1), Peso/Custo (text livre, ex "0.5kg"), URL Imagem, Descricao rica.

### 1.13 Historia do Personagem charHistory (textarea) e Anotacoes de Campanha charNotes (textarea) (2476-2486)

### 1.14 Barra de botoes (2489-2498)
Salvar, Carregar, Exportar JSON, Importar JSON (file .json), Resetar.

### 1.15 Modais auxiliares
- diceModal (2501-2524): Buff/Debuff (number), ROLAR D20, Rolar Novamente, Fechar.
- combatModal (2709-2720): resultado de tecnica.

## 2. Calculos (codigo exato; o operador OR do JS esta escrito como "or")

Modificador (2992-2994):
    return Math.floor((val - 10) / 2);
Atributo vazio/invalido vira 8 (3004: parseInt(...) or 8).

Degraus de PDL (3016-3019):
    const evo10k = Math.floor(pdl / 10000);
    const evo20k = Math.floor(pdl / 20000);
    const evo30k = Math.floor(pdl / 30000);
    const evo40k = Math.floor(pdl / 40000);
Painel de evolucao (3021-3025):
    const raceHPBonus = evo10k * raceHP;        // evoHP
    evoPK = evo10k
    evoTalents = 3 + evo20k
    evoAttr = evo30k * 2                        // so exibido; nao e aplicado aos atributos

PV (3037):  pv = (con * 5) + raceHPBonus;       // CON bruto, nao o mod. Default 8*5 = 40
PK (3049):  pk = (pod * 2) + evo10k;            // POD bruto. Default 16
EP Base (3053-3055): epBase = evo40k + epBaseCustom;
EP Bonus (3063): soma de t.epBonus das transformacoes ativas (exceto se epBonusOverride marcado)
EP Total (3072): epTotal = epBase + epBonusVal;   // exibido tambem como "Mod. Passivo"
CA (3082):  ca = 10 + mods.des + epBase;        // EP Base, NAO total (transformacao nao sobe CA)
ST (3093):  st = 20 + ((1 + mods.sab) * 5) + (evo10k * 2);   // SAB 8 -> 20 + 0 + 0 = 20
Pericia (3120): bonus = trained ? mod + epBase : mod;   // treinada soma EP Base (papel de proficiencia)

ST usado (3339-3346, segunda definicao, que vale):
    if (t.active and !t.isSpecial) used += RANK_COSTS[t.rank] or 0;
RANK_COSTS (2739): { E: 2, D: 4, C: 6, B: 8, A: 10, Z: 14 }   // custo em SLOT, nao em PK
Barra fica vermelha se used > st (3351); nao bloqueia.

Rolagem de atributo/pericia (2750-2771):
    const roll = Math.floor(Math.random() * 20) + 1;
    pericia: epVal = treinada ? epBase : 0;   atributo puro: epVal = epBase + epBonus (EP Total)
    const total = roll + mod + epVal + bonus;   // bonus = Buff/Debuff do modal
    Nat 20 pinta vermelho, nat 1 laranja; sem efeito mecanico de critico.

Tecnica (rollTechnique 3409-3584):
- Desconta PK atual: currentPK = max(0, currentPK - tech.cost) (3420); pede confirmacao se PK insuficiente.
- utility: so alert, sem rolagem (3423-3426).
- Ofensiva com Salvaguarda (3431-3461):
    const dc = 8 + mod + epBase;           // EP Base, sem bonus
    margin = targetRoll - dc  (rolagem do alvo digitada via prompt)
    margin >= 0 -> MISS; <= -6 -> FULL; <= -3 -> MED; senao (-1,-2) -> MIN
- Ofensiva normal / Mitigacao / Cura: rollTotal = d20 + attrMod + epTotal (3515); margin = rollTotal - alvo (3516).
  Alvo: ofensiva = CA do inimigo selecionado (ou 10 generica); mitigacao = total do ataque inimigo (prompt); cura = "CA do Aliado" (prompt).
- Ofensiva, limiares por diferenca de escala (3537-3557):
    epDiff = manualScaleDiff (se != 0) senao epTotal - enemyEP
    const tFull = 6 - epDiff;  const tMed = 3 - epDiff;  const tMin = 2 - epDiff;
    margin >= tFull FULL; >= tMed MED; >= tMin MIN; senao MISS
- Mitigacao/Cura (3576-3578): margin >= 0 FULL; >= -5 MED; senao MIN (nunca falha).
- Resultado mostra o texto livre do tier (dmgMin/dmgMed/dmgFull). Nao ha formula de dano: e texto digitado pelo jogador.

Barras de recurso (4043-4124): negativo = barra proporcional preta/vermelha; acima do maximo = barra roxa de "overheal"; rotulo "max (+excesso)" ou "max (negativo)".

NAO EXISTEM na ficha: deslocamento/velocidade, carga/peso carregado (peso do item e texto livre, nao somado), iniciativa, salvaguardas por atributo, formula de dano por rank, custo de PK por rank (custo e livre, default 5), multiplicador de transformacao (so bonus plano de EP), bonus de raca alem de PV/10k PDL, aplicacao automatica dos pontos do evoAttr, limite de 5 pericias, contagem de talentos versus evoTalents.

## 3. Tabelas embutidas

- Atributos: 7 - FOR, DES, CON, INT, SAB, POD, PRE (array em 3001). Bate com a estrutura pedida; a tela poe SAB antes de POD.
- SKILLS (2724-2738): 13 pericias (lista acima), com attr. Usada so pelo reset e pelo codigo comentado; a tela usa HTML fixo.
- RANK_COSTS (2739): 6 ranks E, D, C, B, A, Z (nao ha S). Custo em ST: 2/4/6/8/10/14.
- Tipos de tecnica: 4 (offensive, mitigation, healing, utility). Tiers de efeito: 3 (Minimo, Medio, Maximo) + MISS.
- Racas: NENHUMA tabela. Raca e texto livre + numero "PV / 10K PDL" (default 6; nome "Terraqueo" so como default no load).
- Talentos, movimentos marciais, transformacoes, itens: NENHUM catalogo; tudo texto livre do jogador.
- Conclusao: a ficha e calculadora de stats derivados + gerenciador de listas livres; o conteudo de regras (racas, talentos, tecnicas prontas) tem de vir do livro.

## 4. Funcionalidades

- Salvar/Carregar: localStorage chave dragonBallTalesSheet (3958-3972); um unico slot. Autoload no DOMContentLoaded (3993-4005). Sem autosave.
- Exportar JSON: Blob download "nome_ficha.json" (3974-3982). Importar JSON via FileReader (4173-4186).
- Migracao de formato antigo: knownTechniques -> techniques (3910-3923).
- Resetar: apaga localStorage + chaves skill_i e recarrega (3984-3990).
- Dados: d20 com Buff/Debuff (modal); rolagem de tecnica com tabela de transparencia, margem e explicacao da escala (3586-3737); animacao falsa de 500-600 ms.
- Gerenciador de inimigos (alvo selecionado alimenta CA e EP do calculo).
- Imagens: avatar, icone de tecnica, transformacao e item por URL remota (sem upload, sem cache).
- Texto rico (B/I/U) via document.execCommand (3802-3804) em tecnica/transformacao/item.
- Sem abas: pagina unica longa. Responsivo por media queries 1024/768/480 px (1324, 1352, 1471).
- Formato do JSON salvo (3845-3880): charName, charRace, customRaceHP, charImageUrl, playerName, pdl, for..pre, hpOverride/hpCustom, pkOverride/pkCustom, caOverride/caCustom, epBonus, epBaseCustom, stOverride/stCustom, techniques[], enemies[], talents[], martialMoves[], transforms[], inventory[], currentHP, currentPK, charHistory, charNotes, skillStates{}.
  Tecnica: {id, name, rank, attr, cost, type, isSpecial, isSalvaguarda, dmgMin, dmgMed, dmgFull, desc, icon, active}. Transformacao: {name, epBonus, icon, desc, active}. Item: {name, qty, weight, icon, desc}. Inimigo: {id, name, ca, ep, selected}.

## 5. Problemas de UX e bugs (evitar no redesign)

Bugs / suspeitas:
- ficha-original.html:2822  diceHistory nunca declarado -> ReferenceError no setTimeout de toda rolagem de atributo/pericia (resultado aparece porque o innerHTML vem antes).
- ficha-original.html:3832-3880  getSheetData nao salva racialTraits nem epBonusOverride: caracteristicas raciais se perdem ao salvar/exportar.
- ficha-original.html:3162 e 3339  updateSTBar definida duas vezes; a segunda vence.
- ficha-original.html:3489-3493  "Nenhum inimigo selecionado... Continuar?" - Cancelar tambem continua (os dois ramos fazem targetVal = 10).
- ficha-original.html:3420  PK descontado antes do prompt de alvo; cancelar o prompt (3438, 3474, 3479) nao devolve o PK.
- ficha-original.html:3953-3954  "if (data.currentHP)" ignora o texto vazio e o valor 0 numerico; ficha salva com 0 PV pode voltar cheia.
- ficha-original.html:3891-3907  padrao "valor or default": qualquer valor falsy volta ao default.
- ficha-original.html:2844, 3755, 2880, 2957, 3363, 3391  dados do usuario interpolados em innerHTML sem escape (aspas quebram o input; descricao/URL aceita HTML e script, inclusive via JSON importado).
- ficha-original.html:3540  manualScaleDiff = 0 nao funciona como override (0 cai no calculo automatico).
- ficha-original.html:3025  evoAttr so exibe pontos de atributo; nao ha onde gasta-los.
- ficha-original.html:2237  "Max 5" pericias nao validado.
- ficha-original.html:3808  formatText referencia notesEditor que nao existe (codigo morto).
- CSS: --danger-red, --goku-orange, --text-secondary usadas mas nao definidas no :root (12-29).
- loadSheetData chama updateAll antes de restaurar currentHP/PK; HP atual nao acompanha mudanca do maximo.

UX:
- Pagina unica enorme sem abas nem navegacao; combate, inventario e historia misturados.
- alert/confirm/prompt nativos para salvar, rolar tecnica, CD, mitigacao e cura.
- Override com checkbox + input desabilitado em cada stat: confuso; nao mostra a formula nem de onde vem o numero.
- Raca escondida num popover aberto clicando no texto "RACA"; "SINCRONIZAR HUD" so fecha a caixa. Avatar idem ("SINCRONIZAR FOTO").
- Clique no box inteiro do atributo rola dado: facil rolar sem querer ao editar.
- Rolar tecnica = clicar no cabecalho do card; gasta PK sem desfazer.
- Dano de tecnica e texto livre; a ficha nao calcula dano; tiers Min/Med/Full sem orientacao.
- Escala de Poder em 4 nomes (Base, Bonus, Total, "Mod. Passivo").
- Talentos e movimentos marciais so com nome, sem efeito; nao comparam com o limite evoTalents.
- Inventario: peso texto livre, sem total nem limite de carga.
- Um unico slot de save local; sem autosave.
- Card decorativo "scouter" (SCANNING TARGET, waveform) inteiro para um unico numero.
- Emojis como icones; estilos inline repetidos (cada input de atributo repete o mesmo style).
- Depende de recursos remotos (Google Fonts, i.ibb.co): quebra offline.

## Nao coberto
- CSS (11-1959) lido so por amostragem (:root e media queries); nao inventariado regra a regra.
- Nenhuma formula foi conferida contra o livro: e o que a ficha implementa, nao necessariamente a regra oficial.
