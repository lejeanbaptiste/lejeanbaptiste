# Sobre

LEAF-Writer proporciona:

- edición de documentos con reconocimiento de esquema, incluida la validación, en relación con esquemas accesibles por la web
- soporte para hojas de estilo en cascada (CSS) para proporcionar una vista WYSIWYG de los documentos, así como una vista que muestra las etiquetas
- la capacidad de extraer referencias a entidades nombradas (personas, lugares o organizaciones) de referencias XML ya marcadas dentro de un documento para generar Anotación Web
- la capacidad de buscar y seleccionar identificadores para las etiquetas de entidades nombradas (personas, organizaciones, lugares o títulos) de las siguientes autoridades de datos abiertos vinculados: [DBPedia](https://dbpedia.org/), [Geonames](https://www.geonames.org/), [Getty](https://www.getty.edu/), [GND](https://www.dnb.de/EN/Professionell/Standardisierung/GND/gnd_node.html), [LINCS Project](https://lincsproject.ca), [VIAF](https://www.viaf.org/), y [Wikidata](https://www.wikidata.org/), o archivos de autoridad específicos del proyecto.
- generación de anotaciones de datos vinculados correspondientes a entidades nombradas recién marcadas y anotaciones de documentos (fechas, notas, citas, correcciones, enlaces, palabras clave) en XML-RDF o JSON-LD conforme al Modelo de datos de anotación web
- validación XML continua
- opciones de marcado limitadas por esquema

Esta versión de LEAF-Writer utiliza GitHub y Gitlab para el almacenamiento, la gestión de versiones y el intercambio de documentos. Para aprovechar estas características, necesita estar conectado a una cuenta de GitHub o Gitlab. Además, puede abrir documentos pegando un XML o cargando un archivo desde su computadora. También puede descargar el archivo directamente a su dispositivo. Opcionalmente, puede usar LEAF-Writer sin ninguna cuenta externa, en el que solo podrá cargar desde y guardar en su computadora.

LEAF-Writer está diseñado para funcionar con [personalizaciones del Text Encoding Initiative (TEI)](https://tei-c.org/guidelines/customization/#section-1) esquema proporcionado por el Consortium TEI. Out-of-the-box, LEAF-Writer soporta los siguientes esquemas: [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng), [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng), [TEI Simple Print](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_simplePrint.rng), [jTEI Article](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_jtei.rng), y [Orlando](https://cwrc.ca/schemas/orlando_entry.rng).

LEAF-Writer puede también funcionar con esquemas personalizados. Cuando abre un documento, LEAF-Writer verifica el elemento raíz y la definición del esquema. Actualmente, LEAF-Writer soporta tres diferentes elementos raíz: `TEI`, `ORLANDO`, y `CWRCENTRY`. Si el elemento raíz no es soportado por el esquema, puede agregarlo como esquema personalizado. LEAF-Writer guarda la información del esquema en el almacenamiento local del navegador. Entonces, el esquema estará disponible localmente mientras permanezca conectado.

Para aprender más sobre cómo usar LEAF-Writer, vea la [documentación](https://www.leaf-vre.org/docs/documentation/leaf-commons/leaf-writer-documentation-basic).

Si encuentra un error o si hay una característica que le gustaría ver agregada, por favor envíe un ticket a <https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues>.

Si está interesado en adoptar/adaptar Leaf Writer a un entorno diferente, por favor consulte [esta referencia](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer). Puede contactarnos a través de un ticket Gitlab en cualquier repositorio de código LEAF-Writer.

Finalmente, si ha encontrado útil LEAF-Writer para su investigación o enseñanza, por favor háganos saber! Nos encantaría escucharlo.
