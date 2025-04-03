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

    // Initialize gauges
    var gaugeA = createTemperatureGauge();
    var gaugeB = createHumidityGauge();
    var gaugeC = createPressureGauge();
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
        const events = data[counter] || {};
        const timestamps = Object.keys(events).sort(
          (a, b) => Number(b) - Number(a)
        );
        if (timestamps.length > 0) {
          const latestKey = timestamps[0];
          const value = events[latestKey].counterValue || 0;
          latestValues[counter] = value;
          const epochTime = Number(latestKey);
          if (epochTime > latestTimestamp) latestTimestamp = epochTime;
        }
      });

      counter1Element.innerHTML = latestValues["count-1"];
      counter2Element.innerHTML = latestValues["count-2"];
      counter3Element.innerHTML = latestValues["count-3"];
      gaugeA.value = latestValues["count-1"];
      gaugeB.value = latestValues["count-2"];
      gaugeC.value = latestValues["count-3"];
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
        counterRef
          .orderByKey()
          .limitToLast(chartRange)
          .once("value", (snapshot) => {
            const events = snapshot.val() || {};
            const timestamps = Object.keys(events).sort(
              (a, b) => Number(a) - Number(b)
            );
            const chart = index === 0 ? chartA : index === 1 ? chartB : chartC;
            chart.series[0].setData([]); // Очищаем график
            timestamps.forEach((key) => {
              const value = events[key].counterValue || 0;
              plotValues(chart, Number(key), value);
            });
          });
        // Реальное время для всех новых событий
        counterRef.on("child_added", (snapshot) => {
          const key = snapshot.key;
          const value = snapshot.val().counterValue || 0;
          plotValues(
            index === 0 ? chartA : index === 1 ? chartB : chartC,
            Number(key),
            value
          );
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
        counterRef
          .orderByKey()
          .limitToLast(100)
          .once("value", (snapshot) => {
            const events = snapshot.val() || {};
            const timestamps = Object.keys(events).sort(
              (a, b) => Number(b) - Number(a)
            );
            timestamps.forEach((key) => {
              const epochTime = Number(key);
              const timestamp = epochToDateTime(epochTime);
              const value = events[key].counterValue || 0;
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
              if (!lastReadingTimestamps[counter])
                lastReadingTimestamps[counter] = epochTime;
            });
          });
        // Обновление таблицы в реальном времени
        counterRef.on("child_added", (snapshot) => {
          const key = snapshot.key;
          const epochTime = Number(key);
          const timestamp = epochToDateTime(epochTime);
          const value = snapshot.val().counterValue || 0;
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
    }

    function appendToTable() {
      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        // Проверяем, что lastReadingTimestamps инициализирован
        if (!lastReadingTimestamps[counter]) {
          console.warn(
            `lastReadingTimestamps[${counter}] is null, skipping append for this counter`
          );
          return;
        }
        counterRef
          .orderByKey()
          .endAt(lastReadingTimestamps[counter].toString())
          .limitToLast(100)
          .once("value", (snapshot) => {
            if (snapshot.exists()) {
              const events = snapshot.val();
              const keys = Object.keys(events).sort(
                (a, b) => Number(b) - Number(a)
              );
              keys.forEach((key, i) => {
                if (
                  i === 0 &&
                  key === lastReadingTimestamps[counter].toString()
                )
                  return;
                const epochTime = Number(key);
                const timestamp = epochToDateTime(epochTime);
                const value = events[key].counterValue || 0;
                var content = "<tr>";
                content += "<td>" + timestamp + "</td>";
                content +=
                  "<td>" + (counter === "count-1" ? value : "-") + "</td>";
                content +=
                  "<td>" + (counter === "count-2" ? value : "-") + "</td>";
                content +=
                  "<td>" + (counter === "count-3" ? value : "-") + "</td>";
                content += "</tr>";
                $("#tbody").append(content);
                if (i === keys.length - 1)
                  lastReadingTimestamps[counter] = epochTime;
              });
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
