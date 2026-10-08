// ========================================
// HEALTHKART - MY ORDERS
// ========================================

const ordersList =
    document.getElementById("ordersList");

const emptyOrders =
    document.getElementById("emptyOrders");

const totalOrders =
    document.getElementById("totalOrders");

const activeOrders =
    document.getElementById("activeOrders");

const deliveredOrders =
    document.getElementById("deliveredOrders");


// ========================================
// LOCAL STORAGE
// ========================================

const ORDERS_KEY = "healthkartOrders";

let orders =
    JSON.parse(
        localStorage.getItem(ORDERS_KEY)
    ) || [];


// ========================================
// LOAD ORDERS
// ========================================

function renderOrders() {

    ordersList.innerHTML = "";


    if (orders.length === 0) {

        emptyOrders.style.display = "flex";

        totalOrders.textContent = "0";
        activeOrders.textContent = "0";
        deliveredOrders.textContent = "0";

        return;
    }


    emptyOrders.style.display = "none";


    orders.forEach(function (order) {

        const card =
            createOrderCard(order);

        ordersList.appendChild(card);

    });


    updateSummary();

}


// ========================================
// CREATE ORDER CARD
// ========================================

function createOrderCard(order) {

    const card =
        document.createElement("div");

    card.className = "order-card";


    const statusClass =
        getStatusClass(order.status);


    card.innerHTML = `

        <div class="order-card-top">

            <div class="order-info">

                <div class="order-icon">

                    <i class="fa-solid fa-box"></i>

                </div>

                <div>

                    <h3>
                        Order #${escapeHTML(
                            String(order.id)
                        )}
                    </h3>

                    <span>
                        ${escapeHTML(
                            order.product || "Healthcare Product"
                        )}
                    </span>

                </div>

            </div>


            <span class="order-status ${statusClass}">

                ${escapeHTML(
                    order.status || "Processing"
                )}

            </span>

        </div>


        <div class="order-details">

            <div class="order-detail">

                <span>Product</span>

                <strong>
                    ${escapeHTML(
                        order.product || "-"
                    )}
                </strong>

            </div>


            <div class="order-detail">

                <span>Order Date</span>

                <strong>
                    ${formatDate(order.date)}
                </strong>

            </div>


            <div class="order-detail">

                <span>Quantity</span>

                <strong>
                    ${escapeHTML(
                        String(order.quantity || 1)
                    )}
                </strong>

            </div>


            <div class="order-detail">

                <span>Total Amount</span>

                <strong>
                    ₹${escapeHTML(
                        String(order.total || 0)
                    )}
                </strong>

            </div>

        </div>


        <div class="order-actions">

            <button
                type="button"
                class="view-order">

                <i class="fa-solid fa-eye"></i>

                View Details

            </button>

        </div>

    `;


    const viewButton =
        card.querySelector(".view-order");


    viewButton.addEventListener(
        "click",
        function () {

            showOrderDetails(order);

        }
    );


    return card;
}


// ========================================
// UPDATE SUMMARY
// ========================================

function updateSummary() {

    const active =
        orders.filter(function (order) {

            return (
                order.status !== "Delivered" &&
                order.status !== "Cancelled"
            );

        }).length;


    const delivered =
        orders.filter(function (order) {

            return order.status === "Delivered";

        }).length;


    totalOrders.textContent =
        orders.length;

    activeOrders.textContent =
        active;

    deliveredOrders.textContent =
        delivered;

}


// ========================================
// STATUS CLASS
// ========================================

function getStatusClass(status) {

    if (status === "Delivered") {

        return "status-delivered";

    }


    if (status === "Shipped") {

        return "status-shipped";

    }


    return "status-processing";

}


// ========================================
// VIEW ORDER DETAILS
// ========================================

function showOrderDetails(order) {

    const message =

        "Order Details\n\n" +

        "Order ID: #" +
        (order.id || "-") +

        "\nProduct: " +
        (order.product || "-") +

        "\nQuantity: " +
        (order.quantity || 1) +

        "\nTotal: ₹" +
        (order.total || 0) +

        "\nStatus: " +
        (order.status || "Processing") +

        "\nOrder Date: " +
        formatDate(order.date);


    alert(message);

}


// ========================================
// FORMAT DATE
// ========================================

function formatDate(dateString) {

    if (!dateString) {

        return "-";

    }


    const date =
        new Date(dateString);


    if (isNaN(date.getTime())) {

        return dateString;

    }


    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


// ========================================
// SECURITY
// ========================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


// ========================================
// INITIAL LOAD
// ========================================

renderOrders();