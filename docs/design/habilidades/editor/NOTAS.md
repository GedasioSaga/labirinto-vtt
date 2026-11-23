# Editor de habilidade: notas do protótipo

Protótipo: `docs/design/habilidades/editor/prototipo.html` (arquivo único, abre direto no navegador).
Pedido do dono em 23/11/2026, literal no `PEDIDOS.md`: Ataque só com Ataque Simples, Ataque Completo e Overload; um "tipo do golpe" (impacto, perfurante, cortante, ou um golpe que causa veneno, congelamento, queimadura...); uma categoria de alcance (linha, círculo, tamanho, tudo personalizável). Depois: "o protótipo é tudo isso", ou seja, o cartão inteiro, sem nenhum lugar dizendo uma coisa e outro dizendo outra. Depois: os acumuladores genéricos (somar, exigir e gastar).

## As 3 direções que pensei

### A. Assistente em passos

```
[1 Ação] > [2 Golpe] > [3 Alcance] > [4 Dano] > [5 Custo] > [6 Pronto]
+------------------------------------------+
|  Que tipo de ação é?                     |
|  ( ) Ataque Simples  ( ) Completo  ...   |
|                         [Voltar] [Seguir]|
+------------------------------------------+
```

- A favor: impossível se perder; ótimo para a primeira habilidade.
- Contra: para mudar só o custo, o mestre anda por 5 telas. Ele edita muito mais do que cria, e não vê o resultado inteiro enquanto escolhe. Esconde a relação entre as partes (o tipo do golpe muda o que o alcance pinta).

### B. Cartão que se edita no lugar

```
+--------------------------------------+
| CAÇA AS BRUXAS!                      |
| [Ataque Completo] de [fogo]: [1      |
| inimigo] a até [10 casas]. Dá        |
| [Espírito + 15 + 20] (70)...         |
+--------------------------------------+
   (cada [pedaço] abre um balão)
```

- A favor: o cartão é a própria tela; muito bonito, e o que se vê é o que sai.
- Contra: as escolhas ficam escondidas dentro de balões; ninguém descobre que existe "Cruz" ou "Anel" sem clicar em tudo. A frase muda de tamanho a cada escolha e os balões pulam de lugar. Teclado e leitor de tela ficam ruins.

### C. Dimensões com o cartão vivo ao lado (a escolhida)

```
+---------------------------------------+----------------------+
| Nome / Descrição                      | Como fica no cartão  |
|---------------------------------------|  (papel, frase viva, |
| Ação      [Simples][Completo][Overl.] |   pedaço clicável)   |
|           [Apoio][Reação][Passiva]    |----------------------|
| Golpe     Como bate: Impacto Cortante |  Alcance no mapa     |
|           O que causa: Fogo Gelo ...  |  (grade 13x13)       |
| Alcance   [10 formas] + tamanho       |----------------------|
| Dano      fórmula com botões = 70     |  Testar no boneco    |
| Acerto / Efeitos / Custo / Requisitos |  (passos numerados)  |
| Evolução / Jogadores / Campos extras  |                      |
+---------------------------------------+----------------------+
```

- A favor: tudo à vista; cada dimensão responde uma pergunta só ("como bate?", "onde pega?", "quanto tira?"); a frase, o mapa e o teste mudam a cada clique. Clicar num pedaço da frase leva até a dimensão dele, então a vantagem da direção B fica.
- Contra: é uma tela longa. Por isso a frase fica fixa à direita e serve de índice.

Ganhou a C, com a frase clicável da B. Ela segue o editor aprovado de hoje (coluna de edição + coluna do teste) e o protótipo dos requisitos, então não parece outro app.

## Ação

- **Ataque**: Ataque Simples, Ataque Completo, Overload. Overload trava o resto sozinho: não erra (só outra Overload defende), 1 vez por batalha, gasta a vez inteira. Bônus, Livre e "perguntar na hora" continuam existindo, num link discreto abaixo ("Gasta a Bônus, a Livre ou pergunta na hora?"), porque fichas de hoje usam.
- **Sem ser ataque**: Apoio (cura, buff, escudo num aliado; ninguém reage), Reação (no lugar do d20, com a defesa: anula, fica com %, rola, devolve), Passiva (ainda sem peças: o app lê a descrição, como hoje; só os requisitos dizem quando liga).
- A antiga categoria "Condição" virou **Ataque sem dano com um tipo** (ex.: Impacto com teste = atordoar). Não precisa de categoria própria.

## Tipo do golpe: o que cada um faz

Duas fileiras: **como bate** (escolhe um) e **o que causa** (até 3 condições no mesmo golpe, o teto de hoje). Cada tipo vem com uma regra que dá para mudar e escolher quando pega: sempre que acertar, com teste (atributo e CD), ou "só o tipo, sem efeito" (só dá nome ao golpe, como o Caça às Bruxas, que é de fogo mas não queima).

