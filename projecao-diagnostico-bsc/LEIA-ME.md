# Projeção BSC — projeção e diagnóstico

Página nova, logo abaixo do BSC no menu, que responde: **se o indicador tivesse o atingimento esperado (a meta), qual seria a nota do BSC?**

Exemplo do print: *Instalação em até D3* vale 10 pts e entrega 5,0. Na meta entrega os 10, e a nota sobe 5,0.

## O que tem na pasta

| Arquivo | O que é | Onde colar |
|---|---|---|
| `1a_tabela_seletor_cenario.txt` | tabela do seletor **Cenário** (real × esperado) | Modelagem > Nova tabela |
| `1b_tabela_seletor_indicadores.txt` | tabela do seletor **Indicadores na projeção** | Modelagem > Nova tabela |
| `1c_tabela_seletor_atingimento.txt` | tabela do seletor **Atingimento da meta** (0% a 100%) | Modelagem > Nova tabela |
| `1d_tabela_seletor_nivel_por_indicador.txt` | tabela do seletor **% por indicador** (um % diferente em cada indicador) | Modelagem > Nova tabela |
| `2_medida_bsc_projecao_html.txt` | medida **BSC Projeção HTML** (corpo da página) | Nova medida |
| `3_medida_menu_lateral_v8.txt` | menu com o item **Projeção BSC** (substitui o v7) | nas medidas de menu que já existem |
| `4_medida_menu_lateral_pagina_projecao.txt` | o mesmo menu, já com **Projeção BSC** como página atual | medida nova, para o menu da página nova |
| `previas/` | prints e a prévia interativa | — |

Nenhuma medida base muda. A página usa as mesmas que o corpo do BSC já usa: `[BSC Pontos Reais]`, `[BSC Resultado Selecionado]`, `[BSC Meta Selecionada]`, `[BSC Menor Melhor]`, `[BSC Pontos Disponíveis]`, e as tabelas `'Seletor Cor'`, `'Seletor Indicador BSC'` e `dAT`.

## Passo a passo

### 1. Criar as quatro tabelas
Modelagem > **Nova tabela**, uma de cada vez (arquivos `1a`, `1b`, `1c` e `1d`). Não crie relacionamento para elas.

Depois, em cada uma, **Classificar por coluna**:
- `Cenário` → por `Ordem Cenário`
- `Indicador Projeção` → por `Ordem Projeção`

Na tabela `1d`, classifique `Indicador Nível` por `Ordem Indicador Nível` e `Nível` por `Atingimento Nível`.

Na tabela `1c`, deixe a coluna `Atingimento` como **Número inteiro** e use o formato personalizado `0"%"` (mostra 80% em vez de 80). Não use o formato Porcentagem: os valores são de 0 a 100, e ele mostraria 8000%.

### 2. Criar a medida do corpo
**Nova medida** > colar o arquivo `2` inteiro. O nome vem junto: `BSC Projeção HTML`.

### 3. Montar a página
O caminho mais curto é **duplicar a página do BSC** e renomear para `Projeção BSC` (menu, botões e seletores de cor, AT e mês vêm prontos).

Na página duplicada:
1. No visual HTML do corpo, troque a medida por `BSC Projeção HTML`.
2. Apague o visual "atualização das bases" e use o espaço para os quatro seletores novos:

| Seletor | Campo | Estilo | Configuração |
|---|---|---|---|
| **Cenário** | `'Seletor Cenário BSC'[Cenário]` | Lista vertical | Configurações da segmentação > Seleção > **Seleção única: ativada**. É isso que troca os quadradinhos por bolinhas. Deixe "Atingimento esperado (meta)" marcado. |
| **Atingimento da meta** (opcional) | `'Seletor Atingimento BSC'[Atingimento]` | Valor único (barra deslizante) | Arraste até 100% e salve: é o valor com que o relatório abre. |
| **Indicador & % Atingimento** | `'Seletor Nível BSC'[Indicador Nível]` e, abaixo dele, `'Seletor Nível BSC'[Nível]` | Suspenso (vira uma árvore) | Seleção > "Seleção múltipla com CTRL": **desativada**; "Mostrar opção Selecionar tudo": ativada. Deixe sem nada marcado. |
| **Indicadores na projeção** (opcional) | `'Seletor Projeção BSC'[Indicador Projeção]` | Suspenso | "Seleção múltipla com CTRL": **desativada**. "Mostrar opção Selecionar tudo": **ativada**. |

