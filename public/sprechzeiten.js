/**
 * ORTHO-035/039: Sprechzeiten & OP-Tage für Framer Website
 *
 * Einbettung in Framer:
 * 1. Container auf der Seite platzieren: <div id="sprechzeiten"></div>
 * 2. Settings → Custom Code → End of <body> tag:
 *    <script src="https://orthopaedie-booking.vercel.app/sprechzeiten.js"></script>
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://jgammhrdgoxxbcwvlqcd.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_Ww1hByyP9FrP4mCoj7-Uvg_tDPmW1Hg';

  // practitioner_schedules: JS getDay() → 0=So, 1=Mo, ..., 6=Sa
  var SCHEDULE_DAY_NAMES = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' };
  var SCHEDULE_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  // practice_hours: 0=Mo, 1=Di, ..., 6=So
  var HOURS_DAY_NAMES = { 0: 'Mo', 1: 'Di', 2: 'Mi', 3: 'Do', 4: 'Fr', 5: 'Sa', 6: 'So' };

  var COLORS = {
    bookable: '#059669',
    bookableDot: '#34D399',
    private: '#7C3AED',
    privateDot: '#A78BFA',
    notBookable: '#6B7280',
    notBookableDot: '#D1D5DB',
  };

  function formatTime(t) {
    var parts = t.split(':');
    return parseInt(parts[0], 10) + ':' + parts[1];
  }

  function practitionerName(p) {
    return ((p.title || 'Dr.') + ' ' + p.first_name + ' ' + p.last_name).trim();
  }

  function entryLabel(s) {
    if (s.is_bookable && s.insurance_filter === 'private_only') return 'Privatsprechstunde';
    if (s.is_bookable) return 'Online buchbar';
    return s.label || 'Sprechstunde';
  }

  function entryColor(s) {
    if (s.is_bookable && s.insurance_filter === 'private_only') return COLORS.private;
    if (s.is_bookable) return COLORS.bookable;
    return COLORS.notBookable;
  }

  function entryDot(s) {
    if (s.is_bookable && s.insurance_filter === 'private_only') return COLORS.privateDot;
    if (s.is_bookable) return COLORS.bookableDot;
    return COLORS.notBookableDot;
  }

  function createBadge(schedule) {
    var span = document.createElement('span');
    span.style.cssText =
      'display:inline-flex;align-items:center;gap:4px;background:#F9FAFB;' +
      'border:1px solid #E5E7EB;border-radius:6px;padding:2px 8px;font-size:13px;' +
      'white-space:nowrap;color:' + entryColor(schedule) + ';';

    var dot = document.createElement('span');
    dot.style.cssText =
      'width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + entryDot(schedule) + ';';
    span.appendChild(dot);

    var text = document.createTextNode(
      entryLabel(schedule) + ' ' + formatTime(schedule.start_time) + '–' + formatTime(schedule.end_time)
    );
    span.appendChild(text);

    return span;
  }

  function createLegend() {
    var legend = document.createElement('div');
    legend.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:13px;color:#6B7280;';

    var items = [
      { dot: COLORS.bookableDot, label: 'Online buchbar' },
      { dot: COLORS.privateDot, label: 'Privatsprechstunde' },
      { dot: COLORS.notBookableDot, label: 'Nicht buchbar' },
    ];

    for (var i = 0; i < items.length; i++) {
      var item = document.createElement('span');
      item.style.cssText = 'display:flex;align-items:center;gap:6px;';

      var d = document.createElement('span');
      d.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + items[i].dot + ';';
      item.appendChild(d);
      item.appendChild(document.createTextNode(items[i].label));
      legend.appendChild(item);
    }

    return legend;
  }

  function createCard(title) {
    var card = document.createElement('div');
    card.style.cssText =
      'background:#FFFFFF;border-radius:10px;padding:20px 24px;margin-bottom:16px;' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1px solid #E5E7EB;';

    var h = document.createElement('p');
    h.style.cssText = 'font-size:16px;font-weight:700;color:#1F2937;margin:0 0 12px 0;';
    h.textContent = title;
    card.appendChild(h);

    return card;
  }

  function buildPractitionerCard(practitioner, schedules) {
    var card = createCard(practitionerName(practitioner));

    if (!schedules || schedules.length === 0) {
      var fallback = document.createElement('p');
      fallback.style.cssText = 'font-size:14px;color:#6B7280;font-style:italic;margin:0;';
      fallback.textContent = 'Termine nach Vereinbarung während der Praxisöffnungszeiten';
      card.appendChild(fallback);
      return card;
    }

    // Group by day
    var byDay = {};
    for (var i = 0; i < schedules.length; i++) {
      var day = schedules[i].day_of_week;
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push(schedules[i]);
    }

    for (var d = 0; d < SCHEDULE_DAY_ORDER.length; d++) {
      var dayNum = SCHEDULE_DAY_ORDER[d];
      if (!byDay[dayNum]) continue;

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:baseline;padding:4px 0;gap:8px;';

      var dayLabel = document.createElement('span');
      dayLabel.style.cssText = 'font-weight:600;color:#374151;min-width:28px;flex-shrink:0;';
      dayLabel.textContent = SCHEDULE_DAY_NAMES[dayNum] + ':';
      row.appendChild(dayLabel);

      var entries = document.createElement('span');
      entries.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';

      var daySchedules = byDay[dayNum];
      for (var j = 0; j < daySchedules.length; j++) {
        entries.appendChild(createBadge(daySchedules[j]));
      }

      row.appendChild(entries);
      card.appendChild(row);
    }

    return card;
  }

  function buildHoursCard(hours) {
    var card = document.createElement('div');
    card.style.cssText =
      'background:#FFFFFF;border-radius:10px;padding:20px 24px;margin-bottom:16px;' +
      'box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1px solid #E5E7EB;';

    var title = document.createElement('p');
    title.style.cssText = 'font-size:15px;font-weight:700;color:#374151;margin:0 0 12px 0;';
    title.textContent = 'Praxisöffnungszeiten';
    card.appendChild(title);

    for (var i = 0; i < hours.length; i++) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:baseline;gap:12px;padding:3px 0;font-size:14px;';

      var dayEl = document.createElement('span');
      dayEl.style.cssText = 'font-weight:600;color:#374151;min-width:28px;';
      dayEl.textContent = HOURS_DAY_NAMES[hours[i].day_of_week];
      row.appendChild(dayEl);

      var timeEl = document.createElement('span');
      timeEl.style.cssText = 'color:#6B7280;';
      timeEl.textContent = formatTime(hours[i].open_time) + '–' + formatTime(hours[i].close_time) + ' Uhr';
      row.appendChild(timeEl);

      card.appendChild(row);
    }

    return card;
  }

  function render(container, practitioners, schedules, hours) {
    container.innerHTML = '';
    container.style.cssText = 'font-family:Arial,sans-serif;font-size:14px;color:#1F2937;';

    container.appendChild(createLegend());

    // Group schedules by practitioner
    var byPractitioner = {};
    for (var i = 0; i < schedules.length; i++) {
      var pid = schedules[i].practitioner_id;
      if (!byPractitioner[pid]) byPractitioner[pid] = [];
      byPractitioner[pid].push(schedules[i]);
    }

    for (var p = 0; p < practitioners.length; p++) {
      container.appendChild(
        buildPractitionerCard(practitioners[p], byPractitioner[practitioners[p].id])
      );
    }

    container.appendChild(buildHoursCard(hours));
  }

  // ── Main ──────────────────────────────────────────

  var container = document.getElementById('sprechzeiten');
  if (!container) {
    console.warn('[sprechzeiten] Container #sprechzeiten nicht gefunden');
    return;
  }

  container.innerHTML = '<div style="text-align:center;padding:24px;color:#9CA3AF;">Lade Sprechzeiten...</div>';

  var today = new Date().toISOString().split('T')[0];
  var headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  };

  Promise.all([
    fetch(
      SUPABASE_URL + '/rest/v1/practitioners?select=id,title,first_name,last_name&is_active=eq.true&order=last_name',
      { headers: headers }
    ).then(function (r) { return r.json(); }),
    fetch(
      SUPABASE_URL + '/rest/v1/practitioner_schedules?select=*&valid_from=lte.' + today +
        '&or=(valid_until.is.null,valid_until.gte.' + today + ')&order=day_of_week,start_time',
      { headers: headers }
    ).then(function (r) { return r.json(); }),
    fetch(
      SUPABASE_URL + '/rest/v1/practice_hours?select=*&is_closed=eq.false&order=day_of_week',
      { headers: headers }
    ).then(function (r) { return r.json(); }),
  ])
    .then(function (results) {
      var practitioners = results[0] || [];
      var schedules = results[1] || [];
      var hours = results[2] || [];
      render(container, practitioners, schedules, hours);
    })
    .catch(function (err) {
      console.warn('[sprechzeiten] Fehler:', err);
      container.innerHTML = '';
    });
})();
