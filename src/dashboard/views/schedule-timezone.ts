/**
 * schedule-timezone.ts — Inline <script> that converts schedule times
 * between UTC (stored) and the browser's local timezone (displayed).
 *
 * Server always stores and accepts UTC.  This script:
 *   1. Converts display-only spans from UTC → local on page load.
 *   2. Converts form field values from UTC → local on page load.
 *   3. Converts form values back to UTC on submit (regular + htmx).
 *   4. Rewrites "(UTC)" labels to the local timezone abbreviation.
 *   5. Localises UTC datetime strings (next_run_at, last_run_at, etc.).
 */

export function renderScheduleTimezoneScript(): string {
  return `
<script>
(function() {
  var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function utcToLocal(wkUtc, timeUtc) {
    var p = timeUtc.split(':');
    // Use current week so the DST offset is correct for today
    var now = new Date();
    var refDate = now.getUTCDate() - now.getUTCDay() + wkUtc;
    var d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), refDate, +p[0], +p[1]));
    return { weekday: d.getDay(), time: pad(d.getHours()) + ':' + pad(d.getMinutes()) };
  }

  function localToUtc(wkLocal, timeLocal) {
    var p = timeLocal.split(':');
    // Use current week so the DST offset is correct for today
    var now = new Date();
    var refDate = now.getDate() - now.getDay() + wkLocal;
    var d = new Date(now.getFullYear(), now.getMonth(), refDate, +p[0], +p[1]);
    return { weekday: d.getUTCDay(), time: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
  }

  var tz;
  try { tz = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop(); }
  catch(e) { tz = 'local'; }

  /* 1. Display-only schedule time spans */
  document.querySelectorAll('[data-utc-weekday][data-utc-time]:not([data-tz-weekday])').forEach(function(el) {
    var wk = parseInt(el.getAttribute('data-utc-weekday'), 10);
    var tm = el.getAttribute('data-utc-time');
    if (isNaN(wk) || !tm) return;
    var l = utcToLocal(wk, tm);
    el.textContent = DAYS[l.weekday] + ' ' + l.time + ' ' + tz;
  });

  /* 2. UTC datetime strings → local */
  document.querySelectorAll('[data-utc-datetime]').forEach(function(el) {
    var raw = el.getAttribute('data-utc-datetime');
    if (!raw) return;
    var d = new Date(raw.replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return;
    el.textContent = d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  });

  /* 3. Form fields: UTC → local on load, local → UTC on submit */
  document.querySelectorAll('[data-schedule-tz]').forEach(function(form) {
    var wkSel = form.querySelector('[data-tz-weekday]');
    var tmInp = form.querySelector('[data-tz-time]');
    if (!wkSel || !tmInp) return;

    var l = utcToLocal(parseInt(wkSel.value, 10), tmInp.value);
    wkSel.value = String(l.weekday);
    tmInp.value = l.time;

    /* regular form POST */
    form.addEventListener('submit', function() {
      var u = localToUtc(parseInt(wkSel.value, 10), tmInp.value);
      wkSel.value = String(u.weekday);
      tmInp.value = u.time;
    });

    /* htmx: patch request params, leave visible fields as local */
    form.addEventListener('htmx:configRequest', function(evt) {
      var u = localToUtc(parseInt(wkSel.value, 10), tmInp.value);
      var p = evt.detail.parameters;
      if (wkSel.name in p) p[wkSel.name] = String(u.weekday);
      if (tmInp.name in p) p[tmInp.name] = u.time;
    });
  });

  /* 4. Rewrite "(UTC)" labels */
  document.querySelectorAll('[data-tz-label]').forEach(function(el) {
    el.textContent = el.textContent.replace(/\\bUTC\\b/g, tz);
  });
})();
</script>`;
}
