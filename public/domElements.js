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

let chartRange = 50;

const activeListeners = {
  cards: {},
  charts: {},
  tables: {},
};
