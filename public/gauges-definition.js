// Функция для определения параметров индикатора в зависимости от значения
function getGaugeConfig(value) {
  if (value <= 100) {
    return {
      maxValue: 100,
      majorTicks: ["0", "20", "40", "60", "80", "100"],
      highlights: [{ from: 80, to: 100, color: "#03C0C1" }],
    };
  } else if (value <= 500) {
    return {
      maxValue: 500,
      majorTicks: ["0", "100", "200", "300", "400", "500"],
      highlights: [{ from: 400, to: 500, color: "#03C0C1" }],
    };
  } else if (value <= 1000) {
    return {
      maxValue: 1000,
      majorTicks: ["0", "200", "400", "600", "800", "1000"],
      highlights: [{ from: 800, to: 1000, color: "#03C0C1" }],
    };
  } else {
    // Если значение больше 1000, можно добавить еще одну градацию или оставить 1000
    return {
      maxValue: 1000,
      majorTicks: ["0", "200", "400", "600", "800", "1000"],
      highlights: [{ from: 800, to: 1000, color: "#03C0C1" }],
    };
  }
}

// Create Counter 1 Gauge (Лінія "А")
function createTemperatureGauge(initialValue = 0) {
  const config = getGaugeConfig(initialValue);
  var gauge = new RadialGauge({
    renderTo: "gauge-line-a",
    units: "шт",
    title: 'Лінія "А"',
    minValue: 0,
    maxValue: config.maxValue,
    colorValueBoxRect: "#049faa",
    colorValueBoxRectEnd: "#049faa",
    colorValueBoxBackground: "#f1fbfc",
    valueInt: 1,
    majorTicks: config.majorTicks,
    minorTicks: 4,
    strokeTicks: true,
    highlights: config.highlights,
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
    value: initialValue,
  });
  return gauge;
}

// Create Counter 2 Gauge (Лінія "Б")
function createHumidityGauge(initialValue = 0) {
  const config = getGaugeConfig(initialValue);
  var gauge = new RadialGauge({
    renderTo: "gauge-line-b",
    units: "шт",
    title: 'Лінія "Б"',
    minValue: 0,
    maxValue: config.maxValue,
    colorValueBoxRect: "#049faa",
    colorValueBoxRectEnd: "#049faa",
    colorValueBoxBackground: "#f1fbfc",
    valueInt: 1,
    majorTicks: config.majorTicks,
    minorTicks: 4,
    strokeTicks: true,
    highlights: config.highlights,
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
    value: initialValue,
  });
  return gauge;
}

// Create Counter 3 Gauge (Лінія "В")
function createPressureGauge(initialValue = 0) {
  const config = getGaugeConfig(initialValue);
  var gauge = new RadialGauge({
    renderTo: "gauge-line-c",
    units: "шт",
    title: 'Лінія "В"',
    minValue: 0,
    maxValue: config.maxValue,
    colorValueBoxRect: "#049faa",
    colorValueBoxRectEnd: "#049faa",
    colorValueBoxBackground: "#f1fbfc",
    valueInt: 1,
    majorTicks: config.majorTicks,
    minorTicks: 4,
    strokeTicks: true,
    highlights: config.highlights,
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
    value: initialValue,
  });
  return gauge;
}

// Функция для обновления параметров индикатора
function updateGauge(gauge, value) {
  const config = getGaugeConfig(value);
  gauge.update({
    maxValue: config.maxValue,
    majorTicks: config.majorTicks,
    highlights: config.highlights,
    value: value,
  });
}
