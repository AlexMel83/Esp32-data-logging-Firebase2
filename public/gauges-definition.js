// Create Counter 1 Gauge (Лінія "А")
function createTemperatureGauge() {
  var gauge = new RadialGauge({
    renderTo: "gauge-line-a",
    units: "шт",
    title: 'Лінія "А"',
    minValue: 0,
    maxValue: 100,
    colorValueBoxRect: "#049faa",
    colorValueBoxRectEnd: "#049faa",
    colorValueBoxBackground: "#f1fbfc",
    valueInt: 1,
    majorTicks: ["0", "20", "40", "60", "80", "100"],
    minorTicks: 4,
    strokeTicks: true,
    highlights: [{ from: 80, to: 100, color: "#03C0C1" }],
    colorPlate: "#fff",
    borderShadowWidth: 0,
    borders: false,
    needleType: "line",
    colorNeedle: "#007F80",
    colorNeedleEnd: "#007F80",
    needleWidth: 2,
    needleCircleSize: 3,
    colorNeedleCircleOuter: "#007F80",
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 1500,
    animationRule: "linear",
  });
  return gauge;
}

// Create Counter 2 Gauge (Лінія "Б")
function createHumidityGauge() {
  var gauge = new RadialGauge({
    renderTo: "gauge-line-b",
    units: "шт",
    title: 'Лінія "Б"',
    minValue: 0,
    maxValue: 100,
    colorValueBoxRect: "#049faa",
    colorValueBoxRectEnd: "#049faa",
    colorValueBoxBackground: "#f1fbfc",
    valueInt: 1,
    majorTicks: ["0", "20", "40", "60", "80", "100"],
    minorTicks: 4,
    strokeTicks: true,
    highlights: [{ from: 80, to: 100, color: "#03C0C1" }],
    colorPlate: "#fff",
    borderShadowWidth: 0,
    borders: false,
    needleType: "line",
    colorNeedle: "#007F80",
    colorNeedleEnd: "#007F80",
    needleWidth: 2,
    needleCircleSize: 3,
    colorNeedleCircleOuter: "#007F80",
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 1500,
    animationRule: "linear",
  });
  return gauge;
}

// Create Counter 3 Gauge (Лінія "В")
function createPressureGauge() {
  var gauge = new RadialGauge({
    renderTo: "gauge-line-c",
    units: "шт",
    title: 'Лінія "В"',
    minValue: 0,
    maxValue: 100,
    colorValueBoxRect: "#049faa",
    colorValueBoxRectEnd: "#049faa",
    colorValueBoxBackground: "#f1fbfc",
    valueInt: 1,
    majorTicks: ["0", "20", "40", "60", "80", "100"],
    minorTicks: 4,
    strokeTicks: true,
    highlights: [{ from: 80, to: 100, color: "#03C0C1" }],
    colorPlate: "#fff",
    borderShadowWidth: 0,
    borders: false,
    needleType: "line",
    colorNeedle: "#007F80",
    colorNeedleEnd: "#007F80",
    needleWidth: 2,
    needleCircleSize: 3,
    colorNeedleCircleOuter: "#007F80",
    needleCircleOuter: true,
    needleCircleInner: false,
    animationDuration: 1500,
    animationRule: "linear",
  });
  return gauge;
}
