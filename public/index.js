// Convert epoch time to JavaScript Date object
function epochToJsDate(epochTime) {
  const seconds = Math.floor(Number(epochTime) / 1000);
  const milliseconds = Number(epochTime) % 1000;
  return new Date(seconds * 1000 + milliseconds);
}

// Convert time to human-readable format YYYY/MM/DD HH:MM:SS
function epochToDateTime(epochTime) {
  const epochDate = epochToJsDate(epochTime);
  return (
    epochDate.getFullYear() +
    "/" +
    ("00" + (epochDate.getMonth() + 1)).slice(-2) +
    "/" +
    ("00" + epochDate.getDate()).slice(-2) +
    " " +
    ("00" + epochDate.getHours()).slice(-2) +
    ":" +
    ("00" + epochDate.getMinutes()).slice(-2) +
    ":" +
    ("00" + epochDate.getSeconds()).slice(-2) +
    "." +
    ("000" + (Number(epochTime) % 1000)).slice(-3)
  );
}

// Function to plot values on charts
function plotValues(chart, timestamp, value) {
  var x = epochToJsDate(timestamp).getTime();
  var y = Number(value);
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

// DOM elements
const loginElement = document.querySelector("#login-form");
const contentElement = document.querySelector("#content-sign-in");
const userDetailsElement = document.querySelector("#user-details");
const authBarElement = document.querySelector("#authentication-bar");
const deleteButtonElement = document.getElementById("delete-button");
const deleteModalElement = document.getElementById("delete-modal");
const deleteDataFormElement = document.querySelector("#delete-data-form");
const viewDataButtonElement = document.getElementById("view-data-button");
const hideDataButtonElement = document.getElementById("hide-data-button");
const tableContainerElement = document.querySelector("#table-container");
const chartsPointsSelectElement = document.getElementById(
  "charts-points-select"
);
const loadDataButtonElement = document.getElementById("load-data");
const cardsCheckboxElement = document.querySelector(
  "input[name=cards-checkbox]"
);
const gaugesCheckboxElement = document.querySelector(
  "input[name=gauges-checkbox]"
);
const chartsCheckboxElement = document.querySelector(
  "input[name=charts-checkbox]"
);
const cardsReadingsElement = document.querySelector("#cards-div");
const gaugesReadingsElement = document.querySelector("#gauges-div");
const chartsDivElement = document.querySelector("#charts-div");
const counter1Element = document.getElementById("counter1");
const counter2Element = document.getElementById("counter2");
const counter3Element = document.getElementById("counter3");
const updateElement = document.getElementById("lastUpdate");

// Global chart range
let chartRange = 50;

// Charts variables (will be lazily initialized)
let chartA, chartB, chartC;

// Listener references to manage and remove them when needed
const activeListeners = {
  cards: {},
  charts: {},
  tables: {},
};

// Show loading spinner
function showLoadingSpinner(container) {
  container.innerHTML = '<div class="spinner">Loading...</div>';
}

// Manage UI based on login state
async function setupUI(user) {
  console.log("setupUI called with user:", user);
  if (!user) {
    loginElement.style.display = "block";
    authBarElement.style.display = "none";
    userDetailsElement.style.display = "none";
    contentElement.style.display = "none";
    return;
  }

  loginElement.style.display = "none";
  contentElement.style.display = "block";
  authBarElement.style.display = "block";
  userDetailsElement.style.display = "block";
  userDetailsElement.innerHTML = user.email;

  const uid = user.uid;
  console.log("User UID:", uid);

  if (uid !== "cRtGblv0T3R2vXazmLnjTSNrlpJ3") {
    console.error(
      "UID mismatch! Expected: cRtGblv0T3R2vXazmLnjTSNrlpJ3, Got:",
      uid
    );
    alert(
      "UID mismatch! Please ensure you are logged in with the correct user."
    );
    return;
  }

  const dbRef = firebase.database().ref(`UsersData/${uid}`);

  // Initialize gauges with initial value 0
  var gaugeA = createTemperatureGauge(0);
  var gaugeB = createHumidityGauge(0);
  var gaugeC = createPressureGauge(0);
  gaugeA.draw();
  gaugeB.draw();
  gaugeC.draw();

  // Set initial state of UI elements
  cardsReadingsElement.style.display = cardsCheckboxElement.checked
    ? "block"
    : "none";
  gaugesReadingsElement.style.display = gaugesCheckboxElement.checked
    ? "block"
    : "none";
  chartsDivElement.style.display = chartsCheckboxElement.checked
    ? "block"
    : "none";
  tableContainerElement.style.display = "none";

  // Update counter values for cards and gauges
  counter1Element.innerHTML = "Loading...";
  counter2Element.innerHTML = "Loading...";
  counter3Element.innerHTML = "Loading...";
  updateElement.innerHTML = "Loading...";

  // Load data for all counters in parallel
  await initializeCounters(uid, gaugeA, gaugeB, gaugeC);

  // Setup event listeners for UI elements
  setupEventListeners(uid, gaugeA, gaugeB, gaugeC);

  // Initialize charts if checkbox is checked
  if (chartsCheckboxElement.checked) {
    initializeCharts();
    updateCharts(uid);
  }
}

// Initialize counters and their initial values
async function initializeCounters(uid, gaugeA, gaugeB, gaugeC) {
  const counters = ["count-1", "count-2", "count-3"];
  const promises = counters.map(async (counter, index) => {
    const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);
    const snapshot = await counterRef.orderByKey().limitToLast(1).once("value");
    const batches = snapshot.val() || {};
    const batchKeys = Object.keys(batches).sort();

    if (batchKeys.length === 0) {
      return { counter, index, value: 0, timestamp: null };
    }

    const latestBatchKey = batchKeys[batchKeys.length - 1];
    const batchRef = counterRef.child(latestBatchKey);
    const eventSnapshot = await batchRef
      .orderByKey()
      .limitToLast(1)
      .once("value");
    const events = eventSnapshot.val() || {};
    const eventKeys = Object.keys(events).sort();

    if (eventKeys.length === 0) {
      return { counter, index, value: 0, timestamp: null };
    }

    const latestEventKey = eventKeys[eventKeys.length - 1];
    const latestValue = events[latestEventKey].counterValue || 0;
    const latestTimestamp = Number(latestEventKey);

    return { counter, index, value: latestValue, timestamp: latestTimestamp };
  });

  try {
    const results = await Promise.all(promises);
    results.forEach(({ index, value, timestamp }) => {
      if (index === 0) counter1Element.innerHTML = value;
      if (index === 1) counter2Element.innerHTML = value;
      if (index === 2) {
        counter3Element.innerHTML = value;
        updateElement.innerHTML = timestamp
          ? epochToDateTime(timestamp)
          : "N/A";
      }
      updateGauge(index === 0 ? gaugeA : index === 1 ? gaugeB : gaugeC, value);
    });

    // Setup real-time listeners for counter updates
    setupCounterListeners(uid, gaugeA, gaugeB, gaugeC);
  } catch (error) {
    console.error("Error loading counter data:", error);
    counter1Element.innerHTML = "Error";
    counter2Element.innerHTML = "Error";
    counter3Element.innerHTML = "Error";
    updateElement.innerHTML = "Error";
  }
}

