# À propos

CWRC-Writer fournit :

- édition de documents prenant en compte les schémas, y compris la validation, par rapport aux schémas accessibles sur le Web
- prise en charge des feuilles de style en cascade (CSS) pour fournir une vue WYSIWYG des documents, ainsi qu'une vue montrant les balises
- possibilité de rechercher et de sélectionner des identifiants pour les balises d'entité nommées (personnes, organisation, lieux ou titres) à partir d'une gamme d'autorités de données ouvertes liées
- génération (si désiré) d'annotations de données liées correspondant à des balises pour les entités nommées et des annotations de documents (notes, citations, corrections, liens) en XML-RDF ou JSON-LD conformément au Web Annotation Data Model, à la fois pour les données préexistantes et balises nouvellement ajoutées
- capacité à détecter des entités nommées candidates (personnes, lieux ou organisations) dans un document pour le balisage et/ou l'annotation Web, à évaluer et affiner ces suggestions, et à associer les entités à des identifiants LOD

Cette version de CWRC-Writer utilise le référentiel GitHub pour le stockage, la gestion des versions et le partage de documents. Vous devez être connecté à un compte GitHub pour l'utiliser.

CWRC-Writer est conçu pour fonctionner avec les personnalisations du schéma Text Encoding Initiative (TEI) fourni par le consortium TEI. (Les schémas/CSS doivent être disponibles à un emplacement `https://` et avoir CORS activé.)

Vous pouvez utiliser CWRC-Writer pour éditer des documents XML ou produire de nouveaux documents à partir de modèles. Il existe des modèles et des exemples de documents ici pour commencer. La production d'annotations de données ouvertes liées est facultative.

Pour en savoir plus sur l'utilisation de CWRC-Writer, consultez [cwrc.ca/Documentation/CWRC-Writer](https://cwrc.ca/Documentation/CWRC-Writer). Nous vous recommandons de commencer par le _tutoriel vidéo_ et le _guide de démarrage rapide_.

Si vous rencontrez un bogue ou s'il y a une fonctionnalité que vous aimeriez voir ajoutée, veuillez soumettre un ticket à [github.com/cwrc/CWRC-WriterBase/issues](https://github.com/cwrc/CWRC-WriterBase/issues).

Si vous souhaitez adopter/adapter le Writer à un environnement différent, veuillez consulter [cette référence](https://github.com/cwrc/tech_documentation/blob/master/Tools-reference.md#cwrc-writer). Vous pouvez nous contacter via un ticket GitHub sur l'un des référentiels de code CWRC-Writer. Enfin, si vous avez trouvé CWRC-Writer utile pour votre recherche ou votre enseignement, faites-le nous savoir ! Nous aimerions l'entendre.
