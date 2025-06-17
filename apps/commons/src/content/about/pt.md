# Sobre

O LEAF-Writer fornece:

- edição de documentos com reconhecimento de esquema, incluindo validação, em relação a esquemas acessíveis pela web
- aplicação de estilos CSS para formatação de documentos, bem como uma opção para visualização de tags usados no documento
- a capacidade de extrair referências a entidades nomeadas (pessoas, lugares ou organizações) de referências XML já marcadas em um documento para gerar Anotação da Web
- a capacidade de pesquisar e selecionar identificadores para tags de entidades nomeadas (pessoas, organizações, lugares ou títulos) das seguintes autoridades de Dados Abertos Vinculados: [DBPedia](https://dbpedia.org/), [Geonames](https://www.geonames.org/), [Getty](https://www.getty.edu/), [GND](https://www.dnb.de/EN/Professionell/Standardisierung/GND/gnd_node.html), [LINCS Project](https://lincsproject.ca), [VIAF](https://www.viaf.org/), and [Wikidata](https://www.wikidata.org/), ou arquivos de autoridade específicos do projeto.
- geração de anotações de Dados Vinculados correspondentes a entidades nomeadas recentemente - marcadas e anotações de documentos (datas, notas, citações, correções, links, palavras-chave) em XML-RDF ou JSON-LD em conformidade com o Modelo de Dados de Anotação da Web
- validação XML contínua
- Opções de marcação com restrição de Shema

Esta versão do LEAF-Writer usa os repositórios GitHub para armazenamento, controle de versão e compartilhamento de documentos. Para aproveitar esses recursos, você precisa estar conectado a uma conta GitHub. Além disso, você pode abrir documentos colando um XML ou carregando um arquivo do seu computador. Você também pode baixar o arquivo diretamente para o seu dispositivo. Opcionalmente, você pode usar o LEAF-Writer sem nenhuma conta externa, caso em que você só poderá carregar e salvar no seu computador.

O LEAF-Writer foi projetado para trabalhar com [personalizações do esquema da Iniciativa de Codificação de Texto (TEI)](https://tei-c.org/guidelines/customization/#section-1) fornecido pelo Consórcio TEI. Pronto para uso, o LEAF-Writer oferece suporte aos seguintes esquemas: [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng), [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng), [TEI Simple Print](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng), [jTEI Article](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_jtei.rng), e [Orlando](https://cwrc.ca/schemas/orlando_entry.rng).

O LEAF-Writer também pode trabalhar com esquemas personalizados. Quando você abre um documento, o LEAF-Writer verifica o elemento raiz e a definição do esquema. Atualmente, o LEAF-Writer oferece suporte a três elementos raiz diferentes: TEI, ORLANDO e CWRCENTRY. Se o elemento raiz for compatível mas os esquema não for, você pode adicionar um novo esquema personalizado. O LEAF-Writer salva as informações do esquema no localstorage do navegador. Então, o esquema estará disponível localmente enquanto você permanecer conectado.

Você pode usar o LEAF-Writer para editar documentos XML ou produzir novos documentos a partir de modelos. Há modelos e documentos de amostra aqui para começar.

Para saber mais sobre como usar o LEAF-Writer, consulte a [documentação](https://www.leaf-vre.org/docs/documentation/leaf-commons/leaf-writer-documentation-basic).

Se você encontrar um bug ou houver um recurso que você gostaria de ver adicionado, envie um tíquete para <https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues>.

Se você estiver interessado em adotar/adaptar o Leaf Writer para um ambiente diferente, consul [essa referencia](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer). Você pode entrar em contato conosco por meio de um tíquete do Gitlab em qualquer um dos repositórios de código do LEAF-Writer.

Finalmente, se você achou o LEAF-Writer útil para sua pesquisa ou ensino, avise-nos! Adoraríamos saber.
