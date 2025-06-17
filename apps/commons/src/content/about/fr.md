# À propos de

LEAF-Writer fournit :

- édition de documents sensible aux schémas, y compris la validation, par rapport aux schémas accessibles sur le Web
- prise en charge des feuilles de style en cascade (CSS) pour fournir une vue WYSIWYG des documents, ainsi qu'une vue montrant les balises
- possibilité d'extraire des références à des entités nommées (personnes, lieux ou organisations) à partir de références XML déjà balisées dans un document afin de générer une annotation Web
- possibilité de rechercher et de sélectionner des identifiants pour des balises d'entités nommées (personnes, organisation, lieux ou titres) auprès des autorités de données ouvertes liées suivantes : [DBPedia](https://dbpedia.org/), [Geonames](https://www.geonames.org/), [Getty](https://www.getty.edu/), [GND](https://www.dnb.de/EN/Professionell/Standardisierung/GND/gnd_node.html), [LINCS Project](https://lincsproject.ca), [VIAF](https://www.viaf.org/), et [Wikidata](https://www.wikidata.org/), ou fichier d'autorité spécifique au projet.
- génération d'annotations de données liées correspondant à des entités nommées nouvellement taguées et des annotations de documents (dates, notes, citations, corrections, liens, mots-clés) en XML-RDF ou JSON-LD conformément au Web Annotation Data Model
- validation XML continue
- options de balisage contraintes par shema

Cette version de LEAF-Writer utilise les référentiels GitHub pour le stockage, la gestion des versions et le partage de documents. Vous devez être connecté à un compte GitHub pour l'utiliser.

LEAF-Writer est conçu pour fonctionner avec [les personnalisations de la Text Encoding Initiative (TEI)](https://tei-c.org/guidelines/customization/#section-1) schéma fourni par le consortium TEI. Out-of-the-box, LEAF-Writer supports the following schemas [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng), [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng), [TEI Simple Print](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng), [jTEI Article](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_jtei.rng), et [Orlando](https://cwrc.ca/schemas/orlando_entry.rng).

LEAF-Writer peut également fonctionner avec des schémas personnalisés. À l'ouverture d'un document, LEAF-Writer vérifie l'élément racine et la définition du schéma. Actuellement, LEAF-Writer prend en charge trois éléments racines : `TEI`, `ORLANDO` et `CWRCENTRY`. Si l'élément racine est pris en charge par le schéma ou non, vous pouvez l'ajouter comme schéma personnalisé. LEAF-Writer enregistre les informations du schéma dans le stockage local du navigateur. Le schéma sera alors disponible localement tant que vous resterez connecté.

Vous pouvez utiliser LEAF-Writer pour éditer des documents XML ou produire de nouveaux documents à partir de modèles. Il existe des modèles et des exemples de documents ici pour commencer.

Pour en savoir plus sur l'utilisation de LEAF-Writer, consultez la [documentation](https://www.leaf-vre.org/docs/documentation/leaf-commons/leaf-writer-documentation-basic).

Si vous rencontrez un bogue ou s'il y a une fonctionnalité que vous aimeriez voir ajoutée, veuillez envoyer un ticket à <https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues>.

Si vous souhaitez adopter/adapter Leaf Writer à un environnement différent, veuillez consulter [cette référence](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer). Vous pouvez nous contacter via un ticket Gitlab sur l'un des référentiels de code LEAF-Writer.

Enfin, si vous avez trouvé LEAF-Writer utile pour vos recherches ou votre enseignement, faites-le nous savoir ! Nous aimerions l'entendre
