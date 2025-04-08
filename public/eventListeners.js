function setupEventListeners(uid, gaugeA, gaugeB, gaugeC) {
  let lastReadingTimestamps = {
    "count-1": null,
    "count-2": null,
    "count-3": null,
  };

  cardsCheckboxElement.addEventListener("change", (e) => {
    cardsReadingsElement.style.display = e.target.checked ? "block" : "none";
  });

  gaugesCheckboxElement.addEventListener("change", (e) => {
    gaugesReadingsElement.style.display = e.target.checked ? "block" : "none";
  });

  let debounceTimeout;
  chartsPointsSelectElement.addEventListener("change", () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      if (chartsCheckboxElement.checked) {
        updateCharts(uid);
      }
    }, 300);
  });

  chartsCheckboxElement.addEventListener("change", (e) => {
    chartsDivElement.style.display = e.target.checked ? "block" : "none";
    if (e.target.checked) {
      initializeCharts();
      updateCharts(uid);
    } else {
      const counters = ["count-1", "count-2", "count-3"];
      counters.forEach((counter) => {
        if (activeListeners.charts[counter]) {
          Object.values(activeListeners.charts[counter]).forEach((listener) => {
            if (listener.ref) {
              listener.ref.off(listener.event, listener.callback);
            }
          });
          activeListeners.charts[counter] = {};
        }
      });
    }
  });

  deleteButtonElement.addEventListener("click", (e) => {
    e.preventDefault();
    deleteModalElement.style.display = "block";
  });

  deleteDataFormElement.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Очищаем активные слушатели
    ["cards", "charts", "tables"].forEach((type) => {
      Object.keys(activeListeners[type]).forEach((counter) => {
        Object.values(activeListeners[type][counter]).forEach((listener) => {
          if (listener.ref) {
            listener.ref.off(listener.event, listener.callback);
          }
        });
        activeListeners[type][counter] = {};
      });
    });

    const dbRef = firebase.database().ref(`UsersData/${uid}`);

    try {
      await dbRef.remove();
      deleteModalElement.style.display = "none";

      // Обновляем интерфейс после успешного удаления
      setupCounterListeners(uid, gaugeA, gaugeB, gaugeC);
      if (chartsCheckboxElement.checked) {
        updateCharts(uid);
      }
      if (tableContainerElement.style.display === "block") {
        createTable(uid);
      }
    } catch (error) {
      console.error("Failed to delete data:", error);
      if (error.code === "PERMISSION_DENIED") {
        alert(
          "Помилка: У вас немає прав на видалення даних. Будь ласка, зверніться до адміністратора."
        );
      } else {
        alert("Виникла помилка при видаленні даних: " + error.message);
      }
    }
  });

  viewDataButtonElement.addEventListener("click", async () => {
    tableContainerElement.style.display = "block";
    viewDataButtonElement.style.display = "none";
    hideDataButtonElement.style.display = "inline-block";
    loadDataButtonElement.style.display = "inline-block";
    lastReadingTimestamps = await createTable(uid);
  });

  loadDataButtonElement.addEventListener("click", async () => {
    loadDataButtonElement.disabled = true;
    loadDataButtonElement.innerText = "Loading...";
    await loadMoreTableData(uid, lastReadingTimestamps);
    loadDataButtonElement.disabled = false;
    loadDataButtonElement.innerText = "Load More";
  });

  hideDataButtonElement.addEventListener("click", () => {
    tableContainerElement.style.display = "none";
    viewDataButtonElement.style.display = "inline-block";
    hideDataButtonElement.style.display = "none";
    loadDataButtonElement.style.display = "none";

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
  });
}
