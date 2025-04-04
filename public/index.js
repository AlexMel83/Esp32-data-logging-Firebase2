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

    // Initialize charts
    var chartA = createCounter1Chart();
    var chartB = createCounter2Chart();
    var chartC = createCounter3Chart();

    // Set initial state of charts-div
    chartsDivElement.style.display = chartsCheckboxElement.checked
      ? "block"
      : "none";

    // Update counter values for cards and gauges
    dbRef.on("value", (snapshot) => {
      const data = snapshot.val() || {};
      let latestTimestamp = 0;
      let latestValues = { "count-1": 0, "count-2": 0, "count-3": 0 };

      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const batches = data[counter] || {};
        let latestCounterTimestamp = 0;
        let latestCounterValue = 0;

        // Проходим по всем порциям (batches)
        Object.keys(batches).forEach((batchKey) => {
          const events = batches[batchKey] || {};
          // Получаем все временные метки событий в этой порции
          const eventTimestamps = Object.keys(events)
            .map(Number)
            .sort((a, b) => b - a);
          if (eventTimestamps.length > 0) {
            const latestEventTimestamp = eventTimestamps[0]; // Самое последнее событие в порции
            const value = events[latestEventTimestamp].counterValue || 0;
            if (latestEventTimestamp > latestCounterTimestamp) {
              latestCounterTimestamp = latestEventTimestamp;
              latestCounterValue = value;
            }
          }
        });

        latestValues[counter] = latestCounterValue;
        if (latestCounterTimestamp > latestTimestamp) {
          latestTimestamp = latestCounterTimestamp;
        }
      });

      counter1Element.innerHTML = latestValues["count-1"];
      counter2Element.innerHTML = latestValues["count-2"];
      counter3Element.innerHTML = latestValues["count-3"];
      updateGauge(gaugeA, latestValues["count-1"]);
      updateGauge(gaugeB, latestValues["count-2"]);
      updateGauge(gaugeC, latestValues["count-3"]);
      updateElement.innerHTML = latestTimestamp
        ? epochToDateTime(latestTimestamp)
        : "N/A";
    });

    // Load and update chart data
    function updateCharts() {
      chartRange = Number(chartsRangeInputElement.value) || 10;
      ["count-1", "count-2", "count-3"].forEach((counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef.off("child_added"); // Отключаем предыдущие слушатели

        // Получаем все порции и собираем события
        counterRef.once("value", (snapshot) => {
          const batches = snapshot.val() || {};
          let allEvents = [];

          // Проходим по всем порциям
          Object.keys(batches).forEach((batchKey) => {
            const events = batches[batchKey] || {};
            // Добавляем все события из порции в общий список
            Object.keys(events).forEach((eventKey) => {
              allEvents.push({
                timestamp: Number(eventKey),
                value: events[eventKey].counterValue || 0,
              });
            });
          });

          // Сортируем события по временной метке и берем последние chartRange
          allEvents.sort((a, b) => a.timestamp - b.timestamp);
          const eventsToPlot = allEvents.slice(-chartRange);

          // Очищаем график и добавляем точки
          const chart = index === 0 ? chartA : index === 1 ? chartB : chartC;
          chart.series[0].setData([]); // Очищаем график
          eventsToPlot.forEach((event) => {
            plotValues(chart, event.timestamp, event.value);
          });
        });

        // Реальное время для всех новых порций
        counterRef.on("child_added", (snapshot) => {
          const batchKey = snapshot.key;
          const events = snapshot.val() || {};
          // Проходим по всем событиям в новой порции
          Object.keys(events).forEach((eventKey) => {
            const value = events[eventKey].counterValue || 0;
            plotValues(
              index === 0 ? chartA : index === 1 ? chartB : chartC,
              Number(eventKey),
              value
            );
          });
        });
      });
    }
    chartsRangeInputElement.onchange = updateCharts;
    updateCharts(); // Инициализируем графики при загрузке

    // Checkbox event listeners
    cardsCheckboxElement.addEventListener("change", (e) => {
      cardsReadingsElement.style.display = e.target.checked ? "block" : "none";
    });
    gaugesCheckboxElement.addEventListener("change", (e) => {
      gaugesReadingsElement.style.display = e.target.checked ? "block" : "none";
    });
    chartsCheckboxElement.addEventListener("change", (e) => {
      chartsDivElement.style.display = e.target.checked ? "block" : "none";
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
      $("#tbody").empty(); // Очищаем таблицу
      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        // Начальная загрузка последних 100 записей
        counterRef.once("value", (snapshot) => {
          const batches = snapshot.val() || {};
          let allEvents = [];

          // Проходим по всем порциям
          Object.keys(batches).forEach((batchKey) => {
            const events = batches[batchKey] || {};
            Object.keys(events).forEach((eventKey) => {
              allEvents.push({
                timestamp: Number(eventKey),
                value: events[eventKey].counterValue || 0,
              });
            });
          });

          // Сортируем события по убыванию времени и берем последние 100
          allEvents.sort((a, b) => b.timestamp - a.timestamp);
          const eventsToDisplay = allEvents.slice(0, 100);

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

          // Устанавливаем lastReadingTimestamps
          if (allEvents.length > 0) {
            lastReadingTimestamps[counter] = allEvents[0].timestamp;
          }
        });

        // Обновление таблицы в реальном времени
        counterRef.on("child_added", (snapshot) => {
          const batchKey = snapshot.key;
          const events = snapshot.val() || {};
          let newEvents = [];

          // Собираем новые события
          Object.keys(events).forEach((eventKey) => {
            newEvents.push({
              timestamp: Number(eventKey),
              value: events[eventKey].counterValue || 0,
            });
          });

          // Сортируем новые события по убыванию времени
          newEvents.sort((a, b) => b.timestamp - a.timestamp);

          newEvents.forEach((event) => {
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
            lastReadingTimestamps[counter] = epochTime;
          });
        });
      });
    }

    function appendToTable() {
      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        if (!lastReadingTimestamps[counter]) {
          console.warn(
            `lastReadingTimestamps[${counter}] is null, skipping append for this counter`
          );
          return;
        }

        counterRef.once("value", (snapshot) => {
          const batches = snapshot.val() || {};
          let allEvents = [];

          // Проходим по всем порциям
          Object.keys(batches).forEach((batchKey) => {
            const events = batches[batchKey] || {};
            Object.keys(events).forEach((eventKey) => {
              const timestamp = Number(eventKey);
              // Добавляем только события, которые старше lastReadingTimestamps
              if (timestamp < lastReadingTimestamps[counter]) {
                allEvents.push({
                  timestamp: timestamp,
                  value: events[eventKey].counterValue || 0,
                });
              }
            });
          });

          // Сортируем события по убыванию времени и берем последние 100
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

          // Обновляем lastReadingTimestamps, если есть более старые события
          if (allEvents.length > 0) {
            lastReadingTimestamps[counter] =
              allEvents[allEvents.length - 1].timestamp;
          }
        });
      });
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
    });
  } else {
    loginElement.style.display = "block";
    authBarElement.style.display = "none";
    userDetailsElement.style.display = "none";
    contentElement.style.display = "none";
  }
}
