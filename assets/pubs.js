// 페이지에 이미 적힌 논문은 그대로 두고, ORCID에 새로 등록된 논문만 찾아서 해당 연도에 끼워 넣는다.
// 실패하면(오프라인, ORCID 장애) 아무것도 하지 않아 기존 목록이 그대로 보인다.
// shortcut: DOI가 없는 ORCID 항목은 건너뛴다. 그런 논문이 생기면 publications.html에 직접 적는다.
(async function () {
  var ORCID = '0000-0002-5720-5934';
  var ME = ['Jun Sang Yu', 'Jun Yu', 'Jun-Sang Yu', 'Junsang Yu'];
  var box = document.querySelector('#publications .wrap');
  if (!box) return;

  var have = new Set();
  box.querySelectorAll('a.doi').forEach(function (a) {
    have.add(decodeURIComponent(a.href.split('doi.org/')[1] || '').toLowerCase());
  });

  var res = await fetch('https://pub.orcid.org/v3.0/' + ORCID + '/works', { headers: { Accept: 'application/json' } });
  if (!res.ok) return;
  var groups = (await res.json()).group || [];

  function text(s) { return String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function listFor(year) {
    var heads = Array.prototype.slice.call(box.querySelectorAll('h3.yr'));
    var same = heads.find(function (h) { return h.textContent.trim() === year; });
    if (same) return same.nextElementSibling;
    var h = el('h3', 'yr en', year), ol = el('ol', 'pubs flat');
    var older = heads.find(function (x) { return Number(x.textContent) < Number(year); });
    if (older) { box.insertBefore(h, older); box.insertBefore(ol, older); }
    else { box.appendChild(h); box.appendChild(ol); }
    return ol;
  }

  for (var i = 0; i < groups.length; i++) {
    var s = groups[i]['work-summary'][0];
    var ids = ((s['external-ids'] || {})['external-id']) || [];
    var d = ids.find(function (x) { return x['external-id-type'] === 'doi'; });
    var doi = d && d['external-id-value'];
    if (!doi || have.has(doi.toLowerCase())) continue;
    have.add(doi.toLowerCase());

    var m = {};
    try {
      var cr = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi));
      if (cr.ok) m = (await cr.json()).message || {};
    } catch (e) { /* Crossref에 없으면 ORCID 정보만으로 표시 */ }

    var year = String((((s['publication-date'] || {}).year || {}).value) || ((m.issued || {})['date-parts'] || [[]])[0][0] || '');
    if (!year) continue;

    var div = el('div', 'en');
    div.appendChild(el('span', 't', text((m.title || [])[0] || s.title.title.value)));

    if (m.author && m.author.length) {
      var a = el('span', 'a');
      m.author.forEach(function (p, k) {
        var name = ((p.given || '') + ' ' + (p.family || p.name || '')).trim();
        if (k) a.appendChild(document.createTextNode(', '));
        a.appendChild(ME.indexOf(name) >= 0 ? el('b', '', name) : document.createTextNode(name));
      });
      div.appendChild(a);
    }

    var v = el('span', 'v');
    v.appendChild(el('i', '', text((m['container-title'] || [])[0] || (s['journal-title'] || {}).value)));
    var vol = (m.volume || '') + (m.issue ? '(' + m.issue + ')' : '');
    var pages = String(m.page || m['article-number'] || '').replace('-', '–');
    var tail = [vol, pages].filter(Boolean).join(', ');
    v.appendChild(document.createTextNode((tail ? ' ' + tail : '') + '.'));
    div.appendChild(v);

    var link = el('a', 'doi', 'DOI');
    link.href = 'https://doi.org/' + doi;
    link.target = '_blank';
    link.rel = 'noopener';
    div.appendChild(document.createTextNode(' '));
    div.appendChild(link);

    var li = el('li');
    li.appendChild(div);
    var ol = listFor(year);
    ol.insertBefore(li, ol.firstChild);
  }
})().catch(function () {});
