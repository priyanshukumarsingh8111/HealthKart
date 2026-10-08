// ========================================
// HEALTHKART - CHECKOUT
// ========================================

const CART_KEY = "healthkartCart";
const ORDERS_KEY = "healthkartOrders";


// ========================================
// GET CART
// ========================================

function getCart() {
    return JSON.parse(
        localStorage.getItem(CART_KEY)
    ) || [];
}


// ========================================
// LOAD CHECKOUT
// ========================================

function loadCheckout() {

    const cart = getCart();

    const container =
        document.getElementById("checkoutItems");

    let subtotal = 0;

    container.innerHTML = "";


    if (cart.length === 0) {

        container.innerHTML = `
            <div style="
                padding:15px 0;
                color:#68756e;
                font-size:12px;
            ">
                Your cart is empty.
            </div>
        `;

        updateTotals(0);

        return;
    }


    cart.forEach(function(item) {

        const price =
            Number(item.price) || 0;

        const quantity =
            Number(item.quantity) || 1;

        const amount =
            price * quantity;

        subtotal += amount;


        const div =
            document.createElement("div");

        div.className = "summary-line";


        div.innerHTML = `
            <span>
                ${escapeHTML(item.name || "Product")}
                × ${quantity}
            </span>

            <strong>
                ₹${amount}
            </strong>
        `;


        container.appendChild(div);

    });


    updateTotals(subtotal);
}


// ========================================
// UPDATE TOTALS
// ========================================

function updateTotals(subtotal) {

    const delivery =
        subtotal > 0 && subtotal < 500
            ? 40
            : 0;

    const total =
        subtotal + delivery;


    document.getElementById(
        "checkoutSubtotal"
    ).textContent =
        "₹" + subtotal;


    document.getElementById(
        "checkoutDelivery"
    ).textContent =
        "₹" + delivery;


    document.getElementById(
        "checkoutTotal"
    ).textContent =
        "₹" + total;

}


// ========================================
// PLACE ORDER
// ========================================

function placeOrder() {

    const name =
        document.getElementById(
            "name"
        ).value.trim();


    const mobile =
        document.getElementById(
            "mobile"
        ).value.trim();


    const address =
        document.getElementById(
            "address"
        ).value.trim();


    const city =
        document.getElementById(
            "city"
        ).value.trim();


    const pincode =
        document.getElementById(
            "pincode"
        ).value.trim();


    // ------------------------------------
    // VALIDATION
    // ------------------------------------

    if (
        name === "" ||
        mobile === "" ||
        address === "" ||
        city === "" ||
        pincode === ""
    ) {

        alert(
            "Please fill all delivery details."
        );

        return;
    }


    const cart = getCart();


    if (cart.length === 0) {

        alert(
            "Your cart is empty."
        );

        return;
    }


    // ------------------------------------
    // PAYMENT
    // ------------------------------------

    const paymentElement =
        document.querySelector(
            'input[name="payment"]:checked'
        );


    const payment =
        paymentElement
            ? paymentElement.value
            : "COD";


    // ------------------------------------
    // CALCULATE TOTAL
    // ------------------------------------

    let subtotal = 0;


    cart.forEach(function(item) {

        const price =
            Number(item.price) || 0;

        const quantity =
            Number(item.quantity) || 1;

        subtotal +=
            price * quantity;

    });


    const delivery =
        subtotal > 0 && subtotal < 500
            ? 40
            : 0;


    const total =
        subtotal + delivery;


    // ------------------------------------
    // ORDER ID
    // ------------------------------------

    const orderId =
        "HK" +
        Math.floor(
            100000 +
            Math.random() * 900000
        );


    // ------------------------------------
    // ORDER OBJECT
    // ------------------------------------

    const order = {

        id: orderId,

        product:
            cart.length === 1
                ? cart[0].name
                : `${cart.length} Products`,

        items: cart,

        quantity:
            cart.reduce(
                function(total, item) {
                    return total +
                        (Number(item.quantity) || 1);
                },
                0
            ),

        subtotal: subtotal,

        delivery: delivery,

        total: total,

        status: "Processing",

        payment: payment,

        customer: {
            name: name,
            mobile: mobile,
            address: address,
            city: city,
            pincode: pincode
        },

        date:
            new Date().toISOString()

    };


    // ------------------------------------
    // SAVE ORDER
    // ------------------------------------

    const existingOrders =
        JSON.parse(
            localStorage.getItem(
                ORDERS_KEY
            )
        ) || [];


    existingOrders.unshift(order);


    localStorage.setItem(
        ORDERS_KEY,
        JSON.stringify(existingOrders)
    );


    // ------------------------------------
    // CLEAR CART
    // ------------------------------------

    localStorage.removeItem(
        CART_KEY
    );


    // ------------------------------------
    // SUCCESS
    // ------------------------------------

    alert(
        "Order placed successfully!\n\n" +
        "Order ID: " +
        orderId +
        "\n" +
        "Payment: " +
        payment +
        "\n" +
        "Total: ₹" +
        total
    );


    // ------------------------------------
    // GO TO MY ORDERS
    // ------------------------------------

    window.location.href =
        "orders.html";

}


// ========================================
// HTML SECURITY
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
// INITIALIZE
// ========================================

loadCheckout();