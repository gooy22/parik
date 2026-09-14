const origin = 'https://24parik-bet.org';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The provider's SportCompetitor component uses this taxonomy route and feed ID.
// Prefer its explicit asset path when supplied; do not match clubs by name.
export function emblemURL(team) {
  const path = String(team.icon?.url || '').replace(/^\//,'');
  if(/^taxonomyicons\/competitors\/\d{1,12}-164w$/.test(path))return `${origin}/${path}`;
  const id = String(team.id ?? '');
  return /^\d{1,12}$/.test(id) ? `${origin}/taxonomyicons/competitors/${id}-164w` : null;
}
export function teamEmblem(team) {
  const url = emblemURL(team);
  const initials = String(team.name || '').trim().split(/\s+/).slice(0,2).map(word=>Array.from(word)[0]||'').join('').toUpperCase() || '—';
  return `<span class="team-emblem-picture">${url ? `<img class="team-logo" src="${escape(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">` : ''}<span class="team-emblem-fallback" ${url?'hidden':''} title="${escape(team.name)}">${escape(initials)}</span></span>`;
}
