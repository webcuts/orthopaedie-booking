/**
 * ORTHO-034: Abwesenheits-Banner für Framer Website
 *
 * Einbettung in Framer: Settings → Custom Code → End of <body> tag
 * <script src="https://orthopaedie-booking.vercel.app/absence-banner.js"></script>
 *
 * Oder den gesamten Code als Inline-Script einfügen.
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://jgammhrdgoxxbcwvlqcd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_Ww1hByyP9FrP4mCoj7-Uvg_tDPmW1Hg';

  var SESSION_KEY = 'ortho_absence_banner_closed';
  var REASON_MAP = { vacation: 'Urlaub', sick: 'Erkrankung', other: 'Abwesenheit' };

  // Nicht erneut anzeigen wenn in dieser Session geschlossen
  if (sessionStorage.getItem(SESSION_KEY)) return;

  function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateShort(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  function practitionerName(p) {
    if (!p) return 'Behandler';
    return ((p.title || '') + ' ' + p.first_name + ' ' + p.last_name).trim();
  }

  function generateText(absence) {
    if (absence.public_message) return absence.public_message;
    var name = practitionerName(absence.practitioner);
    var reason = REASON_MAP[absence.reason] || 'Abwesenheit';
    var startYear = absence.start_date.substring(0, 4);
    var endYear = absence.end_date.substring(0, 4);
    var start = startYear === endYear ? formatDateShort(absence.start_date) : formatDate(absence.start_date);
    var end = formatDate(absence.end_date);
    return name + ' ist vom ' + start + ' bis ' + end + ' nicht verfügbar (' + reason + ').';
  }

  function createBanner(absences) {
    var container = document.createElement('div');
    container.id = 'ortho-absence-banner';
    container.style.cssText =
      'position:relative;background:#FEF3C7;border-bottom:2px solid #F59E0B;' +
      'padding:12px 48px 12px 20px;font-family:Arial,sans-serif;font-size:14px;' +
      'color:#92400E;line-height:1.5;z-index:99999;';

    var inner = document.createElement('div');
    inner.style.cssText = 'max-width:1200px;margin:0 auto;';

    for (var i = 0; i < absences.length; i++) {
      var p = document.createElement('p');
      p.style.cssText = 'margin:0;' + (i > 0 ? 'margin-top:6px;' : '');
      p.textContent = generateText(absences[i]);
      inner.appendChild(p);
    }

    container.appendChild(inner);

    // Schließen-Button
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Banner schließen');
    closeBtn.style.cssText =
      'position:absolute;top:8px;right:12px;background:none;border:none;' +
      'font-size:22px;color:#92400E;cursor:pointer;padding:4px 8px;line-height:1;' +
      'opacity:0.7;transition:opacity 0.2s;';
    closeBtn.onmouseover = function () { this.style.opacity = '1'; };
    closeBtn.onmouseout = function () { this.style.opacity = '0.7'; };
    closeBtn.onclick = function () {
      container.remove();
      sessionStorage.setItem(SESSION_KEY, '1');
    };
    container.appendChild(closeBtn);

    return container;
  }

  // Heute und +7 Tage Vorausschau
  var today = new Date().toISOString().split('T')[0];
  var in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  var url = SUPABASE_URL + '/rest/v1/practitioner_absences' +
    '?select=*,practitioner:practitioners(title,first_name,last_name)' +
    '&show_on_website=eq.true' +
    '&end_date=gte.' + today +
    '&start_date=lte.' + in7Days +
    '&order=start_date';

  fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    },
  })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (!data || !data.length) return;
      var banner = createBanner(data);
      document.body.insertBefore(banner, document.body.firstChild);
    })
    .catch(function (err) {
      console.warn('[absence-banner] Fehler:', err);
    });
})();