// Setup real-time listeners for counter updates
function setupCounterListeners(uid, gaugeA, gaugeB, gaugeC) {
  const counters = ["count-1", "count-2", "count-3"];

  // Clear any existing listeners
  counters.forEach((counter) => {
    if (activeListeners.cards[counter]) {
      Object.values(activeListeners.cards[counter]).forEach((listener) => {
        if (listener.ref) {
          listener.ref.off(listener.event, listener.callback);
        }
      });
      activeListeners.cards[counter] = {};
    }
  });

  counters.forEach((counter, index) => {
    const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);
    activeListeners.cards[counter] = {};

    // Function to add listener to batch
    const addEventListenerToBatch = (batchKey) => {
      const batchRef = counterRef.child(batchKey);

      const callback = (eventSnapshot) => {
        const eventKey = eventSnapshot.key;
        const eventData = eventSnapshot.val();
        const latestValue = eventData.counterValue || 0;
        const latestTimestamp = Number(eventKey);

        console.log(`New event in ${counter}/${batchKey}:`, latestValue);

        // Update cards and gauges
        if (index === 0) counter1Element.innerHTML = latestValue;
        if (index === 1) counter2Element.innerHTML = latestValue;
        if (index === 2) {
          counter3Element.innerHTML = latestValue;
          updateElement.innerHTML = epochToDateTime(latestTimestamp);
        }
        updateGauge(
          index === 0 ? gaugeA : index === 1 ? gaugeB : gaugeC,
          latestValue
        );
      };

      const errorCallback = (error) => {
        console.error(
          `Error in event listener for ${counter}/${batchKey}:`,
          error
        );
      };

      // Store listener reference for cleanup
      const listenerKey = `batch_${batchKey}`;
      if (activeListeners.cards[counter][listenerKey]) {
        batchRef.off(
          "child_added",
          activeListeners.cards[counter][listenerKey].callback
        );
      }

      activeListeners.cards[counter][listenerKey] = {
        ref: batchRef,
        event: "child_added",
        callback: callback,
      };

      batchRef.on("child_added", callback, errorCallback);
    };

    // Load existing batches and add listeners
    counterRef.once("value", (snapshot) => {
      const batches = snapshot.val() || {};
      const batchKeys = Object.keys(batches).sort();
      batchKeys.forEach(addEventListenerToBatch);
    });

    // Listen for new batches
    const batchCallback = (batchSnapshot) => {
      const batchKey = batchSnapshot.key;
      addEventListenerToBatch(batchKey);
    };

    const batchErrorCallback = (error) => {
      console.error(`Error in batch listener for ${counter}:`, error);
    };

    // Store listener reference for cleanup
    activeListeners.cards[counter].main = {
      ref: counterRef,
      event: "child_added",
      callback: batchCallback,
    };

    counterRef.on("child_added", batchCallback, batchErrorCallback);
  });
}

