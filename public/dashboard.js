async function initializeDashboard(user) {
  const uid = await setupUI(user);
  if (!uid) return;

  // Initialize gauges
  const gaugeA = createTemperatureGauge(0);
  const gaugeB = createHumidityGauge(0);
  const gaugeC = createPressureGauge(0);
  gaugeA.draw();
  gaugeB.draw();
  gaugeC.draw();

  // Set initial loading state
  counter1Element.innerHTML = "Loading...";
  counter2Element.innerHTML = "Loading...";
  counter3Element.innerHTML = "Loading...";
  updateElement.innerHTML = "Loading...";

  // Load counters and set up listeners
  await initializeCounters(uid, gaugeA, gaugeB, gaugeC);
  setupEventListeners(uid, gaugeA, gaugeB, gaugeC);

  // Initialize charts if enabled
  if (chartsCheckboxElement.checked) {
    initializeCharts();
    updateCharts(uid);
  }
}
