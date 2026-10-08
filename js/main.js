function goToSearch() {

    const searchInput = document.getElementById("homeSearch");

    const query = searchInput.value.trim();

    if (query === "") {

        window.location.href = "pages/search.html";

        return;
    }

    window.location.href =
        "pages/search.html?search=" +
        encodeURIComponent(query);
}


function updateCartCount() {

    const cart = JSON.parse(
        localStorage.getItem("healthkartCart")
    ) || [];

    const countElement =
        document.getElementById("cartCount");

    if (!countElement) return;

    countElement.textContent = cart.reduce(function (total, item) {
        return total + (Number(item.quantity) || 1);
    }, 0);
}


document.addEventListener(
    "DOMContentLoaded",
    updateCartCount
);

document.addEventListener("DOMContentLoaded", function () {

    const input = document.getElementById("homeSearch");
    const button = document.getElementById("homeSearchBtn");

    if (button) {
        button.addEventListener("click", function (event) {
            event.preventDefault();
            goToSearch();
        });
    }

    if (input) {
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                goToSearch();
            }
        });
    }

});
