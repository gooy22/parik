export function timeWindow(value, now = Date.now()) {
  const day = new Date(now); day.setHours(0,0,0,0);
  const nextDay = offset => { const date = new Date(day); date.setDate(date.getDate()+offset); return +date; };
  let from = now, to;
  if (value === 'today') to = nextDay(1);
  else if (value === 'tomorrow') { from = nextDay(1); to = nextDay(2); }
  else if (value === 'weekend') {
    const offset = day.getDay() === 0 ? 0 : (6-day.getDay()+7)%7;
    from = Math.max(now,nextDay(offset)); to = nextDay(offset+(day.getDay()===0?1:2));
  } else to = now + (value === 'soon' ? 168 : Number(value) || 24)*3600000;
  return { from, to, range:{fromInHours:Math.max(0,(from-now)/3600000),toInHours:(to-now)/3600000} };
}