Posições usadas nas prévias (página 1280 × 720, partindo das posições da página do BSC):

| Visual | X | Y | Largura | Altura |
|---|---|---|---|---|
| Seletor de cor | 275 | 6 | 246 | 114 |
| Seletor de AT | 530 | 6 | 100 | 114 |
| Seletor de mês | 639 | 6 | 112 | 114 |
| Cenário (novo) | 760 | 6 | 190 | 114 |
| Atingimento da meta (novo) | 959 | 6 | 140 | 114 |
| Indicadores na projeção (novo) | 1108 | 6 | 154 | 54 |
| % por indicador (novo) | 1108 | 66 | 154 | 54 |
| Corpo HTML | 275 | 130 | 987 | 576 |

O corpo se adapta a tamanhos menores (testado até 700 × 520), então dá para deixar o seletor de indicadores como lista vertical ao lado, se preferir ver as marcações o tempo todo.

### 4. Atualizar o menu (todas as páginas)
O item novo entra na 2ª posição, então **todos os menus** precisam do v8 para continuarem iguais entre si.

1. Em cada medida de menu, cole o arquivo `3` e ajuste só `_paginaAtual`:
   `"BSC"`, `"Projeção BSC"`, `"IFI"`, `"IRR"`, `"TDNA Instalação"`, `"TDNA Reparos"` ou `"Abertura Hierarquia"`.
   Na página da Hierarquia, mantenha também as outras duas diferenças que ela já tinha: `_avisoTexto = ""` e `_descerHierarquia = 2`.
   Para a página nova, crie uma medida de menu com `_paginaAtual = "Projeção BSC"`.
2. Botões nativos: a geometria não mudou (36 px de altura, 43 px de passo). O botão do BSC fica onde está; **selecione os outros 6 juntos e desça 43 px**; no espaço que abriu, crie o botão da página nova.

| Botão | Topo (a partir do topo do menu) | |
|---|---|---|
| BSC | 109 | não muda |
| **Projeção BSC** | **152** | **novo** · Ação > Navegação de página > Projeção BSC |
| IFI | 195 | era 152 |
| IRR | 238 | era 195 |
| TDNA Instalação | 281 | era 238 |
| TDNA Reparos | 324 | era 281 |
| Abertura Hierarquia | 367 | era 324 |
| Detalhamento BSC | 410 | era 367 |

Para caber o 8º item em 700 px de altura, o bloco **Cores** virou uma linha só (4 cartões) e os blocos de baixo ficaram alguns pixels mais justos. Veja `previas/9-menu-antes-e-depois-posicao-dos-botoes.png`.

Quer outro nome no item (por exemplo "Projeção e Diagnóstico")? Troque o texto na tabela `_paginas` do menu e em `_paginaAtual`. Nomes longos são cortados com reticências no menu de 200 px da Hierarquia.

## Como usar a página

A página funciona com dois seletores novos: **Cenário** e a árvore **Indicador & % Atingimento**. A barra "Atingimento da meta" e o seletor "Indicadores na projeção" são opcionais.

- **Cenário = Atingimento esperado**: liga a projeção.
- **Cenário = Atingimento real**: sem projeção, fica só o diagnóstico.
- **Árvore Indicador & % Atingimento** (é ela que decide a projeção):
  - **nada marcado**: todos os indicadores na meta (100%);
  - **marcou o indicador inteiro** (a caixa do pai): ele vai à meta (100%);
  - **abriu o indicador pela seta e marcou um %**: ele vai a esse %, por exemplo Instalação D3 a 70%;
  - só os indicadores marcados entram na projeção; os outros ficam com o resultado real;
  - para combinar (D3 a 80%, Repetidas a 60%, IFI inteiro), a "Seleção múltipla com CTRL" tem de estar **desativada**. Com ela ativada, segure CTRL para marcar mais de um.
