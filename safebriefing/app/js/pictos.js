/*
 * SafeBriefing – Sicherheitszeichen (symbolische Darstellung)
 *
 * Vereinfachte Zeichnungen, angelehnt an DIN EN ISO 7010 / ASR A1.3.
 * Im Produkt werden lizenzierte Originalzeichen eingesetzt.
 */
(function (root) {
  'use strict';

  var BLUE = '#1F5FA8', YELLOW = '#F7B500', RED = '#C8102E', GREEN = '#1E7F4F', BLACK = '#111111', WHITE = '#FFFFFF';

  function svg(inner, label) {
    return '<svg viewBox="0 0 100 100" role="img" aria-label="' + label + '" focusable="false">' + inner + '</svg>';
  }
  function mandatory(glyph) { return '<circle cx="50" cy="50" r="48" fill="' + BLUE + '"/>' + glyph; }
  function warning(glyph) { return '<path d="M50 7 L95 87 H5 Z" fill="' + YELLOW + '" stroke="' + BLACK + '" stroke-width="6" stroke-linejoin="round"/>' + glyph; }
  function prohibition(glyph) {
    return '<circle cx="50" cy="50" r="44" fill="' + WHITE + '" stroke="' + RED + '" stroke-width="9"/>' + glyph +
      '<line x1="19" y1="19" x2="81" y2="81" stroke="' + RED + '" stroke-width="9"/>';
  }
  function safe(glyph) { return '<rect x="2" y="2" width="96" height="96" rx="6" fill="' + GREEN + '"/>' + glyph; }

  var P = {
    brille: { code: 'M004', label: 'Augenschutz benutzen',
      body: mandatory('<g fill="' + WHITE + '"><rect x="18" y="40" width="28" height="22" rx="9"/><rect x="54" y="40" width="28" height="22" rx="9"/><rect x="44" y="47" width="12" height="6"/></g><path d="M18 50 H10 M82 50 H90" stroke="' + WHITE + '" stroke-width="5" stroke-linecap="round"/>') },
    gehoer: { code: 'M003', label: 'Gehörschutz benutzen',
      body: mandatory('<path d="M27 54 A23 23 0 0 1 73 54" fill="none" stroke="' + WHITE + '" stroke-width="7"/><g fill="' + WHITE + '"><rect x="15" y="46" width="17" height="28" rx="7"/><rect x="68" y="46" width="17" height="28" rx="7"/></g>') },
    weste: { code: 'M015', label: 'Warnkleidung benutzen',
      body: mandatory('<path d="M35 20 H44 L50 32 L56 20 H65 L75 33 L72 80 H28 L25 33 Z" fill="' + WHITE + '"/><rect x="28" y="52" width="44" height="5" fill="' + BLUE + '"/><rect x="28" y="64" width="44" height="5" fill="' + BLUE + '"/>') },
    stapler: { code: 'W014', label: 'Warnung vor Flurförderzeugen',
      body: warning('<g fill="' + BLACK + '"><rect x="27" y="60" width="28" height="14" rx="2"/><rect x="58" y="40" width="4" height="36"/><rect x="62" y="72" width="15" height="3"/><circle cx="34" cy="77" r="5"/><circle cx="50" cy="77" r="5"/></g><path d="M31 60 V47 H47 L54 60" fill="none" stroke="' + BLACK + '" stroke-width="4" stroke-linejoin="round"/>') },
    spannung: { code: 'W012', label: 'Warnung vor elektrischer Spannung',
      body: warning('<path d="M55 33 L39 61 H50 L44 82 L63 52 H52 L60 33 Z" fill="' + BLACK + '"/>') },
    achtung: { code: 'W001', label: 'Allgemeines Warnzeichen',
      body: warning('<rect x="45.5" y="36" width="9" height="28" rx="3" fill="' + BLACK + '"/><circle cx="50" cy="73" r="5" fill="' + BLACK + '"/>') },
    quetsch: { code: 'W024', label: 'Warnung vor Handverletzungen (Quetschen)',
      body: warning('<g fill="' + BLACK + '"><circle cx="39" cy="66" r="10"/><circle cx="61" cy="66" r="10"/><rect x="45" y="36" width="10" height="24" rx="4"/></g>') },
    zutritt: { code: 'D-P006', label: 'Zutritt für Unbefugte verboten',
      body: prohibition('<g fill="' + BLACK + '"><circle cx="50" cy="29" r="7"/><path d="M42 39 H58 L61 60 H56 L54 80 H46 L44 60 H39 Z"/></g>') },
    feuer: { code: 'P003', label: 'Keine offene Flamme',
      body: prohibition('<path d="M50 22 C63 37 69 49 63 64 C59 75 41 76 37 64 C33 53 41 46 46 39 C46 50 50 54 54 51 C58 45 55 34 50 22 Z" fill="' + BLACK + '"/>') },
    loto: { code: 'P031', label: 'Schalten verboten',
      body: prohibition('<rect x="33" y="58" width="34" height="12" rx="2" fill="' + BLACK + '"/><path d="M50 61 L61 33" stroke="' + BLACK + '" stroke-width="7" stroke-linecap="round"/>') },
    foto: { code: 'P029', label: 'Fotografieren verboten',
      body: prohibition('<g fill="' + BLACK + '"><rect x="27" y="39" width="46" height="31" rx="4"/><rect x="40" y="33" width="14" height="8" rx="2"/></g><circle cx="50" cy="55" r="9" fill="' + WHITE + '"/>') },
    sammelstelle: { code: 'E007', label: 'Sammelstelle',
      body: safe('<g fill="' + WHITE + '"><circle cx="50" cy="40" r="6"/><path d="M44 48 H56 L57 64 H43 Z"/><circle cx="36" cy="46" r="5"/><path d="M31 53 H41 L42 66 H30 Z"/><circle cx="64" cy="46" r="5"/><path d="M59 53 H69 L70 66 H58 Z"/></g><g stroke="' + WHITE + '" stroke-width="4" fill="none" stroke-linecap="round"><path d="M12 12 L24 24 M12 88 L24 76 M88 12 L76 24 M88 88 L76 76"/></g>') },
    erstehilfe: { code: 'E003', label: 'Erste Hilfe',
      body: safe('<g fill="' + WHITE + '"><rect x="40" y="20" width="20" height="60"/><rect x="20" y="40" width="60" height="20"/></g>') },
    nothalt: { code: '–', label: 'Not-Halt-Taster (kein Normzeichen)',
      body: '<circle cx="50" cy="50" r="47" fill="' + YELLOW + '" stroke="' + BLACK + '" stroke-width="3"/><circle cx="50" cy="50" r="27" fill="' + RED + '"/><circle cx="43" cy="42" r="7" fill="#E8505F"/>' },
    erlaubnis: { code: '–', label: 'Erlaubnisschein (kein Normzeichen)',
      body: mandatory('<path d="M33 19 H58 L69 30 V81 H33 Z" fill="' + WHITE + '"/><g stroke="' + BLUE + '" stroke-width="4" stroke-linecap="round"><path d="M40 41 H61 M40 51 H61"/></g><path d="M41 66 L48 73 L62 59" fill="none" stroke="' + GREEN + '" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>') }
  };

  function picto(id, size) {
    var p = P[id];
    if (!p) return '';
    var s = size ? ' style="width:' + size + ';height:' + size + '"' : '';
    return '<span class="picto" title="' + p.code + ' · ' + p.label + '"' + s + '>' + svg(p.body, p.label) + '</span>';
  }

  root.SB_PICTOS = { all: P, render: picto };
})(typeof globalThis !== 'undefined' ? globalThis : this);
