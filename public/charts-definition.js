let chartT, chartH, chartP;

function createCounter1Chart() {
  if (chartT && chartT.destroy) {
    console.log("Destroying existing chartT");
    chartT.destroy();
  }
  var chart = new Highcharts.Chart({
    chart: { renderTo: "chart-counter1", type: "spline" },
    series: [{ name: 'Лінія "А"' }],
    title: { text: 'Лінія "А"' },
    plotOptions: { line: { animation: false, dataLabels: { enabled: true } } },
    xAxis: {
      type: "datetime",
      dateTimeLabelFormats: {
        millisecond: "%H:%M:%S.%L",
        second: "%H:%M:%S",
        minute: "%H:%M",
        hour: "%H:%M",
        day: "%e %b",
        month: "%b '%y",
        year: "%Y",
      },
      title: { text: "Час" },
    },
    yAxis: { title: { text: "Кількість (шт)" } },
    credits: { enabled: false },
    accessibility: {
      enabled: false,
    },
  });
  chartT = chart;
  return chart;
}

function createCounter2Chart() {
  if (chartH && chartH.destroy) {
    console.log("Destroying existing chartH");
    chartH.destroy();
  }
  var chart = new Highcharts.Chart({
    chart: { renderTo: "chart-counter2", type: "spline" },
    series: [{ name: 'Лінія "Б"', color: "#50b8b4" }],
    title: { text: 'Лінія "Б"' },
    plotOptions: { line: { animation: false, dataLabels: { enabled: true } } },
    xAxis: {
      type: "datetime",
      dateTimeLabelFormats: {
        millisecond: "%H:%M:%S.%L",
        second: "%H:%M:%S",
        minute: "%H:%M",
        hour: "%H:%M",
        day: "%e %b",
        month: "%b '%y",
        year: "%Y",
      },
      title: { text: "Час" },
    },
    yAxis: { title: { text: "Кількість (шт)" } },
    credits: { enabled: false },
    accessibility: {
      enabled: false,
    },
  });
  chartH = chart;
  return chart;
}

function createCounter3Chart() {
  if (chartP && chartP.destroy) {
    console.log("Destroying existing chartP");
    chartP.destroy();
  }
  var chart = new Highcharts.Chart({
    chart: { renderTo: "chart-counter3", type: "spline" },
    series: [{ name: 'Лінія "В"', color: "#A62639" }],
    title: { text: 'Лінія "В"' },
    plotOptions: { line: { animation: false, dataLabels: { enabled: true } } },
    xAxis: {
      type: "datetime",
      dateTimeLabelFormats: {
        millisecond: "%H:%M:%S.%L",
        second: "%H:%M:%S",
        minute: "%H:%M",
        hour: "%H:%M",
        day: "%e %b",
        month: "%b '%y",
        year: "%Y",
      },
      title: { text: "Час" },
    },
    yAxis: { title: { text: "Кількість (шт)" } },
    credits: { enabled: false },
    accessibility: {
      enabled: false,
    },
  });
  chartP = chart;
  return chart;
}
