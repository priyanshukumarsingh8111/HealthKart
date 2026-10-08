// ========================================
// HEALTHKART MEDICINE SEARCH & CART
// Dynamic medicine catalog with real images,
// filters, search, sorting, wishlist & cart.
// ========================================

const MEDICINES_FALLBACK = [
  {
    id: "paracetamol-500",
    name: "Paracetamol 500mg",
    category: "Medicine",
    description: "Fever and pain relief tablets",
    price: 25,
    originalPrice: 35,
    discount: "28% OFF",
    image: "../images/medicines/paracetamol-500.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
    rating: 4.7,
    reviews: 128,
    inStock: true
  },
  {
    id: "vitamin-d3-1000",
    name: "Vitamin D3 1000 IU",
    category: "Vitamin",
    description: "Daily vitamin D supplement for bone and immunity",
    price: 120,
    originalPrice: 150,
    discount: "20% OFF",
    image: "../images/medicines/vitamin-d3.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80",
    rating: 4.6,
    reviews: 94,
    inStock: true
  },
  {
    id: "bp-monitor",
    name: "Digital BP Monitor",
    category: "Device",
    description: "Automatic upper arm blood pressure monitor with LCD",
    price: 1699,
    originalPrice: 1999,
    discount: "15% OFF",
    image: "../images/medicines/bp-monitor.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&auto=format&fit=crop&q=80",
    rating: 4.5,
    reviews: 76,
    inStock: true
  },
  {
    id: "face-cleanser",
    name: "Gentle Face Cleanser",
    category: "Personal Care",
    description: "Mild foaming cleanser for sensitive skin",
    price: 249,
    originalPrice: 299,
    discount: "18% OFF",
    image: "../images/medicines/face-cleanser.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&auto=format&fit=crop&q=80",
    rating: 4.4,
    reviews: 63,
    inStock: true
  },
  {
    id: "amoxicillin-500",
    name: "Amoxicillin 500mg",
    category: "Medicine",
    description: "Broad-spectrum antibacterial capsules",
    price: 85,
    originalPrice: 110,
    discount: "22% OFF",
    image: "../images/medicines/amoxicillin.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600&auto=format&fit=crop&q=80",
    rating: 4.8,
    reviews: 112,
    inStock: true
  },
  {
    id: "cetirizine-10",
    name: "Cetirizine 10mg",
    category: "Medicine",
    description: "Fast-acting 24hr allergy relief tablets",
    price: 38,
    originalPrice: 50,
    discount: "24% OFF",
    image: "../images/medicines/cetirizine.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80",
    rating: 4.6,
    reviews: 88,
    inStock: true
  },
  {
    id: "pulse-oximeter",
    name: "Digital Pulse Oximeter",
    category: "Device",
    description: "Fingertip SpO2 pulse and oxygen monitor",
    price: 899,
    originalPrice: 1299,
    discount: "30% OFF",
    image: "../images/medicines/pulse-oximeter.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&auto=format&fit=crop&q=80",
    rating: 4.7,
    reviews: 142,
    inStock: true
  },
  {
    id: "first-aid-kit",
    name: "Emergency First Aid Kit",
    category: "Device",
    description: "Comprehensive 50-piece medical emergency kit",
    price: 499,
    originalPrice: 650,
    discount: "23% OFF",
    image: "../images/medicines/first-aid-kit.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80",
    rating: 4.9,
    reviews: 95,
    inStock: true
  }
];

let allMedicines = [];

// Cart Helpers
function getCart() {
  return JSON.parse(localStorage.getItem("healthkartCart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("healthkartCart", JSON.stringify(cart));
}

function updateCartCount() {
  const cart = getCart();
  const count = document.getElementById("cartCount");
  if (count) {
    count.textContent = cart.reduce((total, item) => total + (Number(item.quantity) || 1), 0);
  }
}

window.addToCart = function(name, price, image = "") {
  const cart = getCart();
  const existing = cart.find(item => item.name === name);

  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      name,
      price,
      image,
      quantity: 1
    });
  }

  saveCart(cart);
  updateCartCount();

  // Show friendly notification
  if (window.showLiveToast) {
    window.showLiveToast("Added to Cart", `${name} added to your shopping cart.`, "cart.html");
  } else {
    alert(`${name} added to cart!`);
  }
};