- **Atingimento da meta** (opcional): muda o % de quem foi marcado inteiro (ou de todos, se nada estiver marcado na árvore). Sem a barra na página, vale 100%.
- Cor, AT e mês funcionam como no BSC.

## O que a faixa escura mostra

- **Número grande**: nota projetada.
- **"nota atual 77,87 → 79,82"**: de onde sai e onde chega.
- **Etiqueta "▲ +1,95 pts · +2,5%"**: quantos pontos a projeção soma e quanto isso representa sobre a nota atual.
- **"mês ant. 74,37 · projeção +5,44"**: nota do mês anterior e a diferença da nota projetada para ela. No cenário real, a diferença é da nota atual. Sem dados no mês anterior, a linha volta a mostrar quantos indicadores foram levados ao %.

### Mês anterior: confira a tabela de calendário
A medida usa `dCalendario[Data]` (a mesma das páginas IFI e IRR) para voltar um mês. Se o seletor "Selecione o Mês" filtrar outra tabela, troque `dCalendario` por ela no `VAR _filtroMesAnterior` e nos `REMOVEFILTERS( dCalendario )` da coluna `__PtsMesAnt`. Para conferir: com o mês de outubro selecionado, o "mês ant." tem de ser igual à nota do velocímetro do BSC em setembro.

## Como ler

- **Faixa escura, à esquerda**: velocímetro com a nota atual (arco cheio) e a projetada (arco claro).
- **Onde está a perda**: uma barra em que cada pedaço é um indicador abaixo da meta, do maior para o menor. Pedaço apagado = ficou fora da projeção.
- **Caminho até cada faixa**: para 80%, 90% e 100%, diz se a projeção chega lá e, saindo da nota real, quantos indicadores bastam (sempre os de maior ganho primeiro).
- **Tabela**
  - *Falta*: quanto o resultado precisa andar para bater a meta (↑ subir, ↓ cair).
  - *Ganho*: pontos que o indicador devolve se bater a meta.
  - *Ponte*: começa na nota atual. Barra cheia = está na projeção, e o número é a nota acumulada. Barra tracejada = ficou de fora.
  - *Só este*: nota se apenas aquele indicador batesse a meta.
  - *Na projeção*: atingimento que a conta usou (`meta · 100%` ou `real · x%`).

## Regras da conta

- **Nota atual**: mesma medida e mesmos filtros que o corpo do BSC usa (Geral, cor ou AT). Deve ser igual à nota do velocímetro do BSC.
- **Ganho** = peso × atingimento esperado − pontos atuais. Nunca é negativo: quem já passou da meta mantém o que tem.
- **Nota projetada** = nota atual + ganho dos indicadores que estão na projeção.
- **Visão por AT**: Indisponibilidade FTTH e Móvel não entram na nota da AT (como no BSC), então aparecem como "fora da nota". Por isso o teto de uma AT fica abaixo de 100.
- **Indicador sem resultado no filtro**: hoje entrega 0 ponto; na projeção entra com o peso inteiro. Desmarque no seletor se não quiser contar.
- **Com o atingimento abaixo de 100%**, "perda", "ganho" e "caminho até cada faixa" passam a ser medidos contra o nível escolhido (por exemplo, 80% do peso), não contra a meta cheia. A coluna *Falta* continua mostrando a distância até a meta.

## Conferência depois de colar

1. Com **Cenário = Atingimento real**, a nota da página tem de ser a mesma do velocímetro do BSC no mesmo filtro.
2. Marcando só um indicador, o ganho tem de ser *peso − pontos* daquele indicador.

Se o item 1 não bater, me avise: as medidas foram conferidas no avaliador de DAX deste repositório (sintaxe e HTML gerado, com dados fictícios), não no seu modelo.

## Sobre as prévias

- Os 10 indicadores visíveis no print estão com os mesmos números da tela. **Chegada no Slot e Indisponibilidade Móvel não apareciam no print e foram estimados**, então a nota 77,87 é ilustrativa. Cores e ATs são variações fictícias do Geral.
- `previas/previa-interativa.html`: abra no navegador e clique nos seletores. A própria medida DAX é reavaliada a cada clique.
- Para gerar de novo: `node tools/dax-preview/build-projecao.js`
