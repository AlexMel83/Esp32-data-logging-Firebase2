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

// Manage UI based on login state
function setupUI(user) {
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

    // Initialize charts (но не загружаем данные сразу)
    var chartA = createCounter1Chart();
    var chartB = createCounter2Chart();
    var chartC = createCounter3Chart();

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

    ["count-1", "count-2", "count-3"].forEach((counter, index) => {
      const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);

      counterRef
        .orderByKey()
        .limitToLast(1)
        .once(
          "value",
          (snapshot) => {
            const batches = snapshot.val() || {};
            const batchKeys = Object.keys(batches);

            if (batchKeys.length === 0) {
              if (index === 0) counter1Element.innerHTML = "0";
              if (index === 1) counter2Element.innerHTML = "0";
              if (index === 2) {
                counter3Element.innerHTML = "0";
                updateElement.innerHTML = "N/A";
              }
              updateGauge(
                index === 0 ? gaugeA : index === 1 ? gaugeB : gaugeC,
                0
              );
              return;
            }

            const latestBatchKey = batchKeys[0];
            const batchRef = counterRef.child(latestBatchKey);

            batchRef
              .orderByKey()
              .limitToLast(1)
              .once(
                "value",
                (eventSnapshot) => {
                  const events = eventSnapshot.val() || {};
                  const eventKeys = Object.keys(events);

                  if (eventKeys.length === 0) {
                    if (index === 0) counter1Element.innerHTML = "0";
                    if (index === 1) counter2Element.innerHTML = "0";
                    if (index === 2) {
                      counter3Element.innerHTML = "0";
                      updateElement.innerHTML = "N/A";
                    }
                    updateGauge(
                      index === 0 ? gaugeA : index === 1 ? gaugeB : gaugeC,
                      0
                    );
                    return;
                  }

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
                },
                (error) => {
                  console.error(
                    `Error loading latest event for ${counter}:`,
                    error
                  );
                  if (index === 0) counter1Element.innerHTML = "Error";
                  if (index === 1) counter2Element.innerHTML = "Error";
                  if (index === 2) {
                    counter3Element.innerHTML = "Error";
                    updateElement.innerHTML = "Error";
                  }
                }
              );
          },
          (error) => {
            console.error(`Error loading latest batch for ${counter}:`, error);
            if (index === 0) counter1Element.innerHTML = "Error";
            if (index === 1) counter2Element.innerHTML = "Error";
            if (index === 2) {
              counter3Element.innerHTML = "Error";
              updateElement.innerHTML = "Error";
            }
          }
        );

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

    // Load and update chart data (функция определена, но вызывается только при включении графиков)
    function updateCharts() {
      chartRange = Number(chartsRangeInputElement.value) || 10;
      ["count-1", "count-2", "count-3"].forEach((counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef.off("child_added");

        const loadEventsForChart = async () => {
          let allEvents = [];
          let lastBatchKey = null;

          while (allEvents.length < chartRange) {
            let query = counterRef.orderByKey();
            if (lastBatchKey) {
              query = query.endBefore(lastBatchKey);
            }
            query = query.limitToLast(1);

            const snapshot = await query.once("value");
            const batches = snapshot.val() || {};
            const batchKeys = Object.keys(batches);

            if (batchKeys.length === 0) break;

            const batchKey = batchKeys[0];
            lastBatchKey = batchKey;

            const batchRef = counterRef.child(batchKey);
            const batchSnapshot = await batchRef.once("value");
            const events = batchSnapshot.val() || {};

            Object.keys(events).forEach((eventKey) => {
              allEvents.push({
                timestamp: Number(eventKey),
                value: events[eventKey].counterValue || 0,
              });
            });

            if (batchKeys.length < 1) break;
          }

          allEvents.sort((a, b) => a.timestamp - b.timestamp);
          const eventsToPlot = allEvents.slice(-chartRange);

          const chart = index === 0 ? chartA : index === 1 ? chartB : chartC;
          chart.series[0].setData([]);
          eventsToPlot.forEach((event) => {
            plotValues(chart, event.timestamp, event.value);
          });
        };

        loadEventsForChart().catch((error) => {
          console.error(`Error loading chart data for ${counter}:`, error);
          alert(`Failed to load chart data for ${counter}. Please try again.`);
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
    }

    // Вызываем updateCharts только при изменении диапазона или включении графиков
    chartsRangeInputElement.onchange = () => {
      if (chartsCheckboxElement.checked) {
        updateCharts();
      }
    };

    // Checkbox event listeners
    cardsCheckboxElement.addEventListener("change", (e) => {
      cardsReadingsElement.style.display = e.target.checked ? "block" : "none";
    });

    gaugesCheckboxElement.addEventListener("change", (e) => {
      gaugesReadingsElement.style.display = e.target.checked ? "block" : "none";
    });

    chartsCheckboxElement.addEventListener("change", (e) => {
      chartsDivElement.style.display = e.target.checked ? "block" : "none";
      if (e.target.checked) {
        updateCharts(); // Загружаем данные для графиков только при включении
      } else {
        // Отключаем слушатели, чтобы не загружать данные, пока графики скрыты
        ["count-1", "count-2", "count-3"].forEach((counter) => {
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

    function createTable() {
      $("#tbody").empty();
      tableContainerElement.innerHTML = "<p>Loading data...</p>";

      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);

        const loadEventsForTable = async () => {
          let allEvents = [];
          let lastBatchKey = null;

          while (allEvents.length < 100) {
            let query = counterRef.orderByKey();
            if (lastBatchKey) {
              query = query.endBefore(lastBatchKey);
            }
            query = query.limitToLast(1);

            const snapshot = await query.once("value");
            const batches = snapshot.val() || {};
            const batchKeys = Object.keys(batches);

            if (batchKeys.length === 0) break;

            const batchKey = batchKeys[0];
            lastBatchKey = batchKey;

            const batchRef = counterRef.child(batchKey);
            const batchSnapshot = await batchRef.once("value");
            const events = batchSnapshot.val() || {};

            Object.keys(events).forEach((eventKey) => {
              allEvents.push({
                timestamp: Number(eventKey),
                value: events[eventKey].counterValue || 0,
              });
            });

            if (batchKeys.length < 1) break;
          }

          allEvents.sort((a, b) => b.timestamp - a.timestamp);
          const eventsToDisplay = allEvents.slice(0, 100);

          tableContainerElement.innerHTML = `
            <table id="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Counter 1</th>
                  <th>Counter 2</th>
                  <th>Counter 3</th>
                </tr>
              </thead>
              <tbody id="tbody"></tbody>
            </table>
          `;

          eventsToDisplay.forEach((event) => {
            const epochTime = event.timestamp;
            const timestamp = epochToDateTime(epochTime);
            const value = event.value;
            var content = "<tr>";
            content += "<td>" + timestamp + "</td>";
            content += "<td>" + (counter === "count-1" ? value : "-") + "</td>";
            content += "<td>" + (counter === "count-2" ? value : "-") + "</td>";
            content += "<td>" + (counter === "count-3" ? value : "-") + "</td>";
            content += "</tr>";
            $("#tbody").prepend(content);
          });

          if (allEvents.length > 0) {
            lastReadingTimestamps[counter] =
              eventsToDisplay[eventsToDisplay.length - 1].timestamp;
          }
        };

        loadEventsForTable().catch((error) => {
          console.error(`Error loading table data for ${counter}:`, error);
          tableContainerElement.innerHTML =
            "<p>Error loading data. Please try again.</p>";
        });

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
              var content = "<tr>";
              content += "<td>" + timestamp + "</td>";
              content +=
                "<td>" + (counter === "count-1" ? value : "-") + "</td>";
              content +=
                "<td>" + (counter === "count-2" ? value : "-") + "</td>";
              content +=
                "<td>" + (counter === "count-3" ? value : "-") + "</td>";
              content += "</tr>";
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
    }

    function appendToTable() {
      loadDataButtonElement.disabled = true;
      loadDataButtonElement.innerText = "Loading...";

      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        if (!lastReadingTimestamps[counter]) {
          console.warn(
            `lastReadingTimestamps[${counter}] is null, skipping append for this counter`
          );
          loadDataButtonElement.disabled = false;
          loadDataButtonElement.innerText = "Load More";
          return;
        }

        const loadMoreEventsForTable = async () => {
          let allEvents = [];
          let lastBatchKey = lastReadingTimestamps[counter].toString();

          while (allEvents.length < 100) {
            const query = counterRef
              .orderByKey()
              .endBefore(lastBatchKey)
              .limitToLast(1);
            const snapshot = await query.once("value");
            const batches = snapshot.val() || {};
            const batchKeys = Object.keys(batches);

            if (batchKeys.length === 0) break;

            const batchKey = batchKeys[0];
            lastBatchKey = batchKey;

            const batchRef = counterRef.child(batchKey);
            const batchSnapshot = await batchRef.once("value");
            const events = batchSnapshot.val() || {};

            Object.keys(events).forEach((eventKey) => {
              const timestamp = Number(eventKey);
              allEvents.push({
                timestamp: timestamp,
                value: events[eventKey].counterValue || 0,
              });
            });

            if (batchKeys.length < 1) break;
          }

          allEvents.sort((a, b) => b.timestamp - a.timestamp);
          const eventsToAppend = allEvents.slice(0, 100);

          eventsToAppend.forEach((event) => {
            const epochTime = event.timestamp;
            const timestamp = epochToDateTime(epochTime);
            const value = event.value;
            var content = "<tr>";
            content += "<td>" + timestamp + "</td>";
            content += "<td>" + (counter === "count-1" ? value : "-") + "</td>";
            content += "<td>" + (counter === "count-2" ? value : "-") + "</td>";
            content += "<td>" + (counter === "count-3" ? value : "-") + "</td>";
            content += "</tr>";
            $("#tbody").append(content);
          });

          if (eventsToAppend.length > 0) {
            lastReadingTimestamps[counter] =
              eventsToAppend[eventsToAppend.length - 1].timestamp;
          }

          loadDataButtonElement.disabled = false;
          loadDataButtonElement.innerText = "Load More";
        };

        loadMoreEventsForTable().catch((error) => {
          console.error(`Error appending table data for ${counter}:`, error);
          loadDataButtonElement.disabled = false;
          loadDataButtonElement.innerText = "Load More";
          alert(`Failed to load more data for ${counter}. Please try again.`);
        });
      });
    }

    viewDataButtonElement.addEventListener("click", () => {
      tableContainerElement.style.display = "block";
      viewDataButtonElement.style.display = "none";
      hideDataButtonElement.style.display = "inline-block";
      loadDataButtonElement.style.display = "inline-block";
      createTable(); // Загружаем данные для таблицы только при нажатии
    });

    loadDataButtonElement.addEventListener("click", appendToTable);

    hideDataButtonElement.addEventListener("click", () => {
      tableContainerElement.style.display = "none";
      viewDataButtonElement.style.display = "inline-block";
      hideDataButtonElement.style.display = "none";
      loadDataButtonElement.style.display = "none";
      // Отключаем слушатели, чтобы не загружать данные, пока таблица скрыта
      ["count-1", "count-2", "count-3"].forEach((counter) => {
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
