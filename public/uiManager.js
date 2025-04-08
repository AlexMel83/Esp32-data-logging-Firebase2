async function setupUI(user) {
  if (!user) {
    loginElement.style.display = "block";
    authBarElement.style.display = "none";
    userDetailsElement.style.display = "none";
    contentElement.style.display = "none";
    return false;
  }

  loginElement.style.display = "none";
  contentElement.style.display = "block";
  authBarElement.style.display = "block";
  userDetailsElement.style.display = "block";
  userDetailsElement.innerHTML = user.email;

  // console.log("Real UID:", user.uid);
  const uid = "cRtGblv0T3R2vXazmLnjTSNrlpJ3"; // псевдо UID, если нужно подменить
  // console.log("Fake UID:", uid);

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

  return uid;
}

function showLoadingSpinner(container) {
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  spinner.innerText = "Loading...";
  container.appendChild(spinner);
  return spinner;
}
