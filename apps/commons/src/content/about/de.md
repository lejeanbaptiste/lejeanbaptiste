# Über
​
LEAF-Writer bietet:
​
- Bearbeitung von XML-Dokumenten unter Einhaltung eines vorgegebenen Schemas, einschließlich Validierung gegen im Internet verfügbare Schemata
- Unterstützung für Cascading Stylesheets (CSS), um eine WYSIWYG-Ansicht von Dokumenten sowie eine Ansicht mit Tags zu ermöglichen
- die Möglichkeit, Referenzen auf benannte Entitäten (Personen, Orte oder Organisationen) aus bereits getaggten XML-Referenzen innerhalb eines Dokuments zu extrahieren, um Web-Annotationen zu erzeugen
- die Möglichkeit, Entitäten (Personen, Organisationen, Orte oder Titel) zu taggen und mit Referenzen zu versehen, die aus den folgenden Datenquellen gesucht und ausgewählt werden können: GND, DBPedia, Geonames, Getty, LGPN, VIAF, und Wikidata.
- Generierung von Linked-Open-Data-Annotationen zu neu getaggten Entitäten und Dokumentannotationen (Daten, Notizen, Zitate, Korrekturen, Links, Schlüsselwörter) in XML-RDF oder JSON-LD gemäß dem Web Annotation Data Model
- kontinuierliche XML-Validierung
- Tagging begrenzt auf im Schema verfügbare Optionen
​
LEAF-Writer nutzt GitHub- und GitLab-Repositorien zur Speicherung, Versionierung und Freigabe von Dokumenten. Um die Vorteile dieser Funktionen nutzen zu können, müssen Sie mit einem GitHub- oder GitLab-Konto angemeldet sein. Darüber hinaus können Sie Dokumente öffnen, indem Sie eine XML-Datei einfügen oder eine Datei von Ihrem Computer hochladen. Sie können Dateien auch direkt auf Ihr Gerät herunterladen. Optional können Sie LEAF-Writer auch ohne ein externes Konto verwenden. In diesem Fall können Sie Dokumente nur von Ihrem Computer öffnen und auf diesem speichern.
​
LEAF-Writer wurde für die Arbeit mit Schemata basieren auf [TEI (Text Encoding Initiative)](https://tei-c.org/) entwickelt. LEAF-Writer unterstützt von Haus aus die folgenden Schemata: [TEI All](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng), [TEI Corpus](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_corpus.rng), [TEI Drama](https://tei-c.org/release/xml/tei/custom/schema/relaxng/tei_drama.rng), [TEI Manuscript](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_ms.rng), [TEI Speech](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_speech.rng), [TEI LITE](https://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_lite.rng), [Orlando](https://cwrc.ca/schemas/orlando_entry.rng).
​
LEAF-Writer kann auch mit benutzerdefinierten Schemata verwendet werden. Wenn Sie ein Dokument öffnen, prüft LEAF-Writer das Wurzelelement und die Schemadefinition. Wenn das Wurzelelement von keinem integrierten Schema unterstützt wird, können Sie ein eigenes, benutzerdefiniertes Schema hinzufügen. LEAF-Writer speichert die Schemainformationen im lokalen Speicher des Browsers. Das Schema ist dann verfügbar, solange Sie eingeloggt bleiben.
​
Sie können LEAF-Writer verwenden, um XML-Dokumente zu bearbeiten oder neue Dokumente zu erstellen. Für den Einstieg sind Vorlagen und Beispieldokumente verfügbar.
​
Um mehr über die Verwendung von LEAF-Writer zu erfahren, lesen Sie die [Dokumentation](https://www.leaf-vre.org/docs/documentation/leaf-commons/leaf-writer-documentation-basic).
​
Falls Sie auf einen Fehler stoßen oder eine neue Funktion vorschlagen möchten, öffnen Sie bitte ein Ticket unter <https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer/-/issues>.
​
Wenn Sie daran interessiert sind, LEAF-Writer an eine andere Umgebung anzupassen, lesen Sie bitte [diese Referenz](https://gitlab.com/calincs/cwrc/leaf-writer/leaf-writer). Sie können uns gerne über ein GitLab-Ticket kontaktieren.
​
Wenn Sie LEAF-Writer für Ihre Forschung oder Lehre als nützlich empfunden haben, lassen Sie es uns bitte wissen! Wir würden uns freuen, von Ihnen zu hören.