// Initialize charts
function initializeCharts() {
  if (!chartA) chartA = createCounter1Chart();
  if (!chartB) chartB = createCounter2Chart();
  if (!chartC) chartC = createCounter3Chart();
}

// Update charts with data
async function updateCharts(uid) {
  showLoadingSpinner(chartsDivElement);
  chartRange = Number(chartsPointsSelectElement.value);
  if (chartRange === 0) chartRange = Infinity;

  const counters = ["count-1", "count-2", "count-3"];

  // Clear existing chart listeners
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
          timestamp: Number(eventKey),
          value: events[eventKey].counterValue || 0,
        });
      });
    }

    allEvents.sort((a, b) => a.timestamp - b.timestamp);
    const eventsToPlot = allEvents.slice(-chartRange);

    const chart = index === 0 ? chartA : index === 1 ? chartB : chartC;
    if (chart && chart.series && chart.series[0]) {
      chart.series[0].setData([]);
      eventsToPlot.forEach((event) => {
        plotValues(chart, event.timestamp, event.value);
      });
    }

    // Setup real-time listeners for charts
    activeListeners.charts[counter] = {};

    // Function to add chart listener to batch
    const addChartEventListenerToBatch = (batchKey) => {
      const batchRef = counterRef.child(batchKey);

      const callback = (eventSnapshot) => {
        const eventKey = eventSnapshot.key;
        const eventData = eventSnapshot.val();
        const value = eventData.counterValue || 0;
        plotValues(
          index === 0 ? chartA : index === 1 ? chartB : chartC,
          Number(eventKey),
          value
        );
      };

      const errorCallback = (error) => {
        console.error(
          `Error in chart event listener for ${counter}/${batchKey}:`,
          error
        );
      };

      // Store listener reference for cleanup
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

    // Load existing batches and add listeners
    counterRef.once("value", (snapshot) => {
      const batches = snapshot.val() || {};
      const batchKeys = Object.keys(batches).sort();
      batchKeys.forEach(addChartEventListenerToBatch);
    });

    // Listen for new batches
    const batchCallback = (batchSnapshot) => {
      const batchKey = batchSnapshot.key;
      addChartEventListenerToBatch(batchKey);
    };

    const batchErrorCallback = (error) => {
      console.error(`Error in chart batch listener for ${counter}:`, error);
    };

    // Store listener reference for cleanup
    activeListeners.charts[counter].main = {
      ref: counterRef,
      event: "child_added",
      callback: batchCallback,
    };

    counterRef.on("child_added", batchCallback, batchErrorCallback);
  });

  try {
    await Promise.all(promises);
    chartsDivElement.innerHTML = "";
    if (chartA) chartsDivElement.appendChild(chartA.container);
    if (chartB) chartsDivElement.appendChild(chartB.container);
    if (chartC) chartsDivElement.appendChild(chartC.container);
  } catch (error) {
    console.error("Error loading charts:", error);
    chartsDivElement.innerHTML =
      "<p>Error loading charts. Please try again.</p>";
    alert("Failed to load charts. Please try again.");
  }
}

