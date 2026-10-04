function formatClock(ms, round = 'ceil') {
  const secondsValue = ms / 1000;
  const totalSeconds = Math.max(0, round === 'floor' ? Math.floor(secondsValue) : Math.ceil(secondsValue));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