// Fetch Medicines
async function loadMedicines() {
  const grid = document.getElementById("productGrid");
  const resultText = document.getElementById("resultText");

  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #687970;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; color: #0b9f6e; margin-bottom: 12px; display:block;"></i>
        Loading healthcare products...
      </div>
    `;
  }

  try {
    const res = await fetch("/api/medicines");
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.success && data.medicines && data.medicines.length > 0) {
      allMedicines = data.medicines;
    } else {
      allMedicines = MEDICINES_FALLBACK;
    }
  } catch (err) {
    console.warn("Using offline medicine catalog:", err);
    allMedicines = MEDICINES_FALLBACK;
  }

  applyFilters();
}

// Render Medicine Cards
function renderMedicines(items) {
  const grid = document.getElementById("productGrid");
  const resultText = document.getElementById("resultText");
  if (!grid) return;

  if (resultText) {
    resultText.textContent = items.length === 0
      ? "No products found"
      : `Showing ${items.length} healthcare product${items.length > 1 ? "s" : ""}`;
  }

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-magnifying-glass"></i>
        <h3>No matching medicines found</h3>
        <p>Try clearing your filters or searching with different keywords.</p>
        <button type="button" onclick="clearFilters()" style="padding:10px 20px; background:#0b9f6e; color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer;">
          Reset All Filters
        </button>
      </div>
    `;
    return;
  }

  grid.innerHTML = items.map(m => {
    // Resolve relative image path
    const imgSrc = m.image.startsWith("../") || m.image.startsWith("/") || m.image.startsWith("http")
      ? (m.image.startsWith("/") ? ".." + m.image : m.image)
      : "../images/medicines/" + m.image;

    const fallbackSrc = m.fallbackImage || "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600";

    return `
      <article class="product-card" data-name="${m.name}" data-category="${m.category}" data-rating="${m.rating}" data-price="${m.price}">
        ${m.discount ? `<div class="discount">${m.discount}</div>` : ''}

        <div class="product-image">
          <img
            src="${imgSrc}"
            alt="${m.name}"
            loading="lazy"
            onerror="this.onerror=null; this.src='${fallbackSrc}';"
          >
        </div>

        <span class="category">${m.category}</span>
        <h3>${m.name}</h3>
        <p class="description">${m.description}</p>

        <div class="rating">
          ★ ${m.rating} <span>(${m.reviews || 50} reviews)</span>
        </div>

        <div class="price">
          <strong>₹${m.price}</strong>
          ${m.originalPrice ? `<del>₹${m.originalPrice}</del>` : ''}
        </div>

        <div class="stock">
          <i class="fa-solid fa-circle-check"></i> In Stock
        </div>

        <button
          type="button"
          class="wishlist-btn"
          onclick="if(window.addToWishlist) addToWishlist('${m.id}', '${m.name}', '${m.description}', ${m.price}); else alert('Added to wishlist!');"
        >
          <i class="fa-regular fa-heart"></i> Wishlist
        </button>

        <button
          type="button"
          class="add-cart"
          onclick="addToCart('${m.name}', ${m.price}, '${imgSrc}')"
        >
          <i class="fa-solid fa-cart-plus"></i> Add to Cart
        </button>

        <a href="product-details.html?id=${m.id}" class="view-product">
          View Details
        </a>
      </article>
    `;
  }).join("");
}

// Filter and Search Logic
function applyFilters() {
  const input = document.getElementById("productSearch") || document.getElementById("mainProductSearch");
  const query = input ? input.value.toLowerCase().trim() : "";

  // Selected categories
  const catBoxes = Array.from(document.querySelectorAll(".category-filter:checked, .filters input[value]:checked"))
    .map(cb => cb.value.toLowerCase());

  // Availability filter
  const inStockOnly = document.getElementById("filterInStock")?.checked;

  // Rating filter
  const minRatingEl = document.querySelector('input[name="ratingFilter"]:checked');
  const minRating = minRatingEl ? parseFloat(minRatingEl.value) : 0;

  // Sort
  const sortSelect = document.getElementById("sortProducts");
  const sortVal = sortSelect ? sortSelect.value : "";

  let filtered = allMedicines.filter(m => {
    // Search query
    const matchesSearch = !query ||
      m.name.toLowerCase().includes(query) ||
      m.description.toLowerCase().includes(query) ||
      m.category.toLowerCase().includes(query);

    // Category
    const matchesCat = catBoxes.length === 0 || catBoxes.includes(m.category.toLowerCase());

    // Stock
    const matchesStock = !inStockOnly || m.inStock;

    // Rating
    const matchesRating = !minRating || m.rating >= minRating;

    return matchesSearch && matchesCat && matchesStock && matchesRating;
  });

  // Sort
  if (sortVal.includes("Low to High")) {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortVal.includes("High to Low")) {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sortVal.includes("Rating")) {
    filtered.sort((a, b) => b.rating - a.rating);
  }

  renderMedicines(filtered);
}

window.searchProducts = applyFilters;

window.clearFilters = function() {
  document.querySelectorAll(".filters input").forEach(input => {
    input.checked = false;
  });

  const searchInput = document.getElementById("productSearch") || document.getElementById("mainProductSearch");
  if (searchInput) searchInput.value = "";

  const sortSelect = document.getElementById("sortProducts");
  if (sortSelect) sortSelect.selectedIndex = 0;

  applyFilters();
};

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();

  const searchInput = document.getElementById("productSearch") || document.getElementById("mainProductSearch");
  if (searchInput) {
    searchInput.addEventListener("input", applyFilters);
  }

  document.querySelectorAll(".filters input").forEach(input => {
    input.addEventListener("change", applyFilters);
  });

  const sortSelect = document.getElementById("sortProducts");
  if (sortSelect) {
    sortSelect.addEventListener("change", applyFilters);
  }

  // URL query search parameter
  const params = new URLSearchParams(window.location.search);
  const q = params.get("search");
  if (q && searchInput) {
    searchInput.value = q;
  }

  loadMedicines();
});