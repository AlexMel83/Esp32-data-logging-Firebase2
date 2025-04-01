// convert epochtime to JavaScript Date object
function epochToJsDate(epochTime) {
  return new Date(epochTime * 1000);
}

// convert time to human-readable format YYYY/MM/DD HH:MM:SS
function epochToDateTime(epochTime) {
  var epochDate = new Date(epochToJsDate(epochTime));
  var dateTime =
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
    ("00" + epochDate.getSeconds()).slice(-2);
  return dateTime;
}

// function to plot values on charts
function plotValues(chart, timestamp, value) {
  var x = epochToJsDate(timestamp).getTime();
  var y = Number(value);
  if (chart && chart.series && chart.series[0]) {
    if (chart.series[0].data.length > 40) {
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

// DOM elements for counter readings
const cardsReadingsElement = document.querySelector("#cards-div");
const gaugesReadingsElement = document.querySelector("#gauges-div");
const chartsDivElement = document.querySelector("#charts-div");
const counter1Element = document.getElementById("temp");
const counter2Element = document.getElementById("hum");
const counter3Element = document.getElementById("pres");
const updateElement = document.getElementById("lastUpdate");

// MANAGE LOGIN/LOGOUT UI
const setupUI = (user) => {
  console.log("setupUI called with user:", user);
  if (user) {
    loginElement.style.display = "none";
    contentElement.style.display = "block";
    authBarElement.style.display = "block";
    userDetailsElement.style.display = "block";
    userDetailsElement.innerHTML = user.email;

    var uid = user.uid;
    console.log(uid);

    const dbRef = firebase.database().ref(`UsersData/${uid}/counter_events`);
    const counterValuesRef = firebase
      .database()
      .ref(`UsersData/${uid}/counter_values`);
    const chartRef = firebase.database().ref(`UsersData/${uid}/charts/range`);

    // Инициализируем gauges
    var gaugeT = createTemperatureGauge();
    var gaugeH = createHumidityGauge();
    var gaugeP = createPressureGauge();
    gaugeT.draw();
    gaugeH.draw();
    gaugeP.draw();

    // Устанавливаем изначальное состояние charts-div
    chartsDivElement.style.display = chartsCheckboxElement.checked
      ? "block"
      : "none";

    counterValuesRef.on("value", (snapshot) => {
      const counterValues = snapshot.val();
      if (!counterValues) return;

      console.log("Последние значения счетчиков:", counterValues);

      counter1Element.innerHTML = counterValues.counter1;
      counter2Element.innerHTML = counterValues.counter2;
      counter3Element.innerHTML = counterValues.counter3;
      updateElement.innerHTML = counterValues.last_update;

      gaugeT.value = counterValues.counter1;
      gaugeH.value = counterValues.counter2;
      gaugeP.value = counterValues.counter3;

      const timestamp = new Date(counterValues.last_update).getTime() / 1000;
      plotValues(chartT, timestamp, counterValues.counter1);
      plotValues(chartH, timestamp, counterValues.counter2);
      plotValues(chartP, timestamp, counterValues.counter3);
    });

    let chartRange = 10;
    chartRef.on("value", (snapshot) => {
      chartRange = Number(snapshot.val()) || 10;
      console.log("Chart range:", chartRange);

      dbRef
        .orderByKey()
        .limitToLast(chartRange)
        .on("child_added", (snapshot) => {
          const eventData = snapshot.val();
          if (!eventData) return;

          const timestamp = eventData.epoch_time;
          const counterId = eventData.counter_id;

          if (counterId === 1) {
            plotValues(chartT, timestamp, 1);
          } else if (counterId === 2) {
            plotValues(chartH, timestamp, 1);
          } else if (counterId === 3) {
            plotValues(chartP, timestamp, 1);
          }
        });
    });

    if (chartsRangeInputElement) {
      chartsRangeInputElement.onchange = () => {
        chartRef.set(Number(chartsRangeInputElement.value));
      };
    } else {
      console.error("charts-range input not found in DOM");
    }

    cardsCheckboxElement.addEventListener("change", (e) => {
      cardsReadingsElement.style.display = e.target.checked ? "block" : "none";
    });
    gaugesCheckboxElement.addEventListener("change", (e) => {
      gaugesReadingsElement.style.display = e.target.checked ? "block" : "none";
    });
    chartsCheckboxElement.addEventListener("change", (e) => {
      chartsDivElement.style.display = e.target.checked ? "block" : "none";
    });

    deleteButtonElement.addEventListener("click", (e) => {
      e.preventDefault();
      deleteModalElement.style.display = "block";
    });

    deleteDataFormElement.addEventListener("submit", (e) => {
      e.preventDefault();
      dbRef.remove();
      counterValuesRef.remove();
      deleteModalElement.style.display = "none";
    });

    var lastReadingTimestamp;
    function createTable() {
      var firstRun = true;
      dbRef
        .orderByKey()
        .limitToLast(100)
        .on("child_added", (snapshot) => {
          if (snapshot.exists()) {
            var jsonData = snapshot.val();
            var content = "";
            content += "<tr>";
            content += "<td>" + jsonData.timestamp + "</td>";
            content +=
              "<td>" + (jsonData.counter_id === 1 ? "1" : "-") + "</td>";
            content +=
              "<td>" + (jsonData.counter_id === 2 ? "1" : "-") + "</td>";
            content +=
              "<td>" + (jsonData.counter_id === 3 ? "1" : "-") + "</td>";
            content += "</tr>";
            $("#tbody").prepend(content);
            if (firstRun) {
              lastReadingTimestamp = jsonData.epoch_time;
              firstRun = false;
            }
          }
        });
    }

    function appendToTable() {
      var dataList = [];
      dbRef
        .orderByKey()
        .limitToLast(100)
        .endAt(lastReadingTimestamp.toString())
        .once("value", (snapshot) => {
          if (snapshot.exists()) {
            snapshot.forEach((element) => {
              dataList.push(element.val());
            });
            lastReadingTimestamp = dataList[0].epoch_time;
            var reversedList = dataList.reverse();

            var firstTime = true;
            reversedList.forEach((element) => {
              if (!firstTime) {
                var content = "";
                content += "<tr>";
                content += "<td>" + element.timestamp + "</td>";
                content +=
                  "<td>" + (element.counter_id === 1 ? "1" : "-") + "</td>";
                content +=
                  "<td>" + (element.counter_id === 2 ? "1" : "-") + "</td>";
                content +=
                  "<td>" + (element.counter_id === 3 ? "1" : "-") + "</td>";
                content += "</tr>";
                $("#tbody").append(content);
              }
              firstTime = false;
            });
          }
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
    });
  } else {
    loginElement.style.display = "block";
    authBarElement.style.display = "none";
    userDetailsElement.style.display = "none";
    contentElement.style.display = "none";
  }
};
