function plotValues(chart, timestamp, value) {
  const x = epochToJsDate(timestamp).getTime();
  const y = Number(value);
  if (chart && chart.series && chart.series[0]) {
    if (chart.series[0].data.length >= chartRange) {
      chart.series[0].addPoint([x, y], true, true, true);
    } else {
      chart.series[0].addPoint([x, y], true, false, true);
    }
  } else {
    console.error("Chart is not initialized or invalid:", chart);
  }
}