// Setup table functionality
async function createTable(uid) {
  showLoadingSpinner(tableContainerElement);

  // Clear any existing table listeners
  const counters = ["count-1", "count-2", "count-3"];
  counters.forEach((counter) => {
    if (activeListeners.tables[counter]) {
      Object.values(activeListeners.tables[counter]).forEach((listener) => {
        if (listener.ref) {
          listener.ref.off(listener.event, listener.callback);
        }
      });
      activeListeners.tables[counter] = {};
    }
  });

  activeListeners.tables = {};

  const lastReadingTimestamps = {
    "count-1": null,
    "count-2": null,
    "count-3": null,
  };

  const promises = counters.map(async (counter) => {
    const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);
    const snapshot = await counterRef
      .orderByKey()
      .limitToLast(100)
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
          timestamp: Number(eventKey),
          value: events[eventKey].counterValue || 0,
        });
      });
    }

    allEvents.sort((a, b) => b.timestamp - a.timestamp);

    if (allEvents.length > 0) {
      lastReadingTimestamps[counter] =
        allEvents[allEvents.length - 1].timestamp;
    }

    return { counter, events: allEvents.slice(0, 100) };
  });

  try {
    const results = await Promise.all(promises);
    let tableRows = [];
    results.forEach(({ counter, events }) => {
      events.forEach((event) => {
        const epochTime = event.timestamp;
        const timestamp = epochToDateTime(epochTime);
        const value = event.value;
        tableRows.push({
          timestamp,
          value,
          counter,
        });
      });

      // Setup real-time table updates
      activeListeners.tables[counter] = {};

      const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);

      const callback = (snapshot) => {
        const batchKey = snapshot.key;
        const events = snapshot.val() || {};
        const eventKeys = Object.keys(events).sort();
        let newEvents = [];

        eventKeys.forEach((eventKey) => {
          newEvents.push({
            timestamp: Number(eventKey),
            value: events[eventKey].counterValue || 0,
          });
        });

        newEvents.sort((a, b) => b.timestamp - a.timestamp);
        newEvents.forEach((event) => {
          const epochTime = event.timestamp;
          const timestamp = epochToDateTime(epochTime);
          const value = event.value;
          const content = `
            <tr>
              <td>${timestamp}</td>
              <td>${counter === "count-1" ? value : "-"}</td>
              <td>${counter === "count-2" ? value : "-"}</td>
              <td>${counter === "count-3" ? value : "-"}</td>
            </tr>
          `;
          $("#tbody").prepend(content);
        });
      };

      const errorCallback = (error) => {
        console.error(
          `Error in table real-time listener for ${counter}:`,
          error
        );
      };

      // Store listener reference for cleanup
      activeListeners.tables[counter].main = {
        ref: counterRef,
        event: "child_added",
        callback: callback,
      };

      counterRef.on("child_added", callback, errorCallback);
    });

    tableRows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const tableHTML = `
      <table id="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Counter 1</th>
            <th>Counter 2</th>
            <th>Counter 3</th>
          </tr>
        </thead>
        <tbody id="tbody">
          ${tableRows
            .map(
              (row) => `
            <tr>
              <td>${row.timestamp}</td>
              <td>${row.counter === "count-1" ? row.value : "-"}</td>
              <td>${row.counter === "count-2" ? row.value : "-"}</td>
              <td>${row.counter === "count-3" ? row.value : "-"}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    `;

    tableContainerElement.innerHTML = tableHTML;
    return lastReadingTimestamps;
  } catch (error) {
    console.error("Error loading table data:", error);
    tableContainerElement.innerHTML =
      "<p>Error loading data. Please try again.</p>";
    return lastReadingTimestamps;
  }
}

// Setup event listeners for UI controls
function setupEventListeners(uid, gaugeA, gaugeB, gaugeC) {
  // Checkboxes for display options
  cardsCheckboxElement.addEventListener("change", (e) => {
    cardsReadingsElement.style.display = e.target.checked ? "block" : "none";
  });

  gaugesCheckboxElement.addEventListener("change", (e) => {
    gaugesReadingsElement.style.display = e.target.checked ? "block" : "none";
  });

  // Charts display and updates
  let debounceTimeout;
  chartsPointsSelectElement.addEventListener("change", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (chartsCheckboxElement.checked) {
        updateCharts(uid);
      }
    }, 300);
  });

  chartsCheckboxElement.addEventListener("change", (e) => {
    chartsDivElement.style.display = e.target.checked ? "block" : "none";
    if (e.target.checked) {
      initializeCharts();
      updateCharts(uid);
    } else {
      // Clear chart listeners when charts are hidden
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
    }
  });

  // Delete data functionality
  deleteButtonElement.addEventListener("click", (e) => {
    e.preventDefault();
    deleteModalElement.style.display = "block";
  });

  deleteDataFormElement.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Clear all listeners before deleting data
    ["cards", "charts", "tables"].forEach((type) => {
      Object.keys(activeListeners[type]).forEach((counter) => {
        Object.values(activeListeners[type][counter]).forEach((listener) => {
          if (listener.ref) {
            listener.ref.off(listener.event, listener.callback);
          }
        });
        activeListeners[type][counter] = {};
      });
    });

    const dbRef = firebase.database().ref(`UsersData/${uid}`);
    await dbRef.remove();
    deleteModalElement.style.display = "none";

    // Reinitialize everything
    setupCounterListeners(uid, gaugeA, gaugeB, gaugeC);
    if (chartsCheckboxElement.checked) {
      updateCharts(uid);
    }
    if (tableContainerElement.style.display === "block") {
      createTable(uid);
    }
  });

  // Table view functionality
  let lastReadingTimestamps = {
    "count-1": null,
    "count-2": null,
    "count-3": null,
  };

  viewDataButtonElement.addEventListener("click", async () => {
    tableContainerElement.style.display = "block";
    viewDataButtonElement.style.display = "none";
    hideDataButtonElement.style.display = "inline-block";
    loadDataButtonElement.style.display = "inline-block";
    lastReadingTimestamps = await createTable(uid);
  });

  loadDataButtonElement.addEventListener("click", async () => {
    loadDataButtonElement.disabled = true;
    loadDataButtonElement.innerText = "Loading...";

    const counters = ["count-1", "count-2", "count-3"];
    const promises = counters.map(async (counter) => {
      const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);
      if (!lastReadingTimestamps[counter]) {
        console.warn(
          `lastReadingTimestamps[${counter}] is null, skipping append for this counter`
        );
        return { counter, events: [] };
      }

      const query = counterRef
        .orderByKey()
        .endBefore(lastReadingTimestamps[counter].toString())
        .limitToLast(100);
      const snapshot = await query.once("value");
      let allEvents = [];
      const batches = snapshot.val() || {};
      const batchKeys = Object.keys(batches).sort();

      for (const batchKey of batchKeys) {
        const batchSnapshot = await counterRef.child(batchKey).once("value");
        const events = batchSnapshot.val() || {};
        const eventKeys = Object.keys(events).sort();
        eventKeys.forEach((eventKey) => {
          const timestamp = Number(eventKey);
          allEvents.push({
            timestamp,
            value: events[eventKey].counterValue || 0,
          });
        });
      }

      allEvents.sort((a, b) => b.timestamp - a.timestamp);

      if (allEvents.length > 0) {
        lastReadingTimestamps[counter] =
          allEvents[allEvents.length - 1].timestamp;
      }

      return { counter, events: allEvents.slice(0, 100) };
    });

    try {
      const results = await Promise.all(promises);
      let tableRows = [];
      results.forEach(({ counter, events }) => {
        events.forEach((event) => {
          const epochTime = event.timestamp;
          const timestamp = epochToDateTime(epochTime);
          const value = event.value;
          tableRows.push({
            timestamp,
            value,
            counter,
          });
        });
      });

      tableRows.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      const tableHTML = tableRows
        .map(
          (row) => `
        <tr>
          <td>${row.timestamp}</td>
          <td>${row.counter === "count-1" ? row.value : "-"}</td>
          <td>${row.counter === "count-2" ? row.value : "-"}</td>
          <td>${row.counter === "count-3" ? row.value : "-"}</td>
        </tr>
      `
        )
        .join("");
      $("#tbody").append(tableHTML);
    } catch (error) {
      console.error("Error appending table data:", error);
      alert("Failed to load more data. Please try again.");
    } finally {
      loadDataButtonElement.disabled = false;
      loadDataButtonElement.innerText = "Load More";
    }
  });

  hideDataButtonElement.addEventListener("click", () => {
    tableContainerElement.style.display = "none";
    viewDataButtonElement.style.display = "inline-block";
    hideDataButtonElement.style.display = "none";
    loadDataButtonElement.style.display = "none";

    // Clear table listeners
    const counters = ["count-1", "count-2", "count-3"];
    counters.forEach((counter) => {
      if (activeListeners.tables[counter]) {
        Object.values(activeListeners.tables[counter]).forEach((listener) => {
          if (listener.ref) {
            listener.ref.off(listener.event, listener.callback);
          }
        });
        activeListeners.tables[counter] = {};
      }
    });
  });
}
