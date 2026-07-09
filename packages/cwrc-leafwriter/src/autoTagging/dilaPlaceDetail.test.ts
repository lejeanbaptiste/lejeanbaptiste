import {
  fetchDilaPlaceDetail,
  parseDilaPlaceDetailHtml,
  yearRangeFromDilaText,
} from './dilaPlaceDetail';

// Trimmed excerpt of the real DILA record page for PL000000029418
// (https://authority.dila.edu.tw/place/search.php?code=PL000000029418).
const WULING_HTML = `<div id="D027" class="fpr_div">  <span >武陵郡(wǔ líng jùn)</span>
<span id="wiki_district" class="fontStyle">行政區：</span>中國-湖南省-常德市-武陵區<br/>
<span id="wiki_County" class="fontStyle">屬：</span>荊州<br/>
<span id="wiki_Class_id" class="fontStyle">備註：</span>（317 ~ 420）郡級行政中心所在地。<br/>
<span id="wiki_Dynasty" class="fontStyle">朝代：</span>東晉<br/>
<span id="wiki_Note" class="fontStyle">註解：</span>（317 - 420）郡級行政中心所在地。<br/>
</div>`;

describe('parseDilaPlaceDetailHtml', () => {
  it('extracts 備註/朝代 and the embedded year range', () => {
    expect(parseDilaPlaceDetailHtml(WULING_HTML)).toEqual({
      remark: '（317 ~ 420）郡級行政中心所在地。',
      dynasty: '東晉',
      startYear: 317,
      endYear: 420,
    });
  });

  it('returns an empty object when the fields are absent', () => {
    expect(parseDilaPlaceDetailHtml('<div id="D1"><span>no fields here</span></div>')).toEqual({
      remark: undefined,
      dynasty: undefined,
      startYear: undefined,
      endYear: undefined,
    });
  });
});

describe('yearRangeFromDilaText', () => {
  it('accepts a plain hyphen separator too', () => {
    expect(yearRangeFromDilaText('（317 - 420）郡級行政中心所在地。')).toEqual({
      startYear: 317,
      endYear: 420,
    });
  });

  it('returns undefined with no parenthesized range', () => {
    expect(yearRangeFromDilaText('北朝之一，由北魏分裂出來的割據政權')).toBeUndefined();
  });
});

describe('fetchDilaPlaceDetail', () => {
  it('fetches by id and parses the response', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      expect(url).toBe('https://authority.dila.edu.tw/place/search.php?code=PL000000029418');
      return { ok: true, text: async () => WULING_HTML } as Response;
    });
    const detail = await fetchDilaPlaceDetail('PL000000029418', fetchImpl);
    expect(detail).toEqual({
      remark: '（317 ~ 420）郡級行政中心所在地。',
      dynasty: '東晉',
      startYear: 317,
      endYear: 420,
    });
  });

  it('returns null on a non-ok response', async () => {
    const fetchImpl = jest.fn(async () => ({ ok: false }) as Response);
    expect(await fetchDilaPlaceDetail('PL000000000000', fetchImpl)).toBeNull();
  });
});
