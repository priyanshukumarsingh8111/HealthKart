const WISHLIST_KEY = "healthkartWishlist";
const CART_KEY = "healthkartCart";

const wishlistGrid = document.getElementById("wishlistGrid");
const emptyWishlist = document.getElementById("emptyWishlist");


// ==========================================
// GET WISHLIST
// ==========================================

function getWishlist() {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
}


// ==========================================
// SAVE WISHLIST
// ==========================================

function saveWishlist(wishlist) {
    localStorage.setItem(
        WISHLIST_KEY,
        JSON.stringify(wishlist)
    );
}


// ==========================================
// ADD TO WISHLIST
// ==========================================

function addToWishlist(id, name, description, price) {

    let wishlist = getWishlist();

    const existingProduct = wishlist.find(function(product) {
        return product.id === id;
    });


    // Already exists
    if (existingProduct) {

        alert(
            name +
            " is already in your wishlist ❤️"
        );

        updateWishlistButtons();

        return;
    }


    // New product
    const product = {
        id: id,
        name: name,
        description: description,
        price: Number(price) || 0
    };


    wishlist.push(product);

    saveWishlist(wishlist);


    // Update buttons
    updateWishlistButtons();


    alert(
        name +
        " added to your wishlist ❤️"
    );
}


// ==========================================
// UPDATE SEARCH PAGE WISHLIST BUTTONS
// ==========================================

function updateWishlistButtons() {

    const wishlist = getWishlist();


    const wishlistButtons =
        document.querySelectorAll(".wishlist-btn");


    wishlistButtons.forEach(function(button) {

        const onclickValue =
            button.getAttribute("onclick");


        if (!onclickValue) {
            return;
        }


        const productId =
            getProductIdFromButton(onclickValue);


        const isWishlisted =
            wishlist.some(function(product) {

                return product.id === productId;

            });


        const icon =
            button.querySelector("i");


        if (isWishlisted) {

            button.classList.add("wishlisted");

            button.innerHTML = `
                <i class="fa-solid fa-heart"></i>
                Wishlisted
            `;

        } else {

            button.classList.remove("wishlisted");

            button.innerHTML = `
                <i class="fa-regular fa-heart"></i>
                Wishlist
            `;
        }

    });
}


// ==========================================
// GET PRODUCT ID FROM ONCLICK
// ==========================================

function getProductIdFromButton(onclickValue) {

    const match =
        onclickValue.match(
            /addToWishlist\(\s*['"]([^'"]+)['"]/
        );


    if (match) {
        return match[1];
    }


    return null;
}


// ==========================================
// RENDER WISHLIST PAGE
// ==========================================

function renderWishlist() {

    // Search page par ye elements nahi honge
    if (!wishlistGrid || !emptyWishlist) {
        return;
    }


    const wishlist = getWishlist();

    wishlistGrid.innerHTML = "";


    // Empty wishlist
    if (wishlist.length === 0) {

        emptyWishlist.style.display = "block";

        return;
    }


    emptyWishlist.style.display = "none";


    wishlist.forEach(function(product) {

        const card =
            createWishlistCard(product);

        wishlistGrid.appendChild(card);

    });
}


// ==========================================
// CREATE WISHLIST CARD
// ==========================================

function createWishlistCard(product) {

    const card =
        document.createElement("div");


    card.className =
        "wishlist-card";


    card.innerHTML = `

        <button
            class="remove-wishlist"
            type="button"
            title="Remove from Wishlist">

            <i class="fa-solid fa-xmark"></i>

        </button>


        <div class="product-image">

            <i class="fa-solid fa-pills"></i>

        </div>


        <h3 class="product-name">

            ${escapeHTML(
                product.name ||
                "Healthcare Product"
            )}

        </h3>


        <p class="product-description">

            ${escapeHTML(
                product.description ||
                "Quality healthcare product"
            )}

        </p>


        <div class="product-price">

            ₹${escapeHTML(
                String(product.price || 0)
            )}

            <span>
                per unit
            </span>

        </div>


        <button
            class="cart-button"
            type="button">

            <i class="fa-solid fa-cart-plus"></i>

            Add to Cart

        </button>

    `;


    // Remove
    const removeButton =
        card.querySelector(
            ".remove-wishlist"
        );


    removeButton.addEventListener(
        "click",
        function() {

            removeFromWishlist(
                product.id
            );

        }
    );


    // Add to Cart
    const cartButton =
        card.querySelector(
            ".cart-button"
        );


    cartButton.addEventListener(
        "click",
        function() {

            addProductToCart(product);

        }
    );


    return card;
}


// ==========================================
// REMOVE FROM WISHLIST
// ==========================================

function removeFromWishlist(productId) {

    let wishlist =
        getWishlist();


    wishlist =
        wishlist.filter(function(product) {

            return product.id !== productId;

        });


    saveWishlist(wishlist);


    renderWishlist();


    // Update Search page buttons
    updateWishlistButtons();


    alert(
        "Product removed from wishlist."
    );
}


// ==========================================
// ADD WISHLIST PRODUCT TO CART
// ==========================================

function addProductToCart(product) {

    let cart =
        JSON.parse(
            localStorage.getItem(CART_KEY)
        ) || [];


    const existingProduct =
        cart.find(function(item) {

            return item.id === product.id;

        });


    if (existingProduct) {

        existingProduct.quantity =
            (Number(existingProduct.quantity) || 1) + 1;

    } else {

        cart.push({

            id: product.id,

            name: product.name,

            price:
                Number(product.price) || 0,

            quantity: 1

        });

    }


    localStorage.setItem(
        CART_KEY,
        JSON.stringify(cart)
    );


    alert(
        product.name +
        " added to cart!"
    );


    updateCartCount();
}


// ==========================================
// CART COUNT
// ==========================================

function updateCartCount() {

    const cartCount =
        document.getElementById(
            "cartCount"
        );


    if (!cartCount) {
        return;
    }


    const cart =
        JSON.parse(
            localStorage.getItem(CART_KEY)
        ) || [];


    const totalQuantity =
        cart.reduce(
            function(total, item) {

                return total +
                    (Number(item.quantity) || 1);

            },
            0
        );


    cartCount.textContent =
        totalQuantity;
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


// ==========================================
// INITIALIZE
// ==========================================

renderWishlist();

updateWishlistButtons();

updateCartCount();