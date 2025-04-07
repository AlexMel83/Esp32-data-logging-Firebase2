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
    const latestTimestamp = Number(latestEventKey.split("-")[0]);

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

    setupCounterListeners(uid, gaugeA, gaugeB, gaugeC);
  } catch (error) {
    console.error("Error loading counter data:", error);
    counter1Element.innerHTML = "Error";
    counter2Element.innerHTML = "Error";
    counter3Element.innerHTML = "Error";
    updateElement.innerHTML = "Error";
  }
}

function setupCounterListeners(uid, gaugeA, gaugeB, gaugeC) {
  const counters = ["count-1", "count-2", "count-3"];

  // Очищаем существующие слушатели
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

    const addEventListenerToBatch = (batchKey) => {
      const batchRef = counterRef.child(batchKey);

      const callback = (eventSnapshot) => {
        const eventKey = eventSnapshot.key;
        const eventData = eventSnapshot.val();
        const latestValue = eventData.counterValue || 0;
        const latestTimestamp = Number(eventKey.split("-")[0]);

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

    counterRef.once("value", (snapshot) => {
      const batches = snapshot.val() || {};
      const batchKeys = Object.keys(batches).sort();
      batchKeys.forEach(addEventListenerToBatch);
    });

    const batchCallback = (batchSnapshot) => {
      const batchKey = batchSnapshot.key;
      addEventListenerToBatch(batchKey);
    };

    const batchErrorCallback = (error) => {
      console.error(`Error in batch listener for ${counter}:`, error);
    };

    activeListeners.cards[counter].main = {
      ref: counterRef,
      event: "child_added",
      callback: batchCallback,
    };

    // Исправляем вызов, используя batchErrorCallback вместо errorCallback
    counterRef.on("child_added", batchCallback, batchErrorCallback);
  });
}
