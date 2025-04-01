function enableScroll() {
  window.addEventListener("load", function () {
    // Scroll functionality for buttons
    const scrollableSection = document.querySelector(
      ".scrollable-section"
    ).firstElementChild

    document.getElementById("scrollLeft").addEventListener("click", () => {
      scrollableSection.scrollBy({
        left: -300,
        behavior: "smooth",
      })
    })

    document.getElementById("scrollRight").addEventListener("click", () => {
      scrollableSection.scrollBy({
        left: 300,
        behavior: "smooth",
      })
    })
  })
}
