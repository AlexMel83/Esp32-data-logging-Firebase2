// Convert epoch time to JavaScript Date object
function epochToJsDate(epochTime) {
  return new Date(epochTime * 1000);
}

// Convert time to human-readable format YYYY/MM/DD HH:MM:SS
function epochToDateTime(epochTime) {
  var epochDate = new Date(epochToJsDate(epochTime));
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
    ("00" + epochDate.getSeconds()).slice(-2)
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
const chartsRangeInputElement = document.getElementById("charts-range");
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
let chartRange = 10;

// Переменные для графиков (будут инициализированы лениво)
let chartA, chartB, chartC;

// Show loading spinner
function showLoadingSpinner(container) {
  container.innerHTML = '<div class="spinner">Loading...</div>';
}

// Manage UI based on login state
async function setupUI(user) {
  console.log("setupUI called with user:", user);
  if (user) {
    loginElement.style.display = "none";
    contentElement.style.display = "block";
    authBarElement.style.display = "block";
    userDetailsElement.style.display = "block";
    userDetailsElement.innerHTML = user.email;

    const uid = user.uid;
    console.log("User UID:", uid);

    const dbRef = firebase.database().ref(`UsersData/${uid}`);

    // Initialize gauges with initial value 0
    var gaugeA = createTemperatureGauge(0);
    var gaugeB = createHumidityGauge(0);
    var gaugeC = createPressureGauge(0);
    gaugeA.draw();
    gaugeB.draw();
    gaugeC.draw();

    // Графики будут инициализированы лениво при первом включении

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
    tableContainerElement.style.display = "none"; // Таблица изначально скрыта

    // Update counter values for cards and gauges (загружаем сразу)
    counter1Element.innerHTML = "Loading...";
    counter2Element.innerHTML = "Loading...";
    counter3Element.innerHTML = "Loading...";
    updateElement.innerHTML = "Loading...";

    // Загружаем данные для всех счетчиков параллельно
    const counters = ["count-1", "count-2", "count-3"];
    const promises = counters.map(async (counter, index) => {
      const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);
      const snapshot = await counterRef
        .orderByKey()
        .limitToLast(1)
        .once("value");
      const batches = snapshot.val() || {};
      const batchKeys = Object.keys(batches);

      if (batchKeys.length === 0) {
        return { counter, index, value: 0, timestamp: null };
      }

      const latestBatchKey = batchKeys[0];
      const batchRef = counterRef.child(latestBatchKey);
      const eventSnapshot = await batchRef
        .orderByKey()
        .limitToLast(1)
        .once("value");
      const events = eventSnapshot.val() || {};
      const eventKeys = Object.keys(events);

      if (eventKeys.length === 0) {
        return { counter, index, value: 0, timestamp: null };
      }

      const latestEventKey = eventKeys[0];
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
        updateGauge(
          index === 0 ? gaugeA : index === 1 ? gaugeB : gaugeC,
          value
        );
      });

      // Добавляем слушатели для обновления в реальном времени
      counters.forEach((counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef.on(
          "child_added",
          (snapshot) => {
            const batchKey = snapshot.key;
            const batchRef = counterRef.child(batchKey);
            batchRef
              .orderByKey()
              .limitToLast(1)
              .once("value", (eventSnapshot) => {
                const events = eventSnapshot.val() || {};
                const eventKeys = Object.keys(events);
                if (eventKeys.length === 0) return;

                const latestEventKey = eventKeys[0];
                const latestValue = events[latestEventKey].counterValue || 0;
                const latestTimestamp = Number(latestEventKey);

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
              });
          },
          (error) => {
            console.error(`Error in real-time listener for ${counter}:`, error);
          }
        );
      });
    } catch (error) {
      console.error("Error loading counter data:", error);
      counter1Element.innerHTML = "Error";
      counter2Element.innerHTML = "Error";
      counter3Element.innerHTML = "Error";
      updateElement.innerHTML = "Error";
    }

    // Load and update chart data
    async function updateCharts() {
      showLoadingSpinner(chartsDivElement);
      chartRange = Number(chartsRangeInputElement.value) || 10;

      const counters = ["count-1", "count-2", "count-3"];
      const promises = counters.map(async (counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef.off("child_added");

        const snapshot = await counterRef
          .orderByKey()
          .limitToLast(chartRange)
          .once("value");
        let allEvents = [];
        const batches = snapshot.val() || {};
        const batchKeys = Object.keys(batches);

        for (const batchKey of batchKeys) {
          const batchSnapshot = await counterRef.child(batchKey).once("value");
          const events = batchSnapshot.val() || {};
          Object.keys(events).forEach((eventKey) => {
            allEvents.push({
              timestamp: Number(eventKey),
              value: events[eventKey].counterValue || 0,
            });
          });
        }

        allEvents.sort((a, b) => a.timestamp - b.timestamp);
        const eventsToPlot = allEvents.slice(-chartRange);

        const chart = index === 0 ? chartA : index === 1 ? chartB : chartC;
        chart.series[0].setData([]);
        eventsToPlot.forEach((event) => {
          plotValues(chart, event.timestamp, event.value);
        });

        counterRef.on(
          "child_added",
          (snapshot) => {
            const batchKey = snapshot.key;
            const events = snapshot.val() || {};
            Object.keys(events).forEach((eventKey) => {
              const value = events[eventKey].counterValue || 0;
              plotValues(
                index === 0 ? chartA : index === 1 ? chartB : chartC,
                Number(eventKey),
                value
              );
            });
          },
          (error) => {
            console.error(
              `Error in chart real-time listener for ${counter}:`,
              error
            );
          }
        );
      });

      try {
        await Promise.all(promises);
        chartsDivElement.innerHTML = ""; // Очищаем спиннер
        chartsDivElement.appendChild(chartA.container);
        chartsDivElement.appendChild(chartB.container);
        chartsDivElement.appendChild(chartC.container);
      } catch (error) {
        console.error("Error loading charts:", error);
        chartsDivElement.innerHTML =
          "<p>Error loading charts. Please try again.</p>";
        alert("Failed to load charts. Please try again.");
      }
    }

    // Debounce для chartsRangeInputElement.onchange
    let debounceTimeout;
    chartsRangeInputElement.onchange = () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (chartsCheckboxElement.checked) {
          updateCharts();
        }
      }, 300); // Задержка 300 мс
    };

    // Checkbox event listeners
    cardsCheckboxElement.addEventListener("change", (e) => {
      cardsReadingsElement.style.display = e.target.checked ? "block" : "none";
    });

    gaugesCheckboxElement.addEventListener("change", (e) => {
      gaugesReadingsElement.style.display = e.target.checked ? "block" : "none";
    });

    // Ленивая загрузка графиков
    chartsCheckboxElement.addEventListener("change", (e) => {
      chartsDivElement.style.display = e.target.checked ? "block" : "none";
      if (e.target.checked) {
        // Инициализируем графики только при первом включении
        if (!chartA) chartA = createCounter1Chart();
        if (!chartB) chartB = createCounter2Chart();
        if (!chartC) chartC = createCounter3Chart();
        updateCharts();
      } else {
        // Отключаем слушатели, чтобы не загружать данные, пока графики скрыты
        counters.forEach((counter) => {
          const counterRef = firebase
            .database()
            .ref(`UsersData/${uid}/${counter}`);
          counterRef.off("child_added");
        });
      }
    });

    // Delete data functionality
    deleteButtonElement.addEventListener("click", (e) => {
      e.preventDefault();
      deleteModalElement.style.display = "block";
    });

    deleteDataFormElement.addEventListener("submit", (e) => {
      e.preventDefault();
      dbRef.remove();
      deleteModalElement.style.display = "none";
    });

    // Table functionality
    var lastReadingTimestamps = {
      "count-1": null,
      "count-2": null,
      "count-3": null,
    };

    async function createTable() {
      showLoadingSpinner(tableContainerElement);

      const counters = ["count-1", "count-2", "count-3"];
      const promises = counters.map(async (counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        const snapshot = await counterRef
          .orderByKey()
          .limitToLast(100)
          .once("value");
        let allEvents = [];
        const batches = snapshot.val() || {};
        const batchKeys = Object.keys(batches);

        for (const batchKey of batchKeys) {
          const batchSnapshot = await counterRef.child(batchKey).once("value");
          const events = batchSnapshot.val() || {};
          Object.keys(events).forEach((eventKey) => {
            allEvents.push({
              timestamp: Number(eventKey),
              value: events[eventKey].counterValue || 0,
            });
          });
        }

        allEvents.sort((a, b) => b.timestamp - a.timestamp);
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

          if (events.length > 0) {
            lastReadingTimestamps[counter] =
              events[events.length - 1].timestamp;
          }

          // Добавляем слушатель для обновления таблицы в реальном времени
          const counterRef = firebase
            .database()
            .ref(`UsersData/${uid}/${counter}`);
          counterRef.on(
            "child_added",
            (snapshot) => {
              const batchKey = snapshot.key;
              const events = snapshot.val() || {};
              let newEvents = [];
              Object.keys(events).forEach((eventKey) => {
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
            },
            (error) => {
              console.error(
                `Error in table real-time listener for ${counter}:`,
                error
              );
            }
          );
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
      } catch (error) {
        console.error("Error loading table data:", error);
        tableContainerElement.innerHTML =
          "<p>Error loading data. Please try again.</p>";
      }
    }

    async function appendToTable() {
      loadDataButtonElement.disabled = true;
      loadDataButtonElement.innerText = "Loading...";

      const counters = ["count-1", "count-2", "count-3"];
      const promises = counters.map(async (counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
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
        const batchKeys = Object.keys(batches);

        for (const batchKey of batchKeys) {
          const batchSnapshot = await counterRef.child(batchKey).once("value");
          const events = batchSnapshot.val() || {};
          Object.keys(events).forEach((eventKey) => {
            const timestamp = Number(eventKey);
            allEvents.push({
              timestamp,
              value: events[eventKey].counterValue || 0,
            });
          });
        }

        allEvents.sort((a, b) => b.timestamp - a.timestamp);
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

          if (events.length > 0) {
            lastReadingTimestamps[counter] =
              events[events.length - 1].timestamp;
          }
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

        loadDataButtonElement.disabled = false;
        loadDataButtonElement.innerText = "Load More";
      } catch (error) {
        console.error("Error appending table data:", error);
        loadDataButtonElement.disabled = false;
        loadDataButtonElement.innerText = "Load More";
        alert("Failed to load more data. Please try again.");
      }
    }

    viewDataButtonElement.addEventListener("click", () => {
      tableContainerElement.style.display = "block";
      viewDataButtonElement.style.display = "none";
      hideDataButtonElement.style.display = "inline-block";
      loadDataButtonElement.style.display = "inline-block";
      createTable();
    });

    loadDataButtonElement.addEventListener("click", appendToTable);

    hideDataButtonElement.addEventListener("click", () => {
      tableContainerElement.style.display = "none";
      viewDataButtonElement.style.display = "inline-block";
      hideDataButtonElement.style.display = "none";
      loadDataButtonElement.style.display = "none";
      counters.forEach((counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef.off("child_added");
      });
    });
  } else {
    loginElement.style.display = "block";
    authBarElement.style.display = "none";
    userDetailsElement.style.display = "none";
    contentElement.style.display = "none";
  }
}
