/**
 * ORTHO-036: Karriere Pop-up für Framer Website
 *
 * Einbettung in Framer: Settings → Custom Code → End of <body> tag
 * <script src="https://orthopaedie-booking.vercel.app/karriere-popup.js"></script>
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ortho_karriere_popup_closed';
  var DELAY_MS = 2500;
  var HIDE_DAYS = 7;

  // Prüfen ob kürzlich geschlossen
  var closedAt = localStorage.getItem(STORAGE_KEY);
  if (closedAt) {
    var diff = Date.now() - parseInt(closedAt, 10);
    if (diff < HIDE_DAYS * 86400000) return;
  }

  function close(overlay) {
    overlay.style.opacity = '0';
    setTimeout(function () { overlay.remove(); }, 300);
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  }

  function createPopup() {
    // Overlay
    var overlay = document.createElement('div');
    overlay.id = 'ortho-karriere-overlay';
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);' +
      'z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;' +
      'opacity:0;transition:opacity 0.3s ease;';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close(overlay);
    });

    // Modal
    var modal = document.createElement('div');
    modal.style.cssText =
      'background:#FFFFFF;border-radius:12px;padding:36px 32px 28px;max-width:500px;width:100%;' +
      'position:relative;box-shadow:0 20px 60px rgba(0,0,0,0.15);transform:translateY(20px);' +
      'transition:transform 0.3s ease;';

    // Close Button
    var closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.style.cssText =
      'position:absolute;top:12px;right:16px;background:none;border:none;font-size:24px;' +
      'color:#9CA3AF;cursor:pointer;padding:4px 8px;line-height:1;transition:color 0.2s;';
    closeBtn.onmouseover = function () { this.style.color = '#374151'; };
    closeBtn.onmouseout = function () { this.style.color = '#9CA3AF'; };
    closeBtn.onclick = function () { close(overlay); };
    modal.appendChild(closeBtn);

    // Icon
    var icon = document.createElement('div');
    icon.style.cssText =
      'width:48px;height:48px;background:#EBF5FF;border-radius:12px;display:flex;' +
      'align-items:center;justify-content:center;margin-bottom:20px;font-size:24px;';
    icon.textContent = '\uD83E\uDE7A';
    modal.appendChild(icon);

    // Heading
    var heading = document.createElement('h2');
    heading.style.cssText =
      'font-family:Arial,sans-serif;font-size:22px;font-weight:700;color:#1F2937;' +
      'margin:0 0 12px 0;line-height:1.3;';
    heading.textContent = 'Wir suchen Verstärkung!';
    modal.appendChild(heading);

    // Text
    var text = document.createElement('p');
    text.style.cssText =
      'font-family:Arial,sans-serif;font-size:15px;color:#4B5563;line-height:1.6;' +
      'margin:0 0 24px 0;';
    text.textContent =
      'Die Orthopädie Königstraße sucht ab sofort engagierte Medizinische Fachangestellte (MFA) ' +
      'sowie Fachärzte für Orthopädie und Unfallchirurgie. Werden Sie Teil unseres Teams in Hannover.';
    modal.appendChild(text);

    // Buttons
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;';

    var applyBtn = document.createElement('a');
    applyBtn.href = 'mailto:bewerbung@orthopaedie-koenigstrasse.de?subject=Bewerbung';
    applyBtn.style.cssText =
      'display:inline-block;padding:12px 24px;background:#2674BB;color:#FFFFFF;' +
      'border-radius:8px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;' +
      'text-decoration:none;text-align:center;transition:background 0.2s;flex:1;min-width:140px;';
    applyBtn.onmouseover = function () { this.style.background = '#1E5A96'; };
    applyBtn.onmouseout = function () { this.style.background = '#2674BB'; };
    applyBtn.textContent = 'Jetzt bewerben';
    btnRow.appendChild(applyBtn);

    var moreBtn = document.createElement('a');
    moreBtn.href = '/karriere';
    moreBtn.style.cssText =
      'display:inline-block;padding:12px 24px;background:#F3F4F6;color:#374151;' +
      'border-radius:8px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;' +
      'text-decoration:none;text-align:center;transition:background 0.2s;flex:1;min-width:140px;';
    moreBtn.onmouseover = function () { this.style.background = '#E5E7EB'; };
    moreBtn.onmouseout = function () { this.style.background = '#F3F4F6'; };
    moreBtn.textContent = 'Mehr erfahren';
    btnRow.appendChild(moreBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);

    return overlay;
  }

  setTimeout(function () {
    var popup = createPopup();
    document.body.appendChild(popup);
    // Trigger animation
    requestAnimationFrame(function () {
      popup.style.opacity = '1';
      popup.querySelector('div[style*="translateY"]').style.transform = 'translateY(0)';
    });
  }, DELAY_MS);
})();
