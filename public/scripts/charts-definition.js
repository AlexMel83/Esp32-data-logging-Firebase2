let chartT, chartH, chartP;

function createCounter1Chart() {
  if (chartT && chartT.destroy) {
    console.log("Destroying existing chartT");
    chartT.destroy();
  }
  console.log("Creating new chartT");
  var chart = new Highcharts.Chart({
    chart: { renderTo: "chart-temperature", type: "spline" },
    series: [{ name: "Counter 1" }],
    title: { text: undefined },
    plotOptions: { line: { animation: false, dataLabels: { enabled: true } } },
    xAxis: { type: "datetime", dateTimeLabelFormats: { second: "%H:%M:%S" } },
    yAxis: { title: { text: "Counter 1 Value" } },
    credits: { enabled: false },
  });
  chartT = chart;
  return chart;
}

function createCounter2Chart() {
  if (chartH && chartH.destroy) {
    console.log("Destroying existing chartH");
    chartH.destroy();
  }
  console.log("Creating new chartH");
  var chart = new Highcharts.Chart({
    chart: { renderTo: "chart-humidity", type: "spline" },
    series: [{ name: "Counter 2" }],
    title: { text: undefined },
    plotOptions: {
      line: { animation: false, dataLabels: { enabled: true } },
      series: { color: "#50b8b4" },
    },
    xAxis: { type: "datetime", dateTimeLabelFormats: { second: "%H:%M:%S" } },
    yAxis: { title: { text: "Counter 2 Value" } },
    credits: { enabled: false },
  });
  chartH = chart;
  return chart;
}

function createCounter3Chart() {
  if (chartP && chartP.destroy) {
    console.log("Destroying existing chartP");
    chartP.destroy();
  }
  console.log("Creating new chartP");
  var chart = new Highcharts.Chart({
    chart: { renderTo: "chart-pressure", type: "spline" },
    series: [{ name: "Counter 3" }],
    title: { text: undefined },
    plotOptions: {
      line: { animation: false, dataLabels: { enabled: true } },
      series: { color: "#A62639" },
    },
    xAxis: { type: "datetime", dateTimeLabelFormats: { second: "%H:%M:%S" } },
    yAxis: { title: { text: "Counter 3 Value" } },
    credits: { enabled: false },
  });
  chartP = chart;
  return chart;
}

// Инициализируем графики один раз при загрузке
document.addEventListener("DOMContentLoaded", () => {
  chartT = createCounter1Chart();
  chartH = createCounter2Chart();
  chartP = createCounter3Chart();
});
