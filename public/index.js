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
const cardsReadingsElement = document.querySelector("#cards-div");
const gaugesReadingsElement = document.querySelector("#gauges-div");
const chartsDivElement = document.querySelector("#charts-div");
const counter1Element = document.getElementById("temp");
const counter2Element = document.getElementById("hum");
const counter3Element = document.getElementById("pres");
const updateElement = document.getElementById("lastUpdate");

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
    const chartRef = firebase.database().ref(`UsersData/${uid}/charts/range`);

    // Initialize gauges
    var gaugeT = createTemperatureGauge();
    var gaugeH = createHumidityGauge();
    var gaugeP = createPressureGauge();
    gaugeT.draw();
    gaugeH.draw();
    gaugeP.draw();

    // Set initial state of charts-div
    chartsDivElement.style.display = chartsCheckboxElement.checked
      ? "block"
      : "none";

    // Update counter values for cards and gauges
    dbRef.on("value", (snapshot) => {
      const data = snapshot.val() || {};
      const count1 = Object.keys(data["count-1"] || {}).length;
      const count2 = Object.keys(data["count-2"] || {}).length;
      const count3 = Object.keys(data["count-3"] || {}).length;

      counter1Element.innerHTML = count1;
      counter2Element.innerHTML = count2;
      counter3Element.innerHTML = count3;
      gaugeT.value = count1;
      gaugeH.value = count2;
      gaugeP.value = count3;

      // Find the latest timestamp across all counters
      let latestTimestamp = 0;
      ["count-1", "count-2", "count-3"].forEach((counter) => {
        const events = data[counter] || {};
        Object.keys(events).forEach((key) => {
          const epochTime = Number(key.split("_")[0]);
          if (epochTime > latestTimestamp) latestTimestamp = epochTime;
        });
      });
      updateElement.innerHTML = latestTimestamp
        ? epochToDateTime(latestTimestamp)
        : "N/A";
    });

    // Handle chart range and plot events
    let chartRange = 10;
    chartRef.on("value", (snapshot) => {
      chartRange = Number(snapshot.val()) || 10;
      console.log("Chart range:", chartRange);

      ["count-1", "count-2", "count-3"].forEach((counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef
          .orderByKey()
          .limitToLast(chartRange)
          .on("child_added", (snapshot) => {
            const key = snapshot.key;
            const epochTime = Number(key.split("_")[0]);
            if (index === 0) plotValues(chartT, epochTime, 1);
            else if (index === 1) plotValues(chartH, epochTime, 1);
            else if (index === 2) plotValues(chartP, epochTime, 1);
          });
      });
    });

    if (chartsRangeInputElement) {
      chartsRangeInputElement.onchange = () => {
        chartRef.set(Number(chartsRangeInputElement.value));
      };
    } else {
      console.error("charts-range input not found in DOM");
    }

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
      ["count-1", "count-2", "count-3"].forEach((counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef
          .orderByKey()
          .limitToLast(100)
          .on("child_added", (snapshot) => {
            const key = snapshot.key;
            const epochTime = Number(key.split("_")[0]);
            const timestamp = epochToDateTime(epochTime);
            var content = "<tr>";
            content += "<td>" + timestamp + "</td>";
            content += "<td>" + (index === 0 ? "1" : "-") + "</td>";
            content += "<td>" + (index === 1 ? "1" : "-") + "</td>";
            content += "<td>" + (index === 2 ? "1" : "-") + "</td>";
            content += "</tr>";
            $("#tbody").prepend(content);
            if (!lastReadingTimestamps[counter])
              lastReadingTimestamps[counter] = epochTime;
          });
      });
    }

    function appendToTable() {
      ["count-1", "count-2", "count-3"].forEach((counter, index) => {
        const counterRef = firebase
          .database()
          .ref(`UsersData/${uid}/${counter}`);
        counterRef
          .orderByKey()
          .endAt(lastReadingTimestamps[counter].toString())
          .limitToLast(100)
          .once("value", (snapshot) => {
            if (snapshot.exists()) {
              const events = snapshot.val();
              const keys = Object.keys(events).sort().reverse();
              keys.forEach((key, i) => {
                if (
                  i === 0 &&
                  key === lastReadingTimestamps[counter].toString()
                )
                  return; // Skip the last known timestamp
                const epochTime = Number(key.split("_")[0]);
                const timestamp = epochToDateTime(epochTime);
                var content = "<tr>";
                content += "<td>" + timestamp + "</td>";
                content += "<td>" + (index === 0 ? "1" : "-") + "</td>";
                content += "<td>" + (index === 1 ? "1" : "-") + "</td>";
                content += "<td>" + (index === 2 ? "1" : "-") + "</td>";
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
