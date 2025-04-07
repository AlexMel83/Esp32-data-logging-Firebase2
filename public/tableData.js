async function createTable(uid) {
  showLoadingSpinner(tableContainerElement);

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
          timestamp: Number(eventKey.split("-")[0]),
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

      activeListeners.tables[counter] = {};

      const counterRef = firebase.database().ref(`UsersData/${uid}/${counter}`);

      const callback = (snapshot) => {
        const batchKey = snapshot.key;
        const events = snapshot.val() || {};
        const eventKeys = Object.keys(events).sort();
        let newEvents = [];

        eventKeys.forEach((eventKey) => {
          newEvents.push({
            timestamp: Number(eventKey.split("-")[0]),
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

async function loadMoreTableData(uid, lastReadingTimestamps) {
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
        const timestamp = Number(eventKey.split("-")[0]);
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
  }
}
