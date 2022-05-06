export const documentWithError = `<?xml version="1.0" encoding="UTF-8"?><?xml-model href="https://cwrc.ca/schemas/cwrc_tei_lite.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?><?xml-stylesheet type="text/css" href="https://cwrc.ca/templates/css/tei.css"?><TEI xmlns="http://www.tei-c.org/ns/1.0" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">

	
<teiHeader>
   <fileDesc>
      <titleStmt>
         <title>Sample Document Title</title>
      </titleStmt>
      <publicationStmt>
         <p/>
      </publicationStmt>
      <sourceDesc sameAs="http://www.cwrc.ca">
         <p>Created from original research by members of CWRC/CSÉC unless otherwise noted.</p>
      </sourceDesc>
   </fileDesc>
</teiHeader>
<text>
   <body>
      <div type="letter">
         <head>
            <title>Sample Letter - <persName key="Bertrand Russell" ref="http://www.wikidata.org/entity/Q33760">Bertrand</persName> Russell to <persName cert="low" ref="279399399">Patricia Spence</persName> - Octobesr 21, 1935</title>
         </head>
         <opener>
            <note>
               <p>Bad writing due to shaky train</p><p>In car</p><p>
                  <placeName cert="high" ref="http://www.geonames.org/6453366">Oslo</placeName> to Bergen</p>
            </note>
            <dateline>
               <date cert="high" when="1935-10-21">21.10.35</date>
            </dateline>
            <salute>Dearest -</salute>
         </opener><p>I have had no letter from you since I left <placeName key="Stockholm" ref="http://www.wikidata.org/entity/Q1754" cert="medium">Stockholm<precision match="@ref" precision="high"/></placeName>, but I had a nice one nfrom John in an envelope you had sent him. I had sent him one addressed to Copenhagen but he hadn't used it.</p><p>When I reached Oslo yesterday<note type="researchNote">Yesterday was a nice and sunny day</note> evening, Brynjulf Bull should have been there to meet me, but wasn't. He is not on the telephone, so I took a taxi to his address, which turned out to be a students' club with no one about on Sundays, so I went to a hotel feeling rather non-plussed. But presently he turned up. He had got the <pb n="2"/> time of my arrival wrong, and 
               <corr>when</corr>
            he had found he had missed me he phoned to every hotel in Oslo till he hit on the right one. He left me at 10, and then I had to do a Sunday Referee article. Today my journey lasts from 9 till 9 - fortunately one of the most beautiful railway journeys in the world. Tomorrow I lecture at <placeName cert="high" ref="http://www.geonames.org/6548528">Bergen</placeName> to the Anglo-Norwegian Society. Next day I go back to Oslo, lecture there Fri. and Sat. and then start for home via Bergen.</p>
         <pb n="3"/>
         <sunny>day</sunny>
         <p>Bull is a nice young man but incompetent - can't quite stand the communists, but finds the socialists too mild.</p><p>I am unhappily wondering what you are feeling about me.</p>
         <closer day="22">
            <salute>I love you very much -</salute>
            <signed>
               <persName sameAs="http://www.freebase.com/view/en/bertrand_russell">
                  <persName cert="none" type="real" ref="http://viaf.org/viaf/36924137">B</persName>
               </persName>
            </signed>
         </closer>
      </div>
   </body>
</text>
</TEI>`;
