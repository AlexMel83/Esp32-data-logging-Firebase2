async function initializeCharts() {
  chartT = createCounter1Chart();
  chartH = createCounter2Chart();
  chartP = createCounter3Chart();
}

async function updateCharts(uid) {
  // Создаем элемент спиннера
  const spinner = showLoadingSpinner(chartsDivElement);
  spinner.className = "spinner";
  spinner.innerText = "Loading...";

  // Добавляем спиннер в chartsDivElement, не затрагивая существующие элементы
  chartsDivElement.appendChild(spinner);

  chartRange = Number(chartsPointsSelectElement.value);
  if (chartRange === 0) chartRange = Infinity;

  const counters = ["count-1", "count-2", "count-3"];

  counters.forEach((counter) => {
    if (activeListeners.charts[counter]) {
      Object.values(activeListeners.charts[counter]).forEach((listener) => {
        if (listener.ref) {
          listener.ref.off(listener.event, listener.callback);
        }
      });
      activeListeners.charts[counter] = {};
    }
  });

  const promises = counters.map(async (counter, index) => {
    const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);
    const snapshot = await counterRef
      .orderByKey()
      .limitToLast(chartRange === Infinity ? 1000 : chartRange)
      .once("value");

    let allEvents = [];
    const batches = snapshot.val() || {};
    const batchKeys = Object.keys(batches).sort();

    for (const batchKey of batchKeys) {
      const batchSnapshot = await counterRef.child(batchKey).once("value");
      const events = batchSnapshot.val() || {};
      const eventKeys = Object.keys(events).sort();
      eventKeys.forEach((eventKey) => {
        allEvents.push({
          timestamp: Number(eventKey.split("-")[0]),
          value: events[eventKey].counterValue || 0,
        });
      });
    }

    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    const eventsToPlot = allEvents.slice(-chartRange);

    const chart = index === 0 ? chartT : index === 1 ? chartH : chartP;
    if (chart && chart.series && chart.series[0]) {
      chart.series[0].setData([]);
      eventsToPlot.forEach((event) => {
        plotValues(chart, event.timestamp, event.value);
      });
    }

    activeListeners.charts[counter] = {};

    const addChartEventListenerToBatch = (batchKey) => {
      const batchRef = counterRef.child(batchKey);

      const callback = (eventSnapshot) => {
        const eventKey = eventSnapshot.key;
        const eventData = eventSnapshot.val();
        const value = eventData.counterValue || 0;
        plotValues(
          index === 0 ? chartT : index === 1 ? chartH : chartP,
          Number(eventKey.split("-")[0]),
          value
        );
      };

      const errorCallback = (error) => {
        console.error(
          `Error in chart event listener for ${counter}/${batchKey}:`,
          error
        );
      };

      const listenerKey = `batch_${batchKey}`;
      if (activeListeners.charts[counter][listenerKey]) {
        batchRef.off(
          "child_added",
          activeListeners.charts[counter][listenerKey].callback
        );
      }

      activeListeners.charts[counter][listenerKey] = {
        ref: batchRef,
        event: "child_added",
        callback: callback,
      };

      batchRef.on("child_added", callback, errorCallback);
    };

    counterRef.once("value", (snapshot) => {
      const batches = snapshot.val() || {};
      const batchKeys = Object.keys(batches).sort();
      batchKeys.forEach(addChartEventListenerToBatch);
    });

    const batchCallback = (batchSnapshot) => {
      const batchKey = batchSnapshot.key;
      addChartEventListenerToBatch(batchKey);
    };

    const batchErrorCallback = (error) => {
      console.error(`Error in chart batch listener for ${counter}:`, error);
    };

    activeListeners.charts[counter].main = {
      ref: counterRef,
      event: "child_added",
      callback: batchCallback,
    };

    counterRef.on("child_added", batchCallback, batchErrorCallback);
  });

  try {
    await Promise.all(promises);
    spinner.remove();
    const chartContainers =
      chartsDivElement.querySelectorAll(".chart-container");
    chartContainers.forEach((container) => container.remove());
    if (chartT) chartsDivElement.appendChild(chartT.container);
    if (chartH) chartsDivElement.appendChild(chartH.container);
    if (chartP) chartsDivElement.appendChild(chartP.container);
  } catch (error) {
    console.error("Error loading charts:", error);
    spinner.remove();
    const chartContainers =
      chartsDivElement.querySelectorAll(".chart-container");
    chartContainers.forEach((container) => container.remove());
    const errorMessage = document.createElement("p");
    errorMessage.innerHTML = "Error loading charts. Please try again.";
    chartsDivElement.appendChild(errorMessage);
    alert("Failed to load charts. Please try again.");
  }
}

window.initializeCharts = initializeCharts;
window.updateCharts = updateCharts;