| Tipo | O que faz (padrão) | No app |
|---|---|---|
| Impacto | Teste de Resistência CD 12; falhou, Atordoado 1 vez (perde a vez, não reage). Empurrar N casas: lembrete ao mestre | já existe (Atordoado) |
| Cortante | Sangrando 3 vezes: -10 de HP por vez, direto | já existe |
| Perfurante | X% do dano passa o Escudo (padrão 100%) | já existe |
| Queimadura | Queimando 3 vezes: -10 de HP por vez; acertar de novo renova | já existe |
| Veneno | Envenenado 3 vezes: -10 de HP por vez e a cura recebida cai pela metade | selo novo, peças de hoje |
| Congelamento | Teste CD 12; Congelado 2 vezes: reage com desvantagem e alcança 2 casas a menos | selo novo, peças de hoje |
| Choque | Eletrizado 2 vezes: -10 de SP por vez | selo novo, peças de hoje |
| Cegueira | Teste CD 12; Cego 2 vezes: Percepção 0 | já existe |
| Enfraquecer | Enfraquecido 2 vezes: Força -20, Dano -10 | já existe (buff/debuff) |
| Outro | Selo com o nome que quiser, duração e dano por vez | já existe |

## Alcance

10 formas, com o desenho aprovado (azul = dá dano, verde claro = não dá dano) e a grade 13x13: alvo até N, linha reta, em volta, quadrado à frente, cruz, leque, anel (só longe), área num ponto, área numa ficha, só em quem usa. Cada forma diz o tamanho em frase ("cai num ponto a até 6 casas e pega 2 em volta (5x5)"). Direção pelas setas; clique no mapa põe o boneco ou o ponto.

## Uma fonte só para o cartão inteiro

Regra do dono: nada pode dizer uma coisa num lugar e outra em outro.

| Campo do cartão de hoje | Onde mora agora |
|---|---|
| Nome | Nome (o mesmo) |
| Descrição | Descrição: texto livre, só para ler; o app não lê |
| Ação | dimensão Ação |
| Tipo ("pela Ação") | sai sozinho: Ativa, Buff, Debuff, Reação, Passiva (etiqueta "Tipo na batalha") |
| Efeito | a frase do papel, gerada das escolhas |
| Custo | dimensão Custo (SP, por vez mantida, item da mochila) |
| Tempo | dimensão Custo (espera N rodadas, ou usos por batalha, ou Overload) |
| Dano + Fórmula/Personalizado | dimensão Dano: fórmula com os botões de atributo (com o valor da ficha), Dano da Arma, % da vida do alvo, + − × ÷ ( ) e "O app calcula sozinho = N" |
| Campos extras / Opção | Campos extras (a Evolução ganhou lugar próprio) |

"O que o app escreve nos campos de texto" (abaixo do papel) mostra o que vai para os campos antigos, para o app de antes e o site do Lobby continuarem lendo. Não dá para editar ali, de propósito.

## Acumuladores (Polaridade, Fúria, Cargas...)

O acumulador em si (nome, máximo, como sobe e cai, o que cada nível dá) se cria no editor de acumulador, tela 8 do `docs/design/habilidades/requisitos/prototipo.html`; este editor só liga a técnica a ele, de três jeitos:

- **somar**: Efeito "Somar num acumulador" ("+1 Polaridade"), ao usar ou só se acertar; para no máximo;
- **exigir**: requisito A4 "Nível de um acumulador" (Polaridade 2);
- **gastar**: o mesmo A4 com "e gasta".

O teste mostra os três: Chuva pede Polaridade 2, gasta (2 → 0), e um "+1 Polaridade" posto como efeito soma depois (0 → 1). O bônus de dano por nível (+10 por nível da Polaridade) entra no teste, fora da fórmula.

## Modelos de antes

Os 22 modelos continuam em "Começar de um modelo", agora como pontos de partida: cada um preenche Ação, Golpe, Alcance, Dano, Acerto, Efeitos e Custo; nome, descrição e requisitos ficam. Dá para desfazer (botão no aviso e Ctrl+Z).

## O que é de mentira no protótipo

- O "Testar no boneco" é um motor de mentira escrito no protótipo, com as regras de hoje (reação 10/15/20, Escudo antes do HP, perfurante, selos, Concentração). Não é o motor do app.
- Nada é salvo. Salvar e Cancelar só avisam.
- Os selos novos (Envenenado, Congelado, Eletrizado) e a peça "somar num acumulador" não existem no motor ainda; estão marcados no protótipo ("selo novo", "peça nova").
- O menu de requisitos mostra só 8 tipos (A1, A2, A4, B1, B2, C1, G2, J1); a lista inteira está no protótipo dos requisitos.
- Os números das fichas vêm das auditorias de 07/11; o alcance da Bênção (3 casas) e da Chuva (até 6) são exemplo.

## Decisões para o dono

1. Os padrões dos tipos (tabela acima): servem? Sobretudo Impacto (atordoa com teste) e Choque (tira SP).
2. Golpe que gasta o acumulador e dá dano por nível: o dano conta o nível de antes de gastar (o golpe sai com a carga). Fica assim?
3. Passiva sem peças por enquanto (o app lê a descrição). Ok?
4. "Condição" deixa de ser categoria e vira "ataque sem dano com um tipo". Ok?

## Prova

`tmp/editor-prototipo/prova.cjs` abre no Chromium, clica nos 4 exemplos, nos modelos, no teclado e no mapa, e confere 29 coisas (frases, contas, requisito que falta e conserto, acumulador, Reação, Passiva, Esc no menu e na janela, Ctrl+Z, setas). Resultado: 29/29, nenhuma tarefa longa (>= 200 ms), nenhum erro no console. Prints em `tmp/editor-prototipo/1-*.png` a `7-*.png`.
