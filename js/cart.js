function getCart() {

    return JSON.parse(
        localStorage.getItem("healthkartCart")
    ) || [];

}


function saveCart(cart) {

    localStorage.setItem(
        "healthkartCart",
        JSON.stringify(cart)
    );

}


function renderCart() {

    const cart = getCart();

    const cartContainer =
        document.getElementById("cartItems");

    const emptyCart =
        document.getElementById("emptyCart");


    if (!cartContainer) return;


    cartContainer.innerHTML = "";


    if (cart.length === 0) {

        emptyCart.style.display = "block";

        updateSummary();

        return;

    }


    emptyCart.style.display = "none";


    cart.forEach((item, index) => {

        const cartItem =
            document.createElement("div");

        cartItem.className = "cart-item";


        cartItem.innerHTML = `

            <div class="cart-item-image">

                <i class="fa-solid fa-pills"></i>

            </div>


            <div class="cart-item-info">

                <h3>
                    ${item.name}
                </h3>

                <p>
                    Healthcare Product
                </p>

                <div class="cart-item-price">
                    ₹${item.price}
                </div>


                <div class="quantity-box">

                    <button
                        onclick="decreaseQuantity(${index})">

                        −

                    </button>


                    <span>
                        ${item.quantity}
                    </span>


                    <button
                        onclick="increaseQuantity(${index})">

                        +

                    </button>

                </div>


                <button
                    class="remove-button"
                    onclick="removeItem(${index})">

                    <i class="fa-solid fa-trash"></i>

                    Remove

                </button>

            </div>


            <div>

                <strong>
                    ₹${item.price * item.quantity}
                </strong>

            </div>

        `;


        cartContainer.appendChild(cartItem);

    });


    updateSummary();

}


function increaseQuantity(index) {

    const cart = getCart();

    cart[index].quantity += 1;

    saveCart(cart);

    renderCart();

}


function decreaseQuantity(index) {

    const cart = getCart();

    if (cart[index].quantity > 1) {

        cart[index].quantity -= 1;

    } else {

        cart.splice(index, 1);

    }

    saveCart(cart);

    renderCart();

}


function removeItem(index) {

    const cart = getCart();

    cart.splice(index, 1);

    saveCart(cart);

    renderCart();

}


function updateSummary() {

    const cart = getCart();


    let subtotal = 0;


    cart.forEach(item => {

        subtotal +=
            item.price * item.quantity;

    });


    let delivery = 0;


    if (subtotal > 0 && subtotal < 500) {

        delivery = 40;

    }


    const total =
        subtotal + delivery;


    document.getElementById(
        "subtotal"
    ).textContent =
        "₹" + subtotal;


    document.getElementById(
        "delivery"
    ).textContent =
        "₹" + delivery;


    document.getElementById(
        "total"
    ).textContent =
        "₹" + total;


    const count =
        document.getElementById(
            "cartCount"
        );


    if (count) {

        let itemCount = 0;

        cart.forEach(item => {

            itemCount += item.quantity;

        });

        count.textContent =
            itemCount;

    }

}


function goToCheckout() {

    const cart = getCart();

    if (cart.length === 0) {

        alert(
            "Your cart is empty. Please add a product first."
        );

        return;

    }


    window.location.href =
        "checkout.html";

}


document.addEventListener(
    "DOMContentLoaded",
    renderCart
);